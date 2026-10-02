/**
 * The glTF bridge's TEST FIXTURE BUILDERS (W060) — deterministic glTF/GLB
 * byte constructors for the unit battery (and the import template the
 * qa/foundation-renderers canonical fixture mirrors).
 *
 * Everything here is plain, byte-exact, and stable: the same builders
 * always produce the same bytes, so digests asserted in tests are stable
 * evidence, not magic numbers.
 */

/** The canonical fixture triangle: (0,0,0), (1,0,0), (0,1,0) — little-endian floats. */
export const TRIANGLE_FLOATS: readonly number[] = [0, 0, 0, 1, 0, 0, 0, 1, 0];

/** Encode floats as little-endian IEEE-754 bytes (glTF's binary layout). */
export function float32LeBytes(values: readonly number[]): Uint8Array {
  const out = new Uint8Array(values.length * 4);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  values.forEach((value, index) => view.setFloat32(index * 4, value, true));
  return out;
}

/** The canonical fixture's decoded-buffer bytes (36 bytes of FLOAT VEC3 positions). */
export function trianglePositionBytes(): Uint8Array {
  return float32LeBytes(TRIANGLE_FLOATS);
}

/** The canonical fixture glTF JSON document (the validated core subset). */
export function canonicalGltfJson(): Record<string, unknown> {
  return {
    asset: { version: '2.0', generator: 'epoch-gltf-fixture/1' },
    scene: 0,
    scenes: [{ name: 'Fixture scene', nodes: [0] }],
    nodes: [{ name: 'Fixture node', mesh: 0, translation: [1, 0, 0] }],
    meshes: [
      {
        name: 'Fixture mesh',
        primitives: [
          {
            attributes: { POSITION: 0 },
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        name: 'Fixture material',
        pbrMetallicRoughness: { baseColorFactor: [0.8, 0.4, 0.2, 1] },
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    buffers: [{ byteLength: 36 }], // GLB: buffer 0 binds to the BIN chunk
  };
}

/** Build one GLB container from a JSON document and an optional BIN payload. */
export function buildGlb(json: Record<string, unknown>, bin: Uint8Array | null): Uint8Array {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
  const binPadding = bin === null ? 0 : (4 - (bin.length % 4)) % 4;
  const jsonChunkLength = jsonBytes.length + jsonPadding;
  const binChunkLength = bin === null ? 0 : bin.length + binPadding;
  const total = 12 + 8 + jsonChunkLength + (bin === null ? 0 : 8 + binChunkLength);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  view.setUint32(0, 0x46546c67, true); // 'glTF'
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonChunkLength, true);
  view.setUint32(16, 0x4e4f534a, true); // 'JSON'
  out.set(jsonBytes, 20);
  for (let i = 0; i < jsonPadding; i += 1) out[20 + jsonBytes.length + i] = 0x20; // space padding
  if (bin !== null) {
    const binHeader = 20 + jsonChunkLength;
    view.setUint32(binHeader, binChunkLength, true);
    view.setUint32(binHeader + 4, 0x004e4942, true); // 'BIN\0'
    out.set(bin, binHeader + 8);
    // zero padding (already zero-initialized)
  }
  return out;
}

/** The canonical fixture GLB (JSON + 36-byte BIN of the triangle positions). */
export function canonicalGlbBytes(): Uint8Array {
  return buildGlb(canonicalGltfJson(), trianglePositionBytes());
}

/** The canonical fixture as a .gltf JSON document (data-URI buffer). */
export function canonicalGltfDocumentBytes(): Uint8Array {
  const json = canonicalGltfJson();
  const encoded = trianglePositionBytes();
  let binary = '';
  for (const byte of encoded) binary += String.fromCharCode(byte);
  json.buffers = [
    {
      byteLength: encoded.length,
      uri: `data:application/octet-stream;base64,${btoa(binary)}`,
    },
  ];
  return new TextEncoder().encode(JSON.stringify(json));
}

/** A deep JSON clone with mutations applied (fixture tampering helper). */
export function withMutation(
  json: Record<string, unknown>,
  mutate: (draft: Record<string, unknown>) => void,
): Record<string, unknown> {
  const draft = structuredClone(json) as Record<string, unknown>;
  mutate(draft);
  return draft;
}
