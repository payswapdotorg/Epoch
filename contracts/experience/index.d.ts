/**
 * Epoch Experience Protocol v1 — published contract declarations.
 *
 * This file is the versioned TypeScript declaration surface at the
 * `contracts/experience` ownership boundary (Work Order W011). It is
 * self-contained: no imports, no runtime code, no vendor/engine/framework
 * vocabulary. The runtime implementation lives in
 * `@epoch/experience-protocol` (experience layer); `parity.ts` in this
 * directory proves at compile time that the implementation's zod-inferred
 * types are identical to these declarations.
 *
 * Contract version: 1.0.0 (see manifest.json)
 * Protocol version: 1.0.0 (carried by every document as `protocolVersion`)
 *
 * Authority (architecture lock rule 8): the Experience Graph is a READ
 * PROJECTION of kernel state — never a second source of truth. Kernel
 * objects are referenced opaquely (tenant-scoped, exact-revision digests),
 * never embedded; presentation attributes carrying kernel-reserved keys
 * are rejected at admission (`authority-violation`).
 */

// ---------------------------------------------------------------------------
// Versions and closed vocabularies.
// ---------------------------------------------------------------------------

/** Exact experience-protocol version admitted by contract version 1.0.0. */
export type ExperienceProtocolVersion = '1.0.0';

/** Presentation projection of an Experience Graph. */
export type ExperienceGraphKind =
  | '2d'
  | '3d'
  | 'animation'
  | 'narrative'
  | 'timeline-replay'
  | 'presence'
  | 'controls';

/** Typed presentation-descriptor kind of an Experience Graph node. */
export type ExperienceNodeKind =
  | 'shape-2d'
  | 'spatial-3d'
  | 'label'
  | 'animation-clip'
  | 'narrative-beat'
  | 'timeline-track'
  | 'timeline-marker'
  | 'presence-seat'
  | 'presence-cursor'
  | 'control';

/** Typed relationship kind between two Experience Graph nodes. */
export type ExperienceEdgeKind =
  | 'anchors'
  | 'animates'
  | 'binds-control'
  | 'contains'
  | 'follows'
  | 'synchronizes';

/** Typed admission-error code of the experience protocol. */
export type ExperienceErrorCode =
  | 'version-unsupported'
  | 'malformed-descriptor'
  | 'digest-mismatch'
  | 'cross-tenant-denied'
  | 'unknown-reference'
  | 'authority-violation';

/** Which kernel subsystem a projected reference addresses. */
export type ProjectedReferenceKind =
  | 'world-entity'
  | 'world-relation'
  | 'world-event'
  | 'agent'
  | 'evidence-record'
  | 'capability';

// ---------------------------------------------------------------------------
// Neutral primitives (self-contained mirrors of the shared shapes).
// ---------------------------------------------------------------------------

/** JSON-representable value (finite numbers only). */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Lowercase hexadecimal SHA-256 digest (exactly 64 characters). */
export type Sha256Hex = string;

/** Experience-local node identifier: "xn-" + lowercase slug. */
export type ExperienceNodeId = string;

/** Experience-graph identifier: "xg-" + lowercase slug. */
export type ExperienceGraphId = string;

/** Opaque scoping identifier (tenant/workspace/project/participant). */
export type OpaqueScopeId = string;

/**
 * Tenant scoping of an experience document: owning tenant, optional
 * workspace and project narrowing (R12).
 */
export type TenantScope = {
  tenantId: OpaqueScopeId;
  workspaceId?: OpaqueScopeId | undefined;
  projectId?: OpaqueScopeId | undefined;
};

/** Presentation color: "#RRGGBB" or "#RRGGBBAA" lowercase hex. */
export type ColorHex = string;

/** Finite 3-component numeric vector (x, y, z). */
export type Vec3 = [number, number, number];

/** Finite orientation quaternion (x, y, z, w). */
export type Quaternion = [number, number, number, number];

/** Dotted path naming the animated property of a target node descriptor. */
export type PropertyPath = string;

/**
 * Presentation-only open attribute record attached to nodes and edges.
 * Kernel-reserved keys are rejected at admission (`authority-violation`).
 */
export type PresentationAttributes = Record<string, JsonValue>;

// ---------------------------------------------------------------------------
// Projected kernel references (projection, never authority).
// ---------------------------------------------------------------------------

/** Exact-revision reference to a materialized world-model entity (W002). */
export type ProjectedWorldEntityRef = {
  kind: 'world-entity';
  tenantId: OpaqueScopeId;
  entityId: string;
  contentDigest: Sha256Hex;
};

/** Exact-revision reference to a materialized world-model relation (W002). */
export type ProjectedWorldRelationRef = {
  kind: 'world-relation';
  tenantId: OpaqueScopeId;
  relationId: string;
  contentDigest: Sha256Hex;
};

