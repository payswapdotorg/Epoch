/**
 * The DeliveryRecord — the LIVE DELIVERY FACTS authority (USL1.0,
 * binding): observation intake, acceptance transitions, and actualization
 * into authoritative delivery state.
 *
 * - OBSERVATION IS EVIDENCE CAPTURE: observations are sealed, immutable
 *   distinction records (kind `observation`) appended to the delivery;
 *   the review state (proposed / accepted / rejected) lives on the
 *   DELIVERY RECORD as id sets — the observation records themselves never
 *   mutate.
 * - ACTUALIZATION CONVERTS ACCEPTED OBSERVATIONS ONLY: an actual (kind
 *   `actual`) derives from an observation that is in the accepted set;
 *   actualizing a proposed or rejected observation is a typed
 *   `unaccepted-actualization-rejected`. The actual inherits the
 *   observation's measure and uncertainty — it never restates them.
 * - Every state transition returns a NEW sealed DeliveryRecord (immutable
 *   updates + content addressing); `verifySealedDeliveryRecord` detects
 *   tampering (`digest-mismatch`).
 * - Tenant isolation (R12): cross-tenant operations are typed
 *   `cross-tenant-denied`.
 * - Determinism: observations, actuals, and the accepted/rejected id sets
 *   are canonically ordered (sorted by id); folds never depend on intake
 *   order.
 */
import { z } from 'zod';
import {
  canonicalDigest,
  TimestampSchema,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  DeliveryIdSchema,
  PrincipalIdSchema,
  SemverCoreSchema,
  Sha256HexSchema,
  SolutionIdSchema,
} from './primitives';
import {
  ActualRecordSchema,
  ObservationRecordSchema,
  type ObservationRecord,
} from './distinctions';
import {
  DELIVERY_RECORD_SCHEMA_NAME,
  SOLUTION_DELIVERY_RECORD_VERSION,
} from './version';
import { hasUnrecognizedKeys, vendorFieldsError, validationError } from './issues';
import { addNonNegativeDecimals } from './decimal';
import type { DeliveryResult } from './errors';

/** Delivery lifecycle status: an open delivery accepts facts; a closed one does not. */
export const DELIVERY_STATUSES = ['open', 'closed'] as const;

/** One delivery status. */
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** One flattened observation of the delivery (kind `observation` records only). */
const ObservationArraySchema = z.array(ObservationRecordSchema).max(4096);

/** One flattened actual of the delivery (kind `actual` records only). */
const ActualArraySchema = z.array(ActualRecordSchema).max(4096);

/**
 * The immutable content of one delivery record state (everything except
 * the content digest). Observations and actuals are sealed distinction
 * records (kind-checked in the refinement); the accepted/rejected id sets
 * are sorted and duplicate-free.
 */
