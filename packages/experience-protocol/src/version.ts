/**
 * @epoch/experience-protocol — contract versions and closed vocabularies.
 *
 * Versioning policy (v1, mirrors the agent-protocol discipline): a
 * serialized experience document is admitted only when its
 * `protocolVersion` equals {@link EXPERIENCE_PROTOCOL_VERSION} exactly;
 * skew surfaces as a typed `version-unsupported` admission error (checked
 * before any schema validation, so version skew is always distinguishable
 * from malformed payloads). {@link EXPERIENCE_CONTRACT_VERSION} versions
 * the published contract surface at `contracts/experience`.
 *
 * Provider neutrality (architecture lock rule 13): every vocabulary below
 * names a ROLE, SURFACE, or BOUNDARY — never a vendor, engine, renderer,
 * framework, or API. The Experience Graph is a read projection of kernel
 * state (lock rule 8); the device slot is an abstract typed descriptor that
 * W019 (Renderer/Device Adaptation) fills — zero concrete renderers and
 * zero engine shapes ship here.
 */
import { z } from 'zod';

/** Version of the published experience contract surface (contracts/experience). */
export const EXPERIENCE_CONTRACT_VERSION = '1.0.0' as const;

/** Protocol version carried by every serialized experience document. */
export const EXPERIENCE_PROTOCOL_VERSION = '1.0.0' as const;

/** The protocol version literal type. */
export type ExperienceProtocolVersion = typeof EXPERIENCE_PROTOCOL_VERSION;

export const ExperienceProtocolVersionSchema = z
  .literal(EXPERIENCE_PROTOCOL_VERSION)
  .meta({
    id: 'ExperienceProtocolVersion',
    title: 'ExperienceProtocolVersion',
    description: 'Exact experience-protocol version admitted by this release ("1.0.0").',
  });

/** Schema-name discriminator carried by every Experience Graph envelope. */
export const EXPERIENCE_GRAPH_SCHEMA_NAME = 'epoch.experience-graph' as const;

/** Schema-name discriminator carried by every projection request. */
export const EXPERIENCE_PROJECTION_REQUEST_SCHEMA_NAME =
  'epoch.experience-projection-request' as const;

/**
 * The document kinds of experience protocol v1 (manifest inventory; each
 * kind is a distinct serialized document with its own schema discriminator).
 */
export const EXPERIENCE_DOCUMENT_KINDS = [
  'experience.projection-request',
  'experience.graph',
] as const;

/** One experience document kind. */
export type ExperienceDocumentKind = (typeof EXPERIENCE_DOCUMENT_KINDS)[number];

/**
 * The Experience Graph kinds (architecture.md "Experience Runtime" —
 * binding): one graph kind per presentation projection. `timeline-replay`
 * covers timeline and replay/branch presentations (requirement R7).
 */
export const EXPERIENCE_GRAPH_KINDS = [
  '2d',
  '3d',
  'animation',
  'narrative',
  'timeline-replay',
  'presence',
  'controls',
] as const;

/** One Experience Graph kind. */
export type ExperienceGraphKind = (typeof EXPERIENCE_GRAPH_KINDS)[number];

export const ExperienceGraphKindSchema = z.enum(EXPERIENCE_GRAPH_KINDS).meta({
  id: 'ExperienceGraphKind',
  title: 'ExperienceGraphKind',
  description:
    'Presentation projection of an Experience Graph: 2D, 3D, animation, narrative, timeline/replay, presence, or controls.',
});

/**
 * The node kinds of the Experience Graph — typed presentation descriptors.
 * Each kind carries its own strict descriptor record (src/descriptors.ts);
 * every field is presentation-oriented, provider-neutral data.
 */
export const EXPERIENCE_NODE_KINDS = [
  'shape-2d',
  'spatial-3d',
  'label',
  'animation-clip',
  'narrative-beat',
  'timeline-track',
  'timeline-marker',
  'presence-seat',
  'presence-cursor',
  'control',
] as const;

/** One Experience Graph node kind. */
export type ExperienceNodeKind = (typeof EXPERIENCE_NODE_KINDS)[number];

export const ExperienceNodeKindSchema = z.enum(EXPERIENCE_NODE_KINDS).meta({
  id: 'ExperienceNodeKind',
  title: 'ExperienceNodeKind',
  description: 'Typed presentation-descriptor kind of an Experience Graph node.',
});

/**
 * The edge kinds of the Experience Graph — typed relationships between
 * experience nodes (never between kernel entities: kernel relationships are
 * world-model relations, referenced opaquely).
 */
export const EXPERIENCE_EDGE_KINDS = [
  'anchors',
  'animates',
  'binds-control',
  'contains',
  'follows',
  'synchronizes',
] as const;

