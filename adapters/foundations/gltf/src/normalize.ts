/**
 * The glTF NORMALIZER + BINDING FACTORY (W060) — the second half of the
 * bridge: turning a VALIDATED glTF document into the neutral, deterministic
 * `GltfAsset` projection and the sealed `RendererAssetBinding` the frozen
 * W056 fabric seam consumes.
 *
 * Determinism discipline (the whole bridge): zero wall-clock, zero
 * randomness, zero I/O. The projection is a PURE function of the validated
 * document; the same bytes always produce the same projection and the same
 * digests (byte-for-byte stable across runs and platforms).
 *
 * Content addressing (two distinct digests, never conflated):
 * - `assetBytesDigest` — SHA-256 over the RAW asset bytes (the input's
 *   content address; this is what a RendererAssetBinding's `assetDigest`
 *   carries, per contracts/renderers: "the content digest of the asset
 *   bytes");
 * - `projectionDigest` — SHA-256 over the canonical JSON of the projection
 *   content itself (the normalized view's content address; two different
 *   byte encodings of the same validated geometry normalize to the same
 *   projection digest, while byte-identical inputs trivially agree on both).
 *
 * Trust gate (the security invariant): the binding factory accepts ONLY a
 * validated `GltfAdmission` — the type only `admitGltfAsset` can produce,
 * and only after the full structural validation passed. Unvalidated bytes
 * structurally cannot produce a `validated` binding here; hosts that want
 * to TRACK untrusted bytes pre-validation use the separate, explicitly
 * `untrusted` factory (whose bindings every W056 adapter refuses to mount).
 *
 * Non-authoronomy (CF1.0 §5): the projection and the `GltfMeshBinding` are
 * DATA, never semantic state. A glTF file is a source artifact; if a host
 * wants a mesh presented in a world, it authors the W016 representation
 * through the world model like any other entity — `GltfMeshBinding` is the
 * neutral suggestion record it consults, not a second authority.
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import type {
  RendererAssetBinding,
  TenantScope,
} from '@epoch/renderer-runtime';
import { sealRendererAssetBinding } from '@epoch/renderer-runtime';
import { sha256HexOfBytes } from './bytes';
import { GLTF_BRIDGE_ID, GLTF_BRIDGE_VERSION, gltfFailure, type GltfBridgeResult } from './version';
import type {
  ValidatedGltfDocument,
  ValidatedGltfMesh,
  ValidatedGltfNode,
} from './validate';
import { parseGltfContainer, validateGltfDocument } from './validate';
import { resolveLimits, type GltfBridgeLimits } from './limits';

// ---------------------------------------------------------------------------
// The neutral projection.
// ---------------------------------------------------------------------------

/** One primitive's neutral accounting (geometry facts, presentation-free). */
export type GltfPrimitiveSummary = {
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly isIndexed: boolean;
  readonly hasNormals: boolean;
  readonly hasTexcoords: boolean;
  readonly materialIndex: number | null;
  /** The declared local POSITION bounds (validated finite, min <= max). */
  readonly bounds: { readonly min: readonly number[]; readonly max: readonly number[] };
};

/** One mesh's neutral summary. */
export type GltfMeshSummary = {
  readonly meshIndex: number;
  readonly name: string | null;
  readonly primitives: readonly GltfPrimitiveSummary[];
  readonly vertexCount: number;
  readonly triangleCount: number;
  /** Bounds over ALL primitives' local POSITION bounds (mesh-local space). */
  readonly bounds: { readonly min: readonly number[]; readonly max: readonly number[] };
};

/** One material's neutral presentation subset. */
export type GltfMaterialSummary = {
  readonly materialIndex: number;
  readonly name: string | null;
  readonly baseColor: readonly number[] | null;
  readonly alphaMode: 'BLEND' | 'MASK' | 'OPAQUE';
  readonly alphaCutoff: number | null;
  readonly doubleSided: boolean;
};

