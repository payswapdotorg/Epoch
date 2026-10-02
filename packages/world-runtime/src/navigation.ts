/**
 * The workspace NAVIGATION state (W057): an orbit camera around a
 * presentation anchor plus the pure perspective projection the reference
 * presentation uses to map canonical scene positions into viewport
 * coordinates.
 *
 * Authority discipline (renderer-fabric architecture): camera
 * interpolation and GPU state remain PRESENTATION-ONLY unless represented
 * by existing Epoch contracts. The portable camera state
 * (`PortableCameraState` of contracts/renderers v1.1.0) IS that existing
 * contract, so the navigation state round-trips through it: orbit/pan are
 * pure presentation transitions of THIS ephemeral state (they never touch
 * the canonical scene and never produce intents), while SEMANTIC zoom
 * flows through the existing typed zoom intent (the fabric input seam),
 * which the W016 reducer applies to the scene's camera record. The
 * projection math is neutral (no engine, no GPU): an azimuth/elevation
 * spherical eye around a target with a right-handed look-at basis.
 */
import type { PortableCameraState, PortableOrbitCamera, Vec3 } from '@epoch/renderer-runtime';

/** The navigation state of the workspace viewport. */
export interface NavigationState {
  /** The orbit anchor (world coordinates). */
  readonly target: Vec3;
  /** Horizontal angle around the anchor (radians; 0 looks along +X). */
  readonly azimuthRad: number;
  /** Vertical angle above the anchor plane (radians, clamped). */
  readonly elevationRad: number;
  /** Distance from the anchor (strictly positive). */
  readonly distance: number;
  /** Vertical field of view (radians, strictly positive, < PI). */
  readonly fovRadians: number;
}

/** The bounds of the navigation parameters. */
export const NAVIGATION_LIMITS = {
  minDistance: 1,
  maxDistance: 100_000,
  minElevationRad: -Math.PI / 2 + 0.01,
  maxElevationRad: Math.PI / 2 - 0.01,
  minFovRad: 0.1,
  maxFovRad: Math.PI - 0.1,
} as const;

/** One navigation input gesture (presentation-only). */
export interface NavigationGesture {
  readonly kind: 'orbit' | 'pan' | 'zoom' | 'free-look';
  /** Orbit: radians of azimuth/elevation delta. Pan: world-space delta. */
  readonly deltaX: number;
  readonly deltaY: number;
}

/** Normalize an angle into [0, 2π). */
function wrapAngle(radians: number): number {
  const twoPi = Math.PI * 2;
  const wrapped = radians % twoPi;
  return wrapped < 0 ? wrapped + twoPi : wrapped;
}

/** Clamp one number into [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Derive the initial navigation state from a scene's portable camera. */
export function navigationFromCamera(camera: PortableCameraState): NavigationState {
  if (camera.mode === 'orbit') {
    return {
      target: camera.target ?? [0, 0, 0],
      azimuthRad: azimuthOf(camera.position, camera.target ?? [0, 0, 0]),
      elevationRad: elevationOf(camera.position, camera.target ?? [0, 0, 0]),
      distance: Math.max(NAVIGATION_LIMITS.minDistance, distanceOf(camera.position, camera.target ?? [0, 0, 0])),
      fovRadians: camera.fovRadians ?? Math.PI / 4,
    };
  }
  // Free/follow cameras enter the workspace at a neutral orbit around the
  // world origin (the presentation anchor is ephemeral; the canonical
  // camera record is untouched).
  const fallback: PortableOrbitCamera = {
    mode: 'orbit',
    position: [24, 18, 24],
    target: [0, 0, 0],
    fovRadians: Math.PI / 4,
  };
  return navigationFromCamera(fallback);
}

/** Apply one navigation gesture (pure: a new state, never a mutation). */
export function applyNavigationGesture(
  state: NavigationState,
  gesture: NavigationGesture,
): NavigationState {
  switch (gesture.kind) {
    case 'orbit': {
      return {
        ...state,
        azimuthRad: wrapAngle(state.azimuthRad + gesture.deltaX),
        elevationRad: clamp(
          state.elevationRad + gesture.deltaY,
          NAVIGATION_LIMITS.minElevationRad,
          NAVIGATION_LIMITS.maxElevationRad,
        ),
      };
    }
    case 'pan': {
      // Pan translates the anchor in the camera's screen basis (right/up).
      const basis = lookAtBasis(state);
      const scale = state.distance * 0.0016; // ~1px screen pan at any distance
      return {
        ...state,
        target: [
          state.target[0] - basis.right[0] * gesture.deltaX * scale + basis.up[0] * gesture.deltaY * scale,
          state.target[1] - basis.right[1] * gesture.deltaX * scale + basis.up[1] * gesture.deltaY * scale,
          state.target[2] - basis.right[2] * gesture.deltaX * scale + basis.up[2] * gesture.deltaY * scale,
        ],
      };
    }
    case 'zoom': {
      // Presentation zoom rescales the orbit distance multiplicatively
      // (semantic zoom instead goes through the typed zoom intent).
      const factor = gesture.deltaY <= 0 ? 1 / 0.9 : 0.9;
      return {
        ...state,
        distance: clamp(
          state.distance * factor,
          NAVIGATION_LIMITS.minDistance,
          NAVIGATION_LIMITS.maxDistance,
        ),
      };
    }
    case 'free-look': {
      return {
        ...state,
        azimuthRad: wrapAngle(state.azimuthRad + gesture.deltaX),
        elevationRad: clamp(
          state.elevationRad - gesture.deltaY,
          NAVIGATION_LIMITS.minElevationRad,
          NAVIGATION_LIMITS.maxElevationRad,
        ),
      };
    }
  }
}

