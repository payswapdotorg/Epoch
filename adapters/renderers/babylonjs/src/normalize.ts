/**
 * Input normalization policy (W059) — raw renderer input -> the EXISTING
 * typed W016 world-interaction intent vocabulary.
 *
 * This policy is deliberately RENDERER-INDEPENDENT and member-for-member
 * aligned with the W056 seam template (`packages/renderer-fabric/src/
 * reference/reference-adapter.ts`) so equivalent inputs normalize to
 * equivalent intents on EVERY renderer:
 *
 * - pointer-down without a hint normalizes to a W016 `select` intent on the
 *   hit entity;
 * - pointer-down with an intent hint normalizes to the hinted W016 intent
 *   kind (select/inspect/isolate/hide/measure/annotate) targeting the hit
 *   entity; measurement pairs the hit entity with the NEXT presented entity
 *   in sorted order (wrapping) — the renderer-independent pairing policy;
 * - wheel normalizes to a W016 `zoom` intent (scroll up zooms in: factor
 *   1.25; scroll down zooms out: factor 0.8);
 * - pointer-move / pointer-up are non-activating (no-target, no intent —
 *   camera reactions are presentation-only, handled by the adapter);
 * - key input: zoom keys (`+`/`-`/`=`) normalize to W016 `zoom` intents;
 *   camera keys (arrows/WASD) are presentation-only camera controls
 *   (no-target); every other key is a TYPED `input-unsupported` refusal —
 *   never a silent drop, never a parallel vocabulary.
 *
 * The adapter NEVER writes: the normalized intent flows back through the
 * fabric, which re-admits it through the W016 total admission (the Dynamic
 * UI law — adapters are never trusted) before it reaches any authority.
 */
import type { WorldInteractionIntent } from '@epoch/world-experience';
import { HINT_INTENT_IDS, WORLD_INTENT_TYPE_VERSION, ZOOM_IN_FACTOR, ZOOM_OUT_FACTOR } from './version';

/** The keyboard keys that normalize to zoom intents. */
const ZOOM_IN_KEYS = new Set(['+', '=']);
const ZOOM_OUT_KEYS = new Set(['-', '_']);

/** The keyboard keys that drive the presentation-only camera. */
const CAMERA_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'w',
  'a',
  's',
  'd',
]);

/** The set of hint intent ids this adapter understands (sorted). */
export const SUPPORTED_HINT_IDS: readonly string[] = Object.values(HINT_INTENT_IDS).sort();

/** The base fields every W016 intent carries (deterministic id derivation). */
function baseIntent(inputId: string): Pick<WorldInteractionIntent, 'schema' | 'intentVersion' | 'intentId'> {
  return {
    schema: 'epoch.world-intent',
    intentVersion: 1,
    intentId: `wi-${inputId}`,
  };
}

/** The next presented entity id in sorted order (wrapping; null when < 2). */
export function nextPresentedEntityOf(
  presentedIds: readonly string[],
  entityId: string,
): string | null {
  if (presentedIds.length < 2) {
    return null;
  }
  const index = presentedIds.indexOf(entityId);
  if (index === -1) {
    return null;
  }
  return presentedIds[(index + 1) % presentedIds.length] ?? null;
}

/** Build the zoom intent of one wheel/zoom-key input (deterministic factors). */
export function zoomIntentOf(inputId: string, deltaY: number): WorldInteractionIntent {
  return {
    ...baseIntent(inputId),
    kind: 'zoom',
    factor: deltaY < 0 ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR,
  };
}

/** The declaration gates the hinted intents consult (mirrors capability flags). */
export interface NormalizationCapabilities {
  readonly measurement: boolean;
  readonly annotation: boolean;
}

/** One normalization decision (the adapter maps it to a typed translation). */
export type NormalizationOutcome =
  | { readonly outcome: 'no-target'; readonly reason: string }
  | { readonly outcome: 'normalized'; readonly intent: WorldInteractionIntent }
  | { readonly outcome: 'refused'; readonly reason: string };

