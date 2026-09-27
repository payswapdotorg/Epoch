/**
 * The access-projection lifecycle event vocabulary over the W010 event
 * shapes (the W041 dispatch pin: "every step emits
 * `access-projection:*` events (W010-shaped) sealed by the kernel").
 *
 * - `AccessProjectionEventContent` is a STRUCTURAL MIRROR of
 *   @epoch/event-log's `EventContent` (stream, 1-based sequence, tenant
 *   scope, principal actor, causal parent, namespaced payload,
 *   producer-supplied instant). One object's projection lifecycle forms
 *   ONE stream (`stream:access-<slug>`, derived deterministically by
 *   `accessStreamIdOf`); one policy's registration forms its own stream;
 *   one tenant's state projections form the tenant state stream; events
 *   are FACTS — there is no mutation API.
 * - The payload family is the open-namespace `access-projection:*`
 *   discriminator set with TYPED data payloads for every kind
 *   (`ACCESS_PROJECTION_EVENT_DATA_SCHEMAS`);
 *   `parseAccessProjectionEventData` is the W010 payload-family
 *   discipline applied to the whole vocabulary.
 * - Compatibility is pinned WITHOUT a runtime dependency: compile time
 *   via `src/kernel-parity.ts` (type equality with `EventContent`),
 *   runtime via `test/parity.test.ts` (the same fixtures seal through
 *   the REAL W010 sealEvent and digest identically through the REAL
 *   computeEventDigest).
 */
import { z } from 'zod';
import type { JsonValue, Sha256Hex } from '@epoch/agent-protocol';
import { JsonValueSchema } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/solution-delivery';
import {
  AccessPrincipalIdSchema,
  AccessStreamIdSchema,
  Sha256HexSchema,
  TimestampSchema,
  canonicalDigest,
} from './primitives';
import {
  ACCESS_PROJECTION_EVENT_DISCRIMINATORS,
  ACCESS_PROJECTION_EVENT_RECORD_VERSION,
  type AccessProjectionEventDiscriminator,
} from './version';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { AccessProjectionResult } from './errors';

/** One access-projection event sequence number (1-based, contiguous per stream). */
export const AccessProjectionEventSequenceSchema = z
  .number()
  .int('sequence numbers are integers')
  .min(1, 'sequence numbers start at 1')
  .max(Number.MAX_SAFE_INTEGER, 'sequence numbers are safe integers')
  .meta({
    id: 'AccessProjectionEventSequence',
    title: 'AccessProjectionEventSequence',
    description:
      'One access-projection event sequence number: 1-based, contiguous per access-projection stream.',
  });

/** One access-projection event sequence number. */
export type AccessProjectionEventSequence = z.infer<typeof AccessProjectionEventSequenceSchema>;

/** The causal parent reference of an access-projection event (strictly earlier in-stream). */
export const AccessProjectionCausalParentSchema = z
  .strictObject({
    streamId: AccessStreamIdSchema,
    sequence: AccessProjectionEventSequenceSchema,
  })
  .readonly()
  .meta({
    id: 'AccessProjectionCausalParent',
    title: 'AccessProjectionCausalParent',
    description:
      'Causal parent of an access-projection event: an earlier event in the same stream (the W010 shape).',
  });

/** One access-projection causal parent reference. */
export type AccessProjectionCausalParent = z.infer<typeof AccessProjectionCausalParentSchema>;

