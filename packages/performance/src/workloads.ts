/**
 * Deterministic WORKLOAD GENERATORS (the W034 scale discipline).
 *
 * A workload is a pure function of its SEED: (identity + tenant + shape
 * + salt) -> a typed synthetic workload at size (N plan lines, M
 * observations, P pack projections, S scenario steps). This is the
 * W031/W032 fixture pattern generalized to scale: every value derives
 * from INDEX ARITHMETIC over a fixed alphabet and a fixed instant
 * series — zero clock reads, zero randomness, zero network — so the
 * same seed always yields the same workload DIGEST (byte-identical
 * records). The test trees MATERIALIZE these synthetic payloads into
 * real kernel inputs through the kernels' own public admission paths
 * (never generator-side kernel knowledge).
 *
 * Workload records are tenant-scoped (R12): the workload ledger admits
 * same-tenant workloads only (`cross-tenant-denied` otherwise) and
 * rejects identity/content conflicts (`version-conflict`).
 */
import { z } from 'zod';
import {
  NonNegativeIntSchema,
  PositiveIntSchema,
  ProvenanceStateSchema,
  Sha256HexSchema,
  TenantIdSchema,
  WorkloadIdSchema,
  digestOfJson,
  sealedContentOf,
  serializeSealed,
} from './primitives';
import { validationError, type PerformanceError, type PerformanceResult } from './errors';
import { INPUT_UNITS, PACK_PROJECTION_SURFACES, PERFORMANCE_CONTRACT_VERSION, SCENARIO_STEP_OPS } from './version';

// --------------------------------------------------------------------------------
// The workload shape + seed.
// --------------------------------------------------------------------------------

/**
 * The workload shape: the four scale dimensions (the W034 grammar).
 * Every dimension is >= 1 (a degenerate zero-dimension workload is not
 * a workload — it is an empty fixture; the W031/W032 fixtures cover that
 * case).
 */
export const WorkloadShapeSchema = z
  .strictObject({
    /** N — plan lines of the synthetic solution. */
    planLines: PositiveIntSchema,
    /** M — synthetic field observations. */
    observations: PositiveIntSchema,
    /** P — pack-projection requests (surfaces cycle). */
    packProjections: PositiveIntSchema,
    /** S — harness scenario steps. */
    scenarioSteps: PositiveIntSchema,
  })
  .readonly()
  .meta({
    id: 'WorkloadShape',
    title: 'WorkloadShape',
    description: 'The workload scale dimensions: N plan lines, M observations, P pack projections, S scenario steps.',
  });
export type WorkloadShape = z.infer<typeof WorkloadShapeSchema>;

/** The workload sizes view (shape projected onto the closed input-unit vocabulary). */
export const WorkloadSizesSchema = z
  .strictObject({
    planLines: NonNegativeIntSchema,
    observations: NonNegativeIntSchema,
    packProjections: NonNegativeIntSchema,
    scenarioSteps: NonNegativeIntSchema,
  })
  .readonly()
  .meta({
    id: 'WorkloadSizes',
    title: 'WorkloadSizes',
    description: `The workload sizes over the closed input-unit vocabulary ${INPUT_UNITS.join(', ')} (the budget input-size source).`,
  });
export type WorkloadSizes = { readonly [K in (typeof INPUT_UNITS)[number]]: number };

/** The seed of one workload (pure input: identity + tenant + shape + salt). */
export const WorkloadSeedSchema = z
  .strictObject({
    workloadId: WorkloadIdSchema,
    tenantId: TenantIdSchema,
    shape: WorkloadShapeSchema,
    /** The determinism knob: different salt -> different workload digest. */
    salt: z.string().max(128).default(''),
  })
  .readonly()
  .meta({
    id: 'WorkloadSeed',
    title: 'WorkloadSeed',
    description: 'The pure seed of one workload: identity, tenant, shape, and salt (same seed -> same workload digest).',
  });
export type WorkloadSeed = z.infer<typeof WorkloadSeedSchema>;

// --------------------------------------------------------------------------------
// The synthetic payload grammar (deterministic index arithmetic).
// --------------------------------------------------------------------------------

const PAD = 6;
const pad = (index: number): string => String(index).padStart(PAD, '0');

/** The fixed instant-series base (hourly steps — the W031/W032 discipline, no clock). */
const INSTANT_BASE_MS = Date.parse('2026-07-01T08:00:00.000Z');
const INSTANT_STEP_MS = 3_600_000;

