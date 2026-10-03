/**
 * World WORKSPACE contracts (W057) — the typed DRIVER + VIEW-MODEL surface
 * of the interactive-world workspace feature module.
 *
 * Design constraint (binding, unchanged from W016): this module lives
 * inside `apps/web` whose manifest is frozen to this Work Order's surface
 * set, so it cannot declare `@epoch/world-runtime` /
 * `@epoch/renderer-fabric` as dependencies and cannot import them.
 * The record-facing types below are therefore STRUCTURAL MIRRORS of the
 * exact `@epoch/world-runtime` public-surface subset this feature
 * consumes (view-models.ts, navigation.ts, layers.ts, version.ts of that
 * package). TypeScript structural typing means the runtime's records are
 * assignable to these interfaces as-is — the parity is pinned by the
 * qa/world-experience harness (type-level + runtime assignment), and the
 * DESKTOP app binds the real runtime directly (apps/desktop, W057).
 *
 * The WORKSPACE contract adds the W016 surface:
 *
 * - the viewport is the PRIMARY workspace surface (a spatial projection of
 *   the canonical scene entities — rendered by the active presenter
 *   behind the seam; renderer-agnostic by construction);
 * - lifecycle/project panels become SECONDARY context surfaces (inspect,
 *   layers, presence, renderers, journal);
 * - every interaction routes through the DRIVER: raw viewport input goes
 *   through the RendererFabric seam (semantic picking → existing typed
 *   Epoch intents), and workspace commands compose the EXISTING typed
 *   intent vocabulary — never a parallel one;
 * - no durable mutation: the driver surfaces typed request effects; the
 *   app's authority surfaces execute them.
 */

// ---------------------------------------------------------------------------
// Mirrored vocabularies (world-runtime version.ts).
// ---------------------------------------------------------------------------

/** The viewport tools (which typed intent a pick normalizes toward). */
export type WorldToolInput =
  | 'select'
  | 'inspect'
  | 'isolate'
  | 'measure'
  | 'annotate'
  | 'hide';

/** The navigation gesture kinds (presentation-only camera operations). */
export type NavigationKindInput = 'orbit' | 'pan' | 'zoom' | 'free-look';

/** The desktop navigation keys (game-like engineering UX). */
export type NavigationKeyInput =
  | 'w'
  | 'a'
  | 's'
  | 'd'
  | 'q'
  | 'e'
  | 'r'
  | 'f'
  | '+'
  | '-';

// ---------------------------------------------------------------------------
// Mirrored navigation state (world-runtime navigation.ts).
// ---------------------------------------------------------------------------

/** The orbit navigation state (presentation-only, never canonical). */
export interface NavigationStateInput {
  readonly target: readonly [number, number, number];
  readonly azimuthRad: number;
  readonly elevationRad: number;
  readonly distance: number;
  readonly fovRadians: number;
}

/** One navigation gesture (drag orbit / pan / zoom; presentation-only). */
export interface NavigationGestureInput {
  readonly kind: NavigationKindInput;
  readonly deltaX: number;
  readonly deltaY: number;
}

// ---------------------------------------------------------------------------
// Mirrored view models (world-runtime view-models.ts + layers.ts).
// ---------------------------------------------------------------------------

/** One presented entity glyph of the viewport. */
export interface ViewportEntityInput {
  readonly entityId: string;
  readonly label: string;
  readonly entityType: string;
  readonly contentDigest: string;
  readonly position: readonly [number, number, number];
  readonly ndc: { readonly x: number; readonly y: number } | null;
  readonly depth: number | null;
  readonly visible: boolean;
  readonly isolated: boolean;
  readonly focused: boolean;
  readonly layerHidden: boolean;
  readonly representationRecordId: string;
}

/** One presented agent marker (visible presence). */
export interface ViewportAgentInput {
  readonly agentId: string;
  readonly contentDigest: string;
  readonly followed: boolean;
}

