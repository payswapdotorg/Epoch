/**
 * The typed derivation-error taxonomy of the document adapter (W028
 * Tech Lead pin).
 *
 * Every derivation failure is a discriminated
 * {@link DocumentAdapterError} value (never a bare throw), so consumers
 * branch deterministically on `code`. The error precedence of the
 * derivation pipeline is fixed: unsupported-format -> digest-mismatch ->
 * malformed-document (document admission), then broken-evidence-chain /
 * cross-tenant-denied / policy-violation / trust-escalation-denied /
 * unknown-capability-reference during staged derivation.
 */
import { z } from 'zod';
import { DocumentAdapterIssueSchema, DocumentFormatSchema, TrustEscalationOpSchema } from './schema';
import type { TrustEscalationOp } from './version';
import type { DocumentAdapterError } from './types';

const Path = z.array(z.union([z.string(), z.number()])).readonly();

/** The typed, discriminated derivation error (see src/types.ts). */
export const DocumentAdapterErrorSchema = z
  .discriminatedUnion('code', [
    z.strictObject({
      code: z.literal('malformed-document'),
      message: z.string().min(1),
      issues: z.array(DocumentAdapterIssueSchema).min(1).readonly(),
    }).readonly(),
    z.strictObject({
      code: z.literal('unsupported-format'),
      message: z.string().min(1),
      format: z.string(),
      supportedFormats: z.array(DocumentFormatSchema).readonly(),
    }).readonly(),
    z.strictObject({
      code: z.literal('digest-mismatch'),
      message: z.string().min(1),
      path: Path,
      expected: z.string(),
      encountered: z.string(),
    }).readonly(),
    z.strictObject({
      code: z.literal('broken-evidence-chain'),
      message: z.string().min(1),
      path: Path,
      stage: z.enum(['uploaded', 'parsed', 'candidates-extracted', 'review-pending', 'provisional']).optional(),
      reason: z.enum([
        'missing-record',
        'invalid-record',
        'digest-mismatch',
        'unanchored-subject',
        'stage-mismatch',
        'kind-mismatch',
        'tenant-mismatch',
        'out-of-order',
        'incomplete-chain',
        'uncovered-candidate',
      ]),
    }).readonly(),
    z.strictObject({
      code: z.literal('cross-tenant-denied'),
      message: z.string().min(1),
      path: Path,
      expectedTenantId: z.string(),
      encounteredTenantId: z.string(),
    }).readonly(),
    z.strictObject({
      code: z.literal('policy-violation'),
      message: z.string().min(1),
      path: Path,
      rule: z.enum([
        'lifecycle-transition',
        'registration-category',
        'registration-origin',
        'registration-version',
        'manifest-shape',
      ]),
    }).readonly(),
    z.strictObject({
      code: z.literal('trust-escalation-denied'),
      message: z.string().min(1),
      path: Path,
      op: TrustEscalationOpSchema,
      currentTrustClass: z.string(),
      ceiling: z.string(),
    }).readonly(),
    z.strictObject({
      code: z.literal('unknown-capability-reference'),
      message: z.string().min(1),
      path: Path,
      capabilityId: z.string(),
      version: z.string().optional(),
    }).readonly(),
  ])
  .meta({
    id: 'urn:epoch:document-adapter:document-adapter-error',
    title: 'DocumentAdapterError',
    description: 'Typed, discriminated derivation error of the document adapter.',
  });

/** Runtime type check for a serialized error value. */
export function isDocumentAdapterError(value: unknown): value is DocumentAdapterError {
  return DocumentAdapterErrorSchema.safeParse(value).success;
}

// The trust-escalation rejection is constructed here so every caller
// returns the exact same typed floor.

/** Constructor inputs for the typed trust-escalation denial. */
export interface TrustEscalationDenialInput {
  readonly op: TrustEscalationOp;
  readonly path: readonly (string | number)[];
}

/**
 * The floor, not the gate (binding): every trust-escalation request
 * against a document-derived mapping is denied. This constructor is the
 * ONLY way the package answers escalation requests — it never consults
 * registry state, policy engines, or trust scores, and it always returns
 * `trust-escalation-denied` with the fixed provisional trust class.
 */
export function trustEscalationDenied(
  denial: TrustEscalationDenialInput,
): DocumentAdapterError {
  return {
    code: 'trust-escalation-denied',
    message:
      `trust-escalation request "${denial.op}" is denied for a document-derived mapping: ` +
      'document-derived mappings are provisional by construction and cannot certify, ' +
      'execute, or be granted host capabilities (extension-architecture trust tiers)',
    path: [...denial.path],
    op: denial.op,
    currentTrustClass: 't1',
    ceiling: 't1',
  };
}

/** Narrow a result value or rethrow unexpected errors (internal helper). */
export type DocumentAdapterResultOf<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: DocumentAdapterError };

export function ok<T>(value: T): DocumentAdapterResultOf<T> {
  return { ok: true, value };
}

export function fail<T>(error: DocumentAdapterError): DocumentAdapterResultOf<T> {
  return { ok: false, error };
}
