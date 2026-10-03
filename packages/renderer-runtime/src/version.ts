/**
 * @epoch/renderer-runtime — contract versions and closed vocabularies.
 *
 * Versioning policy (v1, mirrors the agent-protocol / experience-protocol
 * discipline): a serialized renderer document (invocation envelope or
 * receipt) is admitted only when its `protocolVersion` equals
 * {@link RENDERER_PROTOCOL_VERSION} exactly; skew surfaces as a typed
 * `version-unsupported` error (checked before any schema validation).
 * {@link RENDERER_CONTRACT_VERSION} versions the published shared
 * contract surface at `contracts/renderers` (the W002-W004 convention).
 *
 * Provider neutrality (architecture lock rule 13): every vocabulary below
 * names a ROLE, SURFACE, or BOUNDARY — never a vendor, engine, renderer,
 * framework, or API. The renderer hosting surface is abstract typed data
 * (kind + capabilities + budgets); concrete engines (any graphics stack)
 * are FUTURE ADAPTERS behind the descriptor contract — zero engine
 * imports, zero GPU code, zero UI-framework dependencies ship here.
 */
import { z } from 'zod';

/**
 * Version of the published renderer contract surface (contracts/renderers).
 *
 * W056 bumped 1.0.0 -> 1.1.0 ADDITIVELY: every W013 type is unchanged
 * (byte-compatible); the fabric contract concepts (capability sets,
 * sessions, portable snapshots, switching, envelopes, failures, health,
 * asset bindings, conformance results) were added on top.
 *
 * W065 (ACR-010) bumped 1.1.0 -> 1.2.0 ADDITIVELY: the emitted schema
 * surface is UNCHANGED (every dataType and schema file is byte-identical
 * to the v1.1.0 emission); the addition is the fabric-level
 * session-asset-binding operation surface, declared at
 * contracts/renderers/fabric-operations.d.ts and implemented by
 * @epoch/renderer-fabric (parity-pinned in contracts/renderers/parity.ts),
 * composing the UNCHANGED optional adapter-seam `bindAsset`. Only this
 * version pin moves — the mechanical consequence of the manifest bump
 * (this constant is the emission source of the manifest's
 * contractVersion); no runtime schema, validator, or admission behavior
 * changed.
 */
export const RENDERER_CONTRACT_VERSION = '1.2.0' as const;

/** Protocol version carried by every serialized renderer document. */
export const RENDERER_PROTOCOL_VERSION = '1.0.0' as const;

/**
 * Fabric protocol version carried by every W056 fabric document (sessions,
 * snapshots, switch requests/receipts, frame/input envelopes, intent
 * receipts, asset bindings, conformance results). The W013 documents
 * (bindings, invocations, receipts) keep carrying
 * {@link RENDERER_PROTOCOL_VERSION}; the fabric documents embed those W013
 * records verbatim, so the two versions stay independently evolvable.
 */
export const RENDERER_FABRIC_PROTOCOL_VERSION = '1.0.0' as const;

/** The fabric-protocol version literal type. */
export type RendererFabricProtocolVersion = typeof RENDERER_FABRIC_PROTOCOL_VERSION;

export const RendererFabricProtocolVersionSchema = z
  .literal(RENDERER_FABRIC_PROTOCOL_VERSION)
  .meta({
    id: 'RendererFabricProtocolVersion',
    title: 'RendererFabricProtocolVersion',
    description: 'Exact renderer-fabric protocol version admitted by this release ("1.0.0").',
  });

/** The protocol version literal type. */
export type RendererProtocolVersion = typeof RENDERER_PROTOCOL_VERSION;

export const RendererProtocolVersionSchema = z
  .literal(RENDERER_PROTOCOL_VERSION)
  .meta({
    id: 'RendererProtocolVersion',
    title: 'RendererProtocolVersion',
    description: 'Exact renderer-runtime protocol version admitted by this release ("1.0.0").',
  });

/** Schema-name discriminator carried by every renderer binding record. */
export const RENDERER_BINDING_SCHEMA_NAME = 'epoch.renderer-binding' as const;

/** Schema-name discriminator carried by every invocation envelope. */
export const RENDERER_INVOCATION_SCHEMA_NAME = 'epoch.renderer-invocation' as const;

/** Schema-name discriminator carried by every renderer receipt. */
export const RENDERER_RECEIPT_SCHEMA_NAME = 'epoch.renderer-receipt' as const;

