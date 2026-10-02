/**
 * THE WORLD WORKSPACE RUNTIME (W057) — the host-side runtime that makes
 * the spatial world the PRIMARY Epoch problem-solving workspace.
 *
 * What the runtime OWNS (and only that):
 * - the WALL-CLOCK HOST LOOP (the TL-confirmed advisory: the fabric core
 *   stays virtual-time-only; this runtime is the only wall-clock reader
 *   and derives every virtual time it hands the fabric from the injected
 *   clock) — presentation pacing (frame envelopes), the presentation
 *   timeline clock, and health polling;
 * - the EPHEMERAL NAVIGATION/CAMERA presentation state (orbit/pan/zoom +
 *   desktop navigation keys) — presentation-only, round-tripped through
 *   the existing portable-camera contract; orbit/pan never produce
 *   intents (camera interpolation stays presentation-only per the
 *   renderer-fabric architecture), while SEMANTIC zoom flows through the
 *   existing typed zoom intent;
 * - SEMANTIC LAYER derivation (a pure projection of entity types) and the
 *   layer operations as EXISTING typed intents (hide/show/filter);
 * - the intent composition for workspace commands (timeline transport,
 *   layer toggles, agent follow, measurement/annotation affordances,
 *   scene controls, branch/simulation entry) — every one an EXISTING
 *   @epoch/world-experience intent admitted through the W016 total
 *   admission and applied through the W016 reducer;
 * - renderer selection/health/fallback orchestration through the REAL
 *   RendererFabric (resolve → probe → create → mount → frame → input →
 *   switch → dispose), including the real switching invariant with the
 *   ordered fallback chain.
 *
 * What the runtime NEVER does:
 * - it never mutates the canonical scene directly: every view-state change
 *   goes through the W016 pure store/reducer (applyWorldIntent /
 *   applySceneOverlay) — no second semantic store (lock rules 8/16);
 * - it never persists anything and never routes effects to authorities:
 *   semantic effects (inspect/measure/simulate/branch/...) are SURFACED to
 *   the host (typed records) — executing them is the app's authority
 *   wiring (Action Gateway / simulation fabric / world model), never the
 *   UI's;
 * - it never imports an engine: the default presenter is the contract-only
 *   ReferenceRendererAdapter resolved through the fabric registry — the
 *   same mount W058/W059's real engines occupy;
 * - it never reads the wall clock anywhere except the injected HostClock.
 *
 * Scene revisions and the frozen fabric: a fabric session presents ONE
 * exact world revision (the W056 digest-continuity invariant), so every
 * canonical revision is presented by a FRESH session: capture the portable
 * view state → dispose the previous session → create the next session
 * with the new world projection → mount the canonical scene. Sessions are
 * ephemeral presentation state by construction; renderer SWITCHING (same
 * revision) uses the REAL fabric switching invariant with fallback.
 */
import type {
  DeviceSessionSnapshot,
  RendererHealth,
  RendererIntentReceipt,
  RendererSession,
} from '@epoch/renderer-runtime';
import {
  RendererFabric,
  type SwitchOutcome,
} from '@epoch/renderer-fabric';
import {
  applySceneOverlay,
  applyWorldIntent,
  emptyWorldSceneStore,
  replaceWorldScene,
  type WorldIntentEffect,
  type WorldInteractionIntent,
  type WorldOntology,
  type WorldScene,
  type WorldSceneStoreState,
} from '@epoch/world-experience';
import { HostLoop, type FrameScheduler, type HostClock } from './clock';
import { IdSequence } from './ids';
import { applyNavigationGesture, applyZoomFactor, navigationFromCamera, projectPoint, type NavigationGesture, type NavigationState } from './navigation';
import type { ProjectedImage } from './view-models';
import { deriveLayers, type SemanticLayer } from './layers';
import {
  buildAnnotateIntent,
  buildFollowAgentIntent,
  buildHideIntent,
  buildMeasureIntent,
  buildPauseIntent,
  buildReplayIntent,
  buildResumeIntent,
  buildShowIntent,
  buildFilterIntent,
  intentForControl,
  intentHintOfTool,
  type RuntimeResult,
} from './intents';
import {
  projectViewport,
  projectInspect,
  projectTimeline,
  projectRenderers,
  projectControls,
  portableViewStateOf,
  sceneUsageOf,
  timelineEndOf,
  type EffectEntry,
  type JournalEntry,
  type WorkspaceViewModel,
} from './view-models';
import {
  MAX_EFFECT_ENTRIES,
  MAX_JOURNAL_ENTRIES,
  type NavigationKey,
  type WorldTool,
} from './version';

/** The construction input of one workspace runtime. */
export interface WorldWorkspaceInput {
  /** The deterministic id slug (every derived id is prefixed with it). */
  readonly slug: string;
  /** The REAL renderer fabric (adapters registered by the caller). */
  readonly fabric: RendererFabric;
  /** The canonical fixture-problem scene (never mutated; re-sealed revisions only). */
  readonly scene: WorldScene;
  /** The ontology resolving the scene's representation records. */
  readonly ontology: WorldOntology;
  /** The device session the renderer binds to (W013 snapshot). */
  readonly device: DeviceSessionSnapshot;
  /** The wall clock (the runtime's ONLY time source; inject a manual clock for tests). */
  readonly clock: HostClock;
  /** The frame scheduler of the host loop (inject a manual scheduler for tests). */
  readonly scheduler: FrameScheduler;
  /**
   * The ordered renderer preference: the first resolvable entry presents;
   * the rest are the fallback chain for switches and failures.
   */
  readonly rendererPreference: readonly string[];
}

/** The outcome of one viewport input through the fabric seam. */
export interface ViewportInputOutcome {
  /** The sealed intent receipt (admission evidence), when the fabric accepted the input. */
  readonly receipt: RendererIntentReceipt;
  /** Whether an intent was applied to the canonical scene (a new revision may exist). */
  readonly applied: boolean;
  /** The world digest of the CURRENT canonical revision after the input. */
  readonly worldDigest: string;
}