/** One Experience Graph edge kind. */
export type ExperienceEdgeKind = (typeof EXPERIENCE_EDGE_KINDS)[number];

export const ExperienceEdgeKindSchema = z.enum(EXPERIENCE_EDGE_KINDS).meta({
  id: 'ExperienceEdgeKind',
  title: 'ExperienceEdgeKind',
  description: 'Typed relationship kind between two Experience Graph nodes.',
});

/**
 * Which node kinds are legal within each graph kind. A node of a kind
 * outside its graph kind's table is a malformed descriptor — the tables pin
 * the projection vocabulary so a graph kind cannot silently grow foreign
 * node kinds.
 */
export const GRAPH_KIND_NODE_KINDS: Readonly<Record<ExperienceGraphKind, readonly ExperienceNodeKind[]>> =
  {
    '2d': ['label', 'shape-2d'],
    '3d': ['label', 'spatial-3d'],
    // An animation graph is a scene-with-clips projection: it carries the
    // animatable 2D/3D nodes plus the clips that animate them.
    animation: ['animation-clip', 'shape-2d', 'spatial-3d'],
    narrative: ['narrative-beat'],
    'timeline-replay': ['timeline-marker', 'timeline-track'],
    presence: ['presence-cursor', 'presence-seat'],
    controls: ['control'],
  };

/**
 * The typed admission-error taxonomy of the experience protocol. Every
 * admission failure is one of these codes (never a bare throw):
 * - `version-unsupported` — protocolVersion skew, checked first;
 * - `malformed-descriptor` — schema violations with precise dotted paths
 *   (strict objects also reject unknown/vendor fields here);
 * - `digest-mismatch` — a sealed envelope whose claimed SHA-256 digest does
 *   not match its content (tamper detection);
 * - `cross-tenant-denied` — a reference or scope outside the tenant that
 *   owns the projection (R12);
 * - `unknown-reference` — a reference to a kernel object outside the
 *   projection inputs, or to an experience node that does not exist;
 * - `authority-violation` — kernel semantic vocabulary smuggled into a
 *   presentation attribute record (inline world state instead of opaque
 *   references — lock rule 8).
 */
export const EXPERIENCE_PROTOCOL_ERROR_CODES = [
  'version-unsupported',
  'malformed-descriptor',
  'digest-mismatch',
  'cross-tenant-denied',
  'unknown-reference',
  'authority-violation',
] as const;

/** One typed admission-error code. */
export type ExperienceErrorCode = (typeof EXPERIENCE_PROTOCOL_ERROR_CODES)[number];

export const ExperienceErrorCodeSchema = z.enum(EXPERIENCE_PROTOCOL_ERROR_CODES).meta({
  id: 'ExperienceErrorCode',
  title: 'ExperienceErrorCode',
  description: 'Typed admission-error code of the experience protocol.',
});

/**
 * The projected-reference kinds: which kernel state an experience document
 * references. `world-entity`/`world-relation`/`world-event` bind to the
 * canonical World Model (W002) id grammars; `agent` binds to the agent
 * protocol (W003) registration identity; `evidence-record` binds to the
 * content-addressed evidence chain (W006); `capability` binds to the
 * capability registry (W007) manifest identity.
 */
export const PROJECTED_REFERENCE_KINDS = [
  'world-entity',
  'world-relation',
  'world-event',
  'agent',
  'evidence-record',
  'capability',
] as const;

/** One projected-reference kind. */
export type ProjectedReferenceKind = (typeof PROJECTED_REFERENCE_KINDS)[number];

export const ProjectedReferenceKindSchema = z.enum(PROJECTED_REFERENCE_KINDS).meta({
  id: 'ProjectedReferenceKind',
  title: 'ProjectedReferenceKind',
  description: 'Which kernel subsystem a projected reference addresses.',
});

/** Version discriminator of the abstract device descriptor. */
export const DEVICE_DESCRIPTOR_VERSION = 1 as const;

/** Neutral device classes the descriptor slot can declare (R29). */
export const DEVICE_CLASSES = [
  'desktop',
  'laptop',
  'tablet',
  'phone',
  'headset',
  'wall-display',
] as const;

/** One neutral device class. */
export type DeviceClass = (typeof DEVICE_CLASSES)[number];

export const DeviceClassSchema = z.enum(DEVICE_CLASSES).meta({
  id: 'DeviceClass',
  title: 'DeviceClass',
  description: 'Neutral device class of a device descriptor (never a vendor product).',
});

/** Neutral interaction modalities a device supports (sorted; canonical order). */
export const INTERACTION_MODALITIES = [
  'gamepad',
  'gaze',
  'gesture',
  'keyboard',
  'pointer',
  'touch',
  'voice',
] as const;

