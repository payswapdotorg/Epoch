/**
 * The adaptation-event vocabulary over the W010 event shapes (the
 * dispatch pin: "append-only events over the W010 shapes (event-log
 * stays a devDep: type-parity, never a runtime edge)").
 *
 * - `AdapterEventContent` is a STRUCTURAL MIRROR of @epoch/event-log's
 *   `EventContent` (stream, 1-based sequence, tenant scope, principal
 *   actor, causal parent, namespaced payload, producer-supplied instant).
 *   Adaptation decisions become FACTS: one renderer session's decisions
 *   form ONE stream (`stream:renderer-adapter-<suffix>`, derived
 *   deterministically by {@link adapterStreamIdOf}); events are
 *   append-only — there is no mutation API.
 * - The adaptation payload family is the open-namespace
 *   `renderer-adapter:*` discriminator set (src/version.ts) with TYPED
 *   data payloads for every kind; `parseAdapterEventData` applies the
 *   W010 payload-family discipline to the whole vocabulary.
 * - Compatibility is pinned WITHOUT a runtime dependency: compile time
 *   via `src/kernel-parity.ts` (type equality with `EventContent`),
 *   runtime via `test/parity.test.ts` (the same fixtures validate
 *   through the REAL W010 seal path; mirrored grammars are
 *   pattern-identical).
 */
import { z } from 'zod';
import { canonicalDigest, JsonValueSchema, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  ADAPTER_EVENT_RECORD_VERSION,
  ADAPTER_EVENT_NAMESPACE,
  type AdapterEventDiscriminator,
} from './version';
import {
  AdapterStreamIdSchema,
  AdapterActorSchema,
  AdapterTenantIdSchema,
  AdapterTimestampSchema,
  Sha256HexSchema,
} from './primitives';
import { SelectionIdSchema, MountPlanIdSchema } from './primitives';
import { RendererTechniqueSchema, SelectionReasonSchema } from './version';
import type { RendererAdaptersResult } from './errors';

// ---------------------------------------------------------------------------
// The mirrored W010 event shapes.
// ---------------------------------------------------------------------------

/** One adaptation-event sequence number (1-based, contiguous per stream). */
export const AdapterEventSequenceSchema = z
  .number()
  .int('sequence numbers are integers')
  .min(1, 'sequence numbers start at 1')
  .max(Number.MAX_SAFE_INTEGER, 'sequence numbers are safe integers')
  .meta({
    id: 'AdapterEventSequence',
    title: 'AdapterEventSequence',
    description: 'One adaptation-event sequence number: 1-based, contiguous per stream.',
  });

/** One adaptation event sequence number. */
export type AdapterEventSequence = z.infer<typeof AdapterEventSequenceSchema>;

/** The causal parent reference of an adaptation event (strictly earlier). */
export const AdapterCausalParentSchema = z
  .strictObject({
    streamId: AdapterStreamIdSchema,
    sequence: AdapterEventSequenceSchema,
  })
  .readonly()
  .meta({
    id: 'AdapterCausalParent',
    title: 'AdapterCausalParent',
    description: 'Causal parent of an adaptation event: an earlier event in the same stream (the W010 shape).',
  });

/** One adaptation causal parent reference. */
export type AdapterCausalParent = z.infer<typeof AdapterCausalParentSchema>;

