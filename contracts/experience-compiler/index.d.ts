/**
 * Epoch Experience Compiler v1 — published contract declarations.
 *
 * This file is the versioned TypeScript declaration surface at the
 * `contracts/experience-compiler` ownership boundary (Work Order W012).
 * It is self-contained: no imports, no runtime code, no vendor/engine/
 * framework vocabulary. The runtime implementation lives in
 * `@epoch/experience-compiler` (experience layer); `parity.ts` in this
 * directory proves at compile time that the implementation's zod-inferred
 * types are identical to these declarations.
 *
 * Contract version: 1.0.0 (see manifest.json)
 * Protocol version: 1.0.0 (carried by every plan as `protocolVersion`)
 *
 * Authority (architecture lock rules 8/16): the Render Plan is a COMPILED
 * PROJECTION of an admitted W011 Experience Graph for one target device —
 * never a second source of truth. Kernel state stays referenced opaquely
 * (tenant-scoped, exact-revision digests), never embedded; vendor/engine
 * fields are rejected at the compiler authority boundary.
 */

// ---------------------------------------------------------------------------
// Versions and closed vocabularies.
// ---------------------------------------------------------------------------

/** Exact render-plan protocol version admitted by contract version 1.0.0. */
export type RenderPlanProtocolVersion = '1.0.0';

/** The document kind the experience compiler emits: the Render Plan. */
export type ExperienceCompilerDocumentKind = 'experience.render-plan';

/**
 * The typed compiler-error code: version skew, malformed descriptors,
 * digest tampering, cross-tenant denial, unresolvable references,
 * authority violations (kernel-reserved or vendor fields), or device
 * budget exceedance.
 */
export type ExperienceCompilerErrorCode =
  | 'version-unsupported'
  | 'malformed-descriptor'
  | 'digest-mismatch'
  | 'cross-tenant-denied'
  | 'unknown-reference'
  | 'authority-violation'
  | 'device-budget-exceeded';

/** One stage of the deterministic compilation pipeline. */
export type PlanStageKind =
  | 'relate'
  | 'draw-2d'
  | 'place-3d'
  | 'animate'
  | 'narrate'
  | 'timeline'
  | 'presence'
  | 'controls';

// ---------------------------------------------------------------------------
// Neutral primitives (self-contained mirrors of the W011 shared shapes).
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

/** Experience-graph identifier: "xg-" + lowercase slug. */
export type ExperienceGraphId = string;

/** Experience-local node identifier: "xn-" + lowercase slug. */
export type ExperienceNodeId = string;

/** Opaque scoping identifier (tenant/workspace/project/participant). */
export type OpaqueScopeId = string;

/**
 * Tenant scoping of a plan document (carried verbatim from the source
 * envelope): owning tenant, optional workspace and project narrowing
 * (R12).
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

/**
 * Presentation-only open attribute record carried into plan ops
 * (kernel-reserved keys are rejected at W011 admission; vendor/engine
 * keys are rejected at the compiler boundary).
 */
export type PresentationAttributes = Record<string, JsonValue>;

// ---------------------------------------------------------------------------
// Projected kernel references (projection, never authority; W011 shapes).
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

/** Which kernel subsystem a projected reference addresses. */
export type ProjectedReferenceKind =
  | 'world-entity'
  | 'world-relation'
  | 'world-event'
  | 'agent'
  | 'evidence-record'
  | 'capability';

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
// The abstract device-descriptor slot (W011 shapes; W019 fills it).
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
 * The abstract, provider-neutral device descriptor the plan is compiled
 * FOR: capabilities and budgets as typed data.
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
// Reused W011 presentation vocabulary (the plan ops' data shapes).
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

/** Neutral text weight of a label style. */
export type TextStyle = {
  color?: ColorHex | undefined;
  fontSizePx?: number | undefined;
  weight?: 'bold' | 'light' | 'medium' | 'regular' | undefined;
};

/** Neutral interpolation of one animation keyframe segment. */
export type EasingKind = 'ease-in' | 'ease-in-out' | 'ease-out' | 'linear' | 'step';

/** One animation keyframe. */
export type Keyframe = {
  atMs: number;
  value: JsonValue;
  easing?: EasingKind | undefined;
};

/** Kind of a timeline marker. */
export type TimelineMarkerKind =
  | 'branch-point'
  | 'event'
  | 'phase-end'
  | 'phase-start'
  | 'replay-cursor';

/** Neutral presence-participant kind. */
export type ParticipantKind = 'agent' | 'human' | 'system';

