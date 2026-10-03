// W057 — the world WORKSPACE feature tests (web side): the presentational
// contract of the primary spatial surface + the handler wiring that turns
// UI events into driver commands. The full journey against the REAL
// runtime + fabric lives in qa/world-experience (which renders THIS
// component with the real driver); these tests pin the feature in
// isolation with a scripted driver.
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  WorldWorkspace,
  classifyDrag,
  createWorkspaceHandlers,
  dragToGesture,
  isNavigationKey,
  normalizePointer,
} from './index';
import type {
  ViewportInputOutcomeInput,
  WorldWorkspaceDriver,
  WorkspaceViewModelInput,
} from './workspace-contracts';

// ---------------------------------------------------------------------------
// The scripted driver (pure; the REAL driver is @epoch/world-runtime —
// the parity is pinned by qa/world-experience).
// ---------------------------------------------------------------------------

interface ScriptedCommand {
  readonly kind: string;
  readonly payload: readonly unknown[];
}

class ScriptedDriver implements WorldWorkspaceDriver {
  public view: WorkspaceViewModelInput;
  public readonly commands: ScriptedCommand[] = [];

  constructor(view: WorkspaceViewModelInput) {
    this.view = view;
  }

  viewModel(): WorkspaceViewModelInput {
    return this.view;
  }

  setTool(tool: 'select' | 'inspect' | 'isolate' | 'measure' | 'annotate' | 'hide'): void {
    this.commands.push({ kind: 'setTool', payload: [tool] });
    this.view = { ...this.view, viewport: { ...this.view.viewport, activeTool: tool } };
  }

  applyGesture(gesture: { readonly kind: 'orbit' | 'pan' | 'zoom' | 'free-look'; readonly deltaX: number; readonly deltaY: number }): void {
    this.commands.push({ kind: 'applyGesture', payload: [gesture] });
  }

  navigate(key: 'w' | 'a' | 's' | 'd' | 'q' | 'e' | 'r' | 'f' | '+' | '-'): void {
    this.commands.push({ kind: 'navigate', payload: [key] });
  }

  resetNavigation(): void {
    this.commands.push({ kind: 'resetNavigation', payload: [] });
  }

  async dispatchPointerDown(pointer: { readonly x: number; readonly y: number }): Promise<{ ok: true; value: ViewportInputOutcomeInput } | { ok: false; error: { code: string; message: string } }> {
    this.commands.push({ kind: 'dispatchPointerDown', payload: [pointer] });
    return {
      ok: true,
      value: {
        receipt: {
          inputId: 'rin-scripted-1',
          inputKind: 'pointer-down',
          hitEntityId: 'we-site-frame',
          intent: { id: 'epoch.world.interaction.select', version: '1.0.0' },
          outcome: 'normalized',
          digest: 'a'.repeat(64),
        },
        applied: true,
        worldDigest: this.view.viewport.worldDigest,
      },
    };
  }

  async dispatchWheel(delta: { readonly x: number; readonly y: number }): Promise<{ ok: true; value: ViewportInputOutcomeInput } | { ok: false; error: { code: string; message: string } }> {
    this.commands.push({ kind: 'dispatchWheel', payload: [delta] });
    return {
      ok: true,
      value: {
        receipt: {
          inputId: 'rin-scripted-2',
          inputKind: 'wheel',
          intent: { id: 'epoch.world.interaction.zoom', version: '1.0.0' },
          outcome: 'normalized',
          digest: 'b'.repeat(64),
        },
        applied: true,
        worldDigest: this.view.viewport.worldDigest,
      },
    };
  }

  private async booleanCommand(kind: string, payload: readonly unknown[]): Promise<{ ok: true; value: boolean } | { ok: false; error: { code: string; message: string } }> {
    this.commands.push({ kind, payload });
    return { ok: true, value: true };
  }

  toggleLayer(layerId: string) {
    return this.booleanCommand('toggleLayer', [layerId]);
  }

  isolateLayer(layerId: string) {
    return this.booleanCommand('isolateLayer', [layerId]);
  }

  revealAllLayers() {
    return this.booleanCommand('revealAllLayers', []);
  }

  followAgent(agentId: string) {
    return this.booleanCommand('followAgent', [agentId]);
  }

  scrubTimeline(toMs: number) {
    return this.booleanCommand('scrubTimeline', [toMs]);
  }

  pauseTimeline() {
    return this.booleanCommand('pauseTimeline', []);
  }

  resumeTimeline() {
    return this.booleanCommand('resumeTimeline', []);
  }

  composeAnnotation(text: string) {
    return this.booleanCommand('composeAnnotation', [text]);
  }

