/**
 * Input normalization (W058) — raw input envelopes -> the EXISTING typed
 * Epoch world-interaction intent vocabulary.
 *
 * THE CARDINAL RULE: the adapter NEVER authors a parallel vocabulary. Every
 * normalizable input becomes a `WorldInteractionIntent` of the frozen W016
 * grammar (`@epoch/world-experience`), exactly as the contract-only
 * reference adapter does — the fabric then re-admits the intent through the
 * W016 total admission (the Dynamic UI law: adapters are never trusted)
 * and the W013 boundary before it becomes an admitted intent receipt. The
 * adapter performs NO durable write of any kind.
 *
 * Deterministic policies (the conformance-equivalence basis — the same
 * constants the reference adapter uses where the policies are shared):
 *
 * - pointer-down without a hint   -> `select` on the hit entity;
 * - pointer-down + inspect hint   -> `inspect`;
 * - pointer-down + isolate hint   -> `isolate`;
 * - pointer-down + hide hint      -> `hide` (single-entity set);
 * - pointer-down + measure hint   -> the REAL two-click measurement
 *   affordance: the first hinted click anchors the hit entity (no intent
 *   yet — a typed no-target receipt), the second hinted click on a
 *   DIFFERENT entity completes `measure(anchor, hit)`;
 * - pointer-down + annotate hint  -> `annotate` (the adapter authors the
 *   presentation text — see the advisory in docs/rendering/threejs.md);
 * - pointer-down on an AGENT representation -> `follow-agent` (visible
 *   agent representations are interactive presence, not world entities);
 * - wheel                         -> `zoom` (up zooms in 1.25, down out
 *   0.8 — the shared policy) plus the PRESENTATION-ONLY camera dolly;
 * - key space                     -> `pause`/`resume` (the presentation
 *   timeline's paused state toggles);
 * - key r                         -> `replay` from the track start;
 * - arrow keys                    -> PRESENTATION-ONLY orbit (with the
 *   shift modifier: pan) — camera controls are never semantic intents;
 * - pointer-move with a drag anchor (set by the previous pointer-down) ->
 *   PRESENTATION-ONLY orbit; without one -> non-activating no-target;
 * - pointer-up                    -> releases the drag anchor
 *   (non-activating no-target);
 * - anything unrecognized         -> typed `input-unsupported` refusal —
 *   never a silent drop.
 */
import type { FabricResult, KeyInputEnvelope, PointerInputEnvelope, RendererInputEnvelope } from '@epoch/renderer-runtime';
import type {
  WorldInteractionIntent,
} from '@epoch/world-experience';
import { hitTestPointer } from './picking';
import type { ThreeAdapterRuntimeState } from './state';
import {
  ANNOTATION_TEXT_OF_LABEL,
  KEY_TOKENS,
  ORBIT_STEP_RADIANS,
  PAN_STEP_WORLD_UNITS,
  ZOOM_IN_FACTOR,
  ZOOM_OUT_FACTOR,
} from './version';

/** The typed refusal builder (never a silent drop). */
export function inputUnsupported(inputKind: string, reason: string): FabricResult<never> {
  return {
    ok: false,
    error: { code: 'input-unsupported', message: reason, inputKind, reason },
  };
}

/** A no-target translation (the input hit no semantic target). */
function noTarget(reason: string): FabricResult<{ reason: string }> {
  return { ok: true, value: { reason } };
}

/**
 * Translate ONE raw input envelope against the adapter's live presentation
 * state (the runtime state carries the disposable interaction anchors).
 */
