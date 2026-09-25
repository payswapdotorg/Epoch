/**
 * Typed presentation descriptors of the Experience Graph node kinds.
 *
 * Every descriptor is a strict, provider-neutral record (architecture lock
 * rule 13): neutral mathematical geometry, neutral spatial primitives,
 * neutral timing/animation data, neutral narrative vocabulary, neutral
 * presence participants, and neutral control roles. NO engine shapes (no
 * engine scene graphs, no engine materials), NO framework widgets —
 * concrete renderers are future adapters (W013/W019).
 *
 * Determinism: collections that admit more than one element carry sorted/
 * strictly-ordered refinements so semantically equal descriptors are
 * byte-identical under canonical serialization.
 */
import { z } from 'zod';
import { JsonValueSchema, QUALIFIED_NAME_PATTERN, SEMVER_CORE_PATTERN } from '@epoch/agent-protocol';
import {
  ColorHexSchema,
  ExperienceNodeIdSchema,
  PropertyPathSchema,
  QuaternionSchema,
  Sha256HexSchema,
  Vec3Schema,
} from './primitives';
import {
  ControlKindSchema,
  EasingKindSchema,
  NarrativeToneSchema,
  ParticipantKindSchema,
  SpatialPrimitiveSchema,
  TextWeightSchema,
  TimelineMarkerKindSchema,
} from './version';

// ---------------------------------------------------------------------------
// Shared 2D geometry (neutral mathematical primitives).
// ---------------------------------------------------------------------------

/** A finite 2D point. */
export const Point2dSchema = z
  .strictObject({
    x: z.number().finite(),
    y: z.number().finite(),
  })
  .meta({
    id: 'Point2d',
    title: 'Point2d',
    description: 'Finite 2D point (x, y).',
  });

/** One 2D point. */
export type Point2d = z.infer<typeof Point2dSchema>;

/**
 * Ordered polyline vertices. Vertex order is SEMANTIC (a path's shape),
 * not canonical — it is preserved exactly as authored.
 */
const PolylinePoints = z
  .array(Point2dSchema)
  .min(2)
  .max(512)
  .meta({
    id: 'PolylinePoints',
    title: 'PolylinePoints',
    description: 'Ordered polyline vertices (semantic order; at least 2, at most 512).',
  });

/** Neutral 2D geometry (discriminated on `form`). */
export const Geometry2dSchema = z
  .discriminatedUnion('form', [
    z
      .strictObject({
        form: z.literal('point'),
        x: z.number().finite(),
        y: z.number().finite(),
      })
      .meta({ id: 'Geometry2dPoint', title: 'Geometry2dPoint' }),
    z
      .strictObject({
        form: z.literal('rect'),
        x: z.number().finite(),
        y: z.number().finite(),
        width: z.number().nonnegative(),
        height: z.number().nonnegative(),
      })
      .meta({ id: 'Geometry2dRect', title: 'Geometry2dRect' }),
    z
      .strictObject({
        form: z.literal('circle'),
        cx: z.number().finite(),
        cy: z.number().finite(),
        r: z.number().nonnegative(),
      })
      .meta({ id: 'Geometry2dCircle', title: 'Geometry2dCircle' }),
    z
      .strictObject({
        form: z.literal('ellipse'),
        cx: z.number().finite(),
        cy: z.number().finite(),
        rx: z.number().nonnegative(),
        ry: z.number().nonnegative(),
      })
      .meta({ id: 'Geometry2dEllipse', title: 'Geometry2dEllipse' }),
    z
      .strictObject({
        form: z.literal('polyline'),
        points: PolylinePoints,
      })
      .meta({ id: 'Geometry2dPolyline', title: 'Geometry2dPolyline' }),
    z
      .strictObject({
        form: z.literal('polygon'),
        points: z
          .array(Point2dSchema)
          .min(3)
          .max(512)
          .meta({ id: 'PolygonPoints', title: 'PolygonPoints' }),
      })
      .meta({ id: 'Geometry2dPolygon', title: 'Geometry2dPolygon' }),
  ])
  .meta({
    id: 'Geometry2d',
    title: 'Geometry2d',
    description: 'Neutral 2D geometry: point, rect, circle, ellipse, polyline, or polygon.',
  });

/** One neutral 2D geometry. */
export type Geometry2d = z.infer<typeof Geometry2dSchema>;

// ---------------------------------------------------------------------------
// 2D styling.
// ---------------------------------------------------------------------------

/** Stroke styling of a 2D shape. */
export const StrokeStyle2dSchema = z
  .strictObject({
    color: ColorHexSchema,
    lineWidth: z.number().positive().finite(),
  })
  .meta({
    id: 'StrokeStyle2d',
    title: 'StrokeStyle2d',
    description: 'Stroke styling of a 2D shape: canonical color plus positive line width.',
  });