/** A non-authoritative label suggestion (presentation hint, never semantic). */
export type GltfLabelSuggestion = {
  readonly label: string;
  readonly origin: 'mesh-name' | 'node-name' | 'scene-name';
};

/** The neutral, content-addressed projection of one validated glTF asset. */
export type GltfAsset = {
  readonly kind: 'epoch.gltf-asset';
  readonly bridgeId: typeof GLTF_BRIDGE_ID;
  readonly bridgeVersion: typeof GLTF_BRIDGE_VERSION;
  readonly gltfVersion: string;
  readonly generator: string | null;
  readonly container: 'gltf' | 'glb';
  readonly sceneCount: number;
  readonly defaultSceneIndex: number | null;
  readonly nodeCount: number;
  readonly meshCount: number;
  readonly materialCount: number;
  readonly textureCount: number;
  readonly primitiveCount: number;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly meshes: readonly GltfMeshSummary[];
  readonly materials: readonly GltfMaterialSummary[];
  readonly labelSuggestions: readonly GltfLabelSuggestion[];
  /**
   * Scene-transformed bounds of the default scene's meshes (TRS/matrix
   * composition; null when the default scene presents no mesh geometry).
   */
  readonly sceneBounds: {
    readonly min: readonly number[];
    readonly max: readonly number[];
  } | null;
  /** SHA-256 over the RAW asset bytes (the binding content address). */
  readonly assetBytesDigest: Sha256Hex;
  /** SHA-256 over the canonical JSON of this projection (normalized view). */
  readonly projectionDigest: Sha256Hex;
  /** The asset's raw byte size (the binding's byteSize). */
  readonly byteSize: number;
};

/** A validated admission: the validated document + its neutral projection. */
export type GltfAdmission = {
  readonly asset: GltfAsset;
  readonly validated: ValidatedGltfDocument;
};

// ---------------------------------------------------------------------------
// Transform composition (glTF §5.26: local = T * R * S; column-major 4x4).
// ---------------------------------------------------------------------------

/** Quaternion (x, y, z, w) → column-major rotation matrix. */
function quaternionMatrix(q: readonly number[]): number[] {
  const [x, y, z, w] = [q[0]!, q[1]!, q[2]!, q[3]!];
  const xx = x * x;
  const yy = y * y;
  const zz = z * z;
  return [
    1 - 2 * (yy + zz), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
    2 * (x * y - z * w), 1 - 2 * (xx + zz), 2 * (y * z + x * w), 0,
    2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (xx + yy), 0,
    0, 0, 0, 1,
  ];
}

/** Column-major 4x4 matrix multiply (this * that — apply `that` first). */
function multiplyMatrices(a: readonly number[], b: readonly number[]): number[] {
  const out = new Array<number>(16).fill(0);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) {
        sum += a[k * 4 + row]! * b[col * 4 + k]!;
      }
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

const IDENTITY_MATRIX: readonly number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** The local transform matrix of one validated node (column-major). */
function nodeMatrixOf(node: ValidatedGltfNode): readonly number[] {
  if (node.matrix !== null) {
    return node.matrix;
  }
  // glTF 2.0 §5.26: the local transform is T * R * S (scale applied first,
  // translation last) — built here by pre-multiplying each factor.
  let m = IDENTITY_MATRIX;
  if (node.scale !== null) {
    const [sx, sy, sz] = node.scale as [number, number, number];
    m = multiplyMatrices(m, [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1]);
  }
  if (node.rotation !== null) {
    m = multiplyMatrices(quaternionMatrix(node.rotation), m);
  }
  if (node.translation !== null) {
    const [tx, ty, tz] = node.translation as [number, number, number];
    m = multiplyMatrices([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1], m);
  }
  return m;
}

/** Transform a 3-D point by a column-major 4x4 matrix. */
function transformPoint(m: readonly number[], p: readonly number[]): number[] {
  const [x, y, z] = [p[0]!, p[1]!, p[2]!];
  return [
    m[0]! * x + m[4]! * y + m[8]! * z + m[12]!,
    m[1]! * x + m[5]! * y + m[9]! * z + m[13]!,
    m[2]! * x + m[6]! * y + m[10]! * z + m[14]!,
  ];
}

