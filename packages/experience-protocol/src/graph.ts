/**
 * The Experience Graph — the versioned, content-addressed envelope the
 * Experience layer publishes (architecture.md "Experience Runtime").
 *
 * Authority model (lock rules 8/16): the graph is a READ PROJECTION of
 * kernel state. It carries opaque, tenant-scoped, exact-revision projected
 * references — never embedded kernel objects — and typed presentation
 * descriptors. It never mutates kernel state and never becomes a second
 * semantic store.
 *
 * Determinism: `nodes`, `edges`, and `projectedFrom` are canonically
 * ordered (sorted, duplicate-free), so semantically equal graphs are
 * byte-identical under canonical JSON serialization and their SHA-256
 * digests are stable (identical inputs serialize identically).
 */
import { z } from 'zod';
import { DeviceDescriptorSchema } from './device';
import {
  AnimationClipDescriptorSchema,
  ControlDescriptorSchema,
  LabelDescriptorSchema,
  NarrativeBeatDescriptorSchema,
  PresenceCursorDescriptorSchema,
  PresenceSeatDescriptorSchema,
  Shape2dDescriptorSchema,
  Spatial3dDescriptorSchema,
  TimelineMarkerDescriptorSchema,
  TimelineTrackDescriptorSchema,
} from './descriptors';
import {
  ExperienceGraphIdSchema,
  ExperienceNodeIdSchema,
  PresentationAttributesSchema,
  Sha256HexSchema,
  TenantScopeSchema,
} from './primitives';
import { ProjectedReferenceSchema, projectedReferenceKey } from './reference';
import {
  ExperienceEdgeKindSchema,
  EXPERIENCE_GRAPH_SCHEMA_NAME,
  ExperienceGraphKindSchema,
  ExperienceProtocolVersionSchema,
  GRAPH_KIND_NODE_KINDS,
} from './version';

/** Upper bound on projected references per graph (DoS discipline). */
export const MAX_PROJECTED_REFERENCES = 512;

/** Upper bound on nodes per graph (DoS discipline). */
export const MAX_GRAPH_NODES = 4096;

/** Upper bound on edges per graph (DoS discipline). */
export const MAX_GRAPH_EDGES = 8192;

/**
 * The node-union members: one strict record per node kind — experience-local
 * id, literal kind, optional projected kernel reference, the kind's typed
 * descriptor, and optional presentation attributes. Strict objects reject
 * unknown (vendor/engine) fields.
 */