/** The summary of one renderer switch (the fabric's sealed evidence, condensed). */
export interface SwitchSummary {
  readonly fromRendererId: string;
  readonly toRendererId: string;
  readonly switchReceiptDigest: string;
  readonly restoredViewFields: readonly string[];
  readonly skippedViewFields: readonly string[];
  readonly fallbackApplied: boolean;
  readonly worldDigest: string;
}

/** The workspace runtime. Construct per workspace mount; dispose on unmount. */
export class WorldWorkspaceRuntime {
  private readonly input: WorldWorkspaceInput;
  private readonly ids: IdSequence;
  private store: WorldSceneStoreState;
  private readonly loop: HostLoop;
  private readonly journal: JournalEntry[] = [];
  private readonly effects: EffectEntry[] = [];

  private fabricSessionId: string | null = null;
  private rendererId: string | null = null;
  private navigation: NavigationState;
  private activeTool: WorldTool = 'select';
  private presentationAtMs: number;
  private lastPickedEntityId: string | null = null;
  private measurementFrom: string | null = null;
  private lastFailure: { readonly code: string; readonly message: string } | null = null;
  private lastSwitchDigest: string | null = null;
  private restoredViewFields: readonly string[] = [];
  private fallbackApplied = false;
  private health: RendererHealth | null = null;
  private lastSessionState = 'closed';
  private loopRunning = false;
  private frameBusy = false;
  private onViewModel: ((viewModel: WorkspaceViewModel) => void) | null = null;
  private onEffect: ((effect: WorldIntentEffect) => void) | null = null;
  private disposed = false;

  constructor(input: WorldWorkspaceInput) {
    this.input = input;
    this.ids = new IdSequence(input.slug);
    this.store = replaceWorldScene(emptyWorldSceneStore(), input.scene);
    this.navigation = navigationFromCamera(input.scene.camera);
    this.presentationAtMs = input.scene.timeline.position.atMs;
    this.loop = new HostLoop(input.clock, input.scheduler);
  }

  // -------------------------------------------------------------------------
  // Lifecycle.
  // -------------------------------------------------------------------------

  /** Open the workspace: resolve the preferred renderer and mount the canonical scene. */
  async open(): Promise<RuntimeResult<RendererSession>> {
    if (this.disposed) {
      return { ok: false, error: { code: 'session-disposed', message: 'the workspace runtime is disposed' } };
    }
    const resolved = this.resolvePreferredRenderer();
    if (!resolved.ok) {
      return resolved;
    }
    this.rendererId = resolved.value;
    const opened = await this.presentRevision(this.nowMs());
    if (!opened.ok) {
      return opened;
    }
    return { ok: true, value: opened.value };
  }

  /** Dispose the workspace (stops the loop, disposes the session — terminal). */
  async close(): Promise<void> {
    this.stopHostLoop();
    if (this.fabricSessionId !== null) {
      await this.input.fabric.disposeSession(this.fabricSessionId, this.nowMs());
      this.fabricSessionId = null;
    }
    this.lastSessionState = 'disposed';
    this.disposed = true;
  }

  // -------------------------------------------------------------------------
  // The host loop (wall-clock presentation pacing).
  // -------------------------------------------------------------------------

  /** Start the host loop (frames, presentation clock, health polling). */
  startHostLoop(): void {
    if (this.loopRunning || this.disposed) return;
    this.loopRunning = true;
    this.loop.start((tick) => {
      void this.onTick(tick.atMs, tick.deltaMs);
    });
  }

  /** Stop the host loop. */
  stopHostLoop(): void {
    this.loopRunning = false;
    this.loop.stop();
  }

  /** Whether the host loop is running. */
  get isLoopRunning(): boolean {
    return this.loop.isRunning;
  }

  /** Observe view-model changes (the loop notifies after every tick). */
  setViewModelObserver(observer: ((viewModel: WorkspaceViewModel) => void) | null): void {
    this.onViewModel = observer;
  }

  /** Observe surfaced semantic effects (the host routes them to authorities). */
  setEffectObserver(observer: ((effect: WorldIntentEffect) => void) | null): void {
    this.onEffect = observer;
  }

  // -------------------------------------------------------------------------
  // Viewport input — the RendererFabric seam (semantic picking).
  // -------------------------------------------------------------------------

