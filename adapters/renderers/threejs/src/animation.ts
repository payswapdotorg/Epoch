/**
 * Animation playback at VIRTUAL time (W058) — the deterministic alternative
 * to wall-clock tweening.
 *
 * The adapter NEVER reads a wall clock: every frame envelope carries the
 * caller-supplied virtual time, and animation instructions (canonical W016
 * typed data) are evaluated AT that time — the same input always produces
 * the same presentation (byte-reproducible runs; the W056 discipline).
 *
 * Playback mutates ONLY disposable presentation state (node transforms and
 * material opacity). The canonical scene is never touched.
 */
import { Mesh, MeshStandardMaterial, Quaternion, type Material } from 'three';
import type { AnimationInstruction } from '@epoch/world-experience';
import type { Keyframe } from '@epoch/experience-protocol';
import type { ThreePresentation } from './scene-graph';

/** The outcome of one animation pass (frame-report notes). */
export interface AnimationPass {
  readonly applied: number;
  readonly skippedPaths: readonly string[];
}

/** The eased interpolation factor between two keyframes (deterministic). */
function easeFactor(easing: Keyframe['easing'], t: number): number {
  switch (easing ?? 'linear') {
    case 'step':
      return t >= 1 ? 1 : 0;
    case 'ease-in':
      return t * t;
    case 'ease-out':
      return 1 - (1 - t) * (1 - t);
    case 'ease-in-out':
      return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
    case 'linear':
    default:
      return t;
  }
}

/** Interpolate one JSON value between two keyframes (numbers and tuples). */
function interpolateValue(a: unknown, b: unknown, factor: number): unknown {
  if (typeof a === 'number' && typeof b === 'number') {
    return a + (b - a) * factor;
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    return a.map((component, index) => {
      const other = b[index];
      return typeof component === 'number' && typeof other === 'number'
        ? component + (other - component) * factor
        : component;
    });
  }
  return factor >= 1 ? b : a;
}

/** Evaluate one instruction at a virtual time (pure). */
function evaluateAt(instruction: AnimationInstruction, atMs: number): unknown {
  const offset = atMs - (instruction.startAtMs ?? 0);
  const clamped = instruction.loop
    ? Math.max(0, offset) % Math.max(1, instruction.durationMs)
    : Math.min(Math.max(0, offset), instruction.durationMs);
  const keyframes = instruction.keyframes;
  if (keyframes.length === 1) {
    return keyframes[0]!.value;
  }
  for (let i = 1; i < keyframes.length; i += 1) {
    const previous = keyframes[i - 1]!;
    const current = keyframes[i]!;
    if (clamped <= current.atMs) {
      const span = Math.max(1, current.atMs - previous.atMs);
      const t = (clamped - previous.atMs) / span;
      const eased = easeFactor(current.easing ?? instruction.easing, Math.min(1, Math.max(0, t)));
      return interpolateValue(previous.value, current.value, eased);
    }
  }
  return keyframes[keyframes.length - 1]!.value;
}

/**
 * Apply the animation instructions to the presentation at one virtual
 * time. Presentation-only: node transforms and material opacity. The
 * `static-frame` degradation must be checked by the caller (frozen frames
 * skip this pass entirely).
 */
export function evaluateAnimations(presentation: ThreePresentation, atMs: number): AnimationPass {
  let applied = 0;
  const skipped: string[] = [];
  for (const instruction of presentation.animations) {
    const node = presentation.entityNodes.get(instruction.targetEntityId);
    if (node === undefined) {
      skipped.push(`${instruction.instructionId} (target not presented)`);
      continue;
    }
    const value = evaluateAt(instruction, atMs);
    const path = instruction.propertyPath;
    if (path === 'position' && Array.isArray(value) && value.length === 3) {
      node.position.set(value[0] as number, value[1] as number, value[2] as number);
    } else if (path === 'scale' && Array.isArray(value) && value.length === 3) {
      node.scale.set(value[0] as number, value[1] as number, value[2] as number);
    } else if (path === 'orientation' && Array.isArray(value) && value.length === 4) {
      node.quaternion.set(value[0] as number, value[1] as number, value[2] as number, value[3] as number);
      node.quaternion.normalize();
    } else if (
      path === 'position.x' ||
      path === 'position.y' ||
      path === 'position.z' ||
      path === 'scale.x' ||
      path === 'scale.y' ||
      path === 'scale.z'
    ) {
      if (typeof value === 'number') {
        const [group, axis] = path.split('.') as ['position' | 'scale', 'x' | 'y' | 'z'];
        if (group === 'position') {
          node.position[axis] = value;
        } else {
          node.scale[axis] = value;
        }
      }
    } else if (path === 'opacity' && typeof value === 'number') {
      const material: Material | Material[] = node.material;
      const single = Array.isArray(material) ? material[0] : material;
      if (single instanceof MeshStandardMaterial) {
        single.transparent = value < 1;
        single.opacity = Math.min(1, Math.max(0, value));
      }
    } else {
      skipped.push(`${instruction.instructionId} (${path})`);
      continue;
    }
    applied += 1;
  }
  return { applied, skippedPaths: skipped.sort() };
}

/** Whether one instruction is currently animating (evidence helper). */
export function animationTargetIds(presentation: ThreePresentation): readonly string[] {
  return presentation.animations.map((instruction) => instruction.targetEntityId).sort();
}

// Re-exported for evidence helpers that need quaternion math.
export { Quaternion, Mesh };
