/**
 * Camera mapping (W059) — the typed bridge between the W016 portable
 * camera grammar (orbit / free / follow-agent, mirrored in contracts/
 * renderers v1.1.0) and Babylon.js cameras.
 *
 * The Babylon camera is PROVIDER-NATIVE PRESENTATION STATE: it is derived
 * from the canonical/portable camera on mount and restore, and captured
 * back into the portable grammar at snapshot time. Camera interpolation and
 * the live camera object are presentation-only (renderer-fabric-architecture);
 * nothing here is semantic state.
 *
 * All conversions are pure and deterministic (no wall clock, no randomness).
 */
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import type { Scene } from '@babylonjs/core/scene.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Quaternion } from '@babylonjs/core/Maths/math.vector.js';
import type {
  PortableCameraState,
  PortableFollowAgentCamera,
  PortableFreeCamera,
  PortableOrbitCamera,
} from '@epoch/renderer-runtime';
import { CAMERA_DEFAULTS } from './version';

/** The provider-native camera union this adapter drives. */
export type BabylonCamera = ArcRotateCamera | FreeCamera;

/** The entity/agent anchor lookups camera mapping needs (deterministic). */
export interface CameraAnchorLookup {
  /** The world position of the followed agent's representation (if any). */
  readonly agentPositionOf?: (agentId: string) => Vector3 | undefined;
}

/** Build the Babylon camera for one portable camera state (pure mapping). */
export function babylonCameraOf(
  scene: Scene,
  camera: PortableCameraState,
  anchors: CameraAnchorLookup = {},
): BabylonCamera {
  switch (camera.mode) {
    case 'orbit':
      return orbitCameraOf(scene, camera);
    case 'free':
      return freeCameraOf(scene, camera);
    case 'follow-agent':
      return followAgentCameraOf(scene, camera, anchors);
  }
}

/** Map one portable orbit camera to a Babylon ArcRotateCamera. */
export function orbitCameraOf(scene: Scene, camera: PortableOrbitCamera): ArcRotateCamera {
  const target = camera.target !== undefined ? vec3Of(camera.target) : Vector3.Zero();
  const position = vec3Of(camera.position);
  const offset = position.subtract(target);
  const radius = Math.max(offset.length(), 0.001);
  // Babylon ArcRotateCamera: alpha = rotation around +Y, beta = elevation
  // from the XZ plane, radius = distance from the target.
  const alpha = Math.atan2(offset.x, offset.z);
  const beta = Math.acos(Math.min(1, Math.max(-1, offset.y / radius)));
  const arc = new ArcRotateCamera('epoch-camera', alpha, beta, radius, target, scene);
  arc.minZ = 0.1;
  arc.maxZ = 2000;
  arc.fov = camera.fovRadians ?? CAMERA_DEFAULTS.fovRadians;
  // The adapter owns input interpretation: Babylon's attached controls are
  // never wired — input arrives through the fabric's typed envelopes only.
  arc.inputs.clear();
  return arc;
}

/** Map one portable free camera to a Babylon FreeCamera. */
export function freeCameraOf(scene: Scene, camera: PortableFreeCamera): FreeCamera {
  const free = new FreeCamera('epoch-camera', vec3Of(camera.position), scene);
  free.minZ = 0.1;
  free.maxZ = 2000;
  if (camera.orientation !== undefined) {
    const [x, y, z, w] = camera.orientation;
    free.rotationQuaternion = new Quaternion(x, y, z, w);
  }
  free.inputs.clear();
  return free;
}

/** Map one portable follow-agent camera to a Babylon ArcRotateCamera. */
export function followAgentCameraOf(
  scene: Scene,
  camera: PortableFollowAgentCamera,
  anchors: CameraAnchorLookup,
): ArcRotateCamera {
  const anchor =
    anchors.agentPositionOf?.(camera.agentRef.agentId) ??
    Vector3.Zero(); // deterministic fallback: the world origin
  const arc = new ArcRotateCamera(
    'epoch-camera',
    CAMERA_DEFAULTS.alpha,
    CAMERA_DEFAULTS.beta,
    camera.followDistance ?? CAMERA_DEFAULTS.followDistance,
    anchor,
    scene,
  );
  arc.minZ = 0.1;
  arc.maxZ = 2000;
  arc.inputs.clear();
  return arc;
}