  /**
   * Submit one pointer-down into the viewport: the raw input goes through
   * the REAL fabric (adapter hit-test + normalization → W016 admission →
   * W013 submit-intent admission → sealed receipt). The receipt's hit
   * entity is the SEMANTIC PICK; the runtime then applies the typed intent
   * through the W016 reducer (canonical composition: the hit comes from
   * the adapter; free parameters follow the workspace's documented
   * deterministic policy).
   */
  async dispatchPointerDown(pointer: {
    readonly x: number;
    readonly y: number;
  }): Promise<RuntimeResult<ViewportInputOutcome>> {
    const atMs = this.nowMs();
    const fabricSessionId = this.requireSession();
    if (fabricSessionId === null) {
      return { ok: false, error: { code: 'unknown-session', message: 'no renderer session is open' } };
    }
    const inputId = this.ids.inputId();
    const envelope = {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId,
      fabricSessionId,
      atMs,
      modality: 'pointer',
      inputKind: 'pointer-down',
      pointer: { x: pointer.x, y: pointer.y },
      intentHint: { intent: intentHintOfTool(this.activeTool) },
    };
    const submitted = await this.input.fabric.submitInput(fabricSessionId, envelope);
    if (!submitted.ok) {
      this.recordFailure(submitted.error.code, submitted.error.message);
      this.pushJournal({
        atMs,
        source: 'viewport-input',
        intentKind: this.activeTool,
        controlIntentId: `epoch.world.interaction.${this.activeTool}`,
        outcome: 'rejected',
        detail: submitted.error.message,
      });
      return { ok: false, error: { code: submitted.error.code, message: submitted.error.message } };
    }
    const receipt = submitted.value;
    this.refreshHealthQuietly();
    if (receipt.hitEntityId !== undefined) {
      this.lastPickedEntityId = receipt.hitEntityId;
    }

    // A miss is a typed no-target receipt — journaled, nothing applied.
    if (receipt.outcome !== 'normalized' || receipt.intent === undefined) {
      this.pushJournal({
        atMs,
        source: 'viewport-input',
        intentKind: this.activeTool,
        controlIntentId: `epoch.world.interaction.${this.activeTool}`,
        outcome: receipt.outcome === 'no-target' ? 'no-target' : 'rejected',
        detail: receipt.rejectionDetail,
      });
      return {
        ok: true,
        value: { receipt, applied: false, worldDigest: this.currentScene().digest },
      };
    }

    // The pick + kind are CONFIRMED by the adapter's receipt. Compose the
    // canonical typed intent (host composition policy — see module docs)
    // and apply it through the W016 reducer.
    const kind = receipt.intent.id.replace('epoch.world.interaction.', '');
    const composed = this.composeViewportIntent(kind, receipt, atMs);
    if (!composed.ok) {
      this.pushJournal({
        atMs,
        source: 'viewport-input',
        intentKind: kind,
        controlIntentId: receipt.intent.id,
        outcome: 'rejected',
        hitEntityId: receipt.hitEntityId,
        detail: composed.error.message,
      });
      return { ok: false, error: composed.error };
    }
    if (composed.value === null) {
      // The measurement was armed (first pick) — a typed no-apply receipt.
      return {
        ok: true,
        value: { receipt, applied: false, worldDigest: this.currentScene().digest },
      };
    }
    const applied = await this.applyIntent(composed.value, atMs, 'viewport-input');
    if (!applied.ok) {
      return { ok: false, error: applied.error };
    }
    this.pushJournal({
      atMs,
      source: 'viewport-input',
      intentKind: composed.value.kind,
      controlIntentId: receipt.intent.id,
      outcome: applied.value ? 'applied' : 'normalized',
      hitEntityId: receipt.hitEntityId,
      detail: `receipt ${receipt.digest.slice(0, 12)} admitted`,
    });
    return {
      ok: true,
      value: { receipt, applied: applied.value, worldDigest: this.currentScene().digest },
    };
  }

  /**
   * Submit one wheel input: through the fabric seam (the adapter
   * normalizes to the typed zoom intent), then the runtime applies the
   * canonical zoom ladder (1.25 in / 0.8 out — the same deterministic
   * step the contract-only reference adapter documents) through the
   * reducer, syncing the presentation navigation state.
   */
  async dispatchWheel(delta: {
    readonly x: number;
    readonly y: number;
  }): Promise<RuntimeResult<ViewportInputOutcome>> {
    const atMs = this.nowMs();
    const fabricSessionId = this.requireSession();
    if (fabricSessionId === null) {
      return { ok: false, error: { code: 'unknown-session', message: 'no renderer session is open' } };
    }
    const envelope = {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: this.ids.inputId(),
      fabricSessionId,
      atMs,
      modality: 'pointer',
      inputKind: 'wheel',
      delta: { x: delta.x, y: delta.y },
    };
    const submitted = await this.input.fabric.submitInput(fabricSessionId, envelope);
    if (!submitted.ok) {
      this.recordFailure(submitted.error.code, submitted.error.message);
      return { ok: false, error: { code: submitted.error.code, message: submitted.error.message } };
    }
    this.refreshHealthQuietly();
    const receipt = submitted.value;
    if (receipt.outcome !== 'normalized' || delta.y === 0) {
      this.pushJournal({
        atMs,
        source: 'viewport-input',
        intentKind: 'zoom',
        controlIntentId: 'epoch.world.interaction.zoom',
        outcome: receipt.outcome === 'no-target' ? 'no-target' : 'rejected',
        detail: receipt.rejectionDetail,
      });
      return {
        ok: true,
        value: { receipt, applied: false, worldDigest: this.currentScene().digest },
      };
    }
    const factor = delta.y < 0 ? 1.25 : 0.8;
    const composed = {
      schema: 'epoch.world-intent',
      intentVersion: 1,
      kind: 'zoom',
      intentId: this.ids.invocationId(),
      factor,
    } as const;
    const applied = await this.applyIntent(composed, atMs, 'viewport-input');
    if (!applied.ok) {
      return { ok: false, error: applied.error };
    }
    this.navigation = applyZoomFactor(this.navigation, factor);
    this.pushJournal({
      atMs,
      source: 'viewport-input',
      intentKind: 'zoom',
      controlIntentId: 'epoch.world.interaction.zoom',
      outcome: applied.value ? 'applied' : 'normalized',
      detail: `factor ${factor} (receipt ${receipt.digest.slice(0, 12)})`,
    });
    return {
      ok: true,
      value: { receipt, applied: applied.value, worldDigest: this.currentScene().digest },
    };
  }

  // -------------------------------------------------------------------------
  // Navigation (orbit/pan/zoom + desktop keys) — presentation-only.
  // -------------------------------------------------------------------------

  /** Apply one navigation gesture (drag orbit / shift-drag pan / pinch zoom). */
  applyGesture(gesture: NavigationGesture): void {
    this.navigation = applyNavigationGesture(this.navigation, gesture);
    this.notify();
  }