/** One stroke style. */
export type StrokeStyle2d = z.infer<typeof StrokeStyle2dSchema>;

/** Fill styling of a 2D shape. */
export const FillStyle2dSchema = z
  .strictObject({
    color: ColorHexSchema,
  })
  .meta({
    id: 'FillStyle2d',
    title: 'FillStyle2d',
    description: 'Fill styling of a 2D shape: canonical color.',
  });

/** One fill style. */
export type FillStyle2d = z.infer<typeof FillStyle2dSchema>;

/** The typed descriptor of a `shape-2d` node. */
export const Shape2dDescriptorSchema = z
  .strictObject({
    geometry: Geometry2dSchema,
    stroke: StrokeStyle2dSchema.optional(),
    fill: FillStyle2dSchema.optional(),
    zIndex: z.number().int().optional(),
  })
  .meta({
    id: 'Shape2dDescriptor',
    title: 'Shape2dDescriptor',
    description: 'Typed descriptor of a 2D shape node: neutral geometry plus optional styling.',
  });

/** One `shape-2d` descriptor. */
export type Shape2dDescriptor = z.infer<typeof Shape2dDescriptorSchema>;

// ---------------------------------------------------------------------------
// 3D spatial presentation.
// ---------------------------------------------------------------------------

/**
 * Opaque, content-addressed mesh-asset binding. Provider-native asset
 * files are LINKED artifacts, never Epoch semantic authority
 * (architecture.md "Capability Fabric"): the binding carries the asset's
 * SHA-256 digest and optional neutral metadata, never a filename, URL, or
 * engine format enum.
 */
export const MeshBindingSchema = z
  .strictObject({
    assetDigest: Sha256HexSchema,
    byteSize: z.number().int().nonnegative().optional(),
    mediaType: z
      .string()
      .regex(/^[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}\/[A-Za-z0-9][A-Za-z0-9!#$&^_.+-]{0,126}$/)
      .optional(),
  })
  .meta({
    id: 'MeshBinding',
    title: 'MeshBinding',
    description:
      'Content-addressed mesh-asset binding: SHA-256 digest plus optional neutral metadata (no filenames, URLs, or engine formats).',
  });

/** One mesh-asset binding. */
export type MeshBinding = z.infer<typeof MeshBindingSchema>;

/** The typed descriptor of a `spatial-3d` node. */
export const Spatial3dDescriptorSchema = z
  .strictObject({
    primitive: SpatialPrimitiveSchema,
    position: Vec3Schema,
    orientation: QuaternionSchema.optional(),
    scale: z
      .tuple([z.number().positive().finite(), z.number().positive().finite(), z.number().positive().finite()])
      .optional()
      .meta({ id: 'Scale3d', title: 'Scale3d', description: 'Positive per-axis 3D scale.' }),
    mesh: MeshBindingSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.primitive === 'mesh' && value.mesh === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a "mesh" primitive requires a mesh asset binding',
        path: ['mesh'],
      });
    }
    if (value.primitive !== 'mesh' && value.mesh !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a mesh asset binding is only valid on the "mesh" primitive',
        path: ['mesh'],
      });
    }
  })
  .meta({
    id: 'Spatial3dDescriptor',
    title: 'Spatial3dDescriptor',
    description:
      'Typed descriptor of a 3D spatial node: neutral primitive, position, optional orientation/scale, optional content-addressed mesh.',
  });

/** One `spatial-3d` descriptor. */
export type Spatial3dDescriptor = z.infer<typeof Spatial3dDescriptorSchema>;

// ---------------------------------------------------------------------------
// Labels.
// ---------------------------------------------------------------------------

/** Neutral text styling of a label. */
export const TextStyleSchema = z
  .strictObject({
    color: ColorHexSchema.optional(),
    fontSizePx: z.number().int().positive().optional(),
    weight: TextWeightSchema.optional(),
  })
  .meta({
    id: 'TextStyle',
    title: 'TextStyle',
    description: 'Neutral text styling: optional color, font size, and weight.',
  });

/** One text style. */
export type TextStyle = z.infer<typeof TextStyleSchema>;

/** The typed descriptor of a `label` node (2D and 3D graphs). */
export const LabelDescriptorSchema = z
  .strictObject({
    text: z.string().min(1).max(512),
    offset2d: Point2dSchema.optional(),
    offset3d: Vec3Schema.optional(),
    style: TextStyleSchema.optional(),
  })
  .meta({
    id: 'LabelDescriptor',
    title: 'LabelDescriptor',
    description:
      'Typed descriptor of a label node: bounded text plus optional 2D/3D offset and neutral styling.',
  });

/** One `label` descriptor. */
export type LabelDescriptor = z.infer<typeof LabelDescriptorSchema>;

