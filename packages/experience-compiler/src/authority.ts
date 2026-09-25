/**
 * The vendor-field authority boundary of the experience compiler
 * (architecture lock rules 13/16 — provider neutrality; one
 * responsibility has one authority).
 *
 * The W011 admission discipline already rejects kernel-reserved
 * presentation-attribute keys (`authority-violation`, origin
 * `kernel-reserved`, surfaced 1:1 through the reused admission). The one
 * remaining embedding vector at the compiler boundary is VENDOR/ENGINE
 * vocabulary smuggled into the open presentation-attribute records —
 * e.g. an engine material name, a graphics-API flag, or a UI-framework
 * prop. The compile pipeline scans every node and edge attribute record
 * (keys, and object keys nested inside attribute values) for the
 * vendor/engine token segments below and REJECTS the compile with a typed
 * `authority-violation` error (origin `vendor-blocklist`) naming every
 * violating path.
 *
 * The list names products, engines, graphics APIs, UI frameworks, and LLM
 * vendors — never neutral engineering vocabulary. Presentation code has
 * the entire neutral namespace; these segments belong to concrete
 * adapters (W019) and may not be compiled into kernel-adjacent plan data.
 */
import type { ExperienceGraph, JsonValue } from '@epoch/experience-protocol';
import type { CompilerError } from './errors';

/**
 * Vendor/engine token segments rejected in presentation-attribute keys
 * (lowercase; matched per non-alphanumeric segment so `unity:prefab`,
 * `threejs-material`, and `webgpu.layout` all hit). Sorted for determinism.
 */
export const VENDOR_KEY_SEGMENTS = [
  'angularjs',
  'anthropic',
  'babylon',
  'babylonjs',
  'blender',
  'brlcad',
  'cesium',
  'cesiumjs',
  'chatgpt',
  'claude',
  'direct3d',
  'directx',
  'electron',
  'freecad',
  'gemini',
  'glsl',
  'godot',
  'gpt',
  'hlsl',
  'llama',
  'mistral',
  'nextjs',
  'o3de',
  'openai',
  'opengl',
  'openscad',
  'paraview',
  'react',
  'reactdom',
  'reactjs',
  'salome',
  'svelte',
  'tauri',
  'threejs',
  'unity',
  'unreal',
  'vue',
  'vuejs',
  'vulkan',
  'webgl',
  'webgpu',
  'wgsl',
] as const;

/** One vendor token segment. */
export type VendorKeySegment = (typeof VENDOR_KEY_SEGMENTS)[number];

const VENDOR_SEGMENT_SET: ReadonlySet<string> = new Set<string>(VENDOR_KEY_SEGMENTS);

/** Split a key into lowercase token segments (non-alphanumeric AND camelCase/ acronym boundaries) plus adjacent pair-joins. */
function keySegments(key: string): string[] {
  const runs = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((segment) => segment.length > 0);
  const segments = [...runs];
  for (let i = 1; i < runs.length; i += 1) {
    segments.push(`${runs[i - 1]}${runs[i]}`);
  }
  return segments;
}

/** Does one attribute key carry a vendor/engine token segment? */
export function isVendorKey(key: string): string | null {
  for (const segment of keySegments(key)) {
    if (VENDOR_SEGMENT_SET.has(segment)) {
      return segment;
    }
  }
  return null;
}

/** One vendor-field violation: dotted path plus the offending key. */
export interface VendorFieldViolation {
  readonly path: string;
  readonly key: string;
}

/** Walk an attribute record (and nested JSON objects) for vendor keys. */
function scanAttributeRecord(
  attributes: Record<string, JsonValue>,
  basePath: string,
  violations: VendorFieldViolation[],
): void {
  for (const key of Object.keys(attributes).sort()) {
    const hit = isVendorKey(key);
    if (hit !== null) {
      violations.push({ path: `${basePath}.${key}`, key });
    }
    const value = attributes[key];
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      scanAttributeRecord(value as Record<string, JsonValue>, `${basePath}.${key}`, violations);
    }
  }
}

/**
 * Scan an admitted graph's presentation-attribute records for
 * vendor/engine keys. Pure and total: returns every violation (node and
 * edge attributes are both presentation records and both subject to the
 * scan).
 */
export function scanVendorFieldViolations(graph: ExperienceGraph): VendorFieldViolation[] {
  const violations: VendorFieldViolation[] = [];
  graph.nodes.forEach((node, nodeIndex) => {
    if (node.attributes === undefined) return;
    scanAttributeRecord(node.attributes, `nodes.${nodeIndex}.attributes`, violations);
  });
  graph.edges.forEach((edge, edgeIndex) => {
    if (edge.attributes === undefined) return;
    scanAttributeRecord(edge.attributes, `edges.${edgeIndex}.attributes`, violations);
  });
  return violations;
}

/**
 * Build the typed `authority-violation` error for a vendor-field scan.
 * The caller guarantees `violations` is non-empty (kernel-reserved keys
 * were already rejected by the reused W011 admission before this scan).
 */
export function vendorFieldViolationError(
  violations: readonly VendorFieldViolation[],
): Extract<CompilerError, { readonly code: 'authority-violation' }> {
  return {
    code: 'authority-violation',
    message:
      `experience graph carries vendor/engine-specific fields in presentation attributes ` +
      `(${violations.length} violation${violations.length === 1 ? '' : 's'}): provider-specific ` +
      'logic belongs behind adapters (architecture lock rule 13) and is rejected first-class',
    violations: violations.map((v) => ({ path: v.path, key: v.key, origin: 'vendor-blocklist' })),
  };
}