const Shape2dNodeSchema = z
  .strictObject({
    id: ExperienceNodeIdSchema,
    kind: z.literal('shape-2d'),
    ref: ProjectedReferenceSchema.optional(),
    descriptor: Shape2dDescriptorSchema,
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({ id: 'Shape2dNode', title: 'Shape2dNode' });

const Spatial3dNodeSchema = z
  .strictObject({
    id: ExperienceNodeIdSchema,
    kind: z.literal('spatial-3d'),
    ref: ProjectedReferenceSchema.optional(),
    descriptor: Spatial3dDescriptorSchema,
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({ id: 'Spatial3dNode', title: 'Spatial3dNode' });

const LabelNodeSchema = z
  .strictObject({
    id: ExperienceNodeIdSchema,
    kind: z.literal('label'),
    ref: ProjectedReferenceSchema.optional(),
    descriptor: LabelDescriptorSchema,
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({ id: 'LabelNode', title: 'LabelNode' });

const AnimationClipNodeSchema = z
  .strictObject({
    id: ExperienceNodeIdSchema,
    kind: z.literal('animation-clip'),
    ref: ProjectedReferenceSchema.optional(),
    descriptor: AnimationClipDescriptorSchema,
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({ id: 'AnimationClipNode', title: 'AnimationClipNode' });

const NarrativeBeatNodeSchema = z
  .strictObject({
    id: ExperienceNodeIdSchema,
    kind: z.literal('narrative-beat'),
    ref: ProjectedReferenceSchema.optional(),
    descriptor: NarrativeBeatDescriptorSchema,
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({ id: 'NarrativeBeatNode', title: 'NarrativeBeatNode' });

const TimelineTrackNodeSchema = z
  .strictObject({
    id: ExperienceNodeIdSchema,
    kind: z.literal('timeline-track'),
    ref: ProjectedReferenceSchema.optional(),
    descriptor: TimelineTrackDescriptorSchema,
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({ id: 'TimelineTrackNode', title: 'TimelineTrackNode' });

const TimelineMarkerNodeSchema = z
  .strictObject({
    id: ExperienceNodeIdSchema,
    kind: z.literal('timeline-marker'),
    ref: ProjectedReferenceSchema.optional(),
    descriptor: TimelineMarkerDescriptorSchema,
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({ id: 'TimelineMarkerNode', title: 'TimelineMarkerNode' });

const PresenceSeatNodeSchema = z
  .strictObject({
    id: ExperienceNodeIdSchema,
    kind: z.literal('presence-seat'),
    ref: ProjectedReferenceSchema.optional(),
    descriptor: PresenceSeatDescriptorSchema,
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({ id: 'PresenceSeatNode', title: 'PresenceSeatNode' });

const PresenceCursorNodeSchema = z
  .strictObject({
    id: ExperienceNodeIdSchema,
    kind: z.literal('presence-cursor'),
    ref: ProjectedReferenceSchema.optional(),
    descriptor: PresenceCursorDescriptorSchema,
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({ id: 'PresenceCursorNode', title: 'PresenceCursorNode' });

const ControlNodeSchema = z
  .strictObject({
    id: ExperienceNodeIdSchema,
    kind: z.literal('control'),
    ref: ProjectedReferenceSchema.optional(),
    descriptor: ControlDescriptorSchema,
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({ id: 'ControlNode', title: 'ControlNode' });

/** The Experience Graph node union (discriminated on `kind`). */
export const ExperienceNodeSchema = z
  .discriminatedUnion('kind', [
    Shape2dNodeSchema,
    Spatial3dNodeSchema,
    LabelNodeSchema,
    AnimationClipNodeSchema,
    NarrativeBeatNodeSchema,
    TimelineTrackNodeSchema,
    TimelineMarkerNodeSchema,
    PresenceSeatNodeSchema,
    PresenceCursorNodeSchema,
    ControlNodeSchema,
  ])
  .meta({
    id: 'ExperienceNode',
    title: 'ExperienceNode',
    description:
      'One Experience Graph node: experience-local id, typed kind, optional projected kernel reference, typed presentation descriptor, optional presentation attributes.',
  });

/** One Experience Graph node. */
export type ExperienceNode = z.infer<typeof ExperienceNodeSchema>;

/** One Experience Graph edge: typed relationship between two nodes. */
export const ExperienceEdgeSchema = z
  .strictObject({
    kind: ExperienceEdgeKindSchema,
    from: ExperienceNodeIdSchema,
    to: ExperienceNodeIdSchema,
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({
    id: 'ExperienceEdge',
    title: 'ExperienceEdge',
    description: 'One Experience Graph edge: typed kind plus ordered endpoint node ids.',
  });

/** One Experience Graph edge. */
export type ExperienceEdge = z.infer<typeof ExperienceEdgeSchema>;

/**
 * The shared canonical-ordering refinement: projectedFrom sorted and
 * duplicate-free by (kind, target id); nodes sorted and duplicate-free by
 * id; edges sorted and duplicate-free by (from, to, kind) with no
 * self-edges; node kinds legal for the graph kind. Shared by the content
 * schema and the sealed envelope schema so the two can never drift.
 */
function refineCanonicalOrdering(
  graph: {
    graphKind: z.infer<typeof ExperienceGraphKindSchema>;
    projectedFrom: z.infer<typeof ProjectedReferenceSchema>[];
    nodes: z.infer<typeof ExperienceNodeSchema>[];
    edges: z.infer<typeof ExperienceEdgeSchema>[];
  },
  ctx: z.RefinementCtx,
): void {
  const refKeys = graph.projectedFrom.map(projectedReferenceKey);
  for (let i = 1; i < refKeys.length; i += 1) {
    if (refKeys[i] < refKeys[i - 1]) {
      ctx.addIssue({
        code: 'custom',
        message:
          'projectedFrom must be sorted by (kind, target id) ascending (deterministic serialization)',
        path: ['projectedFrom'],
      });
      break;
    }
    if (refKeys[i] === refKeys[i - 1]) {
      ctx.addIssue({
        code: 'custom',
        message: 'projectedFrom must be duplicate-free by (kind, target id)',
        path: ['projectedFrom'],
      });
      break;
    }
  }
  for (let i = 1; i < graph.nodes.length; i += 1) {
    if (graph.nodes[i].id < graph.nodes[i - 1].id) {
      ctx.addIssue({
        code: 'custom',
        message: 'nodes must be sorted by id ascending (deterministic serialization)',
        path: ['nodes'],
      });
      break;
    }
    if (graph.nodes[i].id === graph.nodes[i - 1].id) {
      ctx.addIssue({
        code: 'custom',
        message: 'node ids must be unique',
        path: ['nodes'],
      });
      break;
    }
  }
  const edgeKeys = graph.edges.map((e) => `${e.from}\u0000${e.to}\u0000${e.kind}`);
  for (let i = 1; i < edgeKeys.length; i += 1) {
    if (edgeKeys[i] < edgeKeys[i - 1]) {
      ctx.addIssue({
        code: 'custom',
        message: 'edges must be sorted by (from, to, kind) ascending (deterministic serialization)',
        path: ['edges'],
      });
      break;
    }
    if (edgeKeys[i] === edgeKeys[i - 1]) {
      ctx.addIssue({
        code: 'custom',
        message: 'edges must be duplicate-free by (from, to, kind)',
        path: ['edges'],
      });
      break;
    }
  }
  for (let i = 0; i < graph.edges.length; i += 1) {
    if (graph.edges[i].from === graph.edges[i].to) {
      ctx.addIssue({
        code: 'custom',
        message: 'edges may not loop a node onto itself',
        path: ['edges', i],
      });
    }
  }
  const legal = GRAPH_KIND_NODE_KINDS[graph.graphKind];
  for (let i = 0; i < graph.nodes.length; i += 1) {
    if (!legal.includes(graph.nodes[i].kind)) {
      ctx.addIssue({
        code: 'custom',
        message: `node kind "${graph.nodes[i].kind}" is not legal in a "${graph.graphKind}" graph`,
        path: ['nodes', i, 'kind'],
      });
    }
  }
}

/**
 * The content of an Experience Graph envelope (everything except the
 * digest). Collections carry sorted/duplicate-free refinements — the
 * canonical-ordering half of deterministic serialization.
 */
export const ExperienceGraphContentSchema = z
  .strictObject({
    schema: z.literal(EXPERIENCE_GRAPH_SCHEMA_NAME),
    protocolVersion: ExperienceProtocolVersionSchema,
    graphId: ExperienceGraphIdSchema,
    graphKind: ExperienceGraphKindSchema,
    tenantScope: TenantScopeSchema,
    /** The kernel inputs this graph projects (may be empty: pure presentation). */
    projectedFrom: z.array(ProjectedReferenceSchema).max(MAX_PROJECTED_REFERENCES),
    nodes: z.array(ExperienceNodeSchema).min(1).max(MAX_GRAPH_NODES),
    edges: z.array(ExperienceEdgeSchema).max(MAX_GRAPH_EDGES),
    /** The device this graph was produced for (abstract slot; R29). */
    device: DeviceDescriptorSchema,
  })
  .superRefine(refineCanonicalOrdering)
  .meta({
    id: 'ExperienceGraphContent',
    title: 'ExperienceGraphContent',
    description:
      'The content of an Experience Graph envelope: discriminator, version, tenant scope, projected kernel inputs, canonically ordered nodes/edges, and the device slot.',
  });

/** The content of an Experience Graph envelope. */
export type ExperienceGraphContent = z.infer<typeof ExperienceGraphContentSchema>;

/**
 * The sealed Experience Graph envelope: content plus its SHA-256 digest
 * over the canonical JSON of the content (the digest field excluded). The
 * digest addresses the exact revision of the graph; admission rejects a
 * claimed digest that does not match the recomputed one.
 */
export const ExperienceGraphSchema = z
  .strictObject({
    schema: z.literal(EXPERIENCE_GRAPH_SCHEMA_NAME),
    protocolVersion: ExperienceProtocolVersionSchema,
    graphId: ExperienceGraphIdSchema,
    graphKind: ExperienceGraphKindSchema,
    tenantScope: TenantScopeSchema,
    projectedFrom: z.array(ProjectedReferenceSchema).max(MAX_PROJECTED_REFERENCES),
    nodes: z.array(ExperienceNodeSchema).min(1).max(MAX_GRAPH_NODES),
    edges: z.array(ExperienceEdgeSchema).max(MAX_GRAPH_EDGES),
    device: DeviceDescriptorSchema,
    digest: Sha256HexSchema,
  })
  .superRefine(refineCanonicalOrdering)
  .meta({
    id: 'ExperienceGraph',
    title: 'ExperienceGraph',
    description:
      'The sealed Experience Graph envelope: canonically ordered content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed Experience Graph envelope. */
export type ExperienceGraph = z.infer<typeof ExperienceGraphSchema>;
