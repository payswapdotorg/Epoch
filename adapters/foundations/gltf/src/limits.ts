/**
 * The deterministic limits of one glTF bridge admission (W060).
 *
 * Untrusted assets are refused ABOVE these limits — a typed
 * `limit-exceeded` refusal, never a truncated parse. The defaults bound a
 * presentation-grade mesh asset (embedded buffers included) while keeping
 * the pure-code validation path fast and memory-safe in every runtime.
 */
export type GltfBridgeLimits = {
  /** Maximum size of the whole .gltf/.glb document before any parsing. */
  readonly maxDocumentBytes: number;
  /** Maximum total DECODED buffer bytes (data URIs + GLB BIN chunk). */
  readonly maxBufferBytes: number;
  readonly maxNodes: number;
  readonly maxMeshes: number;
  readonly maxPrimitives: number;
  readonly maxAccessors: number;
  readonly maxBufferViews: number;
  readonly maxMaterials: number;
  /** Textures are counted (never decoded) — the bridge mounts no images. */
  readonly maxTextures: number;
  readonly maxScenes: number;
  /** Maximum node-graph depth (glTF allows DAG sharing; depth is bounded). */
  readonly maxNodeDepth: number;
  readonly maxChildrenPerNode: number;
  /** Maximum summed triangle count across all mesh primitives. */
  readonly maxTotalTriangles: number;
  /** Maximum length of any glTF `name` string. */
  readonly maxNameLength: number;
  /** Maximum non-authoritative label suggestions carried into the projection. */
  readonly maxLabelSuggestions: number;
};

/** The default limits of one bridge admission. */
export const GLTF_BRIDGE_DEFAULT_LIMITS: Readonly<GltfBridgeLimits> = {
  maxDocumentBytes: 16 * 1024 * 1024,
  maxBufferBytes: 64 * 1024 * 1024,
  maxNodes: 10_000,
  maxMeshes: 2_000,
  maxPrimitives: 8_000,
  maxAccessors: 16_000,
  maxBufferViews: 16_000,
  maxMaterials: 2_000,
  maxTextures: 2_000,
  maxScenes: 64,
  maxNodeDepth: 128,
  maxChildrenPerNode: 1_000,
  maxTotalTriangles: 2_000_000,
  maxNameLength: 256,
  maxLabelSuggestions: 64,
};

/** Merge caller overrides over the defaults. */
export function resolveLimits(overrides?: Partial<GltfBridgeLimits>): GltfBridgeLimits {
  if (overrides === undefined) {
    return { ...GLTF_BRIDGE_DEFAULT_LIMITS };
  }
  return { ...GLTF_BRIDGE_DEFAULT_LIMITS, ...overrides };
}