/** One presented overlay (applied overlays in deterministic order). */
export interface ViewportOverlayInput {
  readonly overlayId: string;
  readonly overlayKind: 'highlight' | 'annotation' | 'measurement' | 'state';
  readonly entityId?: string | undefined;
  readonly fromEntityId?: string | undefined;
  readonly toEntityId?: string | undefined;
  readonly text?: string | undefined;
  readonly color?: string | undefined;
  readonly label?: string | undefined;
}

/** The viewport view model (the primary workspace surface). */
export interface ViewportViewModelInput {
  readonly sceneId: string;
  readonly sceneName: string;
  readonly worldDigest: string;
  readonly tenantId: string;
  readonly entities: readonly ViewportEntityInput[];
  readonly agents: readonly ViewportAgentInput[];
  readonly overlays: readonly ViewportOverlayInput[];
  readonly activeTool: WorldToolInput;
  readonly navigation: NavigationStateInput;
  readonly cameraMode: string;
  readonly followedAgentId: string | null;
}

/** The inspect view model (canonical entity data of the selection). */
export interface InspectViewModelInput {
  readonly entityId: string | null;
  readonly label: string | null;
  readonly entityType: string | null;
  readonly contentDigest: string | null;
  readonly position: readonly [number, number, number] | null;
  readonly visible: boolean;
  readonly isolated: boolean;
  readonly representationRecordId: string | null;
  readonly focusedEntities: readonly string[];
}

/** One semantic layer (derived from entity types; presentation-only). */
export interface SemanticLayerInput {
  readonly layerId: string;
  readonly namespace: string;
  readonly label: string;
  readonly entityIds: readonly string[];
  readonly visible: boolean;
  readonly mixed: boolean;
}

/** The timeline view model (markers + canonical position + presentation clock). */
export interface TimelineViewModelInput {
  readonly trackLabel: string;
  readonly trackStartMs: number;
  readonly trackEndMs: number;
  readonly markers: readonly {
    readonly markerId: string;
    readonly atMs: number;
    readonly label?: string | undefined;
    readonly markerKind: string;
  }[];
  readonly positionAtMs: number;
  readonly frameIndex: number;
  readonly paused: boolean;
  readonly presentationAtMs: number;
}

/** One renderer entry of the Epoch-owned selector. */
export interface RendererChoiceInput {
  readonly rendererId: string;
  readonly displayName: string;
  readonly capabilityId: string;
  readonly active: boolean;
  readonly summary: string;
}

/** The renderer surface: selector + health + fallback evidence. */
export interface RendererSurfaceViewModelInput {
  readonly choices: readonly RendererChoiceInput[];
  readonly activeRendererId: string;
  readonly health: {
    readonly state: string;
    readonly degradation: string;
    readonly lastFailureCode?: string | undefined;
    readonly detail?: string | undefined;
    readonly atMs: number;
  };
  readonly sessionState: string;
  readonly lastFailure: { readonly code: string; readonly message: string } | null;
  readonly lastSwitchDigest: string | null;
  readonly restoredViewFields: readonly string[];
  readonly fallbackApplied: boolean;
}

/** One intent journal entry (every interaction produced a typed intent). */
export interface JournalEntryInput {
  readonly atMs: number;
  readonly source: 'viewport-input' | 'workspace-command' | 'scene-control';
  readonly intentKind: string;
  readonly controlIntentId: string;
  readonly outcome: 'normalized' | 'no-target' | 'rejected' | 'applied';
  readonly hitEntityId?: string | undefined;
  readonly detail?: string | undefined;
}

/** One surfaced typed effect (awaiting its authority — never executed here). */
export interface EffectEntryInput {
  readonly atMs: number;
  readonly effect:
    | { readonly effect: 'inspect-requested'; readonly entityId: string }
    | { readonly effect: 'measure-requested'; readonly fromEntityId: string; readonly toEntityId: string }
    | { readonly effect: 'compare-requested'; readonly leftEntityId: string; readonly rightEntityId: string }
    | { readonly effect: 'simulate-requested'; readonly scenarioRef: string }
    | { readonly effect: 'query-requested'; readonly text: string }
    | { readonly effect: 'change-requested'; readonly entityId: string; readonly propertyPath: string }
    | { readonly effect: 'connect-requested'; readonly fromEntityId: string; readonly toEntityId: string }
    | { readonly effect: 'disconnect-requested'; readonly fromEntityId: string; readonly toEntityId: string }
    | { readonly effect: 'branch-requested'; readonly atMs: number }
    | { readonly effect: 'binding-requested'; readonly bindingDigest: string; readonly tenantId: string };
}