  invokeControl(controlId: string, payload?: { readonly annotationText?: string | undefined; readonly scenarioRef?: string | undefined; readonly branchAtMs?: number | undefined } | undefined) {
    return this.booleanCommand('invokeControl', [controlId, payload]);
  }

  async selectRenderer(rendererId: string): Promise<{ ok: true; value: { fromRendererId: string; toRendererId: string; switchReceiptDigest: string; restoredViewFields: readonly string[]; skippedViewFields: readonly string[]; fallbackApplied: boolean; worldDigest: string } } | { ok: false; error: { code: string; message: string } }> {
    this.commands.push({ kind: 'selectRenderer', payload: [rendererId] });
    return {
      ok: true,
      value: {
        fromRendererId: 'rr-scripted-full',
        toRendererId: rendererId,
        switchReceiptDigest: 'c'.repeat(64),
        restoredViewFields: ['focused-entities', 'layer-visibility'],
        skippedViewFields: ['camera'],
        fallbackApplied: false,
        worldDigest: this.view.viewport.worldDigest,
      },
    };
  }

  importFoundationAsset(
    bytes: Uint8Array,
    input?: { readonly fileName?: string | undefined } | undefined,
  ): { ok: true; value: import('./workspace-contracts').SessionAssetEntryInput } | { ok: false; error: { code: string; message: string } } {
    this.commands.push({ kind: 'importFoundationAsset', payload: [bytes, input] });
    if (bytes.length === 0) {
      return { ok: false, error: { code: 'input-empty', message: 'the imported foundation asset is empty (zero bytes)' } };
    }
    const assetDigest = 'e'.repeat(64);
    const entry: import('./workspace-contracts').SessionAssetEntryInput = {
      assetDigest,
      assetKind: 'mesh',
      byteSize: bytes.length,
      label: input?.fileName ?? 'scripted-asset.glb',
      vertexCount: 3,
      triangleCount: 1,
      importedAtMs: 1_500,
    };
    this.view = {
      ...this.view,
      sessionAssets: { ...this.view.sessionAssets, imported: [entry] },
    };
    return { ok: true, value: entry };
  }

  async bindFoundationAsset(assetDigest: string): Promise<{ ok: true; value: import('./workspace-contracts').BoundAssetEntryInput } | { ok: false; error: { code: string; message: string } }> {
    this.commands.push({ kind: 'bindFoundationAsset', payload: [assetDigest] });
    const entry: import('./workspace-contracts').BoundAssetEntryInput = {
      assetDigest,
      bindingDigest: 'f'.repeat(64),
      bindingId: 'rab-scripted-asset',
      assetKind: 'mesh',
      outcome: 'applied',
      reason: null,
      receiptDigest: '9'.repeat(64),
      rendererId: this.view.renderers.activeRendererId,
      fabricSessionId: 'fx-scripted-1',
      atMs: 1_600,
    };
    this.view = {
      ...this.view,
      sessionAssets: { ...this.view.sessionAssets, ledger: [entry] },
    };
    return { ok: true, value: entry };
  }
}

// ---------------------------------------------------------------------------
// The scripted view model (the structural shape the runtime produces).
// ---------------------------------------------------------------------------