// --- W056 fabric document discriminators ----------------------------------

/** Schema-name discriminator carried by every renderer session record. */
export const RENDERER_SESSION_SCHEMA_NAME = 'epoch.renderer-session' as const;

/** Schema-name discriminator carried by every session snapshot. */
export const RENDERER_SESSION_SNAPSHOT_SCHEMA_NAME = 'epoch.renderer-session-snapshot' as const;

/** Schema-name discriminator carried by every switch request. */
export const RENDERER_SWITCH_REQUEST_SCHEMA_NAME = 'epoch.renderer-switch-request' as const;

/** Schema-name discriminator carried by every switch receipt. */
export const RENDERER_SWITCH_RECEIPT_SCHEMA_NAME = 'epoch.renderer-switch-receipt' as const;

/** Schema-name discriminator carried by every frame envelope. */
export const RENDERER_FRAME_ENVELOPE_SCHEMA_NAME = 'epoch.renderer-frame-envelope' as const;

/** Schema-name discriminator carried by every input envelope. */
export const RENDERER_INPUT_ENVELOPE_SCHEMA_NAME = 'epoch.renderer-input-envelope' as const;

/** Schema-name discriminator carried by every intent receipt. */
export const RENDERER_INTENT_RECEIPT_SCHEMA_NAME = 'epoch.renderer-intent-receipt' as const;

/** Schema-name discriminator carried by every asset binding. */
export const RENDERER_ASSET_BINDING_SCHEMA_NAME = 'epoch.renderer-asset-binding' as const;

/** Schema-name discriminator carried by every conformance result. */
export const RENDERER_CONFORMANCE_SCHEMA_NAME = 'epoch.renderer-conformance-result' as const;

/**
 * The document kinds of the renderer contract (manifest inventory; each kind
 * is a distinct serialized document with its own schema discriminator).
 * W056 added the fabric document kinds (additive).
 */
export const RENDERER_DOCUMENT_KINDS = [
  'renderer.asset-binding',
  'renderer.binding',
  'renderer.conformance-result',
  'renderer.descriptor',
  'renderer.frame-envelope',
  'renderer.input-envelope',
  'renderer.intent-receipt',
  'renderer.invocation',
  'renderer.receipt',
  'renderer.session',
  'renderer.session-snapshot',
  'renderer.switch-receipt',
  'renderer.switch-request',
] as const;

/** One renderer document kind. */
export type RendererDocumentKind = (typeof RENDERER_DOCUMENT_KINDS)[number];

/** Version discriminator of the abstract renderer descriptor. */
export const RENDERER_DESCRIPTOR_VERSION = 1 as const;

/**
 * The lifecycle states of a renderer session binding: `open` admits
 * invocations; `closed` is terminal.
 */
export const RENDERER_BINDING_STATES = ['closed', 'open'] as const;

/** One renderer-binding state. */
export type RendererBindingState = (typeof RENDERER_BINDING_STATES)[number];

export const RendererBindingStateSchema = z.enum(RENDERER_BINDING_STATES).meta({
  id: 'RendererBindingState',
  title: 'RendererBindingState',
  description: 'Lifecycle state of a renderer session binding: open (admits invocations) or closed (terminal).',
});

/**
 * The typed invocation kinds the hosting surface executes (the renderer
 * runtime EXECUTES plans, it never authors them):
 * - `mount-graph` — install/replace the render-ready state (a sealed W011
 *   Experience Graph, referenced by content digest);
 * - `advance-frame` — execute one frame against the mounted state at a
 *   virtual time;
 * - `submit-intent` — admit one typed control intent (R30) from a
 *   declared interaction modality.
 */
export const RENDERER_INVOCATION_KINDS = ['advance-frame', 'mount-graph', 'submit-intent'] as const;

/** One invocation kind. */
export type RendererInvocationKind = (typeof RENDERER_INVOCATION_KINDS)[number];

export const RendererInvocationKindSchema = z.enum(RENDERER_INVOCATION_KINDS).meta({
  id: 'RendererInvocationKind',
  title: 'RendererInvocationKind',
  description: 'Typed invocation kind executed by the renderer hosting surface.',
});

/**
 * The typed receipt kinds — one per invocation kind: the content-addressed
 * execution evidence of the hosting surface (R26 visible/replayable
 * activity).
 */
export const RENDERER_RECEIPT_KINDS = ['frame-receipt', 'intent-receipt', 'mount-receipt'] as const;