  /** Apply one desktop navigation key (WASD pan, Q/E orbit, R/F elevation, +/- zoom). */
  navigate(key: NavigationKey): void {
    // The pan step scales with the orbit distance (constant screen-space
    // speed at any zoom); the gesture handler derives the camera basis.
    const step = this.navigation.distance * 0.12;
    switch (key) {
      case 'w':
        this.applyGesture({ kind: 'pan', deltaX: 0, deltaY: step });
        break;
      case 's':
        this.applyGesture({ kind: 'pan', deltaX: 0, deltaY: -step });
        break;
      case 'a':
        this.applyGesture({ kind: 'pan', deltaX: step, deltaY: 0 });
        break;
      case 'd':
        this.applyGesture({ kind: 'pan', deltaX: -step, deltaY: 0 });
        break;
      case 'q':
        this.applyGesture({ kind: 'orbit', deltaX: -0.12, deltaY: 0 });
        break;
      case 'e':
        this.applyGesture({ kind: 'orbit', deltaX: 0.12, deltaY: 0 });
        break;
      case 'r':
        this.applyGesture({ kind: 'orbit', deltaX: 0, deltaY: 0.08 });
        break;
      case 'f':
        this.applyGesture({ kind: 'orbit', deltaX: 0, deltaY: -0.08 });
        break;
      case '+':
        this.applyGesture({ kind: 'zoom', deltaX: 0, deltaY: -1 });
        break;
      case '-':
        this.applyGesture({ kind: 'zoom', deltaX: 0, deltaY: 1 });
        break;
    }
  }

  /** Reset the presentation camera to the canonical scene camera. */
  resetNavigation(): void {
    this.navigation = navigationFromCamera(this.currentScene().camera);
    this.notify();
  }

  // -------------------------------------------------------------------------
  // Tools and workspace commands (host-originated typed intents).
  // -------------------------------------------------------------------------

  /** Select the active viewport tool (which typed intent picks normalize toward). */
  setTool(tool: WorldTool): void {
    this.activeTool = tool;
    this.measurementFrom = null;
    this.notify();
  }

  /** The active tool. */
  get tool(): WorldTool {
    return this.activeTool;
  }

  /** Toggle one semantic layer (hide when visible, reveal when hidden/mixed). */
  async toggleLayer(layerId: string): Promise<RuntimeResult<boolean>> {
    const scene = this.currentScene();
    const layer = deriveLayers(scene).find((candidate) => candidate.layerId === layerId);
    if (layer === undefined) {
      return { ok: false, error: { code: 'unknown-layer', message: `no semantic layer "${layerId}" exists in the current scene` } };
    }
    const intent =
      layer.visible
        ? buildHideIntent({ invocationId: this.ids.invocationId(), entityIds: layer.entityIds })
        : buildShowIntent({ invocationId: this.ids.invocationId(), entityIds: layer.entityIds });
    if (!intent.ok) {
      return intent;
    }
    const applied = await this.applyIntent(intent.value, this.nowMs(), 'workspace-command');
    if (!applied.ok) {
      return applied;
    }
    this.pushJournal({
      atMs: this.nowMs(),
      source: 'workspace-command',
      intentKind: intent.value.kind,
      controlIntentId: `epoch.world.interaction.${intent.value.kind}`,
      outcome: applied.value ? 'applied' : 'normalized',
      detail: `layer ${layerId} (${layer.entityIds.length} entities)`,
    });
    return { ok: true, value: applied.value };
  }

  /** Isolate one semantic layer (ONLY its entities visible — the filter intent). */
  async isolateLayer(layerId: string): Promise<RuntimeResult<boolean>> {
    const scene = this.currentScene();
    const layer = deriveLayers(scene).find((candidate) => candidate.layerId === layerId);
    if (layer === undefined) {
      return { ok: false, error: { code: 'unknown-layer', message: `no semantic layer "${layerId}" exists in the current scene` } };
    }
    const intent = buildFilterIntent({
      invocationId: this.ids.invocationId(),
      includeEntityIds: layer.entityIds,
    });
    if (!intent.ok) {
      return intent;
    }
    const applied = await this.applyIntent(intent.value, this.nowMs(), 'workspace-command');
    if (!applied.ok) {
      return applied;
    }
    this.pushJournal({
      atMs: this.nowMs(),
      source: 'workspace-command',
      intentKind: 'filter',
      controlIntentId: 'epoch.world.interaction.filter',
      outcome: applied.value ? 'applied' : 'normalized',
      detail: `isolated layer ${layerId}`,
    });
    return { ok: true, value: applied.value };
  }

  /** Reveal every entity of every layer (the show intent over all entities). */
  async revealAllLayers(): Promise<RuntimeResult<boolean>> {
    const scene = this.currentScene();
    const intent = buildShowIntent({
      invocationId: this.ids.invocationId(),
      entityIds: scene.entities.map((entity) => entity.entityId),
    });
    if (!intent.ok) {
      return intent;
    }
    const applied = await this.applyIntent(intent.value, this.nowMs(), 'workspace-command');
    if (!applied.ok) {
      return applied;
    }
    this.pushJournal({
      atMs: this.nowMs(),
      source: 'workspace-command',
      intentKind: 'show',
      controlIntentId: 'epoch.world.interaction.show',
      outcome: applied.value ? 'applied' : 'normalized',
      detail: 'revealed every layer',
    });
    return { ok: true, value: applied.value };
  }

  /** Follow one agent (the typed follow-agent intent — visible presence). */
  async followAgent(agentId: string): Promise<RuntimeResult<boolean>> {
    const intent = buildFollowAgentIntent({ invocationId: this.ids.invocationId(), agentId });
    if (!intent.ok) {
      return intent;
    }
    const applied = await this.applyIntent(intent.value, this.nowMs(), 'workspace-command');
    if (!applied.ok) {
      return applied;
    }
    this.pushJournal({
      atMs: this.nowMs(),
      source: 'workspace-command',
      intentKind: 'follow-agent',
      controlIntentId: 'epoch.world.interaction.follow-agent',
      outcome: applied.value ? 'applied' : 'normalized',
      hitEntityId: agentId,
      detail: `following ${agentId}`,
    });
    return { ok: true, value: applied.value };
  }

