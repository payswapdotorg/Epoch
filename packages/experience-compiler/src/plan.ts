/**
 * The Render Plan — the versioned, content-addressed, renderer-ready
 * document the experience compiler emits (architecture.md "Experience
 * Runtime" — binding; W012).
 *
 * Authority model (lock rules 8/16): the plan is a COMPILED PROJECTION of
 * an admitted W011 Experience Graph for one target device. It preserves
 * the graph's opaque, tenant-scoped, exact-revision projected references —
 * never embeds kernel objects — and restructures the presentation content
 * into staged, canonically ordered, deterministic plan operations. It
 * never mutates kernel state and never becomes a second semantic store.
 *
 * Device shaping: `constraints` carries the typed budgets/limits of the
 * TARGET device (the W011 device-descriptor slot, as data); `usage`
 * carries the compiler's deterministic resource accounting of the
 * compiled content. Compile-time enforcement rejects budget violations
 * (see src/usage.ts); the constraints stay in the plan so downstream
 * presenters (W013/W019) enforce the same envelope.
 *
 * Determinism: `stages` follow the fixed canonical pipeline order;
 * each stage's ops are canonically sorted (draw order, node id, flattened
 * animation keys, narrative sequence, timeline time, participant id);
 * identical (envelope, device) inputs compile to byte-identical plans
 * under canonical JSON serialization and their SHA-256 digests are
 * stable. Zero wall-clock, zero randomness.
 *
 * Digest chain: the plan content carries `sourceEnvelopeDigest` (the W011
 * graph's sealed digest) inside the digested content, so the plan digest
 * addresses both the compiled form AND the exact envelope revision it
 * compiled from: envelope digest -> plan digest.
 */
import { z } from 'zod';
import {
  ControlIntentSchema,
  ControlKindSchema,
  DeviceDescriptorSchema,
  ExperienceEdgeKindSchema,
  ExperienceGraphIdSchema,
  ExperienceGraphKindSchema,
  ExperienceNodeIdSchema,
  Geometry2dSchema,
  InteractionModalitySchema,
  KeyframeSchema,
  MeshBindingSchema,
  ParticipantReferenceSchema,
  Point2dSchema,
  PoseTrackingKindSchema,
  PresentationAttributesSchema,
  ProjectedReferenceSchema,
  PropertyPathSchema,
  QuaternionSchema,
  Sha256HexSchema,
  SpatialPrimitiveSchema,
  StrokeStyle2dSchema,
  FillStyle2dSchema,
  TenantScopeSchema,
  TextStyleSchema,
  TimelineMarkerKindSchema,
  Vec3Schema,
} from '@epoch/experience-protocol';
import {
  PLAN_KIND_STAGE_KINDS,
  PLAN_STAGE_KINDS,
  RENDER_PLAN_SCHEMA_NAME,
  RenderPlanProtocolVersionSchema,
  MAX_PLAN_ANCHORS_PER_OP,
  MAX_PLAN_ANIMATION_BINDINGS,
  MAX_PLAN_RELATIONS,
  MAX_PLAN_SOURCE_REFS,
  MAX_PLAN_STAGE_OPS,
  MAX_PLAN_STAGES,
} from './version';

// ---------------------------------------------------------------------------
// Deterministic anchors (label anchor target ids, sorted, bounded).
// ---------------------------------------------------------------------------

const AnchorNodeIds = z
  .array(ExperienceNodeIdSchema)
  .min(1)
  .max(MAX_PLAN_ANCHORS_PER_OP)
  .refine(
    (ids) => ids.every((id, i) => i === 0 || id > ids[i - 1]),
    'anchorNodeIds must be sorted ascending and duplicate-free (deterministic set semantics)',
  )
  .meta({
    id: 'AnchorNodeIds',
    title: 'AnchorNodeIds',
    description: 'Sorted, duplicate-free anchor target node ids of one label plan op.',
  });

// ---------------------------------------------------------------------------
// draw-2d stage ops (2D graphs; animation graphs may carry shape-2d nodes).
// ---------------------------------------------------------------------------