/** The deterministic instant at one index (fixed series, never the clock). */
export function instantAt(index: number): string {
  return new Date(INSTANT_BASE_MS + index * INSTANT_STEP_MS).toISOString();
}

/** The synthetic quantity value at one index (canonical integer decimal). */
export function quantityValueAt(index: number): string {
  return String(100 + (index * 7) % 977);
}

/** The synthetic unit at one index (cycling vocabulary). */
export function unitAt(index: number): string {
  return (['m3', 'tonne', 'deliverable'] as const)[index % 3];
}

/** The synthetic unit-cost amount at one index (exact 2-decimal string). */
export function unitCostAt(index: number): string {
  const cents = 2550 + (index % 75) * 100;
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

/** The synthetic acquisition variant at one index (cycling kernel vocabulary). */
export function acquisitionVariantAt(index: number): 'external-procurement' | 'cloud-service-provisioning' {
  return (['external-procurement', 'cloud-service-provisioning'] as const)[index % 2];
}

/** One synthetic plan line (deterministic in its index). */
export const PlanLinePayloadSchema = z
  .strictObject({
    lineId: z.string().min(1),
    title: z.string().min(1),
    quantity: z.strictObject({ value: z.string().min(1), unit: z.string().min(1) }).readonly(),
    unitCost: z.strictObject({ amount: z.string().min(1), currency: z.string().min(1) }).readonly(),
    worldEntityId: z.string().min(1),
    acquisitionVariant: z.enum(['external-procurement', 'cloud-service-provisioning']),
  })
  .readonly()
  .meta({ id: 'PlanLinePayload', title: 'PlanLinePayload', description: 'One synthetic solution plan line.' });
export type PlanLinePayload = z.infer<typeof PlanLinePayloadSchema>;

/** One synthetic observation (deterministic in its index; subject = a plan-line activity). */
export const ObservationPayloadSchema = z
  .strictObject({
    observationId: z.string().min(1),
    captureKey: z.string().min(1),
    measure: z.strictObject({ value: z.string().min(1), unit: z.string().min(1) }).readonly(),
    observedAt: z.string().min(1),
    observedBy: z.string().min(1),
    subjectActivityIndex: NonNegativeIntSchema,
  })
  .readonly()
  .meta({ id: 'ObservationPayload', title: 'ObservationPayload', description: 'One synthetic field observation.' });
export type ObservationPayload = z.infer<typeof ObservationPayloadSchema>;

/** One synthetic pack-projection request (surface cycles over the pack vocabulary). */
export const PackProjectionRequestSchema = z
  .strictObject({
    projectionIndex: NonNegativeIntSchema,
    surface: z.enum(PACK_PROJECTION_SURFACES),
  })
  .readonly()
  .meta({
    id: 'PackProjectionRequest',
    title: 'PackProjectionRequest',
    description: 'One synthetic pack-projection request: an index plus a projection surface.',
  });
export type PackProjectionRequest = z.infer<typeof PackProjectionRequestSchema>;

/** One synthetic harness scenario step (op cycles over the driver vocabulary). */
export const ScenarioStepPayloadSchema = z
  .strictObject({
    stepId: z.string().min(1),
    op: z.enum(SCENARIO_STEP_OPS),
    input: z.strictObject({ recordIndex: NonNegativeIntSchema, value: NonNegativeIntSchema }).readonly(),
  })
  .readonly()
  .meta({
    id: 'ScenarioStepPayload',
    title: 'ScenarioStepPayload',
    description: 'One synthetic harness scenario step: an id, a driver op, and a deterministic input.',
  });
export type ScenarioStepPayload = z.infer<typeof ScenarioStepPayloadSchema>;

// --------------------------------------------------------------------------------
// The sealed WORKLOAD record.
// --------------------------------------------------------------------------------

/** The content of one workload record: the seed echo, the sizes, and the full synthetic payload. */
const workloadContentShape = z.strictObject({
  schema: z.string().min(1),
  schemaVersion: z.literal(PERFORMANCE_CONTRACT_VERSION),
  tenantId: TenantIdSchema,
  workloadId: WorkloadIdSchema,
  /** The seed the generator consumed (identity + shape + salt). */
  seed: z.strictObject({ shape: WorkloadShapeSchema, salt: z.string().max(128) }).readonly(),
  /** The projected sizes over the closed input-unit vocabulary. */
  sizes: WorkloadSizesSchema,
  planLines: z.array(PlanLinePayloadSchema).min(1),
  observations: z.array(ObservationPayloadSchema).min(1),
  packProjections: z.array(PackProjectionRequestSchema).min(1),
  scenarioSteps: z.array(ScenarioStepPayloadSchema).min(1),
  provenance: ProvenanceStateSchema,
});
export const WorkloadContentSchema = workloadContentShape
  .readonly()
  .meta({
    id: 'WorkloadContent',
    title: 'WorkloadContent',
    description:
      'The content of one workload record: the seed echo, the sizes over the input-unit vocabulary, and the deterministic synthetic payload (N plan lines, M observations, P pack projections, S scenario steps).',
  });
export type WorkloadContent = z.infer<typeof WorkloadContentSchema>;

/** A sealed workload record (content + canonical contentDigest). */
export const SealedWorkloadSchema = z
  .strictObject({
    ...workloadContentShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedWorkload',
    title: 'SealedWorkload',
    description: 'The sealed workload record: content plus its SHA-256 content digest (exact-revision addressing).',
  });
export type SealedWorkloadRecord = z.infer<typeof SealedWorkloadSchema>;

/** Compute the canonical digest of workload content. */
export function computeWorkloadDigest(content: WorkloadContent): string {
  return digestOfJson(content);
}

/** The sizes view of a workload (the budget input-size source). */
export function workloadSizes(workload: SealedWorkloadRecord): WorkloadSizes {
  return workload.sizes;
}

/** The input size of a workload along one input unit. */
export function inputSizeOf(workload: SealedWorkloadRecord, unit: (typeof INPUT_UNITS)[number]): number {
  return workload.sizes[unit];
}

/** Generate + seal a deterministic synthetic workload from a seed (pure). */
export function generateWorkload(seed: unknown): PerformanceResult<SealedWorkloadRecord> {
  const parsedSeed = WorkloadSeedSchema.safeParse(seed);
  if (!parsedSeed.success) {
    return {
      ok: false,
      error: validationError('the workload seed does not conform to the workload grammar', parsedSeed.error),
    };
  }
  const { workloadId, tenantId, shape, salt } = parsedSeed.data;
  const content: WorkloadContent = {
    schema: 'epoch.performance.workload',
    schemaVersion: 1,
    workloadId,
    tenantId,
    seed: { shape, salt },
    sizes: {
      planLines: shape.planLines,
      observations: shape.observations,
      packProjections: shape.packProjections,
      scenarioSteps: shape.scenarioSteps,
    },
    planLines: Array.from({ length: shape.planLines }, (_, i) => ({
      lineId: `line:perf-${pad(i)}`,
      title: `Synthetic plan line ${pad(i)}`,
      quantity: { value: quantityValueAt(i), unit: unitAt(i) },
      unitCost: { amount: unitCostAt(i), currency: 'EUR' },
      worldEntityId: `element-perf-${i % 3}`,
      acquisitionVariant: acquisitionVariantAt(i),
    })),
    observations: Array.from({ length: shape.observations }, (_, i) => ({
      observationId: `observation:perf-${pad(i)}`,
      captureKey: `perf-capture-${pad(i)}`,
      measure: { value: String(50 + (i * 3) % 419), unit: 'm3' },
      observedAt: instantAt(i),
      observedBy: 'principal:field-engineer',
      subjectActivityIndex: i % shape.planLines,
    })),
    packProjections: Array.from({ length: shape.packProjections }, (_, i) => ({
      projectionIndex: i,
      surface: PACK_PROJECTION_SURFACES[i % PACK_PROJECTION_SURFACES.length]!,
    })),
    scenarioSteps: Array.from({ length: shape.scenarioSteps }, (_, i) => ({
      stepId: `step:perf-${pad(i)}`,
      op: SCENARIO_STEP_OPS[i % SCENARIO_STEP_OPS.length]!,
      input: { recordIndex: i, value: (i * 13 + 7) % 97 },
    })),
    provenance: {
      kind: 'derived',
      sourceRef: '@epoch/performance/generateWorkload',
      actor: 'principal:platform-engineer',
    },
  };
  return { ok: true, value: { ...content, contentDigest: digestOfJson(content) } };
}

/** Seal already-valid workload content (round-trip + digest verification path). */
export function sealWorkload(content: unknown): PerformanceResult<SealedWorkloadRecord> {
  const parsed = WorkloadContentSchema.safeParse(content);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError('the workload content does not conform to the performance record schema', parsed.error),
    };
  }
  return { ok: true, value: { ...parsed.data, contentDigest: digestOfJson(parsed.data) } };
}