export const DeliveryRecordContentSchema = z
  .strictObject({
    schema: z.literal(DELIVERY_RECORD_SCHEMA_NAME),
    schemaVersion: z.literal(SOLUTION_DELIVERY_RECORD_VERSION),
    deliveryId: DeliveryIdSchema,
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    solutionVersion: SemverCoreSchema,
    solutionVersionDigest: Sha256HexSchema,
    openedAt: TimestampSchema,
    openedBy: PrincipalIdSchema,
    status: z.enum(DELIVERY_STATUSES),
    closedAt: TimestampSchema.optional(),
    closedBy: PrincipalIdSchema.optional(),
    observations: ObservationArraySchema,
    acceptedObservationIds: z.array(z.string().regex(/^observation:[a-z0-9][a-z0-9-]{0,62}$/)).max(4096),
    rejectedObservationIds: z.array(z.string().regex(/^observation:[a-z0-9][a-z0-9-]{0,62}$/)).max(4096),
    actuals: ActualArraySchema,
  })
  .readonly()
  .superRefine((delivery, ctx) => {
    for (let i = 1; i < delivery.observations.length; i += 1) {
      if (delivery.observations[i]!.recordId < delivery.observations[i - 1]!.recordId) {
        ctx.addIssue({
          code: 'custom',
          message: 'observations must be sorted by recordId ascending (deterministic serialization; observedAt carries chronology)',
          path: ['observations'],
        });
        break;
      }
      if (delivery.observations[i]!.recordId === delivery.observations[i - 1]!.recordId) {
        ctx.addIssue({
          code: 'custom',
          message: 'observations must be duplicate-free by recordId',
          path: ['observations'],
        });
        break;
      }
    }
    for (const observation of delivery.observations) {
      if (observation.payload.deliveryId !== delivery.deliveryId) {
        ctx.addIssue({
          code: 'custom',
          message: `observation "${observation.recordId}" belongs to delivery "${observation.payload.deliveryId}" but lives in "${delivery.deliveryId}"`,
          path: ['observations'],
        });
        break;
      }
    }
    for (let i = 1; i < delivery.actuals.length; i += 1) {
      if (delivery.actuals[i]!.recordId < delivery.actuals[i - 1]!.recordId) {
        ctx.addIssue({
          code: 'custom',
          message: 'actuals must be sorted by recordId ascending (deterministic serialization)',
          path: ['actuals'],
        });
        break;
      }
      if (delivery.actuals[i]!.recordId === delivery.actuals[i - 1]!.recordId) {
        ctx.addIssue({
          code: 'custom',
          message: 'actuals must be duplicate-free by recordId',
          path: ['actuals'],
        });
        break;
      }
    }
    for (const actual of delivery.actuals) {
      if (actual.payload.deliveryId !== delivery.deliveryId) {
        ctx.addIssue({
          code: 'custom',
          message: `actual "${actual.recordId}" belongs to delivery "${actual.payload.deliveryId}" but lives in "${delivery.deliveryId}"`,
          path: ['actuals'],
        });
        break;
      }
    }
    for (const [field, ids] of [
      ['acceptedObservationIds', delivery.acceptedObservationIds],
      ['rejectedObservationIds', delivery.rejectedObservationIds],
    ] as const) {
      for (let i = 1; i < ids.length; i += 1) {
        if (ids[i]! < ids[i - 1]!) {
          ctx.addIssue({
            code: 'custom',
            message: `${field} must be sorted ascending (deterministic serialization)`,
            path: [field],
          });
          break;
        }
        if (ids[i]! === ids[i - 1]!) {
          ctx.addIssue({
            code: 'custom',
            message: `${field} must be duplicate-free`,
            path: [field],
          });
          break;
        }
      }
    }
    for (const acceptedId of delivery.acceptedObservationIds) {
      if (delivery.rejectedObservationIds.includes(acceptedId)) {
        ctx.addIssue({
          code: 'custom',
          message: `observation "${acceptedId}" is both accepted and rejected`,
          path: ['acceptedObservationIds'],
        });
        break;
      }
    }
    for (const actual of delivery.actuals) {
      if (!delivery.acceptedObservationIds.includes(actual.payload.derivedFromObservationId)) {
        ctx.addIssue({
          code: 'custom',
          message: `actual "${actual.recordId}" derives from observation "${actual.payload.derivedFromObservationId}" which is not in the accepted set`,
          path: ['actuals'],
        });
        break;
      }
      if (!delivery.observations.some((observation) => observation.recordId === actual.payload.derivedFromObservationId)) {
        ctx.addIssue({
          code: 'custom',
          message: `actual "${actual.recordId}" derives from observation "${actual.payload.derivedFromObservationId}" which is not recorded in this delivery`,
          path: ['actuals'],
        });
        break;
      }
    }
    if (delivery.status === 'closed' && delivery.closedAt === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a closed delivery must carry closedAt',
        path: ['closedAt'],
      });
    }
  })
  .meta({
    id: 'DeliveryRecordContent',
    title: 'DeliveryRecordContent',
    description:
      'The immutable content of one delivery-record state: identity, tenant scope, the delivered baseline, sorted observation records, sorted accepted/rejected id sets, sorted actual records, and the open/closed status.',
  });

/** One delivery record content. */
export type DeliveryRecordContent = z.infer<typeof DeliveryRecordContentSchema>;

