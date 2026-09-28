/**
 * The normalized INBOUND contract (the W042 dispatch pin): typed
 * ExternalEvent records — source adapter identity, event class, opaque
 * payload, correlation id, causation id, occurred-at (CALLER-SUPPLIED
 * instant — this kernel never reads a clock), W006-shaped provenance —
 * admitted as W036-shaped observation INTAKE PROPOSALS through the
 * existing authority path.
 *
 * THE OBSERVATION-BYPASS GATE (the authority discipline): the bridge
 * NEVER writes observations directly. An inbound event PROPOSES
 * observation intake; the W036 delivery authority (the DeliveryRecord
 * machinery) records/accepts/actualizes — never the bridge. Two typed
 * rejections enforce this:
 *
 * - an ExternalEvent whose opaque payload EMBEDS a sealed W036
 *   distinction-record discriminator (an event presenting itself as an
 *   observation) is `observation-bypass-rejected` — inbound reports are
 *   evidence proposals, never observations;
 * - an ExternalEvent payload embedding ANY other Epoch kernel schema
 *   discriminator is `authority-violation` — provider payloads are
 *   opaque report data and never claim kernel authority.
 *
 * `buildObservationIntakeProposal` is the reference adapter step (the
 * W036 `externalEventToObservation` convention): one ADMITTED
 * observation-report event plus a caller-supplied observation context
 * become a sealed, content-addressed INTAKE PROPOSAL whose observation
 * slot is W036-SHAPED (the W036 observation distinction-record envelope
 * with opaque subject/measure/payload/uncertainty slots the W036
 * authority validates on admission). The external event's content
 * digest becomes the evidence anchor, so the proposal is traceable to
 * the exact external report.
 *
 * Compatibility with the REAL W036 shapes is pinned WITHOUT a runtime
 * dependency: runtime parity tests (test/parity.test.ts) prove the
 * proposal's observation slot parses through the REAL W036
 * DistinctionRecordContent validator and seals through the REAL W036
 * sealDistinctionRecord with the digest the W036 authority computes.
 */
import { z } from 'zod';
import { canonicalDigest, JsonValueSchema, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  CausationIdSchema,
  CorrelationIdSchema,
  ExternalEventIdSchema,
  IdempotencyKeySchema,
  IntakeProposalIdSchema,
  OpaquePayloadSchema,
  BridgePrincipalIdSchema,
  BridgeTimestampSchema,
  Sha256HexSchema,
} from './primitives';
import { BridgeProvenanceSchema, type BridgeProvenance } from './provenance';
import {
  EXTERNAL_EVENT_SCHEMA_NAME,
  EXTERNAL_EVENT_BRIDGE_RECORD_VERSION,
  INBOUND_EVENT_CLASSES,
  INTAKE_PROPOSAL_SCHEMA_NAME,
} from './version';
import { classifiedParseError } from './issues';
import type { BridgeResult } from './errors';

// --------------------------------------------------------------------------------
// The normalized external event.
// --------------------------------------------------------------------------------

/** The zod field map of the external-event content (shared with the sealed record). */
const EXTERNAL_EVENT_FIELDS = {
  schema: z.literal(EXTERNAL_EVENT_SCHEMA_NAME),
  schemaVersion: z.literal(EXTERNAL_EVENT_BRIDGE_RECORD_VERSION),
  eventId: ExternalEventIdSchema,
  tenantId: TenantIdSchema,
  eventClass: z.enum(INBOUND_EVENT_CLASSES),
  source: BridgeProvenanceSchema,
  correlationId: CorrelationIdSchema,
  causationId: CausationIdSchema.nullable(),
  occurredAt: BridgeTimestampSchema,
  payload: OpaquePayloadSchema,
  confidence: OpaquePayloadSchema,
  idempotencyKey: IdempotencyKeySchema,
} as const;

/** The immutable content of one normalized external event. */
export const ExternalEventContentSchema = z
  .strictObject({ ...EXTERNAL_EVENT_FIELDS })
  .readonly()
  .meta({
    id: 'ExternalEventContent',
    title: 'ExternalEventContent',
    description:
      'The immutable content of one normalized external event: kind-prefixed event id, tenant scope, typed event class, W006-shaped source provenance, correlation and causation ids, the caller-supplied occurrence instant, the opaque report payload, the opaque confidence state, and the idempotency key.',
  });

