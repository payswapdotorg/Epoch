/**
 * THE W056 RENDERER CONFORMANCE BATTERY — POSITIVE: the Work Order
 * acceptance proof, run end-to-end over the shared fixture.
 *
 * "The shared fixture can mount a real adapter contract, normalize a user
 * interaction, switch renderers and prove canonical identity/digest
 * continuity without durable semantic mutation."
 *
 * Every step uses REAL product machinery: the REAL capability registry
 * (registration), the REAL W013 hosting boundary (every binding and
 * invocation), the REAL W016 compiler and admission (the canonical
 * projection + the normalized intents), and TWO distinguishable instances
 * of the contract-only reference adapter (W058/W059 replace them with real
 * engines behind the SAME seam). Zero rendering engines, zero GPU state,
 * zero wall-clock, zero randomness — the run is byte-reproducible.
 */
import { describe, expect, it } from 'vitest';
import { canonicalDigest, type JsonValue } from '../../packages/agent-protocol/src/index';
import {
  RendererConformanceResultContentSchema,
  type RendererConformanceCheck,
  type RendererConformanceResultContent,
} from '../../packages/renderer-runtime/src/index';
import {
  applyWorldIntent,
  createWorldScene,
  emptyWorldSceneStore,
} from '../../packages/world-experience/src/index';
import {
  CLOCK,
  DEVICE,
  ENTITY_IDS,
  LAYER_STRUCTURE,
  LAYER_UTILITIES,
  ONTOLOGY,
  PRESENTED_ENTITY_IDS,
  RENDERER_A_ID,
  RENDERER_B_ID,
  SCENE,
  SCENE_ID,
  TENANT,
  WORLD_PROJECTION,
  buildFabric,
  fixtureViewState,
  hitEntityOf,
  mountFullSession,
  pointerDown,
  sessionStateOf,
  wheelInput,
} from './fixture';