/** The SEALED delivery record: content plus its SHA-256 content digest. */
export const SealedDeliveryRecordSchema = z
  .strictObject({
    schema: z.literal(DELIVERY_RECORD_SCHEMA_NAME),
    schemaVersion: z.literal(SOLUTION_DELIVERY_RECORD_VERSION),
    deliveryId: DeliveryIdSchema,
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    solutionVersion: SemverCoreSchema,
    solutionVersionDigest: Sha256HexSchema,
    openedAt: TimestampSchema,
    openedBy: PrincipalIdSchema,
    status: z.enum(DELIVERY_STATUSES),
    closedAt: TimestampSchema.optional(),
    closedBy: PrincipalIdSchema.optional(),
    observations: ObservationArraySchema,
    acceptedObservationIds: z.array(z.string().regex(/^observation:[a-z0-9][a-z0-9-]{0,62}$/)).max(4096),
    rejectedObservationIds: z.array(z.string().regex(/^observation:[a-z0-9][a-z0-9-]{0,62}$/)).max(4096),
    actuals: ActualArraySchema,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedDeliveryRecord',
    title: 'SealedDeliveryRecord',
    description:
      'The sealed delivery record: canonically ordered immutable state plus its SHA-256 content digest (exact-revision addressing of the delivery state).',
  });

/** One sealed delivery record. */
export type SealedDeliveryRecord = z.infer<typeof SealedDeliveryRecordSchema>;

/** The acceptance provenance of one observation. */
export interface ObservationAcceptance {
  readonly acceptedBy: string;
  readonly acceptedAt: string;
}

/** The rejection provenance of one observation. */
export interface ObservationRejection {
  readonly rejectedBy: string;
  readonly rejectedAt: string;
  readonly reason?: string | undefined;
}

/** The actualization provenance of one observation. */
export interface Actualization {
  readonly actualId: string;
  readonly actualizedBy: string;
  readonly actualizedAt: string;
}

/** The closing provenance of a delivery. */
export interface DeliveryClosing {
  readonly closedBy: string;
  readonly closedAt: string;
}

/** Strip the content digest from a sealed state (the pure content). */
function contentOf(sealed: SealedDeliveryRecord): DeliveryRecordContent {
  const content: Record<string, unknown> = { ...sealed };
  delete content['contentDigest'];
  return content as unknown as DeliveryRecordContent;
}

/** Compute the content digest of a delivery-record state. */
export function computeDeliveryRecordDigest(content: DeliveryRecordContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

function reseal(content: DeliveryRecordContent): SealedDeliveryRecord {
  const contentDigest = canonicalDigest(content as unknown as JsonValue);
  return { ...content, contentDigest };
}

/** Open (validate + seal) a delivery record state. */
export function openDeliveryRecord(content: unknown): DeliveryResult<SealedDeliveryRecord> {
  const parsed = DeliveryRecordContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: reseal(parsed.data) };
}

/**
 * Verify a sealed delivery record: schema validation + digest
 * recomputation (tamper detection — `digest-mismatch`).
 */
export function verifySealedDeliveryRecord(sealed: unknown): DeliveryResult<SealedDeliveryRecord> {
  const parsed = SealedDeliveryRecordSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'sealed delivery record digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * OBSERVATION INTAKE: append a sealed observation record (kind
 * `observation`) to the delivery. Total: the observation must verify, its
 * tenant/delivery must match, its id must be new, and the delivery must
 * be open. Returns the next delivery state (immutable update).
 */