function scriptedViewModel(): WorkspaceViewModelInput {
  return {
    viewport: {
      sceneId: 'wsc-scripted',
      sceneName: 'Scripted Fixture Problem',
      worldDigest: 'd'.repeat(64),
      tenantId: 'tenant:scripted',
      entities: [
        {
          entityId: 'we-site-frame',
          label: 'Primary frame',
          entityType: 'site:structure',
          contentDigest: '1'.repeat(64),
          position: [12, 0, 0],
          ndc: { x: -0.4, y: -0.2 },
          depth: 31.2,
          visible: true,
          isolated: false,
          focused: true,
          layerHidden: false,
          representationRecordId: 'ont-rep-slab',
        },
        {
          entityId: 'we-mep-panel',
          label: 'Distribution panel',
          entityType: 'mep:panel',
          contentDigest: '2'.repeat(64),
          position: [0, 9, 0],
          ndc: { x: 0.3, y: 0.4 },
          depth: 22.8,
          visible: true,
          isolated: false,
          focused: false,
          layerHidden: false,
          representationRecordId: 'ont-rep-node',
        },
        {
          entityId: 'we-mep-hidden-node',
          label: 'we-mep-hidden-node',
          entityType: 'mep:panel',
          contentDigest: '3'.repeat(64),
          position: [12, 9, 0],
          ndc: null,
          depth: null,
          visible: false,
          isolated: false,
          focused: false,
          layerHidden: true,
          representationRecordId: 'ont-rep-node',
        },
      ],
      agents: [
        { agentId: 'agent:scripted-surveyor', contentDigest: '4'.repeat(64), followed: false },
      ],
      overlays: [
        {
          overlayId: 'ovl-measure-scripted',
          overlayKind: 'measurement',
          fromEntityId: 'we-site-frame',
          toEntityId: 'we-mep-panel',
          label: 'Frame-to-panel run',
        },
        {
          overlayId: 'ovl-annot-scripted',
          overlayKind: 'annotation',
          entityId: 'we-site-frame',
          text: 'Verify the frame anchor',
        },
      ],
      activeTool: 'select',
      navigation: {
        target: [6, 4, 0],
        azimuthRad: 0.8,
        elevationRad: 0.6,
        distance: 33.5,
        fovRadians: Math.PI / 4,
      },
      cameraMode: 'orbit',
      followedAgentId: null,
    },
    inspect: {
      entityId: 'we-site-frame',
      label: 'Primary frame',
      entityType: 'site:structure',
      contentDigest: '1'.repeat(64),
      position: [12, 0, 0],
      visible: true,
      isolated: false,
      representationRecordId: 'ont-rep-slab',
      focusedEntities: ['we-site-frame'],
    },
    layers: [
      {
        layerId: 'lyr-mep',
        namespace: 'mep',
        label: 'Mep',
        entityIds: ['we-mep-hidden-node', 'we-mep-panel'],
        visible: false,
        mixed: true,
      },
      {
        layerId: 'lyr-site',
        namespace: 'site',
        label: 'Site',
        entityIds: ['we-site-frame'],
        visible: true,
        mixed: false,
      },
    ],
    timeline: {
      trackLabel: 'Scripted replay track',
      trackStartMs: 0,
      trackEndMs: 9_000,
      markers: [
        { markerId: 'mrk-base', atMs: 0, label: 'Baseline', markerKind: 'event' },
        { markerId: 'mrk-branch', atMs: 4_000, label: 'Branch point', markerKind: 'branch-point' },
      ],
      positionAtMs: 2_500,
      frameIndex: 61,
      paused: false,
      presentationAtMs: 2_500,
    },
    renderers: {
      choices: [
        {
          rendererId: 'rr-scripted-full',
          displayName: 'Scripted Full (reference)',
          capabilityId: 'epoch.renderer.scripted-full',
          active: true,
          summary: 'picking · measure · annotate',
        },
        {
          rendererId: 'rr-scripted-reduced',
          displayName: 'Scripted Reduced (reference)',
          capabilityId: 'epoch.renderer.scripted-reduced',
          active: false,
          summary: 'picking',
        },
      ],
      activeRendererId: 'rr-scripted-full',
      health: { state: 'healthy', degradation: 'none', atMs: 1_000 },
      sessionState: 'active',
      lastFailure: null,
      lastSwitchDigest: null,
      restoredViewFields: [],
      fallbackApplied: false,
    },
    journal: [
      {
        atMs: 1_200,
        source: 'viewport-input',
        intentKind: 'select',
        controlIntentId: 'epoch.world.interaction.select',
        outcome: 'applied',
        hitEntityId: 'we-site-frame',
        detail: 'receipt abc admitted',
      },
    ],
    effects: [
      {
        atMs: 1_250,
        effect: { effect: 'inspect-requested', entityId: 'we-site-frame' },
      },
    ],
    controls: [
      {
        controlId: 'ctl-branch-here',
        controlKind: 'button',
        label: 'Branch from here',
        intentId: 'epoch.world.interaction.branch',
      },
      {
        controlId: 'ctl-simulate',
        controlKind: 'button',
        label: 'Run delivery simulation',
        intentId: 'epoch.world.interaction.simulate',
      },
    ],
    sessionAssets: {
      imported: [],
      ledger: [],
    },
    sceneUsage: {
      entityCount: 3,
      focusedCount: 1,
      agentCount: 1,
      markerCount: 2,
      controlCount: 2,
    },
  };
}

// ---------------------------------------------------------------------------
// The tests.
// ---------------------------------------------------------------------------

