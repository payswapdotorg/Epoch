/**
 * Epoch Renderer Runtime v1 — published contract declarations.
 *
 * This file is the versioned TypeScript declaration surface at the
 * `contracts/renderers` ownership boundary (Work Order W013). It is
 * self-contained: no imports, no runtime code, no vendor/engine/framework
 * vocabulary. The runtime implementation lives in
 * `@epoch/renderer-runtime` (experience layer); `parity.ts` in this
 * directory proves at compile time that the implementation's zod-inferred
 * types are identical to these declarations.
 *
 * Contract version: 1.1.0 (see manifest.json — W056 bumped 1.0.0 -> 1.1.0
 * ADDITIVELY; every W013 type below is unchanged)
 * Protocol version: 1.0.0 (carried by every W013 binding, invocation, and
 * receipt — unchanged)
 * Fabric protocol version: 1.0.0 (carried by every W056 fabric document)
 *
 * Provider neutrality (architecture lock rule 13): renderer descriptors
 * are ABSTRACT typed data (kind + capabilities + budgets); concrete
 * engines are future adapters behind this contract — zero engine imports,
 * zero GPU code, zero UI-framework dependencies.
 *
 * Execution, never authority (lock rule 8): the hosting surface EXECUTES
 * render-ready typed structures (W011 Experience Graphs, referenced by
 * content digest); it never authors presentation and never becomes a
 * second semantic store.
 */

// ---------------------------------------------------------------------------
// Versions and closed vocabularies.
// ---------------------------------------------------------------------------

/** Exact renderer-runtime protocol version admitted by contract version 1.0.0. */
export type RendererProtocolVersion = '1.0.0';

/** Lifecycle state of a renderer session binding. */
export type RendererBindingState = 'closed' | 'open';

/** Typed invocation kind executed by the hosting surface. */
export type RendererInvocationKind = 'advance-frame' | 'mount-graph' | 'submit-intent';

/** Typed receipt kind: the execution evidence of one admitted invocation. */
export type RendererReceiptKind = 'frame-receipt' | 'intent-receipt' | 'mount-receipt';

/** Typed renderer-error code of the hosting surface. */
export type RendererErrorCode =
  | 'budget-exceeded'
  | 'capability-denied'
  | 'cross-tenant-denied'
  | 'digest-mismatch'
  | 'invalid-invocation'
  | 'malformed-invocation'
  | 'malformed-record'
  | 'session-closed'
  | 'unknown-session'
  | 'version-unsupported';

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

/** Opaque scoping identifier (tenant/workspace/project/participant). */
export type OpaqueScopeId = string;

/**
 * Tenant scoping of a renderer document: owning tenant, optional
 * workspace and project narrowing (R12).
 */
export type TenantScope = {
  tenantId: OpaqueScopeId;
  workspaceId?: OpaqueScopeId | undefined;
  projectId?: OpaqueScopeId | undefined;
};

/** Renderer-descriptor identifier: "rr-" + lowercase slug (never a vendor product). */
export type RendererId = string;

/** Renderer-session identifier: "rs-" + lowercase slug. */
export type RendererSessionId = string;

/**
 * Device-session identifier: "ds-" + lowercase slug (mirrored shared
 * primitive; canonical home @epoch/experience-runtime).
 */
export type DeviceSessionId = string;

/** Opaque invocation identifier (shared message-id grammar). */
export type InvocationId = string;

/**
 * Virtual time in non-negative integer milliseconds (mirrored shared
 * primitive; canonical home @epoch/experience-runtime).
 */
export type VirtualTimeMs = number;

// ---------------------------------------------------------------------------
// Mirrored W011 device vocabulary (canonical home: contracts/experience).
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

/** Presentation projection of an Experience Graph (W011 vocabulary). */
export type ExperienceGraphKind =
  | '2d'
  | '3d'
  | 'animation'
  | 'narrative'
  | 'timeline-replay'
  | 'presence'
  | 'controls';

// ---------------------------------------------------------------------------
// Mirrored W011 control-intent + admission-error vocabulary (canonical
// home: contracts/experience).
// ---------------------------------------------------------------------------

/**
 * Typed UI intent a control emits (R30): qualified id plus semver core —
 * structurally identical to the action-protocol ActionTypeReference, so
 * the future control-to-proposal wiring through the Action Gateway needs
 * no translation layer.
 */
export type ControlIntent = {
  id: string;
  version: string;
};

/** One flattened W011 validation issue (dotted path + message). */
export type ExperienceIssue = {
  path: string;
  message: string;
};

