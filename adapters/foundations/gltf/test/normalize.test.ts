/**
 * The normalizer battery (W060): determinism, content addressing, transform
 * composition (TRS and matrix), label suggestions, and the pathological-DAG
 * visit budget. The projection is the bridge's only output — its digests
 * are stable evidence the downstream battery pins.
 */
import { describe, expect, it } from 'vitest';
import { admitGltfAsset, normalizeGltfAsset } from '../src/normalize';
import { parseGltfContainer, validateGltfDocument } from '../src/validate';
import { sha256HexOfBytes } from '../src/bytes';
import { GLTF_BRIDGE_DEFAULT_LIMITS } from '../src/limits';
import {
  buildGlb,
  canonicalGlbBytes,
  canonicalGltfDocumentBytes,
  canonicalGltfJson,
  trianglePositionBytes,
  withMutation,
} from './helpers';

describe('admitGltfAsset (the one-call trust gate)', () => {
  it('admits the canonical GLB and content-addresses it', () => {
    const bytes = canonicalGlbBytes();
    const admitted = admitGltfAsset(bytes);
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const { asset, validated } = admitted.value;
    expect(asset.kind).toBe('epoch.gltf-asset');
    expect(asset.container).toBe('glb');
    expect(asset.gltfVersion).toBe('2.0');
    expect(asset.meshCount).toBe(1);
    expect(asset.primitiveCount).toBe(1);
    expect(asset.vertexCount).toBe(3);
    expect(asset.triangleCount).toBe(1);
    expect(asset.materialCount).toBe(1);
    expect(asset.nodeCount).toBe(1);
    expect(asset.assetBytesDigest).toBe(sha256HexOfBytes(bytes));
    expect(asset.byteSize).toBe(bytes.length);
    expect(asset.projectionDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(validated.meshes).toHaveLength(1);
  });

  it('is deterministic: identical bytes produce identical projections and digests', () => {
    const first = admitGltfAsset(canonicalGlbBytes());
    const second = admitGltfAsset(canonicalGlbBytes());
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.asset).toEqual(second.value.asset);
    expect(first.value.asset.projectionDigest).toBe(second.value.asset.projectionDigest);
    expect(first.value.asset.assetBytesDigest).toBe(second.value.asset.assetBytesDigest);
  });

  it('normalizes semantically equal encodings to equal geometry facts', () => {
    const admitted = admitGltfAsset(canonicalGlbBytes());
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    // Rebuild the SAME document with reordered JSON keys: the normalized
    // geometry facts agree. The projection DIGESTS differ by design — the
    // projection is content-addressed over the exact input (byte size and
    // raw-byte digest are part of it), so a byte-different encoding is a
    // different (equally valid) admission.
    const json = canonicalGltfJson();
    const reordered: Record<string, unknown> = {};
    for (const key of Object.keys(json).reverse()) reordered[key] = json[key];
    const other = admitGltfAsset(buildGlb(reordered, trianglePositionBytes()));
    expect(other.ok).toBe(true);
    if (!other.ok) return;
    expect(other.value.asset.meshes).toEqual(admitted.value.asset.meshes);
    expect(other.value.asset.sceneBounds).toEqual(admitted.value.asset.sceneBounds);
    expect(other.value.asset.triangleCount).toBe(admitted.value.asset.triangleCount);
    expect(other.value.asset.projectionDigest).not.toBe(admitted.value.asset.projectionDigest);
  });
});