// ---------------------------------------------------------------------------
// Animation.
// ---------------------------------------------------------------------------

/** One animation keyframe: time, JSON value, optional segment easing. */
export const KeyframeSchema = z
  .strictObject({
    atMs: z.number().int().nonnegative(),
    value: JsonValueSchema,
    easing: EasingKindSchema.optional(),
  })
  .meta({
    id: 'Keyframe',
    title: 'Keyframe',
    description: 'One animation keyframe: millisecond offset, JSON value, optional easing.',
  });

/** One keyframe. */
export type Keyframe = z.infer<typeof KeyframeSchema>;

/**
 * One animation track: which experience node and which dotted property
 * path it animates, with strictly time-ordered keyframes.
 */
export const AnimationTrackSchema = z
  .strictObject({
    targetNodeId: ExperienceNodeIdSchema,
    propertyPath: PropertyPathSchema,
    keyframes: z.array(KeyframeSchema).min(1).max(256),
  })
  .superRefine((track, ctx) => {
    for (let i = 1; i < track.keyframes.length; i += 1) {
      if (track.keyframes[i].atMs <= track.keyframes[i - 1].atMs) {
        ctx.addIssue({
          code: 'custom',
          message: 'keyframes must be ordered by strictly increasing atMs (deterministic serialization)',
          path: ['keyframes', i],
        });
        return;
      }
    }
  })
  .meta({
    id: 'AnimationTrack',
    title: 'AnimationTrack',
    description:
      'One animation track: target node, dotted property path, and strictly time-ordered keyframes.',
  });

/** One animation track. */
export type AnimationTrack = z.infer<typeof AnimationTrackSchema>;

/** The typed descriptor of an `animation-clip` node. */
export const AnimationClipDescriptorSchema = z
  .strictObject({
    durationMs: z.number().int().positive(),
    tracks: z.array(AnimationTrackSchema).min(1).max(128),
  })
  .superRefine((clip, ctx) => {
    const keys = clip.tracks.map((t) => `${t.targetNodeId}\u0000${t.propertyPath}`);
    for (let i = 1; i < keys.length; i += 1) {
      if (keys[i] < keys[i - 1]) {
        ctx.addIssue({
          code: 'custom',
          message:
            'tracks must be sorted by (targetNodeId, propertyPath) ascending (deterministic serialization)',
          path: ['tracks'],
        });
        return;
      }
      if (keys[i] === keys[i - 1]) {
        ctx.addIssue({
          code: 'custom',
          message: 'tracks must be unique by (targetNodeId, propertyPath)',
          path: ['tracks'],
        });
        return;
      }
    }
    for (const track of clip.tracks) {
      const last = track.keyframes[track.keyframes.length - 1];
      if (last.atMs > clip.durationMs) {
        ctx.addIssue({
          code: 'custom',
          message: `keyframe at ${last.atMs}ms exceeds the clip duration (${clip.durationMs}ms)`,
          path: ['durationMs'],
        });
        return;
      }
    }
  })
  .meta({
    id: 'AnimationClipDescriptor',
    title: 'AnimationClipDescriptor',
    description:
      'Typed descriptor of an animation clip: positive duration plus sorted, unique, in-range tracks.',
  });

/** One `animation-clip` descriptor. */
export type AnimationClipDescriptor = z.infer<typeof AnimationClipDescriptorSchema>;

// ---------------------------------------------------------------------------
// Narrative.
// ---------------------------------------------------------------------------

/** The typed descriptor of a `narrative-beat` node. */
export const NarrativeBeatDescriptorSchema = z
  .strictObject({
    title: z.string().min(1).max(256),
    body: z.string().max(4096).optional(),
    tone: NarrativeToneSchema.optional(),
  })
  .meta({
    id: 'NarrativeBeatDescriptor',
    title: 'NarrativeBeatDescriptor',
    description:
      'Typed descriptor of a narrative beat: bounded title, optional body, optional presentation tone.',
  });

/** One `narrative-beat` descriptor. */
export type NarrativeBeatDescriptor = z.infer<typeof NarrativeBeatDescriptorSchema>;

// ---------------------------------------------------------------------------
// Timeline / replay.
// ---------------------------------------------------------------------------

/** The typed descriptor of a `timeline-track` node. */
export const TimelineTrackDescriptorSchema = z
  .strictObject({
    label: z.string().min(1).max(256),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
  })
  .superRefine((track, ctx) => {
    if (track.endMs <= track.startMs) {
      ctx.addIssue({
        code: 'custom',
        message: 'endMs must be greater than startMs',
        path: ['endMs'],
      });
    }
  })
  .meta({
    id: 'TimelineTrackDescriptor',
    title: 'TimelineTrackDescriptor',
    description: 'Typed descriptor of a timeline track: bounded label plus a positive time range.',
  });

