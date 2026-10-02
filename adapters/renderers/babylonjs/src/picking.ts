/**
 * Semantic picking (W059) — Babylon picking -> SEMANTIC ENTITY IDS.
 *
 * The adapter's hit-test is Babylon's own `scene.pick` over the entity
 * meshes (each carrying `metadata.epochEntityId`), with the picking
 * predicate restricted to pickable ENTITY meshes — agents, proxies and
 * helper nodes never resolve as world entities.
 *
 * Headless determinism (the CI battery): picking needs the camera's
 * view/projection matrices and the meshes' world matrices. Instead of a
 * wall-clock render loop, {@link ensurePickable} recomputes both
 * deterministically (`scene.setTransformMatrix(camera.getViewMatrix(),
 * camera.getProjectionMatrix())` + `mesh.computeWorldMatrix(true)`), so the
 * same normalized pointer always resolves the same semantic entity —
 * verified against @babylonjs/core 9.29.0's NullEngine.
 *
 * Pointer convention: `RendererInputEnvelope.pointer` is normalized
 * [0, 1] viewport space with the origin at the TOP-LEFT (screen-like), the
 * same convention a browser pointer event carries.
 */
import type { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import '@babylonjs/core/Culling/ray.js';
import type { Scene } from '@babylonjs/core/scene.js';
import type { TargetCamera } from '@babylonjs/core/Cameras/targetCamera.js';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine.js';
import type { BabylonEntityMetadata } from './mapping';

/** Deterministically refresh the matrices picking depends on. */
export function ensurePickable(scene: Scene, camera: TargetCamera, entityMeshes: Iterable<Mesh>): void {
  camera.getViewMatrix();
  camera.getProjectionMatrix();
  scene.setTransformMatrix(camera.getViewMatrix(), camera.getProjectionMatrix());
  for (const mesh of entityMeshes) {
    mesh.computeWorldMatrix(true);
  }
}

/** The picking predicate: pickable, enabled meshes that carry an entity id. */
export function isEntityMesh(mesh: unknown): boolean {
  const candidate = mesh as Mesh;
  return (
    candidate.isEnabled() &&
    candidate.isPickable &&
    typeof candidate.metadata === 'object' &&
    candidate.metadata !== null &&
    typeof (candidate.metadata as BabylonEntityMetadata).epochEntityId === 'string'
  );
}

/** Clamp a value into [lo, hi]. */
function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/** Map a normalized pointer to engine pixel coordinates (top-left origin). */
export function pixelPositionOf(
  engine: AbstractEngine,
  x: number,
  y: number,
): { readonly px: number; readonly py: number } {
  const width = engine.getRenderWidth();
  const height = engine.getRenderHeight();
  return {
    px: clamp(Math.floor(x * width), 0, Math.max(0, width - 1)),
    py: clamp(Math.floor(y * height), 0, Math.max(0, height - 1)),
  };
}

/**
 * Hit-test one normalized pointer position against the Babylon scene and
 * return the SEMANTIC ENTITY ID it hit (null when nothing was hit).
 * Deterministic: the same scene graph + camera + pointer always resolve
 * the same entity.
 */
export function pickEntityAt(
  scene: Scene,
  camera: TargetCamera,
  engine: AbstractEngine,
  entityMeshes: Iterable<Mesh>,
  x: number,
  y: number,
): string | null {
  const { px, py } = pixelPositionOf(engine, x, y);
  ensurePickable(scene, camera, entityMeshes);
  const pick = scene.pick(px, py, isEntityMesh);
  if (pick === null || !pick.hit || pick.pickedMesh === null) {
    return null;
  }
  const metadata = pick.pickedMesh.metadata as BabylonEntityMetadata | undefined;
  return metadata?.epochEntityId ?? null;
}

/**
 * Project one entity mesh's world position to normalized viewport
 * coordinates (the INVERSE mapping — deterministic, used by tests, agents
 * and the follow surface; the same matrix discipline as picking).
 */
export function projectedPositionOf(
  scene: Scene,
  camera: TargetCamera,
  engine: AbstractEngine,
  entityMeshes: Iterable<Mesh>,
  mesh: Mesh,
): { readonly x: number; readonly y: number } {
  ensurePickable(scene, camera, entityMeshes);
  const width = engine.getRenderWidth();
  const height = engine.getRenderHeight();
  const projected = Vector3.Project(
    mesh.getAbsolutePosition(),
    Matrix.IdentityReadOnly,
    scene.getTransformMatrix(),
    camera.viewport.toGlobal(width, height),
  );
  return { x: projected.x / width, y: projected.y / height };
}