/** One compiled 2D shape draw op. */
export const PlanDrawShapeOpSchema = z
  .strictObject({
    op: z.literal('draw-shape'),
    nodeId: ExperienceNodeIdSchema,
    ref: ProjectedReferenceSchema.optional(),
    geometry: Geometry2dSchema,
    stroke: StrokeStyle2dSchema.optional(),
    fill: FillStyle2dSchema.optional(),
    zIndex: z.number().int().optional(),
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({
    id: 'PlanDrawShapeOp',
    title: 'PlanDrawShapeOp',
    description:
      'Compiled 2D draw operation: neutral geometry, resolved styling, and inherited presentation attributes.',
  });

/** One 2D shape draw op. */
export type PlanDrawShapeOp = z.infer<typeof PlanDrawShapeOpSchema>;

/** One compiled 2D label draw op (offset resolved to its default). */
export const PlanDrawLabelOpSchema = z
  .strictObject({
    op: z.literal('draw-label'),
    nodeId: ExperienceNodeIdSchema,
    ref: ProjectedReferenceSchema.optional(),
    text: z.string().min(1).max(512),
    offset2d: Point2dSchema,
    style: TextStyleSchema.optional(),
    anchorNodeIds: AnchorNodeIds.optional(),
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({
    id: 'PlanDrawLabelOp',
    title: 'PlanDrawLabelOp',
    description:
      'Compiled 2D label draw operation: bounded text, resolved offset, optional styling and anchor targets.',
  });

/** One 2D label draw op. */
export type PlanDrawLabelOp = z.infer<typeof PlanDrawLabelOpSchema>;

/** The draw op union (discriminated on `op`). */
const PlanDrawOpSchema = z
  .discriminatedUnion('op', [PlanDrawShapeOpSchema, PlanDrawLabelOpSchema])
  .meta({
    id: 'PlanDrawOp',
    title: 'PlanDrawOp',
    description: 'One compiled 2D draw operation: shape or label.',
  });

// ---------------------------------------------------------------------------
// place-3d stage ops (3D graphs; animation graphs may carry spatial-3d nodes).
// ---------------------------------------------------------------------------

/** One compiled 3D spatial placement op. */
export const PlanPlaceSpatialOpSchema = z
  .strictObject({
    op: z.literal('place-spatial'),
    nodeId: ExperienceNodeIdSchema,
    ref: ProjectedReferenceSchema.optional(),
    primitive: SpatialPrimitiveSchema,
    position: Vec3Schema,
    orientation: QuaternionSchema.optional(),
    scale: z
      .tuple([
        z.number().positive().finite(),
        z.number().positive().finite(),
        z.number().positive().finite(),
      ])
      .optional()
      .meta({ id: 'PlanScale3d', title: 'PlanScale3d', description: 'Positive per-axis 3D scale.' }),
    mesh: MeshBindingSchema.optional(),
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({
    id: 'PlanPlaceSpatialOp',
    title: 'PlanPlaceSpatialOp',
    description:
      'Compiled 3D placement operation: neutral primitive, resolved transform, optional content-addressed mesh.',
  });

/** One 3D spatial placement op. */
export type PlanPlaceSpatialOp = z.infer<typeof PlanPlaceSpatialOpSchema>;

/** One compiled 3D label placement op (offset resolved to its default). */
export const PlanPlaceLabelOpSchema = z
  .strictObject({
    op: z.literal('place-label'),
    nodeId: ExperienceNodeIdSchema,
    ref: ProjectedReferenceSchema.optional(),
    text: z.string().min(1).max(512),
    offset3d: Vec3Schema,
    style: TextStyleSchema.optional(),
    anchorNodeIds: AnchorNodeIds.optional(),
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({
    id: 'PlanPlaceLabelOp',
    title: 'PlanPlaceLabelOp',
    description:
      'Compiled 3D label placement operation: bounded text, resolved offset, optional styling and anchor targets.',
  });

/** One 3D label placement op. */
export type PlanPlaceLabelOp = z.infer<typeof PlanPlaceLabelOpSchema>;

/** The placement op union (discriminated on `op`). */
const PlanPlaceOpSchema = z
  .discriminatedUnion('op', [PlanPlaceSpatialOpSchema, PlanPlaceLabelOpSchema])
  .meta({
    id: 'PlanPlaceOp',
    title: 'PlanPlaceOp',
    description: 'One compiled 3D placement operation: spatial primitive or label.',
  });

// ---------------------------------------------------------------------------
// animate stage content (animation graphs).
// ---------------------------------------------------------------------------

/** One flattened animation binding: clip x track. */
export const PlanAnimationBindingSchema = z
  .strictObject({
    clipNodeId: ExperienceNodeIdSchema,
    targetNodeId: ExperienceNodeIdSchema,
    propertyPath: PropertyPathSchema,
    durationMs: z.number().int().positive(),
    keyframes: z.array(KeyframeSchema).min(1).max(256),
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({
    id: 'PlanAnimationBinding',
    title: 'PlanAnimationBinding',
    description:
      'One flattened animation binding: which plan op, which property, the clip duration, and the strictly time-ordered keyframes.',
  });

/** One animation binding. */
export type PlanAnimationBinding = z.infer<typeof PlanAnimationBindingSchema>;

// ---------------------------------------------------------------------------
// narrate stage content (narrative graphs).
// ---------------------------------------------------------------------------

/** One narrative beat in its compiled presentation order. */
export const PlanNarrativeBeatSchema = z
  .strictObject({
    sequence: z.number().int().nonnegative(),
    nodeId: ExperienceNodeIdSchema,
    ref: ProjectedReferenceSchema.optional(),
    title: z.string().min(1).max(256),
    body: z.string().max(4096).optional(),
    tone: z
      .enum(['cautionary', 'celebratory', 'informative', 'neutral'])
      .optional()
      .meta({
        id: 'PlanNarrativeTone',
        title: 'PlanNarrativeTone',
        description: 'Presentation tone of a compiled narrative beat.',
      }),
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({
    id: 'PlanNarrativeBeat',
    title: 'PlanNarrativeBeat',
    description:
      'One narrative beat in its compiled presentation order (sequence resolved from the follows chain).',
  });

/** One compiled narrative beat. */
export type PlanNarrativeBeat = z.infer<typeof PlanNarrativeBeatSchema>;

// ---------------------------------------------------------------------------
// timeline stage content (timeline-replay graphs).
// ---------------------------------------------------------------------------

/** One timeline track in compiled time order. */
export const PlanTimelineTrackSchema = z
  .strictObject({
    nodeId: ExperienceNodeIdSchema,
    ref: ProjectedReferenceSchema.optional(),
    label: z.string().min(1).max(256),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({
    id: 'PlanTimelineTrack',
    title: 'PlanTimelineTrack',
    description: 'One timeline track in compiled time order.',
  });

/** One compiled timeline track. */
export type PlanTimelineTrack = z.infer<typeof PlanTimelineTrackSchema>;

/** One timeline marker in compiled time order. */
export const PlanTimelineMarkerSchema = z
  .strictObject({
    nodeId: ExperienceNodeIdSchema,
    ref: ProjectedReferenceSchema.optional(),
    atMs: z.number().int().nonnegative(),
    label: z.string().max(256).optional(),
    markerKind: TimelineMarkerKindSchema,
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({
    id: 'PlanTimelineMarker',
    title: 'PlanTimelineMarker',
    description:
      'One timeline marker in compiled time order: event, phase boundary, replay cursor, or branch point.',
  });

/** One compiled timeline marker. */
export type PlanTimelineMarker = z.infer<typeof PlanTimelineMarkerSchema>;

// ---------------------------------------------------------------------------
// presence stage content (presence graphs).
// ---------------------------------------------------------------------------

/** One presence seat in compiled order. */
export const PlanPresenceSeatSchema = z
  .strictObject({
    nodeId: ExperienceNodeIdSchema,
    ref: ProjectedReferenceSchema.optional(),
    participant: ParticipantReferenceSchema,
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({
    id: 'PlanPresenceSeat',
    title: 'PlanPresenceSeat',
    description: 'One presence seat in compiled (participant, node) order.',
  });

/** One compiled presence seat. */
export type PlanPresenceSeat = z.infer<typeof PlanPresenceSeatSchema>;

/** One presence cursor in compiled order. */
export const PlanPresenceCursorSchema = z
  .strictObject({
    nodeId: ExperienceNodeIdSchema,
    ref: ProjectedReferenceSchema.optional(),
    participant: ParticipantReferenceSchema,
    position2d: Point2dSchema.optional(),
    position3d: Vec3Schema.optional(),
    atMs: z.number().int().nonnegative().optional(),
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({
    id: 'PlanPresenceCursor',
    title: 'PlanPresenceCursor',
    description: 'One presence cursor in compiled (participant, node) order.',
  });

/** One compiled presence cursor. */
export type PlanPresenceCursor = z.infer<typeof PlanPresenceCursorSchema>;

// ---------------------------------------------------------------------------
// controls stage content (controls graphs).
// ---------------------------------------------------------------------------

/** One compiled control binding. */
export const PlanControlOpSchema = z
  .strictObject({
    nodeId: ExperienceNodeIdSchema,
    ref: ProjectedReferenceSchema.optional(),
    controlKind: ControlKindSchema,
    intent: ControlIntentSchema,
    label: z.string().max(256).optional(),
    options: z
      .array(z.string().min(1).max(128))
      .min(1)
      .max(64)
      .refine(
        (options) => options.every((o, i) => i === 0 || o > options[i - 1]),
        'selector options must be sorted ascending and duplicate-free (deterministic set semantics)',
      )
      .optional(),
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({
    id: 'PlanControlOp',
    title: 'PlanControlOp',
    description:
      'One compiled control binding: neutral control role, emitted typed intent (R30), optional label and selector options.',
  });

/** One compiled control op. */
export type PlanControlOp = z.infer<typeof PlanControlOpSchema>;

// ---------------------------------------------------------------------------
// relate stage content (all graph kinds; the edges, verbatim and canonical).
// ---------------------------------------------------------------------------

/** One plan relation: an experience edge carried into the plan. */
export const PlanRelationSchema = z
  .strictObject({
    kind: ExperienceEdgeKindSchema,
    from: ExperienceNodeIdSchema,
    to: ExperienceNodeIdSchema,
    attributes: PresentationAttributesSchema.optional(),
  })
  .meta({
    id: 'PlanRelation',
    title: 'PlanRelation',
    description: 'One experience edge carried into the plan, verbatim and canonically ordered.',
  });

/** One plan relation. */
export type PlanRelation = z.infer<typeof PlanRelationSchema>;

// ---------------------------------------------------------------------------
// The stage union (discriminated on `stage`; fixed canonical pipeline order).
// ---------------------------------------------------------------------------

/** The relations stage: the plan's edge set (present iff the graph has edges). */
const RelateStageSchema = z
  .strictObject({
    stage: z.literal('relate'),
    relations: z.array(PlanRelationSchema).min(1).max(MAX_PLAN_RELATIONS),
  })
  .meta({
    id: 'RelateStage',
    title: 'RelateStage',
    description:
      'The relate stage: the plan relation set (present iff the source graph has edges).',
  });

/** The 2D draw stage. */
const Draw2dStageSchema = z
  .strictObject({
    stage: z.literal('draw-2d'),
    draws: z.array(PlanDrawOpSchema).min(1).max(MAX_PLAN_STAGE_OPS),
  })
  .meta({
    id: 'Draw2dStage',
    title: 'Draw2dStage',
    description: 'The draw-2d stage: z-ordered 2D draw operations.',
  });

/** The 3D placement stage. */
const Place3dStageSchema = z
  .strictObject({
    stage: z.literal('place-3d'),
    placements: z.array(PlanPlaceOpSchema).min(1).max(MAX_PLAN_STAGE_OPS),
  })
  .meta({
    id: 'Place3dStage',
    title: 'Place3dStage',
    description: 'The place-3d stage: canonically ordered 3D placement operations.',
  });

/** The animation stage. */
const AnimateStageSchema = z
  .strictObject({
    stage: z.literal('animate'),
    bindings: z.array(PlanAnimationBindingSchema).min(1).max(MAX_PLAN_ANIMATION_BINDINGS),
  })
  .meta({
    id: 'AnimateStage',
    title: 'AnimateStage',
    description: 'The animate stage: flattened, canonically ordered animation bindings.',
  });

/** The narrative stage. */
const NarrateStageSchema = z
  .strictObject({
    stage: z.literal('narrate'),
    beats: z.array(PlanNarrativeBeatSchema).min(1).max(MAX_PLAN_STAGE_OPS),
  })
  .meta({
    id: 'NarrateStage',
    title: 'NarrateStage',
    description: 'The narrate stage: narrative beats in compiled presentation order.',
  });

/** The timeline stage. */
const TimelineStageSchema = z
  .strictObject({
    stage: z.literal('timeline'),
    tracks: z.array(PlanTimelineTrackSchema).max(MAX_PLAN_STAGE_OPS),
    markers: z.array(PlanTimelineMarkerSchema).max(MAX_PLAN_STAGE_OPS),
  })
  .meta({
    id: 'TimelineStage',
    title: 'TimelineStage',
    description: 'The timeline stage: tracks and markers in compiled time order.',
  });

/** The presence stage. */
const PresenceStageSchema = z
  .strictObject({
    stage: z.literal('presence'),
    seats: z.array(PlanPresenceSeatSchema).max(MAX_PLAN_STAGE_OPS),
    cursors: z.array(PlanPresenceCursorSchema).max(MAX_PLAN_STAGE_OPS),
  })
  .meta({
    id: 'PresenceStage',
    title: 'PresenceStage',
    description: 'The presence stage: seats and cursors in compiled order.',
  });

/** The controls stage. */
const ControlsStageSchema = z
  .strictObject({
    stage: z.literal('controls'),
    controls: z.array(PlanControlOpSchema).min(1).max(MAX_PLAN_STAGE_OPS),
  })
  .meta({
    id: 'ControlsStage',
    title: 'ControlsStage',
    description: 'The controls stage: canonically ordered control bindings.',
  });

/** The plan stage union (discriminated on `stage`). */
export const PlanStageSchema = z
  .discriminatedUnion('stage', [
    RelateStageSchema,
    Draw2dStageSchema,
    Place3dStageSchema,
    AnimateStageSchema,
    NarrateStageSchema,
    TimelineStageSchema,
    PresenceStageSchema,
    ControlsStageSchema,
  ])
  .meta({
    id: 'PlanStage',
    title: 'PlanStage',
    description:
      'One compiled plan stage of the deterministic pipeline: relate, draw-2d, place-3d, animate, narrate, timeline, presence, or controls.',
  });

/** One plan stage. */
export type PlanStage = z.infer<typeof PlanStageSchema>;

// ---------------------------------------------------------------------------
// Device-shaped constraints and resource usage.
// ---------------------------------------------------------------------------

/**
 * The typed plan constraints: the target device's budgets and limits as
 * DATA (the enforcement envelope the plan was shaped for). Fidelity
 * differences are carried here for the downstream presenter (W019
 * adapts); countable budget VIOLATIONS are rejected at compile time
 * instead (typed `device-budget-exceeded`).
 */
export const PlanConstraintsSchema = z
  .strictObject({
    /** Whether the target surface renders stereoscopically. */
    stereoscopic: z.boolean(),
    /** Pose-tracking class of the target device. */
    poseTracking: PoseTrackingKindSchema,
    /** Whether content can anchor to the physical world on the target. */
    worldAnchored: z.boolean(),
    /** Interaction modalities the target services (sorted set). */
    interaction: z
      .array(InteractionModalitySchema)
      .max(7)
      .refine(
        (modalities) => modalities.every((m, i) => i === 0 || m > modalities[i - 1]),
        'interaction must be sorted ascending and duplicate-free (deterministic set semantics)',
      ),
    /** Display pixel budget (when the target declares one). */
    maxPixels: z.number().int().positive().optional(),
    /** Nominal refresh rate (when the target declares one). */
    refreshHz: z.number().int().positive().optional(),
    /** Color depth in bits per channel (when the target declares one). */
    colorDepthBits: z.number().int().positive().optional(),
    /** Triangle budget for 3D content (when the target declares one). */
    maxTriangles: z.number().int().positive().optional(),
    /** 3D content memory budget in bytes (when the target declares one). */
    maxTextureBytes: z.number().int().positive().optional(),
    /** Interaction-to-photon latency budget (when the target declares one). */
    latencyBudgetMs: z.number().int().positive().optional(),
  })
  .meta({
    id: 'PlanConstraints',
    title: 'PlanConstraints',
    description:
      'The typed plan constraints: target-device budgets and limits as data (device-aware plan shaping).',
  });

/** The plan constraints. */
export type PlanConstraints = z.infer<typeof PlanConstraintsSchema>;

/**
 * The compiler's deterministic resource accounting of the compiled
 * content: exact counts plus the conservative triangle estimate and
 * content-addressed mesh-asset byte total used for budget enforcement
 * (see PRIMITIVE_TRIANGLE_ESTIMATES for the estimate policy).
 */
export const RenderPlanUsageSchema = z
  .strictObject({
    /** Node count of the source graph. */
    nodes: z.number().int().min(1),
    /** Edge count of the source graph. */
    edges: z.number().int().nonnegative(),
    /** Deterministic primitive-triangle estimate (meshes count 0). */
    estimatedTriangles: z.number().int().nonnegative(),
    /** Total declared mesh-asset bytes (content-addressed bindings). */
    assetBytes: z.number().int().nonnegative(),
  })
  .meta({
    id: 'RenderPlanUsage',
    title: 'RenderPlanUsage',
    description:
      'Deterministic resource accounting of the compiled plan: exact node/edge counts, primitive-triangle estimate, and mesh-asset bytes.',
  });

/** The plan usage record. */
export type RenderPlanUsage = z.infer<typeof RenderPlanUsageSchema>;

// ---------------------------------------------------------------------------
// Canonical-consistency refinement (shared by content and sealed schemas).
// ---------------------------------------------------------------------------

type StageUnion = z.infer<typeof PlanStageSchema>;

/** Collect every node id referenced by the plan's ops (sorted, unique). */
function collectNodeIds(stages: readonly StageUnion[]): string[] {
  const ids = new Set<string>();
  for (const stage of stages) {
    switch (stage.stage) {
      case 'relate':
        for (const relation of stage.relations) {
          ids.add(relation.from);
          ids.add(relation.to);
        }
        break;
      case 'draw-2d':
        for (const draw of stage.draws) ids.add(draw.nodeId);
        break;
      case 'place-3d':
        for (const placement of stage.placements) ids.add(placement.nodeId);
        break;
      case 'animate':
        for (const binding of stage.bindings) {
          ids.add(binding.clipNodeId);
          ids.add(binding.targetNodeId);
        }
        break;
      case 'narrate':
        for (const beat of stage.beats) ids.add(beat.nodeId);
        break;
      case 'timeline':
        for (const track of stage.tracks) ids.add(track.nodeId);
        for (const marker of stage.markers) ids.add(marker.nodeId);
        break;
      case 'presence':
        for (const seat of stage.seats) ids.add(seat.nodeId);
        for (const cursor of stage.cursors) ids.add(cursor.nodeId);
        break;
      case 'controls':
        for (const control of stage.controls) ids.add(control.nodeId);
        break;
    }
  }
  return [...ids].sort();
}

/** Effective z-order of a draw op (labels resolve to 0). */
function drawZ(draw: z.infer<typeof PlanDrawOpSchema>): number {
  return draw.op === 'draw-shape' ? (draw.zIndex ?? 0) : 0;
}

/**
 * The shared canonical-consistency refinement: stages follow the fixed
 * pipeline order with unique kinds, every stage kind is legal for the
 * source graph kind, every stage's ops are canonically sorted (numeric
 * keys compared numerically), the relate stage exactly mirrors the edge
 * count, the op node-id set equals the claimed node usage, and label
 * anchors resolve within the plan. Shared by the content schema and the
 * sealed schema so the two can never drift.
 */
function refineCanonicalOrdering(
  plan: {
    sourceGraphKind: z.infer<typeof ExperienceGraphKindSchema>;
    usage: z.infer<typeof RenderPlanUsageSchema>;
    stages: StageUnion[];
  },
  ctx: z.RefinementCtx,
): void {
  // Stage order + uniqueness + per-kind legality.
  const orderIndex = new Map<string, number>(PLAN_STAGE_KINDS.map((kind, i) => [kind, i]));
  for (let i = 0; i < plan.stages.length; i += 1) {
    const stage = plan.stages[i];
    const index = orderIndex.get(stage.stage);
    if (index === undefined) {
      ctx.addIssue({ code: 'custom', message: 'unknown plan stage kind', path: ['stages', i] });
      continue;
    }
    if (i > 0) {
      const previous = orderIndex.get(plan.stages[i - 1].stage) ?? -1;
      if (previous >= index) {
        ctx.addIssue({
          code: 'custom',
          message: `stages must follow the canonical pipeline order (${PLAN_STAGE_KINDS.join(' > ')})`,
          path: ['stages', i],
        });
      }
    }
    if (!PLAN_KIND_STAGE_KINDS[plan.sourceGraphKind].includes(stage.stage)) {
      ctx.addIssue({
        code: 'custom',
        message: `stage "${stage.stage}" is not legal in a "${plan.sourceGraphKind}" plan`,
        path: ['stages', i, 'stage'],
      });
    }
  }

  // Per-stage canonical op ordering (numeric keys compare numerically).
  for (const stage of plan.stages) {
    switch (stage.stage) {
      case 'relate': {
        const keys = stage.relations.map((r) => [r.from, r.to, r.kind] as const);
        for (let i = 1; i < keys.length; i += 1) {
          const [a, b] = [keys[i - 1], keys[i]];
          if (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]) || (a[0] === b[0] && a[1] === b[1] && a[2] >= b[2])) {
            ctx.addIssue({
              code: 'custom',
              message:
                'relations must be sorted by (from, to, kind) ascending (deterministic serialization)',
              path: ['stages', stage.stage],
            });
            break;
          }
        }
        break;
      }
      case 'draw-2d': {
        for (let i = 1; i < stage.draws.length; i += 1) {
          const previous = stage.draws[i - 1];
          const current = stage.draws[i];
          const zp = drawZ(previous);
          const zc = drawZ(current);
          if (zp > zc || (zp === zc && previous.nodeId >= current.nodeId)) {
            ctx.addIssue({
              code: 'custom',
              message:
                'draws must be sorted by (zIndex, nodeId) ascending — compiled draw order (deterministic serialization)',
              path: ['stages', stage.stage],
            });
            break;
          }
        }
        break;
      }
      case 'place-3d': {
        for (let i = 1; i < stage.placements.length; i += 1) {
          if (stage.placements[i].nodeId <= stage.placements[i - 1].nodeId) {
            ctx.addIssue({
              code: 'custom',
              message: 'placements must be sorted by nodeId ascending (deterministic serialization)',
              path: ['stages', stage.stage],
            });
            break;
          }
        }
        break;
      }
      case 'animate': {
        for (let i = 1; i < stage.bindings.length; i += 1) {
          const previous = stage.bindings[i - 1];
          const current = stage.bindings[i];
          if (
            previous.clipNodeId > current.clipNodeId ||
            (previous.clipNodeId === current.clipNodeId && previous.targetNodeId > current.targetNodeId) ||
            (previous.clipNodeId === current.clipNodeId &&
              previous.targetNodeId === current.targetNodeId &&
              previous.propertyPath >= current.propertyPath)
          ) {
            ctx.addIssue({
              code: 'custom',
              message:
                'animation bindings must be sorted by (clipNodeId, targetNodeId, propertyPath) ascending (deterministic serialization)',
              path: ['stages', stage.stage],
            });
            break;
          }
        }
        break;
      }
      case 'narrate': {
        for (let i = 1; i < stage.beats.length; i += 1) {
          if (stage.beats[i].sequence <= stage.beats[i - 1].sequence) {
            ctx.addIssue({
              code: 'custom',
              message:
                'narrative beats must be ordered by strictly increasing sequence (compiled presentation order)',
              path: ['stages', stage.stage],
            });
            break;
          }
        }
        break;
      }
      case 'timeline': {
        for (let i = 1; i < stage.tracks.length; i += 1) {
          const previous = stage.tracks[i - 1];
          const current = stage.tracks[i];
          if (
            previous.startMs > current.startMs ||
            (previous.startMs === current.startMs && previous.endMs > current.endMs) ||
            (previous.startMs === current.startMs &&
              previous.endMs === current.endMs &&
              previous.nodeId >= current.nodeId)
          ) {
            ctx.addIssue({
              code: 'custom',
              message:
                'timeline tracks must be sorted by (startMs, endMs, nodeId) ascending (compiled time order)',
              path: ['stages', stage.stage],
            });
            break;
          }
        }
        for (let i = 1; i < stage.markers.length; i += 1) {
          const previous = stage.markers[i - 1];
          const current = stage.markers[i];
          if (previous.atMs > current.atMs || (previous.atMs === current.atMs && previous.nodeId >= current.nodeId)) {
            ctx.addIssue({
              code: 'custom',
              message:
                'timeline markers must be sorted by (atMs, nodeId) ascending (compiled time order)',
              path: ['stages', stage.stage],
            });
            break;
          }
        }
        if (stage.tracks.length === 0 && stage.markers.length === 0) {
          ctx.addIssue({
            code: 'custom',
            message: 'the timeline stage must carry at least one track or marker',
            path: ['stages', stage.stage],
          });
        }
        break;
      }
      case 'presence': {
        for (let i = 1; i < stage.seats.length; i += 1) {
          const previous = stage.seats[i - 1];
          const current = stage.seats[i];
          if (
            previous.participant.participantId > current.participant.participantId ||
            (previous.participant.participantId === current.participant.participantId &&
              previous.nodeId >= current.nodeId)
          ) {
            ctx.addIssue({
              code: 'custom',
              message:
                'presence seats must be sorted by (participantId, nodeId) ascending (deterministic serialization)',
              path: ['stages', stage.stage],
            });
            break;
          }
        }
        for (let i = 1; i < stage.cursors.length; i += 1) {
          const previous = stage.cursors[i - 1];
          const current = stage.cursors[i];
          if (
            previous.participant.participantId > current.participant.participantId ||
            (previous.participant.participantId === current.participant.participantId &&
              previous.nodeId >= current.nodeId)
          ) {
            ctx.addIssue({
              code: 'custom',
              message:
                'presence cursors must be sorted by (participantId, nodeId) ascending (deterministic serialization)',
              path: ['stages', stage.stage],
            });
            break;
          }
        }
        if (stage.seats.length === 0 && stage.cursors.length === 0) {
          ctx.addIssue({
            code: 'custom',
            message: 'the presence stage must carry at least one seat or cursor',
            path: ['stages', stage.stage],
          });
        }
        break;
      }
      case 'controls': {
        for (let i = 1; i < stage.controls.length; i += 1) {
          if (stage.controls[i].nodeId <= stage.controls[i - 1].nodeId) {
            ctx.addIssue({
              code: 'custom',
              message: 'controls must be sorted by nodeId ascending (deterministic serialization)',
              path: ['stages', stage.stage],
            });
            break;
          }
        }
        break;
      }
    }
  }

  // The relate stage exactly mirrors the edge count.
  const relate = plan.stages.find(
    (stage): stage is Extract<StageUnion, { stage: 'relate' }> => stage.stage === 'relate',
  );
  const relationCount = relate === undefined ? 0 : relate.relations.length;
  if (relationCount !== plan.usage.edges) {
    ctx.addIssue({
      code: 'custom',
      message: 'the relate stage must carry exactly usage.edges relations (absent when zero)',
      path: ['stages'],
    });
  }

  // Every compiled node is accounted: the op node-id set equals usage.nodes.
  const nodeIds = collectNodeIds(plan.stages);
  if (nodeIds.length !== plan.usage.nodes) {
    ctx.addIssue({
      code: 'custom',
      message:
        `the plan ops reference ${nodeIds.length} distinct node ids but usage claims ${plan.usage.nodes} nodes ` +
        '(every source node must compile into exactly one plan op identity)',
      path: ['usage', 'nodes'],
    });
  }

  // Anchor resolvability within the plan.
  const known = new Set<string>(nodeIds);
  for (const stage of plan.stages) {
    if (stage.stage !== 'draw-2d' && stage.stage !== 'place-3d') continue;
    const labelOps =
      stage.stage === 'draw-2d'
        ? stage.draws.filter(
            (d): d is z.infer<typeof PlanDrawLabelOpSchema> => d.op === 'draw-label',
          )
        : stage.placements.filter(
            (p): p is z.infer<typeof PlanPlaceLabelOpSchema> => p.op === 'place-label',
          );
    for (const labelOp of labelOps) {
      if (labelOp.anchorNodeIds === undefined) continue;
      for (const anchor of labelOp.anchorNodeIds) {
        if (!known.has(anchor)) {
          ctx.addIssue({
            code: 'custom',
            message: `label op "${labelOp.nodeId}" anchors to node "${anchor}", which does not exist in the plan`,
            path: ['stages', stage.stage],
          });
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// The Render Plan envelope.
// ---------------------------------------------------------------------------

/**
 * The content of a Render Plan envelope (everything except the digest).
 * Carries the digest chain (source envelope digest), the tenant scope,
 * the target device and its derived constraints, the deterministic
 * resource usage, and the staged compiled body.
 */
export const RenderPlanContentSchema = z
  .strictObject({
    schema: z.literal(RENDER_PLAN_SCHEMA_NAME),
    protocolVersion: RenderPlanProtocolVersionSchema,
    sourceGraphId: ExperienceGraphIdSchema,
    sourceGraphKind: ExperienceGraphKindSchema,
    sourceEnvelopeDigest: Sha256HexSchema,
    tenantScope: TenantScopeSchema,
    sourceRefs: z.array(ProjectedReferenceSchema).max(MAX_PLAN_SOURCE_REFS),
    target: DeviceDescriptorSchema,
    constraints: PlanConstraintsSchema,
    usage: RenderPlanUsageSchema,
    stages: z.array(PlanStageSchema).min(1).max(MAX_PLAN_STAGES),
  })
  .superRefine(refineCanonicalOrdering)
  .meta({
    id: 'RenderPlanContent',
    title: 'RenderPlanContent',
    description:
      'The content of a Render Plan envelope: chain to the source graph revision, tenant scope, target device, derived constraints, resource usage, and the staged compiled body.',
  });

/** The content of a Render Plan envelope. */
export type RenderPlanContent = z.infer<typeof RenderPlanContentSchema>;

/**
 * The sealed Render Plan envelope: content plus its SHA-256 digest over
 * the canonical JSON of the content (the digest field excluded). The
 * digest addresses the exact revision of the compiled plan AND, through
 * `sourceEnvelopeDigest`, the exact W011 envelope revision it compiled
 * from (envelope digest -> plan digest).
 */
export const RenderPlanSchema = z
  .strictObject({
    schema: z.literal(RENDER_PLAN_SCHEMA_NAME),
    protocolVersion: RenderPlanProtocolVersionSchema,
    sourceGraphId: ExperienceGraphIdSchema,
    sourceGraphKind: ExperienceGraphKindSchema,
    sourceEnvelopeDigest: Sha256HexSchema,
    tenantScope: TenantScopeSchema,
    sourceRefs: z.array(ProjectedReferenceSchema).max(MAX_PLAN_SOURCE_REFS),
    target: DeviceDescriptorSchema,
    constraints: PlanConstraintsSchema,
    usage: RenderPlanUsageSchema,
    stages: z.array(PlanStageSchema).min(1).max(MAX_PLAN_STAGES),
    digest: Sha256HexSchema,
  })
  .superRefine(refineCanonicalOrdering)
  .meta({
    id: 'RenderPlan',
    title: 'RenderPlan',
    description:
      'The sealed Render Plan envelope: staged, sorted, device-shaped compiled content plus its SHA-256 content digest (envelope digest -> plan digest chain).',
  });

/** One sealed Render Plan envelope. */
export type RenderPlan = z.infer<typeof RenderPlanSchema>;