export function translateRawInput(
  state: ThreeAdapterRuntimeState,
  input: RendererInputEnvelope,
): FabricResult<{
  hitEntityId?: string;
  intent?: WorldInteractionIntent;
  reason?: string;
}> {
  const presentation = state.presentation;
  const base = {
    schema: 'epoch.world-intent' as const,
    intentVersion: 1 as const,
    intentId: `wi-${input.inputId}`,
  };

  // ---- wheel: zoom intent + presentation-only dolly. ----------------------
  if (input.inputKind === 'wheel') {
    if (input.delta.y === 0) {
      return noTarget('no vertical wheel delta');
    }
    const factor = input.delta.y < 0 ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR;
    presentation?.controls.zoom(factor);
    return {
      ok: true,
      value: {
        intent: { ...base, kind: 'zoom' as const, factor },
        reason: `presentation camera dollied by ${factor}`,
      },
    };
  }

  // ---- pointer kinds. ------------------------------------------------------
  if (
    input.inputKind === 'pointer-down' ||
    input.inputKind === 'pointer-move' ||
    input.inputKind === 'pointer-up'
  ) {
    if (input.inputKind === 'pointer-up') {
      state.pointerAnchor = null;
      return noTarget('camera drag released (presentation-only)');
    }
    if (input.inputKind === 'pointer-move') {
      const anchor = state.pointerAnchor;
      if (anchor !== null && presentation !== null) {
        // Drag-continuation: orbit the presentation camera by the delta.
        presentation.controls.orbit(
          (input.pointer.x - anchor.x) * ORBIT_STEP_RADIANS * 8,
          (input.pointer.y - anchor.y) * ORBIT_STEP_RADIANS * 8,
        );
        state.pointerAnchor = { x: input.pointer.x, y: input.pointer.y };
        return noTarget('camera orbit (presentation-only drag continuation)');
      }
      return noTarget('non-activating pointer input');
    }
    // pointer-down: arm the drag anchor, then resolve the hit.
    state.pointerAnchor = { x: input.pointer.x, y: input.pointer.y };
    if (presentation === null) {
      return noTarget('no mounted presentation to hit-test');
    }
    const hit = hitTestPointer(presentation, input.pointer.x, input.pointer.y);
    if (hit === undefined) {
      return noTarget('the pointer hit no presented entity');
    }
    if (hit.identity.kind === 'agent') {
      // Visible agent representations: presence interaction, not world state.
      return {
        ok: true,
        value: {
          reason: 'agent representation hit',
          intent: { ...base, kind: 'follow-agent' as const, agentId: hit.identity.id },
        },
      };
    }
    const hitEntityId = hit.identity.id;
    return normalizeEntityActivation(state, input, base, hitEntityId);
  }

  // ---- key kinds. ----------------------------------------------------------
  if (input.inputKind === 'key-down') {
    return normalizeKeyDown(state, input, base);
  }
  // key-up: non-activating.
  return noTarget('non-activating key input');
}

