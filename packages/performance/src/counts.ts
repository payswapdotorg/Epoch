/**
 * Typed OPERATION COUNTERS (the W034 measurement discipline).
 *
 * The counting hub is a closure over an integer tally per operation
 * class: test-tree compositions wrap the measurement subjects' PUBLIC
 * kernel APIs with hub tallies (never kernel edits) and snapshot the
 * result into a sealed, content-addressed MEASURED-COUNTS record bound
 * to one workload + one subject. Counts are deterministic by
 * construction — no clock, no randomness — so identical workloads yield
 * byte-identical counts.
 *
 * Counting conventions (see docs/performance/counter-methodology.md):
 * - `kernel-admission`   +1 per state-extending kernel API invocation;
 * - `kernel-fold`        +N per fold invocation, N = records iterated;
 * - `projection-compute` +N per projection invocation, N = view rows emitted;
 * - `digest-compute`     +1 per digest-bearing kernel API invocation;
 * - `harness-scenario`   +1 per harness driver-seam invocation.
 */
import { z } from 'zod';
import { type JsonValue } from '@epoch/agent-protocol';
import {
  CountsIdSchema,
  NonNegativeIntSchema,
  ProvenanceStateSchema,
  SubjectSchema,
  WorkloadIdSchema,
  digestOfJson,
  sealedContentOf,
  serializeSealed,
  Sha256HexSchema,
  TenantIdSchema,
} from './primitives';
import { validationError, type PerformanceError, type PerformanceResult } from './errors';
import { OPERATION_CLASSES, PERFORMANCE_CONTRACT_VERSION } from './version';

// --------------------------------------------------------------------------------
// Operation counts (the tally space).
// --------------------------------------------------------------------------------

/** The per-class operation-count map (zero-filled for every class). */
const operationCountsShape = z.strictObject({
  'kernel-admission': NonNegativeIntSchema,
  'kernel-fold': NonNegativeIntSchema,
  'projection-compute': NonNegativeIntSchema,
  'digest-compute': NonNegativeIntSchema,
  'harness-scenario': NonNegativeIntSchema,
});
export const OperationCountsSchema = operationCountsShape
  .readonly()
  .meta({
    id: 'OperationCounts',
    title: 'OperationCounts',
    description: `The per-class operation-count map over the closed vocabulary ${OPERATION_CLASSES.join(', ')} (counts, never time).`,
  });
export type OperationCounts = { readonly [K in (typeof OPERATION_CLASSES)[number]]: number };

/** The zero-filled count map. */
export function emptyCounts(): OperationCounts {
  return Object.fromEntries(OPERATION_CLASSES.map((c) => [c, 0])) as OperationCounts;
}

/** Deterministically fold two count maps (component-wise sum; input order never leaks). */
export function sumCounts(a: OperationCounts, b: OperationCounts): OperationCounts {
  const out: Record<string, number> = {};
  for (const c of OPERATION_CLASSES) {
    out[c] = a[c] + b[c];
  }
  return out as unknown as OperationCounts;
}

/** The canonical JSON projection of a count map (digest basis). */
export function countsJson(counts: OperationCounts): JsonValue {
  return OperationCountsSchema.parse(counts) as unknown as JsonValue;
}

/** The canonical digest of a count map (deterministic counts -> deterministic digest). */
export function countsDigestOf(counts: OperationCounts): string {
  return digestOfJson(countsJson(counts));
}

// --------------------------------------------------------------------------------
// The counting hub (the seam-level instrument).
// --------------------------------------------------------------------------------

/** The counting hub: tallies operation units per class; snapshots are typed data. */
export interface CounterHub {
  /** Record `units` operations of one class (units >= 1). */
  readonly tally: (operationClass: (typeof OPERATION_CLASSES)[number], units?: number) => void;
  /** The frozen per-class snapshot (immutable). */
  readonly snapshot: () => OperationCounts;
  /** The canonical digest of the current snapshot. */
  readonly snapshotDigest: () => string;
}

/** Create a fresh counting hub (all classes at zero). */
export function createCounterHub(): CounterHub {
  const tallies: Record<string, number> = Object.fromEntries(OPERATION_CLASSES.map((c) => [c, 0]));
  return {
    tally(operationClass, units = 1) {
      if (!Number.isInteger(units) || units < 1) {
        throw new RangeError(`counter hub tally units must be a positive integer (got ${units})`);
      }
      tallies[operationClass] = (tallies[operationClass] ?? 0) + units;
    },
    snapshot() {
      return Object.freeze({ ...tallies }) as OperationCounts;
    },
    snapshotDigest() {
      return countsDigestOf(Object.freeze({ ...tallies }) as OperationCounts);
    },
  };
}