export function recordObservation(
  delivery: SealedDeliveryRecord,
  observation: unknown,
): DeliveryResult<SealedDeliveryRecord> {
  const next = verifySealedDeliveryRecord(delivery);
  if (!next.ok) {
    return next;
  }
  const current = contentOf(next.value);
  const parsed = ObservationRecordSchema.safeParse(observation);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const record = parsed.data;
  if (record.tenantId !== current.tenantId) {
    return {
      ok: false,
      error: {
        code: 'cross-tenant-denied',
        message: `observation "${record.recordId}" belongs to tenant "${record.tenantId}" but the delivery is scoped to "${current.tenantId}" (R12)`,
        expectedTenantId: current.tenantId,
        encounteredTenantId: record.tenantId,
      },
    };
  }
  if (record.payload.deliveryId !== current.deliveryId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `observation "${record.recordId}" belongs to delivery "${record.payload.deliveryId}" but the intake is scoped to "${current.deliveryId}"`,
        issues: [{ path: 'payload.deliveryId', message: 'observation delivery mismatch' }],
      },
    };
  }
  if (current.observations.some((existing) => existing.recordId === record.recordId)) {
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `observation "${record.recordId}" is already recorded — observations are append-only and immutable`,
        solutionId: current.solutionId,
        version: record.recordId,
      },
    };
  }
  if (current.status === 'closed') {
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message: 'observation intake requires an open delivery (this delivery is closed)',
        subjectId: current.deliveryId,
      },
    };
  }
  const observations = [...current.observations, record].sort((a, b) =>
    a.recordId < b.recordId ? -1 : 1,
  );
  const content: DeliveryRecordContent = { ...current, observations };
  return { ok: true, value: reseal(content) };
}

/** Find one observation of the delivery by record id. */
function findObservation(
  delivery: { readonly observations: readonly ObservationRecord[] },
  observationId: string,
): ObservationRecord | undefined {
  return delivery.observations.find((observation) => observation.recordId === observationId);
}

/**
 * ACCEPTANCE TRANSITION: move an observation into the accepted set (the
 * review state lives on the delivery, never on the observation record).
 * Idempotent for an already-accepted observation; a rejected observation
 * cannot be accepted (`lifecycle-conflict`).
 */
export function acceptObservation(
  delivery: SealedDeliveryRecord,
  observationId: string,
  acceptance: ObservationAcceptance,
): DeliveryResult<SealedDeliveryRecord> {
  const next = verifySealedDeliveryRecord(delivery);
  if (!next.ok) {
    return next;
  }
  const current = contentOf(next.value);
  const observation = findObservation(current, observationId);
  if (observation === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `observation "${observationId}" is not recorded in delivery "${current.deliveryId}"`,
        referenceKind: 'observation',
        referenceId: observationId,
      },
    };
  }
  if (current.rejectedObservationIds.includes(observationId)) {
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message: `observation "${observationId}" is rejected and cannot be accepted`,
        subjectId: current.deliveryId,
      },
    };
  }
  if (current.acceptedObservationIds.includes(observationId)) {
    return { ok: true, value: next.value };
  }
  if (acceptance.acceptedAt < observation.payload.observedAt) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'acceptance instant precedes the observation instant',
        issues: [{ path: 'acceptedAt', message: 'acceptedAt must not precede observedAt' }],
      },
    };
  }
  const acceptedObservationIds = [...current.acceptedObservationIds, observationId].sort();
  const content: DeliveryRecordContent = { ...current, acceptedObservationIds };
  return { ok: true, value: reseal(content) };
}

/**
 * REJECTION TRANSITION: move an observation into the rejected set. An
 * accepted observation and an actualized observation cannot be rejected
 * (`lifecycle-conflict`).
 */
export function rejectObservation(
  delivery: SealedDeliveryRecord,
  observationId: string,
  rejection: ObservationRejection,
): DeliveryResult<SealedDeliveryRecord> {
  const next = verifySealedDeliveryRecord(delivery);
  if (!next.ok) {
    return next;
  }
  const current = contentOf(next.value);
  const observation = findObservation(current, observationId);
  if (observation === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `observation "${observationId}" is not recorded in delivery "${current.deliveryId}"`,
        referenceKind: 'observation',
        referenceId: observationId,
      },
    };
  }
  if (current.acceptedObservationIds.includes(observationId)) {
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message: `observation "${observationId}" is accepted and cannot be rejected`,
        subjectId: current.deliveryId,
      },
    };
  }
  if (
    current.actuals.some((actual) => actual.payload.derivedFromObservationId === observationId)
  ) {
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message: `observation "${observationId}" is actualized and cannot be rejected`,
        subjectId: current.deliveryId,
      },
    };
  }
  if (current.rejectedObservationIds.includes(observationId)) {
    return { ok: true, value: next.value };
  }
  if (rejection.rejectedAt < observation.payload.observedAt) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'rejection instant precedes the observation instant',
        issues: [{ path: 'rejectedAt', message: 'rejectedAt must not precede observedAt' }],
      },
    };
  }
  const rejectedObservationIds = [...current.rejectedObservationIds, observationId].sort();
  const content: DeliveryRecordContent = { ...current, rejectedObservationIds };
  return { ok: true, value: reseal(content) };
}