/** The typed W011 admission error (verbatim mirror; see contracts/experience). */
export type ExperienceProtocolError =
  | { code: 'version-unsupported'; message: string; expected: string; encountered: string }
  | { code: 'malformed-descriptor'; message: string; issues: ExperienceIssue[] }
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
  | { code: 'unknown-reference'; message: string; path: (string | number)[]; reference: string }
  | {
      code: 'authority-violation';
      message: string;
      violations: { path: string; key: string }[];
    };

// ---------------------------------------------------------------------------
// Abstract renderer descriptors (kind, capabilities, budgets).
// ---------------------------------------------------------------------------

/** Neutral output capabilities a renderer descriptor declares. */
export type RendererOutputCapabilities = {
  stereoscopic: boolean;
  maxPixels?: number | undefined;
  refreshHz?: number | undefined;
  colorDepthBits?: number | undefined;
};

/** Neutral budgets a renderer descriptor enforces at its boundary. */
export type RendererBudgets = {
  maxGraphNodes: number;
  maxGraphEdges: number;
  maxTriangles?: number | undefined;
  maxTextureBytes?: number | undefined;
};

/**
 * The abstract, provider-neutral renderer descriptor: which Experience
 * Graph kinds it hosts, which interaction modalities it services, what
 * output it can produce, and the budgets it enforces — typed data only;
 * concrete engines are future adapters behind this contract.
 */
export type RendererDescriptor = {
  descriptorVersion: 1;
  rendererId: RendererId;
  graphKinds: ExperienceGraphKind[];
  interaction: InteractionModality[];
  output: RendererOutputCapabilities;
  budgets: RendererBudgets;
};

// ---------------------------------------------------------------------------
// Device-session snapshots (the host-side binding input).
// ---------------------------------------------------------------------------

/**
 * The device-session value projection a renderer binding consumes:
 * session identity, owning tenant scope, and the W011 device descriptor
 * (the host model lives in @epoch/experience-runtime; parity-pinned).
 */
export type DeviceSessionSnapshot = {
  deviceSessionId: DeviceSessionId;
  tenantScope: TenantScope;
  device: DeviceDescriptor;
};

// ---------------------------------------------------------------------------
// Negotiated bindings (descriptor x device session).
// ---------------------------------------------------------------------------

/**
 * The effective limits of a renderer session binding: the typed envelope
 * every invocation is enforced against (anything not declared is denied).
 */
export type EffectiveLimits = {
  graphKinds: ExperienceGraphKind[];
  interaction: InteractionModality[];
  stereoscopic: boolean;
  maxGraphNodes: number;
  maxGraphEdges: number;
  maxTriangles?: number | undefined;
  maxTextureBytes?: number | undefined;
};

/** The content of a renderer binding record (everything except the digest). */
export type RendererBindingContent = {
  schema: 'epoch.renderer-binding';
  protocolVersion: RendererProtocolVersion;
  rendererSessionId: RendererSessionId;
  renderer: RendererDescriptor;
  device: DeviceSessionSnapshot;
  effective: EffectiveLimits;
  state: RendererBindingState;
  boundAtMs: VirtualTimeMs;
  lastFrameIndex?: number | undefined;
  mountedStateDigest?: Sha256Hex | undefined;
  mountedAtMs?: number | undefined;
  invocationCount: number;
};

/**
 * The sealed renderer binding record: content plus its SHA-256 digest
 * over the canonical JSON of the content (the digest field excluded).
 */