/** Union one box (min/max) into an accumulator. */
function unionBox(
  acc: { min: number[]; max: number[] },
  min: readonly number[],
  max: readonly number[],
): void {
  for (let c = 0; c < 3; c += 1) {
    acc.min[c] = Math.min(acc.min[c]!, min[c]!);
    acc.max[c] = Math.max(acc.max[c]!, max[c]!);
  }
}

/**
 * The scene-transformed bounds of one scene's presented mesh geometry.
 * DAG sharing is legal (a node may be reachable through several parents),
 * so the walk carries a VISIT BUDGET; a pathological graph that exceeds it
 * is a typed refusal, never an unbounded traversal.
 */
function sceneBoundsOf(
  document: ValidatedGltfDocument,
  rootNodeIndices: readonly number[],
): GltfBridgeResult<{ min: readonly number[]; max: readonly number[] } | null> {
  const budget = { visits: document.limits.maxNodes * 8 };
  // The accumulator (a record, not a narrowed union — closure mutation is
  // invisible to control-flow narrowing, so an explicit has-content flag
  // keeps this honest without casts).
  const acc = {
    min: [Infinity, Infinity, Infinity] as number[],
    max: [-Infinity, -Infinity, -Infinity] as number[],
    hasContent: false,
  };

  const visit = (
    nodeIndex: number,
    parentMatrix: readonly number[],
  ): GltfBridgeResult<true> => {
    budget.visits -= 1;
    if (budget.visits < 0) {
      return gltfFailure(
        'limit-exceeded',
        `the scene graph walk exceeded its visit budget (${document.limits.maxNodes * 8} visits; a pathological DAG)`,
        `nodes[${nodeIndex}]`,
      );
    }
    const node = document.nodes[nodeIndex]!;
    const world = multiplyMatrices(parentMatrix, nodeMatrixOf(node));
    if (node.meshIndex !== null) {
      const mesh = document.meshes[node.meshIndex]!;
      for (const primitive of mesh.primitives) {
        const corners: number[][] = [
          [primitive.bounds.min[0]!, primitive.bounds.min[1]!, primitive.bounds.min[2]!],
          [primitive.bounds.max[0]!, primitive.bounds.min[1]!, primitive.bounds.min[2]!],
          [primitive.bounds.min[0]!, primitive.bounds.max[1]!, primitive.bounds.min[2]!],
          [primitive.bounds.max[0]!, primitive.bounds.max[1]!, primitive.bounds.min[2]!],
          [primitive.bounds.min[0]!, primitive.bounds.min[1]!, primitive.bounds.max[2]!],
          [primitive.bounds.max[0]!, primitive.bounds.min[1]!, primitive.bounds.max[2]!],
          [primitive.bounds.min[0]!, primitive.bounds.max[1]!, primitive.bounds.max[2]!],
          [primitive.bounds.max[0]!, primitive.bounds.max[1]!, primitive.bounds.max[2]!],
        ];
        const transformed = corners.map((corner) => transformPoint(world, corner));
        const tMin = [
          Math.min(...transformed.map((t) => t[0]!)),
          Math.min(...transformed.map((t) => t[1]!)),
          Math.min(...transformed.map((t) => t[2]!)),
        ];
        const tMax = [
          Math.max(...transformed.map((t) => t[0]!)),
          Math.max(...transformed.map((t) => t[1]!)),
          Math.max(...transformed.map((t) => t[2]!)),
        ];
        if (!acc.hasContent) {
          acc.min = tMin;
          acc.max = tMax;
          acc.hasContent = true;
        } else {
          unionBox(acc, tMin, tMax);
        }
      }
    }
    for (const child of node.children) {
      const descended = visit(child, world);
      if (!descended.ok) return descended;
    }
    return { ok: true, value: true };
  };

  for (const root of rootNodeIndices) {
    const descended = visit(root, IDENTITY_MATRIX);
    if (!descended.ok) return descended;
  }
  if (!acc.hasContent) {
    return { ok: true, value: null };
  }
  return { ok: true, value: { min: acc.min, max: acc.max } };
}

