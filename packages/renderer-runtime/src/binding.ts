/**
 * The renderer session binding — descriptor x device session, plus the
 * typed effective limits their negotiation produces.
 *
 * Binding semantics (the W013 pin): the binding does NOT adapt (W019's
 * surface); it NEGOTIATES — the effective limits are the intersection of
 * what the renderer declares and what the device session's W011
 * descriptor allows:
 * - effective graph kinds = the renderer's declared hosting kinds;
 * - effective interaction = renderer modalities ∩ device modalities;
 * - effective stereoscopic = renderer AND device stereoscopic support;
 * - effective node/edge budgets = the renderer's (the device descriptor
 *   declares no node budgets);
 * - effective triangle/texture budgets = the minimum of the renderer's and
 *   the device's declared values (over the sources that declare one).
 *
 * Invocations are then enforced against the effective limits (see
 * src/enforcement.ts): anything not declared is denied (W008 permission
 * pattern) and budget violations are denied — both as typed errors.
 *
 * Bindings are content-addressed records: the digest addresses the exact
 * binding revision, and every admitted invocation produces the next
 * sealed revision.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  ExperienceGraphKindSchema,
  InteractionModalitySchema,
  type InteractionModality,
} from '@epoch/experience-protocol';
import {
  RENDERER_BINDING_SCHEMA_NAME,
  RendererBindingStateSchema,
  RendererProtocolVersionSchema,
} from './version';
import {
  MAX_RENDERER_GRAPH_EDGES,
  MAX_RENDERER_GRAPH_NODES,
  MAX_RENDERER_TEXTURE_BYTES,
  MAX_RENDERER_TRIANGLES,
} from './version';
import { RendererSessionIdSchema, Sha256HexSchema, VirtualTimeMsSchema } from './primitives';
import { RendererDescriptorSchema, type RendererDescriptor } from './descriptor';
import { DeviceSessionSnapshotSchema, type DeviceSessionSnapshot } from './snapshot';
import { malformedRecordError } from './issues';
import type { RendererRuntimeError, RendererRuntimeResult } from './errors';

// ---------------------------------------------------------------------------
// Effective limits (the negotiated enforcement envelope).
// ---------------------------------------------------------------------------

/**
 * The effective limits of a renderer session binding: the typed envelope
 * every invocation is enforced against. Node/edge budgets are always
 * present (the renderer must declare them); triangle/texture budgets are
 * present only when a bound source declares one.
 */
export const EffectiveLimitsSchema = z
  .strictObject({
    /** Graph kinds the binding hosts (the renderer's declared kinds). */
    graphKinds: z
      .array(ExperienceGraphKindSchema)
      .min(1)
      .max(7)
      .refine(
        (kinds) => kinds.every((k, i) => i === 0 || k > kinds[i - 1]),
        'effective graphKinds must be sorted ascending and duplicate-free (deterministic set semantics)',
      ),
    /** Interaction modalities the binding services (renderer ∩ device). */
    interaction: z
      .array(InteractionModalitySchema)
      .max(7)
      .refine(
        (modalities) => modalities.every((m, i) => i === 0 || m > modalities[i - 1]),
        'effective interaction must be sorted ascending and duplicate-free (deterministic set semantics)',
      ),
    /** Whether the binding can present stereoscopically (renderer AND device). */
    stereoscopic: z.boolean(),
    /** Maximum nodes per hosted graph (enforced at admission). */
    maxGraphNodes: z.number().int().min(1).max(MAX_RENDERER_GRAPH_NODES),
    /** Maximum edges per hosted graph (enforced at admission). */
    maxGraphEdges: z.number().int().min(0).max(MAX_RENDERER_GRAPH_EDGES),
    /** Maximum declared triangles per mounted state (when bounded). */
    maxTriangles: z.number().int().positive().max(MAX_RENDERER_TRIANGLES).optional(),
    /** Maximum declared texture bytes per mounted state (when bounded). */
    maxTextureBytes: z.number().int().positive().max(MAX_RENDERER_TEXTURE_BYTES).optional(),
  })
  .meta({
    id: 'EffectiveLimits',
    title: 'EffectiveLimits',
    description:
      'The negotiated enforcement envelope of a renderer session binding: hosting kinds, serviced modalities, stereoscopic support, and node/edge/triangle/texture budgets.',
  });

/** One effective-limits record. */
export type EffectiveLimits = z.infer<typeof EffectiveLimitsSchema>;

/** The minimum over the defined sources (deterministic negotiation). */
function minOver(...values: Array<number | undefined>): number | undefined {
  const defined = values.filter((value): value is number => value !== undefined);
  if (defined.length === 0) {
    return undefined;
  }
  return Math.min(...defined);
}

/** Sorted set intersection of two sorted duplicate-free modality arrays. */
function intersectModalities(
  a: readonly InteractionModality[],
  b: readonly InteractionModality[],
): InteractionModality[] {
  const setB = new Set<string>(b);
  return a.filter((modality): modality is InteractionModality => setB.has(modality));
}

