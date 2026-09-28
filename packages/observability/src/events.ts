/**
 * The security lifecycle event vocabulary over the W010 event shapes
 * (the W030 observability backbone): `SecurityEventContent` is a
 * STRUCTURAL MIRROR of @epoch/event-log's `EventContent` (stream,
 * 1-based sequence, tenant scope, principal actor, causal parent,
 * namespaced payload, producer-supplied instant). One observed
 * subject's security events form ONE stream
 * (`stream:security-<suffix>`, derived deterministically by
 * `securityStreamIdOf`); tenant-level host steps (policy
 * registration, audit passes) use `stream:security-host-<suffix>`;
 * events are FACTS — there is no mutation API.
 *
 * - The security payload family is the open-namespace `security:*`
 *   discriminator set with TYPED data payloads for every kind
 *   (`SECURITY_EVENT_DATA_SCHEMAS`); `parseSecurityEventData` is the
 *   W010 payload-family discipline applied to the whole vocabulary.
 * - Cross-kernel vocabulary (W008 violation codes, W009 denial
 *   codes, audit finding codes) rides as BOUNDED NEUTRAL STRINGS —
 *   cross-kernel vocabularies never re-declare a sibling authority.
 * - Compatibility is pinned WITHOUT a runtime dependency: compile
 *   time via `src/kernel-parity.ts` (type equality with
 *   `EventContent`), runtime via `test/parity.test.ts` (the same
 *   fixtures seal through the REAL W010 sealEvent and digest
 *   identically through the REAL computeEventDigest).
 */
import { z } from 'zod';
import { canonicalDigest, JsonValueSchema, TimestampSchema } from '@epoch/agent-protocol';
import type { JsonValue, Sha256Hex } from '@epoch/agent-protocol';
import { fail, hasUnrecognizedKeys, validationError } from './issues';
import type { ObservabilityError, ObservabilityResult } from './errors';
import { PrincipalIdSchema, SecurityStreamIdSchema, TenantIdSchema } from './primitives';
import {
  OBSERVABILITY_EVENT_RECORD_VERSION,
  SECURITY_EVENT_DISCRIMINATORS,
} from './version';
import type { SecurityEventDiscriminator } from './version';

// --------------------------------------------------------------------------------
// The W010 structural mirror.
// --------------------------------------------------------------------------------

/** One security event sequence number (1-based, contiguous per stream). */
export const SecurityEventSequenceSchema = z
  .number()
  .int('sequence numbers are integers')
  .min(1, 'sequence numbers start at 1')
  .max(Number.MAX_SAFE_INTEGER, 'sequence numbers are safe integers')
  .meta({
    id: 'SecurityEventSequence',
    title: 'SecurityEventSequence',
    description: 'One security-event sequence number: 1-based, contiguous per security stream.',
  });

/** One security event sequence number. */
export type SecurityEventSequence = z.infer<typeof SecurityEventSequenceSchema>;

/** The causal parent reference of a security event (an earlier event; cross-stream allowed). */
export const SecurityCausalParentSchema = z
  .strictObject({
    streamId: z.string().min(3).max(128),
    sequence: SecurityEventSequenceSchema,
  })
  .readonly()
  .meta({
    id: 'SecurityCausalParent',
    title: 'SecurityCausalParent',
    description:
      'Causal parent of a security event: a logged event in any stream (the W010 shape; same-stream parents must be strictly earlier).',
  });

/** One security causal parent reference. */
export type SecurityCausalParent = z.infer<typeof SecurityCausalParentSchema>;

/** The generic event payload of a security event (the W010 shape). */
export const SecurityEventPayloadSchema = z
  .strictObject({
    discriminator: z.string().min(1).max(256),
    data: z.record(z.string().min(1).max(256), JsonValueSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'SecurityEventPayload',
    title: 'SecurityEventPayload',
    description:
      'Typed event payload of a security event: namespaced discriminator plus opaque JSON data (the W010 shape).',
  });

/** One security event payload. */
export type SecurityEventPayload = z.infer<typeof SecurityEventPayloadSchema>;

/**
 * The immutable content of one security event — the STRUCTURAL
 * MIRROR of W010's `EventContent`.
 *
 * The OBJECT schema carries the fields + the same-stream causal
 * refinement; the published content schema is its readonly
 * projection; the sealed envelope spreads the SAME object shape plus
 * the digest (the W024 entitlements convention).
 */
const SecurityEventObjectSchema = z
  .strictObject({
    schemaVersion: z.literal(OBSERVABILITY_EVENT_RECORD_VERSION),
    streamId: SecurityStreamIdSchema,
    sequence: SecurityEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: PrincipalIdSchema,
    causalParent: SecurityCausalParentSchema.nullable(),
    payload: SecurityEventPayloadSchema,
    occurredAt: TimestampSchema,
  })
  .superRefine((value, ctx) => {
    if (
      value.causalParent !== null &&
      value.causalParent.streamId === value.streamId &&
      value.causalParent.sequence >= value.sequence
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'a same-stream causal parent must be strictly earlier (broken chain)',
        path: ['causalParent'],
      });
    }
  });

