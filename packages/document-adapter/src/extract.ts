/**
 * Deterministic document admission and candidate extraction.
 *
 * Extraction is typed data over CONTENT-ADDRESSED documents: the
 * admission gate recomputes the canonical bytes, the digest, and the
 * byte length from the actual content (a descriptor that mis-claims its
 * content is tampering and is rejected), then parses the typed document
 * form with precise-path diagnostics, then derives candidates as a PURE
 * PROJECTION. Identical (document bytes, descriptor) always derive
 * identical candidates in identical order (sorted by content-derived
 * candidate id — no insertion-order leaks). Zero wall-clock, zero
 * randomness.
 *
 * Error precedence (fixed): unsupported-format -> digest-mismatch ->
 * malformed-document -> (downstream chain/tenant/policy errors).
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  canonicalByteLength,
  canonicalDocumentBytes,
  computeDocumentDigest,
} from './canonical';
import { malformedAt } from './issues';
import {
  DocumentContentSchema,
  DocumentDescriptorSchema,
  ExtractionCandidateSchema,
} from './schema';
import { DOCUMENT_FORMATS } from './version';
import type {
  DocumentAdapterError,
  DocumentAdapterResult,
  DocumentContent,
  DocumentDescriptor,
  ExtractionCandidate,
  ParsedDocument,
  ParsedMappingRow,
  PropertyMapping,
  TenantScope,
} from './types';

/** Options shared by the total admission entry points. */
export interface AdmissionOptions {
  /** Tenant the caller is admitting FOR (R12): a mismatch is denied. */
  readonly expectedTenantId?: string | undefined;
}

/** Options for {@link parseDocument}. */
export type ParseDocumentOptions = AdmissionOptions;

function unsupportedFormat(format: string): DocumentAdapterError {
  return {
    code: 'unsupported-format',
    message:
      `document format "${format}" is not one of the supported deterministic document forms ` +
      `(${DOCUMENT_FORMATS.join(', ')}); real-world formats are future adapter work behind this seam`,
    format,
    supportedFormats: [...DOCUMENT_FORMATS],
  };
}

function digestMismatch(
  path: readonly (string | number)[],
  expected: string,
  encountered: string,
  message: string,
): DocumentAdapterError {
  return { code: 'digest-mismatch', message, path, expected, encountered };
}

