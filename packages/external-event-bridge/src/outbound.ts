/**
 * The normalized OUTBOUND contract (the W042 dispatch pin): typed
 * OutboundRequest records with EXACTLY FOUR classes — information /
 * status / alert / acknowledgement-request — each carrying a payload
 * FILTERED to least privilege through a W041 projection-policy typed
 * reference. An unfiltered send is the typed
 * `least-privilege-violation-rejected`.
 *
 * THE LEAST-PRIVIPLE DISCIPLINE (the W041 minimum-necessary selection,
 * mirrored):
 *
 * - `LeastPrivilegeProjection` is the TYPED REFERENCE the bridge
 *   consumes: the digest of the sealed W041 projection-policy revision
 *   plus the recipient's minimum-necessary field allowlist (the W041
 *   path-template grammar: dot-separated keys, `[]` matches any array
 *   index). The bridge never imports @epoch/access-projection at
 *   runtime — the reference is structural (compile-time assignability +
 *   runtime parity tests prove the REAL W041 `PolicyBinding.fieldAllowlist`
 *   feeds this surface directly).
 * - `filterOutboundPayload` walks the opaque outbound payload into leaf
 *   paths and splits it into RELEASED fields (passed through BY
 *   REFERENCE — same value, same digest) and typed RedactionMarkers
 *   (never a silent drop).
 * - `verifyLeastPrivilege` is the dispatch-time defense-in-depth gate
 *   (the W041 field-leak gate precedent): every released path of a
 *   dispatched request must be inside the projection's allowlist, and
 *   the request's cited policy digest must equal the projection's.
 *
 * Every request carries correlation + causation ids and an idempotency
 * key; the occurrence instants are CALLER-SUPPLIED (zero wall-clock).
 */
import { z } from 'zod';
import { canonicalDigest, JsonValueSchema, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  CausationIdSchema,
  CorrelationIdSchema,
  FieldTemplateSchema,
  IdempotencyKeySchema,
  OutboundRequestIdSchema,
  RecipientRefSchema,
  BridgePrincipalIdSchema,
  BridgeTimestampSchema,
  Sha256HexSchema,
} from './primitives';
import {
  EXTERNAL_EVENT_BRIDGE_RECORD_VERSION,
  OUTBOUND_REQUEST_CLASSES,
  OUTBOUND_REQUEST_SCHEMA_NAME,
} from './version';
import { classifiedParseError } from './issues';
import type { BridgeResult } from './errors';

// --------------------------------------------------------------------------------
// The redaction vocabulary (the W041 mirror).
// --------------------------------------------------------------------------------

/**
 * The redaction classes of struck outbound fields (the W041 vocabulary
 * mirrored member-for-member — runtime-parity-pinned in
 * test/parity.test.ts).
 */
export const BRIDGE_REDACTION_CLASSES = [
  'commercial-sensitive',
  'supplier-sensitive',
  'evidence-scoped',
  'principal-identifying',
  'policy-scoped',
  'task-scoped',
] as const;

/** One bridge redaction class. */
export type BridgeRedactionClass = (typeof BRIDGE_REDACTION_CLASSES)[number];

/** The default redaction class of outbound fields struck by the allowlist. */
export const DEFAULT_OUTBOUND_REDACTION_CLASS: BridgeRedactionClass = 'policy-scoped';

// --------------------------------------------------------------------------------
// The least-privilege projection reference (the W041 typed reference).
// --------------------------------------------------------------------------------

/**
 * The least-privilege projection reference the bridge consumes: the
 * digest of the sealed W041 projection-policy revision the recipient's
 * allowlist was derived from, the recipient reference, and the sorted
 * duplicate-free minimum-necessary field allowlist (the W041
 * path-template grammar).
 */