  /** Scrub the timeline to a virtual time (the typed replay intent). */
  async scrubTimeline(toMs: number): Promise<RuntimeResult<boolean>> {
    const intent = buildReplayIntent({ invocationId: this.ids.invocationId(), fromMs: toMs });
    if (!intent.ok) {
      return intent;
    }
    const applied = await this.applyIntent(intent.value, this.nowMs(), 'workspace-command');
    if (!applied.ok) {
      return applied;
    }
    if (applied.value) {
      this.presentationAtMs = this.currentScene().timeline.position.atMs;
    }
    this.pushJournal({
      atMs: this.nowMs(),
      source: 'workspace-command',
      intentKind: 'replay',
      controlIntentId: 'epoch.world.interaction.replay',
      outcome: applied.value ? 'applied' : 'normalized',
      detail: `scrubbed to ${Math.max(0, Math.trunc(toMs))}ms`,
    });
    return { ok: true, value: applied.value };
  }

  /** Pause the timeline (the typed pause intent). */
  async pauseTimeline(): Promise<RuntimeResult<boolean>> {
    const intent = buildPauseIntent({ invocationId: this.ids.invocationId() });
    if (!intent.ok) {
      return intent;
    }
    const applied = await this.applyIntent(intent.value, this.nowMs(), 'workspace-command');
    if (!applied.ok) {
      return applied;
    }
    this.pushJournal({
      atMs: this.nowMs(),
      source: 'workspace-command',
      intentKind: 'pause',
      controlIntentId: 'epoch.world.interaction.pause',
      outcome: applied.value ? 'applied' : 'normalized',
    });
    return { ok: true, value: applied.value };
  }

  /** Resume the timeline (the typed resume intent). */
  async resumeTimeline(): Promise<RuntimeResult<boolean>> {
    const intent = buildResumeIntent({ invocationId: this.ids.invocationId() });
    if (!intent.ok) {
      return intent;
    }
    const applied = await this.applyIntent(intent.value, this.nowMs(), 'workspace-command');
    if (!applied.ok) {
      return applied;
    }
    this.pushJournal({
      atMs: this.nowMs(),
      source: 'workspace-command',
      intentKind: 'resume',
      controlIntentId: 'epoch.world.interaction.resume',
      outcome: applied.value ? 'applied' : 'normalized',
    });
    return { ok: true, value: applied.value };
  }

  /** Compose an annotation on the focused (or last-picked) entity (the typed annotate intent). */
  async composeAnnotation(text: string): Promise<RuntimeResult<boolean>> {
    const scene = this.currentScene();
    const target =
      scene.focusedEntityIds[0] ?? this.lastPickedEntityId ?? scene.entities[0]?.entityId ?? null;
    if (target === null) {
      return { ok: false, error: { code: 'invalid-intent', message: 'no entity to annotate (pick one first)' } };
    }
    const intent = buildAnnotateIntent({
      invocationId: this.ids.invocationId(),
      entityId: target,
      text,
    });
    if (!intent.ok) {
      return intent;
    }
    const applied = await this.applyIntent(intent.value, this.nowMs(), 'workspace-command');
    if (!applied.ok) {
      return applied;
    }
    this.pushJournal({
      atMs: this.nowMs(),
      source: 'workspace-command',
      intentKind: 'annotate',
      controlIntentId: 'epoch.world.interaction.annotate',
      outcome: applied.value ? 'applied' : 'normalized',
      hitEntityId: target,
      detail: `annotation "${text.slice(0, 40)}"`,
    });
    return { ok: true, value: applied.value };
  }

  /** Invoke one scene control (branch/simulation entry — the typed control intents). */
  async invokeControl(
    controlId: string,
    payload?: {
      readonly annotationText?: string | undefined;
      readonly scenarioRef?: string | undefined;
      readonly branchAtMs?: number | undefined;
    },
  ): Promise<RuntimeResult<boolean>> {
    const scene = this.currentScene();
    const control = scene.controls.find((candidate) => candidate.controlId === controlId);
    if (control === undefined) {
      return {
        ok: false,
        error: { code: 'unknown-control', message: `no scene control "${controlId}" exists in the current scene` },
      };
    }
    const intent = intentForControl(control.intent, scene, {
      invocationId: this.ids.invocationId(),
      ...payload,
    });
    if (!intent.ok) {
      return intent;
    }
    const applied = await this.applyIntent(intent.value, this.nowMs(), 'scene-control');
    if (!applied.ok) {
      return applied;
    }
    this.pushJournal({
      atMs: this.nowMs(),
      source: 'scene-control',
      intentKind: intent.value.kind,
      controlIntentId: control.intent.id,
      outcome: applied.value ? 'applied' : 'normalized',
      detail: `control ${controlId}`,
    });
    return { ok: true, value: applied.value };
  }

  // -------------------------------------------------------------------------
  // Renderer selection, health, and fallback (Epoch-owned chrome).
  // -------------------------------------------------------------------------

