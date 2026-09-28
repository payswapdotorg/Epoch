/**
 * Provider-neutral zod primitives of the performance kernel.
 *
 * Composition policy (the frozen W034 dependency policy: runtime deps
 * are @epoch/agent-protocol, @epoch/tenancy and zod ONLY): digest
 * machinery and the JSON value space are REUSED from
 * @epoch/agent-protocol (canonical SHA-256 over canonical JSON — never
 * node:crypto); tenant ids are REUSED from @epoch/tenancy. The
 * provenance-state grammar is a structural MIRROR of the W036
 * uncertainty provenance, pinned by tests (no runtime edge).
 */
import { z } from 'zod';
import { canonicalDigest, canonicalJsonStringify, type JsonValue } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  BUDGET_ID_PATTERN,
  COUNTS_ID_PATTERN,
  LADDER_ID_PATTERN,
  MODEL_ID_PATTERN,
  PERFORMANCE_CONTRACT_VERSION,
  PROVENANCE_KINDS,
  SUBJECT_PATTERN,
  VERDICT_ID_PATTERN,
  WORKLOAD_ID_PATTERN,
} from './version';

// --------------------------------------------------------------------------------
// Neutral primitives.
// --------------------------------------------------------------------------------

/** Lowercase hexadecimal SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** SHA-256 content digest as lowercase hex (the exact-revision address form). */
export const Sha256HexSchema = z
  .string()
  .regex(SHA256_HEX_PATTERN, 'must be a lowercase hex SHA-256 digest (64 characters)')
  .meta({
    id: 'Sha256Hex',
    title: 'Sha256Hex',
    description: 'Lowercase hexadecimal SHA-256 digest (exactly 64 characters).',
  });
export type Sha256Hex = z.infer<typeof Sha256HexSchema>;

/** A non-negative integer (counts and sizes — never floats, never time). */
export const NonNegativeIntSchema = z
  .number()
  .int()
  .min(0)
  .meta({
    id: 'NonNegativeInt',
    title: 'NonNegativeInt',
    description:
      'A non-negative integer: the only magnitude type in the performance kernel (counts and sizes, never time).',
  });
export type NonNegativeInt = z.infer<typeof NonNegativeIntSchema>;

/** A positive integer (denominators, ladder rungs). */
export const PositiveIntSchema = z
  .number()
  .int()
  .min(1)
  .meta({ id: 'PositiveInt', title: 'PositiveInt', description: 'A positive integer.' });
export type PositiveInt = z.infer<typeof PositiveIntSchema>;

/** Tenant identity (the W009 tenancy grammar, composed at runtime). */
export { TenantIdSchema };
export type { TenantId } from '@epoch/tenancy';

// --------------------------------------------------------------------------------
// Record identities.
// --------------------------------------------------------------------------------

export const WorkloadIdSchema = z
  .string()
  .regex(WORKLOAD_ID_PATTERN, 'must be a workload id of the form "workload:<slug>"')
  .meta({
    id: 'WorkloadId',
    title: 'WorkloadId',
    description: 'Workload identity: "workload:" followed by a lowercase slug.',
  });
export type WorkloadId = z.infer<typeof WorkloadIdSchema>;

export const BudgetIdSchema = z
  .string()
  .regex(BUDGET_ID_PATTERN, 'must be a budget id of the form "budget:<slug>"')
  .meta({
    id: 'BudgetId',
    title: 'BudgetId',
    description: 'Budget-record identity: "budget:" followed by a lowercase slug.',
  });
export type BudgetId = z.infer<typeof BudgetIdSchema>;

export const VerdictIdSchema = z
  .string()
  .regex(VERDICT_ID_PATTERN, 'must be a verdict id of the form "verdict:<slug>"')
  .meta({
    id: 'VerdictId',
    title: 'VerdictId',
    description: 'Budget-verdict identity: "verdict:" followed by a lowercase slug.',
  });
export type VerdictId = z.infer<typeof VerdictIdSchema>;

export const CountsIdSchema = z
  .string()
  .regex(COUNTS_ID_PATTERN, 'must be a counts id of the form "counts:<slug>"')
  .meta({
    id: 'CountsId',
    title: 'CountsId',
    description: 'Measured-counts identity: "counts:" followed by a lowercase slug.',
  });
export type CountsId = z.infer<typeof CountsIdSchema>;

export const ComplexityModelIdSchema = z
  .string()
  .regex(MODEL_ID_PATTERN, 'must be a complexity-model id of the form "complexity-model:<slug>"')
  .meta({
    id: 'ComplexityModelId',
    title: 'ComplexityModelId',
    description: 'Complexity-model identity: "complexity-model:" followed by a lowercase slug.',
  });
export type ComplexityModelId = z.infer<typeof ComplexityModelIdSchema>;

export const LadderIdSchema = z
  .string()
  .regex(LADDER_ID_PATTERN, 'must be a ladder id of the form "ladder:<slug>"')
  .meta({
    id: 'LadderId',
    title: 'LadderId',
    description: 'Scale-ladder identity: "ladder:" followed by a lowercase slug.',
  });
export type LadderId = z.infer<typeof LadderIdSchema>;

/** The measurement-subject label (names one measured flow). */
export const SubjectSchema = z
  .string()
  .regex(SUBJECT_PATTERN, 'must be a lowercase subject slug')
  .meta({
    id: 'Subject',
    title: 'Subject',
    description: 'The measurement subject: a slug naming one measured composition flow.',
  });
export type Subject = z.infer<typeof SubjectSchema>;

// --------------------------------------------------------------------------------
// Provenance (the W006-convention state, mirrored).
// --------------------------------------------------------------------------------

/** The provenance state every performance content record carries (W006 convention, mirrored). */
export const ProvenanceStateSchema = z
  .strictObject({
    kind: z.enum(PROVENANCE_KINDS),
    sourceRef: z.string().min(1).max(128).optional(),
    actor: z.string().min(1).max(128).optional(),
  })
  .readonly()
  .meta({
    id: 'ProvenanceState',
    title: 'ProvenanceState',
    description:
      'The provenance of one performance record: observed/reported/derived/assumed/imported/unknown plus optional sourceRef and actor (the W036 uncertainty-provenance grammar, mirrored).',
  });
export type ProvenanceState = z.infer<typeof ProvenanceStateSchema>;

// --------------------------------------------------------------------------------
// The shared sealed-record helpers (each family applies them explicitly).
// --------------------------------------------------------------------------------

/**
 * The canonical record header shared by every performance content
 * record: `schema`, `schemaVersion`, `tenantId` — plus, on the SEALED
 * form, a `contentDigest`.
 */
export const RECORD_HEADER = {
  schema: z.string().min(1),
  schemaVersion: z.literal(PERFORMANCE_CONTRACT_VERSION),
  tenantId: TenantIdSchema,
} as const;

/** Canonical digest over arbitrary JSON content (the content-addressing basis). */
export function digestOfJson(value: unknown): Sha256Hex {
  return canonicalDigest(value as JsonValue);
}

/**
 * The digest-stable content projection of a sealed record: the exact
 * value the digest is taken over (the record WITHOUT its
 * `contentDigest` field).
 */
export function sealedContentOf(sealed: { contentDigest: string } & Record<string, unknown>): JsonValue {
  const content: Record<string, unknown> = { ...sealed };
  delete content.contentDigest;
  return content as unknown as JsonValue;
}

/** Canonical JSON serialization of a sealed record's content (byte-identical round trips). */
export function serializeSealed(sealed: { contentDigest: string } & Record<string, unknown>): string {
  return canonicalJsonStringify(sealedContentOf(sealed));
}