/** Admit a serialized document content object (total, never throws). */
export function admitDocumentContent(input: unknown): DocumentAdapterResult<DocumentContent> {
  if (typeof input !== 'object' || input === null) {
    return { ok: false, error: malformedAt('$', 'document content must be an object') };
  }
  const format = (input as { format?: unknown }).format;
  if (typeof format !== 'string' || !DOCUMENT_FORMATS.includes(format as never)) {
    return { ok: false, error: unsupportedFormat(String(format)) };
  }
  const parsed = DocumentContentSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      path: issue.path.map((segment) => String(segment)).join('.') || '$',
      message: issue.message,
    }));
    return {
      ok: false,
      error: {
        code: 'malformed-document',
        message: `document content failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'}); unknown fields are rejected (provider/vendor fields cannot enter the typed surface)`,
        issues,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** Admit a serialized document descriptor (total, never throws). */
export function admitDocumentDescriptor(
  input: unknown,
  options: AdmissionOptions = {},
): DocumentAdapterResult<DocumentDescriptor> {
  if (typeof input === 'object' && input !== null) {
    const format = (input as { format?: unknown }).format;
    if (typeof format === 'string' && !DOCUMENT_FORMATS.includes(format as never)) {
      return { ok: false, error: unsupportedFormat(format) };
    }
  }
  const parsed = DocumentDescriptorSchema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      path: issue.path.map((segment) => String(segment)).join('.') || '$',
      message: issue.message,
    }));
    return {
      ok: false,
      error: {
        code: 'malformed-document',
        message: `document descriptor failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'}); unknown fields are rejected (provider/vendor fields cannot enter the typed surface)`,
        issues,
      },
    };
  }
  if (
    options.expectedTenantId !== undefined &&
    parsed.data.tenantScope.tenantId !== options.expectedTenantId
  ) {
    return {
      ok: false,
      error: {
        code: 'cross-tenant-denied',
        message:
          `document descriptor belongs to tenant "${parsed.data.tenantScope.tenantId}" but the caller admits for "${options.expectedTenantId}" (R12 multi-tenant isolation)`,
        path: ['tenantScope', 'tenantId'],
        expectedTenantId: options.expectedTenantId,
        encounteredTenantId: parsed.data.tenantScope.tenantId,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Parse a document against its descriptor (the `parsed` stage of the
 * pipeline). Admission discipline:
 *
 * 1. content and descriptor must agree on the format;
 * 2. the descriptor's digest claim must equal the digest RECOMPUTED from
 *    the content's canonical bytes (tamper rejection);
 * 3. the descriptor's byte-length claim must equal the canonical byte
 *    length;
 * 4. the typed form must be well-formed (line grammar / JSON grammar with
 *    precise paths).
 */
export function parseDocument(
  content: DocumentContent,
  descriptor: DocumentDescriptor,
  options: ParseDocumentOptions = {},
): DocumentAdapterResult<ParsedDocument> {
  if (options.expectedTenantId !== undefined) {
    if (descriptor.tenantScope.tenantId !== options.expectedTenantId) {
      return {
        ok: false,
        error: {
          code: 'cross-tenant-denied',
          message:
            `document belongs to tenant "${descriptor.tenantScope.tenantId}" but the caller parses for "${options.expectedTenantId}" (R12 multi-tenant isolation)`,
          path: ['tenantScope', 'tenantId'],
          expectedTenantId: options.expectedTenantId,
          encounteredTenantId: descriptor.tenantScope.tenantId,
        },
      };
    }
  }
  if (content.format !== descriptor.format) {
    return {
      ok: false,
      error: malformedAt(
        'format',
        `document content has format "${content.format}" but its descriptor claims "${descriptor.format}"`,
      ),
    };
  }
  const bytes = canonicalDocumentBytes(content);
  const recomputedDigest = computeDocumentDigest(content);
  if (recomputedDigest !== descriptor.digest) {
    return {
      ok: false,
      error: digestMismatch(
        ['digest'],
        recomputedDigest,
        descriptor.digest,
        'descriptor digest does not match the recomputed digest of the document content (tampered or mismatched descriptor)',
      ),
    };
  }
  const byteLength = canonicalByteLength(content);
  if (byteLength !== descriptor.byteLength) {
    return {
      ok: false,
      error: malformedAt(
        'byteLength',
        `descriptor byteLength claims ${descriptor.byteLength} but the canonical bytes are ${byteLength} bytes`,
      ),
    };
  }
  const rows = content.format === 'structured-text'
    ? parseTextForm(bytes)
    : parseJsonForm(content.json);
  if (!rows.ok) return rows;
  return {
    ok: true,
    value: {
      schemaVersion: 1,
      descriptor,
      canonicalBytes: bytes,
      rows: rows.value,
    },
  };
}

/** The mapping-line grammar of the structured-text form. */
const MAPPING_LINE_PATTERN =
  /^([A-Za-z][A-Za-z0-9_.-]*)\s*->\s*([a-z][a-z0-9-]*:[a-z][a-z0-9-]*)(?:\s+\[confidence\s+(0(?:\.\d+)?|1(?:\.0+)?)\])?$/;

const SOURCE_PATH = /^[A-Za-z][A-Za-z0-9_.-]*$/;
const SEMANTIC_KEY = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
const PROPERTY_NAME = /^[A-Za-z][A-Za-z0-9_.-]*$/;
const QUALIFIED_NAME = /^[a-z0-9]+(\.[a-z0-9-]+)+$/;
const SEMVER_CORE = /^\d+\.\d+\.\d+$/;
const DOCUMENT_KIND = 'mapping-table' as const;

function parseTextForm(text: string): DocumentAdapterResult<readonly ParsedMappingRow[]> {
  const rows: ParsedMappingRow[] = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const match = MAPPING_LINE_PATTERN.exec(trimmed);
    if (match === null) {
      return {
        ok: false,
        error: malformedAt(
          `lines[${lineNumber}]`,
          `mapping line ${lineNumber} does not match the grammar "<source-path> -> <namespace:name> [confidence <0..1>]" (got: "${trimmed}")`,
        ),
      };
    }
    const [, sourcePath, semanticTarget, confidence] = match;
    rows.push({
      sourcePath: sourcePath!,
      semanticTarget: semanticTarget!,
      propertyMappings: [],
      ...(confidence === undefined ? {} : { declaredConfidence: Number(confidence) }),
      line: lineNumber,
    });
  }
  if (rows.length === 0) {
    return {
      ok: false,
      error: malformedAt('$', 'structured-text document contains no mapping lines (empty documents are not mapping tables)'),
    };
  }
  return { ok: true, value: rows };
}

function parseJsonForm(json: JsonValue): DocumentAdapterResult<readonly ParsedMappingRow[]> {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return {
      ok: false,
      error: malformedAt('$', 'structured-json document must be a JSON object'),
    };
  }
  const root = json as Record<string, unknown>;
  const ROOT_KEYS = ['documentKind', 'mappings'];
  for (const key of Object.keys(root)) {
    if (!ROOT_KEYS.includes(key)) {
      return {
        ok: false,
        error: malformedAt(
          key,
          `structured-json document carries unknown field "${key}" (allowed: ${ROOT_KEYS.join(', ')}) — provider/vendor fields are rejected`,
        ),
      };
    }
  }
  if (root['documentKind'] !== DOCUMENT_KIND) {
    return {
      ok: false,
      error: malformedAt(
        'documentKind',
        `structured-json document must declare documentKind "${DOCUMENT_KIND}" (got: ${JSON.stringify(root['documentKind'])})`,
      ),
    };
  }
  const mappings = root['mappings'];
  if (!Array.isArray(mappings) || mappings.length === 0) {
    return {
      ok: false,
      error: malformedAt('mappings', 'structured-json document must carry a non-empty "mappings" array'),
    };
  }
  const rows: ParsedMappingRow[] = [];
  for (let index = 0; index < mappings.length; index += 1) {
    const row = parseJsonMapping(mappings[index]!, index);
    if (!row.ok) return row;
    rows.push(row.value);
  }
  return { ok: true, value: rows };
}

function parseJsonMapping(
  input: unknown,
  index: number,
): DocumentAdapterResult<ParsedMappingRow> {
  const at = (field: string): string => `mappings[${index}].${field}`;
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: malformedAt(`mappings[${index}]`, 'mapping entry must be an object') };
  }
  const row = input as Record<string, unknown>;
  const ROW_KEYS = [
    'sourcePath',
    'semanticTarget',
    'propertyMappings',
    'confidence',
    'capabilityRef',
  ];
  for (const key of Object.keys(row)) {
    if (!ROW_KEYS.includes(key)) {
      return {
        ok: false,
        error: malformedAt(
          `mappings[${index}].${key}`,
          `mapping entry carries unknown field "${key}" (allowed: ${ROW_KEYS.join(', ')}) — provider/vendor fields are rejected`,
        ),
      };
    }
  }
  const sourcePath = row['sourcePath'];
  if (typeof sourcePath !== 'string' || !SOURCE_PATH.test(sourcePath)) {
    return {
      ok: false,
      error: malformedAt(at('sourcePath'), 'mapping sourcePath must be a stable document field identifier (letter first, then letters/digits/._-)'),
    };
  }
  const semanticTarget = row['semanticTarget'];
  if (typeof semanticTarget !== 'string' || !SEMANTIC_KEY.test(semanticTarget)) {
    return {
      ok: false,
      error: malformedAt(at('semanticTarget'), "mapping semanticTarget must be a W002 semantic type key 'namespace:name' with lowercase segments"),
    };
  }
  const propertyMappings: PropertyMapping[] = [];
  if (row['propertyMappings'] !== undefined) {
    const list = row['propertyMappings'];
    if (!Array.isArray(list) || list.length === 0) {
      return {
        ok: false,
        error: malformedAt(at('propertyMappings'), 'propertyMappings must be a non-empty array when present'),
      };
    }
    for (let pIndex = 0; pIndex < list.length; pIndex += 1) {
      const entry = list[pIndex]!;
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        return {
          ok: false,
          error: malformedAt(at(`propertyMappings[${pIndex}]`), 'property mapping must be an object'),
        };
      }
      const mapping = entry as Record<string, unknown>;
      const MAPPING_KEYS = ['sourceProperty', 'semanticProperty'];
      for (const key of Object.keys(mapping)) {
        if (!MAPPING_KEYS.includes(key)) {
          return {
            ok: false,
            error: malformedAt(
              `mappings[${index}].propertyMappings[${pIndex}].${key}`,
              `property mapping carries unknown field "${key}" (allowed: sourceProperty, semanticProperty) — provider/vendor fields are rejected`,
            ),
          };
        }
      }
      const sourceProperty = mapping['sourceProperty'];
      const semanticProperty = mapping['semanticProperty'];
      if (typeof sourceProperty !== 'string' || !PROPERTY_NAME.test(sourceProperty)) {
        return {
          ok: false,
          error: malformedAt(at(`propertyMappings[${pIndex}].sourceProperty`), 'sourceProperty must be a short stable property identifier'),
        };
      }
      if (typeof semanticProperty !== 'string' || !PROPERTY_NAME.test(semanticProperty)) {
        return {
          ok: false,
          error: malformedAt(at(`propertyMappings[${pIndex}].semanticProperty`), 'semanticProperty must be a short stable property identifier'),
        };
      }
      propertyMappings.push({ sourceProperty, semanticProperty });
    }
  }
  let declaredConfidence: number | undefined;
  if (row['confidence'] !== undefined) {
    const confidence = row['confidence'];
    if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      return {
        ok: false,
        error: malformedAt(at('confidence'), 'confidence must be a number in [0, 1]'),
      };
    }
    declaredConfidence = confidence;
  }
  let capabilityRef: { id: string; version: string } | undefined;
  if (row['capabilityRef'] !== undefined) {
    const reference = row['capabilityRef'];
    if (typeof reference !== 'object' || reference === null || Array.isArray(reference)) {
      return {
        ok: false,
        error: malformedAt(at('capabilityRef'), 'capabilityRef must be an object { id, version }'),
      };
    }
    const ref = reference as Record<string, unknown>;
    const id = ref['id'];
    const version = ref['version'];
    if (typeof id !== 'string' || !QUALIFIED_NAME.test(id)) {
      return {
        ok: false,
        error: malformedAt(at('capabilityRef.id'), 'capabilityRef.id must be a dot-namespaced qualified capability id'),
      };
    }
    if (typeof version !== 'string' || !SEMVER_CORE.test(version)) {
      return {
        ok: false,
        error: malformedAt(at('capabilityRef.version'), 'capabilityRef.version must be a semver core version'),
      };
    }
    capabilityRef = { id, version };
  }
  return {
    ok: true,
    value: {
      sourcePath,
      semanticTarget,
      propertyMappings,
      ...(declaredConfidence === undefined ? {} : { declaredConfidence }),
      ...(capabilityRef === undefined ? {} : { capabilityRef }),
    },
  };
}