  /**
   * Switch to one renderer through the REAL fabric switching invariant.
   * The ordered fallback chain is the remaining renderer preference, so a
   * target that cannot present falls back — typed, recorded in the sealed
   * switch receipt, surfaced in the view model.
   */
  async selectRenderer(targetRendererId: string): Promise<RuntimeResult<SwitchSummary>> {
    const fabricSessionId = this.requireSession();
    if (fabricSessionId === null) {
      return { ok: false, error: { code: 'unknown-session', message: 'no renderer session is open' } };
    }
    const scene = this.currentScene();
    const fallbacks = this.input.rendererPreference.filter(
      (candidate) => candidate !== targetRendererId && candidate !== this.rendererId,
    );
    const atMs = this.nowMs();
    const outcome = await this.input.fabric.switchRenderer(
      {
        schema: 'epoch.renderer-switch-request',
        fabricProtocolVersion: '1.0.0',
        switchId: this.ids.switchId(),
        sourceFabricSessionId: fabricSessionId,
        targetRendererId,
        expectedWorldDigest: scene.digest,
        expectedTenantId: scene.tenantScope.tenantId,
        targetFabricSessionId: this.ids.fabricSessionId(),
        fallbackRendererIds: fallbacks,
        atMs,
      },
      {
        scene,
        ontology: this.input.ontology,
        atMs,
        completedAtMs: atMs + 1,
        expectedTenantId: scene.tenantScope.tenantId,
      },
    );
    if (!outcome.ok) {
      this.recordFailure(outcome.error.code, outcome.error.message);
      this.pushJournal({
        atMs,
        source: 'workspace-command',
        intentKind: 'switch-renderer',
        controlIntentId: 'epoch.workspace.renderer-switch',
        outcome: 'rejected',
        detail: `${outcome.error.code}: ${outcome.error.message}`,
      });
      return { ok: false, error: { code: outcome.error.code, message: outcome.error.message } };
    }
    this.applySwitchOutcome(outcome.value);
    this.pushJournal({
      atMs,
      source: 'workspace-command',
      intentKind: 'switch-renderer',
      controlIntentId: 'epoch.workspace.renderer-switch',
      outcome: 'normalized',
      detail: `${outcome.value.receipt.fromRendererId} -> ${outcome.value.receipt.toRendererId}${outcome.value.fallback !== undefined ? ' (fallback applied)' : ''}`,
    });
    return {
      ok: true,
      value: {
        fromRendererId: outcome.value.receipt.fromRendererId,
        toRendererId: outcome.value.receipt.toRendererId,
        switchReceiptDigest: outcome.value.receipt.digest,
        restoredViewFields: outcome.value.restoredViewFields,
        skippedViewFields: outcome.value.skippedViewFields,
        fallbackApplied: outcome.value.fallback !== undefined,
        worldDigest: outcome.value.receipt.worldDigest,
      },
    };
  }

  /** The renderer selector entries (Epoch-owned chrome, from the real registry). */
  rendererChoices(): readonly {
    readonly rendererId: string;
    readonly displayName: string;
    readonly capabilityId: string;
    readonly summary: string;
  }[] {
    return this.input.fabric.adapters.listRenderers().map((entry) => ({
      rendererId: entry.descriptor.rendererId,
      displayName: entry.record.manifest.descriptor.displayName,
      capabilityId: entry.record.manifest.capabilityId,
      summary: summarizeCapabilities(entry.descriptor.rendererId, entry.capabilities),
    }));
  }

  // -------------------------------------------------------------------------
  // Reads.
  // -------------------------------------------------------------------------

  /** The current canonical scene revision (the projection the renderer presents). */
  currentScene(): WorldScene {
    const scene = this.store.scenes.find((candidate) => candidate.sceneId === this.input.scene.sceneId);
    if (scene === undefined) {
      return this.input.scene;
    }
    return scene;
  }

  /** The current fabric session record (or null before open/after dispose). */
  session(): RendererSession | null {
    if (this.fabricSessionId === null) {
      return null;
    }
    const record = this.input.fabric.session(this.fabricSessionId);
    return record.ok ? record.value : null;
  }

  /** The current semantic layers (derived, never cached). */
  layers(): readonly SemanticLayer[] {
    return deriveLayers(this.currentScene());
  }

  /** The projected viewport entity images (NDC + depth per canonical entity). */
  viewportProjections(): readonly (ProjectedImage | null)[] {
    return this.currentScene().entities.map((entity) => {
      const projected = projectPoint(this.navigation, entity.position);
      if (projected.depth <= 0.0001) {
        return null;
      }
      return { x: projected.x, y: projected.y, depth: projected.depth, inFrustum: projected.inFrustum };
    });
  }

  /** The full workspace view model (pure projection of the current state). */
  viewModel(): WorkspaceViewModel {
    const scene = this.currentScene();
    const followedAgentId =
      scene.camera.mode === 'follow-agent' ? scene.camera.agentRef.agentId : null;
    const inspectTarget = this.lastPickedEntityId ?? scene.focusedEntityIds[0] ?? null;
    return {
      viewport: projectViewport({
        scene,
        navigation: this.navigation,
        activeTool: this.activeTool,
        projected: this.viewportProjections(),
        followedAgentId,
      }),
      inspect: projectInspect(scene, inspectTarget),
      layers: deriveLayers(scene),
      timeline: projectTimeline(scene, this.presentationAtMs),
      renderers: projectRenderers({
        choices: this.rendererChoices(),
        session: this.session(),
        sessionState: this.session()?.state ?? this.lastSessionState,
        health: this.health,
        lastFailure: this.lastFailure,
        lastSwitchDigest: this.lastSwitchDigest,
        restoredViewFields: this.restoredViewFields,
        fallbackApplied: this.fallbackApplied,
      }),
      journal: [...this.journal],
      effects: [...this.effects],
      controls: projectControls(scene),
      sceneUsage: sceneUsageOf(scene),
    };
  }

  // -------------------------------------------------------------------------
  // Internals.
  // -------------------------------------------------------------------------

  private requireSession(): string | null {
    return this.fabricSessionId;
  }

  private nowMs(): number {
    return Math.max(0, Math.trunc(this.input.clock.nowMs()));
  }

  private resolvePreferredRenderer(): RuntimeResult<string> {
    for (const rendererId of this.input.rendererPreference) {
      const resolved = this.input.fabric.resolveRenderer(rendererId);
      if (resolved.ok) {
        return { ok: true, value: rendererId };
      }
    }
    return {
      ok: false,
      error: {
        code: 'adapter-unavailable',
        message: `no preferred renderer could be resolved (${this.input.rendererPreference.join(', ') || 'empty preference'})`,
      },
    };
  }

