/**
 * The glTF 2.0 structural VALIDATOR (W060) — the trust gate of the bridge.
 *
 * Everything here is PURE CODE over the parsed bytes: no filesystem, no
 * network, no wall-clock, no randomness. External resources are a typed
 * `buffer-unresolvable` refusal — the bridge resolves ONLY embedded
 * content (data-URI buffers and the GLB BIN chunk); acquiring external
 * resources is the HOST's concern, and whatever the host acquires re-enters
 * through this same validation before anything mounts.
 *
 * The validated core subset (glTF 2.0 spec, strict):
 * - asset.version "2.x" (and minVersion, when present, 2.x);
 * - extensionsRequired MUST be empty (core-only honesty: the bridge never
 *   silently ignores an extension a asset actually requires);
 * - scenes/nodes/meshes/primitives/accessors/bufferViews/buffers/materials;
 * - triangle draw mode only (mode 4); POSITION accessors are FLOAT VEC3 with
 *   REQUIRED declared min/max; indices are unsigned SCALAR with count % 3 === 0;
 * - node graphs are DAGs (cycles and depth overruns are typed refusals);
 * - sparse accessors and non-triangle modes are typed unsupported-feature;
 * - every float the projection depends on is scanned for non-finite values
 *   (NaN/Infinity never cross this boundary).
 *
 * What the validator deliberately does NOT do: it never renders, never
 * mounts, never interprets extensions/extras, and never creates semantic
 * state — the validated projection is DATA, and the only thing downstream
 * (normalize.ts) does is content-address it.
 */
import { decodeBase64, isPlainObject, startsWithAscii, utf8Text } from './bytes';
import { parseGlb } from './glb';
import { resolveLimits, type GltfBridgeLimits } from './limits';
import {
  GLTF_ACCESSOR_TYPES,
  GLTF_COMPONENT_TYPE_SIZES,
  GLTF_COMPONENT_TYPES,
  GLTF_MODE_TRIANGLES,
  gltfFailure,
  type GltfBridgeResult,
} from './version';

// ---------------------------------------------------------------------------
// The validated document (the internal IR normalize.ts projects from).
// ---------------------------------------------------------------------------

/** A validated glTF scene. */
export type ValidatedGltfScene = {
  readonly name: string | null;
  readonly rootNodeIndices: readonly number[];
};

/** A validated glTF node (the local transform is kept verbatim). */
export type ValidatedGltfNode = {
  readonly name: string | null;
  readonly children: readonly number[];
  readonly meshIndex: number | null;
  /** Column-major 4x4 when the node declares `matrix` (glTF layout). */
  readonly matrix: readonly number[] | null;
  readonly translation: readonly number[] | null;
  readonly rotation: readonly number[] | null;
  readonly scale: readonly number[] | null;
};

/** One validated mesh primitive. */
export type ValidatedGltfPrimitive = {
  readonly mode: typeof GLTF_MODE_TRIANGLES;
  readonly positionAccessorIndex: number;
  readonly normalAccessorIndex: number | null;
  readonly texcoordAccessorIndex: number | null;
  readonly indicesAccessorIndex: number | null;
  readonly materialIndex: number | null;
  readonly vertexCount: number;
  readonly triangleCount: number;
  /** The declared POSITION accessor min/max (validated finite, min <= max). */
  readonly bounds: { readonly min: readonly number[]; readonly max: readonly number[] };
};

/** A validated glTF mesh. */
export type ValidatedGltfMesh = {
  readonly name: string | null;
  readonly primitives: readonly ValidatedGltfPrimitive[];
};

/** A validated glTF material (the neutral presentation subset). */
export type ValidatedGltfMaterial = {
  readonly name: string | null;
  readonly baseColor: readonly number[] | null;
  readonly alphaMode: 'BLEND' | 'MASK' | 'OPAQUE';
  readonly alphaCutoff: number | null;
  readonly doubleSided: boolean;
};

/** A validated glTF accessor (structure + declared min/max). */
export type ValidatedGltfAccessor = {
  readonly componentType: number;
  readonly accessorType: string;
  readonly componentCount: number;
  readonly count: number;
  readonly bufferViewIndex: number | null;
  readonly byteOffset: number;
  readonly min: readonly number[] | null;
  readonly max: readonly number[] | null;
};

/** A validated glTF bufferView. */
export type ValidatedGltfBufferView = {
  readonly bufferIndex: number;
  readonly byteOffset: number;
  readonly byteLength: number;
  readonly byteStride: number | null;
};

/** The fully validated glTF document (everything the projection needs). */
export type ValidatedGltfDocument = {
  readonly gltfVersion: string;
  readonly minVersion: string | null;
  readonly generator: string | null;
  readonly defaultSceneIndex: number | null;
  readonly scenes: readonly ValidatedGltfScene[];
  readonly nodes: readonly ValidatedGltfNode[];
  readonly meshes: readonly ValidatedGltfMesh[];
  readonly materials: readonly ValidatedGltfMaterial[];
  readonly accessors: readonly ValidatedGltfAccessor[];
  readonly bufferViews: readonly ValidatedGltfBufferView[];
  /** The decoded buffer bytes (embedded content only, in document order). */
  readonly buffers: readonly Uint8Array[];
  readonly textureCount: number;
  /** The resolved limits this admission ran under (evidence). */
  readonly limits: Readonly<GltfBridgeLimits>;
};

// ---------------------------------------------------------------------------
// Small typed helpers (every check fails with the glTF JSON path).
// ---------------------------------------------------------------------------