/** One receipt kind. */
export type RendererReceiptKind = (typeof RENDERER_RECEIPT_KINDS)[number];

export const RendererReceiptKindSchema = z.enum(RENDERER_RECEIPT_KINDS).meta({
  id: 'RendererReceiptKind',
  title: 'RendererReceiptKind',
  description: 'Typed receipt kind: the execution evidence of one admitted invocation.',
});

/**
 * The typed renderer-error taxonomy. Every admission or enforcement
 * failure is one of these codes (never a bare throw):
 * - `budget-exceeded` — a graph or declared usage beyond the effective
 *   limits of the binding (nodes, edges, triangles, texture bytes);
 * - `capability-denied` — use of a capability the binding does not
 *   declare (graph kind, interaction modality) — the W008 permission
 *   pattern applied to renderers: anything not declared is denied;
 * - `cross-tenant-denied` — a binding, graph, or operation outside the
 *   owning tenant (R12);
 * - `digest-mismatch` — a sealed record whose claimed digest does not
 *   match its content, or a mount envelope whose claimed graph digest does
 *   not match the supplied graph document (tamper detection);
 * - `invalid-invocation` — a semantic contract violation (non-monotonic
 *   frame index, missing declared usage against a bounded resource);
 * - `malformed-invocation` — invocation-envelope schema violations
 *   (strict objects reject unknown/vendor fields here), including wrapped
 *   W011 graph-admission failures carried as a typed `cause`;
 * - `malformed-record` — descriptor/binding/receipt schema violations;
 * - `session-closed` — an invocation (or close) on a closed binding;
 * - `unknown-session` — an envelope targeting a different renderer
 *   session than the binding's;
 * - `version-unsupported` — protocolVersion skew, checked first.
 */
export const RENDERER_ERROR_CODES = [
  'budget-exceeded',
  'capability-denied',
  'cross-tenant-denied',
  'digest-mismatch',
  'invalid-invocation',
  'malformed-invocation',
  'malformed-record',
  'session-closed',
  'unknown-session',
  'version-unsupported',
] as const;

/** One typed renderer-error code. */
export type RendererErrorCode = (typeof RENDERER_ERROR_CODES)[number];

export const RendererErrorCodeSchema = z.enum(RENDERER_ERROR_CODES).meta({
  id: 'RendererErrorCode',
  title: 'RendererErrorCode',
  description: 'Typed renderer-error code of the renderer hosting surface.',
});

// ---------------------------------------------------------------------------
// Determinism bounds (DoS discipline; all limits are integers).
// ---------------------------------------------------------------------------

/** Ceiling on a renderer's declared per-graph node budget. */
export const MAX_RENDERER_GRAPH_NODES = 65_536;

/** Ceiling on a renderer's declared per-graph edge budget. */
export const MAX_RENDERER_GRAPH_EDGES = 131_072;

/** Ceiling on a renderer's declared per-frame triangle budget. */
export const MAX_RENDERER_TRIANGLES = 100_000_000;

/** Ceiling on a renderer's declared texture-memory budget (1 TiB). */
export const MAX_RENDERER_TEXTURE_BYTES = 1_099_511_627_776;

/** Ceiling on a renderer's declared output pixel budget. */
export const MAX_RENDERER_OUTPUT_PIXELS = 268_435_456;

/** Ceiling on a renderer's declared refresh rate (Hz). */
export const MAX_RENDERER_REFRESH_HZ = 1_000;

/** Ceiling on a renderer's declared color depth (bits per channel). */
export const MAX_RENDERER_COLOR_DEPTH_BITS = 64;

// ---------------------------------------------------------------------------
// W056 fabric vocabularies (Renderer Fabric & Multi-Renderer Switching).
// ---------------------------------------------------------------------------

/**
 * The lifecycle states of a renderer fabric session (W056). `created` admits
 * no frames yet (mount pending); `active` presents; `degraded` presents at a
 * typed reduced fidelity (never silently); `suspended` holds no presentation
 * (e.g. backgrounded) but can resume; `disposed` is terminal.
 */
export const RENDERER_SESSION_STATES = [
  'active',
  'created',
  'degraded',
  'disposed',
  'suspended',
] as const;

/** One renderer-session state. */
export type RendererSessionState = (typeof RENDERER_SESSION_STATES)[number];

