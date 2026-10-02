/**
 * The typed RENDERER FAILURE taxonomy of the fabric orchestration surface
 * (W056) — "typed failure/degradation/fallback".
 *
 * Every fabric orchestration failure is a discriminated
 * {@link RendererFailure} value (never a bare throw), so consumers branch
 * deterministically on `code`. Where a failure was PRODUCED by the W013
 * hosting surface (a rejected binding, invocation, or admission), the
 * verbatim typed {@link RendererRuntimeError} rides along as `cause`, so
 * kernel-boundary failures stay fully typed end-to-end. Fabric-internal
 * chains (a fallback triggered by a probe rejection, an abort caused by a
 * mount failure) carry their trigger as a typed
 * {@link RendererFailureTrigger} (code + message) — the chain stays typed
 * without unbounded recursion.
 *
 * Failure semantics of the switching invariant: a failed switch is
 * `switch-aborted` (the previous session is RETAINED — never lost); a
 * completed switch under fallback is a SUCCESS whose receipt records the
 * fallback (plus an informational `fallback-applied` failure value the
 * host may surface); degradation is always a typed `degraded` failure
 * value, never a silent mode change.
 */
import { z } from 'zod';
import { RendererFailureCodeSchema } from './version';
import { RendererIssueSchema, RendererRuntimeErrorSchema } from './errors';

/**
 * The typed trigger of a chained fabric failure: the producing failure's
 * code plus its message (bounded, neutral).
 */
export const RendererFailureTriggerSchema = z
  .strictObject({
    code: RendererFailureCodeSchema,
    message: z.string().min(1),
  })
  .meta({
    id: 'RendererFailureTrigger',
    title: 'RendererFailureTrigger',
    description: 'The typed trigger of a chained renderer-fabric failure: producing code plus message.',
  });

/** One failure trigger. */
export type RendererFailureTrigger = z.infer<typeof RendererFailureTriggerSchema>;

/** One typed renderer-fabric failure (discriminated on `code`). */
export const RendererFailureSchema = z
  .discriminatedUnion('code', [
    z.strictObject({
      code: z.literal('adapter-unavailable'),
      message: z.string().min(1),
      /** The renderer identity that could not be resolved. */
      rendererId: z.string(),
      /** Neutral reason the resolution failed (registry miss, retirement, ...). */
      reason: z.string(),
    }),
    z.strictObject({
      code: z.literal('asset-rejected'),
      message: z.string().min(1),
      /** The content digest of the rejected asset. */
      assetDigest: z.string(),
      /** Neutral reason the asset binding was rejected. */
      reason: z.string(),
    }),
    z.strictObject({
      code: z.literal('cross-tenant-denied'),
      message: z.string().min(1),
      /** The tenant the caller expected (R12). */
      expectedTenantId: z.string(),
      /** The tenant actually encountered. */
      encounteredTenantId: z.string(),
    }),
    z.strictObject({
      code: z.literal('degraded'),
      message: z.string().min(1),
      /** The typed presentation degradation that was applied. */
      degradation: z.enum(['reduced-fidelity', 'static-frame', 'wireframe']),
      /** Neutral reason the fidelity was reduced. */
      reason: z.string(),
    }),
    z.strictObject({
      code: z.literal('fallback-applied'),
      message: z.string().min(1),
      /** The renderer the fabric fell back FROM. */
      fromRendererId: z.string(),
      /** The renderer the fabric fell back TO. */
      toRendererId: z.string(),
      /** The typed trigger that made the fallback necessary. */
      trigger: RendererFailureTriggerSchema,
    }),
    z.strictObject({
      code: z.literal('input-unsupported'),
      message: z.string().min(1),
      /** The input envelope kind that could not be normalized. */
      inputKind: z.string(),
      /** Neutral reason the normalization was refused. */
      reason: z.string(),
      /** The typed W013 error when a hosting-surface admission refused the intent. */
      admissionCause: RendererRuntimeErrorSchema.optional(),
    }),
    z.strictObject({
      code: z.literal('invalid-fabric-record'),
      message: z.string().min(1),
      issues: z.array(RendererIssueSchema).min(1),
    }),
    z.strictObject({
      code: z.literal('mount-failed'),
      message: z.string().min(1),
      /** The world digest that failed to mount. */
      worldDigest: z.string(),
      /** The typed W013 cause when a hosting-surface admission produced the failure. */
      cause: RendererRuntimeErrorSchema.optional(),
      /** The typed W016 compilation message when scene compilation produced the failure. */
      compileMessage: z.string().optional(),
    }),
    z.strictObject({
      code: z.literal('probe-rejected'),
      message: z.string().min(1),
      /** The renderer whose compatibility probe failed. */
      rendererId: z.string(),
      /** Neutral reason the probe found the renderer incompatible. */
      reason: z.string(),
    }),
    z.strictObject({
      code: z.literal('session-disposed'),
      message: z.string().min(1),
      /** The disposed fabric session that was invoked. */
      fabricSessionId: z.string(),
    }),
    z.strictObject({
      code: z.literal('session-failed'),
      message: z.string().min(1),
      /** The fabric session that failed. */
      fabricSessionId: z.string(),
      /** The typed trigger when another fabric failure produced this session failure. */
      trigger: RendererFailureTriggerSchema.optional(),
    }),
    z.strictObject({
      code: z.literal('switch-aborted'),
      message: z.string().min(1),
      /** The switch stage that aborted (resolve/probe/create/mount/restore). */
      stage: z.enum(['create', 'mount', 'probe', 'resolve', 'restore']),
      /** The fabric session that remains active (the switch was safe). */
      retainedFabricSessionId: z.string(),
      /** The typed trigger of the abort. */
      trigger: RendererFailureTriggerSchema,
    }),
    z.strictObject({
      code: z.literal('unknown-session'),
      message: z.string().min(1),
      /** The fabric session id that is not hosted by this fabric. */
      encounteredFabricSessionId: z.string(),
    }),
    z.strictObject({
      code: z.literal('switch-incompatible'),
      message: z.string().min(1),
      /** What differed across the attempted switch. */
      field: z.enum(['tenant', 'world-digest']),
      expected: z.string(),
      encountered: z.string(),
    }),
  ])
  .meta({
    id: 'RendererFailure',
    title: 'RendererFailure',
    description:
      'Typed, discriminated failure of the renderer fabric orchestration surface: adapter availability, probes, mounts, sessions, degradation, fallback, input normalization, asset bindings, switch compatibility, and switch aborts.',
  });

/** One typed renderer-fabric failure. */
export type RendererFailure = z.infer<typeof RendererFailureSchema>;

/** Result of a total renderer-fabric entry point (value or typed failure). */
export type FabricResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: RendererFailure };