/** One external-event content. */
export type ExternalEventContent = z.infer<typeof ExternalEventContentSchema>;

/** The SEALED external event: content plus its canonical SHA-256 digest. */
export const SealedExternalEventSchema = z
  .strictObject({ ...EXTERNAL_EVENT_FIELDS, contentDigest: Sha256HexSchema })
  .readonly()
  .meta({
    id: 'SealedExternalEvent',
    title: 'SealedExternalEvent',
    description:
      'Published external event record: immutable normalized content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed external event. */
export type SealedExternalEvent = z.infer<typeof SealedExternalEventSchema>;

/** Compute the content digest of an external event (content addressing). */
export function computeExternalEventDigest(content: ExternalEventContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Whether one JSON node embeds a kernel schema-discriminator claim. */
function embeddedKernelSchemaClaim(value: JsonValue): string | undefined {
  if (Array.isArray(value)) {
    for (const element of value) {
      const claim = embeddedKernelSchemaClaim(element);
      if (claim !== undefined) return claim;
    }
    return undefined;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'schema' && typeof child === 'string' && child.startsWith('epoch.')) {
        return child;
      }
      const claim = embeddedKernelSchemaClaim(child);
      if (claim !== undefined) return claim;
    }
  }
  return undefined;
}

/**
 * The OBSERVATION-BYPASS GATE: classify an external-event payload.
 * Provider payloads are opaque report data — an embedded W036
 * distinction-record discriminator is an event presenting itself as a
 * sealed observation (`observation-bypass-rejected`); any other
 * embedded kernel discriminator is a generic authority claim
 * (`authority-violation`).
 */
export function classifyPayloadAuthorityClaim(
  payload: Readonly<Record<string, JsonValue>>,
): BridgeResult<undefined> {
  const claim = embeddedKernelSchemaClaim(payload);
  if (claim === undefined) return { ok: true, value: undefined };
  if (claim === 'epoch.solution-delivery.distinction-record') {
    return {
      ok: false,
      error: {
        code: 'observation-bypass-rejected',
        message:
          'the external event embeds a sealed W036 distinction-record discriminator — inbound events PROPOSE observation intake through the authority path; they never present themselves as observations (the bridge never writes observations directly)',
        reason: 'sealed-observation-payload',
      },
    };
  }
  return {
    ok: false,
    error: {
      code: 'authority-violation',
      message: `the external event payload claims the kernel schema discriminator "${claim}" — provider payloads are opaque report data and never claim kernel authority`,
      reason: 'kernel-schema-discriminator-claimed',
    },
  };
}

/** Seal valid external-event content into its published record. */
export function sealExternalEvent(content: unknown): BridgeResult<SealedExternalEvent> {
  const parsed = ExternalEventContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: classifiedParseError(parsed.error) };
  }
  const gate = classifyPayloadAuthorityClaim(parsed.data.payload);
  if (!gate.ok) return gate;
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: computeExternalEventDigest(parsed.data) },
  };
}

