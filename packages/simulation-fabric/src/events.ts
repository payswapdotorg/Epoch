/**
 * The simulation lifecycle event vocabulary over the W010 event shapes (the
 * W021 pin, the W036 `delivery:*` precedent).
 *
 * - `SimulationEventContent` is a STRUCTURAL MIRROR of @epoch/event-log's
 *   `EventContent` (stream, 1-based sequence, tenant scope, principal
 *   actor, causal parent, namespaced payload, producer-supplied instant).
 *   One run's lifecycle events form ONE stream
 *   (`stream:simulation-<suffix>`, derived deterministically by
 *   `simulationStreamIdOf`); events are FACTS — there is no mutation API.
 * - The simulation payload family is the open-namespace `simulation:*`
 *   discriminator set (src/version.ts) with TYPED data payloads for every
 *   kind (`SIMULATION_EVENT_DATA_SCHEMAS`); `parseSimulationEventData` is
 *   the W010 payload-family discipline applied to the whole vocabulary.
 * - Compatibility is pinned WITHOUT a runtime dependency: compile time via
 *   `src/kernel-parity.ts` (type equality with `EventContent`), runtime
 *   via the parity tests (fabric events are admitted by the REAL W010
 *   `sealEvent`, digest identically to `computeEventDigest`, and append
 *   into a REAL `EventLog`).
 */
import { z } from 'zod';
import { canonicalDigest, JsonValueSchema, TimestampSchema } from '@epoch/agent-protocol';
import type { JsonValue, Sha256Hex } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  SimulationFailureCodeSchema,
} from '@epoch/simulation-protocol';
import {
  SIMULATION_EVENT_DISCRIMINATORS,
  SIMULATION_EVENT_RECORD_VERSION,
  SIMULATION_PRINCIPAL_ID_PATTERN,
  SIMULATION_STREAM_ID_PATTERN,
  type SimulationEventDiscriminator,
} from './version';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { FabricResult } from './errors';

/** Lowercase hex SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** One simulation event sequence number (1-based, contiguous per stream). */
export const SimulationEventSequenceSchema = z
  .number()
  .int('sequence numbers are integers')
  .min(1, 'sequence numbers start at 1')
  .max(Number.MAX_SAFE_INTEGER, 'sequence numbers are safe integers')
  .meta({
    id: 'SimulationEventSequence',
    title: 'SimulationEventSequence',
    description: 'One simulation-event sequence number: 1-based, contiguous per simulation stream.',
  });

/** One simulation event sequence number. */
export type SimulationEventSequence = z.infer<typeof SimulationEventSequenceSchema>;

/** The causal parent reference of a simulation event (the W010 shape). */
export const SimulationCausalParentSchema = z
  .strictObject({
    streamId: z.string().regex(SIMULATION_STREAM_ID_PATTERN),
    sequence: SimulationEventSequenceSchema,
  })
  .readonly()
  .meta({
    id: 'SimulationCausalParent',
    title: 'SimulationCausalParent',
    description:
      'Causal parent of a simulation event: an earlier event in the same simulation stream (the W010 shape).',
  });

/** One simulation causal parent reference. */
export type SimulationCausalParent = z.infer<typeof SimulationCausalParentSchema>;