/** Verify a sealed workload record (schema + digest recomputation; tamper detection). */
export function verifySealedWorkload(sealed: unknown): PerformanceResult<SealedWorkloadRecord> {
  const parsed = SealedWorkloadSchema.safeParse(sealed);
  if (!parsed.success) {
    return {
      ok: false,
      error: validationError('the sealed workload record does not conform to the performance record schema', parsed.error),
    };
  }
  const expected = digestOfJson(sealedContentOf(parsed.data as unknown as { contentDigest: string } & Record<string, unknown>));
  if (expected !== parsed.data.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'sealed workload record digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: parsed.data.contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

export interface DeserializedWorkload {
  readonly record: SealedWorkloadRecord;
  readonly claimedDigest: string;
  readonly digestVerifies: boolean;
}

/** Deserialize + digest-verify a serialized workload record (the round-trip gate). */
export function deserializeWorkload(text: string, claimedDigest: string):
  | { ok: true; value: DeserializedWorkload }
  | { ok: false; error: PerformanceError } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: { code: 'serialization-invalid', message: `invalid workload JSON: ${(err as Error).message}` } };
  }
  const sealed = sealWorkload(raw);
  if (!sealed.ok) {
    return sealed;
  }
  const recomputed = digestOfJson(sealedContentOf(sealed.value as unknown as { contentDigest: string } & Record<string, unknown>));
  return { ok: true, value: { record: sealed.value, claimedDigest, digestVerifies: recomputed === claimedDigest } };
}