// ---------------------------------------------------------------------------
// Normalization (validated document → neutral projection).
// ---------------------------------------------------------------------------

function meshSummaryOf(
  mesh: ValidatedGltfMesh,
  meshIndex: number,
): GltfMeshSummary {
  const primitives: GltfPrimitiveSummary[] = mesh.primitives.map((primitive) => ({
    vertexCount: primitive.vertexCount,
    triangleCount: primitive.triangleCount,
    isIndexed: primitive.indicesAccessorIndex !== null,
    hasNormals: primitive.normalAccessorIndex !== null,
    hasTexcoords: primitive.texcoordAccessorIndex !== null,
    materialIndex: primitive.materialIndex,
    bounds: { min: [...primitive.bounds.min], max: [...primitive.bounds.max] },
  }));
  const acc = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const primitive of primitives) {
    unionBox(acc, primitive.bounds.min, primitive.bounds.max);
  }
  return {
    meshIndex,
    name: mesh.name,
    primitives,
    vertexCount: primitives.reduce((sum, p) => sum + p.vertexCount, 0),
    triangleCount: primitives.reduce((sum, p) => sum + p.triangleCount, 0),
    bounds: { min: acc.min, max: acc.max },
  };
}

/**
 * Normalize one validated glTF document into the neutral `GltfAsset`
 * projection. Pure and deterministic: the same validated document (plus the
 * exact raw bytes) always produces byte-identical projection digests.
 */
export function normalizeGltfAsset(
  validated: ValidatedGltfDocument,
  input: { container: 'gltf' | 'glb'; assetBytes: Uint8Array },
  limits?: Partial<GltfBridgeLimits>,
): GltfBridgeResult<GltfAsset> {
  const resolved = resolveLimits(limits);

  const meshes = validated.meshes.map((mesh, index) => meshSummaryOf(mesh, index));
  const materials = validated.materials.map((material, index) => ({
    materialIndex: index,
    name: material.name,
    baseColor: material.baseColor === null ? null : [...material.baseColor],
    alphaMode: material.alphaMode,
    alphaCutoff: material.alphaCutoff,
    doubleSided: material.doubleSided,
  }));

  // Non-authoritative label suggestions: mesh names first, then node names,
  // then scene names — de-duplicated, sorted, capped (deterministic order).
  const labels = new Map<string, GltfLabelSuggestion['origin']>();
  for (const mesh of validated.meshes) {
    if (mesh.name !== null && !labels.has(mesh.name)) labels.set(mesh.name, 'mesh-name');
  }
  for (const node of validated.nodes) {
    if (node.name !== null && !labels.has(node.name)) labels.set(node.name, 'node-name');
  }
  for (const scene of validated.scenes) {
    if (scene.name !== null && !labels.has(scene.name)) labels.set(scene.name, 'scene-name');
  }
  const labelSuggestions: GltfLabelSuggestion[] = [...labels.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, resolved.maxLabelSuggestions)
    .map(([label, origin]) => ({ label, origin }));

  const defaultSceneIndex = validated.defaultSceneIndex;
  let sceneBounds: GltfAsset['sceneBounds'] = null;
  if (defaultSceneIndex !== null) {
    const bounds = sceneBoundsOf(validated, validated.scenes[defaultSceneIndex]!.rootNodeIndices);
    if (!bounds.ok) return bounds;
    sceneBounds =
      bounds.value === null
        ? null
        : { min: [...bounds.value.min], max: [...bounds.value.max] };
  }

  const projectionContent: Omit<GltfAsset, 'projectionDigest'> = {
    kind: 'epoch.gltf-asset' as const,
    bridgeId: GLTF_BRIDGE_ID,
    bridgeVersion: GLTF_BRIDGE_VERSION,
    gltfVersion: validated.gltfVersion,
    generator: validated.generator,
    container: input.container,
    sceneCount: validated.scenes.length,
    defaultSceneIndex,
    nodeCount: validated.nodes.length,
    meshCount: validated.meshes.length,
    materialCount: validated.materials.length,
    textureCount: validated.textureCount,
    primitiveCount: meshes.reduce((sum, mesh) => sum + mesh.primitives.length, 0),
    vertexCount: meshes.reduce((sum, mesh) => sum + mesh.vertexCount, 0),
    triangleCount: meshes.reduce((sum, mesh) => sum + mesh.triangleCount, 0),
    meshes,
    materials,
    labelSuggestions,
    sceneBounds,
    assetBytesDigest: sha256HexOfBytes(input.assetBytes),
    byteSize: input.assetBytes.length,
  };
  return {
    ok: true,
    value: {
      ...projectionContent,
      projectionDigest: canonicalDigest(projectionContent as unknown as JsonValue),
    },
  };
}

