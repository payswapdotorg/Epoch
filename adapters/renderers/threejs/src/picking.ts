/**
 * Hit testing (W058) — pointer input -> semantic identity, through the REAL
 * Three.js Raycaster against the built scene graph.
 *
 * This is the adapter's authoritative input resolution: a normalized
 * pointer position (the W056 envelope grammar, [0,1] both axes) becomes an
 * NDC ray through the presentation camera; the ray is intersected against
 * the world and presence groups; and the FIRST intersection that resolves
 * to a semantic identity (`src/semantics.ts` — entity meshes, decorations
 * under them, measurement lines, agent representations) wins.
 *
 * Presentation-side view filters are honored EXPLICITLY: Three.js's
 * Raycaster does not skip `visible: false` subtrees, so this module filters
 * invisible intersections itself (hidden entities and hidden semantic
 * layers never hit). Decorations that carry no semantic identity (presence
 * seats, un-marked helpers) are skipped — they are presentation, not
 * interaction targets.
 */
import { Raycaster, Vector2, Vector3, type Object3D, type PerspectiveCamera } from 'three';
import type { SemanticIdentity } from './semantics';
import { semanticIdentityOf } from './semantics';
import type { ThreePresentation } from './scene-graph';

/** The resolved target of one pointer hit-test. */
export interface PointerHit {
  readonly identity: SemanticIdentity;
  /** The distance from the camera to the hit point (nearest-first evidence). */
  readonly distance: number;
}

/** Whether one object AND every ancestor up to the scene root are visible. */
function isEffectivelyVisible(object: Object3D, root: Object3D): boolean {
  let node: Object3D | null = object;
  while (node !== null) {
    if (!node.visible) {
      return false;
    }
    if (node === root) {
      return true;
    }
    node = node.parent;
  }
  return true;
}

/**
 * Hit-test one normalized pointer position ([0,1] both axes, y measured
 * from the top of the viewport — the W056 envelope grammar) against the
 * presentation. Pure with respect to the scene graph (no mutation beyond
 * Three.js matrix refreshes).
 */
export function hitTestPointer(
  presentation: ThreePresentation,
  x: number,
  y: number,
): PointerHit | undefined {
  // Three.js hit-testing reads matrixWorld state: refresh the whole
  // presentation graph AND the camera before casting (a renderer's render
  // loop would have done this; headless callers must do it explicitly).
  presentation.root.updateMatrixWorld(true);
  const camera: PerspectiveCamera = presentation.controls.camera;
  camera.updateMatrixWorld(true);
  const raycaster = new Raycaster();
  // Normalized device coordinates: x in [-1, 1] left->right, y in [-1, 1]
  // bottom->top (the envelope's y is top-down, hence the sign flip).
  const ndc = new Vector2(x * 2 - 1, 1 - y * 2);
  raycaster.setFromCamera(ndc, camera);
  const candidates: Object3D[] = [
    ...presentation.worldGroup.children,
    ...presentation.presenceGroup.children,
  ];
  const intersections = raycaster.intersectObjects(candidates, true);
  for (const intersection of intersections) {
    // Presentation-side view filters: invisible subtrees never hit.
    if (!isEffectivelyVisible(intersection.object, presentation.root)) {
      continue;
    }
    const identity = semanticIdentityOf(intersection.object);
    if (identity !== undefined) {
      return { identity, distance: intersection.distance };
    }
  }
  return undefined;
}

/**
 * The normalized pointer position at which one semantic entity's (or one
 * agent representation's) presentation node currently projects (the
 * EVIDENCE helper the conformance battery uses to target entities
 * honestly: the pointer is DERIVED from the real projection instead of
 * being guessed).
 */
export function projectedPointerOf(
  presentation: ThreePresentation,
  entityId: string,
): { x: number; y: number } | undefined {
  const node =
    presentation.entityNodes.get(entityId) ??
    presentation.agentNodes.get(entityId) ??
    undefined;
  if (node === undefined) {
    return undefined;
  }
  const camera = presentation.controls.camera;
  presentation.root.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const projected = node.getWorldPosition(new Vector3()).project(camera);
  if (projected.z > 1 || projected.z < -1) {
    return undefined; // behind the camera / clipped
  }
  return { x: (projected.x + 1) / 2, y: (1 - projected.y) / 2 };
}