describe('the world workspace component (W057)', () => {
  it('renders the VIEWPORT as the primary surface with the secondary context panels', () => {
    const html = renderToStaticMarkup(createElement(WorldWorkspace, { driver: new ScriptedDriver(scriptedViewModel()) }));
    // The primary surface is the viewport (first, largest region).
    const primaryIndex = html.indexOf('data-workspace-primary');
    const viewportIndex = html.indexOf('data-viewport="world"');
    const secondaryIndex = html.indexOf('data-workspace-secondary');
    expect(primaryIndex).toBeGreaterThan(-1);
    expect(viewportIndex).toBeGreaterThan(primaryIndex);
    expect(secondaryIndex).toBeGreaterThan(viewportIndex);
    // The spatial projection renders the canonical entities + overlays.
    expect(html).toContain('data-viewport-entity="we-site-frame"');
    expect(html).toContain('data-entity-state="focused"');
    expect(html).toContain('data-viewport-overlay="ovl-measure-scripted"');
    expect(html).toContain('data-viewport-overlay="ovl-annot-scripted"');
    expect(html).toContain('Verify the frame anchor');
    // Agent presence is visible in the world.
    expect(html).toContain('data-presence-agent="agent:scripted-surveyor"');
    // The inspect panel shows CANONICAL entity data.
    expect(html).toContain('data-inspect="entityId"');
    expect(html).toContain('we-site-frame');
    // Layers, timeline, renderers, controls, journal render.
    expect(html).toContain('data-layer="lyr-site"');
    expect(html).toContain('data-testid="timeline-position"');
    expect(html).toContain('data-renderer-choice="rr-scripted-reduced"');
    expect(html).toContain('data-scene-control="ctl-branch-here"');
    expect(html).toContain('data-journal-entry="select"');
    expect(html).toContain('Effects awaiting authority');
  });

  it('renders the canonical world digest + health + tools as Epoch-owned chrome', () => {
    const html = renderToStaticMarkup(createElement(WorldWorkspace, { driver: new ScriptedDriver(scriptedViewModel()) }));
    expect(html).toContain('data-world-digest="dddddddddddd');
    expect(html).toContain('data-health="healthy"');
    expect(html).toContain('data-tool="measure"');
    expect(html).toContain('epoch.world.interaction.measure');
  });

  it('offscreen entities render as edge markers, never false spatial claims', () => {
    const html = renderToStaticMarkup(createElement(WorldWorkspace, { driver: new ScriptedDriver(scriptedViewModel()) }));
    expect(html).toContain('data-entity-state="offscreen"');
    expect(html).toContain('(outside view)');
  });

  it('renders the foundation-asset surface (W067): the import affordance + the digest-addressed bound-asset ledger', async () => {
    const driver = new ScriptedDriver(scriptedViewModel());
    // The canonical in-page flow through the handlers: the file bytes go
    // through the driver's trust gate, then the typed bind.
    const handlers = createWorkspaceHandlers(driver);
    handlers.onFoundationImport({ bytes: new Uint8Array(64), fileName: 'riser-caps.glb' });
    await flush();
    expect(driver.commands.map((command) => command.kind)).toEqual([
      'importFoundationAsset',
      'bindFoundationAsset',
    ]);
    // The registered asset + the applied ledger entry render (the
    // digest-addressed evidence surfaces, Epoch-owned chrome).
    const html = renderToStaticMarkup(createElement(WorldWorkspace, { driver }));
    expect(html).toContain('data-panel="foundation"');
    expect(html).toContain('data-testid="foundation-import-input"');
    expect(html).toContain(`data-imported-asset="${'e'.repeat(64)}"`);
    expect(html).toContain(`data-bound-asset="${'e'.repeat(64)}"`);
    expect(html).toContain('data-outcome="applied"');
    expect(html).toContain(`data-binding-digest="${'f'.repeat(64)}"`);
    expect(html).toContain(`data-receipt-digest="${'9'.repeat(64)}"`);
    expect(html).toContain('Bound-asset ledger');
  });

  it('a refused import never reaches the bind (the trust gate stops the flow)', async () => {
    const driver = new ScriptedDriver(scriptedViewModel());
    const handlers = createWorkspaceHandlers(driver);
    handlers.onFoundationImport({ bytes: new Uint8Array(0), fileName: 'empty.glb' });
    await flush();
    expect(driver.commands.map((command) => command.kind)).toEqual(['importFoundationAsset']);
  });

  it('re-binding an imported asset is a standalone driver command', async () => {
    const driver = new ScriptedDriver(scriptedViewModel());
    const handlers = createWorkspaceHandlers(driver);
    handlers.onFoundationImport({ bytes: new Uint8Array(64), fileName: 'riser-caps.glb' });
    await flush();
    handlers.onFoundationBind('e'.repeat(64));
    await flush();
    expect(driver.commands.map((command) => command.kind)).toEqual([
      'importFoundationAsset',
      'bindFoundationAsset',
      'bindFoundationAsset',
    ]);
  });
});