function asArray(value: unknown, path: string): GltfBridgeResult<unknown[]> {
  if (!Array.isArray(value)) {
    return gltfFailure('not-gltf2', `expected an array at "${path}"`, path);
  }
  return { ok: true, value };
}

function asIndex(
  value: unknown,
  path: string,
  length: number,
): GltfBridgeResult<number> {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value >= length) {
    return gltfFailure(
      'not-gltf2',
      `expected an index in [0, ${length}) at "${path}" (got ${JSON.stringify(value)})`,
      path,
    );
  }
  return { ok: true, value };
}

function asInt(
  value: unknown,
  path: string,
  min: number,
): GltfBridgeResult<number> {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    return gltfFailure(
      'not-gltf2',
      `expected an integer >= ${min} at "${path}" (got ${JSON.stringify(value)})`,
      path,
    );
  }
  return { ok: true, value };
}

function asFiniteNumber(value: unknown, path: string): GltfBridgeResult<number> {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return gltfFailure('not-gltf2', `expected a finite number at "${path}"`, path);
  }
  return { ok: true, value };
}

function asName(value: unknown, path: string, limits: GltfBridgeLimits): GltfBridgeResult<string | null> {
  if (value === undefined) return { ok: true, value: null };
  if (typeof value !== 'string' || value.length === 0 || value.length > limits.maxNameLength) {
    return gltfFailure(
      'not-gltf2',
      `expected a non-empty name of at most ${limits.maxNameLength} characters at "${path}"`,
      path,
    );
  }
  return { ok: true, value };
}

function asFiniteVec(value: unknown, path: string, length: number): GltfBridgeResult<number[]> {
  const items = asArray(value, path);
  if (!items.ok) return items;
  if (items.value.length !== length) {
    return gltfFailure('not-gltf2', `expected exactly ${length} numbers at "${path}"`, path);
  }
  const out: number[] = [];
  for (let i = 0; i < length; i += 1) {
    const component = asFiniteNumber(items.value[i], `${path}[${i}]`);
    if (!component.ok) return component;
    out.push(component.value);
  }
  return { ok: true, value: out };
}

function asBool(value: unknown, path: string): GltfBridgeResult<boolean> {
  if (typeof value !== 'boolean') {
    return gltfFailure('not-gltf2', `expected a boolean at "${path}"`, path);
  }
  return { ok: true, value: value };
}

// ---------------------------------------------------------------------------
// The container + JSON entry point.
// ---------------------------------------------------------------------------

/** The parsed container form handed to the structural validator. */
export type ParsedGltfContainer = {
  readonly container: 'gltf' | 'glb';
  readonly document: Record<string, unknown>;
  readonly binChunk: Uint8Array | null;
};

/** Detect the container, enforce the size cap, and parse the JSON document. */
export function parseGltfContainer(
  bytes: Uint8Array,
  limits: GltfBridgeLimits,
): GltfBridgeResult<ParsedGltfContainer> {
  if (bytes.length === 0) {
    return gltfFailure('input-empty', 'the asset bytes are empty');
  }
  if (bytes.length > limits.maxDocumentBytes) {
    return gltfFailure(
      'limit-exceeded',
      `the document is ${bytes.length} bytes; the limit is ${limits.maxDocumentBytes}`,
    );
  }
  if (startsWithAscii(bytes, 'glTF')) {
    const container = parseGlb(bytes);
    if (!container.ok) return container;
    let document: unknown;
    try {
      document = JSON.parse(utf8Text(container.value.jsonBytes));
    } catch (err) {
      return gltfFailure(
        'malformed-json',
        `the GLB JSON chunk is not valid JSON: ${(err as Error).message}`,
      );
    }
    if (!isPlainObject(document)) {
      return gltfFailure('malformed-json', 'the GLB JSON chunk is not a JSON object');
    }
    return {
      ok: true,
      value: { container: 'glb', document, binChunk: container.value.binBytes },
    };
  }
  let document: unknown;
  try {
    document = JSON.parse(utf8Text(bytes));
  } catch (err) {
    return gltfFailure('malformed-json', `the document is not valid JSON: ${(err as Error).message}`);
  }
  if (!isPlainObject(document)) {
    return gltfFailure('malformed-json', 'the document is not a JSON object');
  }
  return { ok: true, value: { container: 'gltf', document, binChunk: null } };
}

// ---------------------------------------------------------------------------
// The structural validator (one function per top-level table; the document
// is walked in dependency order: buffers -> bufferViews -> accessors ->
// materials -> meshes -> nodes -> scenes).
// ---------------------------------------------------------------------------