export const LeastPrivilegeProjectionSchema = z
  .strictObject({
    policyDigest: Sha256HexSchema,
    recipientRef: RecipientRefSchema,
    fieldAllowlist: z.array(FieldTemplateSchema).min(1).max(1024).readonly(),
  })
  .readonly()
  .superRefine((projection, ctx) => {
    for (let i = 1; i < projection.fieldAllowlist.length; i += 1) {
      if (projection.fieldAllowlist[i]! < projection.fieldAllowlist[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'fieldAllowlist must be sorted ascending (deterministic serialization)',
          path: ['fieldAllowlist'],
        });
        break;
      }
      if (projection.fieldAllowlist[i]! === projection.fieldAllowlist[i - 1]!) {
        ctx.addIssue({
          code: 'custom',
          message: 'fieldAllowlist must be duplicate-free',
          path: ['fieldAllowlist'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'LeastPrivilegeProjection',
    title: 'LeastPrivilegeProjection',
    description:
      'The least-privilege projection reference: the sealed W041 projection-policy digest, the recipient reference, and the sorted minimum-necessary field allowlist (the W041 path-template grammar).',
  });

/** One least-privilege projection reference. */
export type LeastPrivilegeProjection = z.infer<typeof LeastPrivilegeProjectionSchema>;

// --------------------------------------------------------------------------------
// The payload walk + template matching (the W041 grammar mirror).
// --------------------------------------------------------------------------------

/** One walked leaf: a concrete field path and its value (by reference). */
export interface OutboundLeafEntry {
  readonly path: string;
  readonly value: JsonValue;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Walk an opaque outbound payload into leaf entries. Path grammar: the
 * W041 grammar — dot-separated object keys, `[<index>]` for array
 * positions (`items[0].label`). Object keys walk in sorted order
 * (deterministic — no insertion-order leaks).
 */
export function walkOutboundLeaves(
  payload: Readonly<Record<string, JsonValue>>,
): readonly OutboundLeafEntry[] {
  const entries: OutboundLeafEntry[] = [];
  const walk = (value: unknown, prefix: string): void => {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        walk(value[i], `${prefix}[${i}]`);
      }
      return;
    }
    if (isPlainObject(value)) {
      for (const key of Object.keys(value).sort()) {
        walk(value[key], prefix === '' ? key : `${prefix}.${key}`);
      }
      return;
    }
    if (prefix !== '') entries.push({ path: prefix, value: value as JsonValue });
  };
  walk(payload, '');
  return entries;
}

/** Escape one literal for use inside a RegExp. */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** One template segment as a regex source: `items[]` -> `items\[\d+\]`. */
function templateSegmentSource(segment: string): string {
  if (segment === '[]') return '\\[\\d+\\]';
  if (segment.endsWith('[]')) return `${escapeRegExp(segment.slice(0, -2))}\\[\\d+\\]`;
  return escapeRegExp(segment);
}

/** The regex source of a whole template (dot-separated segments). */
function templateSource(template: string): string {
  return template
    .split('.')
    .map((segment) => templateSegmentSource(segment))
    .join('\\.');
}

/** Compile one field-path template into a matcher over concrete leaf paths. */
export function templateMatcher(template: string): (path: string) => boolean {
  const pattern = new RegExp(`^${templateSource(template)}$`);
  return (path: string): boolean => pattern.test(path);
}

// --------------------------------------------------------------------------------
// The filtered outbound payload (released by reference + redaction markers).
// --------------------------------------------------------------------------------

/** One released outbound field (BY REFERENCE — same value, same digest). */
export const ReleasedFieldSchema = z
  .strictObject({
    path: z.string().min(1).max(512),
    value: JsonValueSchema,
  })
  .readonly()
  .meta({
    id: 'ReleasedField',
    title: 'ReleasedField',
    description: 'One released outbound field: the concrete leaf path plus its value carried by reference.',
  });

/** One released outbound field. */
export type ReleasedField = z.infer<typeof ReleasedFieldSchema>;

/** One typed redaction marker of a struck outbound field (never a silent drop). */
export const OutboundRedactionMarkerSchema = z
  .strictObject({
    path: z.string().min(1).max(512),
    redactionClass: z.enum(BRIDGE_REDACTION_CLASSES),
  })
  .readonly()
  .meta({
    id: 'OutboundRedactionMarker',
    title: 'OutboundRedactionMarker',
    description:
      'One typed redaction marker: the struck field path plus the redaction class (a struck outbound field is never silently dropped).',
  });

/** One outbound redaction marker. */
export type OutboundRedactionMarker = z.infer<typeof OutboundRedactionMarkerSchema>;

/**
 * The FILTERED outbound payload: the minimum-necessary released fields
 * (sorted by path) plus the typed redaction markers of every struck
 * field (sorted by path).
 */
export const FilteredOutboundPayloadSchema = z
  .strictObject({
    released: z.array(ReleasedFieldSchema).max(4096).readonly(),
    redacted: z.array(OutboundRedactionMarkerSchema).max(4096).readonly(),
  })
  .readonly()
  .superRefine((filtered, ctx) => {
    for (let i = 1; i < filtered.released.length; i += 1) {
      if (filtered.released[i]!.path <= filtered.released[i - 1]!.path) {
        ctx.addIssue({
          code: 'custom',
          message: 'released fields must be sorted ascending and duplicate-free by path',
          path: ['released'],
        });
        break;
      }
    }
    for (let i = 1; i < filtered.redacted.length; i += 1) {
      if (filtered.redacted[i]!.path <= filtered.redacted[i - 1]!.path) {
        ctx.addIssue({
          code: 'custom',
          message: 'redaction markers must be sorted ascending and duplicate-free by path',
          path: ['redacted'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'FilteredOutboundPayload',
    title: 'FilteredOutboundPayload',
    description:
      'The filtered outbound payload: the minimum-necessary released fields (by reference) plus typed redaction markers of every struck field (the W041 minimum-necessary selection mirrored).',
  });

/** One filtered outbound payload. */
export type FilteredOutboundPayload = z.infer<typeof FilteredOutboundPayloadSchema>;

/**
 * Filter one opaque outbound payload to the recipient's
 * minimum-necessary subset: every walked leaf either passes through BY
 * REFERENCE (released) or becomes a typed RedactionMarker (struck by
 * the allowlist; default class `policy-scoped`). Deterministic and
 * total; identical inputs produce byte-identical results.
 */
export function filterOutboundPayload(
  payload: Readonly<Record<string, JsonValue>>,
  projection: LeastPrivilegeProjection,
): FilteredOutboundPayload {
  const matchers = projection.fieldAllowlist.map(templateMatcher);
  const released: ReleasedField[] = [];
  const redacted: OutboundRedactionMarker[] = [];
  for (const leaf of walkOutboundLeaves(payload)) {
    if (matchers.some((match) => match(leaf.path))) {
      released.push({ path: leaf.path, value: leaf.value });
    } else {
      redacted.push({ path: leaf.path, redactionClass: DEFAULT_OUTBOUND_REDACTION_CLASS });
    }
  }
  released.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  redacted.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { released, redacted };
}

/**
 * The dispatch-time least-privilege gate (defense in depth — the W041
 * field-leak gate precedent): every RELEASED path of a dispatched
 * request must be inside the projection's allowlist. A request whose
 * payload releases a field the recipient may not see is the typed
 * `least-privilege-violation-rejected` (an unfiltered send).
 */
export function verifyLeastPrivilege(
  filtered: FilteredOutboundPayload,
  projection: LeastPrivilegeProjection,
): BridgeResult<undefined> {
  const matchers = projection.fieldAllowlist.map(templateMatcher);
  const violations = filtered.released
    .map((field) => field.path)
    .filter((path) => !matchers.some((match) => match(path)));
  if (violations.length > 0) {
    return {
      ok: false,
      error: {
        code: 'least-privilege-violation-rejected',
        message: `the outbound payload releases ${violations.length} field(s) outside the recipient's minimum-necessary allowlist — an unfiltered send is rejected (the projection-policy reference decides what a recipient may see)`,
        reason: 'field-outside-allowlist',
        violatingPaths: violations,
      },
    };
  }
  return { ok: true, value: undefined };
}

// --------------------------------------------------------------------------------
// The outbound request record.
// --------------------------------------------------------------------------------

/** The zod field map of the outbound-request content (shared with the sealed record). */
const OUTBOUND_REQUEST_FIELDS = {
  schema: z.literal(OUTBOUND_REQUEST_SCHEMA_NAME),
  schemaVersion: z.literal(EXTERNAL_EVENT_BRIDGE_RECORD_VERSION),
  requestId: OutboundRequestIdSchema,
  tenantId: TenantIdSchema,
  requestClass: z.enum(OUTBOUND_REQUEST_CLASSES),
  recipientRef: RecipientRefSchema,
  correlationId: CorrelationIdSchema,
  causationId: CausationIdSchema.nullable(),
  payload: FilteredOutboundPayloadSchema,
  projectionDigest: Sha256HexSchema,
  createdAt: BridgeTimestampSchema,
  createdBy: BridgePrincipalIdSchema,
  idempotencyKey: IdempotencyKeySchema,
} as const;

/** The immutable content of one outbound request. */
export const OutboundRequestContentSchema = z
  .strictObject({ ...OUTBOUND_REQUEST_FIELDS })
  .readonly()
  .meta({
    id: 'OutboundRequestContent',
    title: 'OutboundRequestContent',
    description:
      'The immutable content of one outbound request: kind-prefixed request id, tenant scope, one of the four request classes, the recipient reference, correlation and causation ids, the least-privilege filtered payload, the cited projection-policy digest, the caller-supplied creation instant, and the idempotency key.',
  });

/** One outbound request content. */
export type OutboundRequestContent = z.infer<typeof OutboundRequestContentSchema>;

/** The SEALED outbound request: content plus its canonical digest. */
export const SealedOutboundRequestSchema = z
  .strictObject({ ...OUTBOUND_REQUEST_FIELDS, contentDigest: Sha256HexSchema })
  .readonly()
  .meta({
    id: 'SealedOutboundRequest',
    title: 'SealedOutboundRequest',
    description:
      'Published outbound request record: immutable content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed outbound request. */
export type SealedOutboundRequest = z.infer<typeof SealedOutboundRequestSchema>;

/** Compute the content digest of an outbound request. */
export function computeOutboundRequestDigest(content: OutboundRequestContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid outbound-request content into its published record. */
export function sealOutboundRequest(content: unknown): BridgeResult<SealedOutboundRequest> {
  const parsed = OutboundRequestContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: classifiedParseError(parsed.error) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: computeOutboundRequestDigest(parsed.data) },
  };
}

/** Verify a sealed outbound request: schema + recomputed digest. */
export function verifySealedOutboundRequest(sealed: unknown): BridgeResult<SealedOutboundRequest> {
  const parsed = SealedOutboundRequestSchema.safeParse(sealed);
  if (!parsed.success) {
    return { ok: false, error: classifiedParseError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const recomputed = computeOutboundRequestDigest(content);
  if (recomputed !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `outbound request "${parsed.data.requestId}" failed digest verification (tampered or mismatched record)`,
        expected: recomputed,
        encountered: parsed.data.contentDigest,
        subject: parsed.data.requestId,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Build one outbound request from a raw payload + projection: filter the
 * payload to the recipient's minimum-necessary subset and seal the
 * request citing the projection-policy digest. The construction path
 * and the verification path share the same allowlist semantics, so a
 * request built here always passes {@link verifyLeastPrivilege} under
 * the SAME projection.
 */
export function buildOutboundRequest(
  input: Omit<OutboundRequestContent, 'schema' | 'schemaVersion' | 'payload' | 'projectionDigest'> & {
    readonly rawPayload: Readonly<Record<string, JsonValue>>;
  },
  projection: LeastPrivilegeProjection,
): BridgeResult<SealedOutboundRequest> {
  const filtered = filterOutboundPayload(input.rawPayload, projection);
  const { rawPayload, ...rest } = input;
  void rawPayload;
  const content: OutboundRequestContent = {
    ...rest,
    schema: OUTBOUND_REQUEST_SCHEMA_NAME,
    schemaVersion: EXTERNAL_EVENT_BRIDGE_RECORD_VERSION,
    payload: filtered,
    projectionDigest: projection.policyDigest,
  };
  return sealOutboundRequest(content);
}
