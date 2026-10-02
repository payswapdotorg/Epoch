/**
 * Camera controls (W058) — orbit/pan/zoom as PRESENTATION-ONLY state.
 *
 * The canonical W016 camera record (the world scene's `camera`) is the only
 * camera state that crosses the seam; the adapter derives its presentation
 * camera from it at mount. Everything the user does afterwards (orbiting,
 * panning, zooming, camera interpolation) mutates ONLY this presentation
 * state — it is disposable, never semantic, and is summarized back into the
 * portable orbit-camera grammar at snapshot capture (the best-effort
 * viewpoint that survives a renderer switch).
 *
 * Deterministic math only: fixed step constants (src/version.ts), zero
 * wall-clock, zero randomness.
 */
import { PerspectiveCamera, Vector3 } from 'three';
import type { Vec3 } from '@epoch/experience-protocol';
import type { PortableCameraState } from '@epoch/renderer-runtime';
import type { CameraState } from '@epoch/world-experience';
import {
  CAMERA_FAR_PLANE,
  CAMERA_NEAR_PLANE,
  DEFAULT_CAMERA_FOV_RADIANS,
} from './version';

/**
 * The presentation camera controls: a perspective camera plus its orbit
 * target, with the three discrete user controls (orbit / pan / zoom).
 */
export class CameraControls {
  public readonly camera: PerspectiveCamera;
  private readonly target: Vector3;

  constructor(
    position: Vec3,
    target: Vec3,
    fovRadians: number = DEFAULT_CAMERA_FOV_RADIANS,
    aspect = 1,
  ) {
    this.camera = new PerspectiveCamera(
      (fovRadians * 180) / Math.PI,
      aspect,
      CAMERA_NEAR_PLANE,
      CAMERA_FAR_PLANE,
    );
    this.camera.position.set(position[0], position[1], position[2]);
    this.target = new Vector3(target[0], target[1], target[2]);
    this.camera.lookAt(this.target);
  }

  /**
   * Orbit: rotate the camera position around the target on the horizontal
   * (azimuth) and vertical (elevation) axes. Clamped so the camera never
   * crosses the poles (deterministic presentation policy).
   */
  orbit(azimuthRadians: number, elevationRadians: number): void {
    const offset = this.camera.position.clone().sub(this.target);
    const radius = offset.length();
    if (radius === 0) {
      return;
    }
    // Spherical coordinates (Y-up, matching the Three.js convention).
    let theta = Math.atan2(offset.x, offset.z);
    let phi = Math.acos(Math.min(1, Math.max(-1, offset.y / radius)));
    theta += azimuthRadians;
    phi = Math.min(Math.PI - 1e-3, Math.max(1e-3, phi + elevationRadians));
    const sinPhi = Math.sin(phi);
    this.camera.position.set(
      this.target.x + radius * sinPhi * Math.sin(theta),
      this.target.y + radius * Math.cos(phi),
      this.target.z + radius * sinPhi * Math.cos(theta),
    );
    this.camera.lookAt(this.target);
  }

  /** Pan: translate the camera position AND target along the camera's screen axes. */
  pan(rightUnits: number, upUnits: number): void {
    const forward = this.target.clone().sub(this.camera.position).normalize();
    const right = new Vector3().crossVectors(this.camera.up, forward).normalize();
    const up = new Vector3().crossVectors(forward, right).normalize();
    const delta = right.multiplyScalar(rightUnits).add(up.multiplyScalar(upUnits));
    this.camera.position.add(delta);
    this.target.add(delta);
    this.camera.lookAt(this.target);
  }

  /** Zoom: scale the distance between the camera and its target by 1/factor. */
  zoom(factor: number): void {
    if (factor <= 0) {
      return;
    }
    const offset = this.camera.position.clone().sub(this.target).multiplyScalar(1 / factor);
    this.camera.position.copy(this.target).add(offset);
    this.camera.lookAt(this.target);
  }

  /** The current viewpoint as the portable orbit-camera grammar (snapshot capture). */
  toPortableCamera(): PortableCameraState {
    return {
      mode: 'orbit',
      position: [this.camera.position.x, this.camera.position.y, this.camera.position.z],
      target: [this.target.x, this.target.y, this.target.z],
      fovRadians: (this.camera.fov * Math.PI) / 180,
    };
  }

  /** Apply a portable camera state (the switch-restore step). */
  applyPortableCamera(state: PortableCameraState): void {
    if (state.mode === 'orbit') {
      this.camera.position.set(state.position[0], state.position[1], state.position[2]);
      this.target.set(
        state.target?.[0] ?? 0,
        state.target?.[1] ?? 0,
        state.target?.[2] ?? 0,
      );
      if (state.fovRadians !== undefined) {
        this.camera.fov = (state.fovRadians * 180) / Math.PI;
        this.camera.updateProjectionMatrix();
      }
      this.camera.lookAt(this.target);
      return;
    }
    if (state.mode === 'free') {
      this.camera.position.set(state.position[0], state.position[1], state.position[2]);
      if (state.orientation !== undefined) {
        this.camera.quaternion.set(
          state.orientation[0],
          state.orientation[1],
          state.orientation[2],
          state.orientation[3],
        );
      }
      this.target.copy(this.camera.position).add(this.camera.getWorldDirection(new Vector3()));
      return;
    }
    // follow-agent: the presentation camera keeps its current viewpoint and
    // tracks the followed agent's marker on later frames (the follow target
    // is the agent representation, not a fixed point).
    if (state.cursor?.position3d !== undefined) {
      this.target.set(
        state.cursor.position3d[0],
        state.cursor.position3d[1],
        state.cursor.position3d[2],
      );
      this.camera.lookAt(this.target);
    }
  }

  /** The current orbit target (evidence helper). */
  targetVector(): Vec3 {
    return [this.target.x, this.target.y, this.target.z];
  }
}

/**
 * Derive the initial presentation camera from the canonical W016 camera
 * record plus a deterministic fallback (scene centroid) when the record
 * carries no explicit viewpoint.
 */
export function initialCameraOf(
  canonical: CameraState,
  sceneCentroid: Vec3,
): { position: Vec3; target: Vec3; fovRadians?: number } {
  if (canonical.mode === 'orbit') {
    return {
      position: canonical.position,
      target: canonical.target ?? sceneCentroid,
      fovRadians: canonical.fovRadians,
    };
  }
  if (canonical.mode === 'free') {
    // A free camera orbits its own look-ahead point for presentation
    // purposes; the orientation (when present) is applied by the caller.
    return { position: canonical.position, target: sceneCentroid };
  }
  // follow-agent: present from the scene centroid until the first frame
  // (the follow target is the agent marker).
  return { position: sceneCentroid, target: sceneCentroid };
}
