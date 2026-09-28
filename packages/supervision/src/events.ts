/**
 * The supervision lifecycle event vocabulary over the W010 event shapes
 * (the W043 dispatch pin: "Every step emits `supervision:*` events
 * (W010-shaped, one stream per supervised program
 * `stream:supervision-<suffix>`, digests sealed by the kernel)").
 *
 * - `SupervisionEventContent` is a STRUCTURAL MIRROR of
 *   @epoch/event-log's `EventContent` (stream, 1-based sequence, tenant
 *   scope, principal actor, causal parent, namespaced payload,
 *   producer-supplied instant). One supervised program's lifecycle
 *   events form ONE stream (`stream:supervision-<suffix>`, derived
 *   deterministically by `supervisionStreamIdOf`); tenant host-level
 *   steps (policy registration) use `supervisionHostStreamIdOf`; events
 *   are FACTS — there is no mutation API.
 * - The supervision payload family is the open-namespace `supervision:*`
 *   discriminator set with TYPED data payloads for every kind
 *   (`SUPERVISION_EVENT_DATA_SCHEMAS`); `parseSupervisionEventData` is
 *   the W010 payload-family discipline applied to the whole vocabulary.
 * - Alert-lifecycle payload fields whose closed vocabularies are the
 *   @epoch/alerts kernel's authority (severity, channel kind,
 *   escalation outcome kind, alert resolution kind) are carried as
 *   BOUNDED NEUTRAL STRINGS here — cross-kernel vocabulary never
 *   re-declares a sibling authority; the supervision-runtime service
 *   pins member-compatibility by parity tests.
 * - Compatibility is pinned WITHOUT a runtime dependency: compile time
 *   via `src/kernel-parity.ts` (type equality with `EventContent`),
 *   runtime via `test/parity.test.ts` (the same fixtures seal through
 *   the REAL W010 sealEvent and digest identically through the REAL
 *   computeEventDigest).
 */
import { z } from 'zod';
import {
  JsonValueSchema,
  TimestampSchema,
  canonicalDigest,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import { PrincipalIdSchema, Sha256HexSchema } from '@epoch/solution-delivery';
import {
  ProgramIdSchema,
  DeliveryIdSchema,
} from '@epoch/solution-delivery';
import { SupervisionStreamIdSchema } from './primitives';
import {
  FINDING_CLASSES,
  SUPERVISION_EVENT_RECORD_VERSION,
  FINDING_SUBJECT_KINDS,
  type SupervisionEventDiscriminator,
} from './version';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { SupervisionResult } from './errors';

// --------------------------------------------------------------------------------
// The W010 structural mirror.
// --------------------------------------------------------------------------------

/** One supervision event sequence number (1-based, contiguous per stream). */
export const SupervisionEventSequenceSchema = z
  .number()
  .int('sequence numbers are integers')
  .min(1, 'sequence numbers start at 1')
  .max(Number.MAX_SAFE_INTEGER, 'sequence numbers are safe integers')
  .meta({
    id: 'SupervisionEventSequence',
    title: 'SupervisionEventSequence',
    description: 'One supervision-event sequence number: 1-based, contiguous per supervision stream.',
  });

/** One supervision event sequence number. */
export type SupervisionEventSequence = z.infer<typeof SupervisionEventSequenceSchema>;

/** The causal parent reference of a supervision event (strictly earlier in-stream). */
export const SupervisionCausalParentSchema = z
  .strictObject({
    streamId: SupervisionStreamIdSchema,
    sequence: SupervisionEventSequenceSchema,
  })
  .readonly()
  .meta({
    id: 'SupervisionCausalParent',
    title: 'SupervisionCausalParent',
    description:
      'Causal parent of a supervision event: an earlier event in the same supervision stream (the W010 shape).',
  });

/** One supervision causal parent reference. */
export type SupervisionCausalParent = z.infer<typeof SupervisionCausalParentSchema>;

/** The generic event payload of a supervision event (the W010 shape). */
export const SupervisionEventPayloadSchema = z
  .strictObject({
    discriminator: z.string().min(1).max(256),
    data: z.record(z.string().min(1).max(256), JsonValueSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'SupervisionEventPayload',
    title: 'SupervisionEventPayload',
    description:
      'Typed event payload of a supervision event: namespaced discriminator plus opaque JSON data (the W010 shape).',
  });

/** One supervision event payload. */
export type SupervisionEventPayload = z.infer<typeof SupervisionEventPayloadSchema>;

/**
 * The immutable content of one supervision event — the STRUCTURAL
 * MIRROR of W010's `EventContent`.
 */
export const SupervisionEventContentSchema = z
  .strictObject({
    schemaVersion: z.literal(SUPERVISION_EVENT_RECORD_VERSION),
    streamId: SupervisionStreamIdSchema,
    sequence: SupervisionEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: PrincipalIdSchema,
    causalParent: SupervisionCausalParentSchema.nullable(),
    payload: SupervisionEventPayloadSchema,
    occurredAt: TimestampSchema,
  })
  .readonly()
  .superRefine((event, ctx) => {
    if (
      event.causalParent !== null &&
      event.causalParent.streamId === event.streamId &&
      event.causalParent.sequence >= event.sequence
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'a same-stream causal parent must be strictly earlier (broken chain)',
        path: ['causalParent'],
      });
    }
  })
  .meta({
    id: 'SupervisionEventContent',
    title: 'SupervisionEventContent',
    description:
      'Immutable content of one supervision lifecycle event (the W010 event shape): stream, sequence, tenant scope, principal actor, causal parent, namespaced payload, and the producer-supplied occurrence instant.',
  });