function validateBuffers(
  document: Record<string, unknown>,
  binChunk: Uint8Array | null,
  limits: GltfBridgeLimits,
): GltfBridgeResult<Uint8Array[]> {
  const raw = asArray(document.buffers ?? [], 'buffers');
  if (!raw.ok) return raw;
  if (raw.value.length > 64) {
    return gltfFailure('limit-exceeded', `the document declares ${raw.value.length} buffers (max 64)`, 'buffers');
  }
  const out: Uint8Array[] = [];
  let totalBytes = 0;
  for (let i = 0; i < raw.value.length; i += 1) {
    const path = `buffers[${i}]`;
    const entry = raw.value[i];
    if (!isPlainObject(entry)) {
      return gltfFailure('not-gltf2', `expected an object at "${path}"`, path);
    }
    const byteLength = asInt(entry.byteLength, `${path}.byteLength`, 1);
    if (!byteLength.ok) return byteLength;
    const uri = entry.uri;
    if (uri === undefined) {
      // The GLB first buffer may omit the URI and bind to the BIN chunk.
      if (i === 0 && binChunk !== null) {
        if (binChunk.length < byteLength.value) {
          return gltfFailure(
            'buffer-mismatch',
            `buffer 0 declares ${byteLength.value} bytes but the GLB BIN chunk carries ${binChunk.length}`,
            path,
          );
        }
        out.push(binChunk);
        totalBytes += binChunk.length;
        continue;
      }
      return gltfFailure(
        'buffer-unresolvable',
        `buffer ${i} has no URI and no GLB BIN chunk backs it (external resources are not resolved by the bridge)`,
        path,
      );
    }
    if (typeof uri !== 'string') {
      return gltfFailure('not-gltf2', `expected a string URI at "${path}.uri"`, `${path}.uri`);
    }
    const dataUriMatch = /^data:([^;,]+)?(;charset=[^;,]+)?;base64,(.*)$/s.exec(uri);
    if (dataUriMatch === null) {
      return gltfFailure(
        'buffer-unresolvable',
        `buffer ${i} references a non-embedded resource ("${uri.slice(0, 64)}"); the bridge resolves only data URIs and the GLB BIN chunk`,
        `${path}.uri`,
      );
    }
    const decoded = decodeBase64(dataUriMatch[3]);
    if (!decoded.ok) {
      return gltfFailure('buffer-unresolvable', `buffer ${i} data URI is not canonical base64: ${decoded.error}`, `${path}.uri`);
    }
    if (decoded.bytes.length !== byteLength.value) {
      return gltfFailure(
        'buffer-mismatch',
        `buffer ${i} declares ${byteLength.value} bytes but its data URI decodes to ${decoded.bytes.length}`,
        path,
      );
    }
    totalBytes += decoded.bytes.length;
    if (totalBytes > limits.maxBufferBytes) {
      return gltfFailure(
        'limit-exceeded',
        `decoded buffer bytes exceed the limit (${totalBytes} > ${limits.maxBufferBytes})`,
        'buffers',
      );
    }
    out.push(decoded.bytes);
  }
  return { ok: true, value: out };
}

function validateBufferViews(
  document: Record<string, unknown>,
  buffers: readonly Uint8Array[],
  limits: GltfBridgeLimits,
): GltfBridgeResult<ValidatedGltfBufferView[]> {
  const raw = asArray(document.bufferViews ?? [], 'bufferViews');
  if (!raw.ok) return raw;
  if (raw.value.length > limits.maxBufferViews) {
    return gltfFailure('limit-exceeded', `the document declares ${raw.value.length} bufferViews (max ${limits.maxBufferViews})`, 'bufferViews');
  }
  const out: ValidatedGltfBufferView[] = [];
  for (let i = 0; i < raw.value.length; i += 1) {
    const path = `bufferViews[${i}]`;
    const entry = raw.value[i];
    if (!isPlainObject(entry)) {
      return gltfFailure('not-gltf2', `expected an object at "${path}"`, path);
    }
    const bufferIndex = asIndex(entry.buffer, `${path}.buffer`, buffers.length);
    if (!bufferIndex.ok) return bufferIndex;
    let offsetValue = 0;
    if (entry.byteOffset !== undefined) {
      const offset = asInt(entry.byteOffset, `${path}.byteOffset`, 0);
      if (!offset.ok) return offset;
      offsetValue = offset.value;
    }
    const byteLength = asInt(entry.byteLength, `${path}.byteLength`, 1);
    if (!byteLength.ok) return byteLength;
    const buffer = buffers[bufferIndex.value]!;
    if (offsetValue + byteLength.value > buffer.length) {
      return gltfFailure(
        'bufferview-invalid',
        `bufferView ${i} spans bytes [${offsetValue}, ${offsetValue + byteLength.value}) but buffer ${bufferIndex.value} carries ${buffer.length}`,
        path,
      );
    }
    let stride: number | null = null;
    if (entry.byteStride !== undefined) {
      const strideCheck = asInt(entry.byteStride, `${path}.byteStride`, 4);
      if (!strideCheck.ok) return strideCheck;
      if (strideCheck.value > 252 || strideCheck.value % 4 !== 0) {
        return gltfFailure(
          'bufferview-invalid',
          `bufferView ${i} byteStride ${strideCheck.value} must be a multiple of 4 in [4, 252]`,
          `${path}.byteStride`,
        );
      }
      stride = strideCheck.value;
    }
    out.push({
      bufferIndex: bufferIndex.value,
      byteOffset: offsetValue,
      byteLength: byteLength.value,
      byteStride: stride,
    });
  }
  return { ok: true, value: out };
}