/** The generic event payload of an access-projection event (the W010 shape). */
export const AccessProjectionEventPayloadSchema = z
  .strictObject({
    discriminator: z.string().min(1).max(256),
    data: z.record(z.string().min(1).max(256), JsonValueSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'AccessProjectionEventPayload',
    title: 'AccessProjectionEventPayload',
    description:
      'Typed event payload of an access-projection event: namespaced discriminator plus opaque JSON data (the W010 shape).',
  });

/** One access-projection event payload. */
export type AccessProjectionEventPayload = z.infer<typeof AccessProjectionEventPayloadSchema>;

/**
 * The immutable content of one access-projection event — the STRUCTURAL
 * MIRROR of W010's `EventContent`.
 */
export const AccessProjectionEventContentSchema = z
  .strictObject({
    schemaVersion: z.literal(ACCESS_PROJECTION_EVENT_RECORD_VERSION),
    streamId: AccessStreamIdSchema,
    sequence: AccessProjectionEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: AccessPrincipalIdSchema,
    causalParent: AccessProjectionCausalParentSchema.nullable(),
    payload: AccessProjectionEventPayloadSchema,
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
        message: 'a same-stream causal parent must be strictly earlier',
        path: ['causalParent'],
      });
    }
  })
  .meta({
    id: 'AccessProjectionEventContent',
    title: 'AccessProjectionEventContent',
    description:
      'Immutable content of one access-projection lifecycle event (the W010 event shape): stream, sequence, tenant scope, principal actor, causal parent, namespaced payload, and the producer-supplied occurrence instant.',
  });

/** One access-projection event content. */
export type AccessProjectionEventContent = z.infer<typeof AccessProjectionEventContentSchema>;

/**
 * The SEALED access-projection event record: content plus its SHA-256
 * digest over the canonical JSON of the content.
 */
