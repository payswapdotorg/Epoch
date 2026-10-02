/**
 * The GLB binary-container parser (W060) — pure code over Uint8Array.
 *
 * GLB layout (glTF 2.0 spec §3.4):
 *
 *   header (12 bytes): magic 'glTF' (0x46546C67), version 2, total length
 *   chunk 0: JSON  (length, type 0x4E4F534A 'JSON', padded to 4 bytes)
 *   chunk 1: BIN   (optional; length, type 0x004E4942 'BIN\0', padded)
 *   further chunks: allowed by the spec and ignored here (forward-compatible)
 *
 * Every malformed shape is a typed `glb-invalid` refusal. The parser is
 * memory-safe by construction: every slice is bounds-checked against the
 * actual byte length BEFORE allocation.
 */
import { gltfFailure, type GltfBridgeResult } from './version';

/** The GLB magic bytes as ASCII ('glTF'). */
export const GLB_MAGIC = 0x46546c67;

/** The GLB container version this parser admits. */
export const GLB_VERSION = 2;

/** The JSON chunk type. */
export const GLB_CHUNK_JSON = 0x4e4f534a;

/** The BIN chunk type. */
export const GLB_CHUNK_BIN = 0x004e4942;

/** The fixed GLB header size in bytes. */
export const GLB_HEADER_BYTES = 12;

/** One parsed GLB chunk (a bounds-checked view over the input bytes). */
export type GlbChunk = {
  readonly chunkType: number;
  readonly byteOffset: number;
  readonly byteLength: number;
};

/** One parsed GLB container. */
export type GlbContainer = {
  /** The raw document bytes (the JSON chunk, byte-exact). */
  readonly jsonBytes: Uint8Array;
  /** The optional BIN chunk bytes (byte-exact, WITHOUT its padding). */
  readonly binBytes: Uint8Array | null;
  /** Every chunk in order (evidence for forward-compatibility auditing). */
  readonly chunks: readonly GlbChunk[];
};

/** Parse and structurally validate one GLB container. */
export function parseGlb(bytes: Uint8Array): GltfBridgeResult<GlbContainer> {
  if (bytes.length < GLB_HEADER_BYTES + 8) {
    return gltfFailure(
      'glb-invalid',
      `GLB is ${bytes.length} bytes; the minimum is a 12-byte header plus an 8-byte chunk header`,
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== GLB_MAGIC) {
    return gltfFailure('glb-invalid', `GLB magic is 0x${magic.toString(16)}; expected 0x46546c67 ('glTF')`);
  }
  const version = view.getUint32(4, true);
  if (version !== GLB_VERSION) {
    return gltfFailure('glb-invalid', `GLB container version is ${version}; only version 2 is admitted`);
  }
  const declaredLength = view.getUint32(8, true);
  if (declaredLength !== bytes.length) {
    return gltfFailure(
      'glb-invalid',
      `GLB declares a total length of ${declaredLength} bytes but carries ${bytes.length}`,
    );
  }

  const chunks: GlbChunk[] = [];
  let offset = GLB_HEADER_BYTES;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) {
      return gltfFailure('glb-invalid', `GLB chunk header at byte ${offset} is truncated`);
    }
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const dataOffset = offset + 8;
    if (chunkLength === 0) {
      return gltfFailure('glb-invalid', `GLB chunk at byte ${offset} declares length 0`);
    }
    if (dataOffset + chunkLength > bytes.length) {
      return gltfFailure(
        'glb-invalid',
        `GLB chunk at byte ${offset} declares ${chunkLength} data bytes but only ${bytes.length - dataOffset} remain`,
      );
    }
    chunks.push({ chunkType, byteOffset: dataOffset, byteLength: chunkLength });
    // Chunks are padded to 4-byte alignment; the declared length EXCLUDES
    // the padding, so round up to the next multiple of 4 to find the next
    // chunk header.
    const padded = Math.ceil(chunkLength / 4) * 4;
    offset = dataOffset + padded;
    if (offset > bytes.length) {
      return gltfFailure(
        'glb-invalid',
        `GLB chunk at byte ${dataOffset - 8} plus its padding overruns the container`,
      );
    }
  }
  if (chunks.length === 0) {
    return gltfFailure('glb-invalid', 'GLB carries no chunks');
  }
  if (chunks[0].chunkType !== GLB_CHUNK_JSON) {
    return gltfFailure('glb-invalid', 'the first GLB chunk must be the JSON chunk');
  }
  const jsonChunk = chunks[0];
  const binChunk = chunks.find((chunk, index) => index > 0 && chunk.chunkType === GLB_CHUNK_BIN);
  // The BIN chunk, when present, must be the SECOND chunk (spec §3.4).
  if (binChunk !== undefined && chunks[1] !== binChunk) {
    return gltfFailure('glb-invalid', 'the BIN chunk must immediately follow the JSON chunk');
  }
  return {
    ok: true,
    value: {
      jsonBytes: bytes.subarray(jsonChunk.byteOffset, jsonChunk.byteOffset + jsonChunk.byteLength),
      binBytes:
        binChunk === undefined
          ? null
          : bytes.subarray(binChunk.byteOffset, binChunk.byteOffset + binChunk.byteLength),
      chunks,
    },
  };
}
