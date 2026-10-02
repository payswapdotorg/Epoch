/**
 * @epoch/adapter-foundation-gltf — public API (experience layer, Work
 * Order W060, ACR-007 / X2.0).
 *
 * The glTF 2.0 INTERCHANGE BRIDGE: the validated translation boundary that
 * turns UNTRUSTED glTF/GLB bytes into content-addressed renderer-asset
 * bindings for the frozen W056 fabric seam.
 *
 * The one-call trust gate is {@link admitGltfAsset}: raw bytes in, a
 * validated `GltfAdmission` out (or a typed refusal) — container detection,
 * JSON parse, strict glTF 2.0 core-subset structural validation, size
 * limits, and deterministic normalization into the neutral, content-
 * addressed `GltfAsset` projection. The binding factories then produce the
 * sealed `RendererAssetBinding` records the fabric's adapters consume
 * ({@link gltfRendererAssetBinding} — trust-gated by construction;
 * {@link gltfUntrustedAssetBinding} — explicit untrusted tracking, refused
 * by every adapter).
 *
 * Boundary properties (all enforced, all tested):
 * - PURE CODE: zero dependencies, zero I/O (no filesystem, no network, no
 *   wall-clock, no randomness) — runtime-neutral (lock rule 14);
 * - UNTRUSTED-INPUT DISCIPLINE: every malformed shape is a typed refusal
 *   (never a throw, never a truncated parse); external resource URIs are
 *   refused (acquisition is the HOST's concern; whatever it acquires
 *   re-enters through this same validation);
 * - PROVIDER-NEUTRAL: glTF is the replaceable interchange format behind
 *   neutral role vocabulary (lock rule 13);
 * - NEVER AUTHORITY: a glTF file is a source artifact (CF1.0 §5); the
 *   validated projection is the only thing Epoch adopts, and even that is
 *   data for hosts, never semantic state.
 */
// The frozen declarations (identity, supported surface, typed failures).
export {
  GLTF_BRIDGE_DEFAULT_LIMITS,
  resolveLimits,
  type GltfBridgeLimits,
} from './limits';
export {
  GLTF_ACCESSOR_TYPES,
  GLTF_BRIDGE_DISPLAY_NAME,
  GLTF_BRIDGE_ID,
  GLTF_BRIDGE_VERSION,
  GLTF_COMPONENT_TYPE_SIZES,
  GLTF_COMPONENT_TYPES,
  GLTF_MEDIA_TYPE,
  GLTF_MODE_TRIANGLES,
  GLTF_PRESENTATION_TRIANGLE_CEILING,
  GLTF_SUPPORTED_MAJOR,
  gltfFailure,
  type GltfBridgeFailure,
  type GltfBridgeFailureCode,
  type GltfBridgeResult,
} from './version';

// The deterministic byte primitives (SHA-256 over bytes, strict base64).
export {
  decodeBase64,
  isPlainObject,
  sha256HexOfBytes,
  startsWithAscii,
  utf8Bytes,
  utf8Text,
  type Base64DecodeResult,
} from './bytes';

// The GLB binary-container parser.
export {
  GLB_CHUNK_BIN,
  GLB_CHUNK_JSON,
  GLB_HEADER_BYTES,
  GLB_MAGIC,
  GLB_VERSION,
  parseGlb,
  type GlbChunk,
  type GlbContainer,
} from './glb';

// The structural validator (the trust gate's core).
export {
  parseGltfContainer,
  validateGltfDocument,
  type ParsedGltfContainer,
  type ValidatedGltfAccessor,
  type ValidatedGltfBufferView,
  type ValidatedGltfDocument,
  type ValidatedGltfMaterial,
  type ValidatedGltfMesh,
  type ValidatedGltfNode,
  type ValidatedGltfPrimitive,
  type ValidatedGltfScene,
} from './validate';

// The normalizer + binding factories (the fabric seam's asset records).
export {
  admitGltfAsset,
  gltfMeshBindingOf,
  gltfRendererAssetBinding,
  gltfUntrustedAssetBinding,
  normalizeGltfAsset,
  type GltfAdmission,
  type GltfAsset,
  type GltfAssetBindingInput,
  type GltfLabelSuggestion,
  type GltfMaterialSummary,
  type GltfMeshBinding,
  type GltfMeshSummary,
  type GltfPrimitiveSummary,
  type GltfUntrustedBindingInput,
} from './normalize';