/** The generic event payload of a simulation event (the W010 shape). */
export const SimulationEventPayloadSchema = z
  .strictObject({
    discriminator: z.string().min(1).max(256),
    data: z.record(z.string().min(1).max(256), JsonValueSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'SimulationEventPayload',
    title: 'SimulationEventPayload',
    description:
      'Typed event payload of a simulation event: namespaced discriminator plus opaque JSON data (the W010 shape).',
  });

/** One simulation event payload. */
export type SimulationEventPayload = z.infer<typeof SimulationEventPayloadSchema>;

/**
 * The immutable content of one simulation event — the STRUCTURAL MIRROR of
 * W010's `EventContent` (pinned type-equal by src/kernel-parity.ts).
 */
export const SimulationEventContentSchema = z
  .strictObject({
    schemaVersion: z.literal(SIMULATION_EVENT_RECORD_VERSION),
    streamId: z.string().regex(SIMULATION_STREAM_ID_PATTERN),
    sequence: SimulationEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: z.string().regex(SIMULATION_PRINCIPAL_ID_PATTERN),
    causalParent: SimulationCausalParentSchema.nullable(),
    payload: SimulationEventPayloadSchema,
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
    id: 'SimulationEventContent',
    title: 'SimulationEventContent',
    description:
      'Immutable content of one simulation lifecycle event (the W010 event shape): stream, sequence, tenant scope, principal actor, causal parent, namespaced payload, and the producer-supplied occurrence instant.',
  });

/** One simulation event content. */
export type SimulationEventContent = z.infer<typeof SimulationEventContentSchema>;

/**
 * The SEALED simulation event record: content plus its SHA-256 digest over
 * the canonical JSON of the content (the exact-revision content address —
 * identical to W010's digest for the same content, pinned by the runtime
 * parity tests).
 */
export const SealedSimulationEventSchema = z
  .strictObject({
    schemaVersion: z.literal(SIMULATION_EVENT_RECORD_VERSION),
    streamId: z.string().regex(SIMULATION_STREAM_ID_PATTERN),
    sequence: SimulationEventSequenceSchema,
    tenantId: TenantIdSchema,
    actor: z.string().regex(SIMULATION_PRINCIPAL_ID_PATTERN),
    causalParent: SimulationCausalParentSchema.nullable(),
    payload: SimulationEventPayloadSchema,
    occurredAt: TimestampSchema,
    contentDigest: z.string().regex(SHA256_HEX_PATTERN),
  })
  .readonly()
  .meta({
    id: 'SealedSimulationEvent',
    title: 'SealedSimulationEvent',
    description:
      'Published simulation event record: immutable W010-shaped content plus the SHA-256 of its canonical JSON (the exact-revision content address).',
  });

/** One sealed simulation event. */
export type SealedSimulationEvent = z.infer<typeof SealedSimulationEventSchema>;

// --------------------------------------------------------------------------------
// The typed payload data of every simulation:* event kind.
// --------------------------------------------------------------------------------

/** Payload data of `simulation:run-submitted`. */
export const RunSubmittedDataSchema = z
  .strictObject({
    runId: z.string().regex(/^simrun:[a-z0-9][a-z0-9-]{0,62}$/),
    runDigest: z.string().regex(SHA256_HEX_PATTERN),
    requestId: z.string().min(1).max(128),
    requestDigest: z.string().regex(SHA256_HEX_PATTERN),
    simulatorId: z.string().regex(/^simulator:[a-z0-9][a-z0-9-]{0,62}$/),
    registrationDigest: z.string().regex(SHA256_HEX_PATTERN),
    idempotencyKey: z.string().min(1).max(128),
    submittedAt: TimestampSchema,
  })
  .readonly();
export type RunSubmittedData = z.infer<typeof RunSubmittedDataSchema>;

/** Payload data of `simulation:run-scheduled`. */
export const RunScheduledDataSchema = z
  .strictObject({
    runId: z.string().regex(/^simrun:[a-z0-9][a-z0-9-]{0,62}$/),
    runDigest: z.string().regex(SHA256_HEX_PATTERN),
    scheduledAt: TimestampSchema,
  })
  .readonly();
export type RunScheduledData = z.infer<typeof RunScheduledDataSchema>;

/** Payload data of `simulation:run-started`. */
export const RunStartedDataSchema = z
  .strictObject({
    runId: z.string().regex(/^simrun:[a-z0-9][a-z0-9-]{0,62}$/),
    runDigest: z.string().regex(SHA256_HEX_PATTERN),
    startedAt: TimestampSchema,
  })
  .readonly();
export type RunStartedData = z.infer<typeof RunStartedDataSchema>;

/** Payload data of `simulation:run-completed`. */
export const RunCompletedDataSchema = z
  .strictObject({
    runId: z.string().regex(/^simrun:[a-z0-9][a-z0-9-]{0,62}$/),
    runDigest: z.string().regex(SHA256_HEX_PATTERN),
    resultDigest: z.string().regex(SHA256_HEX_PATTERN),
    /** The W005 outcome status of the ingested result (a failed prediction is still a completed execution). */
    outcomeStatus: z.enum(['completed', 'failed']),
    completedAt: TimestampSchema,
  })
  .readonly();
export type RunCompletedData = z.infer<typeof RunCompletedDataSchema>;

/** Payload data of `simulation:run-failed`. */
export const RunFailedDataSchema = z
  .strictObject({
    runId: z.string().regex(/^simrun:[a-z0-9][a-z0-9-]{0,62}$/),
    runDigest: z.string().regex(SHA256_HEX_PATTERN),
    failureCode: SimulationFailureCodeSchema,
    failedAt: TimestampSchema,
  })
  .readonly();
export type RunFailedData = z.infer<typeof RunFailedDataSchema>;

/** Payload data of `simulation:run-cancelled`. */
export const RunCancelledDataSchema = z
  .strictObject({
    runId: z.string().regex(/^simrun:[a-z0-9][a-z0-9-]{0,62}$/),
    runDigest: z.string().regex(SHA256_HEX_PATTERN),
    cancelledAt: TimestampSchema,
  })
  .readonly();
export type RunCancelledData = z.infer<typeof RunCancelledDataSchema>;

/** Payload data of `simulation:result-published`. */
export const ResultPublishedDataSchema = z
  .strictObject({
    runId: z.string().regex(/^simrun:[a-z0-9][a-z0-9-]{0,62}$/),
    runDigest: z.string().regex(SHA256_HEX_PATTERN),
    resultId: z.string().min(1).max(128),
    resultDigest: z.string().regex(SHA256_HEX_PATTERN),
    requestId: z.string().min(1).max(128),
    requestDigest: z.string().regex(SHA256_HEX_PATTERN),
    publishedAt: TimestampSchema,
  })
  .readonly();
export type ResultPublishedData = z.infer<typeof ResultPublishedDataSchema>;

/**
 * The typed payload-data schema for every `simulation:*` event kind (the
 * W010 payload-family discipline, applied to the whole simulation
 * vocabulary).
 */
export const SIMULATION_EVENT_DATA_SCHEMAS: Readonly<
  Record<SimulationEventDiscriminator, z.ZodType>
> = {
  'simulation:run-submitted': RunSubmittedDataSchema,
  'simulation:run-scheduled': RunScheduledDataSchema,
  'simulation:run-started': RunStartedDataSchema,
  'simulation:run-completed': RunCompletedDataSchema,
  'simulation:run-failed': RunFailedDataSchema,
  'simulation:run-cancelled': RunCancelledDataSchema,
  'simulation:result-published': ResultPublishedDataSchema,
};

/**
 * Compute the content digest of a simulation event: the SHA-256 of its
 * canonical JSON serialization — identical to W010's `computeEventDigest`
 * for the same content (pinned by the runtime parity test). Throws on
 * invalid content; producers validate first (`sealSimulationEvent` is the
 * total form).
 */
export function computeSimulationEventDigest(event: SimulationEventContent): Sha256Hex {
  return canonicalDigest(event as unknown as JsonValue);
}

/** Seal valid simulation-event content into its published record (total). */
export function sealSimulationEvent(event: unknown): FabricResult<SealedSimulationEvent> {
  const parsed = SimulationEventContentSchema.safeParse(event);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/**
 * Verify a sealed simulation event: schema validation + digest
 * recomputation (tamper detection — `digest-mismatch`).
 */
export function verifySealedSimulationEvent(sealed: unknown): FabricResult<SealedSimulationEvent> {
  const parsed = SealedSimulationEventSchema.safeParse(sealed);
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
        message:
          'sealed simulation event digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Parse the typed payload data of a `simulation:*` event (the W010
 * payload-family discipline): the discriminator must select a member of
 * the simulation vocabulary and the data must satisfy the typed shape.
 */
export function parseSimulationEventData(
  payload: SimulationEventPayload,
): FabricResult<Record<string, JsonValue>> {
  const schema = (SIMULATION_EVENT_DATA_SCHEMAS as Record<string, z.ZodType | undefined>)[
    payload.discriminator
  ];
  if (schema === undefined) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `payload discriminator "${payload.discriminator}" does not select a member of the simulation:* event vocabulary`,
        issues: [
          {
            path: 'discriminator',
            message: `expected one of ${SIMULATION_EVENT_DISCRIMINATORS.join(', ')}`,
          },
        ],
      },
    };
  }
  const parsed = schema.safeParse(payload.data);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data as Record<string, JsonValue> };
}
