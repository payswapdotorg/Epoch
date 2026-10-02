/**
 * The structural-validator battery (W060): the trust gate's positive paths
 * (the canonical GLB, the .gltf data-URI form, the glTF defaults) and every
 * documented refusal class — untrusted input is refused with a TYPED code
 * and a precise JSON path, never a throw, never a truncated parse.
 */
import { describe, expect, it } from 'vitest';
import { parseGltfContainer, validateGltfDocument } from '../src/validate';
import { GLTF_BRIDGE_DEFAULT_LIMITS } from '../src/limits';
import {
  buildGlb,
  canonicalGlbBytes,
  canonicalGltfDocumentBytes,
  canonicalGltfJson,
  float32LeBytes,
  trianglePositionBytes,
  withMutation,
} from './helpers';

/** The typed failure code of a refusal (undefined on success). */
function errorCodeOf(
  result: { ok: true; value: unknown } | { ok: false; error: { code: string } },
): string | undefined {
  return result.ok ? undefined : result.error.code;
}

/** Validate raw bytes through the full pipeline (parse + validate). */
function validateBytes(bytes: Uint8Array, limits?: Parameters<typeof validateGltfDocument>[1]) {
  const parsed = parseGltfContainer(bytes, { ...GLTF_BRIDGE_DEFAULT_LIMITS });
  if (!parsed.ok) return parsed;
  return validateGltfDocument(parsed.value, limits);
}

/** Assert a typed refusal with the expected code (readable failures). */
function expectRefusal(result: ReturnType<typeof validateBytes>, code: string): string {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected a refusal');
  expect(result.error.code).toBe(code);
  return result.error.message;
}

describe('validateGltfDocument (positive paths)', () => {
  it('admits the canonical fixture GLB', () => {
    const result = validateBytes(canonicalGlbBytes());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.gltfVersion).toBe('2.0');
    expect(result.value.generator).toBe('epoch-gltf-fixture/1');
    expect(result.value.defaultSceneIndex).toBe(0);
    expect(result.value.nodes).toHaveLength(1);
    expect(result.value.meshes).toHaveLength(1);
    expect(result.value.meshes[0]!.primitives[0]!.vertexCount).toBe(3);
    expect(result.value.meshes[0]!.primitives[0]!.triangleCount).toBe(1);
    expect(result.value.buffers).toHaveLength(1);
    expect(result.value.buffers[0]!.length).toBe(36);
    expect(result.value.materials[0]!.baseColor).toEqual([0.8, 0.4, 0.2, 1]);
  });

  it('admits the .gltf data-URI form of the same document', () => {
    const result = validateBytes(canonicalGltfDocumentBytes());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.buffers[0]!.length).toBe(36);
  });

  it('applies glTF defaults (mode triangles, byteOffset 0, opaque material)', () => {
    const result = validateBytes(canonicalGlbBytes());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.meshes[0]!.primitives[0]!.mode).toBe(4);
    expect(result.value.bufferViews[0]!.byteOffset).toBe(0);
    expect(result.value.materials[0]!.alphaMode).toBe('OPAQUE');
    expect(result.value.materials[0]!.doubleSided).toBe(false);
  });

  it('admits minVersion "2.0" alongside version "2.0"', () => {
    const json = withMutation(canonicalGltfJson(), (draft) => {
      (draft.asset as Record<string, unknown>).minVersion = '2.0';
    });
    const result = validateBytes(buildGlb(json, trianglePositionBytes()));
    expect(result.ok && result.value.minVersion).toBe('2.0');
  });
});

