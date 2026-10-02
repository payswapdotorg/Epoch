/**
 * The glTF bridge's frozen declarations (W060): neutral identity, the
 * supported glTF surface, and the typed failure taxonomy.
 *
 * Provider neutrality (lock rule 13): every constant names the ROLE this
 * bridge serves; glTF is the replaceable interchange format behind it.
 */

/** The neutral capability identity of the glTF asset bridge. */
export const GLTF_BRIDGE_ID = 'epoch.foundation.gltf';

/** The neutral display name of the glTF asset bridge. */
export const GLTF_BRIDGE_DISPLAY_NAME = 'glTF 2.0 Asset Bridge';

/** The bridge's own schema/normalization revision (content-addressing input). */
export const GLTF_BRIDGE_VERSION = 1;

/** The media type of a binary glTF container (the bridge's asset bytes). */
export const GLTF_MEDIA_TYPE = 'model/gltf-binary';

/** The glTF major version this bridge implements (the 2.0 core subset). */
export const GLTF_SUPPORTED_MAJOR = 2;

/**
 * The glTF 2.0 accessor component types (spec §5.25.2.2): signed/unsigned
 * byte/short, unsigned int, and float — as typed data, never raw numbers in
 * the public API.
 */
export const GLTF_COMPONENT_TYPES = {
  BYTE: 5120,
  UNSIGNED_BYTE: 5121,
  SHORT: 5122,
  UNSIGNED_SHORT: 5123,
  UNSIGNED_INT: 5125,
  FLOAT: 5126,
} as const;

/** Byte sizes of the glTF component types. */
export const GLTF_COMPONENT_TYPE_SIZES: Readonly<Record<number, number>> = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
};

/** The glTF accessor types and their component counts (spec §5.25.2.3). */
export const GLTF_ACCESSOR_TYPES: Readonly<Record<string, number>> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

/** The only draw mode this bridge admits: triangles (glTF core mode 4). */
export const GLTF_MODE_TRIANGLES = 4;

/**
 * The typed failure taxonomy of the glTF bridge. Every failure is a value
 * (never a throw): the bridge refuses untrusted input with a code the host
 * can branch on, exactly like the renderer-fabric failure discipline.
 */
export type GltfBridgeFailureCode =
  | 'input-empty'
  | 'limit-exceeded'
  | 'not-gltf2'
  | 'malformed-json'
  | 'glb-invalid'
  | 'buffer-unresolvable'
  | 'buffer-mismatch'
  | 'bufferview-invalid'
  | 'accessor-invalid'
  | 'mesh-invalid'
  | 'node-graph-invalid'
  | 'material-invalid'
  | 'unsupported-feature'
  | 'internal-error';

/** One typed glTF bridge failure. */
export type GltfBridgeFailure = {
  readonly code: GltfBridgeFailureCode;
  readonly message: string;
  /** The glTF JSON path the failure was detected at (when known). */
  readonly path?: string;
};

/** The bridge's uniform result type (mirrors the fabric's FabricResult). */
export type GltfBridgeResult<T> = { ok: true; value: T } | { ok: false; error: GltfBridgeFailure };

/** A convenience constructor for typed failures (single construction site). */
export function gltfFailure(
  code: GltfBridgeFailureCode,
  message: string,
  path?: string,
): { ok: false; error: GltfBridgeFailure } {
  return { ok: false, error: path === undefined ? { code, message } : { code, message, path } };
}

/** The maximum value of a validated total-triangle count (presentation-grade). */
export const GLTF_PRESENTATION_TRIANGLE_CEILING = 100_000_000;

/** Type re-export so the public API surfaces the limits type from one place. */
export type { GltfBridgeLimits } from './limits';