/** Canonical JSON serialization (byte-identical for equal workloads). */
export function serializeWorkload(sealed: SealedWorkloadRecord): string {
  return serializeSealed(sealed as unknown as { contentDigest: string } & Record<string, unknown>);
}

// --------------------------------------------------------------------------------
// The workload ledger (tenant isolation + identity discipline).
// --------------------------------------------------------------------------------

/** The workload ledger: an append-only, tenant-scoped store of sealed workloads. */
export const WorkloadLedgerSchema = z
  .strictObject({
    tenantId: TenantIdSchema,
    workloads: z.array(SealedWorkloadSchema),
  })
  .readonly()
  .meta({
    id: 'WorkloadLedger',
    title: 'WorkloadLedger',
    description: 'The append-only, tenant-scoped workload ledger (admission: same tenant, idempotent, conflict-free).',
  });
export type WorkloadLedger = z.infer<typeof WorkloadLedgerSchema>;

/** Open an empty workload ledger for one tenant. */
export function openWorkloadLedger(tenantId: string): WorkloadLedger {
  const parsed = TenantIdSchema.safeParse(tenantId);
  if (!parsed.success) {
    throw new RangeError(`openWorkloadLedger: invalid tenant id "${tenantId}"`);
  }
  return { tenantId: parsed.data, workloads: [] };
}

/**
 * Admit a sealed workload into the ledger — the tenant-isolation gate
 * (`cross-tenant-denied`), idempotent re-admission (same identity +
 * same digest), and typed `version-conflict` on identity/content
 * divergence. Append-only: input ledgers are never mutated.
 */
export function admitWorkload(ledger: WorkloadLedger, sealed: unknown): PerformanceResult<WorkloadLedger> {
  const verified = verifySealedWorkload(sealed);
  if (!verified.ok) {
    return verified;
  }
  const workload = verified.value;
  if (workload.tenantId !== ledger.tenantId) {
    return {
      ok: false,
      error: {
        code: 'cross-tenant-denied',
        message: 'a workload of another tenant cannot be admitted into this workload ledger',
        expectedTenantId: ledger.tenantId,
        encounteredTenantId: workload.tenantId,
        subject: workload.workloadId,
      },
    };
  }
  const existing = ledger.workloads.find((candidate) => candidate.workloadId === workload.workloadId);
  if (existing !== undefined) {
    if (existing.contentDigest === workload.contentDigest) {
      return { ok: true, value: ledger };
    }
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: 'a different workload content already exists under this workload identity (workloads are immutable)',
        subject: 'workload',
        subjectId: workload.workloadId,
        publishedDigest: existing.contentDigest,
        encounteredDigest: workload.contentDigest,
      },
    };
  }
  return { ok: true, value: { ...ledger, workloads: [...ledger.workloads, workload] } };
}