describe('the workspace handlers (event → driver command wiring)', () => {
  it('forwards normalized pointer positions to the fabric seam unchanged', async () => {
    const driver = new ScriptedDriver(scriptedViewModel());
    const handlers = createWorkspaceHandlers(driver);
    // The viewport component normalizes its pixels first (normalizePointer,
    // pinned below); the handler forwards the normalized position as-is.
    handlers.onViewportPointerDown(normalizePointer({ width: 1000, height: 640 }, { x: 500, y: 320 }));
    await flush();
    expect(driver.commands).toEqual([
      { kind: 'dispatchPointerDown', payload: [{ x: 0.5, y: 0.5 }] },
    ]);
  });

  it('classifies drags (orbit vs shift-pan) and scales them to gestures', () => {
    expect(classifyDrag({ shift: false, meta: false, alt: false }, { dx: 10, dy: 4 }).kind).toBe('orbit');
    expect(classifyDrag({ shift: true, meta: false, alt: false }, { dx: 10, dy: 4 }).kind).toBe('pan');
    const gesture = dragToGesture({ kind: 'orbit', deltaX: 100, deltaY: 50 });
    expect(gesture.deltaX).toBeCloseTo(0.8, 10);
    const driver = new ScriptedDriver(scriptedViewModel());
    const handlers = createWorkspaceHandlers(driver);
    handlers.onViewportDrag({ shift: false, meta: false, alt: false }, { dx: 25, dy: 0 });
    expect(driver.commands[0]?.kind).toBe('applyGesture');
    expect(driver.commands[0]?.payload[0]).toMatchObject({ kind: 'orbit', deltaX: 0.2 });
  });

  it('navigation keys reach the driver; other keys are ignored', () => {
    const driver = new ScriptedDriver(scriptedViewModel());
    const handlers = createWorkspaceHandlers(driver);
    expect(isNavigationKey('w')).toBe(true);
    expect(isNavigationKey('x')).toBe(false);
    handlers.onNavigationKey('w');
    handlers.onNavigationKey('Enter');
    expect(driver.commands).toEqual([{ kind: 'navigate', payload: ['w'] }]);
  });

  it('workspace commands issue the typed driver calls (layers, timeline, presence, renderers, controls)', async () => {
    const driver = new ScriptedDriver(scriptedViewModel());
    const handlers = createWorkspaceHandlers(driver);
    handlers.onToolSelect('measure');
    handlers.onLayerToggle('lyr-site');
    handlers.onLayerIsolate('lyr-mep');
    handlers.onLayersRevealAll();
    handlers.onAgentFollow('agent:scripted-surveyor');
    handlers.onTimelineScrub(4_000);
    handlers.onTimelinePause();
    handlers.onTimelineResume();
    handlers.onAnnotationSubmit('Check the anchor bolt');
    handlers.onControlInvoke('ctl-branch-here', { branchAtMs: 4_000 });
    handlers.onRendererSelect('rr-scripted-reduced');
    handlers.onViewportWheel({ x: 0, y: -120 });
    handlers.onResetNavigation();
    await flush();
    const kinds = driver.commands.map((command) => command.kind);
    expect(kinds).toEqual([
      'setTool',
      'toggleLayer',
      'isolateLayer',
      'revealAllLayers',
      'followAgent',
      'scrubTimeline',
      'pauseTimeline',
      'resumeTimeline',
      'composeAnnotation',
      'invokeControl',
      'selectRenderer',
      'dispatchWheel',
      'resetNavigation',
    ]);
    expect(driver.commands[4]?.payload).toEqual(['agent:scripted-surveyor']);
    expect(driver.commands[5]?.payload).toEqual([4_000]);
    expect(driver.commands[8]?.payload).toEqual(['Check the anchor bolt']);
    expect(driver.commands[9]?.payload).toEqual(['ctl-branch-here', { branchAtMs: 4_000 }]);
    expect(driver.commands[11]?.payload).toEqual([{ x: 0, y: -120 }]);
  });

  it('empty annotations are never submitted', async () => {
    const driver = new ScriptedDriver(scriptedViewModel());
    const handlers = createWorkspaceHandlers(driver);
    handlers.onAnnotationSubmit('   ');
    await flush();
    expect(driver.commands).toEqual([]);
  });

  it('normalizePointer clamps into [0,1] and guards degenerate bounds', () => {
    expect(normalizePointer({ width: 1000, height: 500 }, { x: -40, y: 900 })).toEqual({ x: 0, y: 1 });
    expect(normalizePointer({ width: 0, height: 0 }, { x: 100, y: 100 })).toEqual({ x: 0.5, y: 0.5 });
  });
});

/** Flush the handler microtasks (the async commands settle there). */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