/** Capture the LIVE Babylon camera back into the portable grammar. */
export function portableCameraOf(camera: BabylonCamera): PortableCameraState {
  if (camera instanceof ArcRotateCamera) {
    const target = camera.target;
    const position = camera.position;
    const portable: PortableOrbitCamera = {
      mode: 'orbit',
      position: [position.x, position.y, position.z],
      target: [target.x, target.y, target.z],
      fovRadians: camera.fov,
    };
    return portable;
  }
  const free = camera as FreeCamera;
  const position = free.position;
  const orientation = free.rotationQuaternion;
  const portable: PortableFreeCamera = {
    mode: 'free',
    position: [position.x, position.y, position.z],
    ...(orientation !== undefined && orientation !== null
      ? { orientation: [orientation.x, orientation.y, orientation.z, orientation.w] as [number, number, number, number] }
      : {}),
  };
  return portable;
}

/**
 * Apply one presentation-only camera zoom step to the live camera (the
 * semantic zoom intent is normalized separately — this is the presentation
 * reaction only): an orbit camera scales its radius; a free camera steps
 * along its forward direction proportionally.
 */
export function zoomBabylonCamera(camera: BabylonCamera, factor: number): void {
  if (camera instanceof ArcRotateCamera) {
    camera.radius = Math.max(camera.radius / factor, 0.01);
    return;
  }
  const free = camera as FreeCamera;
  const forward = free.getDirection(Vector3.Forward());
  const step = 10 * (1 / factor - 1);
  free.position.addInPlace(forward.scale(step));
}

/**
 * Apply one presentation-only pointer-drag orbit step (deltas are
 * normalized viewport units): an orbit camera adjusts alpha/beta; a free
 * camera yaws/pitches. Camera movement is presentation-only.
 */
export function orbitBabylonCamera(
  camera: BabylonCamera,
  deltaX: number,
  deltaY: number,
): void {
  if (camera instanceof ArcRotateCamera) {
    camera.alpha += deltaX * CAMERA_DEFAULTS.orbitSensitivity;
    camera.beta = Math.min(Math.PI - 0.01, Math.max(0.01, camera.beta + deltaY * CAMERA_DEFAULTS.orbitSensitivity));
    return;
  }
  const free = camera as FreeCamera;
  free.rotation.y += deltaX * CAMERA_DEFAULTS.orbitSensitivity;
  free.rotation.x = Math.min(Math.PI / 2 - 0.01, Math.max(-Math.PI / 2 + 0.01, free.rotation.x + deltaY * CAMERA_DEFAULTS.orbitSensitivity));
}

/**
 * Apply one presentation-only pointer-drag pan step (orbit camera target
 * shift in the camera plane; free camera position shift).
 */
export function panBabylonCamera(
  camera: BabylonCamera,
  deltaX: number,
  deltaY: number,
): void {
  const scale = CAMERA_DEFAULTS.panSensitivity;
  if (camera instanceof ArcRotateCamera) {
    const right = camera.getDirection(Vector3.Right()).scale(-deltaX * scale);
    const up = camera.getDirection(Vector3.Up()).scale(deltaY * scale);
    camera.target.addInPlace(right).addInPlace(up);
    return;
  }
  const free = camera as FreeCamera;
  const right = free.getDirection(Vector3.Right()).scale(-deltaX * scale);
  const up = free.getDirection(Vector3.Up()).scale(deltaY * scale);
  free.position.addInPlace(right).addInPlace(up);
}

/** Map a canonical Vec3 to a Babylon Vector3. */
export function vec3Of(value: readonly [number, number, number]): Vector3 {
  return new Vector3(value[0], value[1], value[2]);
}
