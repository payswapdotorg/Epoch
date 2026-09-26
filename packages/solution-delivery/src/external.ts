/**
 * Provider-neutral external request/event contracts (architecture.md
 * "External event bridge", binding): external systems can provide
 * authorized normalized observations/events and receive typed information
 * requests, status checks and alerts. Provider-specific semantics remain
 * behind adapters.
 *
 * - `ExternalRequestEnvelope` is the OUTBOUND seam: what Epoch sends out
 *   (acquisition orders, information requests, status checks, alerts).
 * - `ExternalEventEnvelope` is the INBOUND seam: what an external system
 *   reports back, correlated by an opaque key.
 * - NO vendor, brand, gateway, credential or API vocabulary exists
 *   anywhere: external systems are opaque references (`external:<slug>`
 *   style opaque strings), payloads are opaque JSON, and concrete
 *   providers stay behind adapters (the seam W042 later bridges).
 * - `externalEventToObservation` is the reference ADAPTER step: a
 *   normalized external event becomes an observation-kind distinction
 *   record (evidence capture) for a delivery — never an actual (only
 *   ACCEPTED observations actualize).
 */
import { z } from 'zod';
import {
  canonicalDigest,
  JsonValueSchema,
  TimestampSchema,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  ExternalEventIdSchema,
  ExternalRequestIdSchema,
  OpaqueReferenceSchema,
  PrincipalIdSchema,
  SolutionIdSchema,
} from './primitives';
import {
  EXTERNAL_EVENT_SCHEMA_NAME,
  EXTERNAL_REQUEST_SCHEMA_NAME,
  SOLUTION_DELIVERY_RECORD_VERSION,
} from './version';
import { sealDistinctionRecord, ObservationRecordSchema, type ObservationRecord, type DistinctionSubject, type Measure } from './distinctions';
import type { UncertaintyState } from './uncertainty';
import { hasUnrecognizedKeys, vendorFieldsError, validationError } from './issues';
import type { DeliveryResult } from './errors';

/** The typed outbound request kinds. */
export const EXTERNAL_REQUEST_KINDS = [
  'acquisition-order',
  'information-request',
  'status-check',
  'alert',
] as const;

/** One outbound request kind. */
export type ExternalRequestKind = (typeof EXTERNAL_REQUEST_KINDS)[number];

/** The typed inbound event kinds. */
export const EXTERNAL_EVENT_KINDS = [
  'observation-report',
  'status-update',
  'acknowledgment',
] as const;

/** One inbound event kind. */
export type ExternalEventKind = (typeof EXTERNAL_EVENT_KINDS)[number];

/**
 * The OUTBOUND request envelope: what Epoch sends to one external system.
 * The payload is opaque JSON — typed payloads are the adapter's concern;
 * this contract pins the envelope discipline (tenant scope, correlation,
 * provenance, provider-neutral target reference).
 */
export const ExternalRequestEnvelopeSchema = z
  .strictObject({
    schema: z.literal(EXTERNAL_REQUEST_SCHEMA_NAME),
    schemaVersion: z.literal(SOLUTION_DELIVERY_RECORD_VERSION),
    requestId: ExternalRequestIdSchema,
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    kind: z.enum(EXTERNAL_REQUEST_KINDS),
    targetSystemRef: OpaqueReferenceSchema,
    correlationKey: z.string().min(1).max(256),
    payload: z.record(z.string().min(1).max(256), JsonValueSchema).readonly(),
    issuedAt: TimestampSchema,
    issuedBy: PrincipalIdSchema,
  })
  .readonly()
  .meta({
    id: 'ExternalRequestEnvelope',
    title: 'ExternalRequestEnvelope',
    description:
      'The outbound external-request envelope: typed kind, opaque target-system reference, correlation key, opaque JSON payload, and issuing provenance (provider-neutral seam).',
  });

/** One external request envelope. */
export type ExternalRequestEnvelope = z.infer<typeof ExternalRequestEnvelopeSchema>;

/**
 * The INBOUND event envelope: what an external system reports back. The
 * payload is opaque JSON; correlation ties it to the outbound request.
 */
export const ExternalEventEnvelopeSchema = z
  .strictObject({
    schema: z.literal(EXTERNAL_EVENT_SCHEMA_NAME),
    schemaVersion: z.literal(SOLUTION_DELIVERY_RECORD_VERSION),
    eventId: ExternalEventIdSchema,
    tenantId: TenantIdSchema,
    kind: z.enum(EXTERNAL_EVENT_KINDS),
    sourceSystemRef: OpaqueReferenceSchema,
    correlationKey: z.string().min(1).max(256),
    payload: z.record(z.string().min(1).max(256), JsonValueSchema).readonly(),
    occurredAt: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'ExternalEventEnvelope',
    title: 'ExternalEventEnvelope',
    description:
      'The inbound external-event envelope: typed kind, opaque source-system reference, correlation key, opaque JSON payload, and the occurrence instant (provider-neutral seam).',
  });