export const SealedAccessProjectionEventSchema = z
  .strictObject({
    schemaVersion: z.literal(ACCESS_PROJECTION_EVENT_RECORD_VERSION),
    streamId: AccessStreamIdSchema,
    sequence: AccessProjectionEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: AccessPrincipalIdSchema,
    causalParent: AccessProjectionCausalParentSchema.nullable(),
    payload: AccessProjectionEventPayloadSchema,
    occurredAt: TimestampSchema,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedAccessProjectionEvent',
    title: 'SealedAccessProjectionEvent',
    description:
      'Published access-projection event record: immutable W010-shaped content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed access-projection event. */
export type SealedAccessProjectionEvent = z.infer<typeof SealedAccessProjectionEventSchema>;

// --------------------------------------------------------------------------------
// The typed payload data of every access-projection:* event kind.
// --------------------------------------------------------------------------------

/** Payload data of `access-projection:policy-registered`. */
export const PolicyRegisteredDataSchema = z
  .strictObject({
    policyId: z.string().regex(/^policy:[a-z0-9][a-z0-9-]{0,62}$/),
    revision: z.number().int().min(1),
    policyDigest: Sha256HexSchema,
    status: z.enum(['active', 'retired']),
    bindingCount: z.number().int().min(1),
  })
  .readonly();
export type PolicyRegisteredData = z.infer<typeof PolicyRegisteredDataSchema>;

/** Payload data of `access-projection:record-admitted`. */
export const RecordAdmittedDataSchema = z
  .strictObject({
    objectClass: z.string().min(1).max(64),
    objectId: z.string().min(1).max(256),
    objectDigest: Sha256HexSchema,
  })
  .readonly();
export type RecordAdmittedData = z.infer<typeof RecordAdmittedDataSchema>;

/** Payload data of `access-projection:projection-released`. */
export const ProjectionReleasedDataSchema = z
  .strictObject({
    objectClass: z.string().min(1).max(64),
    objectId: z.string().min(1).max(256),
    objectDigest: Sha256HexSchema,
    principalId: z.string().regex(/^principal:[a-z0-9][a-z0-9-]{0,62}$/),
    action: z.enum(['view', 'export', 'share']),
    policyDigest: Sha256HexSchema,
    projectionDigest: Sha256HexSchema,
    auditDigest: Sha256HexSchema,
    releasedFieldCount: z.number().int().min(0),
    redactedFieldCount: z.number().int().min(0),
  })
  .readonly();
export type ProjectionReleasedData = z.infer<typeof ProjectionReleasedDataSchema>;

/** Payload data of `access-projection:projection-denied`. */
export const ProjectionDeniedDataSchema = z
  .strictObject({
    objectClass: z.string().min(1).max(64),
    objectId: z.string().min(1).max(256),
    objectDigest: Sha256HexSchema,
    principalId: z.string().regex(/^principal:[a-z0-9][a-z0-9-]{0,62}$/),
    action: z.enum(['view', 'export', 'share']),
    policyDigest: Sha256HexSchema,
    auditDigest: Sha256HexSchema,
    denialCode: z.string().min(1).max(64),
  })
  .readonly();
export type ProjectionDeniedData = z.infer<typeof ProjectionDeniedDataSchema>;

/** Payload data of `access-projection:audit-recorded`. */
export const AuditRecordedDataSchema = z
  .strictObject({
    auditId: z.string().regex(/^audit:[0-9a-f]{16}$/),
    evaluationKey: Sha256HexSchema,
    auditDigest: Sha256HexSchema,
    outcome: z.enum(['released', 'denied']),
  })
  .readonly();
export type AuditRecordedData = z.infer<typeof AuditRecordedDataSchema>;

/** Payload data of `access-projection:state-projected`. */
export const StateProjectedDataSchema = z
  .strictObject({
    policyCount: z.number().int().min(0),
    recordCount: z.number().int().min(0),
    projectionCount: z.number().int().min(0),
    auditCount: z.number().int().min(0),
  })
  .readonly();
export type StateProjectedData = z.infer<typeof StateProjectedDataSchema>;

/** The typed data payload of one discriminator. */
export const ACCESS_PROJECTION_EVENT_DATA_SCHEMAS: Readonly<
  Record<AccessProjectionEventDiscriminator, z.ZodType>
> = {
  'access-projection:policy-registered': PolicyRegisteredDataSchema,
  'access-projection:record-admitted': RecordAdmittedDataSchema,
  'access-projection:projection-released': ProjectionReleasedDataSchema,
  'access-projection:projection-denied': ProjectionDeniedDataSchema,
  'access-projection:audit-recorded': AuditRecordedDataSchema,
  'access-projection:state-projected': StateProjectedDataSchema,
};

/**
 * Parse one event payload against the typed data schema of its
 * discriminator (the W010 payload-family discipline): unknown
 * discriminators and malformed payloads are typed errors.
 */
export function parseAccessProjectionEventData(
  discriminator: string,
  data: unknown,
): AccessProjectionResult<Record<string, JsonValue>> {
  if (
    !(ACCESS_PROJECTION_EVENT_DISCRIMINATORS as readonly string[]).includes(discriminator)
  ) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `unknown access-projection event discriminator "${discriminator}"`,
        issues: [{ path: 'discriminator', message: 'not a member of the closed vocabulary' }],
      },
    };
  }
  const schema = ACCESS_PROJECTION_EVENT_DATA_SCHEMAS[
    discriminator as AccessProjectionEventDiscriminator
  ]!;
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data as unknown as Record<string, JsonValue> };
}

// --------------------------------------------------------------------------------
// Digest discipline (seal / verify).
// --------------------------------------------------------------------------------

/** Compute the content digest of one access-projection event. */
export function computeAccessProjectionEventDigest(
  content: AccessProjectionEventContent,
): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid access-projection event content into its published record. */
export function sealAccessProjectionEvent(
  content: unknown,
): AccessProjectionResult<SealedAccessProjectionEvent> {
  const parsed = AccessProjectionEventContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: {
      ...parsed.data,
      contentDigest: computeAccessProjectionEventDigest(parsed.data),
    },
  };
}

/** Verify a sealed access-projection event: schema + recomputed digest. */
export function verifySealedAccessProjectionEvent(
  sealed: unknown,
): AccessProjectionResult<SealedAccessProjectionEvent> {
  const parsed = SealedAccessProjectionEventSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const recomputed = canonicalDigest(content as unknown as JsonValue);
  if (recomputed !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `access-projection event ${parsed.data.streamId}#${parsed.data.sequence} carries a tampered content digest`,
        expected: recomputed,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}