export const RendererSessionStateSchema = z.enum(RENDERER_SESSION_STATES).meta({
  id: 'RendererSessionState',
  title: 'RendererSessionState',
  description:
    'Lifecycle state of a renderer fabric session: created, active, degraded, suspended, or disposed (terminal).',
});

/**
 * The health states a renderer (adapter or session) reports: `healthy`,
 * `degraded` (presenting at reduced fidelity — typed, never silent),
 * `failed` (cannot present; recovery/fallback is the host's decision), or
 * `unavailable` (cannot even be probed/initialized).
 */
export const RENDERER_HEALTH_STATES = ['degraded', 'failed', 'healthy', 'unavailable'] as const;

/** One renderer health state. */
export type RendererHealthState = (typeof RENDERER_HEALTH_STATES)[number];

export const RendererHealthStateSchema = z.enum(RENDERER_HEALTH_STATES).meta({
  id: 'RendererHealthState',
  title: 'RendererHealthState',
  description: 'Health state of a renderer adapter or session: healthy, degraded, failed, or unavailable.',
});

/**
 * The typed presentation-fidelity degradations a renderer may declare and
 * apply. A degradation is PRESENTATION-ONLY: it may never alter semantics.
 * `none` is the neutral no-degradation marker every set must carry.
 */
export const RENDERER_DEGRADATION_KINDS = ['none', 'reduced-fidelity', 'static-frame', 'wireframe'] as const;

/** One degradation kind. */
export type RendererDegradationKind = (typeof RENDERER_DEGRADATION_KINDS)[number];

export const RendererDegradationKindSchema = z.enum(RENDERER_DEGRADATION_KINDS).meta({
  id: 'RendererDegradationKind',
  title: 'RendererDegradationKind',
  description:
    'Typed presentation-fidelity degradation a renderer may apply (never a semantic change): none, reduced-fidelity, static-frame, or wireframe.',
});

/**
 * The raw input kinds a renderer input envelope can carry (modality-neutral
 * primitive gestures; the ADAPTER normalizes them into typed Epoch intents).
 */
export const RENDERER_INPUT_KINDS = [
  'key-down',
  'key-up',
  'pointer-down',
  'pointer-move',
  'pointer-up',
  'wheel',
] as const;

/** One raw input kind. */
export type RendererInputKind = (typeof RENDERER_INPUT_KINDS)[number];

export const RendererInputKindSchema = z.enum(RENDERER_INPUT_KINDS).meta({
  id: 'RendererInputKind',
  title: 'RendererInputKind',
  description: 'Raw input kind of a renderer input envelope: pointer or key primitive gestures.',
});

/**
 * The portable view-state fields a renderer can restore after a switch (the
 * switching invariant's portable subset). Fields an adapter does not declare
 * are restored as NO-OPs with a typed note — never silently, never
 * semantically.
 */
export const PORTABLE_VIEW_STATE_FIELDS = [
  'camera',
  'focused-entities',
  'layer-visibility',
  'timeline-position',
] as const;

/** One portable view-state field. */
export type PortableViewStateField = (typeof PORTABLE_VIEW_STATE_FIELDS)[number];

export const PortableViewStateFieldSchema = z.enum(PORTABLE_VIEW_STATE_FIELDS).meta({
  id: 'PortableViewStateField',
  title: 'PortableViewStateField',
  description:
    'One portable view-state field a renderer can restore across a switch: camera, focused-entities, layer-visibility, or timeline-position.',
});

/**
 * The content-addressed asset kinds a renderer can bind. External engines
 * receive assets only through typed {@link RendererAssetBinding}s.
 */
export const RENDERER_ASSET_KINDS = ['animation', 'material', 'mesh', 'texture'] as const;

/** One asset kind. */
export type RendererAssetKind = (typeof RENDERER_ASSET_KINDS)[number];

export const RendererAssetKindSchema = z.enum(RENDERER_ASSET_KINDS).meta({
  id: 'RendererAssetKind',
  title: 'RendererAssetKind',
  description: 'Content-addressed asset kind a renderer can bind: animation, material, mesh, or texture.',
});

/**
 * The trust states of an asset binding. Untrusted assets remain untrusted
 * until explicit validation; an untrusted asset never mounts.
 */
export const RENDERER_ASSET_TRUST_STATES = ['untrusted', 'validated'] as const;

/** One asset trust state. */
export type RendererAssetTrustState = (typeof RENDERER_ASSET_TRUST_STATES)[number];