/** Opaque presence-participant reference. */
export type ParticipantReference = {
  participantId: string;
  participantKind: ParticipantKind;
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

/** Typed relationship kind between two Experience Graph nodes. */
export type ExperienceEdgeKind =
  | 'anchors'
  | 'animates'
  | 'binds-control'
  | 'contains'
  | 'follows'
  | 'synchronizes';

/** Presentation projection of the source Experience Graph. */
export type ExperienceGraphKind =
  | '2d'
  | '3d'
  | 'animation'
  | 'narrative'
  | 'timeline-replay'
  | 'presence'
  | 'controls';

// ---------------------------------------------------------------------------
// The compiled plan operations.
// ---------------------------------------------------------------------------

/** One compiled 2D shape draw op (z-ordered in its stage). */
export type PlanDrawShapeOp = {
  op: 'draw-shape';
  nodeId: ExperienceNodeId;
  ref?: ProjectedReference | undefined;
  geometry: Geometry2d;
  stroke?: StrokeStyle2d | undefined;
  fill?: FillStyle2d | undefined;
  zIndex?: number | undefined;
  attributes?: PresentationAttributes | undefined;
};

/** One compiled 2D label draw op (offset resolved to its default). */
export type PlanDrawLabelOp = {
  op: 'draw-label';
  nodeId: ExperienceNodeId;
  ref?: ProjectedReference | undefined;
  text: string;
  offset2d: Point2d;
  style?: TextStyle | undefined;
  anchorNodeIds?: ExperienceNodeId[] | undefined;
  attributes?: PresentationAttributes | undefined;
};

/** One compiled 3D spatial placement op. */
export type PlanPlaceSpatialOp = {
  op: 'place-spatial';
  nodeId: ExperienceNodeId;
  ref?: ProjectedReference | undefined;
  primitive: SpatialPrimitive;
  position: Vec3;
  orientation?: Quaternion | undefined;
  scale?: [number, number, number] | undefined;
  mesh?: MeshBinding | undefined;
  attributes?: PresentationAttributes | undefined;
};

/** One compiled 3D label placement op (offset resolved to its default). */
export type PlanPlaceLabelOp = {
  op: 'place-label';
  nodeId: ExperienceNodeId;
  ref?: ProjectedReference | undefined;
  text: string;
  offset3d: Vec3;
  style?: TextStyle | undefined;
  anchorNodeIds?: ExperienceNodeId[] | undefined;
  attributes?: PresentationAttributes | undefined;
};

/** One flattened animation binding: clip x track. */
export type PlanAnimationBinding = {
  clipNodeId: ExperienceNodeId;
  targetNodeId: ExperienceNodeId;
  propertyPath: string;
  durationMs: number;
  keyframes: Keyframe[];
  attributes?: PresentationAttributes | undefined;
};

/** One narrative beat in its compiled presentation order. */
export type PlanNarrativeBeat = {
  sequence: number;
  nodeId: ExperienceNodeId;
  ref?: ProjectedReference | undefined;
  title: string;
  body?: string | undefined;
  tone?: 'cautionary' | 'celebratory' | 'informative' | 'neutral' | undefined;
  attributes?: PresentationAttributes | undefined;
};

/** One timeline track in compiled time order. */
export type PlanTimelineTrack = {
  nodeId: ExperienceNodeId;
  ref?: ProjectedReference | undefined;
  label: string;
  startMs: number;
  endMs: number;
  attributes?: PresentationAttributes | undefined;
};

/** One timeline marker in compiled time order. */
export type PlanTimelineMarker = {
  nodeId: ExperienceNodeId;
  ref?: ProjectedReference | undefined;
  atMs: number;
  label?: string | undefined;
  markerKind: TimelineMarkerKind;
  attributes?: PresentationAttributes | undefined;
};

/** One presence seat in compiled (participant, node) order. */
export type PlanPresenceSeat = {
  nodeId: ExperienceNodeId;
  ref?: ProjectedReference | undefined;
  participant: ParticipantReference;
  attributes?: PresentationAttributes | undefined;
};

/** One presence cursor in compiled (participant, node) order. */
export type PlanPresenceCursor = {
  nodeId: ExperienceNodeId;
  ref?: ProjectedReference | undefined;
  participant: ParticipantReference;
  position2d?: Point2d | undefined;
  position3d?: Vec3 | undefined;
  atMs?: number | undefined;
  attributes?: PresentationAttributes | undefined;
};

/** One compiled control binding. */
export type PlanControlOp = {
  nodeId: ExperienceNodeId;
  ref?: ProjectedReference | undefined;
  controlKind: ControlKind;
  intent: ControlIntent;
  label?: string | undefined;
  options?: string[] | undefined;
  attributes?: PresentationAttributes | undefined;
};

/** One plan relation: an experience edge carried into the plan. */
export type PlanRelation = {
  kind: ExperienceEdgeKind;
  from: ExperienceNodeId;
  to: ExperienceNodeId;
  attributes?: PresentationAttributes | undefined;
};

// ---------------------------------------------------------------------------
// The plan stages (fixed canonical pipeline order).
// ---------------------------------------------------------------------------

/**
 * One compiled plan stage of the deterministic pipeline (discriminated on
 * `stage`): relate, draw-2d, place-3d, animate, narrate, timeline,
 * presence, or controls.
 */
export type PlanStage =
  | { stage: 'relate'; relations: PlanRelation[] }
  | {
      stage: 'draw-2d';
      draws: (PlanDrawShapeOp | PlanDrawLabelOp)[];
    }
  | {
      stage: 'place-3d';
      placements: (PlanPlaceSpatialOp | PlanPlaceLabelOp)[];
    }
  | { stage: 'animate'; bindings: PlanAnimationBinding[] }
  | { stage: 'narrate'; beats: PlanNarrativeBeat[] }
  | { stage: 'timeline'; tracks: PlanTimelineTrack[]; markers: PlanTimelineMarker[] }
  | { stage: 'presence'; seats: PlanPresenceSeat[]; cursors: PlanPresenceCursor[] }
  | { stage: 'controls'; controls: PlanControlOp[] };

// ---------------------------------------------------------------------------
// Device-shaped constraints and resource usage.
// ---------------------------------------------------------------------------

/**
 * The typed plan constraints: the target device's budgets and limits as
 * data (device-aware plan shaping). Countable budget violations are
 * rejected at compile time; fidelity differences are carried for the
 * downstream presenter (W019 adapts).
 */
export type PlanConstraints = {
  stereoscopic: boolean;
  poseTracking: PoseTrackingKind;
  worldAnchored: boolean;
  interaction: InteractionModality[];
  maxPixels?: number | undefined;
  refreshHz?: number | undefined;
  colorDepthBits?: number | undefined;
  maxTriangles?: number | undefined;
  maxTextureBytes?: number | undefined;
  latencyBudgetMs?: number | undefined;
};

/**
 * The compiler's deterministic resource accounting of the compiled
 * content: exact counts plus the conservative triangle estimate and
 * mesh-asset byte total used for budget enforcement.
 */
export type RenderPlanUsage = {
  nodes: number;
  edges: number;
  estimatedTriangles: number;
  assetBytes: number;
};

// ---------------------------------------------------------------------------
// The Render Plan envelope.
// ---------------------------------------------------------------------------

/**
 * The content of a Render Plan envelope (everything except the digest):
 * the chain to the source graph revision, the tenant scope (carried
 * verbatim from the envelope), the target device, its derived
 * constraints, the deterministic usage, and the staged compiled body.
 */
export type RenderPlanContent = {
  schema: 'epoch.render-plan';
  protocolVersion: RenderPlanProtocolVersion;
  sourceGraphId: ExperienceGraphId;
  sourceGraphKind: ExperienceGraphKind;
  sourceEnvelopeDigest: Sha256Hex;
  tenantScope: TenantScope;
  sourceRefs: ProjectedReference[];
  target: DeviceDescriptor;
  constraints: PlanConstraints;
  usage: RenderPlanUsage;
  stages: PlanStage[];
};

/**
 * The sealed Render Plan envelope: content plus its SHA-256 digest over
 * the canonical JSON of the content (digest field excluded). The digest
 * addresses the exact revision of the compiled plan AND, through
 * `sourceEnvelopeDigest`, the exact W011 envelope revision it compiled
 * from (envelope digest -> plan digest).
 */
export type RenderPlan = {
  schema: 'epoch.render-plan';
  protocolVersion: RenderPlanProtocolVersion;
  sourceGraphId: ExperienceGraphId;
  sourceGraphKind: ExperienceGraphKind;
  sourceEnvelopeDigest: Sha256Hex;
  tenantScope: TenantScope;
  sourceRefs: ProjectedReference[];
  target: DeviceDescriptor;
  constraints: PlanConstraints;
  usage: RenderPlanUsage;
  stages: PlanStage[];
  digest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// Typed compiler errors.
// ---------------------------------------------------------------------------

/** One flattened compiler validation issue (dotted path; "$" = root). */
export type CompilerIssue = {
  path: string;
  message: string;
};

/**
 * The typed compiler error (discriminated on `code`). The six W011
 * admission codes surface 1:1 from the reused admission discipline;
 * `device-budget-exceeded` is the compiler-owned device-shaping
 * rejection.
 */
export type CompilerError =
  | {
      code: 'version-unsupported';
      message: string;
      expected: string;
      encountered: string;
    }
  | {
      code: 'malformed-descriptor';
      message: string;
      issues: CompilerIssue[];
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
      violations: {
        path: string;
        key: string;
        origin: 'kernel-reserved' | 'vendor-blocklist';
      }[];
    }
  | {
      code: 'device-budget-exceeded';
      message: string;
      path: (string | number)[];
      limit: 'maxTriangles' | 'maxTextureBytes';
      expected: number;
      encountered: number;
    };