/** One scene-control entry (branch/simulation entry points, R30). */
export interface WorkspaceControlInput {
  readonly controlId: string;
  readonly controlKind: string;
  readonly label: string;
  readonly intentId: string;
}

// ---------------------------------------------------------------------------
// Mirrored session-asset records (world-runtime session-assets.ts, W067).
// ---------------------------------------------------------------------------

/** One imported foundation asset of the digest-addressed registry (W067). */
export interface SessionAssetEntryInput {
  /** The content address of the RAW asset bytes (the registry key). */
  readonly assetDigest: string;
  readonly assetKind: string;
  readonly byteSize: number;
  readonly label: string | null;
  readonly vertexCount: number | null;
  readonly triangleCount: number | null;
  readonly importedAtMs: number;
}

/** One bound-asset ledger entry (digest-addressed binding evidence, W067). */
export interface BoundAssetEntryInput {
  /** The bound asset's content digest — the digest-addressed LEDGER KEY. */
  readonly assetDigest: string;
  /** The sealed binding's content address (the bind intent's reference). */
  readonly bindingDigest: string;
  readonly bindingId: string;
  readonly assetKind: string;
  readonly outcome: 'applied' | 'declined';
  readonly reason: string | null;
  /** The sealed receipt's content address (the typed evidence). */
  readonly receiptDigest: string;
  readonly rendererId: string;
  readonly fabricSessionId: string;
  readonly atMs: number;
}

/** The foundation-asset surface of the workspace view model (W067). */
export interface SessionAssetsViewModelInput {
  readonly imported: readonly SessionAssetEntryInput[];
  readonly ledger: readonly BoundAssetEntryInput[];
}

/** The full workspace view model. */
export interface WorkspaceViewModelInput {
  readonly viewport: ViewportViewModelInput;
  readonly inspect: InspectViewModelInput;
  readonly layers: readonly SemanticLayerInput[];
  readonly timeline: TimelineViewModelInput;
  readonly renderers: RendererSurfaceViewModelInput;
  readonly journal: readonly JournalEntryInput[];
  readonly effects: readonly EffectEntryInput[];
  readonly controls: readonly WorkspaceControlInput[];
  /** The foundation-asset surface (W067): the import registry + the bound-asset ledger. */
  readonly sessionAssets: SessionAssetsViewModelInput;
  readonly sceneUsage: {
    readonly entityCount: number;
    readonly focusedCount: number;
    readonly agentCount: number;
    readonly markerCount: number;
    readonly controlCount: number;
  };
}

// ---------------------------------------------------------------------------
// Mirrored command results (world-runtime workspace.ts).
// ---------------------------------------------------------------------------

/** The typed driver result (typed errors, never throws). */
export type DriverResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

/** The outcome of one viewport input through the fabric seam. */
export interface ViewportInputOutcomeInput {
  readonly receipt: {
    readonly inputId: string;
    readonly inputKind: string;
    readonly hitEntityId?: string | undefined;
    readonly intent?: { readonly id: string; readonly version: string } | undefined;
    readonly outcome: string;
    readonly digest: string;
  };
  readonly applied: boolean;
  readonly worldDigest: string;
}

/** The condensed switch evidence of one renderer switch. */
export interface SwitchSummaryInput {
  readonly fromRendererId: string;
  readonly toRendererId: string;
  readonly switchReceiptDigest: string;
  readonly restoredViewFields: readonly string[];
  readonly skippedViewFields: readonly string[];
  readonly fallbackApplied: boolean;
  readonly worldDigest: string;
}

