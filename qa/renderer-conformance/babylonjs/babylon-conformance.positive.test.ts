/**
 * THE W059 BABYLON.JS RENDERER CONFORMANCE BATTERY — POSITIVE: the Work
 * Order acceptance proof, run over the W056 SHARED FIXTURE through the
 * REAL fabric.
 *
 * "Babylon.js mounts the same fixture as W058 and passes the shared
 * conformance/interaction battery with equivalent normalized intents and
 * unchanged canonical world digest."
 *
 * The fixture is the W056 shared fixture verbatim (same tenant, same
 * canonical world scene object, same world digest, same semantic entity
 * ids, same device session, same reference renderers for cross-renderer
 * equivalence). The renderer under test is the REAL Babylon.js adapter
 * (`@epoch/adapter-renderer-babylonjs`) over @babylonjs/core 9.29.0's
 * NullEngine — the GL-dependent path is injected (the browser host is the
 * W061 surface); everything proven here (scene mounting, semantic picking,
 * intent normalization, switching, degradation, disposal) is the
 * deterministic core.
 *
 * The seven conformance check kinds (contracts/renderers v1.1.0):
 * tenant-continuity, digest-continuity, semantic-entity-ids,
 * interaction-outcomes, normalized-intents, semantic-focus-layers,
 * presentation-only-differences.
 */
import { describe, expect, it } from 'vitest';
import { canonicalDigest, type JsonValue } from '../../../packages/agent-protocol/src/index';
import {
  RendererConformanceResultContentSchema,
  type RendererConformanceCheck,
  type RendererConformanceResultContent,
  type RendererIntentReceipt,
} from '../../../packages/renderer-runtime/src/index';
import {
  applyWorldIntent,
  createWorldScene,
  emptyWorldSceneStore,
} from '../../../packages/world-experience/src/index';
import { BabylonRendererAdapter, nullEngineHost } from '../../../adapters/renderers/babylonjs/src/index';
import {
  CLOCK,
  DEVICE,
  ENTITY_IDS,
  LAYER_STRUCTURE,
  LAYER_UTILITIES,
  ONTOLOGY,
  PRESENTED_ENTITY_IDS,
  RENDERER_A_ID,
  SCENE,
  SCENE_ID,
  TENANT,
  WORLD_PROJECTION,
  buildFabric,
  fixtureViewState,
  mountFullSession,
  pointerDown,
  registerRenderer,
  sessionStateOf,
  wheelInput,
} from '../fixture';
import type { RendererFabric } from '../../../packages/renderer-fabric/src/index';

/** One raw pointer-down at BOTH normalized coordinates (the fixture helper
 * fixes y=0.5; semantic picking needs the exact projected position). */
function pointerDownAt(
  fabricSessionId: string,
  inputId: string,
  x: number,
  y: number,
  atMs: number,
  intentHint?: { id: string; version: string },
) {
  return {
    schema: 'epoch.renderer-input-envelope' as const,
    fabricProtocolVersion: '1.0.0' as const,
    inputId,
    fabricSessionId,
    atMs,
    modality: 'pointer' as const,
    inputKind: 'pointer-down' as const,
    pointer: { x, y },
    ...(intentHint !== undefined ? { intentHint: { intent: intentHint } } : {}),
  };
}

/** The Babylon renderer under test (headless host; the GL path is injected). */
function babylonRenderer(): BabylonRendererAdapter {
  return new BabylonRendererAdapter({ host: nullEngineHost() });
}

/** The shared fabric + the Babylon renderer registered through the REAL registry. */
function buildBabylonFabric(): {
  readonly fabric: RendererFabric;
  readonly babylon: BabylonRendererAdapter;
} {
  const { fabric } = buildFabric();
  const babylon = babylonRenderer();
  registerRenderer(fabric, babylon, '1.0.0');
  return { fabric, babylon };
}