/**
 * Normalize one pointer-down input against a hit entity (pure policy — the
 * Babylon-specific hit-test already resolved `hitEntityId`).
 */
export function normalizePointerDown(
  inputId: string,
  hitEntityId: string | null,
  hint: { readonly id: string; readonly version: string } | undefined,
  presentedEntityIds: readonly string[],
  capabilities: NormalizationCapabilities,
  annotationText: string,
): NormalizationOutcome {
  if (hitEntityId === null) {
    return { outcome: 'no-target', reason: 'the pointer hit no presented entity' };
  }
  const hintId = hint?.id;
  switch (hintId) {
    case undefined:
    case HINT_INTENT_IDS.select:
      return {
        outcome: 'normalized',
        intent: { ...baseIntent(inputId), kind: 'select', entityId: hitEntityId },
      };
    case HINT_INTENT_IDS.inspect:
      return {
        outcome: 'normalized',
        intent: { ...baseIntent(inputId), kind: 'inspect', entityId: hitEntityId },
      };
    case HINT_INTENT_IDS.isolate:
      return {
        outcome: 'normalized',
        intent: { ...baseIntent(inputId), kind: 'isolate', entityId: hitEntityId },
      };
    case HINT_INTENT_IDS.hide:
      return {
        outcome: 'normalized',
        intent: { ...baseIntent(inputId), kind: 'hide', entityIds: [hitEntityId] },
      };
    case HINT_INTENT_IDS.measure: {
      if (!capabilities.measurement) {
        return { outcome: 'refused', reason: 'the adapter does not declare measurement' };
      }
      const next = nextPresentedEntityOf(presentedEntityIds, hitEntityId);
      if (next === null) {
        return { outcome: 'refused', reason: 'no second presented entity to measure against' };
      }
      return {
        outcome: 'normalized',
        intent: { ...baseIntent(inputId), kind: 'measure', fromEntityId: hitEntityId, toEntityId: next },
      };
    }
    case HINT_INTENT_IDS.annotate: {
      if (!capabilities.annotation) {
        return { outcome: 'refused', reason: 'the adapter does not declare annotation' };
      }
      return {
        outcome: 'normalized',
        intent: { ...baseIntent(inputId), kind: 'annotate', entityId: hitEntityId, text: annotationText },
      };
    }
    default:
      return { outcome: 'refused', reason: `unsupported intent hint "${hintId}"` };
  }
}

/**
 * Normalize one keyboard input (pure policy). Camera keys are
 * presentation-only (the adapter orbits/pans its camera; no semantic
 * intent); zoom keys normalize to the same W016 zoom intent as the wheel.
 */
export function normalizeKey(
  inputId: string,
  key: { readonly key: string; readonly modifiers: readonly string[] },
  inputKind: 'key-down' | 'key-up',
): NormalizationOutcome {
  if (inputKind === 'key-up') {
    return { outcome: 'no-target', reason: 'key release is non-activating' };
  }
  if (key.modifiers.length > 0) {
    return { outcome: 'refused', reason: `no keyboard binding is declared for "${key.key}" with modifiers [${[...key.modifiers].join(', ')}]` };
  }
  if (ZOOM_IN_KEYS.has(key.key) || ZOOM_OUT_KEYS.has(key.key)) {
    return {
      outcome: 'normalized',
      intent: zoomIntentOf(inputId, ZOOM_IN_KEYS.has(key.key) ? -1 : 1),
    };
  }
  if (CAMERA_KEYS.has(key.key)) {
    return { outcome: 'no-target', reason: `the "${key.key}" key drives the presentation-only camera` };
  }
  return { outcome: 'refused', reason: `no keyboard binding is declared for "${key.key}"` };
}

/** The intent-type version every normalized intent bridges to (R30). */
export const INTENT_TYPE_VERSION = WORLD_INTENT_TYPE_VERSION;
