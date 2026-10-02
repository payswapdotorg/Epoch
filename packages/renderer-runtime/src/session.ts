/**
 * The EPHEMERAL RENDERER SESSION record (W056) — the fabric's session
 * state as typed, content-addressed data.
 *
 * Non-authoritative BY CONSTRUCTION (lock rules 8/16; ACR-007 binding
 * rules): a session is EPHEMERAL PRESENTATION state. It embeds the W013
 * hosting binding (descriptor x device snapshot, negotiated limits —
 * sealed), the adapter's capability set, the canonical world projection
 * reference (scene id + world digest + tenant — identity continuity), the
 * portable view state, and the typed health projection. It carries NO
 * semantic payload: world entities are referenced opaquely, never
 * embedded, and producing/mutating/disposing a session never mutates
 * world or solution state. Sessions are never persisted by the fabric —
 * the record exists so hosts can seal, verify, and audit presentation
 * state at a revision.
 *
 * Lifecycle: `created` (bound, not yet presenting) -> `active` ->
 * (`degraded` | `suspended`)* -> `disposed` (terminal). The transition
 * discipline is enforced by {@link canTransitionRendererSession}; the
 * orchestration lives in @epoch/renderer-fabric.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  RENDERER_FABRIC_PROTOCOL_VERSION,
  RENDERER_SESSION_SCHEMA_NAME,
  RendererFabricProtocolVersionSchema,
  RendererSessionStateSchema,
} from './version';
import { flattenZodIssues } from './issues';
import { FabricSessionIdSchema } from './fabric-primitives';
import {
  RendererSessionIdSchema,
  Sha256HexSchema,
  VirtualTimeMsSchema,
} from './primitives';
import { RendererIdSchema } from './primitives';
import { RendererBindingSchema, type RendererBinding } from './binding';
import { RendererCapabilitySetSchema, type RendererCapabilitySet } from './capabilities';
import { WorldProjectionRefSchema, type WorldProjectionRef } from './world-projection';
import { PortableViewStateSchema, type PortableViewState } from './portable-state';
import { RendererHealthSchema, type RendererHealth } from './health';
import type { FabricResult, RendererFailure } from './failure';

/** The legal lifecycle transitions of a renderer session. */
export const RENDERER_SESSION_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  active: ['degraded', 'suspended', 'disposed'],
  created: ['active', 'disposed'],
  degraded: ['active', 'suspended', 'disposed'],
  disposed: [],
  suspended: ['active', 'degraded', 'disposed'],
};

/** Whether `from -> to` is a legal session lifecycle transition. */
export function canTransitionRendererSession(from: string, to: string): boolean {
  return (RENDERER_SESSION_TRANSITIONS[from] ?? []).includes(to);
}

/**
 * The shared canonical-consistency refinement of session content.
 * (Kept as a standalone function so the content and sealed schemas share
 * the exact discipline — the binding.ts precedent.)
 */
function refineSession(
  session: {
    rendererId: string;
    rendererSessionId: string;
    binding: RendererBinding;
    capabilities: RendererCapabilitySet;
    worldProjection: WorldProjectionRef;
    state: string;
    mountedWorldDigest?: string;
    mountedAtMs?: number;
  },
  ctx: z.RefinementCtx,
): void {
  if (session.binding.renderer.rendererId !== session.rendererId) {
    ctx.addIssue({
      code: 'custom',
      message: "the embedded binding must bind this session's renderer descriptor",
      path: ['binding', 'renderer', 'rendererId'],
    });
  }
  if (session.capabilities.rendererId !== session.rendererId) {
    ctx.addIssue({
      code: 'custom',
      message: "the capability set must declare this session's renderer descriptor",
      path: ['capabilities', 'rendererId'],
    });
  }
  if (session.binding.rendererSessionId !== session.rendererSessionId) {
    ctx.addIssue({
      code: 'custom',
      message: "the embedded binding's rendererSessionId must equal the session's rendererSessionId",
      path: ['binding', 'rendererSessionId'],
    });
  }
  const bindingTenant = session.binding.device.tenantScope.tenantId;
  const worldTenant = session.worldProjection.tenantScope.tenantId;
  if (bindingTenant !== worldTenant) {
    ctx.addIssue({
      code: 'custom',
      message: `the session binding (tenant "${bindingTenant}") and the world projection (tenant "${worldTenant}") must share the tenant scope`,
      path: ['worldProjection', 'tenantScope', 'tenantId'],
    });
  }
  if (session.mountedWorldDigest !== undefined && session.mountedAtMs === undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'a mounted session must carry its mount time',
      path: ['mountedAtMs'],
    });
  } else if (session.mountedWorldDigest === undefined && session.mountedAtMs !== undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'mountedAtMs requires a mounted world digest',
      path: ['mountedWorldDigest'],
    });
  }
  if (session.state === 'disposed' && session.mountedWorldDigest !== undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'a disposed session never carries a mounted world digest (dispose clears the presentation state)',
      path: ['mountedWorldDigest'],
    });
  }
}

/**
 * The content of a renderer session record (everything except the digest).
 */