  /**
   * Present the CURRENT canonical revision: a FRESH fabric session (the
   * W056 digest-continuity invariant — one session, one exact world
   * revision), carrying the portable view state derived from the canonical
   * scene + navigation.
   */
  private async presentRevision(atMs: number): Promise<RuntimeResult<RendererSession>> {
    const scene = this.currentScene();
    const previousSessionId = this.fabricSessionId;
    if (previousSessionId !== null) {
      await this.input.fabric.disposeSession(previousSessionId, atMs);
      this.fabricSessionId = null;
    }
    if (this.rendererId === null) {
      return { ok: false, error: { code: 'adapter-unavailable', message: 'no renderer selected' } };
    }
    const viewState = portableViewStateOf({
      scene,
      navigation: this.navigation,
      presentationAtMs: this.presentationAtMs,
      hiddenEntityIds: scene.entities.filter((entity) => !entity.visible).map((entity) => entity.entityId),
    });
    const fabricSessionId = this.ids.fabricSessionId();
    const created = await this.input.fabric.createSession({
      rendererId: this.rendererId,
      device: this.input.device,
      worldProjection: {
        sceneId: scene.sceneId,
        worldDigest: scene.digest,
        tenantScope: scene.tenantScope,
      },
      viewState,
      fabricSessionId,
      atMs,
      expectedTenantId: scene.tenantScope.tenantId,
    });
    if (!created.ok) {
      this.recordFailure(created.error.code, created.error.message);
      return { ok: false, error: { code: created.error.code, message: created.error.message } };
    }
    const mounted = await this.input.fabric.mountScene(fabricSessionId, {
      scene,
      ontology: this.input.ontology,
      atMs,
      expectedTenantId: scene.tenantScope.tenantId,
    });
    if (!mounted.ok) {
      this.recordFailure(mounted.error.code, mounted.error.message);
      await this.input.fabric.disposeSession(fabricSessionId, atMs);
      return { ok: false, error: { code: mounted.error.code, message: mounted.error.message } };
    }
    this.fabricSessionId = fabricSessionId;
    this.lastSessionState = mounted.value.state;
    this.refreshHealthQuietly();
    return { ok: true, value: mounted.value };
  }

  /**
   * Apply one admitted intent through the W016 reducer. Returns ok:false
   * when the REDUCER rejected the intent (a typed semantic rejection —
   * unknown entity, out-of-bounds replay, ...); otherwise returns whether
   * the application produced a new canonical revision (which has been
   * presented on a fresh session).
   */
  private async applyIntent(
    intent: WorldInteractionIntent,
    atMs: number,
    source: JournalEntry['source'],
  ): Promise<RuntimeResult<boolean>> {
    const sceneId = this.input.scene.sceneId;
    const applied = applyWorldIntent(this.store, sceneId, intent, {
      expectedTenantId: this.input.scene.tenantScope.tenantId,
    });
    if (!applied.ok) {
      this.pushJournal({
        atMs,
        source,
        intentKind: intent.kind,
        controlIntentId: `epoch.world.interaction.${intent.kind}`,
        outcome: 'rejected',
        detail: `reducer rejection (${applied.error.code}): ${applied.error.message}`,
      });
      return { ok: false, error: { code: applied.error.code, message: applied.error.message } };
    }
    const previousDigest = this.currentScene().digest;
    const reducerChanged = applied.value.outcome.scene.digest !== previousDigest;
    if (reducerChanged) {
      this.store = replaceWorldScene(this.store, applied.value.outcome.scene);
    }
    await this.surfaceEffects(applied.value.outcome.effects, atMs);
    const overlayChanged =
      this.currentScene().digest !==
      (reducerChanged ? applied.value.outcome.scene.digest : previousDigest);
    if (reducerChanged || overlayChanged) {
      const presented = await this.presentRevision(atMs);
      if (!presented.ok) {
        this.recordFailure(presented.error.code, presented.error.message);
      }
    }
    this.notify();
    return { ok: true, value: reducerChanged };
  }

  /**
   * Surface the typed request effects of one application (inspect /
   * measure / compare / simulate / query / change / connect / disconnect /
   * branch — routed to their authorities by the HOST, never executed
   * here), applying any DECLARED measurement overlay a measure effect
   * matches (the canonical overlay library is part of the scene — applying
   * it is the W016 store surface, never a second store).
   */
  private async surfaceEffects(
    effects: readonly WorldIntentEffect[],
    atMs: number,
  ): Promise<void> {
    for (const effect of effects) {
      this.pushEffect(effect, atMs);
    }
    const measure = effects.find(
      (candidate): candidate is Extract<WorldIntentEffect, { effect: 'measure-requested' }> =>
        candidate.effect === 'measure-requested',
    );
    if (measure === undefined) {
      return;
    }
    const scene = this.currentScene();
    const declared = scene.overlays.find(
      (overlay) =>
        overlay.overlayKind === 'measurement' &&
        ((overlay.fromEntityId === measure.fromEntityId && overlay.toEntityId === measure.toEntityId) ||
          (overlay.fromEntityId === measure.toEntityId && overlay.toEntityId === measure.fromEntityId)),
    );
    if (declared !== undefined && !scene.appliedOverlays.some((a) => a.overlayId === declared.overlayId)) {
      const appliedOverlay = applySceneOverlay(this.store, scene.sceneId, declared.overlayId, {
        expectedTenantId: scene.tenantScope.tenantId,
      });
      if (appliedOverlay.ok) {
        this.store = replaceWorldScene(this.store, appliedOverlay.value.scene);
      }
    }
  }