/**
 * THE ONE-CALL TRUST GATE: untrusted bytes in, validated admission out (or a
 * typed refusal). Container detection → JSON parse → structural validation →
 * neutral normalization + content addressing. Nothing downstream of this
 * function ever parses glTF again.
 */
export function admitGltfAsset(
  bytes: Uint8Array,
  limits?: Partial<GltfBridgeLimits>,
): GltfBridgeResult<GltfAdmission> {
  const resolved = resolveLimits(limits);
  const parsed = parseGltfContainer(bytes, resolved);
  if (!parsed.ok) return parsed;
  const validated = validateGltfDocument(parsed.value, resolved);
  if (!validated.ok) return validated;
  const asset = normalizeGltfAsset(validated.value, {
    container: parsed.value.container,
    assetBytes: bytes,
  }, resolved);
  if (!asset.ok) return asset;
  return { ok: true, value: { asset: asset.value, validated: validated.value } };
}

// ---------------------------------------------------------------------------
// The RendererAssetBinding factories (the W056 seam's asset record).
// ---------------------------------------------------------------------------

/** The inputs of one validated glTF asset binding. */
export type GltfAssetBindingInput = {
  /** A VALIDATED admission (the trust gate: only this type can bind validated). */
  readonly admission: GltfAdmission;
  /** The binding id ("rab-" + lowercase slug, per contracts/renderers). */
  readonly bindingId: string;
  /** The fabric session the asset binds to. */
  readonly fabricSessionId: string;
  /** The owning tenant scope (R12 — assets never cross tenants). */
  readonly tenantScope: TenantScope;
  /** Caller-supplied virtual time of the binding (and of the validation). */
  readonly boundAtMs: number;
};

/**
 * Build the SEALED, `validated` RendererAssetBinding of one admitted glTF
 * asset (asset kind `mesh`). Trust-gated by construction: the factory only
 * accepts a `GltfAdmission`, which only `admitGltfAsset` produces after the
 * full validation passed — unvalidated bytes can never become a validated
 * binding through this bridge.
 */
export function gltfRendererAssetBinding(input: GltfAssetBindingInput): RendererAssetBinding {
  const { admission, boundAtMs } = input;
  return sealRendererAssetBinding({
    schema: 'epoch.renderer-asset-binding',
    fabricProtocolVersion: '1.0.0',
    bindingId: input.bindingId,
    fabricSessionId: input.fabricSessionId,
    tenantScope: input.tenantScope,
    assetDigest: admission.asset.assetBytesDigest,
    assetKind: 'mesh',
    byteSize: admission.asset.byteSize,
    trustState: 'validated',
    validatedAtMs: boundAtMs,
    boundAtMs,
  });
}