/** The published security-event content schema (readonly). */
export const SecurityEventContentSchema = SecurityEventObjectSchema.readonly().meta({
  id: 'SecurityEventContent',
  title: 'SecurityEventContent',
  description:
    'Immutable content of one security lifecycle event (the W010 event shape): stream, sequence, tenant scope, principal actor, causal parent, namespaced payload, producer-supplied instant.',
});

/** One security event content. */
export type SecurityEventContent = z.infer<typeof SecurityEventContentSchema>;

/** The SEALED security event record: content plus its SHA-256 digest. */
export const SealedSecurityEventSchema = z
  .strictObject({
    ...SecurityEventObjectSchema.shape,
    contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .readonly()
  .meta({
    id: 'SealedSecurityEvent',
    title: 'SealedSecurityEvent',
    description:
      'Published security event record: immutable W010-shaped content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed security event. */
export type SealedSecurityEvent = z.infer<typeof SealedSecurityEventSchema>;

// --------------------------------------------------------------------------------
// The typed payload data of every event kind.
// --------------------------------------------------------------------------------

/** Payload data of `security:policy-registered`. */
export const PolicyRegisteredDataSchema = z
  .strictObject({
    policyId: z.string().regex(/^security-policy:[a-z0-9][a-z0-9-]{0,49}$/),
    policyDigest: z.string().regex(/^[0-9a-f]{64}$/),
    revision: z.string().regex(/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/),
    status: z.enum(['active', 'retired']),
    registeredAt: TimestampSchema,
  })
  .readonly();
export type PolicyRegisteredData = z.infer<typeof PolicyRegisteredDataSchema>;

/** Payload data of `security:observation-recorded`. */
export const ObservationRecordedDataSchema = z
  .strictObject({
    observationId: z.string().regex(/^observation:[a-z0-9][a-z0-9-]{0,62}$/),
    observationDigest: z.string().regex(/^[0-9a-f]{64}$/),
    observationClass: z.string().min(1).max(64),
    subjectId: z.string().min(3).max(128),
    outcome: z.enum(['observed', 'allowed', 'denied', 'violated']),
    observedAt: TimestampSchema,
  })
  .readonly();
export type ObservationRecordedData = z.infer<typeof ObservationRecordedDataSchema>;

/** Payload data of `security:violation-detected`. */
export const ViolationDetectedDataSchema = z
  .strictObject({
    observationId: z.string().regex(/^observation:[a-z0-9][a-z0-9-]{0,62}$/),
    observationDigest: z.string().regex(/^[0-9a-f]{64}$/),
    violationCode: z.string().min(3).max(128),
    subjectId: z.string().min(3).max(128),
    detectedAt: TimestampSchema,
  })
  .readonly();
export type ViolationDetectedData = z.infer<typeof ViolationDetectedDataSchema>;

/** Payload data of `security:quarantine-imposed`. */
export const QuarantineImposedDataSchema = z
  .strictObject({
    quarantineId: z.string().regex(/^quarantine:[a-z0-9][a-z0-9-]{0,56}$/),
    subjectId: z.string().min(3).max(128),
    reason: z.string().min(1).max(2000),
    imposedAt: TimestampSchema,
  })
  .readonly();
export type QuarantineImposedData = z.infer<typeof QuarantineImposedDataSchema>;

/** Payload data of `security:quarantine-released`. */
export const QuarantineReleasedDataSchema = z
  .strictObject({
    quarantineId: z.string().regex(/^quarantine:[a-z0-9][a-z0-9-]{0,56}$/),
    subjectId: z.string().min(3).max(128),
    reason: z.string().min(1).max(2000),
    releasedAt: TimestampSchema,
  })
  .readonly();
export type QuarantineReleasedData = z.infer<typeof QuarantineReleasedDataSchema>;

/** Payload data of `security:health-projected`. */
export const HealthProjectedDataSchema = z
  .strictObject({
    status: z.enum(['healthy', 'degraded', 'critical']),
    criticalViolations: z.number().int().min(0),
    violationsTotal: z.number().int().min(0),
    quarantinedSubjects: z.number().int().min(0),
    projectedAt: TimestampSchema,
  })
  .readonly();
export type HealthProjectedData = z.infer<typeof HealthProjectedDataSchema>;

/** Payload data of `security:audit-recorded`. */
export const AuditRecordedDataSchema = z
  .strictObject({
    findingCode: z.string().min(3).max(128),
    findingSubject: z.string().min(1).max(256),
    findingCount: z.number().int().min(1),
    auditedAt: TimestampSchema,
  })
  .readonly();
export type AuditRecordedData = z.infer<typeof AuditRecordedDataSchema>;

/**
 * The typed payload-data schema for every `security:*` event kind
 * (the W010 payload-family discipline, applied to the whole
 * vocabulary).
 */
export const SECURITY_EVENT_DATA_SCHEMAS: Readonly<
  Record<SecurityEventDiscriminator, z.ZodType>
> = {
  'security:policy-registered': PolicyRegisteredDataSchema,
  'security:observation-recorded': ObservationRecordedDataSchema,
  'security:violation-detected': ViolationDetectedDataSchema,
  'security:quarantine-imposed': QuarantineImposedDataSchema,
  'security:quarantine-released': QuarantineReleasedDataSchema,
  'security:health-projected': HealthProjectedDataSchema,
  'security:audit-recorded': AuditRecordedDataSchema,
};

/** Compute the content digest of one security event (identical to W010's computeEventDigest). */
export function computeSecurityEventDigest(event: SecurityEventContent): Sha256Hex {
  return canonicalDigest(event as unknown as JsonValue);
}

/** Seal valid security event content into its published record. Total. */
export function sealSecurityEvent(event: unknown): ObservabilityResult<SealedSecurityEvent> {
  const parsed = SecurityEventContentSchema.safeParse(event);
  if (!parsed.success) {
    return fail(securityEventParseError(parsed.error));
  }
  const content = parsed.data;
  const payloadSchema =
    SECURITY_EVENT_DATA_SCHEMAS[content.payload.discriminator as SecurityEventDiscriminator];
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
 * Verify a sealed security event: schema + payload-family validation
 * plus digest recomputation (tamper detection). Total.
 */
export function verifySealedSecurityEvent(sealed: unknown): ObservabilityResult<SealedSecurityEvent> {
  const parsed = SealedSecurityEventSchema.safeParse(sealed);
  if (!parsed.success) {
    return fail(securityEventParseError(parsed.error));
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'sealed security event digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
        subject: `${parsed.data.streamId}#${parsed.data.sequence}`,
      },
    };
  }
  return sealSecurityEvent(content);
}

/**
 * Parse (validate) the typed payload data of one event discriminator
 * (the W010 payload-family discipline).
 */
export function parseSecurityEventData(
  discriminator: string,
  data: unknown,
): ObservabilityResult<Record<string, JsonValue>> {
  const schema = SECURITY_EVENT_DATA_SCHEMAS[discriminator as SecurityEventDiscriminator];
  if (schema === undefined) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `"${discriminator}" is not a security:* payload discriminator`,
        issues: [{ path: 'discriminator', message: 'unknown security event discriminator' }],
      },
    };
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `the payload data does not satisfy the "${discriminator}" payload contract`,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  return { ok: true, value: parsed.data as Record<string, JsonValue> };
}

/** Whether one discriminator belongs to the closed vocabulary. */
export function isSecurityEventDiscriminator(value: string): value is SecurityEventDiscriminator {
  return (SECURITY_EVENT_DISCRIMINATORS as readonly string[]).includes(value);
}

/** Map a zod failure of the event schemas onto the typed taxonomy. */
function securityEventParseError(error: z.ZodError): ObservabilityError {
  if (hasUnrecognizedKeys(error)) {
    return {
      code: 'vendor-fields-rejected',
      message:
        'the security event carries unrecognized keys — security events are strict; vendor/provider fields are rejected (lock rule 13)',
      issues: error.issues.map((issue) => ({
        path: issue.path.map(String).join('.') || '$',
        message: issue.message,
      })),
    };
  }
  return validationError(error);
}