/** One supervision event content. */
export type SupervisionEventContent = z.infer<typeof SupervisionEventContentSchema>;

/** The SEALED supervision event record: content plus its SHA-256 digest. */
export const SealedSupervisionEventSchema = z
  .strictObject({
    schemaVersion: z.literal(SUPERVISION_EVENT_RECORD_VERSION),
    streamId: SupervisionStreamIdSchema,
    sequence: SupervisionEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: PrincipalIdSchema,
    causalParent: SupervisionCausalParentSchema.nullable(),
    payload: SupervisionEventPayloadSchema,
    occurredAt: TimestampSchema,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedSupervisionEvent',
    title: 'SealedSupervisionEvent',
    description:
      'Published supervision event record: immutable W010-shaped content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed supervision event. */
export type SealedSupervisionEvent = z.infer<typeof SealedSupervisionEventSchema>;

// --------------------------------------------------------------------------------
// The typed payload data of every supervision:* event kind.
// --------------------------------------------------------------------------------

/** Payload data of `supervision:program-registered`. */
export const ProgramRegisteredDataSchema = z
  .strictObject({
    programId: ProgramIdSchema,
    programDigest: Sha256HexSchema,
    registeredAt: TimestampSchema,
  })
  .readonly();
export type ProgramRegisteredData = z.infer<typeof ProgramRegisteredDataSchema>;

/** Payload data of `supervision:delivery-registered`. */
export const DeliveryRegisteredDataSchema = z
  .strictObject({
    deliveryId: DeliveryIdSchema,
    deliveryDigest: Sha256HexSchema,
    programId: ProgramIdSchema,
    registeredAt: TimestampSchema,
  })
  .readonly();
export type DeliveryRegisteredData = z.infer<typeof DeliveryRegisteredDataSchema>;

/** Payload data of `supervision:policy-registered` (the alerts-kernel policy, referenced by digest). */
export const PolicyRegisteredDataSchema = z
  .strictObject({
    policyId: z.string().min(1).max(128),
    policyDigest: Sha256HexSchema,
    policyVersion: z.string().min(1).max(32),
    registeredAt: TimestampSchema,
  })
  .readonly();
export type PolicyRegisteredData = z.infer<typeof PolicyRegisteredDataSchema>;

/** Payload data of `supervision:pass-evaluated`. */
export const PassEvaluatedDataSchema = z
  .strictObject({
    passId: z.string().regex(/^pass:[a-z0-9][a-z0-9-]{0,62}$/),
    passDigest: Sha256HexSchema,
    programId: ProgramIdSchema,
    deliveryId: DeliveryIdSchema,
    findingCount: z.number().int().min(0),
    evaluatedAt: TimestampSchema,
  })
  .readonly();
export type PassEvaluatedData = z.infer<typeof PassEvaluatedDataSchema>;

/** Payload data of `supervision:finding-produced`. */
export const FindingProducedDataSchema = z
  .strictObject({
    findingId: z.string().regex(/^finding:[a-z0-9][a-z0-9-]{0,62}$/),
    findingDigest: Sha256HexSchema,
    findingClass: z.enum(FINDING_CLASSES),
    findingStatus: z.enum(['due', 'drifted', 'late', 'blocked']),
    subjectKind: z.enum(FINDING_SUBJECT_KINDS),
    subjectId: z.string().min(1).max(256),
    passId: z.string().regex(/^pass:[a-z0-9][a-z0-9-]{0,62}$/),
  })
  .readonly();
export type FindingProducedData = z.infer<typeof FindingProducedDataSchema>;

/** Payload data of `supervision:alert-raised`. */
export const AlertRaisedDataSchema = z
  .strictObject({
    alertId: z.string().regex(/^alert:[a-z0-9][a-z0-9-]{0,62}$/),
    alertDigest: Sha256HexSchema,
    revision: z.number().int().min(1),
    findingId: z.string().regex(/^finding:[a-z0-9][a-z0-9-]{0,62}$/),
    findingDigest: Sha256HexSchema,
    severity: z.string().min(1).max(32),
    raisedAt: TimestampSchema,
  })
  .readonly();
export type AlertRaisedData = z.infer<typeof AlertRaisedDataSchema>;

/** Payload data of `supervision:alert-revised`. */
export const AlertRevisedDataSchema = z
  .strictObject({
    alertId: z.string().regex(/^alert:[a-z0-9][a-z0-9-]{0,62}$/),
    alertDigest: Sha256HexSchema,
    revision: z.number().int().min(2),
    previousRevisionDigest: Sha256HexSchema,
    findingId: z.string().regex(/^finding:[a-z0-9][a-z0-9-]{0,62}$/),
    findingStatus: z.enum(['due', 'drifted', 'late', 'blocked']),
    severity: z.string().min(1).max(32),
    revisedAt: TimestampSchema,
  })
  .readonly();
export type AlertRevisedData = z.infer<typeof AlertRevisedDataSchema>;

/** Payload data of `supervision:alert-escalated`. */
export const AlertEscalatedDataSchema = z
  .strictObject({
    alertId: z.string().regex(/^alert:[a-z0-9][a-z0-9-]{0,62}$/),
    alertDigest: Sha256HexSchema,
    revision: z.number().int().min(1),
    escalationLevel: z.number().int().min(1),
    outcomeKind: z.string().min(1).max(32),
    proposalDigest: Sha256HexSchema,
    escalatedAt: TimestampSchema,
  })
  .readonly();
export type AlertEscalatedData = z.infer<typeof AlertEscalatedDataSchema>;

/** Payload data of `supervision:alert-resolved`. */
export const AlertResolvedDataSchema = z
  .strictObject({
    alertId: z.string().regex(/^alert:[a-z0-9][a-z0-9-]{0,62}$/),
    alertDigest: Sha256HexSchema,
    revision: z.number().int().min(2),
    resolutionKind: z.string().min(1).max(32),
    resolvedAt: TimestampSchema,
  })
  .readonly();
export type AlertResolvedData = z.infer<typeof AlertResolvedDataSchema>;

/** Payload data of `supervision:notification-dispatched`. */
export const NotificationDispatchedDataSchema = z
  .strictObject({
    notificationId: z.string().regex(/^notification:[a-z0-9][a-z0-9-]{0,62}$/),
    notificationDigest: Sha256HexSchema,
    alertId: z.string().regex(/^alert:[a-z0-9][a-z0-9-]{0,62}$/),
    channelKind: z.string().min(1).max(32),
    targetCount: z.number().int().min(0),
    duplicate: z.boolean(),
    dispatchedAt: TimestampSchema,
  })
  .readonly();
export type NotificationDispatchedData = z.infer<typeof NotificationDispatchedDataSchema>;

/** Payload data of `supervision:projection-updated`. */
export const ProjectionUpdatedDataSchema = z
  .strictObject({
    programId: ProgramIdSchema,
    deliveryId: DeliveryIdSchema,
    passId: z.string().regex(/^pass:[a-z0-9][a-z0-9-]{0,62}$/),
    findingCount: z.number().int().min(0),
    alertCount: z.number().int().min(0),
    projectedAt: TimestampSchema,
  })
  .readonly();
export type ProjectionUpdatedData = z.infer<typeof ProjectionUpdatedDataSchema>;

/**
 * The typed payload-data schema for every `supervision:*` event kind
 * (the W010 payload-family discipline, applied to the whole vocabulary).
 */
export const SUPERVISION_EVENT_DATA_SCHEMAS: Readonly<
  Record<SupervisionEventDiscriminator, z.ZodType>
> = {
  'supervision:program-registered': ProgramRegisteredDataSchema,
  'supervision:delivery-registered': DeliveryRegisteredDataSchema,
  'supervision:policy-registered': PolicyRegisteredDataSchema,
  'supervision:pass-evaluated': PassEvaluatedDataSchema,
  'supervision:finding-produced': FindingProducedDataSchema,
  'supervision:alert-raised': AlertRaisedDataSchema,
  'supervision:alert-revised': AlertRevisedDataSchema,
  'supervision:alert-escalated': AlertEscalatedDataSchema,
  'supervision:alert-resolved': AlertResolvedDataSchema,
  'supervision:notification-dispatched': NotificationDispatchedDataSchema,
  'supervision:projection-updated': ProjectionUpdatedDataSchema,
};

/** Compute the content digest of a supervision event (identical to W010's computeEventDigest). */
export function computeSupervisionEventDigest(event: SupervisionEventContent): Sha256Hex {
  return canonicalDigest(event as unknown as JsonValue);
}

/** Seal valid supervision-event content into its published record. */
export function sealSupervisionEvent(event: unknown): SupervisionResult<SealedSupervisionEvent> {
  const parsed = SupervisionEventContentSchema.safeParse(event);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const content = parsed.data;
  const payloadSchema = SUPERVISION_EVENT_DATA_SCHEMAS[content.payload.discriminator as SupervisionEventDiscriminator];
  if (payloadSchema !== undefined) {
    const payload = payloadSchema.safeParse(content.payload.data);
    if (!payload.success) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `the payload data does not satisfy the "${content.payload.discriminator}" payload contract`,
          issues: payload.error.issues.map((issue) => ({
            path: `payload.data.${issue.path.map(String).join('.')}`,
            message: issue.message,
          })),
        },
      };
    }
  }
  return {
    ok: true,
    value: { ...content, contentDigest: canonicalDigest(content as unknown as JsonValue) },
  };
}

/**
 * Verify a sealed supervision event: schema + payload-family validation
 * plus digest recomputation (tamper detection).
 */
export function verifySealedSupervisionEvent(sealed: unknown): SupervisionResult<SealedSupervisionEvent> {
  const parsed = SealedSupervisionEventSchema.safeParse(sealed);
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
        message: 'sealed supervision event digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
        subject: `${parsed.data.streamId}#${parsed.data.sequence}`,
      },
    };
  }
  return sealSupervisionEvent(content);
}

/**
 * Parse (validate) the typed payload data of one supervision event
 * discriminator (the W010 payload-family discipline).
 */
export function parseSupervisionEventData(
  discriminator: string,
  data: unknown,
): SupervisionResult<Record<string, JsonValue>> {
  const schema = SUPERVISION_EVENT_DATA_SCHEMAS[discriminator as SupervisionEventDiscriminator];
  if (schema === undefined) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `"${discriminator}" is not a supervision:* payload discriminator`,
        issues: [{ path: 'discriminator', message: 'unknown supervision event discriminator' }],
      },
    };
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error as never) };
  }
  return { ok: true, value: parsed.data as Record<string, JsonValue> };
}