/**
 * ACTUALIZATION: convert an ACCEPTED observation into an authoritative
 * delivery fact (an `actual` distinction record appended to the
 * delivery). The actual inherits the observation's measure and
 * uncertainty and links to the observation id — never restating it.
 * Actualizing a proposed or rejected observation is a typed
 * `unaccepted-actualization-rejected`.
 */
export function actualizeObservation(
  delivery: SealedDeliveryRecord,
  observationId: string,
  actualization: Actualization,
): DeliveryResult<SealedDeliveryRecord> {
  const next = verifySealedDeliveryRecord(delivery);
  if (!next.ok) {
    return next;
  }
  const current = contentOf(next.value);
  const observation = findObservation(current, observationId);
  if (observation === undefined) {
    return {
      ok: false,
      error: {
        code: 'unaccepted-actualization-rejected',
        message: `observation "${observationId}" is not recorded in delivery "${current.deliveryId}" — actualization converts recorded observations only`,
        observationId,
        observationState: 'missing',
      },
    };
  }
  const accepted = current.acceptedObservationIds.includes(observationId);
  if (!accepted) {
    const rejected = current.rejectedObservationIds.includes(observationId);
    return {
      ok: false,
      error: {
        code: 'unaccepted-actualization-rejected',
        message:
          `observation "${observationId}" is ${rejected ? 'REJECTED' : 'still PROPOSED'} — ` +
          'actualization converts ACCEPTED observations only (USL1.0: Observation is evidence capture; Actualization converts accepted observations into authoritative delivery facts)',
        observationId,
        observationState: rejected ? 'rejected' : 'proposed',
      },
    };
  }
  if (current.status === 'closed') {
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message: 'actualization requires an open delivery (this delivery is closed)',
        subjectId: current.deliveryId,
      },
    };
  }
  if (current.actuals.some((actual) => actual.payload.derivedFromObservationId === observationId)) {
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `observation "${observationId}" is already actualized — an accepted observation converts exactly once`,
        solutionId: current.solutionId,
        version: observationId,
      },
    };
  }
  if (current.actuals.some((actual) => actual.recordId === actualization.actualId)) {
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `actual id "${actualization.actualId}" is already used`,
        solutionId: current.solutionId,
        version: actualization.actualId,
      },
    };
  }
  if (actualization.actualizedAt < observation.payload.observedAt) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'actualization instant precedes the observation instant',
        issues: [{ path: 'actualizedAt', message: 'actualizedAt must not precede observedAt' }],
      },
    };
  }
  const actualContent = {
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: SOLUTION_DELIVERY_RECORD_VERSION,
    kind: 'actual',
    recordId: actualization.actualId,
    tenantId: current.tenantId,
    subject: observation.subject,
    measure: observation.measure,
    payload: {
      deliveryId: current.deliveryId,
      derivedFromObservationId: observationId,
      actualizedAt: actualization.actualizedAt,
      actualizedBy: actualization.actualizedBy,
    },
    recordedAt: actualization.actualizedAt,
    recordedBy: actualization.actualizedBy,
    uncertainty: observation.uncertainty,
  };
  const parsedActual = ActualRecordSchema.safeParse({
    ...actualContent,
    contentDigest: canonicalDigest(actualContent as unknown as JsonValue),
  });
  if (!parsedActual.success) {
    if (hasUnrecognizedKeys(parsedActual.error)) {
      return { ok: false, error: vendorFieldsError(parsedActual.error) };
    }
    return { ok: false, error: validationError(parsedActual.error) };
  }
  const actuals = [...current.actuals, parsedActual.data].sort((a, b) =>
    a.recordId < b.recordId ? -1 : 1,
  );
  const content: DeliveryRecordContent = { ...current, actuals };
  return { ok: true, value: reseal(content) };
}