export type RendererBinding = {
  schema: 'epoch.renderer-binding';
  protocolVersion: RendererProtocolVersion;
  rendererSessionId: RendererSessionId;
  renderer: RendererDescriptor;
  device: DeviceSessionSnapshot;
  effective: EffectiveLimits;
  state: RendererBindingState;
  boundAtMs: VirtualTimeMs;
  lastFrameIndex?: number | undefined;
  mountedStateDigest?: Sha256Hex | undefined;
  mountedAtMs?: number | undefined;
  invocationCount: number;
  digest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// Typed invocation envelopes.
// ---------------------------------------------------------------------------

/** The invocation-envelope union (discriminated on `kind`). */
export type InvocationEnvelope =
  | {
      schema: 'epoch.renderer-invocation';
      protocolVersion: RendererProtocolVersion;
      kind: 'mount-graph';
      invocationId: InvocationId;
      rendererSessionId: RendererSessionId;
      graphDigest: Sha256Hex;
      atMs: VirtualTimeMs;
      declaredTriangles?: number | undefined;
      declaredTextureBytes?: number | undefined;
    }
  | {
      schema: 'epoch.renderer-invocation';
      protocolVersion: RendererProtocolVersion;
      kind: 'advance-frame';
      invocationId: InvocationId;
      rendererSessionId: RendererSessionId;
      frameIndex: number;
      atMs: VirtualTimeMs;
    }
  | {
      schema: 'epoch.renderer-invocation';
      protocolVersion: RendererProtocolVersion;
      kind: 'submit-intent';
      invocationId: InvocationId;
      rendererSessionId: RendererSessionId;
      modality: InteractionModality;
      intent: ControlIntent;
    };

// ---------------------------------------------------------------------------
// Content-addressed execution receipts.
// ---------------------------------------------------------------------------

/** The receipt-content union (discriminated on `kind`). */
export type RendererReceiptContent =
  | {
      schema: 'epoch.renderer-receipt';
      protocolVersion: RendererProtocolVersion;
      kind: 'mount-receipt';
      invocationId: InvocationId;
      rendererSessionId: RendererSessionId;
      tenantScope: TenantScope;
      graphDigest: Sha256Hex;
      graphKind: ExperienceGraphKind;
      nodeCount: number;
      edgeCount: number;
      mountedAtMs: VirtualTimeMs;
      declaredTriangles?: number | undefined;
      declaredTextureBytes?: number | undefined;
    }
  | {
      schema: 'epoch.renderer-receipt';
      protocolVersion: RendererProtocolVersion;
      kind: 'frame-receipt';
      invocationId: InvocationId;
      rendererSessionId: RendererSessionId;
      tenantScope: TenantScope;
      frameIndex: number;
      atMs: VirtualTimeMs;
      stateDigest?: Sha256Hex | undefined;
    }
  | {
      schema: 'epoch.renderer-receipt';
      protocolVersion: RendererProtocolVersion;
      kind: 'intent-receipt';
      invocationId: InvocationId;
      rendererSessionId: RendererSessionId;
      tenantScope: TenantScope;
      modality: InteractionModality;
      intent: ControlIntent;
    };

/**
 * The sealed renderer receipt: content plus its SHA-256 digest over the
 * canonical JSON of the content (the digest field excluded).
 */
export type RendererReceipt =
  | {
      schema: 'epoch.renderer-receipt';
      protocolVersion: RendererProtocolVersion;
      kind: 'mount-receipt';
      invocationId: InvocationId;
      rendererSessionId: RendererSessionId;
      tenantScope: TenantScope;
      graphDigest: Sha256Hex;
      graphKind: ExperienceGraphKind;
      nodeCount: number;
      edgeCount: number;
      mountedAtMs: VirtualTimeMs;
      declaredTriangles?: number | undefined;
      declaredTextureBytes?: number | undefined;
      digest: Sha256Hex;
    }
  | {
      schema: 'epoch.renderer-receipt';
      protocolVersion: RendererProtocolVersion;
      kind: 'frame-receipt';
      invocationId: InvocationId;
      rendererSessionId: RendererSessionId;
      tenantScope: TenantScope;
      frameIndex: number;
      atMs: VirtualTimeMs;
      stateDigest?: Sha256Hex | undefined;
      digest: Sha256Hex;
    }
  | {
      schema: 'epoch.renderer-receipt';
      protocolVersion: RendererProtocolVersion;
      kind: 'intent-receipt';
      invocationId: InvocationId;
      rendererSessionId: RendererSessionId;
      tenantScope: TenantScope;
      modality: InteractionModality;
      intent: ControlIntent;
      digest: Sha256Hex;
    };

// ---------------------------------------------------------------------------
// Typed renderer-error taxonomy.
// ---------------------------------------------------------------------------

/** One flattened validation issue (dotted path + message; "$" = root). */
export type RendererIssue = {
  path: string;
  message: string;
};

/**
 * The typed renderer error (discriminated on `code`). The
 * `malformed-invocation` variant may carry the verbatim typed W011
 * admission error of an embedded graph document as its `cause`.
 */
export type RendererRuntimeError =
  | {
      code: 'budget-exceeded';
      message: string;
      path: (string | number)[];
      resource: 'graph-edges' | 'graph-nodes' | 'texture-bytes' | 'triangles';
      limit: number;
      encountered: number;
    }
  | {
      code: 'capability-denied';
      message: string;
      path: (string | number)[];
      declared: string[];
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
      code: 'digest-mismatch';
      message: string;
      path: (string | number)[];
      expected: string;
      encountered: string;
    }
  | {
      code: 'invalid-invocation';
      message: string;
      path: (string | number)[];
      expected: string;
      encountered: string;
    }
  | {
      code: 'malformed-invocation';
      message: string;
      issues: RendererIssue[];
      cause?: ExperienceProtocolError | undefined;
    }
  | { code: 'malformed-record'; message: string; issues: RendererIssue[] }
  | { code: 'session-closed'; message: string; rendererSessionId: string }
  | {
      code: 'unknown-session';
      message: string;
      expectedSessionId: string;
      encounteredSessionId: string;
    }
  | {
      code: 'version-unsupported';
      message: string;
      expected: string;
      encountered: string;
    };

// ---------------------------------------------------------------------------
// W056 — the Renderer Fabric contract (additive; every W013 type above is
// unchanged).
//
// The fabric concepts freeze the seam W057-W059 build against: renderer
// capability sets, ephemeral non-authoritative sessions, portable
// view-state snapshots, renderer switching (request + receipt), frame and
// input envelopes, intent receipts, typed failures/degradation/fallback,
// health, content-addressed asset bindings, and conformance results. All
// documents carry the fabric protocol version ("1.0.0"); embedded W013
// records keep their own protocol version. ZERO engine imports, ZERO GPU
// code, ZERO UI-framework dependencies — concrete engines are W058/W059
// adapters behind this contract.
// ---------------------------------------------------------------------------

/** Exact renderer-fabric protocol version admitted by contract version 1.1.0. */
export type RendererFabricProtocolVersion = '1.0.0';

/** Lifecycle state of a renderer fabric session (disposed is terminal). */
export type RendererSessionState =
  | 'active'
  | 'created'
  | 'degraded'
  | 'disposed'
  | 'suspended';

/** Health state of a renderer adapter or session. */
export type RendererHealthState = 'degraded' | 'failed' | 'healthy' | 'unavailable';

/** Typed presentation-fidelity degradation (never a semantic change). */
export type RendererDegradationKind =
  | 'none'
  | 'reduced-fidelity'
  | 'static-frame'
  | 'wireframe';

/** Raw input kind of a renderer input envelope. */
export type RendererInputKind =
  | 'key-down'
  | 'key-up'
  | 'pointer-down'
  | 'pointer-move'
  | 'pointer-up'
  | 'wheel';

/** One portable view-state field a renderer can restore across a switch. */
export type PortableViewStateField =
  | 'camera'
  | 'focused-entities'
  | 'layer-visibility'
  | 'timeline-position';

/** Content-addressed asset kind a renderer can bind. */
export type RendererAssetKind = 'animation' | 'material' | 'mesh' | 'texture';

/** Trust state of a renderer asset binding. */
export type RendererAssetTrustState = 'untrusted' | 'validated';

/** Outcome of one renderer input normalization. */
export type RendererIntentOutcome = 'no-target' | 'normalized' | 'rejected';

/** One conformance check kind of the renderer conformance harness. */
export type RendererConformanceCheckKind =
  | 'digest-continuity'
  | 'interaction-outcomes'
  | 'normalized-intents'
  | 'presentation-only-differences'
  | 'semantic-entity-ids'
  | 'semantic-focus-layers'
  | 'tenant-continuity';

/** Typed failure code of the renderer fabric orchestration surface. */
export type RendererFailureCode =
  | 'adapter-unavailable'
  | 'asset-rejected'
  | 'cross-tenant-denied'
  | 'degraded'
  | 'fallback-applied'
  | 'input-unsupported'
  | 'invalid-fabric-record'
  | 'mount-failed'
  | 'probe-rejected'
  | 'session-disposed'
  | 'session-failed'
  | 'switch-aborted'
  | 'switch-incompatible'
  | 'unknown-session';

// ---------------------------------------------------------------------------
// W056 neutral + mirrored primitives.
// ---------------------------------------------------------------------------

/** Mirrored shared primitive (canonical home: contracts/experience, W011). */
export type Vec3 = [number, number, number];

/** Mirrored shared primitive (canonical home: contracts/experience, W011). */
export type Quaternion = [number, number, number, number];

/** Mirrored shared primitive (canonical home: contracts/experience, W011). */
export type ReplayWindow = {
  fromSequence: number;
  toSequence: number;
};

/** Mirrored shared primitive (canonical home: contracts/experience, W011). */
export type ProjectedAgentRef = {
  kind: 'agent';
  tenantId: OpaqueScopeId;
  agentId: string;
  contentDigest: Sha256Hex;
};

/** Fabric-session identifier: "fx-" + lowercase slug (ephemeral). */
export type FabricSessionId = string;

/** Renderer switch identifier: "sw-" + lowercase slug. */
export type SwitchId = string;

/** Renderer input identifier: "rin-" + lowercase slug. */
export type InputId = string;

/** Renderer asset-binding identifier: "rab-" + lowercase slug. */
export type AssetBindingId = string;

/** Semantic-layer identifier: "lyr-" + lowercase slug. */
export type SemanticLayerId = string;

/** World scene identifier (mirrored W016 grammar): "wsc-" + lowercase slug. */
export type WorldSceneIdMirror = string;

/** World entity identifier (mirrored W016 grammar): opaque bounded string. */
export type WorldEntityIdMirror = string;

/** Normalized pointer position in the renderer viewport (x/y in [0, 1]). */
export type PointerPosition = {
  x: number;
  y: number;
};

/** One key input: a bounded key token plus its sorted modifier set. */
export type InputKey = {
  key: string;
  modifiers: string[];
};

// ---------------------------------------------------------------------------
// W056 the portable view state (mirrored W016 camera/timeline grammars).
// ---------------------------------------------------------------------------

/** Mirrored W016 follow-cursor state. */
export type PortableFollowCursorState = {
  position2d?: { x: number; y: number } | undefined;
  position3d?: Vec3 | undefined;
  atMs?: number | undefined;
};

/** Mirrored W016 orbit camera. */
export type PortableOrbitCamera = {
  mode: 'orbit';
  position: Vec3;
  orientation?: Quaternion | undefined;
  target?: Vec3 | undefined;
  fovRadians?: number | undefined;
};

/** Mirrored W016 free camera. */
export type PortableFreeCamera = {
  mode: 'free';
  position: Vec3;
  orientation?: Quaternion | undefined;
};

/** Mirrored W016 follow-agent camera. */
export type PortableFollowAgentCamera = {
  mode: 'follow-agent';
  agentRef: ProjectedAgentRef;
  followDistance?: number | undefined;
  cursor?: PortableFollowCursorState | undefined;
};

/** Mirrored W016 camera-state union (discriminated on `mode`). */
export type PortableCameraState =
  | PortableFollowAgentCamera
  | PortableFreeCamera
  | PortableOrbitCamera;

/** Mirrored W016 scene timeline/replay position. */
export type PortableTimelinePosition = {
  atMs: number;
  frameIndex: number;
  paused: boolean;
  replayWindow?: ReplayWindow | undefined;
};

/** The visibility of one semantic layer of the world experience projection. */
export type SemanticLayerVisibility = {
  layerId: SemanticLayerId;
  visible: boolean;
};

/**
 * The portable view state of a renderer session: semantic focus, semantic
 * layer visibility, the timeline/replay position, the hidden set, and the
 * best-effort camera — the presentation subset represented by existing
 * Epoch contracts that survives a renderer switch.
 */
export type PortableViewState = {
  focusedEntityIds: WorldEntityIdMirror[];
  layerVisibility: SemanticLayerVisibility[];
  timelinePosition: PortableTimelinePosition;
  camera?: PortableCameraState | undefined;
  hiddenEntityIds: WorldEntityIdMirror[];
};

// ---------------------------------------------------------------------------
// W056 the renderer capability set.
// ---------------------------------------------------------------------------

/**
 * The fabric capability declaration of a renderer adapter: hit-testing,
 * measurement/annotation translation, frame capture, switching/snapshot
 * support, typed degradations, portable view-state restore fields, and
 * bindable asset kinds (sorted deterministic sets throughout).
 */
export type RendererCapabilitySet = {
  capabilityVersion: 1;
  rendererId: RendererId;
  hitTesting: boolean;
  measurement: boolean;
  annotation: boolean;
  frameCapture: boolean;
  sessionSwitching: boolean;
  snapshotCapture: boolean;
  degradation: RendererDegradationKind[];
  portableViewState: PortableViewStateField[];
  assetKinds: RendererAssetKind[];
};

// ---------------------------------------------------------------------------
// W056 renderer health.
// ---------------------------------------------------------------------------

/** The typed health projection of one renderer (adapter or session). */
export type RendererHealth = {
  state: RendererHealthState;
  degradation: RendererDegradationKind;
  lastFailureCode?: RendererFailureCode | undefined;
  detail?: string | undefined;
  atMs: VirtualTimeMs;
};

// ---------------------------------------------------------------------------
// W056 the typed fabric failure taxonomy.
// ---------------------------------------------------------------------------

/** The typed trigger of a chained renderer-fabric failure. */
export type RendererFailureTrigger = {
  code: RendererFailureCode;
  message: string;
};

/**
 * The typed renderer-fabric failure (discriminated on `code`). Chained
 * fabric failures carry their trigger as a typed
 * RendererFailureTrigger; hosting-surface failures carry the verbatim
 * typed W013 RendererRuntimeError as `cause`/`admissionCause`.
 */
export type RendererFailure =
  | {
      code: 'adapter-unavailable';
      message: string;
      rendererId: string;
      reason: string;
    }
  | {
      code: 'asset-rejected';
      message: string;
      assetDigest: string;
      reason: string;
    }
  | {
      code: 'cross-tenant-denied';
      message: string;
      expectedTenantId: string;
      encounteredTenantId: string;
    }
  | {
      code: 'degraded';
      message: string;
      degradation: 'reduced-fidelity' | 'static-frame' | 'wireframe';
      reason: string;
    }
  | {
      code: 'fallback-applied';
      message: string;
      fromRendererId: string;
      toRendererId: string;
      trigger: RendererFailureTrigger;
    }
  | {
      code: 'input-unsupported';
      message: string;
      inputKind: string;
      reason: string;
      admissionCause?: RendererRuntimeError | undefined;
    }
  | {
      code: 'invalid-fabric-record';
      message: string;
      issues: RendererIssue[];
    }
  | {
      code: 'mount-failed';
      message: string;
      worldDigest: string;
      cause?: RendererRuntimeError | undefined;
      compileMessage?: string | undefined;
    }
  | {
      code: 'probe-rejected';
      message: string;
      rendererId: string;
      reason: string;
    }
  | {
      code: 'session-disposed';
      message: string;
      fabricSessionId: string;
    }
  | {
      code: 'session-failed';
      message: string;
      fabricSessionId: string;
      trigger?: RendererFailureTrigger | undefined;
    }
  | {
      code: 'switch-aborted';
      message: string;
      stage: 'create' | 'mount' | 'probe' | 'resolve' | 'restore';
      retainedFabricSessionId: string;
      trigger: RendererFailureTrigger;
    }
  | {
      code: 'switch-incompatible';
      message: string;
      field: 'tenant' | 'world-digest';
      expected: string;
      encountered: string;
    }
  | {
      code: 'unknown-session';
      message: string;
      encounteredFabricSessionId: string;
    };

// ---------------------------------------------------------------------------
// W056 the canonical world projection reference.
// ---------------------------------------------------------------------------

/**
 * The canonical world projection reference: world-experience scene id,
 * content digest of the exact scene revision, and owning tenant scope —
 * the identity triple that survives renderer switching.
 */
export type WorldProjectionRef = {
  sceneId: WorldSceneIdMirror;
  worldDigest: Sha256Hex;
  tenantScope: TenantScope;
};

// ---------------------------------------------------------------------------
// W056 the ephemeral renderer session.
// ---------------------------------------------------------------------------

/**
 * The content of an ephemeral renderer session record: identity, embedded
 * W013 binding, capability set, world projection reference, portable view
 * state, health, lifecycle state, and execution counters. Non-authoritative
 * by construction: no semantic payload, never persisted by the fabric.
 */
export type RendererSessionContent = {
  schema: 'epoch.renderer-session';
  fabricProtocolVersion: RendererFabricProtocolVersion;
  fabricSessionId: FabricSessionId;
  capabilityId: string;
  rendererId: RendererId;
  rendererSessionId: RendererSessionId;
  binding: RendererBinding;
  capabilities: RendererCapabilitySet;
  worldProjection: WorldProjectionRef;
  viewState: PortableViewState;
  health: RendererHealth;
  state: RendererSessionState;
  createdAtMs: VirtualTimeMs;
  mountedWorldDigest?: Sha256Hex | undefined;
  mountedAtMs?: VirtualTimeMs | undefined;
  lastFrameIndex?: number | undefined;
  invocationCount: number;
  switchCount: number;
};

/**
 * The sealed ephemeral renderer session record: content plus its SHA-256
 * digest over the canonical JSON of the content (the digest field
 * excluded).
 */
export type RendererSession = {
  schema: 'epoch.renderer-session';
  fabricProtocolVersion: RendererFabricProtocolVersion;
  fabricSessionId: FabricSessionId;
  capabilityId: string;
  rendererId: RendererId;
  rendererSessionId: RendererSessionId;
  binding: RendererBinding;
  capabilities: RendererCapabilitySet;
  worldProjection: WorldProjectionRef;
  viewState: PortableViewState;
  health: RendererHealth;
  state: RendererSessionState;
  createdAtMs: VirtualTimeMs;
  mountedWorldDigest?: Sha256Hex | undefined;
  mountedAtMs?: VirtualTimeMs | undefined;
  lastFrameIndex?: number | undefined;
  invocationCount: number;
  switchCount: number;
  digest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// W056 the portable session snapshot.
// ---------------------------------------------------------------------------

/** The content of a portable renderer session snapshot. */
export type RendererSessionSnapshotContent = {
  schema: 'epoch.renderer-session-snapshot';
  fabricProtocolVersion: RendererFabricProtocolVersion;
  fabricSessionId: FabricSessionId;
  capturedFromRendererId: RendererId;
  worldProjection: WorldProjectionRef;
  viewState: PortableViewState;
  invocationCount: number;
  switchCount: number;
  capturedAtMs: VirtualTimeMs;
};

/** The sealed portable renderer session snapshot (content + digest). */
export type RendererSessionSnapshot = {
  schema: 'epoch.renderer-session-snapshot';
  fabricProtocolVersion: RendererFabricProtocolVersion;
  fabricSessionId: FabricSessionId;
  capturedFromRendererId: RendererId;
  worldProjection: WorldProjectionRef;
  viewState: PortableViewState;
  invocationCount: number;
  switchCount: number;
  capturedAtMs: VirtualTimeMs;
  digest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// W056 renderer switching.
// ---------------------------------------------------------------------------

/** One renderer switch request (transient intent, never sealed). */
export type RendererSwitchRequest = {
  schema: 'epoch.renderer-switch-request';
  fabricProtocolVersion: RendererFabricProtocolVersion;
  switchId: SwitchId;
  sourceFabricSessionId: FabricSessionId;
  targetRendererId: RendererId;
  expectedWorldDigest: Sha256Hex;
  expectedTenantId: string;
  targetFabricSessionId: FabricSessionId;
  fallbackRendererIds: RendererId[];
  atMs: VirtualTimeMs;
};

/** The content of a renderer switch receipt (execution evidence). */
export type RendererSwitchReceiptContent = {
  schema: 'epoch.renderer-switch-receipt';
  fabricProtocolVersion: RendererFabricProtocolVersion;
  switchId: SwitchId;
  fromRendererId: RendererId;
  toRendererId: RendererId;
  fromFabricSessionId: FabricSessionId;
  toFabricSessionId: FabricSessionId;
  tenantScope: TenantScope;
  worldDigest: Sha256Hex;
  sourceSnapshotDigest: Sha256Hex;
  mountedProjectionDigest: Sha256Hex;
  restoredViewFields: PortableViewStateField[];
  restoredViewState: PortableViewState;
  fallbackApplied: boolean;
  atMs: VirtualTimeMs;
};

/** The sealed renderer switch receipt (content + digest). */
export type RendererSwitchReceipt = {
  schema: 'epoch.renderer-switch-receipt';
  fabricProtocolVersion: RendererFabricProtocolVersion;
  switchId: SwitchId;
  fromRendererId: RendererId;
  toRendererId: RendererId;
  fromFabricSessionId: FabricSessionId;
  toFabricSessionId: FabricSessionId;
  tenantScope: TenantScope;
  worldDigest: Sha256Hex;
  sourceSnapshotDigest: Sha256Hex;
  mountedProjectionDigest: Sha256Hex;
  restoredViewFields: PortableViewStateField[];
  restoredViewState: PortableViewState;
  fallbackApplied: boolean;
  atMs: VirtualTimeMs;
  digest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// W056 the frame envelope.
// ---------------------------------------------------------------------------

/** One typed frame envelope (monotonic index, continuity digest, typed fidelity). */
export type RendererFrameEnvelope = {
  schema: 'epoch.renderer-frame-envelope';
  fabricProtocolVersion: RendererFabricProtocolVersion;
  fabricSessionId: FabricSessionId;
  frameIndex: number;
  atMs: VirtualTimeMs;
  worldDigest: Sha256Hex;
  degradation: RendererDegradationKind;
  admissionDigest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// W056 the input envelope + intent receipt.
// ---------------------------------------------------------------------------

/** One raw renderer input envelope (pre-normalization; discriminated on `inputKind`). */
export type RendererInputEnvelope =
  | {
      schema: 'epoch.renderer-input-envelope';
      fabricProtocolVersion: RendererFabricProtocolVersion;
      inputId: InputId;
      fabricSessionId: FabricSessionId;
      atMs: VirtualTimeMs;
      modality: InteractionModality;
      inputKind: 'pointer-down' | 'pointer-move' | 'pointer-up';
      pointer: PointerPosition;
      intentHint?: { intent: ControlIntent } | undefined;
    }
  | {
      schema: 'epoch.renderer-input-envelope';
      fabricProtocolVersion: RendererFabricProtocolVersion;
      inputId: InputId;
      fabricSessionId: FabricSessionId;
      atMs: VirtualTimeMs;
      modality: InteractionModality;
      inputKind: 'key-down' | 'key-up';
      key: InputKey;
    }
  | {
      schema: 'epoch.renderer-input-envelope';
      fabricProtocolVersion: RendererFabricProtocolVersion;
      inputId: InputId;
      fabricSessionId: FabricSessionId;
      atMs: VirtualTimeMs;
      modality: InteractionModality;
      inputKind: 'wheel';
      delta: { x: number; y: number };
    };

/** The content of a renderer intent receipt (normalization evidence). */
export type RendererIntentReceiptContent = {
  schema: 'epoch.renderer-intent-receipt';
  fabricProtocolVersion: RendererFabricProtocolVersion;
  inputId: InputId;
  fabricSessionId: FabricSessionId;
  modality: InteractionModality;
  inputKind: RendererInputKind;
  hitEntityId?: WorldEntityIdMirror | undefined;
  intent?: ControlIntent | undefined;
  intentPayloadDigest?: Sha256Hex | undefined;
  outcome: RendererIntentOutcome;
  admissionDigest?: Sha256Hex | undefined;
  rejectionDetail?: string | undefined;
  atMs: VirtualTimeMs;
};

/** The sealed renderer intent receipt (content + digest). */
export type RendererIntentReceipt = {
  schema: 'epoch.renderer-intent-receipt';
  fabricProtocolVersion: RendererFabricProtocolVersion;
  inputId: InputId;
  fabricSessionId: FabricSessionId;
  modality: InteractionModality;
  inputKind: RendererInputKind;
  hitEntityId?: WorldEntityIdMirror | undefined;
  intent?: ControlIntent | undefined;
  intentPayloadDigest?: Sha256Hex | undefined;
  outcome: RendererIntentOutcome;
  admissionDigest?: Sha256Hex | undefined;
  rejectionDetail?: string | undefined;
  atMs: VirtualTimeMs;
  digest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// W056 the asset binding.
// ---------------------------------------------------------------------------

/** The content of a renderer asset binding. */
export type RendererAssetBindingContent = {
  schema: 'epoch.renderer-asset-binding';
  fabricProtocolVersion: RendererFabricProtocolVersion;
  bindingId: AssetBindingId;
  fabricSessionId: FabricSessionId;
  tenantScope: TenantScope;
  assetDigest: Sha256Hex;
  assetKind: RendererAssetKind;
  byteSize: number;
  trustState: RendererAssetTrustState;
  validatedAtMs?: VirtualTimeMs | undefined;
  boundAtMs: VirtualTimeMs;
};

/** The sealed renderer asset binding (content + digest). */
export type RendererAssetBinding = {
  schema: 'epoch.renderer-asset-binding';
  fabricProtocolVersion: RendererFabricProtocolVersion;
  bindingId: AssetBindingId;
  fabricSessionId: FabricSessionId;
  tenantScope: TenantScope;
  assetDigest: Sha256Hex;
  assetKind: RendererAssetKind;
  byteSize: number;
  trustState: RendererAssetTrustState;
  validatedAtMs?: VirtualTimeMs | undefined;
  boundAtMs: VirtualTimeMs;
  digest: Sha256Hex;
};

// ---------------------------------------------------------------------------
// W056 the conformance result.
// ---------------------------------------------------------------------------

/** One conformance check entry. */
export type RendererConformanceCheck = {
  checkKind: RendererConformanceCheckKind;
  rendererId: RendererId;
  outcome: 'fail' | 'pass';
  detail?: string | undefined;
  evidenceDigest?: Sha256Hex | undefined;
};

/** The content of a renderer conformance result. */
export type RendererConformanceResultContent = {
  schema: 'epoch.renderer-conformance-result';
  fabricProtocolVersion: RendererFabricProtocolVersion;
  runId: string;
  renderers: RendererId[];
  tenantScope: TenantScope;
  worldDigest: Sha256Hex;
  checks: RendererConformanceCheck[];
  overallOutcome: 'fail' | 'pass';
  startedAtMs: VirtualTimeMs;
  completedAtMs: VirtualTimeMs;
};

/** The sealed renderer conformance result (content + digest). */
export type RendererConformanceResult = {
  schema: 'epoch.renderer-conformance-result';
  fabricProtocolVersion: RendererFabricProtocolVersion;
  runId: string;
  renderers: RendererId[];
  tenantScope: TenantScope;
  worldDigest: Sha256Hex;
  checks: RendererConformanceCheck[];
  overallOutcome: 'fail' | 'pass';
  startedAtMs: VirtualTimeMs;
  completedAtMs: VirtualTimeMs;
  digest: Sha256Hex;
};