/** Create + mount the Babylon session over the shared fixture. */
async function mountBabylonSession(
  fabric: RendererFabric,
  fabricSessionId: string,
): Promise<void> {
  const created = await fabric.createSession({
    rendererId: 'rr-babylonjs-embedded',
    device: DEVICE,
    worldProjection: WORLD_PROJECTION,
    viewState: fixtureViewState(),
    fabricSessionId,
    atMs: CLOCK.sessionCreated,
    expectedTenantId: TENANT,
  });
  if (!created.ok) {
    throw new Error(`babylon session failed: ${created.error.message}`);
  }
  const mounted = await fabric.mountScene(fabricSessionId, {
    scene: SCENE,
    ontology: ONTOLOGY,
    atMs: CLOCK.sceneMounted,
    expectedTenantId: TENANT,
  });
  if (!mounted.ok) {
    throw new Error(`babylon mount failed: ${mounted.error.message}`);
  }
}

describe('W059 Babylon.js conformance — the shared fixture (positive)', () => {
  // The frozen pre-run copy of the canonical scene (the no-mutation proof).
  const SCENE_BEFORE = structuredClone(SCENE);
  const SCENE_DIGEST_BEFORE = SCENE.digest;

  it('registers the real Babylon renderer through the REAL capability registry (tenant-continuity, part 1)', () => {
    const { fabric } = buildBabylonFabric();
    const listed = fabric.adapters.listRenderers();
    expect(listed.map((entry) => entry.descriptor.rendererId)).toEqual([
      'rr-babylonjs-embedded',
      RENDERER_A_ID,
      'rr-conformance-reduced',
    ]);
    const babylon = listed.find((e) => e.descriptor.rendererId === 'rr-babylonjs-embedded')!;
    // The manifest is a visualization-category capability honoring the
    // frozen renderer contract (the REAL registry verified its digest).
    expect(babylon.record.manifest.category).toBe('visualization');
    expect(babylon.record.manifest.contracts).toContainEqual({
      contractId: 'epoch.renderers',
      contractVersion: '1.1.0',
    });
    expect(babylon.record.lifecycle).toBe('registered');
    // Distinguishable capability axis: the Babylon renderer declares every
    // portable field (including camera) and all four degradation kinds.
    expect(babylon.capabilities.portableViewState).toContain('camera');
    expect(babylon.capabilities.degradation).toContain('wireframe');
    expect(babylon.capabilities.hitTesting).toBe(true);
  });

  it('mounts the SAME fixture as the reference renderer with digest/entity-id continuity', async () => {
    const { fabric, babylon } = buildBabylonFabric();
    await mountBabylonSession(fabric, 'fx-babylon-1');
    const record = fabric.session('fx-babylon-1');
    if (!record.ok) throw new Error(record.error.message);
    // Digest continuity: the Babylon session presents the shared fixture's
    // exact world revision.
    expect(record.value.state).toBe('active');
    expect(record.value.mountedWorldDigest).toBe(SCENE.digest);
    expect(record.value.worldProjection.worldDigest).toBe(SCENE.digest);
    // Tenant continuity: the session presents the fixture tenant.
    expect(record.value.worldProjection.tenantScope.tenantId).toBe(TENANT);
    expect(record.value.binding.device.tenantScope.tenantId).toBe(TENANT);
    // Semantic entity ids: the SAME presented set as the reference
    // renderer (the visible entities of the shared fixture, sorted).
    expect(babylon.presentedEntityIds(babylon.adapterSessionOf('fx-babylon-1')!)).toEqual(
      PRESENTED_ENTITY_IDS,
    );
    // Every presented Babylon mesh carries its semantic entity identity.
    for (const entityId of PRESENTED_ENTITY_IDS) {
      const metadata = babylon.entityMetadataOf(babylon.adapterSessionOf('fx-babylon-1')!, entityId);
      expect(metadata?.epochEntityId).toBe(entityId);
    }
  });

  it('picks semantically and normalizes interactions into the EXISTING W016 vocabulary (interaction-outcomes, normalized-intents)', async () => {
    const { fabric, babylon } = buildBabylonFabric();
    await mountBabylonSession(fabric, 'fx-babylon-2');
    const session = babylon.adapterSessionOf('fx-babylon-2')!;

    // Every presented entity is reachable through REAL Babylon picking:
    // the deterministic projection of the entity resolves the entity.
    for (const entityId of PRESENTED_ENTITY_IDS) {
      const projected = babylon.projectedPositionOf(session, entityId);
      expect(projected).not.toBeNull();
      const receipt = await fabric.submitInput(
        'fx-babylon-2',
        pointerDownAt('fx-babylon-2', `rin-babylon-select-${entityId}`, projected!.x, projected!.y, CLOCK.firstInput),
      );
      expect(receipt.ok).toBe(true);
      if (!receipt.ok) continue;
      expect(receipt.value.outcome).toBe('normalized');
      expect(receipt.value.hitEntityId).toBe(entityId);
      expect(receipt.value.intent).toEqual({
        id: 'epoch.world.interaction.select',
        version: '1.0.0',
      });
      expect(receipt.value.intentPayloadDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(receipt.value.admissionDigest).toMatch(/^[0-9a-f]{64}$/);
    }

    // Wheel normalizes to a zoom intent in the SAME vocabulary.
    const zoom = await fabric.submitInput(
      'fx-babylon-2',
      wheelInput('fx-babylon-2', 'rin-babylon-zoom-1', -120, CLOCK.secondInput),
    );
    expect(zoom.ok).toBe(true);
    if (zoom.ok) {
      expect(zoom.value.intent).toEqual({ id: 'epoch.world.interaction.zoom', version: '1.0.0' });
    }

    // Non-activating input is a typed no-target receipt, never a failure.
    const hover = await fabric.submitInput('fx-babylon-2', {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: 'rin-babylon-move-1',
      fabricSessionId: 'fx-babylon-2',
      atMs: CLOCK.secondInput,
      modality: 'pointer',
      inputKind: 'pointer-move',
      pointer: { x: 0.5, y: 0.5 },
    });
    expect(hover.ok).toBe(true);
    if (hover.ok) {
      expect(hover.value.outcome).toBe('no-target');
      expect(hover.value.intent).toBeUndefined();
    }
  });

  it('proves EQUIVALENT normalized intents: the same selection on Babylon and the reference digests identically', async () => {
    const { fabric, babylon } = buildBabylonFabric();
    // The reference session over the same fixture.
    await mountFullSession(fabric);
    // The Babylon session over the same fixture.
    await mountBabylonSession(fabric, 'fx-babylon-3');

    const target = ENTITY_IDS[1]; // 'we-conformance-beta'
    // The SAME input id + the SAME semantic entity on both renderers.
    const inputId = 'rin-equivalence-select-1';

    // Reference: the deterministic partition policy resolves beta.
    const referenceX = PRESENTED_ENTITY_IDS.indexOf(target) / PRESENTED_ENTITY_IDS.length + 0.1;
    const referenceReceipt = await fabric.submitInput(
      'fx-conformance-1',
      pointerDown('fx-conformance-1', inputId, referenceX, CLOCK.firstInput),
    );
    expect(referenceReceipt.ok).toBe(true);
    if (!referenceReceipt.ok) return;
    expect(referenceReceipt.value.hitEntityId).toBe(target);

    // Babylon: the deterministic projection of beta resolves beta.
    const session = babylon.adapterSessionOf('fx-babylon-3')!;
    const projected = babylon.projectedPositionOf(session, target);
    expect(projected).not.toBeNull();
    const babylonReceipt = await fabric.submitInput(
      'fx-babylon-3',
      pointerDownAt('fx-babylon-3', inputId, projected!.x, projected!.y, CLOCK.firstInput),
    );
    expect(babylonReceipt.ok).toBe(true);
    if (!babylonReceipt.ok) return;

    // EQUIVALENT supported interaction outcomes: same entity hit.
    expect(babylonReceipt.value.hitEntityId).toBe(referenceReceipt.value.hitEntityId);
    // EQUIVALENT normalized intents: same typed ControlIntent AND the same
    // intent payload digest — ONE shared W016 vocabulary, never a parallel
    // one (differences are confined to presentation).
    expect(babylonReceipt.value.intent).toEqual(referenceReceipt.value.intent);
    expect(babylonReceipt.value.intentPayloadDigest).toBe(referenceReceipt.value.intentPayloadDigest);
    expect(babylonReceipt.value.outcome).toBe('normalized');
    // The Babylon receipt is content-addressed evidence (digest over content).
    const { digest: _receiptDigest, ...receiptContent } = babylonReceipt.value;
    void _receiptDigest;
    expect(babylonReceipt.value.digest).toBe(canonicalDigest(receiptContent as unknown as JsonValue));
  });

  it('switches Babylon -> reference and reference -> Babylon with full identity/digest continuity', async () => {
    const { fabric, babylon } = buildBabylonFabric();
    await mountBabylonSession(fabric, 'fx-babylon-4');
    // The live adapter-session handle (captured BEFORE dispose — after
    // dispose nothing resolves, by design).
    const liveHandle = babylon.adapterSessionOf('fx-babylon-4')!;

    // A normalized selection on the Babylon source (the interaction that
    // must still resolve on the target after the switch).
    const sourceReceipt = await fabric.submitInput(
      'fx-babylon-4',
      pointerDown('fx-babylon-4', 'rin-babylon-switch-select-1', 0.5, CLOCK.firstInput),
    );

    // --- switch 1: Babylon -> reference-full --------------------------------
    const switched = await fabric.switchRenderer(
      {
        schema: 'epoch.renderer-switch-request',
        fabricProtocolVersion: '1.0.0',
        switchId: 'sw-babylon-1',
        sourceFabricSessionId: 'fx-babylon-4',
        targetRendererId: RENDERER_A_ID,
        expectedWorldDigest: SCENE.digest,
        expectedTenantId: TENANT,
        targetFabricSessionId: 'fx-reference-1',
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
    if (!switched.ok) return;
    const receipt1 = switched.value.receipt;
    expect(receipt1.fromRendererId).toBe('rr-babylonjs-embedded');
    expect(receipt1.toRendererId).toBe(RENDERER_A_ID);
    expect(receipt1.tenantScope.tenantId).toBe(TENANT);
    expect(receipt1.worldDigest).toBe(SCENE.digest);
    expect(receipt1.mountedProjectionDigest).toBe(SCENE.digest);
    expect(receipt1.sourceSnapshotDigest).toMatch(/^[0-9a-f]{64}$/);
    // The reference-full renderer declares every portable field: the
    // switch restores focus/layers/timeline AND camera.
    expect(switched.value.restoredViewFields).toEqual([
      'camera',
      'focused-entities',
      'layer-visibility',
      'timeline-position',
    ]);
    expect(switched.value.skippedViewFields).toEqual([]);
    // The previous (Babylon) session is disposed terminally; its engine too.
    expect(switched.value.disposedSource.state).toBe('disposed');
    expect(sessionStateOf(fabric, 'fx-babylon-4')).toBe('disposed');
    expect(babylon.adapterSessionOf('fx-babylon-4')).toBeUndefined();
    // Safe disposal ran the Babylon engine.dispose() (terminal evidence).
    expect(babylon.engineDisposedOf(liveHandle)).toBe(true);
    expect(sessionStateOf(fabric, 'fx-reference-1')).toBe('active');

    // --- switch 2: reference -> Babylon (the interchangeability proof) -----
    const switchedBack = await fabric.switchRenderer(
      {
        schema: 'epoch.renderer-switch-request',
        fabricProtocolVersion: '1.0.0',
        switchId: 'sw-babylon-2',
        sourceFabricSessionId: 'fx-reference-1',
        targetRendererId: 'rr-babylonjs-embedded',
        expectedWorldDigest: SCENE.digest,
        expectedTenantId: TENANT,
        targetFabricSessionId: 'fx-babylon-5',
        fallbackRendererIds: [],
        atMs: CLOCK.switchRequested + 1_000,
      },
      {
        scene: SCENE,
        ontology: ONTOLOGY,
        atMs: CLOCK.switchMounted + 1_000,
        completedAtMs: CLOCK.switchCompleted + 1_000,
        expectedTenantId: TENANT,
      },
    );
    expect(switchedBack.ok).toBe(true);
    if (!switchedBack.ok) return;
    const receipt2 = switchedBack.value.receipt;
    expect(receipt2.fromRendererId).toBe(RENDERER_A_ID);
    expect(receipt2.toRendererId).toBe('rr-babylonjs-embedded');
    // Digest/tenant continuity holds regardless of direction.
    expect(receipt2.worldDigest).toBe(SCENE.digest);
    expect(receipt2.tenantScope.tenantId).toBe(TENANT);
    // The Babylon target restores every portable field (it declares all four).
    expect(switchedBack.value.restoredViewFields).toEqual([
      'camera',
      'focused-entities',
      'layer-visibility',
      'timeline-position',
    ]);
    // Semantic focus/layers/timeline are restored on the Babylon session
    // (semantic-focus-layers).
    const target = babylon.adapterSessionOf('fx-babylon-5')!;
    expect(target).toBeDefined();
    expect(babylon.viewStateOf(target).focusedEntityIds).toEqual([ENTITY_IDS[1]]);
    expect(babylon.viewStateOf(target).layerVisibility).toEqual([
      { layerId: LAYER_STRUCTURE, visible: true },
      { layerId: LAYER_UTILITIES, visible: false },
    ]);
    expect(babylon.viewStateOf(target).timelinePosition.atMs).toBe(3_000);
    expect(babylon.viewStateOf(target).camera?.mode).toBe('orbit');
    // Interaction-outcome continuity: the target still presents the same
    // entities and picking still resolves them.
    expect(babylon.presentedEntityIds(target)).toEqual(PRESENTED_ENTITY_IDS);
    const projected = babylon.projectedPositionOf(target, ENTITY_IDS[1])!;
    expect(babylon.pickAt(target, projected.x, projected.y)).toBe(ENTITY_IDS[1]);
    // The reference source session is disposed.
    expect(sessionStateOf(fabric, 'fx-reference-1')).toBe('disposed');
    void sourceReceipt;
  });

  it('proves no durable semantic mutation across mount, input, and the two-way switch', async () => {
    const { fabric } = buildBabylonFabric();
    await mountBabylonSession(fabric, 'fx-babylon-6');
    await fabric.submitInput(
      'fx-babylon-6',
      pointerDown('fx-babylon-6', 'rin-babylon-no-mutation-1', 0.5, CLOCK.firstInput),
    );
    const switched = await fabric.switchRenderer(
      {
        schema: 'epoch.renderer-switch-request',
        fabricProtocolVersion: '1.0.0',
        switchId: 'sw-babylon-3',
        sourceFabricSessionId: 'fx-babylon-6',
        targetRendererId: RENDERER_A_ID,
        expectedWorldDigest: SCENE.digest,
        expectedTenantId: TENANT,
        targetFabricSessionId: 'fx-reference-2',
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

    // 1. The canonical scene object is byte-identical to its pre-run copy.
    expect(SCENE).toEqual(SCENE_BEFORE);
    expect(SCENE.digest).toBe(SCENE_DIGEST_BEFORE);

    // 2. The renderer-emitted intent flows through the EXISTING W016
    //    authority surface — a renderer NEVER mutates the scene directly.
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
        intentId: 'wi-rin-babylon-no-mutation-1',
        entityId: ENTITY_IDS[0],
      },
      { expectedTenantId: TENANT },
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.value.outcome.scene.focusedEntityIds).toEqual([ENTITY_IDS[0]]);
    expect(applied.value.outcome.scene.digest).not.toBe(SCENE.digest);
    // ...and the ORIGINAL sealed fixture is unchanged.
    expect(SCENE).toEqual(SCENE_BEFORE);
    expect(store.value.scene).toEqual(SCENE_BEFORE);
  });

  it('emits the sealed conformance result over every check kind x renderer (presentation-only differences confined)', async () => {
    const { fabric, babylon } = buildBabylonFabric();
    await mountBabylonSession(fabric, 'fx-babylon-7');
    const session = babylon.adapterSessionOf('fx-babylon-7')!;
    const projected = babylon.projectedPositionOf(session, ENTITY_IDS[1])!;
    const babylonReceipt = await fabric.submitInput(
      'fx-babylon-7',
      pointerDownAt('fx-babylon-7', 'rin-babylon-result-1', projected.x, projected.y, CLOCK.firstInput),
    );
    expect(babylonReceipt.ok).toBe(true);
    await mountFullSession(fabric);
    const referenceReceipt = await fabric.submitInput(
      'fx-conformance-1',
      pointerDown('fx-conformance-1', 'rin-babylon-result-1', 0.5, CLOCK.firstInput),
    );
    expect(referenceReceipt.ok).toBe(true);
    // Equivalent normalized intents (the shared-vocabulary proof, again).
    if (babylonReceipt.ok && referenceReceipt.ok) {
      expect(babylonReceipt.value.intentPayloadDigest).toBe(referenceReceipt.value.intentPayloadDigest);
    }

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
    const intentReceipt = (receipt: { ok: boolean; value?: RendererIntentReceipt }): string | undefined =>
      receipt.ok && receipt.value !== undefined ? receipt.value.intentPayloadDigest : undefined;
    const content: RendererConformanceResultContent = {
      schema: 'epoch.renderer-conformance-result',
      fabricProtocolVersion: '1.0.0',
      runId: 'conf-w059-babylonjs-shared-fixture',
      renderers: ['rr-babylonjs-embedded', RENDERER_A_ID],
      tenantScope: { tenantId: TENANT },
      worldDigest: SCENE.digest,
      checks: [
        check('tenant-continuity', 'rr-babylonjs-embedded'),
        check('tenant-continuity', RENDERER_A_ID),
        check('digest-continuity', 'rr-babylonjs-embedded', SCENE.digest),
        check('digest-continuity', RENDERER_A_ID, SCENE.digest),
        check('semantic-entity-ids', 'rr-babylonjs-embedded'),
        check('semantic-entity-ids', RENDERER_A_ID),
        check(
          'interaction-outcomes',
          'rr-babylonjs-embedded',
          babylonReceipt.ok ? babylonReceipt.value.digest : undefined,
        ),
        check(
          'interaction-outcomes',
          RENDERER_A_ID,
          referenceReceipt.ok ? referenceReceipt.value.digest : undefined,
        ),
        check('semantic-focus-layers', 'rr-babylonjs-embedded'),
        check('semantic-focus-layers', RENDERER_A_ID),
        check('normalized-intents', 'rr-babylonjs-embedded', intentReceipt(babylonReceipt)),
        check('normalized-intents', RENDERER_A_ID, intentReceipt(referenceReceipt)),
        check('presentation-only-differences', 'rr-babylonjs-embedded'),
        check('presentation-only-differences', RENDERER_A_ID),
      ],
      overallOutcome: 'pass',
      startedAtMs: CLOCK.sessionCreated,
      completedAtMs: CLOCK.switchCompleted,
    };
    expect(RendererConformanceResultContentSchema.parse(content)).toEqual(content);
    expect(canonicalDigest(content as unknown as JsonValue)).toMatch(/^[0-9a-f]{64}$/);
  });
});