/** Normalize one hinted/unhinted pointer-down on a hit semantic entity. */
function normalizeEntityActivation(
  state: ThreeAdapterRuntimeState,
  input: PointerInputEnvelope,
  base: { schema: 'epoch.world-intent'; intentVersion: 1; intentId: string },
  hitEntityId: string,
): FabricResult<{ hitEntityId?: string; intent?: WorldInteractionIntent; reason?: string }> {
  const hint = input.intentHint?.intent.id;
  switch (hint) {
    case undefined:
    case 'epoch.world.interaction.select':
      return {
        ok: true,
        value: { hitEntityId, intent: { ...base, kind: 'select' as const, entityId: hitEntityId } },
      };
    case 'epoch.world.interaction.inspect':
      return {
        ok: true,
        value: { hitEntityId, intent: { ...base, kind: 'inspect' as const, entityId: hitEntityId } },
      };
    case 'epoch.world.interaction.isolate':
      return {
        ok: true,
        value: { hitEntityId, intent: { ...base, kind: 'isolate' as const, entityId: hitEntityId } },
      };
    case 'epoch.world.interaction.hide':
      return {
        ok: true,
        value: {
          hitEntityId,
          intent: { ...base, kind: 'hide' as const, entityIds: [hitEntityId] },
        },
      };
    case 'epoch.world.interaction.measure': {
      if (!state.capabilities.measurement) {
        return inputUnsupported('pointer-down', 'the three.js adapter session does not declare measurement');
      }
      // The REAL two-click measurement affordance.
      if (state.measurementAnchor === null) {
        state.measurementAnchor = hitEntityId;
        return { ok: true, value: { hitEntityId, reason: 'measurement anchor set — the next measure-hinted click completes the measurement' } };
      }
      if (state.measurementAnchor === hitEntityId) {
        return { ok: true, value: { hitEntityId, reason: 'the measurement anchor is unchanged — click a second, different entity to complete the measurement' } };
      }
      const fromEntityId = state.measurementAnchor;
      state.measurementAnchor = null;
      return {
        ok: true,
        value: {
          hitEntityId,
          intent: { ...base, kind: 'measure' as const, fromEntityId, toEntityId: hitEntityId },
        },
      };
    }
    case 'epoch.world.interaction.annotate': {
      if (!state.capabilities.annotation) {
        return inputUnsupported('pointer-down', 'the three.js adapter session does not declare annotation');
      }
      const label =
        state.presentation?.entityLabels.get(hitEntityId) ?? hitEntityId;
      return {
        ok: true,
        value: {
          hitEntityId,
          intent: {
            ...base,
            kind: 'annotate' as const,
            entityId: hitEntityId,
            text: ANNOTATION_TEXT_OF_LABEL(label),
          },
        },
      };
    }
    default:
      return inputUnsupported('pointer-down', `unsupported intent hint "${hint}"`);
  }
}

/** Normalize one key-down (space/r -> semantic intents; arrows -> camera controls). */
function normalizeKeyDown(
  state: ThreeAdapterRuntimeState,
  input: KeyInputEnvelope,
  base: { schema: 'epoch.world-intent'; intentVersion: 1; intentId: string },
): FabricResult<{ hitEntityId?: string; intent?: WorldInteractionIntent; reason?: string }> {
  const key = input.key.key;
  const modifiers = input.key.modifiers;
  const presentation = state.presentation;

  if ((KEY_TOKENS.pauseToggle as readonly string[]).includes(key)) {
    const paused = presentation?.timelinePaused ?? true;
    return {
      ok: true,
      value: {
        intent: paused
          ? { ...base, kind: 'resume' as const }
          : { ...base, kind: 'pause' as const },
      },
    };
  }
  if ((KEY_TOKENS.replay as readonly string[]).includes(key)) {
    const fromMs = presentation?.trackStartMs ?? 0;
    return {
      ok: true,
      value: { intent: { ...base, kind: 'replay' as const, fromMs } },
    };
  }
  const pan = modifiers.includes(KEY_TOKENS.panModifier);
  const step = pan ? PAN_STEP_WORLD_UNITS : ORBIT_STEP_RADIANS;
  if (key === 'arrow-left') {
    if (pan) {
      presentation?.controls.pan(-step, 0);
    } else {
      presentation?.controls.orbit(-step, 0);
    }
    return noTarget('camera control (presentation-only)');
  }
  if (key === 'arrow-right') {
    if (pan) {
      presentation?.controls.pan(step, 0);
    } else {
      presentation?.controls.orbit(step, 0);
    }
    return noTarget('camera control (presentation-only)');
  }
  if (key === 'arrow-up') {
    if (pan) {
      presentation?.controls.pan(0, step);
    } else {
      presentation?.controls.orbit(0, -step);
    }
    return noTarget('camera control (presentation-only)');
  }
  if (key === 'arrow-down') {
    if (pan) {
      presentation?.controls.pan(0, -step);
    } else {
      presentation?.controls.orbit(0, step);
    }
    return noTarget('camera control (presentation-only)');
  }
  return inputUnsupported('key-down', `the three.js adapter does not normalize key "${key}"`);
}