/**
 * Compute the effective limits of a renderer descriptor bound to a device
 * snapshot (pure, deterministic). See the module docs for the negotiation
 * rules.
 */
export function computeEffectiveLimits(
  renderer: RendererDescriptor,
  device: DeviceSessionSnapshot,
): EffectiveLimits {
  return {
    graphKinds: [...renderer.graphKinds],
    interaction: intersectModalities(renderer.interaction, device.device.interaction),
    stereoscopic: renderer.output.stereoscopic && device.device.display.stereoscopic,
    maxGraphNodes: renderer.budgets.maxGraphNodes,
    maxGraphEdges: renderer.budgets.maxGraphEdges,
    maxTriangles: minOver(renderer.budgets.maxTriangles, device.device.spatial.maxTriangles),
    maxTextureBytes: minOver(renderer.budgets.maxTextureBytes, device.device.spatial.maxTextureBytes),
  };
}

// ---------------------------------------------------------------------------
// The binding record (sealed, content-addressed).
// ---------------------------------------------------------------------------

/**
 * The shared canonical-consistency refinement: the effective limits must
 * equal the deterministic negotiation of the embedded descriptor and
 * device snapshot, and the mounted state must carry a mount time.
 */
function refineBinding(
  binding: {
    renderer: z.infer<typeof RendererDescriptorSchema>;
    device: z.infer<typeof DeviceSessionSnapshotSchema>;
    effective: z.infer<typeof EffectiveLimitsSchema>;
    mountedStateDigest?: z.infer<typeof Sha256HexSchema>;
    mountedAtMs?: number;
  },
  ctx: z.RefinementCtx,
): void {
  const expected = computeEffectiveLimits(binding.renderer, binding.device);
  const actual = binding.effective;
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    ctx.addIssue({
      code: 'custom',
      message:
        'effective limits must equal the deterministic negotiation of the renderer descriptor and the device snapshot',
      path: ['effective'],
    });
  }
  if (binding.mountedStateDigest !== undefined && binding.mountedAtMs === undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'a mounted state must carry its mount time',
      path: ['mountedAtMs'],
    });
  } else if (binding.mountedStateDigest === undefined && binding.mountedAtMs !== undefined) {
    ctx.addIssue({
      code: 'custom',
      message: 'mountedAtMs requires a mounted state digest',
      path: ['mountedAtMs'],
    });
  }
}

/** The content of a renderer binding record (everything except the digest). */
export const RendererBindingContentSchema = z
  .strictObject({
    schema: z.literal(RENDERER_BINDING_SCHEMA_NAME),
    protocolVersion: RendererProtocolVersionSchema,
    rendererSessionId: RendererSessionIdSchema,
    /** The bound renderer descriptor (embedded declaration). */
    renderer: RendererDescriptorSchema,
    /** The device-session value projection the descriptor is bound to. */
    device: DeviceSessionSnapshotSchema,
    /** The negotiated enforcement envelope. */
    effective: EffectiveLimitsSchema,
    state: RendererBindingStateSchema,
    /** Virtual time the binding was established at (caller-supplied). */
    boundAtMs: VirtualTimeMsSchema,
    /** Frame index of the last admitted advance-frame invocation (absent = none). */
    lastFrameIndex: z.number().int().nonnegative().optional(),
    /** Content digest of the currently mounted render-ready state (absent = none). */
    mountedStateDigest: Sha256HexSchema.optional(),
    /** Virtual time the current state was mounted at. */
    mountedAtMs: VirtualTimeMsSchema.optional(),
    /** Total invocations admitted on this binding (deterministic counter). */
    invocationCount: z.number().int().nonnegative(),
  })
  .superRefine(refineBinding)
  .meta({
    id: 'RendererBindingContent',
    title: 'RendererBindingContent',
    description:
      'The content of a renderer binding record: session identity, embedded descriptor, device snapshot, negotiated effective limits, lifecycle state, and execution state.',
  });

/** One binding content. */
export type RendererBindingContent = z.infer<typeof RendererBindingContentSchema>;

/**
 * The sealed renderer binding record: content plus its SHA-256 digest
 * over the canonical JSON of the content (the digest field excluded).
 */