/** The annotation-composer + control payloads. */
export interface ControlInvocationPayloadInput {
  readonly annotationText?: string | undefined;
  readonly scenarioRef?: string | undefined;
  readonly branchAtMs?: number | undefined;
}

// ---------------------------------------------------------------------------
// THE WORKSPACE DRIVER — the seam the real @epoch/world-runtime satisfies.
// ---------------------------------------------------------------------------

/**
 * The interactive-world workspace driver. The REAL implementation is
 * `WorldWorkspaceRuntime` (@epoch/world-runtime) driving the REAL
 * RendererFabric; this interface is its structural mirror so the web
 * feature renders and commands the workspace without importing the
 * package (the frozen-manifest constraint). The parity is pinned by
 * qa/world-experience.
 */
export interface WorldWorkspaceDriver {
  /** The current workspace view model (pure projection). */
  viewModel(): WorkspaceViewModelInput;
  /** Select the active viewport tool. */
  setTool(tool: WorldToolInput): void;
  /** Apply one navigation gesture (presentation-only camera). */
  applyGesture(gesture: NavigationGestureInput): void;
  /** Apply one desktop navigation key (presentation-only camera). */
  navigate(key: NavigationKeyInput): void;
  /** Reset the presentation camera to the canonical camera record. */
  resetNavigation(): void;
  /** Submit one pointer-down into the viewport (the fabric seam). */
  dispatchPointerDown(pointer: { readonly x: number; readonly y: number }): Promise<DriverResult<ViewportInputOutcomeInput>>;
  /** Submit one wheel input into the viewport (the fabric seam). */
  dispatchWheel(delta: { readonly x: number; readonly y: number }): Promise<DriverResult<ViewportInputOutcomeInput>>;
  /** Toggle one semantic layer (typed hide/show intents). */
  toggleLayer(layerId: string): Promise<DriverResult<boolean>>;
  /** Isolate one semantic layer (typed filter intent). */
  isolateLayer(layerId: string): Promise<DriverResult<boolean>>;
  /** Reveal every layer (typed show intent). */
  revealAllLayers(): Promise<DriverResult<boolean>>;
  /** Follow one agent (typed follow-agent intent). */
  followAgent(agentId: string): Promise<DriverResult<boolean>>;
  /** Scrub the timeline (typed replay intent). */
  scrubTimeline(toMs: number): Promise<DriverResult<boolean>>;
  /** Pause the timeline (typed pause intent). */
  pauseTimeline(): Promise<DriverResult<boolean>>;
  /** Resume the timeline (typed resume intent). */
  resumeTimeline(): Promise<DriverResult<boolean>>;
  /** Compose an annotation on the focused entity (typed annotate intent). */
  composeAnnotation(text: string): Promise<DriverResult<boolean>>;
  /** Invoke one scene control (branch/simulation entry; typed intents). */
  invokeControl(
    controlId: string,
    payload?: ControlInvocationPayloadInput | undefined,
  ): Promise<DriverResult<boolean>>;
  /** Switch the renderer (the REAL fabric switching invariant + fallback). */
  selectRenderer(rendererId: string): Promise<DriverResult<SwitchSummaryInput>>;
  /**
   * Import one UNTRUSTED foundation-asset byte stream through the
   * interchange bridge's trust gate (W067: validate → normalize →
   * content-address); the validated admission registers digest-addressed.
   * A malformed/untrusted stream is the bridge's typed refusal.
   */
  importFoundationAsset(
    bytes: Uint8Array,
    input?: { readonly fileName?: string | undefined } | undefined,
  ): DriverResult<SessionAssetEntryInput>;
  /**
   * Bind one imported foundation asset onto the LIVE session (W067): the
   * typed `bind` intent → the `binding-requested` effect → the fabric
   * session-asset operation. Returns the digest-addressed ledger entry
   * (applied/declined) or the typed refusal; every outcome is journaled.
   */
  bindFoundationAsset(assetDigest: string): Promise<DriverResult<BoundAssetEntryInput>>;
}