  /**
   * Compose the canonical typed intent for a CONFIRMED viewport pick. The
   * hit entity id comes from the adapter's receipt (semantic picking);
   * free parameters follow the workspace's documented deterministic
   * policy (measure arms a two-pick session; annotation text comes from
   * the composer). Returns null when the pick ARMED a two-step
   * affordance (measurement first pick) rather than issuing an intent.
   */
  private composeViewportIntent(
    kind: string,
    receipt: RendererIntentReceipt,
    atMs: number,
  ): RuntimeResult<WorldInteractionIntent | null> {
    const scene = this.currentScene();
    const hit = receipt.hitEntityId;
    const requiresHit = ['select', 'inspect', 'isolate', 'hide', 'measure', 'annotate'];
    if (requiresHit.includes(kind) && hit === undefined) {
      return { ok: false, error: { code: 'no-target', message: 'the pick hit no presented entity' } };
    }
    switch (kind) {
      case 'select':
      case 'inspect':
      case 'isolate':
        return {
          ok: true,
          value: {
            schema: 'epoch.world-intent',
            intentVersion: 1,
            kind,
            intentId: this.ids.invocationId(),
            entityId: hit as string,
          } as WorldInteractionIntent,
        };
      case 'hide':
        return {
          ok: true,
          value: {
            schema: 'epoch.world-intent',
            intentVersion: 1,
            kind: 'hide',
            intentId: this.ids.invocationId(),
            entityIds: [hit as string],
          } as WorldInteractionIntent,
        };
      case 'measure': {
        // Two-pick composition: the first confirmed pick arms the
        // measurement FROM; the second composes the typed measure intent.
        if (this.measurementFrom === null) {
          this.measurementFrom = hit as string;
          this.pushJournal({
            atMs,
            source: 'viewport-input',
            intentKind: 'measure',
            controlIntentId: 'epoch.world.interaction.measure',
            outcome: 'normalized',
            hitEntityId: hit,
            detail: 'measurement armed (pick the second entity)',
          });
          return { ok: true, value: null };
        }
        const from = this.measurementFrom;
        this.measurementFrom = null;
        if (from === hit) {
          return { ok: false, error: { code: 'invalid-intent', message: 'a measurement needs two distinct entities' } };
        }
        return buildMeasureIntent({
          invocationId: this.ids.invocationId(),
          fromEntityId: from,
          toEntityId: hit as string,
        });
      }
      case 'annotate':
        return buildAnnotateIntent({
          invocationId: this.ids.invocationId(),
          entityId: hit as string,
          text: `Annotation on ${scene.name}`,
        });
      default:
        return {
          ok: false,
          error: {
            code: 'input-unsupported',
            message: `the confirmed intent kind "${kind}" is outside the workspace viewport composition surface`,
          },
        };
    }
  }

  private applySwitchOutcome(outcome: SwitchOutcome): void {
    this.fabricSessionId = outcome.receipt.toFabricSessionId;
    this.rendererId = outcome.receipt.toRendererId;
    this.lastSwitchDigest = outcome.receipt.digest;
    this.restoredViewFields = [...outcome.restoredViewFields];
    this.fallbackApplied = outcome.fallback !== undefined;
    if (outcome.fallback !== undefined) {
      this.lastFailure = { code: outcome.fallback.code, message: outcome.fallback.message };
    } else {
      this.lastFailure = null;
    }
    this.refreshHealthQuietly();
    this.notify();
  }

  private async onTick(atMs: number, deltaMs: number): Promise<void> {
    if (this.disposed) return;
    // Presentation frame pacing through the REAL W013 admission boundary.
    if (this.fabricSessionId !== null && !this.frameBusy) {
      this.frameBusy = true;
      try {
        await this.input.fabric.applyFrame(this.fabricSessionId, { atMs });
      } catch {
        // The fabric returns typed failures; an unexpected throw is
        // surfaced through health on the next refresh (never crashes the loop).
      } finally {
        this.frameBusy = false;
      }
    }
    // The presentation timeline clock (advances only while playing).
    const scene = this.currentScene();
    if (!scene.timeline.position.paused) {
      const end = timelineEndOf(scene);
      this.presentationAtMs = Math.min(end, this.presentationAtMs + deltaMs);
    }
    await this.refreshHealthQuietly();
    this.notify();
  }

  private async refreshHealthQuietly(): Promise<void> {
    if (this.fabricSessionId === null) return;
    const health = await this.input.fabric.healthOf(this.fabricSessionId, this.nowMs());
    if (health.ok) {
      this.health = health.value;
    }
  }

  private recordFailure(code: string, message: string): void {
    this.lastFailure = { code, message };
  }

  private pushJournal(entry: JournalEntry): void {
    this.journal.push(entry);
    if (this.journal.length > MAX_JOURNAL_ENTRIES) {
      this.journal.splice(0, this.journal.length - MAX_JOURNAL_ENTRIES);
    }
  }

  private pushEffect(effect: WorldIntentEffect, atMs: number): void {
    this.effects.push({ atMs, effect });
    if (this.effects.length > MAX_EFFECT_ENTRIES) {
      this.effects.splice(0, this.effects.length - MAX_EFFECT_ENTRIES);
    }
    this.onEffect?.(effect);
  }

  private notify(): void {
    if (this.onViewModel !== null) {
      this.onViewModel(this.viewModel());
    }
  }
}

// ---------------------------------------------------------------------------
// Module-private helpers.
// ---------------------------------------------------------------------------

function summarizeCapabilities(rendererId: string, capabilities: {
  readonly hitTesting: boolean;
  readonly measurement: boolean;
  readonly annotation: boolean;
  readonly frameCapture: boolean;
  readonly degradation: readonly string[];
  readonly portableViewState: readonly string[];
}): string {
  const features: string[] = [];
  if (capabilities.hitTesting) features.push('picking');
  if (capabilities.measurement) features.push('measure');
  if (capabilities.annotation) features.push('annotate');
  if (capabilities.frameCapture) features.push('capture');
  features.push(`${capabilities.portableViewState.length} portable fields`);
  return `${rendererId}: ${features.join(' · ')}`;
}