export const RendererAssetTrustStateSchema = z.enum(RENDERER_ASSET_TRUST_STATES).meta({
  id: 'RendererAssetTrustState',
  title: 'RendererAssetTrustState',
  description: 'Trust state of a renderer asset binding: untrusted (never mounts) or validated.',
});

/**
 * The outcomes of one input-translation (normalization) attempt:
 * `normalized` (a typed Epoch intent was emitted and admitted),
 * `no-target` (the input hit no semantic entity — no intent), or
 * `rejected` (the normalization was refused with a typed failure).
 */
export const RENDERER_INTENT_OUTCOMES = ['no-target', 'normalized', 'rejected'] as const;

/** One intent-receipt outcome. */
export type RendererIntentOutcome = (typeof RENDERER_INTENT_OUTCOMES)[number];

export const RendererIntentOutcomeSchema = z.enum(RENDERER_INTENT_OUTCOMES).meta({
  id: 'RendererIntentOutcome',
  title: 'RendererIntentOutcome',
  description:
    'Outcome of one renderer input normalization: normalized, no-target, or rejected (typed).',
});

/**
 * The conformance check kinds of the renderer conformance harness (the
 * spec/renderer-fabric-architecture.md conformance list, typed).
 */
export const RENDERER_CONFORMANCE_CHECK_KINDS = [
  'digest-continuity',
  'interaction-outcomes',
  'normalized-intents',
  'presentation-only-differences',
  'semantic-entity-ids',
  'semantic-focus-layers',
  'tenant-continuity',
] as const;

/** One conformance check kind. */
export type RendererConformanceCheckKind = (typeof RENDERER_CONFORMANCE_CHECK_KINDS)[number];

export const RendererConformanceCheckKindSchema = z.enum(RENDERER_CONFORMANCE_CHECK_KINDS).meta({
  id: 'RendererConformanceCheckKind',
  title: 'RendererConformanceCheckKind',
  description:
    'One renderer conformance check kind: tenant continuity, digest continuity, semantic entity ids, interaction outcomes, semantic focus/layers, normalized intents, or presentation-only differences.',
});

/**
 * The typed renderer-fabric failure taxonomy (W056). Every fabric
 * orchestration failure is one of these codes (never a bare throw); the
 * underlying W013 hosting errors ride along as typed `cause` values where a
 * hosting-surface admission produced the failure.
 */
export const RENDERER_FAILURE_CODES = [
  'adapter-unavailable',
  'asset-rejected',
  'cross-tenant-denied',
  'degraded',
  'fallback-applied',
  'input-unsupported',
  'invalid-fabric-record',
  'mount-failed',
  'probe-rejected',
  'session-disposed',
  'session-failed',
  'switch-aborted',
  'switch-incompatible',
  'unknown-session',
] as const;

/** One typed fabric failure code. */
export type RendererFailureCode = (typeof RENDERER_FAILURE_CODES)[number];

export const RendererFailureCodeSchema = z.enum(RENDERER_FAILURE_CODES).meta({
  id: 'RendererFailureCode',
  title: 'RendererFailureCode',
  description: 'Typed failure code of the renderer fabric orchestration surface.',
});

/**
 * The W056 capability-set record version (the version discriminator of
 * RendererCapabilitySet documents).
 */
export const RENDERER_CAPABILITY_VERSION = 1 as const;

// --- W056 determinism bounds (DoS discipline; all limits are integers). ---

/** Ceiling on focused entities in one portable view state (W016 mirror). */
export const MAX_PORTABLE_FOCUSED_ENTITIES = 64;

/** Ceiling on semantic layers in one portable view state. */
export const MAX_PORTABLE_LAYERS = 256;

/** Ceiling on the entity-id set of one portable view state (W016 mirror). */
export const MAX_PORTABLE_ENTITY_IDS = 4096;

/** Maximum length of a neutral detail/label string on fabric records. */
export const MAX_FABRIC_DETAIL_LENGTH = 512;

/** Ceiling on conformance checks recorded in one conformance result. */
export const MAX_CONFORMANCE_CHECKS = 64;

/** Ceiling on renderers covered by one conformance result. */
export const MAX_CONFORMANCE_RENDERERS = 8;

/** Ceiling on fallback renderers in one switch request. */
export const MAX_SWITCH_FALLBACKS = 4;

/** Ceiling on modifier keys carried by one input envelope. */
export const MAX_INPUT_MODIFIERS = 8;

/** Maximum length of a normalized input key token. */
export const MAX_INPUT_KEY_LENGTH = 64;