/** One external event envelope. */
export type ExternalEventEnvelope = z.infer<typeof ExternalEventEnvelopeSchema>;

/** Admit an external request envelope (schema + vendor-field classification). */
export function admitExternalRequest(envelope: unknown): DeliveryResult<ExternalRequestEnvelope> {
  const parsed = ExternalRequestEnvelopeSchema.safeParse(envelope);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/** Admit an external event envelope (schema + vendor-field classification). */
export function admitExternalEvent(envelope: unknown): DeliveryResult<ExternalEventEnvelope> {
  const parsed = ExternalEventEnvelopeSchema.safeParse(envelope);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/** Compute the content digest of an external event envelope (content addressing). */
export function computeExternalEventDigest(envelope: ExternalEventEnvelope): Sha256Hex {
  return canonicalDigest(envelope as unknown as JsonValue);
}

/** The correlated pairing of one inbound event with its outbound request. */
export interface CorrelatedExchange {
  readonly request: ExternalRequestEnvelope;
  readonly event: ExternalEventEnvelope;
}

/**
 * Correlate one inbound event with its outbound request: the correlation
 * keys, tenants and system references must agree — mismatches are typed
 * `validation` / `cross-tenant-denied` rejections (the adapter discipline:
 * never guess a correlation).
 */
export function correlateExternalEvent(
  request: ExternalRequestEnvelope,
  event: ExternalEventEnvelope,
): DeliveryResult<CorrelatedExchange> {
  if (event.tenantId !== request.tenantId) {
    return {
      ok: false,
      error: {
        code: 'cross-tenant-denied',
        message: `external event "${event.eventId}" belongs to tenant "${event.tenantId}" but the request is scoped to "${request.tenantId}" (R12)`,
        expectedTenantId: request.tenantId,
        encounteredTenantId: event.tenantId,
      },
    };
  }
  if (event.correlationKey !== request.correlationKey) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `external event "${event.eventId}" correlates on "${event.correlationKey}" but the request correlates on "${request.correlationKey}"`,
        issues: [{ path: 'correlationKey', message: 'correlation mismatch' }],
      },
    };
  }
  if (event.sourceSystemRef !== request.targetSystemRef) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `external event "${event.eventId}" originates from "${event.sourceSystemRef}" but the request targeted "${request.targetSystemRef}"`,
        issues: [{ path: 'sourceSystemRef', message: 'system-reference mismatch' }],
      },
    };
  }
  if (event.occurredAt < request.issuedAt) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'external event precedes its correlated request',
        issues: [{ path: 'occurredAt', message: 'occurredAt must not precede issuedAt' }],
      },
    };
  }
  return { ok: true, value: { request, event } };
}

/** The adapter context: how one correlated event becomes an observation. */
export interface ExternalObservationContext {
  readonly observationRecordId: string;
  readonly deliveryId: string;
  readonly subject: DistinctionSubject;
  readonly measure: Measure;
  readonly observedBy: string;
  readonly observedAt: string;
  readonly uncertainty: UncertaintyState;
}

/**
 * The reference ADAPTER step: convert one correlated external
 * observation-report into a sealed observation-kind distinction record
 * (EVIDENCE CAPTURE — the actualization path still requires acceptance).
 * The external event's content digest becomes the evidence reference, so
 * the observation is traceable to the exact external report.
 */
export function externalEventToObservation(
  exchange: CorrelatedExchange,
  context: ExternalObservationContext,
): DeliveryResult<ObservationRecord> {
  if (exchange.event.kind !== 'observation-report') {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `only "observation-report" events adapt into observations (encountered "${exchange.event.kind}")`,
        issues: [{ path: 'kind', message: `encountered "${exchange.event.kind}"` }],
      },
    };
  }
  const evidence = computeExternalEventDigest(exchange.event);
  const observation = {
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: SOLUTION_DELIVERY_RECORD_VERSION,
    kind: 'observation',
    recordId: context.observationRecordId,
    tenantId: exchange.event.tenantId,
    subject: context.subject,
    measure: context.measure,
    payload: {
      deliveryId: context.deliveryId,
      observedAt: context.observedAt,
      observedBy: context.observedBy,
      evidence: [{ digest: evidence }],
    },
    recordedAt: context.observedAt,
    recordedBy: context.observedBy,
    uncertainty: context.uncertainty,
  };
  const sealed = sealDistinctionRecord(observation);
  if (!sealed.ok) {
    return sealed;
  }
  const parsed = ObservationRecordSchema.safeParse(sealed.value);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}