/** Apply a zoom FACTOR to the orbit distance (used to track semantic zoom intents). */
export function applyZoomFactor(state: NavigationState, factor: number): NavigationState {
  return applyNavigationGesture(state, { kind: 'zoom', deltaX: 0, deltaY: factor < 1 ? 1 : -1 });
}

/** Project the navigation state into the portable orbit camera (the contract record). */
export function navigationToCamera(state: NavigationState): PortableOrbitCamera {
  return {
    mode: 'orbit',
    position: eyeOf(state),
    target: state.target,
    fovRadians: state.fovRadians,
  };
}

/** The eye position implied by one navigation state. */
export function eyeOf(state: NavigationState): Vec3 {
  const cosElevation = Math.cos(state.elevationRad);
  return [
    state.target[0] + state.distance * cosElevation * Math.cos(state.azimuthRad),
    state.target[1] + state.distance * cosElevation * Math.sin(state.azimuthRad),
    state.target[2] + state.distance * Math.sin(state.elevationRad),
  ];
}

/** The right/up/forward basis of one navigation state (right-handed). */
export function lookAtBasis(state: NavigationState): {
  readonly right: Vec3;
  readonly up: Vec3;
  readonly forward: Vec3;
} {
  const eye = eyeOf(state);
  const forwardDelta: Vec3 = [
    state.target[0] - eye[0],
    state.target[1] - eye[1],
    state.target[2] - eye[2],
  ];
  const forwardLength = Math.hypot(forwardDelta[0], forwardDelta[1], forwardDelta[2]) || 1;
  const forward: Vec3 = [
    forwardDelta[0] / forwardLength,
    forwardDelta[1] / forwardLength,
    forwardDelta[2] / forwardLength,
  ];
  // World up (Z) unless looking straight down it — then use Y.
  let upRef: Vec3 = [0, 0, 1];
  if (Math.abs(forward[2]) > 0.999) {
    upRef = [0, 1, 0];
  }
  const right = normalize(cross(upRef, forward));
  const up = cross(forward, right);
  return { right, up, forward };
}

/** One projected viewport point (normalized device coordinates, x/y in [-1, 1]). */
export interface ProjectedPoint {
  readonly x: number;
  readonly y: number;
  /** Depth in view space (positive in front of the eye). */
  readonly depth: number;
  /** Whether the point lies inside the view frustum. */
  readonly inFrustum: boolean;
}

/**
 * Perspective projection of one world point under one navigation state
 * (pure, neutral math). The result is normalized device coordinates —
 * the viewport maps them to pixels (aspect applied at the viewport).
 */
export function projectPoint(state: NavigationState, point: Vec3): ProjectedPoint {
  const eye = eyeOf(state);
  const { right, up, forward } = lookAtBasis(state);
  const delta: Vec3 = [point[0] - eye[0], point[1] - eye[1], point[2] - eye[2]];
  const depth = dot(delta, forward);
  const fovScale = Math.tan(state.fovRadians / 2);
  if (depth <= 0.0001) {
    // Behind (or at) the eye: not in the frustum; clamp to the near plane
    // so presentation stays finite (never a semantic claim).
    return { x: 0, y: 0, depth: 0, inFrustum: false };
  }
  const x = dot(delta, right) / (depth * fovScale);
  const y = dot(delta, up) / (depth * fovScale);
  return { x, y, depth, inFrustum: depth > 0 && x >= -1 && x <= 1 && y >= -1 && y <= 1 };
}

// ---------------------------------------------------------------------------
// Neutral vector math (module-private, no engine).
// ---------------------------------------------------------------------------

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function distanceOf(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function azimuthOf(eye: Vec3, target: Vec3): number {
  return Math.atan2(eye[1] - target[1], eye[0] - target[0]);
}

function elevationOf(eye: Vec3, target: Vec3): number {
  const dx = eye[0] - target[0];
  const dy = eye[1] - target[1];
  const dz = eye[2] - target[2];
  const horizontal = Math.hypot(dx, dy);
  return Math.atan2(dz, horizontal || 1);
}