/** Exact-revision reference to a world-model event (W002). */
export type ProjectedWorldEventRef = {
  kind: 'world-event';
  tenantId: OpaqueScopeId;
  eventId: string;
  contentDigest: Sha256Hex;
};

/** Exact-revision reference to a registered agent (W003). */
export type ProjectedAgentRef = {
  kind: 'agent';
  tenantId: OpaqueScopeId;
  agentId: string;
  contentDigest: Sha256Hex;
};

/** Reference to an evidence record by its content-addressed identity (W006). */
export type ProjectedEvidenceRef = {
  kind: 'evidence-record';
  tenantId: OpaqueScopeId;
  recordDigest: Sha256Hex;
};

/** Exact-revision reference to a registered capability manifest (W007). */
export type ProjectedCapabilityRef = {
  kind: 'capability';
  tenantId: OpaqueScopeId;
  capabilityId: string;
  capabilityVersion: string;
  contentDigest: Sha256Hex;
};

/**
 * A projected reference to kernel state: opaque, tenant-scoped, and bound
 * to the exact revision via the SHA-256 digest of the referenced object's
 * canonical JSON. Never an embedded kernel object.
 */
export type ProjectedReference =
  | ProjectedWorldEntityRef
  | ProjectedWorldRelationRef
  | ProjectedWorldEventRef
  | ProjectedAgentRef
  | ProjectedEvidenceRef
  | ProjectedCapabilityRef;

// ---------------------------------------------------------------------------
// The abstract device-descriptor slot (W019 fills it).
// ---------------------------------------------------------------------------

/** Neutral device class (never a vendor product). */
export type DeviceClass =
  | 'desktop'
  | 'laptop'
  | 'tablet'
  | 'phone'
  | 'headset'
  | 'wall-display';

/** Neutral interaction modality of a device. */
export type InteractionModality =
  | 'gamepad'
  | 'gaze'
  | 'gesture'
  | 'keyboard'
  | 'pointer'
  | 'touch'
  | 'voice';

/** Neutral pose-tracking capability of a device. */
export type PoseTrackingKind = 'none' | '3dof' | '6dof';

/** Neutral display capabilities and budgets. */
export type DeviceDisplayCapabilities = {
  stereoscopic: boolean;
  maxPixels?: number | undefined;
  refreshHz?: number | undefined;
  colorDepthBits?: number | undefined;
};

/** Neutral spatial capabilities and budgets. */
export type DeviceSpatialCapabilities = {
  poseTracking: PoseTrackingKind;
  worldAnchored: boolean;
  maxTriangles?: number | undefined;
  maxTextureBytes?: number | undefined;
};

/**
 * The abstract, provider-neutral device descriptor: capabilities and
 * budgets as typed data. Filled and adapted by renderer/device adaptation
 * (W019); zero concrete renderers and zero engine vocabulary here.
 */
export type DeviceDescriptor = {
  descriptorVersion: 1;
  deviceClass: DeviceClass;
  interaction: InteractionModality[];
  display: DeviceDisplayCapabilities;
  spatial: DeviceSpatialCapabilities;
  latencyBudgetMs?: number | undefined;
};

// ---------------------------------------------------------------------------
// Typed presentation descriptors.
// ---------------------------------------------------------------------------

/** Finite 2D point. */
export type Point2d = {
  x: number;
  y: number;
};

