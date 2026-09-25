/**
 * Total parse surface for serialized document-adapter documents.
 *
 * `parseDocumentDescriptor`, `parseExtractionCandidate`,
 * `parseStageEvidenceChain`, and `parseProvisionalAdapterDefinition`
 * never throw: schema violations surface as typed `malformed-document`
 * issues with precise dotted paths (strict objects reject unknown —
 * vendor/provider — fields), and a serialized document can additionally
 * be admitted FOR a tenant, where a scope mismatch is the typed
 * `cross-tenant-denied` rejection (R12).
 */
import type {
  DocumentAdapterResult,
  DocumentDescriptor,
  ExtractionCandidate,
  ProvisionalAdapterDefinition,
  StageEvidenceChain,
  TenantScope,
} from './types';
import { malformedDocument } from './issues';
import {
  DocumentDescriptorSchema,
  ExtractionCandidateSchema,
  ProvisionalAdapterDefinitionSchema,
  StageEvidenceChainSchema,
} from './schema';

/** Options shared by the parse entry points. */
export interface ParseOptions {
  /** Tenant the caller parses FOR (R12): a mismatch is denied. */
  readonly expectedTenantId?: string | undefined;
}

function tenantDenied(
  scope: TenantScope,
  expectedTenantId: string,
  path: readonly (string | number)[],
): DocumentAdapterResult<never> {
  return {
    ok: false,
    error: {
      code: 'cross-tenant-denied',
      message:
        `document belongs to tenant "${scope.tenantId}" but the caller parses for "${expectedTenantId}" (R12 multi-tenant isolation)`,
      path,
      expectedTenantId,
      encounteredTenantId: scope.tenantId,
    },
  };
}

/** Parse and validate a serialized document descriptor (total). */
export function parseDocumentDescriptor(
  input: unknown,
  options: ParseOptions = {},
): DocumentAdapterResult<DocumentDescriptor> {
  const parsed = DocumentDescriptorSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: malformedDocument(parsed.error) };
  }
  if (
    options.expectedTenantId !== undefined &&
    parsed.data.tenantScope.tenantId !== options.expectedTenantId
  ) {
    return tenantDenied(parsed.data.tenantScope, options.expectedTenantId, ['tenantScope', 'tenantId']);
  }
  return { ok: true, value: parsed.data };
}

/** Parse and validate a serialized extraction candidate (total). */
export function parseExtractionCandidate(
  input: unknown,
  options: ParseOptions = {},
): DocumentAdapterResult<ExtractionCandidate> {
  const parsed = ExtractionCandidateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: malformedDocument(parsed.error) };
  }
  if (
    options.expectedTenantId !== undefined &&
    parsed.data.tenantScope.tenantId !== options.expectedTenantId
  ) {
    return tenantDenied(parsed.data.tenantScope, options.expectedTenantId, ['tenantScope', 'tenantId']);
  }
  return { ok: true, value: parsed.data };
}

/** Parse and validate a serialized stage evidence chain (total). */
export function parseStageEvidenceChain(
  input: unknown,
  options: ParseOptions = {},
): DocumentAdapterResult<StageEvidenceChain> {
  const parsed = StageEvidenceChainSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: malformedDocument(parsed.error) };
  }
  if (
    options.expectedTenantId !== undefined &&
    parsed.data.tenantScope.tenantId !== options.expectedTenantId
  ) {
    return tenantDenied(parsed.data.tenantScope, options.expectedTenantId, ['tenantScope', 'tenantId']);
  }
  return { ok: true, value: parsed.data };
}

/** Parse and validate a serialized provisional definition (total). */
export function parseProvisionalAdapterDefinition(
  input: unknown,
  options: ParseOptions = {},
): DocumentAdapterResult<ProvisionalAdapterDefinition> {
  const parsed = ProvisionalAdapterDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: malformedDocument(parsed.error) };
  }
  if (
    options.expectedTenantId !== undefined &&
    parsed.data.tenantScope.tenantId !== options.expectedTenantId
  ) {
    return tenantDenied(parsed.data.tenantScope, options.expectedTenantId, ['tenantScope', 'tenantId']);
  }
  return { ok: true, value: parsed.data };
}
