/**
 * Host-originated TYPED INTENTS of the workspace (W057).
 *
 * Everything here uses the EXISTING @epoch/world-experience vocabulary —
 * the runtime NEVER invents intent semantics. Two intent paths meet in
 * the workspace runtime, both admitted through the W016 total admission
 * (`admitWorldIntent`) and applied through the W016 reducer
 * (`applyWorldIntent`):
 *
 * 1. VIEWPORT INPUT through the RendererFabric seam: raw pointer/wheel
 *    envelopes (with a tool-derived intent hint) → the adapter
 *    hit-tests + normalizes → the fabric re-admits the normalized intent
 *    through the W016 admission (the Dynamic UI law — adapters are never
 *    trusted) → the W013 boundary admits the submit-intent invocation →
 *    a sealed RendererIntentReceipt. The runtime then applies the
 *    admitted intent through the reducer.
 * 2. WORKSPACE COMMANDS (timeline transport, layer toggles, agent follow,
 *    scene controls, branch/simulation entry): the runtime builds the
 *    typed intent here, admits it through the same W016 admission, and
 *    applies it through the same reducer — the identical post-
 *    normalization path the fabric uses (one authority path, two doors).
 *
 * Effect-only intents (inspect, measure, compare, simulate, query,
 * change, connect, disconnect, branch) NEVER mutate the scene: the
 * reducer turns them into typed request effects for the host to route
 * through the proper authorities (the workspace surfaces them; it never
 * executes them — no direct durable mutation from the UI).
 */
import type { ControlIntent } from '@epoch/experience-protocol';
import {
  admitWorldIntent,
  type WorldInteractionIntent,
  type WorldScene,
} from '@epoch/world-experience';
import type { WorldTool } from './version';

/** The typed result shape shared by the runtime (typed errors, never throws). */
export type RuntimeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

/** The control-intent hint each tool carries into the fabric input seam. */
export function intentHintOfTool(tool: WorldTool): ControlIntent {
  switch (tool) {
    case 'select':
      return { id: 'epoch.world.interaction.select', version: '1.0.0' };
    case 'inspect':
      return { id: 'epoch.world.interaction.inspect', version: '1.0.0' };
    case 'isolate':
      return { id: 'epoch.world.interaction.isolate', version: '1.0.0' };
    case 'measure':
      return { id: 'epoch.world.interaction.measure', version: '1.0.0' };
    case 'annotate':
      return { id: 'epoch.world.interaction.annotate', version: '1.0.0' };
    case 'hide':
      return { id: 'epoch.world.interaction.hide', version: '1.0.0' };
  }
}

/** Build + admit one host-originated typed intent (the shared authority path). */
function admitBuilt(intent: WorldInteractionIntent): RuntimeResult<WorldInteractionIntent> {
  const admitted = admitWorldIntent(intent);
  if (!admitted.ok) {
    return {
      ok: false,
      error: {
        code: admitted.error.code,
        message: `the workspace intent failed W016 admission (${admitted.error.code}): ${admitted.error.message}`,
      },
    };
  }
  return { ok: true, value: admitted.value };
}

/** The builder input: caller-scoped ids + entity references. */
export interface IntentBuilderInput {
  readonly invocationId: string;
}

// ---------------------------------------------------------------------------
// Timeline transport (replay / pause / resume / branch).
// ---------------------------------------------------------------------------

/** Build the typed replay intent (scrub to a virtual time). */
export function buildReplayIntent(
  input: IntentBuilderInput & { readonly fromMs: number },
): RuntimeResult<WorldInteractionIntent> {
  return admitBuilt({
    schema: 'epoch.world-intent',
    intentVersion: 1,
    kind: 'replay',
    intentId: input.invocationId,
    fromMs: Math.max(0, Math.trunc(input.fromMs)),
  });
}

/** Build the typed pause intent. */
export function buildPauseIntent(input: IntentBuilderInput): RuntimeResult<WorldInteractionIntent> {
  return admitBuilt({
    schema: 'epoch.world-intent',
    intentVersion: 1,
    kind: 'pause',
    intentId: input.invocationId,
  });
}

/** Build the typed resume intent. */
export function buildResumeIntent(input: IntentBuilderInput): RuntimeResult<WorldInteractionIntent> {
  return admitBuilt({
    schema: 'epoch.world-intent',
    intentVersion: 1,
    kind: 'resume',
    intentId: input.invocationId,
  });
}

/** Build the typed branch intent (branch/simulation entry point). */
export function buildBranchIntent(
  input: IntentBuilderInput & { readonly atMs: number },
): RuntimeResult<WorldInteractionIntent> {
  return admitBuilt({
    schema: 'epoch.world-intent',
    intentVersion: 1,
    kind: 'branch',
    intentId: input.invocationId,
    atMs: Math.max(0, Math.trunc(input.atMs)),
  });
}

// ---------------------------------------------------------------------------
// Layer operations (hide / show / filter) + isolation.
// ---------------------------------------------------------------------------

/** Build the typed hide intent for one layer's entities. */
export function buildHideIntent(
  input: IntentBuilderInput & { readonly entityIds: readonly string[] },
): RuntimeResult<WorldInteractionIntent> {
  const entityIds = [...new Set(input.entityIds)].sort();
  if (entityIds.length === 0) {
    return { ok: false, error: { code: 'invalid-intent', message: 'a hide intent requires at least one entity id' } };
  }
  return admitBuilt({
    schema: 'epoch.world-intent',
    intentVersion: 1,
    kind: 'hide',
    intentId: input.invocationId,
    entityIds,
  });
}