function validateAccessors(
  document: Record<string, unknown>,
  bufferViews: readonly ValidatedGltfBufferView[],
  limits: GltfBridgeLimits,
): GltfBridgeResult<ValidatedGltfAccessor[]> {
  const raw = asArray(document.accessors ?? [], 'accessors');
  if (!raw.ok) return raw;
  if (raw.value.length > limits.maxAccessors) {
    return gltfFailure('limit-exceeded', `the document declares ${raw.value.length} accessors (max ${limits.maxAccessors})`, 'accessors');
  }
  const out: ValidatedGltfAccessor[] = [];
  for (let i = 0; i < raw.value.length; i += 1) {
    const path = `accessors[${i}]`;
    const entry = raw.value[i];
    if (!isPlainObject(entry)) {
      return gltfFailure('not-gltf2', `expected an object at "${path}"`, path);
    }
    if (entry.sparse !== undefined) {
      return gltfFailure(
        'unsupported-feature',
        `accessor ${i} uses sparse storage (unsupported in the bridge's core subset)`,
        `${path}.sparse`,
      );
    }
    const componentType = entry.componentType;
    if (
      typeof componentType !== 'number' ||
      GLTF_COMPONENT_TYPE_SIZES[componentType] === undefined
    ) {
      return gltfFailure(
        'accessor-invalid',
        `accessor ${i} componentType ${JSON.stringify(componentType)} is not a glTF 2.0 component type`,
        `${path}.componentType`,
      );
    }
    const accessorType = entry.type;
    if (typeof accessorType !== 'string' || GLTF_ACCESSOR_TYPES[accessorType] === undefined) {
      return gltfFailure(
        'accessor-invalid',
        `accessor ${i} type ${JSON.stringify(accessorType)} is not a glTF 2.0 accessor type`,
        `${path}.type`,
      );
    }
    const componentCount = GLTF_ACCESSOR_TYPES[accessorType]!;
    const count = asInt(entry.count, `${path}.count`, 1);
    if (!count.ok) return count;
    let bufferViewIndex: number | null = null;
    if (entry.bufferView !== undefined) {
      const viewIndex = asIndex(entry.bufferView, `${path}.bufferView`, bufferViews.length);
      if (!viewIndex.ok) return viewIndex;
      bufferViewIndex = viewIndex.value;
    }
    let byteOffset = 0;
    if (entry.byteOffset !== undefined) {
      const offset = asInt(entry.byteOffset, `${path}.byteOffset`, 0);
      if (!offset.ok) return offset;
      if (offset.value % GLTF_COMPONENT_TYPE_SIZES[componentType as number] !== 0) {
        return gltfFailure(
          'accessor-invalid',
          `accessor ${i} byteOffset ${offset.value} is not a multiple of its component size`,
          `${path}.byteOffset`,
        );
      }
      byteOffset = offset.value;
    }
    if (bufferViewIndex !== null) {
      const view = bufferViews[bufferViewIndex]!;
      const elementBytes = componentCount * GLTF_COMPONENT_TYPE_SIZES[componentType as number]!;
      if (byteOffset + count.value * elementBytes > view.byteLength) {
        return gltfFailure(
          'accessor-invalid',
          `accessor ${i} spans ${byteOffset + count.value * elementBytes} bytes but its bufferView carries ${view.byteLength}`,
          path,
        );
      }
    }
    let min: number[] | null = null;
    let max: number[] | null = null;
    if (entry.min !== undefined) {
      const checked = asFiniteVec(entry.min, `${path}.min`, componentCount);
      if (!checked.ok) return checked;
      min = checked.value;
    }
    if (entry.max !== undefined) {
      const checked = asFiniteVec(entry.max, `${path}.max`, componentCount);
      if (!checked.ok) return checked;
      max = checked.value;
    }
    if (min !== null && max !== null) {
      for (let c = 0; c < componentCount; c += 1) {
        if (min[c]! > max[c]!) {
          return gltfFailure(
            'accessor-invalid',
            `accessor ${i} min[${c}] > max[${c}]`,
            path,
          );
        }
      }
    }
    out.push({
      componentType: componentType as number,
      accessorType,
      componentCount,
      count: count.value,
      bufferViewIndex,
      byteOffset,
      min,
      max,
    });
  }
  return { ok: true, value: out };
}

function validateMaterials(
  document: Record<string, unknown>,
  limits: GltfBridgeLimits,
): GltfBridgeResult<ValidatedGltfMaterial[]> {
  const raw = asArray(document.materials ?? [], 'materials');
  if (!raw.ok) return raw;
  if (raw.value.length > limits.maxMaterials) {
    return gltfFailure('limit-exceeded', `the document declares ${raw.value.length} materials (max ${limits.maxMaterials})`, 'materials');
  }
  const out: ValidatedGltfMaterial[] = [];
  for (let i = 0; i < raw.value.length; i += 1) {
    const path = `materials[${i}]`;
    const entry = raw.value[i];
    if (!isPlainObject(entry)) {
      return gltfFailure('not-gltf2', `expected an object at "${path}"`, path);
    }
    const name = asName(entry.name, `${path}.name`, limits);
    if (!name.ok) return name;
    let baseColor: number[] | null = null;
    const pbr = entry.pbrMetallicRoughness;
    if (pbr !== undefined) {
      if (!isPlainObject(pbr)) {
        return gltfFailure('material-invalid', `expected an object at "${path}.pbrMetallicRoughness"`, `${path}.pbrMetallicRoughness`);
      }
      if (pbr.baseColorFactor !== undefined) {
        const factor = asFiniteVec(pbr.baseColorFactor, `${path}.pbrMetallicRoughness.baseColorFactor`, 4);
        if (!factor.ok) return factor;
        for (let c = 0; c < 4; c += 1) {
          if (factor.value[c]! < 0 || factor.value[c]! > 1) {
            return gltfFailure(
              'material-invalid',
              `material ${i} baseColorFactor[${c}] must be in [0, 1]`,
              `${path}.pbrMetallicRoughness.baseColorFactor`,
            );
          }
        }
        baseColor = factor.value;
      }
      for (const factorName of ['metallicFactor', 'roughnessFactor'] as const) {
        const factor = pbr[factorName];
        if (factor !== undefined) {
          const checked = asFiniteNumber(factor, `${path}.pbrMetallicRoughness.${factorName}`);
          if (!checked.ok) return checked;
          if (checked.value < 0 || checked.value > 1) {
            return gltfFailure(
              'material-invalid',
              `material ${i} ${factorName} must be in [0, 1]`,
              `${path}.pbrMetallicRoughness.${factorName}`,
            );
          }
        }
      }
    }
    let alphaMode: 'BLEND' | 'MASK' | 'OPAQUE' = 'OPAQUE';
    if (entry.alphaMode !== undefined) {
      if (entry.alphaMode !== 'BLEND' && entry.alphaMode !== 'MASK' && entry.alphaMode !== 'OPAQUE') {
        return gltfFailure(
          'material-invalid',
          `material ${i} alphaMode ${JSON.stringify(entry.alphaMode)} is not OPAQUE, MASK, or BLEND`,
          `${path}.alphaMode`,
        );
      }
      alphaMode = entry.alphaMode;
    }
    let alphaCutoff: number | null = null;
    if (entry.alphaCutoff !== undefined) {
      const checked = asFiniteNumber(entry.alphaCutoff, `${path}.alphaCutoff`);
      if (!checked.ok) return checked;
      if (checked.value <= 0) {
        return gltfFailure('material-invalid', `material ${i} alphaCutoff must be > 0`, `${path}.alphaCutoff`);
      }
      alphaCutoff = checked.value;
    }
    let doubleSided = false;
    if (entry.doubleSided !== undefined) {
      const checked = asBool(entry.doubleSided, `${path}.doubleSided`);
      if (!checked.ok) return checked;
      doubleSided = checked.value;
    }
    out.push({
      name: name.value,
      baseColor,
      alphaMode,
      alphaCutoff,
      doubleSided,
    });
  }
  return { ok: true, value: out };
}