/** Verify a sealed external event: schema + bypass gate + recomputed digest. */
export function verifySealedExternalEvent(sealed: unknown): BridgeResult<SealedExternalEvent> {
  const parsed = SealedExternalEventSchema.safeParse(sealed);
  if (!parsed.success) {
    return { ok: false, error: classifiedParseError(parsed.error) };
  }
  const gate = classifyPayloadAuthorityClaim(parsed.data.payload);
  if (!gate.ok) return gate;
  const { contentDigest, ...content } = parsed.data;
  const recomputed = computeExternalEventDigest(content);
  if (recomputed !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `external event "${parsed.data.eventId}" failed digest verification (tampered or mismatched record)`,
        expected: recomputed,
        encountered: parsed.data.contentDigest,
        subject: parsed.data.eventId,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The W036-shaped observation intake proposal.
// --------------------------------------------------------------------------------

/** The W036 observation record-id grammar (kind-prefixed). */
const OBSERVATION_RECORD_ID_PATTERN = /^observation:[a-z0-9][a-z0-9-]{0,62}$/;

/**
 * The W036-SHAPED observation slot of one intake proposal: the W036
 * observation distinction-record ENVELOPE (schema discriminator, record
 * version, kind literal, kind-prefixed record id, tenant scope,
 * recording provenance) with OPAQUE subject/measure/payload/uncertainty
 * slots — the W036 authority validates those through its own schemas on
 * admission (runtime-parity-pinned; the bridge is never that
 * authority).
 */
export const ObservationIntakePayloadSchema = z
  .strictObject({
    schema: z.literal('epoch.solution-delivery.distinction-record'),
    schemaVersion: z.literal(EXTERNAL_EVENT_BRIDGE_RECORD_VERSION),
    kind: z.literal('observation'),
    recordId: z.string().regex(OBSERVATION_RECORD_ID_PATTERN),
    tenantId: TenantIdSchema,
    subject: JsonValueSchema,
    measure: JsonValueSchema,
    payload: JsonValueSchema,
    recordedAt: BridgeTimestampSchema,
    recordedBy: BridgePrincipalIdSchema,
    uncertainty: JsonValueSchema,
  })
  .readonly()
  .meta({
    id: 'ObservationIntakePayload',
    title: 'ObservationIntakePayload',
    description:
      'The W036-shaped observation slot of one intake proposal: the W036 observation distinction-record envelope with opaque subject/measure/payload/uncertainty slots (validated by the W036 authority on admission).',
  });

/** One observation intake payload. */
export type ObservationIntakePayload = z.infer<typeof ObservationIntakePayloadSchema>;

/** The zod field map of the intake-proposal content (shared with the sealed record). */
const INTAKE_PROPOSAL_FIELDS = {
  schema: z.literal(INTAKE_PROPOSAL_SCHEMA_NAME),
  schemaVersion: z.literal(EXTERNAL_EVENT_BRIDGE_RECORD_VERSION),
  proposalId: IntakeProposalIdSchema,
  tenantId: TenantIdSchema,
  sourceEventId: ExternalEventIdSchema,
  sourceEventDigest: Sha256HexSchema,
  source: BridgeProvenanceSchema,
  correlationId: CorrelationIdSchema,
  causationId: CausationIdSchema.nullable(),
  observation: ObservationIntakePayloadSchema,
  proposedAt: BridgeTimestampSchema,
  proposedBy: BridgePrincipalIdSchema,
} as const;

/** The immutable content of one observation intake proposal. */
export const ObservationIntakeProposalContentSchema = z
  .strictObject({ ...INTAKE_PROPOSAL_FIELDS })
  .superRefine((proposal, ctx) => {
    if (proposal.observation.tenantId !== proposal.tenantId) {
      ctx.addIssue({
        code: 'custom',
        message: 'the observation slot tenant must equal the proposal tenant (R12)',
        path: ['observation', 'tenantId'],
      });
    }
  })
  .readonly()
  .meta({
    id: 'ObservationIntakeProposalContent',
    title: 'ObservationIntakeProposalContent',
    description:
      'The immutable content of one observation intake proposal: proposal id, tenant scope, the exact external-event revision it derives from (id + digest + source provenance), correlation/causation ids, the W036-shaped observation slot, and the caller-supplied proposal provenance.',
  });

/** One observation intake-proposal content. */
export type ObservationIntakeProposalContent = z.infer<
  typeof ObservationIntakeProposalContentSchema
>;

/** The SEALED observation intake proposal: content plus its digest. */
export const SealedObservationIntakeProposalSchema = z
  .strictObject({ ...INTAKE_PROPOSAL_FIELDS, contentDigest: Sha256HexSchema })
  .superRefine((proposal, ctx) => {
    if (proposal.observation.tenantId !== proposal.tenantId) {
      ctx.addIssue({
        code: 'custom',
        message: 'the observation slot tenant must equal the proposal tenant (R12)',
        path: ['observation', 'tenantId'],
      });
    }
  })
  .readonly()
  .meta({
    id: 'SealedObservationIntakeProposal',
    title: 'SealedObservationIntakeProposal',
    description:
      'Published observation intake proposal: immutable W036-shaped content plus the SHA-256 of its canonical JSON (the exact-revision content address the W036 authority cites on admission).',
  });

/** One sealed observation intake proposal. */
export type SealedObservationIntakeProposal = z.infer<typeof SealedObservationIntakeProposalSchema>;

/** Compute the content digest of an intake proposal. */
export function computeObservationIntakeProposalDigest(
  content: ObservationIntakeProposalContent,
): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** The caller-supplied observation context (what becomes the observation). */
export interface ObservationIntakeContext {
  readonly proposalId: string;
  readonly recordId: string;
  readonly subject: JsonValue;
  readonly measure: JsonValue;
  readonly payload: JsonValue;
  readonly recordedAt: string;
  readonly recordedBy: string;
  readonly uncertainty: JsonValue;
  readonly proposedAt: string;
  readonly proposedBy: string;
}

/**
 * The reference adapter step: one ADMITTED observation-report external
 * event plus a caller-supplied observation context become a sealed,
 * content-addressed observation INTAKE PROPOSAL (the authority path:
 * the W036 delivery machinery records/accepts/actualizes; the bridge
 * only proposes). The external event's content digest is the evidence
 * anchor inside the observation slot's opaque payload.
 */
export function buildObservationIntakeProposal(
  event: SealedExternalEvent,
  context: ObservationIntakeContext,
): BridgeResult<SealedObservationIntakeProposal> {
  if (event.eventClass !== 'observation-report') {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `only "observation-report" events propose observation intake (encountered "${event.eventClass}")`,
        issues: [{ path: 'eventClass', message: `encountered "${event.eventClass}"` }],
      },
    };
  }
  const content: ObservationIntakeProposalContent = {
    schema: INTAKE_PROPOSAL_SCHEMA_NAME,
    schemaVersion: EXTERNAL_EVENT_BRIDGE_RECORD_VERSION,
    proposalId: context.proposalId,
    tenantId: event.tenantId,
    sourceEventId: event.eventId,
    sourceEventDigest: event.contentDigest,
    source: event.source,
    correlationId: event.correlationId,
    causationId: event.causationId,
    observation: {
      schema: 'epoch.solution-delivery.distinction-record',
      schemaVersion: EXTERNAL_EVENT_BRIDGE_RECORD_VERSION,
      kind: 'observation',
      recordId: context.recordId,
      tenantId: event.tenantId,
      subject: context.subject,
      measure: context.measure,
      payload: context.payload,
      recordedAt: context.recordedAt,
      recordedBy: context.recordedBy,
      uncertainty: context.uncertainty,
    },
    proposedAt: context.proposedAt,
    proposedBy: context.proposedBy,
  };
  return sealObservationIntakeProposal(content);
}

/** Seal valid intake-proposal content into its published record. */
export function sealObservationIntakeProposal(
  content: unknown,
): BridgeResult<SealedObservationIntakeProposal> {
  const parsed = ObservationIntakeProposalContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: classifiedParseError(parsed.error) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: computeObservationIntakeProposalDigest(parsed.data) },
  };
}

/** Verify a sealed intake proposal: schema + recomputed digest. */
export function verifySealedObservationIntakeProposal(
  sealed: unknown,
): BridgeResult<SealedObservationIntakeProposal> {
  const parsed = SealedObservationIntakeProposalSchema.safeParse(sealed);
  if (!parsed.success) {
    return { ok: false, error: classifiedParseError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const recomputed = computeObservationIntakeProposalDigest(content);
  if (recomputed !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `intake proposal "${parsed.data.proposalId}" failed digest verification (tampered or mismatched record)`,
        expected: recomputed,
        encountered: parsed.data.contentDigest,
        subject: parsed.data.proposalId,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** The source provenance view of one external event (attribution). */
export function provenanceOf(event: SealedExternalEvent): BridgeProvenance {
  return event.source;
}
