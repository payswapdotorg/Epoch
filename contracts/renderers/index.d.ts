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
 * Contract version: 1.0.0 (see manifest.json)
 * Protocol version: 1.0.0 (carried by every binding, invocation, and receipt)
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