/** Scan every FLOAT component of an accessor for non-finite values. */
function scanFiniteFloats(
  accessor: ValidatedGltfAccessor,
  bufferViews: readonly ValidatedGltfBufferView[],
  buffers: readonly Uint8Array[],
): GltfBridgeResult<true> {
  if (accessor.bufferViewIndex === null) return { ok: true, value: true };
  if (accessor.componentType !== GLTF_COMPONENT_TYPES.FLOAT) return { ok: true, value: true };
  const view = bufferViews[accessor.bufferViewIndex]!;
  const buffer = buffers[view.bufferIndex]!;
  const viewStart = view.byteOffset + accessor.byteOffset;
  const elementBytes = accessor.componentCount * 4;
  const stride = view.byteStride ?? elementBytes;
  for (let element = 0; element < accessor.count; element += 1) {
    const elementOffset = viewStart + element * stride;
    for (let c = 0; c < accessor.componentCount; c += 1) {
      const componentOffset = elementOffset + c * 4;
      if (componentOffset + 4 > buffer.length) {
        return gltfFailure(
          'accessor-invalid',
          `float scan of accessor overruns its buffer at byte ${componentOffset}`,
        );
      }
      const bits =
        buffer[componentOffset]! |
        (buffer[componentOffset + 1]! << 8) |
        (buffer[componentOffset + 2]! << 16) |
        (buffer[componentOffset + 3]! << 24);
      // Exponent bits all set + non-zero mantissa = NaN; all set + zero
      // mantissa = +/-Infinity. Both are typed refusals (little-endian).
      const exponent = (bits >>> 23) & 0xff;
      const mantissa = bits & 0x7f_ffff;
      if (exponent === 0xff && mantissa !== 0) {
        return gltfFailure(
          'accessor-invalid',
          `accessor carries a NaN float at element ${element}, component ${c}`,
        );
      }
      if (exponent === 0xff && mantissa === 0) {
        return gltfFailure(
          'accessor-invalid',
          `accessor carries an infinite float at element ${element}, component ${c}`,
        );
      }
    }
  }
  return { ok: true, value: true };
}

