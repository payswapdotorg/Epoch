/**
 * The OFFSCENE SCENE DESCRIPTION (W060) — the provider-neutral, serializable
 * projection of the canonical W016 world the sidecar renders. It is built
 * ONLY from ADMITTED typed data (the compiled W011 3d graph + the W016
 * scene + the portable camera grammar), exactly like the embedded adapters'
 * presentation mounting — except this presentation is DATA handed to an
 * external process, so it must be JSON-serializable and free of any engine
 * handle.
 *
 * Semantic identity: every offscene entity carries its semantic entity id;
 * the sidecar stamps it onto the Blender object (custom property) so
 * produced artifacts keep their provenance. Provider-native files remain
 * presentation artifacts (never Epoch authority).
 */
import type { RendererMountInput } from '@epoch/renderer-fabric';
import type { PortableViewState } from '@epoch/renderer-runtime';
import type { WorldScene } from '@epoch/world-experience';
import type { BlenderBoundaryLimits, BlenderBoundaryResult } from './version';
import { blenderFailure } from './version';

/** The neutral primitive vocabulary the sidecar can build. */
export type OffscenePrimitive = 'box' | 'sphere';

/** One offscene entity (semantic id + presentation facts). */
export type OffsceneEntity = {
  readonly entityId: string;
  readonly label: string | null;
  readonly primitive: OffscenePrimitive;
  readonly position: readonly [number, number, number];
  readonly size: number;
  /** Linear RGB in [0, 1] (parsed from the graph's material-color attribute). */
  readonly color: readonly [number, number, number] | null;
};

/** The offscene camera (the portable camera grammar's position/target). */
export type OffsceneCamera = {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
};

/** The render output settings (bounded by the boundary limits). */
export type OffsceneOutput = {
  readonly width: number;
  readonly height: number;
  readonly format: 'PNG';
};

/** The complete offscene scene handed to one sidecar job. */
export type OffsceneScene = {
  readonly worldDigest: string;
  readonly entities: readonly OffsceneEntity[];
  readonly camera: OffsceneCamera;
};

/** The default render output of the adapter (deterministic). */
export const OFFSCENE_DEFAULT_OUTPUT: OffsceneOutput = {
  width: 640,
  height: 480,
  format: 'PNG',
};

/** Parse a '#rrggbb' color into linear RGB triples (null when absent/other). */
function colorOf(value: unknown): readonly [number, number, number] | null {
  if (typeof value !== 'string') return null;
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (match === null) return null;
  const hex = match[1]!;
  return [
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
  ];
}

/** The compiled 3d graph of one mount input (null when the scene has none). */
function spatialGraphOf(input: RendererMountInput): {
  nodes: ReadonlyArray<{
    entityId: string;
    primitive: string;
    position: readonly number[];
    scale?: readonly number[];
    color: readonly [number, number, number] | null;
  }>;
} {
  const graph = input.compilation.graphs.find((entry) => entry.graphKind === '3d');
  const nodes: {
    entityId: string;
    primitive: string;
    position: readonly number[];
    scale?: readonly number[];
    color: readonly [number, number, number] | null;
  }[] = [];
  for (const node of graph?.nodes ?? []) {
    if (node.kind !== 'spatial-3d' || node.ref?.kind !== 'world-entity') {
      continue;
    }
    const descriptor = node.descriptor as {
      primitive?: unknown;
      position?: unknown;
      scale?: unknown;
    };
    if (typeof descriptor.primitive !== 'string' || !Array.isArray(descriptor.position)) {
      continue;
    }
    const attributes = (node.attributes ?? {}) as Record<string, unknown>;
    nodes.push({
      entityId: node.ref.entityId,
      primitive: descriptor.primitive,
      position: descriptor.position as readonly number[],
      ...(Array.isArray(descriptor.scale) ? { scale: descriptor.scale as readonly number[] } : {}),
      color: colorOf(attributes['material-color']),
    });
  }
  return { nodes };
}

/**
 * Build the offscene scene from the ADMITTED mount input: entities from the
 * compiled 3d graph (labels from the canonical scene), the camera from the
 * portable view state (or a deterministic fit when the host carries none).
 */
export function offsceneSceneOf(
  input: RendererMountInput,
  viewState: PortableViewState,
  limits: BlenderBoundaryLimits,
): BlenderBoundaryResult<OffsceneScene> {
  const scene: WorldScene = input.scene;
  const labels = new Map<string, string | null>();
  for (const entity of scene.entities) {
    labels.set(entity.entityId, entity.label ?? null);
  }
  const { nodes } = spatialGraphOf(input);
  if (nodes.length > limits.maxEntities) {
    return blenderFailure(
      'job-invalid',
      `the scene presents ${nodes.length} entities (max ${limits.maxEntities})`,
    );
  }
  const entities: OffsceneEntity[] = [];
  for (const node of nodes) {
    const primitive: OffscenePrimitive = node.primitive === 'sphere' ? 'sphere' : 'box';
    const position = [
      Number(node.position[0] ?? 0),
      Number(node.position[1] ?? 0),
      Number(node.position[2] ?? 0),
    ] as const;
    const size = node.scale !== undefined && Number.isFinite(node.scale[0]) && node.scale[0]! > 0
      ? Number(node.scale[0])
      : 1;
    entities.push({
      entityId: node.entityId,
      label: labels.get(node.entityId) ?? null,
      primitive,
      position,
      size,
      color: node.color,
    });
  }

  // The camera: the portable grammar when it carries a position/target
  // (orbit; free carries a position only), else a deterministic fit of the
  // presented entities (the same policy on every run).
  let camera: OffsceneCamera;
  const portable = viewState.camera;
  if (portable !== undefined && 'position' in portable) {
    const target =
      'target' in portable && Array.isArray(portable.target)
        ? portable.target
        : [0, 0, 0];
    camera = {
      position: [
        Number(portable.position[0] ?? 0),
        Number(portable.position[1] ?? 0),
        Number(portable.position[2] ?? 0),
      ],
      target: [Number(target[0] ?? 0), Number(target[1] ?? 0), Number(target[2] ?? 0)],
    };
  } else if (entities.length > 0) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const entity of entities) {
      for (let c = 0; c < 3; c += 1) {
        min[c] = Math.min(min[c]!, entity.position[c]! - entity.size / 2);
        max[c] = Math.max(max[c]!, entity.position[c]! + entity.size / 2);
      }
    }
    const center: readonly [number, number, number] = [
      (min[0]! + max[0]!) / 2,
      (min[1]! + max[1]!) / 2,
      (min[2]! + max[2]!) / 2,
    ];
    const span = Math.max(max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!, 1);
    camera = {
      position: [center[0] + span * 1.5, center[1] - span * 1.5, center[2] + span],
      target: center,
    };
  } else {
    camera = { position: [10, -10, 10], target: [0, 0, 0] };
  }

  return {
    ok: true,
    value: { worldDigest: input.compilation.sceneDigest, entities, camera },
  };
}