/** Build the typed show intent (layer reveal). */
export function buildShowIntent(
  input: IntentBuilderInput & { readonly entityIds: readonly string[] },
): RuntimeResult<WorldInteractionIntent> {
  const entityIds = [...new Set(input.entityIds)].sort();
  if (entityIds.length === 0) {
    return { ok: false, error: { code: 'invalid-intent', message: 'a show intent requires at least one entity id' } };
  }
  return admitBuilt({
    schema: 'epoch.world-intent',
    intentVersion: 1,
    kind: 'show',
    intentId: input.invocationId,
    entityIds,
  });
}

/** Build the typed filter intent (layer isolation: ONLY these entities visible). */
export function buildFilterIntent(
  input: IntentBuilderInput & { readonly includeEntityIds: readonly string[] },
): RuntimeResult<WorldInteractionIntent> {
  const includeEntityIds = [...new Set(input.includeEntityIds)].sort();
  if (includeEntityIds.length === 0) {
    return { ok: false, error: { code: 'invalid-intent', message: 'a filter intent requires at least one entity id' } };
  }
  return admitBuilt({
    schema: 'epoch.world-intent',
    intentVersion: 1,
    kind: 'filter',
    intentId: input.invocationId,
    includeEntityIds,
  });
}

// ---------------------------------------------------------------------------
// Presence + follow.
// ---------------------------------------------------------------------------

/** Build the typed follow-agent intent. */
export function buildFollowAgentIntent(
  input: IntentBuilderInput & { readonly agentId: string },
): RuntimeResult<WorldInteractionIntent> {
  return admitBuilt({
    schema: 'epoch.world-intent',
    intentVersion: 1,
    kind: 'follow-agent',
    intentId: input.invocationId,
    agentId: input.agentId,
  });
}

// ---------------------------------------------------------------------------
// Measurement + annotation affordances (host-side composition over the
// existing typed intents; the pointer seam drives them too).
// ---------------------------------------------------------------------------

/** Build the typed measure intent between two canonical entities. */
export function buildMeasureIntent(
  input: IntentBuilderInput & { readonly fromEntityId: string; readonly toEntityId: string },
): RuntimeResult<WorldInteractionIntent> {
  return admitBuilt({
    schema: 'epoch.world-intent',
    intentVersion: 1,
    kind: 'measure',
    intentId: input.invocationId,
    fromEntityId: input.fromEntityId,
    toEntityId: input.toEntityId,
  });
}

/** Build the typed annotate intent on one canonical entity. */
export function buildAnnotateIntent(
  input: IntentBuilderInput & {
    readonly entityId: string;
    readonly text: string;
    readonly evidenceDigests?: readonly string[] | undefined;
  },
): RuntimeResult<WorldInteractionIntent> {
  return admitBuilt({
    schema: 'epoch.world-intent',
    intentVersion: 1,
    kind: 'annotate',
    intentId: input.invocationId,
    entityId: input.entityId,
    text: input.text,
    ...(input.evidenceDigests !== undefined
      ? { evidenceDigests: [...new Set(input.evidenceDigests)].sort() }
      : {}),
  });
}

/** Build the typed simulate intent (branch/simulation entry point). */
export function buildSimulateIntent(
  input: IntentBuilderInput & { readonly scenarioRef: string },
): RuntimeResult<WorldInteractionIntent> {
  return admitBuilt({
    schema: 'epoch.world-intent',
    intentVersion: 1,
    kind: 'simulate',
    intentId: input.invocationId,
    scenarioRef: input.scenarioRef,
  });
}

// ---------------------------------------------------------------------------
// Scene-control mapping (the candidate/action controls, R30).
// ---------------------------------------------------------------------------

/**
 * Map one scene control's ControlIntent to the workspace intent builder
 * it drives. Controls carry qualified ids (`epoch.world.interaction.*`);
 * the mapping is total — unknown control ids are typed rejections (never
 * silent drops).
 */
export function intentForControl(
  control: ControlIntent,
  scene: WorldScene,
  input: IntentBuilderInput & {
    readonly annotationText?: string | undefined;
    readonly scenarioRef?: string | undefined;
    readonly branchAtMs?: number | undefined;
  },
): RuntimeResult<WorldInteractionIntent> {
  switch (control.id) {
    case 'epoch.world.interaction.pause':
      return buildPauseIntent(input);
    case 'epoch.world.interaction.resume':
      return buildResumeIntent(input);
    case 'epoch.world.interaction.replay':
      return buildReplayIntent({ ...input, fromMs: input.branchAtMs ?? scene.timeline.position.atMs });
    case 'epoch.world.interaction.branch':
      return buildBranchIntent({ ...input, atMs: input.branchAtMs ?? scene.timeline.position.atMs });
    case 'epoch.world.interaction.simulate':
      return buildSimulateIntent({
        ...input,
        scenarioRef: input.scenarioRef ?? 'scenario:default',
      });
    case 'epoch.world.interaction.annotate': {
      const target = scene.focusedEntityIds[0];
      if (target === undefined) {
        return {
          ok: false,
          error: { code: 'invalid-intent', message: 'an annotate control requires a focused entity' },
        };
      }
      return buildAnnotateIntent({
        ...input,
        entityId: target,
        text: input.annotationText ?? 'Workspace annotation',
      });
    }
    default:
      return {
        ok: false,
        error: {
          code: 'input-unsupported',
          message: `the scene control "${control.id}" is not a workspace-eligible interaction (qualified id outside the world-subset vocabulary)`,
        },
      };
  }
}