describe('scene-transform composition', () => {
  it('computes scene bounds through TRS translation (the fixture node at [1,0,0])', () => {
    const admitted = admitGltfAsset(canonicalGlbBytes());
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const bounds = admitted.value.asset.sceneBounds;
    // Local bounds [0,0,0]..[1,1,0] translated by [1,0,0].
    expect(bounds).toEqual({ min: [1, 0, 0], max: [2, 1, 0] });
  });

  it('computes scene bounds through quaternion rotation and scale (T * R * S)', () => {
    // The fixture node keeps its translation [1,0,0] and adds a 90-degree
    // rotation about Z (quaternion [0,0,sin45,cos45]: (x,y) -> (-y,x)) and
    // a uniform 2x scale. glTF composes T * R * S: the local box
    // [0,0,0]..[1,1,0] scales to [0,0,0]..[2,2,0], rotates to
    // x in [-2,0], y in [0,2], then translates to x in [-1,1], y in [0,2].
    const halfSqrt2 = Math.SQRT1_2;
    const json = withMutation(canonicalGltfJson(), (draft) => {
      (draft.nodes as Record<string, unknown>[])[0]!.rotation = [0, 0, halfSqrt2, halfSqrt2];
      (draft.nodes as Record<string, unknown>[])[0]!.scale = [2, 2, 2];
    });
    const admitted = admitGltfAsset(buildGlb(json, trianglePositionBytes()));
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const bounds = admitted.value.asset.sceneBounds!;
    expect(bounds.min[0]).toBeCloseTo(-1, 10);
    expect(bounds.min[1]).toBeCloseTo(0, 10);
    expect(bounds.min[2]).toBeCloseTo(0, 10);
    expect(bounds.max[0]).toBeCloseTo(1, 10);
    expect(bounds.max[1]).toBeCloseTo(2, 10);
    expect(bounds.max[2]).toBeCloseTo(0, 10);
  });

  it('computes scene bounds through an explicit node matrix', () => {
    // Column-major translate-by-[5,0,0] matrix.
    const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 0, 0, 1];
    const json = withMutation(canonicalGltfJson(), (draft) => {
      (draft.nodes as Record<string, unknown>[])[0]!.matrix = matrix;
    });
    const admitted = admitGltfAsset(buildGlb(json, trianglePositionBytes()));
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    expect(admitted.value.asset.sceneBounds).toEqual({ min: [5, 0, 0], max: [6, 1, 0] });
  });

  it('reports null scene bounds when the scene presents no mesh geometry', () => {
    const json = withMutation(canonicalGltfJson(), (draft) => {
      draft.nodes = [{ name: 'Empty node' }];
    });
    const admitted = admitGltfAsset(buildGlb(json, trianglePositionBytes()));
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    expect(admitted.value.asset.sceneBounds).toBeNull();
    // The document still DECLARES the mesh (the totals are document
    // accounting); it simply is not presented by the default scene.
    expect(admitted.value.asset.triangleCount).toBe(1);
    expect(admitted.value.asset.meshCount).toBe(1);
  });

  it('refuses pathological DAGs that exceed the scene-walk visit budget', () => {
    // 16 nodes in 8 layers of 2; every node points at BOTH nodes of the
    // next layer — 2^8 distinct paths over a legal DAG. With maxNodes 16
    // the visit budget is 128, but the walk needs 510 visits: a typed
    // limit-exceeded refusal, never an unbounded traversal.
    const nodes: Record<string, unknown>[] = [];
    for (let layer = 0; layer < 8; layer += 1) {
      for (let slot = 0; slot < 2; slot += 1) {
        const index = layer * 2 + slot;
        if (layer < 7) nodes.push({ children: [layer * 2 + 2, layer * 2 + 3] });
        else nodes.push({ name: `leaf-${index}` });
      }
    }
    const json = withMutation(canonicalGltfJson(), (draft) => {
      draft.nodes = nodes;
      (draft.scenes as Record<string, unknown>[])[0]!.nodes = [0, 1];
    });
    const admitted = admitGltfAsset(buildGlb(json, trianglePositionBytes()), { maxNodes: 16 });
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('limit-exceeded');
    expect(admitted.error.message).toContain('visit budget');
  });
});

describe('label suggestions (non-authoritative)', () => {
  it('collects mesh, node, and scene names deterministically (deduplicated, sorted, capped)', () => {
    const admitted = admitGltfAsset(canonicalGlbBytes());
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    expect(admitted.value.asset.labelSuggestions).toEqual([
      { label: 'Fixture mesh', origin: 'mesh-name' },
      { label: 'Fixture node', origin: 'node-name' },
      { label: 'Fixture scene', origin: 'scene-name' },
    ]);
  });

  it('caps the suggestion list at maxLabelSuggestions', () => {
    const json = withMutation(canonicalGltfJson(), (draft) => {
      draft.meshes = (draft.meshes as unknown[]).map((_, index) => ({
        name: `Mesh ${index}`,
        primitives: [{ attributes: { POSITION: 0 } }],
      }));
    });
    const admitted = admitGltfAsset(buildGlb(json, trianglePositionBytes()), {
      maxLabelSuggestions: 2,
    });
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    expect(admitted.value.asset.labelSuggestions).toHaveLength(2);
  });
});

describe('normalizeGltfAsset (direct use over a validated document)', () => {
  it('carries the .gltf container provenance', () => {
    const admitted = admitGltfAsset(canonicalGltfDocumentBytes());
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    expect(admitted.value.asset.container).toBe('gltf');
    // Same geometry as the GLB form: the mesh accounting agrees.
    expect(admitted.value.asset.vertexCount).toBe(3);
    expect(admitted.value.asset.triangleCount).toBe(1);
  });

  it('runs as an explicit pipeline stage over parse + validate', () => {
    const bytes = canonicalGlbBytes();
    const parsed = parseGltfContainer(bytes, GLTF_BRIDGE_DEFAULT_LIMITS);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const validated = validateGltfDocument(parsed.value);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const normalized = normalizeGltfAsset(validated.value, {
      container: parsed.value.container,
      assetBytes: bytes,
    });
    expect(normalized.ok).toBe(true);
    if (!normalized.ok) return;
    // The explicit pipeline equals the one-call admission exactly.
    const oneCall = admitGltfAsset(bytes);
    expect(oneCall.ok).toBe(true);
    if (!oneCall.ok) return;
    expect(normalized.value).toEqual(oneCall.value.asset);
  });

  it('exposes per-mesh local bounds alongside the scene bounds', () => {
    const admitted = admitGltfAsset(canonicalGlbBytes());
    expect(admitted.ok).toBe(true);
    if (!admitted.ok) return;
    const mesh = admitted.value.asset.meshes[0]!;
    expect(mesh.bounds).toEqual({ min: [0, 0, 0], max: [1, 1, 0] });
    expect(mesh.primitives[0]!.bounds).toEqual({ min: [0, 0, 0], max: [1, 1, 0] });
    expect(mesh.primitives[0]!.materialIndex).toBe(0);
    expect(mesh.primitives[0]!.isIndexed).toBe(false);
    expect(mesh.primitives[0]!.hasNormals).toBe(false);
  });
});