describe('validateGltfDocument (container and document refusals)', () => {
  it('refuses empty input and oversized documents (limit-exceeded)', () => {
    const empty = parseGltfContainer(new Uint8Array(0), GLTF_BRIDGE_DEFAULT_LIMITS);
    expect(errorCodeOf(empty)).toBe('input-empty');

    const oversized = parseGltfContainer(canonicalGlbBytes(), {
      ...GLTF_BRIDGE_DEFAULT_LIMITS,
      maxDocumentBytes: 16,
    });
    expect(errorCodeOf(oversized)).toBe('limit-exceeded');
  });

  it('refuses malformed JSON and non-object documents (malformed-json)', () => {
    const garbage = new TextEncoder().encode('not json at all');
    const parsed = parseGltfContainer(garbage, GLTF_BRIDGE_DEFAULT_LIMITS);
    expect(errorCodeOf(parsed)).toBe('malformed-json');

    const array = new TextEncoder().encode('[1,2,3]');
    const arrayParsed = parseGltfContainer(array, GLTF_BRIDGE_DEFAULT_LIMITS);
    expect(errorCodeOf(arrayParsed)).toBe('malformed-json');
  });

  it('refuses non-2.x asset versions (not-gltf2)', () => {
    for (const version of ['1.0', '3.0', '2', '2.x']) {
      const json = withMutation(canonicalGltfJson(), (draft) => {
        (draft.asset as Record<string, unknown>).version = version;
      });
      const result = validateBytes(buildGlb(json, trianglePositionBytes()));
      expect(errorCodeOf(result)).toBe('not-gltf2');
    }
  });

  it('refuses documents that require extensions (unsupported-feature)', () => {
    const json = withMutation(canonicalGltfJson(), (draft) => {
      draft.extensionsRequired = ['KHR_mesh_quantization'];
    });
    const result = validateBytes(buildGlb(json, trianglePositionBytes()));
    const message = expectRefusal(result, 'unsupported-feature');
    expect(message).toContain('KHR_mesh_quantization');
  });
});

describe('validateGltfDocument (buffer/bufferView/accessor refusals)', () => {
  it('refuses external resource URIs (buffer-unresolvable)', () => {
    const json = withMutation(canonicalGltfJson(), (draft) => {
      draft.buffers = [{ byteLength: 36, uri: 'https://assets.example.com/positions.bin' }];
    });
    const result = validateBytes(buildGlb(json, null));
    const message = expectRefusal(result, 'buffer-unresolvable');
    expect(message).toContain('non-embedded resource');
  });

  it('refuses data-URI buffers that decode to the wrong length (buffer-mismatch)', () => {
    const json = withMutation(canonicalGltfJson(), (draft) => {
      draft.buffers = [{ byteLength: 35, uri: 'data:application/octet-stream;base64,AAAA' }];
    });
    const result = validateBytes(buildGlb(json, null));
    expect(errorCodeOf(result)).toBe('buffer-mismatch');
  });

  it('refuses a GLB buffer larger than its BIN chunk (buffer-mismatch)', () => {
    const json = withMutation(canonicalGltfJson(), (draft) => {
      draft.buffers = [{ byteLength: 1024 }]; // the BIN chunk carries only 36
    });
    const result = validateBytes(buildGlb(json, trianglePositionBytes()));
    expect(errorCodeOf(result)).toBe('buffer-mismatch');
  });

  it('refuses bufferViews that overrun their buffer (bufferview-invalid)', () => {
    const json = withMutation(canonicalGltfJson(), (draft) => {
      draft.bufferViews = [{ buffer: 0, byteOffset: 12, byteLength: 36 }];
    });
    const result = validateBytes(buildGlb(json, trianglePositionBytes()));
    expect(errorCodeOf(result)).toBe('bufferview-invalid');
  });

  it('refuses invalid byteStride (bufferview-invalid)', () => {
    const json = withMutation(canonicalGltfJson(), (draft) => {
      draft.bufferViews = [{ buffer: 0, byteOffset: 0, byteLength: 36, byteStride: 6 }];
    });
    const result = validateBytes(buildGlb(json, trianglePositionBytes()));
    expect(errorCodeOf(result)).toBe('bufferview-invalid');
  });

  it('refuses sparse accessors (unsupported-feature)', () => {
    const json = withMutation(canonicalGltfJson(), (draft) => {
      (draft.accessors as Record<string, unknown>[])[0]!.sparse = { count: 1 };
    });
    const result = validateBytes(buildGlb(json, trianglePositionBytes()));
    expect(errorCodeOf(result)).toBe('unsupported-feature');
  });

  it('refuses NaN and Infinity floats in the position buffer (accessor-invalid)', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const poisoned = float32LeBytes([bad, 0, 0, 1, 0, 0, 0, 1, 0]);
      const result = validateBytes(buildGlb(canonicalGltfJson(), poisoned));
      expect(errorCodeOf(result)).toBe('accessor-invalid');
    }
  });

  it('refuses accessors that overrun their bufferView (accessor-invalid)', () => {
    const json = withMutation(canonicalGltfJson(), (draft) => {
      (draft.accessors as Record<string, unknown>[])[0]!.count = 4;
    });
    const result = validateBytes(buildGlb(json, trianglePositionBytes()));
    expect(errorCodeOf(result)).toBe('accessor-invalid');
  });

  it('refuses POSITION min/max inversions (accessor-invalid)', () => {
    const json = withMutation(canonicalGltfJson(), (draft) => {
      (draft.accessors as Record<string, unknown>[])[0]!.min = [2, 0, 0];
    });
    const result = validateBytes(buildGlb(json, trianglePositionBytes()));
    expect(errorCodeOf(result)).toBe('accessor-invalid');
  });
});