/** One interaction modality. */
export type InteractionModality = (typeof INTERACTION_MODALITIES)[number];

export const InteractionModalitySchema = z.enum(INTERACTION_MODALITIES).meta({
  id: 'InteractionModality',
  title: 'InteractionModality',
  description: 'Neutral interaction modality of a device.',
});

/** Neutral pose-tracking classes (degrees of freedom, not vendor tracking stacks). */
export const POSE_TRACKING_KINDS = ['none', '3dof', '6dof'] as const;

/** One pose-tracking class. */
export type PoseTrackingKind = (typeof POSE_TRACKING_KINDS)[number];

export const PoseTrackingKindSchema = z.enum(POSE_TRACKING_KINDS).meta({
  id: 'PoseTrackingKind',
  title: 'PoseTrackingKind',
  description: 'Neutral pose-tracking capability of a device.',
});

/** Neutral 3D geometric primitives (mathematical, never engine meshes). */
export const SPATIAL_PRIMITIVES = ['box', 'cone', 'cylinder', 'mesh', 'plane', 'sphere'] as const;

/** One neutral 3D primitive. */
export type SpatialPrimitive = (typeof SPATIAL_PRIMITIVES)[number];

export const SpatialPrimitiveSchema = z.enum(SPATIAL_PRIMITIVES).meta({
  id: 'SpatialPrimitive',
  title: 'SpatialPrimitive',
  description: 'Neutral geometric primitive of a 3D node (mesh binds an opaque content-addressed asset).',
});

/** Neutral control kinds (interaction ROLES, not widgets or frameworks). */
export const CONTROL_KINDS = ['axis', 'button', 'selector', 'toggle'] as const;

/** One control kind. */
export type ControlKind = (typeof CONTROL_KINDS)[number];

export const ControlKindSchema = z.enum(CONTROL_KINDS).meta({
  id: 'ControlKind',
  title: 'ControlKind',
  description: 'Neutral interaction-control role of a controls-graph node.',
});

/** Neutral participant kinds of presence (R27 — shared human/agent interactions). */
export const PARTICIPANT_KINDS = ['agent', 'human', 'system'] as const;

/** One participant kind. */
export type ParticipantKind = (typeof PARTICIPANT_KINDS)[number];

export const ParticipantKindSchema = z.enum(PARTICIPANT_KINDS).meta({
  id: 'ParticipantKind',
  title: 'ParticipantKind',
  description: 'Neutral presence-participant kind.',
});

/** Neutral animation easing vocabulary (mathematical names only). */
export const EASING_KINDS = ['ease-in', 'ease-in-out', 'ease-out', 'linear', 'step'] as const;

/** One easing kind. */
export type EasingKind = (typeof EASING_KINDS)[number];

export const EasingKindSchema = z.enum(EASING_KINDS).meta({
  id: 'EasingKind',
  title: 'EasingKind',
  description: 'Neutral interpolation of one animation keyframe segment.',
});

/**
 * Timeline-marker kinds. `replay-cursor` and `branch-point` carry the
 * replay/branch vocabulary (R7); `event`/`phase-start`/`phase-end` carry
 * the general timeline vocabulary.
 */
export const TIMELINE_MARKER_KINDS = [
  'branch-point',
  'event',
  'phase-end',
  'phase-start',
  'replay-cursor',
] as const;

/** One timeline-marker kind. */
export type TimelineMarkerKind = (typeof TIMELINE_MARKER_KINDS)[number];

export const TimelineMarkerKindSchema = z.enum(TIMELINE_MARKER_KINDS).meta({
  id: 'TimelineMarkerKind',
  title: 'TimelineMarkerKind',
  description: 'Kind of a timeline marker (event, phase boundary, replay cursor, branch point).',
});

/**
 * The narrative tone vocabulary (presentation nuance of a beat; judgment
 * itself is evaluation territory — lock rule 6).
 */
export const NARRATIVE_TONES = ['cautionary', 'celebratory', 'informative', 'neutral'] as const;

/** One narrative tone. */
export type NarrativeTone = (typeof NARRATIVE_TONES)[number];

export const NarrativeToneSchema = z.enum(NARRATIVE_TONES).meta({
  id: 'NarrativeTone',
  title: 'NarrativeTone',
  description: 'Presentation tone of a narrative beat.',
});

/** Text weight vocabulary of label styling. */
export const TEXT_WEIGHTS = ['bold', 'light', 'medium', 'regular'] as const;

/** One text weight. */
export type TextWeight = (typeof TEXT_WEIGHTS)[number];

export const TextWeightSchema = z.enum(TEXT_WEIGHTS).meta({
  id: 'TextWeight',
  title: 'TextWeight',
  description: 'Neutral text weight of a label style.',
});