/**
 * CLOSE: transition the delivery to the closed status (no further intake,
 * acceptance, or actualization).
 */
export function closeDeliveryRecord(
  delivery: SealedDeliveryRecord,
  closing: DeliveryClosing,
): DeliveryResult<SealedDeliveryRecord> {
  const next = verifySealedDeliveryRecord(delivery);
  if (!next.ok) {
    return next;
  }
  const current = contentOf(next.value);
  if (current.status === 'closed') {
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message: 'delivery is already closed',
        subjectId: current.deliveryId,
      },
    };
  }
  if (closing.closedAt < current.openedAt) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'closing instant precedes the opening instant',
        issues: [{ path: 'closedAt', message: 'closedAt must not precede openedAt' }],
      },
    };
  }
  const content: DeliveryRecordContent = {
    ...current,
    status: 'closed',
    closedAt: closing.closedAt,
    closedBy: closing.closedBy,
  };
  return { ok: true, value: reseal(content) };
}

// --------------------------------------------------------------------------------
// Deterministic delivery folds.
// --------------------------------------------------------------------------------

/** One actual-total row of the delivery state (quantity or cost measure). */
export interface DeliveryActualTotal {
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly measureKind: 'quantity' | 'cost';
  readonly unit?: string | undefined;
  readonly currency?: string | undefined;
  readonly total: string;
}

/** The deterministic actuals summary of a delivery state. */
export interface DeliveryActualsSummary {
  readonly actualCount: number;
  readonly observationCounts: Readonly<{ total: number; accepted: number; rejected: number; proposed: number }>;
  readonly totals: readonly DeliveryActualTotal[];
}

/**
 * Fold the authoritative delivery state: actual count, observation review
 * counts, and exact per-subject measure totals (quantity per unit; cost
 * per currency). Rows sort by (subjectKind, subjectId, measureKind, unit,
  currency); input order never leaks.
 */
export function foldDeliveryActuals(delivery: SealedDeliveryRecord): DeliveryActualsSummary {
  const totals = new Map<string, string>();
  const meta = new Map<string, DeliveryActualTotal>();
  for (const actual of delivery.actuals) {
    if (actual.measure.kind !== 'quantity' && actual.measure.kind !== 'cost') {
      continue;
    }
    const unit = actual.measure.kind === 'quantity' ? actual.measure.unit : undefined;
    const currency = actual.measure.kind === 'cost' ? actual.measure.currency : undefined;
    const key = [
      actual.subject.subjectKind,
      actual.subject.subjectId,
      actual.measure.kind,
      unit ?? '',
      currency ?? '',
    ].join('\u0000');
    const row: DeliveryActualTotal = {
      subjectKind: actual.subject.subjectKind,
      subjectId: actual.subject.subjectId,
      measureKind: actual.measure.kind,
      unit,
      currency,
      total: '0',
    };
    if (!meta.has(key)) {
      meta.set(key, row);
    }
    const addition =
      actual.measure.kind === 'quantity' ? actual.measure.value : actual.measure.amount;
    totals.set(key, addNonNegativeDecimals(totals.get(key) ?? '0', addition));
  }
  const rows = [...meta.entries()]
    .map(([key, row]) => ({ ...row, total: totals.get(key) ?? '0' }))
    .sort((a, b) => {
      if (a.subjectKind !== b.subjectKind) return a.subjectKind < b.subjectKind ? -1 : 1;
      if (a.subjectId !== b.subjectId) return a.subjectId < b.subjectId ? -1 : 1;
      if (a.measureKind !== b.measureKind) return a.measureKind < b.measureKind ? -1 : 1;
      return (a.unit ?? a.currency ?? '') < (b.unit ?? b.currency ?? '') ? -1 : 1;
    });
  return {
    actualCount: delivery.actuals.length,
    observationCounts: {
      total: delivery.observations.length,
      accepted: delivery.acceptedObservationIds.length,
      rejected: delivery.rejectedObservationIds.length,
      proposed:
        delivery.observations.length -
        delivery.acceptedObservationIds.length -
        delivery.rejectedObservationIds.length,
    },
    totals: rows,
  };
}