describe('validateGltfDocument (mesh refusals)', () => {
  it('refuses POSITION accessors that are not FLOAT VEC3 (mesh-invalid)', () => {
    const json = withMutation(canonicalGltfJson(), (draft) => {
      (draft.accessors as Record<string, unknown>[])[0]!.componentType = 5123; // UNSIGNED_SHORT
    });
    const result = validateBytes(buildGlb(json, trianglePositionBytes()));
    expect(errorCodeOf(result)).toBe('mesh-invalid');
  });

  it('refuses POSITION accessors without declared min/max (mesh-invalid)', () => {
    const json = withMutation(canonicalGltfJson(), (draft) => {
      delete (draft.accessors as Record<string, unknown>[])[0]!.min;
      delete (draft.accessors as Record<string, unknown>[])[0]!.max;
    });
    const result = validateBytes(buildGlb(json, trianglePositionBytes()));
    const message = expectRefusal(result, 'mesh-invalid');
    expect(message).toContain('min/max');
  });

  it('refuses non-triangle draw modes (unsupported-feature)', () => {
    const json = withMutation(canonicalGltfJson(), (draft) => {
      (draft.meshes as Record<string, unknown>[])[0]!.primitives = [
        { attributes: { POSITION: 0 }, mode: 1 }, // POINTS
      ];
    });
    const result = validateBytes(buildGlb(json, trianglePositionBytes()));
    expect(errorCodeOf(result)).toBe('unsupported-feature');
  });

  it('refuses indices whose count is not a multiple of 3 (mesh-invalid)', () => {
    // A 4-entry UNSIGNED_SHORT index stream (indices count 4 % 3 !== 0).
    const indexBytes = float32LeBytes([0, 1, 2, 0]).subarray(0, 8);
    const json = withMutation(canonicalGltfJson(), (draft) => {
      (draft.meshes as Record<string, unknown>[])[0]!.primitives = [
        { attributes: { POSITION: 0 }, indices: 1 },
      ];
      (draft.accessors as unknown[]).push({
        bufferView: 1,
        componentType: 5123,
        count: 4,
        type: 'SCALAR',
      });
      (draft.bufferViews as unknown[]).push({ buffer: 0, byteOffset: 36, byteLength: 8 });
      (draft.buffers as Record<string, unknown>[])[0]!.byteLength = 44;
    });
    const merged = new Uint8Array(36 + 8);
    merged.set(trianglePositionBytes(), 0);
    merged.set(indexBytes, 36);
    const result = validateBytes(buildGlb(json, merged));
    expect(errorCodeOf(result)).toBe('mesh-invalid');
  });

  it('refuses material factors outside [0, 1] (material-invalid)', () => {
    const json = withMutation(canonicalGltfJson(), (draft) => {
      (draft.materials as Record<string, unknown>[])[0]!.pbrMetallicRoughness = {
        baseColorFactor: [1.5, 0.4, 0.2, 1],
      };
    });
    const result = validateBytes(buildGlb(json, trianglePositionBytes()));
    expect(errorCodeOf(result)).toBe('material-invalid');
  });
});