/** Build the content-derived identity of a candidate (sans id). */
function candidateContent(
  descriptor: DocumentDescriptor,
  row: ParsedMappingRow,
): Record<string, unknown> {
  const locator =
    row.line === undefined
      ? { format: 'structured-json' as const, sourcePath: row.sourcePath }
      : { format: 'structured-text' as const, sourcePath: row.sourcePath, line: row.line };
  return {
    schemaVersion: 1,
    documentDigest: descriptor.digest,
    tenantScope: descriptor.tenantScope,
    locator,
    semanticTarget: row.semanticTarget,
    propertyMappings: row.propertyMappings,
    ...(row.declaredConfidence === undefined ? {} : { declaredConfidence: row.declaredConfidence }),
    ...(row.capabilityRef === undefined ? {} : { capabilityRef: row.capabilityRef }),
  };
}

/**
 * Derive the typed mapping candidates from a parsed document (the
 * `candidates-extracted` stage core). PURE and deterministic: identical
 * parsed documents derive identical candidates; the result is sorted by
 * candidate id ascending (content-derived, so ordering never depends on
 * document insertion order or iteration luck).
 */
export function extractCandidates(parsed: ParsedDocument): readonly ExtractionCandidate[] {
  const candidates = parsed.rows.map((row) => {
    const content = candidateContent(parsed.descriptor, row);
    const candidateId = `cand:${canonicalDigest(content as unknown as JsonValue)}`;
    const candidate = { ...content, candidateId } as ExtractionCandidate;
    return candidate;
  });
  const sorted = [...candidates].sort((a, b) => (a.candidateId < b.candidateId ? -1 : a.candidateId > b.candidateId ? 1 : 0));
  return sorted;
}

/** Validate a constructed candidate against its schema (defense in depth). */
export function validateCandidate(candidate: ExtractionCandidate): DocumentAdapterResult<ExtractionCandidate> {
  const parsed = ExtractionCandidateSchema.safeParse(candidate);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      path: issue.path.map((segment) => String(segment)).join('.') || '$',
      message: issue.message,
    }));
    return {
      ok: false,
      error: {
        code: 'malformed-document',
        message: `derived candidate failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
        issues,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** The digest of a parsed document's canonical bytes (convenience). */
export function parsedDocumentDigest(parsed: ParsedDocument): Sha256Hex {
  return parsed.descriptor.digest;
}

/** Tenant scope of a parsed document (convenience). */
export function parsedTenantScope(parsed: ParsedDocument): TenantScope {
  return parsed.descriptor.tenantScope;
}