export const RendererSessionContentSchema = z
  .strictObject({
    schema: z.literal(RENDERER_SESSION_SCHEMA_NAME),
    fabricProtocolVersion: RendererFabricProtocolVersionSchema,
    /** The ephemeral fabric-session identity. */
    fabricSessionId: FabricSessionIdSchema,
    /** The registered capability identity backing this session (registry key). */
    capabilityId: z.string().min(1).max(256),
    /** The W013 renderer descriptor identity of the presenting renderer. */
    rendererId: RendererIdSchema,
    /** The W013 renderer-session id of the embedded binding (derived: "rs-" + the fabric slug). */
    rendererSessionId: RendererSessionIdSchema,
    /** The embedded W013 hosting binding (sealed: descriptor x device snapshot x negotiated limits). */
    binding: RendererBindingSchema,
    /** The adapter's declared fabric capability set. */
    capabilities: RendererCapabilitySetSchema,
    /** The canonical world projection reference (identity continuity). */
    worldProjection: WorldProjectionRefSchema,
    /** The portable view state (focus/layers/timeline/camera). */
    viewState: PortableViewStateSchema,
    /** The typed health projection. */
    health: RendererHealthSchema,
    /** The session lifecycle state. */
    state: RendererSessionStateSchema,
    /** Virtual time the session was created at (caller-supplied). */
    createdAtMs: VirtualTimeMsSchema,
    /** Content digest of the mounted canonical revision (absent until first mount). */
    mountedWorldDigest: Sha256HexSchema.optional(),
    /** Virtual time the canonical revision was mounted at. */
    mountedAtMs: VirtualTimeMsSchema.optional(),
    /** Frame index of the last applied frame (absent = none). */
    lastFrameIndex: z.number().int().nonnegative().optional(),
    /** Total fabric invocations admitted on this session (deterministic counter). */
    invocationCount: z.number().int().nonnegative(),
    /** Completed switches that produced this session (0 = created directly). */
    switchCount: z.number().int().nonnegative(),
  })
  .superRefine(refineSession)
  .meta({
    id: 'RendererSessionContent',
    title: 'RendererSessionContent',
    description:
      'The content of an ephemeral renderer session record: identity, embedded W013 binding, capability set, world projection reference, portable view state, health, lifecycle state, and execution counters.',
  });

/** One session content. */
export type RendererSessionContent = z.infer<typeof RendererSessionContentSchema>;

/**
 * The sealed renderer session record: content plus its SHA-256 digest over
 * the canonical JSON of the content (the digest field excluded).
 */
export const RendererSessionSchema = RendererSessionContentSchema.extend({
  digest: Sha256HexSchema,
}).meta({
  id: 'RendererSession',
  title: 'RendererSession',
  description:
    'The sealed ephemeral renderer session record: presentation-session content plus its SHA-256 content digest (non-authoritative by construction).',
});

/** One sealed renderer session record. */
export type RendererSession = z.infer<typeof RendererSessionSchema>;

/** The input of {@link createRendererSessionContent}. */
export interface CreateRendererSessionInput {
  readonly fabricSessionId: string;
  readonly capabilityId: string;
  readonly binding: RendererBinding;
  readonly capabilities: RendererCapabilitySet;
  readonly worldProjection: WorldProjectionRef;
  readonly viewState: PortableViewState;
  readonly health?: RendererHealth;
  readonly createdAtMs: number;
  readonly switchCount?: number;
}

/** Build the typed `invalid-fabric-record` failure for a zod error. */
function invalidRecordFailure(
  message: string,
  issues: ReturnType<typeof flattenZodIssues>,
): RendererFailure {
  return { code: 'invalid-fabric-record', message, issues };
}

/**
 * Create the initial `created` session content of one fabric session
 * (deterministic, pure). Derives the rendererSessionId from the fabric
 * session id (`fx-slug` -> `rs-slug`) and the rendererId from the binding.
 * Total: invalid inputs yield a typed `invalid-fabric-record` failure.
 */
export function createRendererSessionContent(
  input: CreateRendererSessionInput,
): FabricResult<RendererSessionContent> {
  if (typeof input.fabricSessionId !== 'string' || !input.fabricSessionId.startsWith('fx-')) {
    return {
      ok: false,
      error: invalidRecordFailure('the fabric session id must use the "fx-" grammar', [
        { path: 'fabricSessionId', message: 'expected an "fx-" prefixed slug' },
      ]),
    };
  }
  const rendererSessionId = `rs-${input.fabricSessionId.slice(3)}`;
  const candidate = {
    schema: RENDERER_SESSION_SCHEMA_NAME,
    fabricProtocolVersion: RENDERER_FABRIC_PROTOCOL_VERSION,
    fabricSessionId: input.fabricSessionId,
    capabilityId: input.capabilityId,
    rendererId: input.binding.renderer.rendererId,
    rendererSessionId,
    binding: input.binding,
    capabilities: input.capabilities,
    worldProjection: input.worldProjection,
    viewState: input.viewState,
    health: input.health ?? { state: 'healthy', degradation: 'none', atMs: input.createdAtMs },
    state: 'created',
    createdAtMs: input.createdAtMs,
    invocationCount: 0,
    switchCount: input.switchCount ?? 0,
  };
  const parsed = RendererSessionContentSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false,
      error: invalidRecordFailure(
        'renderer session content failed schema validation',
        flattenZodIssues(parsed.error),
      ),
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Seal valid session content into a sealed record (content + its SHA-256
 * content digest). Throws on invalid content — producers validate first.
 */
export function sealRendererSession(content: RendererSessionContent): RendererSession {
  return {
    ...content,
    digest: canonicalDigest(content as unknown as JsonValue),
  };
}