function validateMeshes(
  document: Record<string, unknown>,
  accessors: readonly ValidatedGltfAccessor[],
  bufferViews: readonly ValidatedGltfBufferView[],
  buffers: readonly Uint8Array[],
  materialsCount: number,
  limits: GltfBridgeLimits,
): GltfBridgeResult<ValidatedGltfMesh[]> {
  const raw = asArray(document.meshes ?? [], 'meshes');
  if (!raw.ok) return raw;
  if (raw.value.length > limits.maxMeshes) {
    return gltfFailure('limit-exceeded', `the document declares ${raw.value.length} meshes (max ${limits.maxMeshes})`, 'meshes');
  }
  const out: ValidatedGltfMesh[] = [];
  let primitiveTotal = 0;
  let triangleTotal = 0;
  for (let i = 0; i < raw.value.length; i += 1) {
    const path = `meshes[${i}]`;
    const entry = raw.value[i];
    if (!isPlainObject(entry)) {
      return gltfFailure('not-gltf2', `expected an object at "${path}"`, path);
    }
    const name = asName(entry.name, `${path}.name`, limits);
    if (!name.ok) return name;
    const primitives = asArray(entry.primitives, `${path}.primitives`);
    if (!primitives.ok) return primitives;
    if (primitives.value.length === 0) {
      return gltfFailure('mesh-invalid', `mesh ${i} declares no primitives`, `${path}.primitives`);
    }
    primitiveTotal += primitives.value.length;
    if (primitiveTotal > limits.maxPrimitives) {
      return gltfFailure('limit-exceeded', `the document exceeds ${limits.maxPrimitives} primitives`, 'meshes');
    }
    const validatedPrimitives: ValidatedGltfPrimitive[] = [];
    for (let p = 0; p < primitives.value.length; p += 1) {
      const primitivePath = `${path}.primitives[${p}]`;
      const primitive = primitives.value[p];
      if (!isPlainObject(primitive)) {
        return gltfFailure('not-gltf2', `expected an object at "${primitivePath}"`, primitivePath);
      }
      const mode = primitive.mode === undefined ? GLTF_MODE_TRIANGLES : primitive.mode;
      if (mode !== GLTF_MODE_TRIANGLES) {
        return gltfFailure(
          'unsupported-feature',
          `primitive ${primitivePath} uses draw mode ${mode}; only mode 4 (triangles) is admitted`,
          `${primitivePath}.mode`,
        );
      }
      const attributes = primitive.attributes;
      if (!isPlainObject(attributes)) {
        return gltfFailure('mesh-invalid', `expected an attributes object at "${primitivePath}.attributes"`, `${primitivePath}.attributes`);
      }
      if (attributes.POSITION === undefined) {
        return gltfFailure(
          'mesh-invalid',
          `primitive ${primitivePath} has no POSITION attribute`,
          `${primitivePath}.attributes.POSITION`,
        );
      }
      const positionIndex = asIndex(attributes.POSITION, `${primitivePath}.attributes.POSITION`, accessors.length);
      if (!positionIndex.ok) return positionIndex;
      const position = accessors[positionIndex.value]!;
      if (position.accessorType !== 'VEC3' || position.componentType !== GLTF_COMPONENT_TYPES.FLOAT) {
        return gltfFailure(
          'mesh-invalid',
          `primitive ${primitivePath} POSITION accessor must be FLOAT VEC3`,
          `${primitivePath}.attributes.POSITION`,
        );
      }
      if (position.min === null || position.max === null) {
        return gltfFailure(
          'mesh-invalid',
          `primitive ${primitivePath} POSITION accessor must declare min/max (glTF 2.0 requirement)`,
          `${primitivePath}.attributes.POSITION`,
        );
      }
      const scan = scanFiniteFloats(position, bufferViews, buffers);
      if (!scan.ok) return scan;
      let normalIndex: number | null = null;
      if (attributes.NORMAL !== undefined) {
        const normal = asIndex(attributes.NORMAL, `${primitivePath}.attributes.NORMAL`, accessors.length);
        if (!normal.ok) return normal;
        const accessor = accessors[normal.value]!;
        if (accessor.accessorType !== 'VEC3' || accessor.componentType !== GLTF_COMPONENT_TYPES.FLOAT) {
          return gltfFailure(
            'mesh-invalid',
            `primitive ${primitivePath} NORMAL accessor must be FLOAT VEC3`,
            `${primitivePath}.attributes.NORMAL`,
          );
        }
        const normalScan = scanFiniteFloats(accessor, bufferViews, buffers);
        if (!normalScan.ok) return normalScan;
        normalIndex = normal.value;
      }
      let texcoordIndex: number | null = null;
      if (attributes.TEXCOORD_0 !== undefined) {
        const texcoord = asIndex(attributes.TEXCOORD_0, `${primitivePath}.attributes.TEXCOORD_0`, accessors.length);
        if (!texcoord.ok) return texcoord;
        const accessor = accessors[texcoord.value]!;
        if (accessor.accessorType !== 'VEC2') {
          return gltfFailure(
            'mesh-invalid',
            `primitive ${primitivePath} TEXCOORD_0 accessor must be VEC2`,
            `${primitivePath}.attributes.TEXCOORD_0`,
          );
        }
        texcoordIndex = texcoord.value;
      }
      let indicesIndex: number | null = null;
      if (primitive.indices !== undefined) {
        const indices = asIndex(primitive.indices, `${primitivePath}.indices`, accessors.length);
        if (!indices.ok) return indices;
        const accessor = accessors[indices.value]!;
        if (accessor.accessorType !== 'SCALAR') {
          return gltfFailure(
            'mesh-invalid',
            `primitive ${primitivePath} indices accessor must be SCALAR`,
            `${primitivePath}.indices`,
          );
        }
        if (
          accessor.componentType !== GLTF_COMPONENT_TYPES.UNSIGNED_BYTE &&
          accessor.componentType !== GLTF_COMPONENT_TYPES.UNSIGNED_SHORT &&
          accessor.componentType !== GLTF_COMPONENT_TYPES.UNSIGNED_INT
        ) {
          return gltfFailure(
            'mesh-invalid',
            `primitive ${primitivePath} indices componentType must be UNSIGNED_BYTE/SHORT/INT`,
            `${primitivePath}.indices`,
          );
        }
        if (accessor.count % 3 !== 0) {
          return gltfFailure(
            'mesh-invalid',
            `primitive ${primitivePath} indices count ${accessor.count} is not a multiple of 3`,
            `${primitivePath}.indices`,
          );
        }
        indicesIndex = indices.value;
      }
      let materialIndex: number | null = null;
      if (primitive.material !== undefined) {
        const material = asIndex(primitive.material, `${primitivePath}.material`, materialsCount);
        if (!material.ok) return material;
        materialIndex = material.value;
      }
      const triangleCount = indicesIndex === null
        ? Math.floor(position.count / 3)
        : accessors[indicesIndex]!.count / 3;
      triangleTotal += triangleCount;
      if (triangleTotal > limits.maxTotalTriangles) {
        return gltfFailure(
          'limit-exceeded',
          `the document exceeds ${limits.maxTotalTriangles} total triangles`,
          primitivePath,
        );
      }
      validatedPrimitives.push({
        mode: GLTF_MODE_TRIANGLES,
        positionAccessorIndex: positionIndex.value,
        normalAccessorIndex: normalIndex,
        texcoordAccessorIndex: texcoordIndex,
        indicesAccessorIndex: indicesIndex,
        materialIndex,
        vertexCount: position.count,
        triangleCount,
        bounds: { min: position.min, max: position.max },
      });
    }
    out.push({ name: name.value, primitives: validatedPrimitives });
  }
  return { ok: true, value: out };
}