describe('validateGltfDocument (node-graph refusals)', () => {
  it('refuses self-children, duplicate children, and out-of-range indices', () => {
    const selfChild = withMutation(canonicalGltfJson(), (draft) => {
      (draft.nodes as Record<string, unknown>[])[0]!.children = [0];
    });
    expectRefusal(validateBytes(buildGlb(selfChild, trianglePositionBytes())), 'node-graph-invalid');

    const duplicate = withMutation(canonicalGltfJson(), (draft) => {
      draft.nodes = [{ mesh: 0, children: [1, 1] }, { name: 'Shared child' }];
      (draft.scenes as Record<string, unknown>[])[0]!.nodes = [0];
    });
    expectRefusal(validateBytes(buildGlb(duplicate, trianglePositionBytes())), 'node-graph-invalid');

    const outOfRange = withMutation(canonicalGltfJson(), (draft) => {
      (draft.nodes as Record<string, unknown>[])[0]!.children = [9];
    });
    expectRefusal(validateBytes(buildGlb(outOfRange, trianglePositionBytes())), 'not-gltf2');
  });

  it('admits DAG sharing (a node reachable from two parents)', () => {
    const shared = withMutation(canonicalGltfJson(), (draft) => {
      draft.nodes = [
        { children: [2] },
        { children: [2] },
        { mesh: 0 },
      ];
      (draft.scenes as Record<string, unknown>[])[0]!.nodes = [0, 1];
    });
    const result = validateBytes(buildGlb(shared, trianglePositionBytes()));
    expect(result.ok).toBe(true);
  });

  it('refuses cycles (node-graph-invalid)', () => {
    const json = withMutation(canonicalGltfJson(), (draft) => {
      draft.nodes = [
        { children: [1] },
        { children: [2] },
        { children: [0] },
      ];
      (draft.scenes as Record<string, unknown>[])[0]!.nodes = [0];
    });
    const result = validateBytes(buildGlb(json, trianglePositionBytes()));
    const message = expectRefusal(result, 'node-graph-invalid');
    expect(message).toContain('cycle');
  });

  it('refuses depth overruns under tight limits (node-graph-invalid)', () => {
    // A 10-node chain rooted at node 0: the DFS descends 10 levels deep,
    // overrunning a maxNodeDepth of 4.
    const chain = withMutation(canonicalGltfJson(), (draft) => {
      draft.nodes = Array.from({ length: 10 }, (_, index) =>
        index < 9 ? { children: [index + 1] } : { mesh: 0 },
      );
      (draft.scenes as Record<string, unknown>[])[0]!.nodes = [0];
    });
    const result = validateBytes(buildGlb(chain, trianglePositionBytes()), { maxNodeDepth: 4 });
    const message = expectRefusal(result, 'node-graph-invalid');
    expect(message).toContain('depth');
  });

  it('refuses scene nodes outside the node table (not-gltf2)', () => {
    const json = withMutation(canonicalGltfJson(), (draft) => {
      (draft.scenes as Record<string, unknown>[])[0]!.nodes = [7];
    });
    const result = validateBytes(buildGlb(json, trianglePositionBytes()));
    expect(errorCodeOf(result)).toBe('not-gltf2');
  });

  it('enforces the count limits (limit-exceeded)', () => {
    const many = withMutation(canonicalGltfJson(), (draft) => {
      draft.materials = Array.from({ length: 3 }, (_, i) => ({ name: `m${i}` }));
    });
    const result = validateBytes(buildGlb(many, trianglePositionBytes()), { maxMaterials: 2 });
    expect(errorCodeOf(result)).toBe('limit-exceeded');
  });
});