/** Neutral 2D geometry (discriminated on `form`). */
export type Geometry2d =
  | { form: 'point'; x: number; y: number }
  | { form: 'rect'; x: number; y: number; width: number; height: number }
  | { form: 'circle'; cx: number; cy: number; r: number }
  | { form: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { form: 'polyline'; points: Point2d[] }
  | { form: 'polygon'; points: Point2d[] };

/** Stroke styling of a 2D shape. */
export type StrokeStyle2d = {
  color: ColorHex;
  lineWidth: number;
};

/** Fill styling of a 2D shape. */
export type FillStyle2d = {
  color: ColorHex;
};

/** Typed descriptor of a `shape-2d` node. */
export type Shape2dDescriptor = {
  geometry: Geometry2d;
  stroke?: StrokeStyle2d | undefined;
  fill?: FillStyle2d | undefined;
  zIndex?: number | undefined;
};

/**
 * Content-addressed mesh-asset binding: SHA-256 digest plus optional
 * neutral metadata. Provider-native asset files are linked artifacts,
 * never Epoch semantic authority.
 */
export type MeshBinding = {
  assetDigest: Sha256Hex;
  byteSize?: number | undefined;
  mediaType?: string | undefined;
};

/** Neutral 3D geometric primitive. */
export type SpatialPrimitive = 'box' | 'cone' | 'cylinder' | 'mesh' | 'plane' | 'sphere';

/** Typed descriptor of a `spatial-3d` node. */
export type Spatial3dDescriptor = {
  primitive: SpatialPrimitive;
  position: Vec3;
  orientation?: Quaternion | undefined;
  scale?: [number, number, number] | undefined;
  mesh?: MeshBinding | undefined;
};

/** Neutral text weight of a label style. */
export type TextWeight = 'bold' | 'light' | 'medium' | 'regular';

/** Neutral text styling of a label. */
export type TextStyle = {
  color?: ColorHex | undefined;
  fontSizePx?: number | undefined;
  weight?: TextWeight | undefined;
};

/** Typed descriptor of a `label` node. */
export type LabelDescriptor = {
  text: string;
  offset2d?: Point2d | undefined;
  offset3d?: Vec3 | undefined;
  style?: TextStyle | undefined;
};

/** Neutral interpolation of one animation keyframe segment. */
export type EasingKind = 'ease-in' | 'ease-in-out' | 'ease-out' | 'linear' | 'step';

/** One animation keyframe. */
export type Keyframe = {
  atMs: number;
  value: JsonValue;
  easing?: EasingKind | undefined;
};

/** One animation track (keyframes strictly time-ordered). */
export type AnimationTrack = {
  targetNodeId: ExperienceNodeId;
  propertyPath: PropertyPath;
  keyframes: Keyframe[];
};

/** Typed descriptor of an `animation-clip` node. */
export type AnimationClipDescriptor = {
  durationMs: number;
  tracks: AnimationTrack[];
};

/** Presentation tone of a narrative beat. */
export type NarrativeTone = 'cautionary' | 'celebratory' | 'informative' | 'neutral';

/** Typed descriptor of a `narrative-beat` node. */
export type NarrativeBeatDescriptor = {
  title: string;
  body?: string | undefined;
  tone?: NarrativeTone | undefined;
};

/** Kind of a timeline marker. */
export type TimelineMarkerKind =
  | 'branch-point'
  | 'event'
  | 'phase-end'
  | 'phase-start'
  | 'replay-cursor';

/** Typed descriptor of a `timeline-track` node. */
export type TimelineTrackDescriptor = {
  label: string;
  startMs: number;
  endMs: number;
};

/** Typed descriptor of a `timeline-marker` node. */
export type TimelineMarkerDescriptor = {
  atMs: number;
  label?: string | undefined;
  markerKind: TimelineMarkerKind;
};

/** Neutral presence-participant kind. */
export type ParticipantKind = 'agent' | 'human' | 'system';

/** Opaque presence-participant reference. */
export type ParticipantReference = {
  participantId: string;
  participantKind: ParticipantKind;
};

/** Typed descriptor of a `presence-seat` node. */
export type PresenceSeatDescriptor = {
  participant: ParticipantReference;
};

/** Typed descriptor of a `presence-cursor` node. */
export type PresenceCursorDescriptor = {
  participant: ParticipantReference;
  position2d?: Point2d | undefined;
  position3d?: Vec3 | undefined;
  atMs?: number | undefined;
};

/** Neutral interaction-control role. */
export type ControlKind = 'axis' | 'button' | 'selector' | 'toggle';

/**
 * The typed UI intent a control emits (R30): qualified id plus semver
 * core — structurally identical to the action-protocol
 * `ActionTypeReference` (W003 parity).
 */
export type ControlIntent = {
  id: string;
  version: string;
};

/** Typed descriptor of a `control` node. */
export type ControlDescriptor = {
  controlKind: ControlKind;
  intent: ControlIntent;
  label?: string | undefined;
  options?: string[] | undefined;
};

// ---------------------------------------------------------------------------
// The Experience Graph.
// ---------------------------------------------------------------------------

/**
 * One Experience Graph node: experience-local id, typed kind, optional
 * projected kernel reference, typed presentation descriptor, and optional
 * presentation attributes (discriminated on `kind`).
 */
export type ExperienceNode =
  | {
      id: ExperienceNodeId;
      kind: 'shape-2d';
      ref?: ProjectedReference | undefined;
      descriptor: Shape2dDescriptor;
      attributes?: PresentationAttributes | undefined;
    }
  | {
      id: ExperienceNodeId;
      kind: 'spatial-3d';
      ref?: ProjectedReference | undefined;
      descriptor: Spatial3dDescriptor;
      attributes?: PresentationAttributes | undefined;
    }
  | {
      id: ExperienceNodeId;
      kind: 'label';
      ref?: ProjectedReference | undefined;
      descriptor: LabelDescriptor;
      attributes?: PresentationAttributes | undefined;
    }
  | {
      id: ExperienceNodeId;
      kind: 'animation-clip';
      ref?: ProjectedReference | undefined;
      descriptor: AnimationClipDescriptor;
      attributes?: PresentationAttributes | undefined;
    }
  | {
      id: ExperienceNodeId;
      kind: 'narrative-beat';
      ref?: ProjectedReference | undefined;
      descriptor: NarrativeBeatDescriptor;
      attributes?: PresentationAttributes | undefined;
    }
  | {
      id: ExperienceNodeId;
      kind: 'timeline-track';
      ref?: ProjectedReference | undefined;
      descriptor: TimelineTrackDescriptor;
      attributes?: PresentationAttributes | undefined;
    }
  | {
      id: ExperienceNodeId;
      kind: 'timeline-marker';
      ref?: ProjectedReference | undefined;
      descriptor: TimelineMarkerDescriptor;
      attributes?: PresentationAttributes | undefined;
    }
  | {
      id: ExperienceNodeId;
      kind: 'presence-seat';
      ref?: ProjectedReference | undefined;
      descriptor: PresenceSeatDescriptor;
      attributes?: PresentationAttributes | undefined;
    }
  | {
      id: ExperienceNodeId;
      kind: 'presence-cursor';
      ref?: ProjectedReference | undefined;
      descriptor: PresenceCursorDescriptor;
      attributes?: PresentationAttributes | undefined;
    }
  | {
      id: ExperienceNodeId;
      kind: 'control';
      ref?: ProjectedReference | undefined;
      descriptor: ControlDescriptor;
      attributes?: PresentationAttributes | undefined;
    };

/** One Experience Graph edge: typed kind plus ordered endpoint node ids. */
export type ExperienceEdge = {
  kind: ExperienceEdgeKind;
  from: ExperienceNodeId;
  to: ExperienceNodeId;
  attributes?: PresentationAttributes | undefined;
};

/**
 * The content of an Experience Graph envelope: discriminator, version,
 * tenant scope, projected kernel inputs (sorted, duplicate-free), nodes
 * (sorted by id, unique), edges (sorted by (from, to, kind), unique), and
 * the device slot.
 */
export type ExperienceGraphContent = {
  schema: 'epoch.experience-graph';
  protocolVersion: ExperienceProtocolVersion;
  graphId: ExperienceGraphId;
  graphKind: ExperienceGraphKind;
  tenantScope: TenantScope;
  projectedFrom: ProjectedReference[];
  nodes: ExperienceNode[];
  edges: ExperienceEdge[];
  device: DeviceDescriptor;
};

/**
 * The sealed Experience Graph envelope: content plus its SHA-256 digest
 * over the canonical JSON of the content (digest field excluded). The
 * digest addresses the exact revision of the graph.
 */
export type ExperienceGraph = {
  schema: 'epoch.experience-graph';
  protocolVersion: ExperienceProtocolVersion;
  graphId: ExperienceGraphId;
  graphKind: ExperienceGraphKind;
  tenantScope: TenantScope;
  projectedFrom: ProjectedReference[];
  nodes: ExperienceNode[];
  edges: ExperienceEdge[];
  device: DeviceDescriptor;
  digest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// Projection requests.
// ---------------------------------------------------------------------------

/**
 * Bounded world-model event-sequence window for timeline/replay
 * projections (from inclusive, to exclusive).
 */
export type ReplayWindow = {
  fromSequence: number;
  toSequence: number;
};

/**
 * A tenant-scoped projection request: which kernel state (opaque
 * exact-revision references, sorted and duplicate-free), which graph kind,
 * which device.
 */
export type ProjectionRequest = {
  schema: 'epoch.experience-projection-request';
  protocolVersion: ExperienceProtocolVersion;
  requestId: string;
  requestedAt: string;
  tenantScope: TenantScope;
  graphKind: ExperienceGraphKind;
  references: ProjectedReference[];
  replayWindow?: ReplayWindow | undefined;
  device: DeviceDescriptor;
};

// ---------------------------------------------------------------------------
// Typed admission errors.
// ---------------------------------------------------------------------------

/** One flattened validation issue (dotted path; "$" = root). */
export type ExperienceIssue = {
  path: string;
  message: string;
};

/**
 * The typed admission error (discriminated on `code`).
 */
export type ExperienceProtocolError =
  | {
      code: 'version-unsupported';
      message: string;
      expected: string;
      encountered: string;
    }
  | {
      code: 'malformed-descriptor';
      message: string;
      issues: ExperienceIssue[];
    }
  | {
      code: 'digest-mismatch';
      message: string;
      path: (string | number)[];
      expected: string;
      encountered: string;
    }
  | {
      code: 'cross-tenant-denied';
      message: string;
      path: (string | number)[];
      expectedTenantId: string;
      encounteredTenantId: string;
    }
  | {
      code: 'unknown-reference';
      message: string;
      path: (string | number)[];
      reference: string;
    }
  | {
      code: 'authority-violation';
      message: string;
      violations: { path: string; key: string }[];
    };