/** One `timeline-track` descriptor. */
export type TimelineTrackDescriptor = z.infer<typeof TimelineTrackDescriptorSchema>;

/** The typed descriptor of a `timeline-marker` node. */
export const TimelineMarkerDescriptorSchema = z
  .strictObject({
    atMs: z.number().int().nonnegative(),
    label: z.string().max(256).optional(),
    markerKind: TimelineMarkerKindSchema,
  })
  .meta({
    id: 'TimelineMarkerDescriptor',
    title: 'TimelineMarkerDescriptor',
    description:
      'Typed descriptor of a timeline marker: time, optional label, and kind (event, phase boundary, replay cursor, branch point).',
  });

/** One `timeline-marker` descriptor. */
export type TimelineMarkerDescriptor = z.infer<typeof TimelineMarkerDescriptorSchema>;

// ---------------------------------------------------------------------------
// Presence.
// ---------------------------------------------------------------------------

/**
 * A presence participant, referenced opaquely: bounded opaque id plus
 * neutral kind. Human/agent identity semantics are owned by the identity
 * and tenancy subsystem (W009); the experience layer never interprets them.
 */
export const ParticipantReferenceSchema = z
  .strictObject({
    participantId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
    participantKind: ParticipantKindSchema,
  })
  .meta({
    id: 'ParticipantReference',
    title: 'ParticipantReference',
    description: 'Opaque presence-participant reference: bounded id plus neutral kind.',
  });

/** One participant reference. */
export type ParticipantReference = z.infer<typeof ParticipantReferenceSchema>;

/** The typed descriptor of a `presence-seat` node. */
export const PresenceSeatDescriptorSchema = z
  .strictObject({
    participant: ParticipantReferenceSchema,
  })
  .meta({
    id: 'PresenceSeatDescriptor',
    title: 'PresenceSeatDescriptor',
    description: 'Typed descriptor of a presence seat: the participant occupying it.',
  });

/** One `presence-seat` descriptor. */
export type PresenceSeatDescriptor = z.infer<typeof PresenceSeatDescriptorSchema>;

/** The typed descriptor of a `presence-cursor` node. */
export const PresenceCursorDescriptorSchema = z
  .strictObject({
    participant: ParticipantReferenceSchema,
    position2d: Point2dSchema.optional(),
    position3d: Vec3Schema.optional(),
    atMs: z.number().int().nonnegative().optional(),
  })
  .superRefine((cursor, ctx) => {
    if (cursor.position2d === undefined && cursor.position3d === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a presence cursor must carry position2d or position3d',
        path: [],
      });
    }
  })
  .meta({
    id: 'PresenceCursorDescriptor',
    title: 'PresenceCursorDescriptor',
    description:
      'Typed descriptor of a presence cursor: participant plus a 2D or 3D position and optional timestamp.',
  });

/** One `presence-cursor` descriptor. */
export type PresenceCursorDescriptor = z.infer<typeof PresenceCursorDescriptorSchema>;

// ---------------------------------------------------------------------------
// Controls.
// ---------------------------------------------------------------------------

/**
 * The typed UI intent a control emits (R30): a dot-namespaced qualified
 * id plus semver core version — STRUCTURALLY IDENTICAL to the
 * action-protocol `ActionTypeReference` so the future control-to-proposal
 * wiring (through the Action Gateway, lock rule 3) needs no translation
 * layer. Pinned by the kernel parity test (test/kernel-parity.test.ts).
 */
export const ControlIntentSchema = z
  .strictObject({
    id: z.string().regex(QUALIFIED_NAME_PATTERN),
    version: z.string().regex(SEMVER_CORE_PATTERN),
  })
  .meta({
    id: 'ControlIntent',
    title: 'ControlIntent',
    description:
      'Typed UI intent a control emits: qualified id plus semver core (shape-compatible with the action-protocol ActionTypeReference).',
  });

/** One control intent. */
export type ControlIntent = z.infer<typeof ControlIntentSchema>;

/** The typed descriptor of a `control` node. */
export const ControlDescriptorSchema = z
  .strictObject({
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
  })
  .superRefine((control, ctx) => {
    if (control.controlKind === 'selector' && control.options === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a "selector" control requires sorted, non-empty options',
        path: ['options'],
      });
    }
    if (control.controlKind !== 'selector' && control.options !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'options are only valid on the "selector" control kind',
        path: ['options'],
      });
    }
  })
  .meta({
    id: 'ControlDescriptor',
    title: 'ControlDescriptor',
    description:
      'Typed descriptor of an interaction control: neutral control role, emitted typed intent, optional label and selector options.',
  });

/** One `control` descriptor. */
export type ControlDescriptor = z.infer<typeof ControlDescriptorSchema>;