// --------------------------------------------------------------------------------
// The sealed MEASURED-COUNTS record.
// --------------------------------------------------------------------------------

/** The content of one measured-counts record: what was measured, where, and the exact counts. */
const measuredCountsShape = z.strictObject({
  schema: z.string().min(1),
  schemaVersion: z.literal(PERFORMANCE_CONTRACT_VERSION),
  tenantId: TenantIdSchema,
  countsId: CountsIdSchema,
  /** The measurement subject (the flow the counts were taken over). */
  subject: SubjectSchema,
  /** The workload these counts were measured against (exact revision). */
  workloadId: WorkloadIdSchema,
  workloadDigest: Sha256HexSchema,
  /** The per-class measured operation counts. */
  counts: OperationCountsSchema,
  /** The actor that took the measurement (the composition seam). */
  measuredBy: z.string().min(1).max(128),
  provenance: ProvenanceStateSchema,
});
export const MeasuredCountsContentSchema = measuredCountsShape
  .readonly()
  .meta({
    id: 'MeasuredCountsContent',
    title: 'MeasuredCountsContent',
    description:
      'The content of one measured-counts record: the subject, the exact workload revision, the per-class operation counts, and the measurement provenance.',
  });
export type MeasuredCountsContent = z.infer<typeof MeasuredCountsContentSchema>;

/** A sealed measured-counts record (content + canonical contentDigest). */
export const SealedMeasuredCountsSchema = z
  .strictObject({
    ...measuredCountsShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedMeasuredCounts',
    title: 'SealedMeasuredCounts',
    description: 'The sealed measured-counts record: content plus its SHA-256 content digest (exact-revision addressing).',
  });
export type SealedMeasuredCounts = z.infer<typeof SealedMeasuredCountsSchema>;

/** Compute the canonical digest of measured-counts content. */
export function computeMeasuredCountsDigest(content: MeasuredCountsContent): string {
  return digestOfJson(content);
}

/** Seal valid measured-counts content into its published record. */
export function sealMeasuredCounts(content: unknown): PerformanceResult<SealedMeasuredCounts> {
  const parsed = MeasuredCountsContentSchema.safeParse(content);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError('the measured-counts content does not conform to the performance record schema', parsed.error),
    };
  }
  return { ok: true, value: { ...parsed.data, contentDigest: digestOfJson(parsed.data) } };
}

/** Verify a sealed measured-counts record (schema + digest recomputation). */
export function verifySealedMeasuredCounts(sealed: unknown): PerformanceResult<SealedMeasuredCounts> {
  const parsed = SealedMeasuredCountsSchema.safeParse(sealed);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError('the sealed measured-counts record does not conform to the performance record schema', parsed.error),
    };
  }
  const expected = digestOfJson(sealedContentOf(parsed.data as unknown as { contentDigest: string } & Record<string, unknown>));
  if (expected !== parsed.data.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'sealed measured-counts record digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: parsed.data.contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

export interface DeserializedCounts {
  readonly record: SealedMeasuredCounts;
  readonly claimedDigest: string;
  readonly digestVerifies: boolean;
}

/** Deserialize + digest-verify a serialized measured-counts record. */
export function deserializeMeasuredCounts(text: string, claimedDigest: string):
  | { ok: true; value: DeserializedCounts }
  | { ok: false; error: PerformanceError } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: { code: 'serialization-invalid', message: `invalid measured-counts JSON: ${(err as Error).message}` } };
  }
  const sealed = sealMeasuredCounts(raw);
  if (!sealed.ok) {
    return sealed;
  }
  const recomputed = digestOfJson(sealedContentOf(sealed.value as unknown as { contentDigest: string } & Record<string, unknown>));
  return { ok: true, value: { record: sealed.value, claimedDigest, digestVerifies: recomputed === claimedDigest } };
}

/** Canonical JSON serialization (byte-identical for equal records). */
export function serializeMeasuredCounts(sealed: SealedMeasuredCounts): string {
  return serializeSealed(sealed as unknown as { contentDigest: string } & Record<string, unknown>);
}
