/**
 * Typed presentation degradations (W058) — declared fidelity reductions,
 * applied as PRESENTATION-ONLY state.
 *
 * A degradation may never alter semantics (the W056 taxonomy): each kind
 * below changes only disposable presentation state and is fully reversible
 * when the frame envelope carries `none` again:
 *
 * - `wireframe` — every presentation material renders as wireframe;
 * - `reduced-fidelity` — curved primitives rebuild at the reduced radial
 *   segment count (the small-screen LOD policy);
 * - `static-frame` — animation evaluation and the presentation timeline
 *   freeze (frame indices still advance; the picture holds);
 * - `none` — full fidelity restored (wireframe off, full LOD, playback on).
 *
 * The adapter declares exactly these kinds in its capability set; the
 * fabric refuses UNDECLARED degradations before the adapter sees them, and
 * the adapter re-checks (defense in depth) with the same typed failure.
 */
import {
  ConeGeometry,
  CylinderGeometry,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import type { RendererDegradationKind } from '@epoch/renderer-runtime';
import type { ThreePresentation } from './scene-graph';
import { FULL_FIDELITY_SEGMENTS, REDUCED_FIDELITY_SEGMENTS } from './version';

/** The curved primitives of the W011 spatial vocabulary (the LOD knobs). */
const CURVED_PRIMITIVES = new Set(['cone', 'cylinder', 'sphere']);

/** Set the wireframe flag of any material that carries one. */
function setWireframe(material: Material, wireframe: boolean): void {
  if ('wireframe' in material) {
    (material as unknown as { wireframe: boolean }).wireframe = wireframe;
  }
}

/**
 * Apply one degradation to the presentation (idempotent; transitions only
 * touch what changed). Returns the typed notes for the frame report.
 */
export function applyDegradation(
  presentation: ThreePresentation,
  kind: RendererDegradationKind,
): string {
  if (presentation.degradation === kind) {
    return `degradation "${kind}" already applied`;
  }
  const previous = presentation.degradation;
  presentation.degradation = kind;

  // Wireframe toggling (cheap and fully reversible).
  const wireframe = kind === 'wireframe';
  if (previous === 'wireframe' || wireframe) {
    for (const node of presentation.entityNodes.values()) {
      const material: Material | Material[] = node.material;
      const single = Array.isArray(material) ? material[0] : material;
      if (single !== undefined) {
        setWireframe(single, wireframe);
      }
    }
  }

  // LOD rebuilding (only when the target segment count changes).
  const targetSegments =
    kind === 'reduced-fidelity' ? REDUCED_FIDELITY_SEGMENTS : FULL_FIDELITY_SEGMENTS;
  if (presentation.lodSegments !== targetSegments) {
    rebuildLod(presentation, targetSegments);
    presentation.lodSegments = targetSegments;
  }

  // static-frame freezes playback (the frame loop checks the flag).
  return `degradation "${previous}" -> "${kind}"`;
}

/** Rebuild every curved primitive at a new radial segment count. */
function rebuildLod(presentation: ThreePresentation, segments: number): void {
  for (const node of presentation.entityNodes.values()) {
    const primitive = node.userData['epochPrimitive'];
    if (typeof primitive !== 'string' || !CURVED_PRIMITIVES.has(primitive)) {
      continue;
    }
    const geometry = buildPrimitiveGeometry(primitive, segments);
    if (geometry === null) {
      continue;
    }
    const previous = node.geometry;
    node.geometry = presentation.ledger.registerGeometry(geometry);
    previous.dispose();
  }
}

/** Build one primitive's geometry at a segment count (the mount recipe). */
function buildPrimitiveGeometry(primitive: string, segments: number): BufferGeometry | null {
  switch (primitive) {
    case 'sphere':
      return new SphereGeometry(0.5, segments, Math.max(4, Math.floor(segments / 2)));
    case 'cone':
      return new ConeGeometry(0.5, 1, segments);
    case 'cylinder':
      return new CylinderGeometry(0.5, 0.5, 1, segments);
    default:
      return null;
  }
}

/** Whether playback is frozen under the current degradation (static-frame). */
export function playbackFrozen(presentation: ThreePresentation): boolean {
  return presentation.degradation === 'static-frame';
}