/** The inputs of one UNTRUSTED glTF asset tracking binding. */
export type GltfUntrustedBindingInput = {
  /** The raw unvalidated asset bytes (digest + size are computed, never trusted). */
  readonly assetBytes: Uint8Array;
  readonly bindingId: string;
  readonly fabricSessionId: string;
  readonly tenantScope: TenantScope;
  readonly boundAtMs: number;
};

/**
 * Build the SEALED, `untrusted` RendererAssetBinding of RAW glTF bytes —
 * for hosts that track not-yet-validated assets. Every W056 adapter refuses
 * to mount these (the security invariant); validation must pass first and a
 * NEW validated binding be issued from the admission.
 */
export function gltfUntrustedAssetBinding(input: GltfUntrustedBindingInput): RendererAssetBinding {
  return sealRendererAssetBinding({
    schema: 'epoch.renderer-asset-binding',
    fabricProtocolVersion: '1.0.0',
    bindingId: input.bindingId,
    fabricSessionId: input.fabricSessionId,
    tenantScope: input.tenantScope,
    assetDigest: sha256HexOfBytes(input.assetBytes),
    assetKind: 'mesh',
    byteSize: input.assetBytes.length,
    trustState: 'untrusted',
    boundAtMs: input.boundAtMs,
  });
}

// ---------------------------------------------------------------------------
// The neutral mesh binding (a non-authoritative W016 representation hint).
// ---------------------------------------------------------------------------

/** One neutral, non-authoritative mesh-binding suggestion (W016 world hint). */
export type GltfMeshBinding = {
  readonly kind: 'epoch.gltf-mesh-binding';
  readonly bridgeId: typeof GLTF_BRIDGE_ID;
  readonly bridgeVersion: typeof GLTF_BRIDGE_VERSION;
  readonly meshIndex: number;
  /** The source asset's RAW-byte content address (provenance anchor). */
  readonly sourceAssetDigest: Sha256Hex;
  readonly label: string | null;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly primitiveCount: number;
  /** Mesh-local POSITION bounds (untransformed). */
  readonly bounds: { readonly min: readonly number[]; readonly max: readonly number[] };
  /** The materials this mesh's primitives reference (neutral summaries). */
  readonly materials: readonly GltfMaterialSummary[];
  /** Canonical-JSON digest of this suggestion record (content-addressed). */
  readonly digest: Sha256Hex;
};

/**
 * Project one mesh of a validated glTF asset into the neutral
 * `GltfMeshBinding` suggestion record. This is DATA FOR THE HOST, never a
 * semantic write: presenting this mesh in a world goes through the W016
 * world-model representation authoring (the world model stays authority);
 * the record merely carries the validated geometry facts + provenance.
 */
export function gltfMeshBindingOf(asset: GltfAsset, meshIndex: number): GltfBridgeResult<GltfMeshBinding> {
  const mesh = asset.meshes.find((entry) => entry.meshIndex === meshIndex);
  if (mesh === undefined) {
    return gltfFailure(
      'mesh-invalid',
      `the asset has no mesh at index ${meshIndex} (it carries ${asset.meshCount})`,
    );
  }
  const materialIndexes = new Set<number>();
  for (const primitive of mesh.primitives) {
    if (primitive.materialIndex !== null) materialIndexes.add(primitive.materialIndex);
  }
  const materials = asset.materials.filter((material) => materialIndexes.has(material.materialIndex));
  const content: Omit<GltfMeshBinding, 'digest'> = {
    kind: 'epoch.gltf-mesh-binding' as const,
    bridgeId: GLTF_BRIDGE_ID,
    bridgeVersion: GLTF_BRIDGE_VERSION,
    meshIndex,
    sourceAssetDigest: asset.assetBytesDigest,
    label: mesh.name,
    vertexCount: mesh.vertexCount,
    triangleCount: mesh.triangleCount,
    primitiveCount: mesh.primitives.length,
    bounds: mesh.bounds,
    materials,
  };
  return {
    ok: true,
    value: { ...content, digest: canonicalDigest(content as unknown as JsonValue) },
  };
}