function validateNodes(
  document: Record<string, unknown>,
  meshesCount: number,
  limits: GltfBridgeLimits,
): GltfBridgeResult<ValidatedGltfNode[]> {
  const raw = asArray(document.nodes ?? [], 'nodes');
  if (!raw.ok) return raw;
  if (raw.value.length > limits.maxNodes) {
    return gltfFailure('limit-exceeded', `the document declares ${raw.value.length} nodes (max ${limits.maxNodes})`, 'nodes');
  }
  const out: ValidatedGltfNode[] = [];
  for (let i = 0; i < raw.value.length; i += 1) {
    const path = `nodes[${i}]`;
    const entry = raw.value[i];
    if (!isPlainObject(entry)) {
      return gltfFailure('not-gltf2', `expected an object at "${path}"`, path);
    }
    const name = asName(entry.name, `${path}.name`, limits);
    if (!name.ok) return name;
    const children: number[] = [];
    if (entry.children !== undefined) {
      const rawChildren = asArray(entry.children, `${path}.children`);
      if (!rawChildren.ok) return rawChildren;
      if (rawChildren.value.length > limits.maxChildrenPerNode) {
        return gltfFailure('limit-exceeded', `node ${i} has ${rawChildren.value.length} children (max ${limits.maxChildrenPerNode})`, `${path}.children`);
      }
      for (let c = 0; c < rawChildren.value.length; c += 1) {
        const child = asIndex(rawChildren.value[c], `${path}.children[${c}]`, raw.value.length);
        if (!child.ok) return child;
        if (child.value === i) {
          return gltfFailure('node-graph-invalid', `node ${i} lists itself as a child`, `${path}.children[${c}]`);
        }
        if (children.includes(child.value)) {
          return gltfFailure('node-graph-invalid', `node ${i} lists child ${child.value} twice`, `${path}.children[${c}]`);
        }
        children.push(child.value);
      }
    }
    let meshIndex: number | null = null;
    if (entry.mesh !== undefined) {
      const mesh = asIndex(entry.mesh, `${path}.mesh`, meshesCount);
      if (!mesh.ok) return mesh;
      meshIndex = mesh.value;
    }
    let matrix: number[] | null = null;
    if (entry.matrix !== undefined) {
      const checked = asFiniteVec(entry.matrix, `${path}.matrix`, 16);
      if (!checked.ok) return checked;
      matrix = checked.value;
    }
    let translation: number[] | null = null;
    if (entry.translation !== undefined) {
      const checked = asFiniteVec(entry.translation, `${path}.translation`, 3);
      if (!checked.ok) return checked;
      translation = checked.value;
    }
    let rotation: number[] | null = null;
    if (entry.rotation !== undefined) {
      const checked = asFiniteVec(entry.rotation, `${path}.rotation`, 4);
      if (!checked.ok) return checked;
      rotation = checked.value;
    }
    let scale: number[] | null = null;
    if (entry.scale !== undefined) {
      const checked = asFiniteVec(entry.scale, `${path}.scale`, 3);
      if (!checked.ok) return checked;
      scale = checked.value;
    }
    out.push({ name: name.value, children, meshIndex, matrix, translation, rotation, scale });
  }
  // Cycle detection (DFS with three colors; shared subtrees are legal, cycles
  // are not — glTF 2.0 §5.26).
  const state = new Uint8Array(out.length); // 0 white, 1 gray (on stack), 2 black
  const visit = (nodeIndex: number, depth: number, trail: string): GltfBridgeResult<true> => {
    if (depth > limits.maxNodeDepth) {
      return gltfFailure(
        'node-graph-invalid',
        `the node graph exceeds the maximum depth of ${limits.maxNodeDepth}`,
        `nodes[${nodeIndex}]`,
      );
    }
    const current = state[nodeIndex]!;
    if (current === 1) {
      return gltfFailure(
        'node-graph-invalid',
        `the node graph contains a cycle through node ${nodeIndex} (${trail})`,
        `nodes[${nodeIndex}]`,
      );
    }
    if (current === 2) return { ok: true, value: true };
    state[nodeIndex] = 1;
    for (const child of out[nodeIndex]!.children) {
      const descended = visit(child, depth + 1, `${trail} -> nodes[${child}]`);
      if (!descended.ok) return descended;
    }
    state[nodeIndex] = 2;
    return { ok: true, value: true };
  };
  for (let i = 0; i < out.length; i += 1) {
    const visited = visit(i, 0, `nodes[${i}]`);
    if (!visited.ok) return visited;
  }
  return { ok: true, value: out };
}