export const RendererBindingSchema = z
  .strictObject({
    schema: z.literal(RENDERER_BINDING_SCHEMA_NAME),
    protocolVersion: RendererProtocolVersionSchema,
    rendererSessionId: RendererSessionIdSchema,
    renderer: RendererDescriptorSchema,
    device: DeviceSessionSnapshotSchema,
    effective: EffectiveLimitsSchema,
    state: RendererBindingStateSchema,
    boundAtMs: VirtualTimeMsSchema,
    lastFrameIndex: z.number().int().nonnegative().optional(),
    mountedStateDigest: Sha256HexSchema.optional(),
    mountedAtMs: VirtualTimeMsSchema.optional(),
    invocationCount: z.number().int().nonnegative(),
    digest: Sha256HexSchema,
  })
  .superRefine(refineBinding)
  .meta({
    id: 'RendererBinding',
    title: 'RendererBinding',
    description:
      'The sealed renderer binding record: negotiated, lifecycle-tracked binding content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed renderer binding record. */
export type RendererBinding = z.infer<typeof RendererBindingSchema>;

// ---------------------------------------------------------------------------
// Binding lifecycle.
// ---------------------------------------------------------------------------

/** Options shared by the binding entry points. */
export interface BindingOptions {
  /**
   * The tenant the caller is binding FOR. When provided, a snapshot owned
   * by a different tenant is rejected with `cross-tenant-denied` (R12).
   */
  readonly expectedTenantId?: string;
}

/** The typed input of {@link bindRendererSession}. */
export interface BindRendererSessionInput {
  readonly rendererSessionId: unknown;
  readonly renderer: unknown;
  readonly device: unknown;
  readonly boundAtMs?: unknown;
}

function tenantDenial(
  path: readonly (string | number)[],
  expectedTenantId: string,
  encounteredTenantId: string,
): RendererRuntimeError {
  return {
    code: 'cross-tenant-denied',
    message: `cross-tenant binding denied: expected tenant "${expectedTenantId}", encountered "${encounteredTenantId}"`,
    path: [...path],
    expectedTenantId,
    encounteredTenantId,
  };
}

/**
 * Bind a renderer descriptor to a device-session snapshot: validates the
 * descriptor and snapshot, negotiates the effective limits, and seals the
 * open binding record. Total: invalid descriptors/snapshots yield typed
 * `malformed-record` errors; tenant mismatch yields
 * `cross-tenant-denied`.
 */
export function bindRendererSession(
  input: BindRendererSessionInput,
  options?: BindingOptions,
): RendererRuntimeResult<RendererBinding> {
  const rendererParsed = RendererDescriptorSchema.safeParse(input.renderer);
  if (!rendererParsed.success) {
    return {
      ok: false,
      error: {
        ...malformedRecordError(rendererParsed.error),
        message: 'renderer descriptor failed schema validation',
      },
    };
  }
  const deviceParsed = DeviceSessionSnapshotSchema.safeParse(input.device);
  if (!deviceParsed.success) {
    return {
      ok: false,
      error: {
        ...malformedRecordError(deviceParsed.error),
        message: 'device-session snapshot failed schema validation',
      },
    };
  }
  const sessionIdParsed = RendererSessionIdSchema.safeParse(input.rendererSessionId);
  if (!sessionIdParsed.success) {
    return {
      ok: false,
      error: {
        ...malformedRecordError(sessionIdParsed.error),
        message: 'rendererSessionId failed schema validation',
      },
    };
  }
  const boundAtMsParsed = VirtualTimeMsSchema.safeParse(input.boundAtMs ?? 0);
  if (!boundAtMsParsed.success) {
    return {
      ok: false,
      error: {
        ...malformedRecordError(boundAtMsParsed.error),
        message: 'boundAtMs failed schema validation',
      },
    };
  }
  const snapshot = deviceParsed.data;
  if (
    options?.expectedTenantId !== undefined &&
    options.expectedTenantId !== snapshot.tenantScope.tenantId
  ) {
    return {
      ok: false,
      error: tenantDenial(
        ['device', 'tenantScope', 'tenantId'],
        options.expectedTenantId,
        snapshot.tenantScope.tenantId,
      ),
    };
  }
  const content = RendererBindingContentSchema.parse({
    schema: RENDERER_BINDING_SCHEMA_NAME,
    protocolVersion: '1.0.0',
    rendererSessionId: sessionIdParsed.data,
    renderer: rendererParsed.data,
    device: snapshot,
    effective: computeEffectiveLimits(rendererParsed.data, snapshot),
    state: 'open',
    boundAtMs: boundAtMsParsed.data,
    invocationCount: 0,
  });
  return {
    ok: true,
    value: { ...content, digest: canonicalDigest(content as unknown as JsonValue) },
  };
}

/**
 * Close a renderer session binding (terminal). Total: closing a closed
 * binding yields a typed `session-closed` error.
 */
export function closeRendererSession(
  binding: RendererBinding,
  options?: BindingOptions,
): RendererRuntimeResult<RendererBinding> {
  if (
    options?.expectedTenantId !== undefined &&
    options.expectedTenantId !== binding.device.tenantScope.tenantId
  ) {
    return {
      ok: false,
      error: tenantDenial(
        ['device', 'tenantScope', 'tenantId'],
        options.expectedTenantId,
        binding.device.tenantScope.tenantId,
      ),
    };
  }
  if (binding.state === 'closed') {
    return {
      ok: false,
      error: {
        code: 'session-closed',
        message: 'cannot close a closed renderer session (closed is terminal)',
        rendererSessionId: binding.rendererSessionId,
      },
    };
  }
  const { digest: _sealed, ...content } = binding;
  void _sealed;
  const next = RendererBindingContentSchema.parse({ ...content, state: 'closed' });
  return {
    ok: true,
    value: { ...next, digest: canonicalDigest(next as unknown as JsonValue) },
  };
}