/** The generic event payload of an adaptation event (the W010 shape). */
export const AdapterEventPayloadSchema = z
  .strictObject({
    discriminator: z.string().regex(/^renderer-adapter:[a-z0-9][a-z0-9-]{0,62}$/),
    data: z.record(z.string().min(1).max(256), JsonValueSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'AdapterEventPayload',
    title: 'AdapterEventPayload',
    description: 'The namespaced payload of one adaptation event (the W010 payload shape).',
  });

/** One generic payload. */
export type AdapterEventPayload = z.infer<typeof AdapterEventPayloadSchema>;

/**
 * The immutable content of one adaptation event — the STRUCTURAL MIRROR
 * of the W010 `EventContent`. `occurredAt` is PRODUCER-SUPPLIED (part of
 * the fact): this kernel never reads a clock, so emission and replay
 * are deterministic by construction.
 */
export const AdapterEventContentSchema = z
  .strictObject({
    schemaVersion: z.literal(ADAPTER_EVENT_RECORD_VERSION),
    streamId: AdapterStreamIdSchema,
    sequence: AdapterEventSequenceSchema,
    tenantId: AdapterTenantIdSchema,
    actor: AdapterActorSchema,
    causalParent: AdapterCausalParentSchema.nullable(),
    payload: AdapterEventPayloadSchema,
    occurredAt: AdapterTimestampSchema,
  })
  .readonly()
  .meta({
    id: 'AdapterEventContent',
    title: 'AdapterEventContent',
    description:
      'Immutable content of one adaptation event (structural mirror of the W010 EventContent): stream, sequence, tenant, actor, causal parent, namespaced payload, producer-supplied instant.',
  });

/** One adaptation event content. */
export type AdapterEventContent = z.infer<typeof AdapterEventContentSchema>;

/**
 * The sealed adaptation event: content plus its SHA-256 digest over the
 * canonical JSON of the content (the W010 EventRegistration shape).
 */
export const AdapterEventSchema = z
  .strictObject({
    event: AdapterEventContentSchema,
    digest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'AdapterEvent',
    title: 'AdapterEvent',
    description:
      'The sealed adaptation event: mirrored W010 content plus its canonical SHA-256 content digest (the W010 EventRegistration shape).',
  });

/** One sealed adaptation event. */
export type AdapterEvent = z.infer<typeof AdapterEventSchema>;

// ---------------------------------------------------------------------------
// The typed payload family (the W010 payload-family discipline).
// ---------------------------------------------------------------------------

/** The typed data of a `renderer-adapter:technique-selected` event. */
export const TechniqueSelectedDataSchema = z
  .strictObject({
    selectionId: SelectionIdSchema,
    rendererSessionId: z.string().regex(/^rs-[a-z0-9][a-z0-9-]{0,62}$/),
    technique: RendererTechniqueSchema,
    reason: SelectionReasonSchema,
    bindingDigest: Sha256HexSchema,
    assessmentDigest: Sha256HexSchema,
  })
  .meta({
    id: 'TechniqueSelectedData',
    title: 'TechniqueSelectedData',
    description: 'Typed payload data of one renderer-adapter:technique-selected event.',
  });

/** One technique-selected payload. */
export type TechniqueSelectedData = z.infer<typeof TechniqueSelectedDataSchema>;

/** The typed data of a `renderer-adapter:mount-planned` event. */
export const MountPlannedDataSchema = z
  .strictObject({
    planId: MountPlanIdSchema,
    invocationId: z.string().regex(/^inv-[a-z0-9][a-z0-9-]{0,62}$/),
    rendererSessionId: z.string().regex(/^rs-[a-z0-9][a-z0-9-]{0,62}$/),
    technique: RendererTechniqueSchema,
    selectionDigest: Sha256HexSchema,
    graphDigest: Sha256HexSchema,
    graphKind: z.enum(['2d', '3d', 'animation', 'controls', 'narrative', 'presence', 'timeline-replay']),
  })
  .meta({
    id: 'MountPlannedData',
    title: 'MountPlannedData',
    description: 'Typed payload data of one renderer-adapter:mount-planned event.',
  });

/** One mount-planned payload. */
export type MountPlannedData = z.infer<typeof MountPlannedDataSchema>;

/** The typed data schemas of the adaptation-event family. */
export const ADAPTER_EVENT_DATA_SCHEMAS: Readonly<Record<AdapterEventDiscriminator, z.ZodType>> = {
  'renderer-adapter:technique-selected': TechniqueSelectedDataSchema,
  'renderer-adapter:mount-planned': MountPlannedDataSchema,
};

/**
 * Parse and validate typed payload data for one discriminator (the W010
 * payload-family discipline applied to the whole vocabulary). Total.
 */
export function parseAdapterEventData(
  discriminator: AdapterEventDiscriminator,
  data: unknown,
): RendererAdaptersResult<Record<string, JsonValue>> {
  const schema = ADAPTER_EVENT_DATA_SCHEMAS[discriminator];
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: `the ${discriminator} payload data failed its typed schema`,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  return { ok: true, value: parsed.data as Record<string, JsonValue> };
}

// ---------------------------------------------------------------------------
// Emission (append-only facts; no mutation API).
// ---------------------------------------------------------------------------

/**
 * The deterministic stream id of one renderer session's adaptation
 * decisions: `stream:renderer-adapter-<suffix>` (the renderer-session
 * suffix, kebab-safe).
 */
export function adapterStreamIdOf(rendererSessionId: string): string {
  const suffix = rendererSessionId.replace(/^rs-/, 'renderer-adapter-');
  return `stream:${suffix}`;
}

/** The transport coordinates an emitted adaptation event needs. */
export interface AdapterEventCoordinates {
  readonly streamId: string;
  readonly sequence: number;
  readonly causalParent: { readonly streamId: string; readonly sequence: number } | null;
}

/**
 * Build the mirrored W010 event content carrying one typed
 * technique-selected payload (total; the caller supplies transport
 * coordinates, the tenant, the actor, and the PRODUCER-SUPPLIED
 * instant — never a wall clock).
 */
export function buildTechniqueSelectedEvent(
  data: TechniqueSelectedData,
  coordinates: AdapterEventCoordinates,
  scope: {
    readonly tenantId: string;
    readonly actor: string;
    readonly occurredAt: string;
  },
): RendererAdaptersResult<AdapterEventContent> {
  const payload = parseAdapterEventData('renderer-adapter:technique-selected', data);
  if (!payload.ok) {
    return payload;
  }
  return buildAdapterEventContent(
    'renderer-adapter:technique-selected',
    payload.value,
    coordinates,
    scope,
  );
}

/**
 * Build the mirrored W010 event content carrying one typed mount-planned
 * payload (total; same producer-supplied discipline).
 */
export function buildMountPlannedEvent(
  data: MountPlannedData,
  coordinates: AdapterEventCoordinates,
  scope: {
    readonly tenantId: string;
    readonly actor: string;
    readonly occurredAt: string;
  },
): RendererAdaptersResult<AdapterEventContent> {
  const payload = parseAdapterEventData('renderer-adapter:mount-planned', data);
  if (!payload.ok) {
    return payload;
  }
  return buildAdapterEventContent('renderer-adapter:mount-planned', payload.value, coordinates, scope);
}

/** The shared content builder (validates the full mirrored shape). */
function buildAdapterEventContent(
  discriminator: AdapterEventDiscriminator,
  data: Record<string, JsonValue>,
  coordinates: AdapterEventCoordinates,
  scope: {
    readonly tenantId: string;
    readonly actor: string;
    readonly occurredAt: string;
  },
): RendererAdaptersResult<AdapterEventContent> {
  const content: AdapterEventContent = {
    schemaVersion: ADAPTER_EVENT_RECORD_VERSION,
    streamId: coordinates.streamId,
    sequence: coordinates.sequence,
    tenantId: scope.tenantId,
    actor: scope.actor,
    causalParent: coordinates.causalParent,
    payload: { discriminator, data },
    occurredAt: scope.occurredAt,
  };
  const parsed = AdapterEventContentSchema.safeParse(content);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the adaptation event content failed the mirrored W010 shape admission',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Seal valid adaptation event content into its content-addressed
 * registration (content + its recomputed canonical SHA-256 digest).
 * Total: invalid content yields a typed `malformed-record` error.
 */
export function sealAdapterEvent(content: unknown): RendererAdaptersResult<AdapterEvent> {
  const parsed = AdapterEventContentSchema.safeParse(content);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the adaptation event content failed the mirrored W010 shape admission',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  return {
    ok: true,
    value: {
      event: parsed.data,
      digest: canonicalDigest(parsed.data as unknown as JsonValue),
    },
  };
}

/**
 * Content-addressed identity of an adaptation event: the SHA-256 of its
 * canonical JSON serialization (the W010 discipline). Total.
 */
export function computeAdapterEventDigest(content: unknown): RendererAdaptersResult<Sha256Hex> {
  const parsed = AdapterEventContentSchema.safeParse(content);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'cannot digest an invalid adaptation event',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  return { ok: true, value: canonicalDigest(parsed.data as unknown as JsonValue) };
}

/** The event namespace (re-export for consumers). */
export { ADAPTER_EVENT_NAMESPACE };