function validateScenes(
  document: Record<string, unknown>,
  nodesCount: number,
  limits: GltfBridgeLimits,
): GltfBridgeResult<{ scenes: ValidatedGltfScene[]; defaultSceneIndex: number | null }> {
  const raw = asArray(document.scenes ?? [], 'scenes');
  if (!raw.ok) return raw;
  if (raw.value.length > limits.maxScenes) {
    return gltfFailure('limit-exceeded', `the document declares ${raw.value.length} scenes (max ${limits.maxScenes})`, 'scenes');
  }
  const scenes: ValidatedGltfScene[] = [];
  for (let i = 0; i < raw.value.length; i += 1) {
    const path = `scenes[${i}]`;
    const entry = raw.value[i];
    if (!isPlainObject(entry)) {
      return gltfFailure('not-gltf2', `expected an object at "${path}"`, path);
    }
    const name = asName(entry.name, `${path}.name`, limits);
    if (!name.ok) return name;
    const roots: number[] = [];
    if (entry.nodes !== undefined) {
      const rawNodes = asArray(entry.nodes, `${path}.nodes`);
      if (!rawNodes.ok) return rawNodes;
      for (let n = 0; n < rawNodes.value.length; n += 1) {
        const node = asIndex(rawNodes.value[n], `${path}.nodes[${n}]`, nodesCount);
        if (!node.ok) return node;
        roots.push(node.value);
      }
    }
    scenes.push({ name: name.value, rootNodeIndices: roots });
  }
  let defaultSceneIndex: number | null = null;
  if (document.scene !== undefined) {
    const scene = asIndex(document.scene, 'scene', scenes.length);
    if (!scene.ok) return scene;
    defaultSceneIndex = scene.value;
  } else if (scenes.length > 0) {
    defaultSceneIndex = 0;
  }
  return { ok: true, value: { scenes, defaultSceneIndex } };
}

/**
 * Validate one parsed glTF container end-to-end (the trust gate). The input
 * document is UNTRUSTED until this returns ok — nothing downstream parses
 * glTF again.
 */
export function validateGltfDocument(
  container: ParsedGltfContainer,
  limits?: Partial<GltfBridgeLimits>,
): GltfBridgeResult<ValidatedGltfDocument> {
  const resolved = resolveLimits(limits);
  const document = container.document;

  // asset.version (mandatory).
  const asset = document.asset;
  if (!isPlainObject(asset)) {
    return gltfFailure('not-gltf2', 'the document has no asset object', 'asset');
  }
  const version = asset.version;
  if (typeof version !== 'string' || !/^2\.\d+$/.test(version)) {
    return gltfFailure(
      'not-gltf2',
      `asset.version ${JSON.stringify(version)} is not a 2.x version (only glTF 2.0 is admitted)`,
      'asset.version',
    );
  }
  let minVersion: string | null = null;
  if (asset.minVersion !== undefined) {
    if (typeof asset.minVersion !== 'string' || !/^2\.\d+$/.test(asset.minVersion)) {
      return gltfFailure(
        'not-gltf2',
        `asset.minVersion ${JSON.stringify(asset.minVersion)} is not a 2.x version`,
        'asset.minVersion',
      );
    }
    minVersion = asset.minVersion;
  }
  let generator: string | null = null;
  if (asset.generator !== undefined) {
    const checked = asName(asset.generator, 'asset.generator', resolved);
    if (!checked.ok) return checked;
    generator = checked.value;
  }

  // extensionsRequired must be empty (core-only honesty).
  const extensionsRequired = asArray(document.extensionsRequired ?? [], 'extensionsRequired');
  if (!extensionsRequired.ok) return extensionsRequired;
  if (extensionsRequired.value.length > 0) {
    return gltfFailure(
      'unsupported-feature',
      `the document requires extensions [${extensionsRequired.value.map((e) => JSON.stringify(e)).join(', ')}]; the bridge implements the glTF 2.0 core subset only`,
      'extensionsRequired',
    );
  }

  // Textures: counted only (the bridge mounts no images).
  const textures = asArray(document.textures ?? [], 'textures');
  if (!textures.ok) return textures;
  if (textures.value.length > resolved.maxTextures) {
    return gltfFailure('limit-exceeded', `the document declares ${textures.value.length} textures (max ${resolved.maxTextures})`, 'textures');
  }

  // Dependency-ordered validation.
  const buffers = validateBuffers(document, container.binChunk, resolved);
  if (!buffers.ok) return buffers;
  const bufferViews = validateBufferViews(document, buffers.value, resolved);
  if (!bufferViews.ok) return bufferViews;
  const accessors = validateAccessors(document, bufferViews.value, resolved);
  if (!accessors.ok) return accessors;
  const materials = validateMaterials(document, resolved);
  if (!materials.ok) return materials;
  const meshes = validateMeshes(
    document,
    accessors.value,
    bufferViews.value,
    buffers.value,
    materials.value.length,
    resolved,
  );
  if (!meshes.ok) return meshes;
  const nodes = validateNodes(document, meshes.value.length, resolved);
  if (!nodes.ok) return nodes;
  const scenes = validateScenes(document, nodes.value.length, resolved);
  if (!scenes.ok) return scenes;

  return {
    ok: true,
    value: {
      gltfVersion: version,
      minVersion,
      generator,
      defaultSceneIndex: scenes.value.defaultSceneIndex,
      scenes: scenes.value.scenes,
      nodes: nodes.value,
      meshes: meshes.value,
      materials: materials.value,
      accessors: accessors.value,
      bufferViews: bufferViews.value,
      buffers: buffers.value,
      textureCount: textures.value.length,
      limits: resolved,
    },
  };
}