describe('W056 renderer conformance — the shared fixture (positive)', () => {
  // The frozen pre-run copy of the canonical scene (the no-mutation proof).
  const SCENE_BEFORE = structuredClone(SCENE);
  const SCENE_DIGEST_BEFORE = SCENE.digest;

  it('registers two distinguishable renderers through the REAL capability registry', () => {
    const { fabric } = buildFabric();
    const listed = fabric.adapters.listRenderers();

    expect(listed.map((entry) => entry.descriptor.rendererId)).toEqual([
      RENDERER_A_ID,
      RENDERER_B_ID,
    ]);
    // The two renderer kinds are distinguishable by capability set (the
    // presentation-only axis the switch must respect).
    const full = listed.find((e) => e.descriptor.rendererId === RENDERER_A_ID)!;
    const reduced = listed.find((e) => e.descriptor.rendererId === RENDERER_B_ID)!;
    expect(full.capabilities.portableViewState).toContain('camera');
    expect(reduced.capabilities.portableViewState).not.toContain('camera');
    expect(full.capabilities.measurement).toBe(true);
    expect(reduced.capabilities.measurement).toBe(false);

    // The manifests are visualization-category capabilities honoring the
    // frozen renderer contract (the REAL registry verified their digests).
    for (const entry of listed) {
      expect(entry.record.manifest.category).toBe('visualization');
      expect(entry.record.manifest.contracts).toContainEqual({
        contractId: 'epoch.renderers',
        contractVersion: '1.1.0',
      });
      expect(entry.record.lifecycle).toBe('registered');
    }
  });

  it('mounts the real adapter contract over the canonical projection (W013-admitted)', async () => {
    const { fabric, full } = buildFabric();
    const created = await fabric.createSession({
      rendererId: RENDERER_A_ID,
      device: DEVICE,
      worldProjection: WORLD_PROJECTION,
      viewState: fixtureViewState(),
      fabricSessionId: 'fx-conformance-1',
      atMs: CLOCK.sessionCreated,
      expectedTenantId: TENANT,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.state).toBe('created');
    expect(created.value.rendererSessionId).toBe('rs-conformance-1');
    expect(created.value.worldProjection.worldDigest).toBe(SCENE.digest);
    expect(created.value.binding.effective.interaction).toEqual(['keyboard', 'pointer']);

    const mounted = await mountFullSession(fabric);
    expect(mounted.state).toBe('active');
    expect(mounted.mountedWorldDigest).toBe(SCENE.digest);
    expect(mounted.lastFrameIndex).toBe(0);
    // Every mount invocation was admitted by the REAL W013 boundary (the
    // invocation count counts admitted receipts: one per mounted graph
    // plus the mount frame advance).
    expect(mounted.invocationCount).toBeGreaterThanOrEqual(2);

    // The adapter presented the canonical scene's semantic entities —
    // opaque references, identical to the projection's visible entities.
    const adapterSession = full.adapterSessionOf('fx-conformance-1');
    expect(adapterSession).toBeDefined();
    expect(full.presentedEntityIds(adapterSession!)).toEqual(PRESENTED_ENTITY_IDS);
  });

  it('normalizes a user interaction into the EXISTING typed Epoch intent vocabulary', async () => {
    const { fabric } = buildFabric();
    await mountFullSession(fabric);

    // Pointer-down at normalized x=0.5 over three presented entities
    // resolves the SECOND entity (the deterministic reference hit-test —
    // the same policy on every reference instance).
    const x = 0.5;
    const expectedHit = hitEntityOf(x);
    expect(expectedHit).toBe(ENTITY_IDS[1]);

    const receipt = await fabric.submitInput(
      'fx-conformance-1',
      pointerDown('fx-conformance-1', 'rin-conformance-select-1', x, CLOCK.firstInput),
    );
    expect(receipt.ok).toBe(true);
    if (!receipt.ok) return;
    expect(receipt.value.outcome).toBe('normalized');
    expect(receipt.value.hitEntityId).toBe(expectedHit);
    expect(receipt.value.intent).toEqual({
      id: 'epoch.world.interaction.select',
      version: '1.0.0',
    });
    // Every normalized intent links its W013 admission (evidence chain).
    expect(receipt.value.admissionDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(receipt.value.intentPayloadDigest).toMatch(/^[0-9a-f]{64}$/);
    // The receipt is content-addressed execution evidence (the digest is
    // over the content — itself excluded).
    const { digest: _receiptDigest, ...receiptContent } = receipt.value;
    void _receiptDigest;
    expect(receipt.value.digest).toBe(canonicalDigest(receiptContent as unknown as JsonValue));

    // Wheel input normalizes to a zoom intent in the SAME vocabulary.
    const zoom = await fabric.submitInput(
      'fx-conformance-1',
      wheelInput('fx-conformance-1', 'rin-conformance-zoom-1', -120, CLOCK.secondInput),
    );
    expect(zoom.ok).toBe(true);
    if (zoom.ok) {
      expect(zoom.value.intent).toEqual({
        id: 'epoch.world.interaction.zoom',
        version: '1.0.0',
      });
    }

    // Non-activating input is a typed no-target receipt, never a failure.
    const hover = await fabric.submitInput('fx-conformance-1', {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: 'rin-conformance-move-1',
      fabricSessionId: 'fx-conformance-1',
      atMs: CLOCK.secondInput,
      modality: 'pointer',
      inputKind: 'pointer-move',
      pointer: { x: 0.5, y: 0.5 },
    });
    expect(hover.ok).toBe(true);
    if (hover.ok) {
      expect(hover.value.outcome).toBe('no-target');
      expect(hover.value.intent).toBeUndefined();
      expect(hover.value.hitEntityId).toBeUndefined();
    }
  });

  it('switches renderers and proves canonical identity/digest continuity', async () => {
    const { fabric, reduced } = buildFabric();
    await mountFullSession(fabric);

    // Normalized-interaction evidence on the SOURCE renderer (the same
    // input is replayed on the TARGET after the switch — the intent
    // equivalence proof).
    const sourceReceipt = await fabric.submitInput(
      'fx-conformance-1',
      pointerDown('fx-conformance-1', 'rin-conformance-select-1', 0.5, CLOCK.firstInput),
    );
    expect(sourceReceipt.ok).toBe(true);

    // THE SWITCHING INVARIANT: snapshot -> resolve -> verify digest/tenant
    // -> mount from the canonical projection -> restore portable state ->
    // receipt -> dispose previous.
    const outcome = await fabric.switchRenderer(
      {
        schema: 'epoch.renderer-switch-request',
        fabricProtocolVersion: '1.0.0',
        switchId: 'sw-conformance-1',
        sourceFabricSessionId: 'fx-conformance-1',
        targetRendererId: RENDERER_B_ID,
        expectedWorldDigest: SCENE.digest,
        expectedTenantId: TENANT,
        targetFabricSessionId: 'fx-conformance-2',
        fallbackRendererIds: [],
        atMs: CLOCK.switchRequested,
      },
      {
        scene: SCENE,
        ontology: ONTOLOGY,
        atMs: CLOCK.switchMounted,
        completedAtMs: CLOCK.switchCompleted,
        expectedTenantId: TENANT,
      },
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    const receipt = outcome.value.receipt;
    // --- tenant continuity (same tenant across renderers and the switch) ---
    expect(receipt.tenantScope.tenantId).toBe(TENANT);
    expect(outcome.value.session.worldProjection.tenantScope.tenantId).toBe(TENANT);
    expect(outcome.value.session.binding.device.tenantScope.tenantId).toBe(TENANT);
    // --- digest continuity (the canonical world digest survives) ---
    expect(receipt.worldDigest).toBe(SCENE.digest);
    expect(receipt.mountedProjectionDigest).toBe(SCENE.digest);
    expect(receipt.sourceSnapshotDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(outcome.value.session.mountedWorldDigest).toBe(SCENE.digest);
    expect(outcome.value.session.worldProjection.worldDigest).toBe(SCENE.digest);
    // --- the switch itself ---
    expect(receipt.fromRendererId).toBe(RENDERER_A_ID);
    expect(receipt.toRendererId).toBe(RENDERER_B_ID);
    expect(receipt.fromFabricSessionId).toBe('fx-conformance-1');
    expect(receipt.toFabricSessionId).toBe('fx-conformance-2');
    expect(receipt.fallbackApplied).toBe(false);
    // --- portable focus/layers/timeline restored; camera SKIPPED (typed) ---
    expect(outcome.value.restoredViewFields).toEqual([
      'focused-entities',
      'layer-visibility',
      'timeline-position',
    ]);
    expect(outcome.value.skippedViewFields).toEqual(['camera']);
    expect(receipt.restoredViewState.focusedEntityIds).toEqual([ENTITY_IDS[1]]);
    expect(receipt.restoredViewState.layerVisibility).toEqual([
      { layerId: LAYER_STRUCTURE, visible: true },
      { layerId: LAYER_UTILITIES, visible: false },
    ]);
    // --- the previous session is disposed (terminal); the target is active ---
    expect(outcome.value.disposedSource.state).toBe('disposed');
    expect(outcome.value.session.state).toBe('active');
    expect(sessionStateOf(fabric, 'fx-conformance-1')).toBe('disposed');
    expect(sessionStateOf(fabric, 'fx-conformance-2')).toBe('active');
    // Nothing survives dispose: the source adapter session is gone.
    expect(reduced.adapterSessionOf('fx-conformance-1')).toBeUndefined();

    // --- semantic entity ids: the target presents the SAME entities ---
    const targetSession = reduced.adapterSessionOf('fx-conformance-2');
    expect(targetSession).toBeDefined();
    expect(reduced.presentedEntityIds(targetSession!)).toEqual(PRESENTED_ENTITY_IDS);

    // --- semantic focus/layers/timeline on the target (the restore applied) ---
    const targetView = reduced.viewStateOf(targetSession!);
    expect(targetView.focusedEntityIds).toEqual([ENTITY_IDS[1]]);
    expect(targetView.layerVisibility).toEqual([
      { layerId: LAYER_STRUCTURE, visible: true },
      { layerId: LAYER_UTILITIES, visible: false },
    ]);
    expect(targetView.timelinePosition.atMs).toBe(3_000);
    // The camera was SKIPPED: the reduced renderer does not declare it —
    // the renderer-specific difference is confined to presentation and was
    // LISTED in the receipt, never silent.
    expect(targetView.camera).toBeUndefined();

    // --- equivalent supported interaction outcomes + equivalent normalized
    //     intents: the SAME input on the target resolves the SAME semantic
    //     entity and normalizes to the SAME typed intent (identical payload
    //     digest — one shared vocabulary, never a parallel one).
    const targetReceipt = await fabric.submitInput(
      'fx-conformance-2',
      pointerDown('fx-conformance-2', 'rin-conformance-select-1', 0.5, CLOCK.firstInput),
    );
    expect(targetReceipt.ok).toBe(true);
    if (!targetReceipt.ok || !sourceReceipt.ok) return;
    expect(targetReceipt.value.hitEntityId).toBe(sourceReceipt.value.hitEntityId);
    expect(targetReceipt.value.intent).toEqual(sourceReceipt.value.intent);
    expect(targetReceipt.value.intentPayloadDigest).toBe(sourceReceipt.value.intentPayloadDigest);
    expect(targetReceipt.value.outcome).toBe('normalized');
  });

  it('proves no durable semantic mutation across mount, input, and switch', async () => {
    const { fabric } = buildFabric();
    await mountFullSession(fabric);
    await fabric.submitInput(
      'fx-conformance-1',
      pointerDown('fx-conformance-1', 'rin-conformance-select-2', 0.5, CLOCK.firstInput),
    );
    const switched = await fabric.switchRenderer(
      {
        schema: 'epoch.renderer-switch-request',
        fabricProtocolVersion: '1.0.0',
        switchId: 'sw-conformance-2',
        sourceFabricSessionId: 'fx-conformance-1',
        targetRendererId: RENDERER_B_ID,
        expectedWorldDigest: SCENE.digest,
        expectedTenantId: TENANT,
        targetFabricSessionId: 'fx-conformance-3',
        fallbackRendererIds: [],
        atMs: CLOCK.switchRequested,
      },
      {
        scene: SCENE,
        ontology: ONTOLOGY,
        atMs: CLOCK.switchMounted,
        completedAtMs: CLOCK.switchCompleted,
        expectedTenantId: TENANT,
      },
    );
    expect(switched.ok).toBe(true);

    // 1. The canonical scene object is byte-identical to its pre-run copy:
    //    mount, input normalization, and the switch never mutated it.
    expect(SCENE).toEqual(SCENE_BEFORE);
    expect(SCENE.digest).toBe(SCENE_DIGEST_BEFORE);
    expect(WORLD_PROJECTION.worldDigest).toBe(SCENE_DIGEST_BEFORE);

    // 2. The renderer-emitted intent flows through the EXISTING W016
    //    authority surface (admission + reducer) — a renderer NEVER
    //    mutates the scene directly: applying the select intent returns a
    //    NEW canonical revision, and the original fixture stays identical.
    const { digest: _stripped, ...sceneContent } = structuredClone(SCENE_BEFORE);
    void _stripped;
    const store = createWorldScene(emptyWorldSceneStore(), sceneContent, {
      expectedTenantId: TENANT,
    });
    expect(store.ok).toBe(true);
    if (!store.ok) return;
    const applied = applyWorldIntent(
      store.value.state,
      SCENE_ID,
      {
        schema: 'epoch.world-intent',
        intentVersion: 1,
        kind: 'select',
        intentId: 'wi-rin-conformance-select-2',
        entityId: ENTITY_IDS[0],
      },
      { expectedTenantId: TENANT },
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    // The canonical transition: focus moves to the hit entity (a NEW
    // revision — the fixture scene focuses a different entity).
    expect(applied.value.outcome.scene.focusedEntityIds).toEqual([ENTITY_IDS[0]]);
    expect(applied.value.outcome.scene.digest).not.toBe(SCENE.digest);
    // ...and the ORIGINAL sealed fixture (what the renderers still hold)
    // is unchanged — the semantic transition lives in the W016 store, not
    // in any renderer session.
    expect(SCENE).toEqual(SCENE_BEFORE);
    expect(store.value.scene).toEqual(SCENE_BEFORE);
  });

  it('emits the sealed conformance result over every check kind x renderer', async () => {
    const { fabric } = buildFabric();
    await mountFullSession(fabric);
    const sourceReceipt = await fabric.submitInput(
      'fx-conformance-1',
      pointerDown('fx-conformance-1', 'rin-conformance-select-1', 0.5, CLOCK.firstInput),
    );
    expect(sourceReceipt.ok).toBe(true);
    const outcome = await fabric.switchRenderer(
      {
        schema: 'epoch.renderer-switch-request',
        fabricProtocolVersion: '1.0.0',
        switchId: 'sw-conformance-3',
        sourceFabricSessionId: 'fx-conformance-1',
        targetRendererId: RENDERER_B_ID,
        expectedWorldDigest: SCENE.digest,
        expectedTenantId: TENANT,
        targetFabricSessionId: 'fx-conformance-4',
        fallbackRendererIds: [],
        atMs: CLOCK.switchRequested,
      },
      {
        scene: SCENE,
        ontology: ONTOLOGY,
        atMs: CLOCK.switchMounted,
        completedAtMs: CLOCK.switchCompleted,
        expectedTenantId: TENANT,
      },
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const targetReceipt = await fabric.submitInput(
      'fx-conformance-4',
      pointerDown('fx-conformance-4', 'rin-conformance-select-1', 0.5, CLOCK.firstInput),
    );
    expect(targetReceipt.ok).toBe(true);

    // Assemble the typed conformance result: every check kind, every
    // renderer, with content-addressed evidence digests.
    const check = (
      checkKind: RendererConformanceCheck['checkKind'],
      rendererId: string,
      evidenceDigest?: string,
    ): RendererConformanceCheck => ({
      checkKind,
      rendererId,
      outcome: 'pass',
      ...(evidenceDigest !== undefined ? { evidenceDigest } : {}),
    });
    const content: RendererConformanceResultContent = {
      schema: 'epoch.renderer-conformance-result',
      fabricProtocolVersion: '1.0.0',
      runId: 'conf-w056-shared-fixture',
      renderers: [RENDERER_A_ID, RENDERER_B_ID],
      tenantScope: { tenantId: TENANT },
      worldDigest: SCENE.digest,
      checks: [
        check('tenant-continuity', RENDERER_A_ID),
        check('tenant-continuity', RENDERER_B_ID),
        check('digest-continuity', RENDERER_A_ID, SCENE.digest),
        check('digest-continuity', RENDERER_B_ID, SCENE.digest),
        check('semantic-entity-ids', RENDERER_A_ID),
        check('semantic-entity-ids', RENDERER_B_ID),
        check(
          'interaction-outcomes',
          RENDERER_A_ID,
          sourceReceipt.ok ? sourceReceipt.value.digest : undefined,
        ),
        check(
          'interaction-outcomes',
          RENDERER_B_ID,
          targetReceipt.ok ? targetReceipt.value.digest : undefined,
        ),
        check('semantic-focus-layers', RENDERER_A_ID),
        check('semantic-focus-layers', RENDERER_B_ID),
        check(
          'normalized-intents',
          RENDERER_A_ID,
          sourceReceipt.ok ? sourceReceipt.value.intentPayloadDigest : undefined,
        ),
        check(
          'normalized-intents',
          RENDERER_B_ID,
          targetReceipt.ok ? targetReceipt.value.intentPayloadDigest : undefined,
        ),
        check('presentation-only-differences', RENDERER_A_ID),
        check('presentation-only-differences', RENDERER_B_ID),
      ],
      overallOutcome: 'pass',
      startedAtMs: CLOCK.sessionCreated,
      completedAtMs: CLOCK.switchCompleted,
    };
    // The typed record validates against the frozen contract schema...
    expect(RendererConformanceResultContentSchema.parse(content)).toEqual(content);
    // ...and seals content-addressed (the digest excludes itself).
    expect(canonicalDigest(content as unknown as JsonValue)).toMatch(/^[0-9a-f]{64}$/);
  });
});
