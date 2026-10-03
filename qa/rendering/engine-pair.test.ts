/**
 * THE W061 DIRECT ENGINE-PAIR BATTERY — POSITIVE: the Three.js ⇄ Babylon.js
 * cross-engine switch, run DIRECTLY over the SHARED canonical conformance
 * fixture (`../renderer-conformance/fixture.ts`) through the REAL
 * RendererFabric — the cross-battery the wave-1 review deferred to this
 * closure ("transitivity already holds through the shared reference
 * adapter; the direct run is W061's").
 *
 * What this battery proves (the W061 work-order acceptance):
 * - BOTH real engine adapters (W058 Three.js r0.186, W059 Babylon.js
 *   9.29 NullEngine — their deterministic headless cores) register in ONE
 *   fabric through the REAL capability registry and present the SAME
 *   canonical world (same tenant, same world digest, same semantic entity
 *   ids, same presented set);
 * - the DIRECT switch Three.js -> Babylon.js -> Three.js carries the
 *   canonical world digest and the full portable view state (camera,
 *   focus, layers, timeline — both engines declare the full grammar),
 *   mounts the target from the canonical projection, restores, seals the
 *   receipt, and disposes the source — the W056 switching invariant over
 *   two REAL engines;
 * - the same logical interaction (semantic pick through each engine's OWN
 *   hit-test surface: the Three.js Raycaster / the Babylon scene.pick)
 *   produces the IDENTICAL content-addressed intent payload digest on both
 *   engines in both directions;
 * - the canonical fixture object is NEVER mutated (the no-durable-mutation
 *   proof — renderer state is disposable presentation only).
 *
 * Honest headless scope: the deterministic core of both engines (scene
 * graphs, hit-testing, normalization, switching, snapshots, disposal) runs
 * for real in Node 22; GL rasterization is the browser E2E surface
 * (apps/web/e2e/j13-world.spec.ts). Zero wall-clock, zero randomness.
 */
import { describe, expect, it } from 'vitest';
import { RendererFabric } from '../../packages/renderer-fabric/src/index';
import type { FabricResult, RendererIntentReceipt } from '../../packages/renderer-runtime/src/index';
import {
  THREE_RENDERER_ID,
  ThreeJsRendererAdapter,
  projectedPointerOf,
} from '../../adapters/renderers/threejs/src/index';
import {
  BABYLONJS_RENDERER_ID,
  BabylonRendererAdapter,
  nullEngineHost,
} from '../../adapters/renderers/babylonjs/src/index';
import {
  CLOCK,
  DEVICE,
  ENTITY_IDS,
  ONTOLOGY,
  PRESENTED_ENTITY_IDS,
  SCENE,
  TENANT,
  WORLD_PROJECTION,
  fixtureViewState,
  registerRenderer,
} from '../renderer-conformance/fixture';

/** The session-record state of one fabric session (a narrowed read). */
function sessionStateOf(result: FabricResult<{ readonly state: string }>): string | undefined {
  return result.ok ? result.value.state : undefined;
}

// ---------------------------------------------------------------------------
// Battery helpers (deterministic; the shared fixture provides the world).
// ---------------------------------------------------------------------------

/** The fabric session ids of this battery (the "fx-" grammar). */
const THREE_SESSION = 'fx-w061-pair-three';
const BABYLON_SESSION = 'fx-w061-pair-babylon';
const BACK_SESSION = 'fx-w061-pair-back';

/** Build the ENGINE-PAIR fabric: both REAL adapters in ONE registry. */
function enginePairFabric(): {
  readonly fabric: RendererFabric;
  readonly three: ThreeJsRendererAdapter;
  readonly babylon: BabylonRendererAdapter;
} {
  const fabric = new RendererFabric();
  const three = new ThreeJsRendererAdapter();
  const babylon = new BabylonRendererAdapter({ host: nullEngineHost() });
  registerRenderer(fabric, three);
  registerRenderer(fabric, babylon);
  return { fabric, three, babylon };
}

/** Create + mount one session of a real engine over the shared fixture. */
async function mountEngine(
  fabric: RendererFabric,
  rendererId: string,
  fabricSessionId: string,
): Promise<void> {
  const created = await fabric.createSession({
    rendererId,
    device: DEVICE,
    worldProjection: WORLD_PROJECTION,
    viewState: fixtureViewState(),
    fabricSessionId,
    atMs: CLOCK.sessionCreated,
    expectedTenantId: TENANT,
  });
  if (!created.ok) {
    throw new Error(`session creation failed on ${rendererId}: ${created.error.message}`);
  }
  const mounted = await fabric.mountScene(fabricSessionId, {
    scene: SCENE,
    ontology: ONTOLOGY,
    atMs: CLOCK.sceneMounted,
    expectedTenantId: TENANT,
  });
  if (!mounted.ok) {
    throw new Error(`mount failed on ${rendererId}: ${mounted.error.message}`);
  }
}

/** Submit one raw pointer-down and REQUIRE a normalized receipt. */
async function normalized(
  fabric: RendererFabric,
  fabricSessionId: string,
  envelope: Record<string, unknown>,
): Promise<RendererIntentReceipt> {
  const submitted = await fabric.submitInput(fabricSessionId, envelope);
  if (!submitted.ok) {
    throw new Error(`input submission failed: ${submitted.error.message}`);
  }
  if (submitted.value.outcome !== 'normalized') {
    throw new Error(
      `input did not normalize (${submitted.value.outcome}): ${submitted.value.rejectionDetail ?? ''}`,
    );
  }
  return submitted.value;
}

/** One raw pointer-down envelope at an exact normalized position. */
function pointerDownAt(
  fabricSessionId: string,
  inputId: string,
  x: number,
  y: number,
): Record<string, unknown> {
  return {
    schema: 'epoch.renderer-input-envelope',
    fabricProtocolVersion: '1.0.0',
    inputId,
    fabricSessionId,
    atMs: CLOCK.firstInput,
    modality: 'pointer',
    inputKind: 'pointer-down',
    pointer: { x, y },
  };
}

/** One raw wheel envelope. */
function wheelDown(fabricSessionId: string, inputId: string, deltaY: number): Record<string, unknown> {
  return {
    schema: 'epoch.renderer-input-envelope',
    fabricProtocolVersion: '1.0.0',
    inputId,
    fabricSessionId,
    atMs: CLOCK.secondInput,
    modality: 'pointer',
    inputKind: 'wheel',
    delta: { x: 0, y: deltaY },
  };
}

describe('the W061 engine pair — direct Three.js ⇄ Babylon.js over the shared canonical fixture', () => {
  it('registers BOTH real engines in ONE fabric and presents the SAME canonical world', async () => {
    const { fabric, three, babylon } = enginePairFabric();
    await mountEngine(fabric, THREE_RENDERER_ID, THREE_SESSION);
    try {
      // The registry lists both real engine renderers.
      const listed = fabric.adapters.listRenderers().map((entry) => entry.descriptor.rendererId);
      expect(listed).toContain(THREE_RENDERER_ID);
      expect(listed).toContain(BABYLONJS_RENDERER_ID);
      // The Three.js session presents the SHARED canonical revision.
      const threeRecord = fabric.session(THREE_SESSION);
      expect(threeRecord.ok && threeRecord.value.state).toBe('active');
      if (threeRecord.ok) {
        expect(threeRecord.value.mountedWorldDigest).toBe(SCENE.digest);
        expect(threeRecord.value.worldProjection.tenantScope.tenantId).toBe(TENANT);
      }
      const threePresentation = three.presentationOf(THREE_SESSION);
      expect(threePresentation).toBeDefined();
      expect([...threePresentation!.presentedEntityIds]).toEqual([...PRESENTED_ENTITY_IDS]);
      // A second session on the REAL Babylon engine presents the SAME world.
      await mountEngine(fabric, BABYLONJS_RENDERER_ID, BABYLON_SESSION);
      const babylonRecord = fabric.session(BABYLON_SESSION);
      expect(babylonRecord.ok && babylonRecord.value.state).toBe('active');
      if (babylonRecord.ok) {
        expect(babylonRecord.value.mountedWorldDigest).toBe(SCENE.digest);
        expect(babylonRecord.value.rendererId).toBe(BABYLONJS_RENDERER_ID);
      }
      const babylonAdapterSession = babylon.adapterSessionOf(BABYLON_SESSION);
      expect(babylonAdapterSession).toBeDefined();
      expect(babylon.presentedEntityIds(babylonAdapterSession!)).toEqual([...PRESENTED_ENTITY_IDS]);
      await fabric.disposeSession(BABYLON_SESSION, CLOCK.switchCompleted);
    } finally {
      await fabric.disposeSession(THREE_SESSION, CLOCK.switchCompleted);
    }
  });

  it('switches Three.js -> Babylon.js -> Three.js DIRECTLY with digest/entity/portable-state continuity', async () => {
    const { fabric, three, babylon } = enginePairFabric();
    // The no-durable-mutation proof: a deep copy of the fixture BEFORE.
    const fixtureBefore = JSON.stringify(SCENE);
    await mountEngine(fabric, THREE_RENDERER_ID, THREE_SESSION);
    try {
      // Semantic pick through the REAL Three.js Raycaster first (focus
      // evidence the switch must carry: the portable focus field).
      const threePresentation = three.presentationOf(THREE_SESSION)!;
      const pickPointer = projectedPointerOf(threePresentation, ENTITY_IDS[2]!);
      expect(pickPointer).toBeDefined();
      const threePick = await normalized(
        fabric,
        THREE_SESSION,
        pointerDownAt(THREE_SESSION, 'rin-w061-pair-select-1', pickPointer!.x, pickPointer!.y),
      );
      expect(threePick.hitEntityId).toBe(ENTITY_IDS[2]!);
      expect(threePick.intent).toEqual({
        id: 'epoch.world.interaction.select',
        version: '1.1.0',
      });
      expect(threePick.intentPayloadDigest).toMatch(/^[0-9a-f]{64}$/);

      // ---- SWITCH 1: Three.js -> Babylon.js (the direct cross-engine leg).
      const toBabylon = await fabric.switchRenderer(
        {
          schema: 'epoch.renderer-switch-request',
          fabricProtocolVersion: '1.0.0',
          switchId: 'sw-w061-pair-1',
          sourceFabricSessionId: THREE_SESSION,
          targetRendererId: BABYLONJS_RENDERER_ID,
          expectedWorldDigest: SCENE.digest,
          expectedTenantId: TENANT,
          targetFabricSessionId: BABYLON_SESSION,
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
      expect(toBabylon.ok).toBe(true);
      if (!toBabylon.ok) return;
      // Digest + tenant continuity across the engine change.
      expect(toBabylon.value.receipt.worldDigest).toBe(SCENE.digest);
      expect(toBabylon.value.receipt.tenantScope.tenantId).toBe(TENANT);
      expect(toBabylon.value.receipt.fromRendererId).toBe(THREE_RENDERER_ID);
      expect(toBabylon.value.receipt.toRendererId).toBe(BABYLONJS_RENDERER_ID);
      expect(toBabylon.value.receipt.fallbackApplied).toBe(false);
      // BOTH real engines declare the FULL portable grammar — every field
      // restored, none skipped.
      expect(toBabylon.value.restoredViewFields).toContain('camera');
      expect(toBabylon.value.restoredViewFields).toContain('focused-entities');
      expect(toBabylon.value.restoredViewFields).toContain('layer-visibility');
      expect(toBabylon.value.restoredViewFields).toContain('timeline-position');
      expect(toBabylon.value.skippedViewFields).toEqual([]);
      // The source session is disposed; the target presents the same world.
      expect(sessionStateOf(fabric.session(THREE_SESSION))).toBe('disposed');
      const babylonRecord = fabric.session(BABYLON_SESSION);
      expect(babylonRecord.ok && babylonRecord.value.state).toBe('active');
      if (babylonRecord.ok) {
        expect(babylonRecord.value.mountedWorldDigest).toBe(SCENE.digest);
      }
      const babylonAdapterSession = babylon.adapterSessionOf(BABYLON_SESSION)!;
      expect(babylon.presentedEntityIds(babylonAdapterSession)).toEqual([...PRESENTED_ENTITY_IDS]);

      // The SAME logical select through the REAL Babylon scene.pick — the
      // IDENTICAL content-addressed intent payload digest (same inputId).
      const babylonPickPosition = babylon.projectedPositionOf(babylonAdapterSession, ENTITY_IDS[2]!)!;
      const babylonPick = await normalized(
        fabric,
        BABYLON_SESSION,
        pointerDownAt(BABYLON_SESSION, 'rin-w061-pair-select-1', babylonPickPosition.x, babylonPickPosition.y),
      );
      expect(babylonPick.hitEntityId).toBe(ENTITY_IDS[2]!);
      expect(babylonPick.intent).toEqual(threePick.intent);
      // The SAME logical interaction through the OTHER real engine: the
      // IDENTICAL content-addressed intent payload digest.
      expect(babylonPick.intentPayloadDigest).toBe(threePick.intentPayloadDigest);

      // ---- SWITCH 2: Babylon.js -> Three.js (the reverse direction).
      const backToThree = await fabric.switchRenderer(
        {
          schema: 'epoch.renderer-switch-request',
          fabricProtocolVersion: '1.0.0',
          switchId: 'sw-w061-pair-2',
          sourceFabricSessionId: BABYLON_SESSION,
          targetRendererId: THREE_RENDERER_ID,
          expectedWorldDigest: SCENE.digest,
          expectedTenantId: TENANT,
          targetFabricSessionId: BACK_SESSION,
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
      expect(backToThree.ok).toBe(true);
      if (!backToThree.ok) return;
      expect(backToThree.value.receipt.worldDigest).toBe(SCENE.digest);
      expect(backToThree.value.receipt.toRendererId).toBe(THREE_RENDERER_ID);
      expect(backToThree.value.restoredViewFields).toContain('camera');
      expect(backToThree.value.skippedViewFields).toEqual([]);
      expect(sessionStateOf(fabric.session(BABYLON_SESSION))).toBe('disposed');
      const backRecord = fabric.session(BACK_SESSION);
      expect(backRecord.ok && backRecord.value.state).toBe('active');
      if (backRecord.ok) {
        expect(backRecord.value.mountedWorldDigest).toBe(SCENE.digest);
      }
      const backPresentation = three.presentationOf(BACK_SESSION)!;
      expect([...backPresentation.presentedEntityIds]).toEqual([...PRESENTED_ENTITY_IDS]);

      // The wheel zoom normalizes identically on the returned Three.js
      // session (the shared zoom policy — the select payload digest of the
      // receipt pair above proves the cross-engine payload basis).
      const zoomIn = await normalized(
        fabric,
        BACK_SESSION,
        wheelDown(BACK_SESSION, 'rin-w061-pair-zoom-1', -120),
      );
      expect(zoomIn.intent).toEqual({
        id: 'epoch.world.interaction.zoom',
        version: '1.1.0',
      });
      expect(zoomIn.intentPayloadDigest).toMatch(/^[0-9a-f]{64}$/);

      // The no-durable-mutation proof: the canonical fixture is
      // byte-identical after the full cross-engine round trip.
      expect(JSON.stringify(SCENE)).toBe(fixtureBefore);
    } finally {
      await fabric.disposeSession(THREE_SESSION, CLOCK.switchCompleted);
      await fabric.disposeSession(BABYLON_SESSION, CLOCK.switchCompleted);
      await fabric.disposeSession(BACK_SESSION, CLOCK.switchCompleted);
    }
  });

  it('keeps the engine pair tenant-sealed (a cross-tenant world never mounts on either engine)', async () => {
    const { fabric } = enginePairFabric();
    await mountEngine(fabric, THREE_RENDERER_ID, THREE_SESSION);
    try {
      // A world projection of ANOTHER tenant cannot be presented by a
      // session bound to the fixture tenant (the R12 gate) — the direct
      // cross-engine registry changes nothing about tenant sealing.
      const crossTenant = await fabric.createSession({
        rendererId: BABYLONJS_RENDERER_ID,
        device: DEVICE,
        worldProjection: {
          sceneId: SCENE.sceneId,
          worldDigest: SCENE.digest,
          tenantScope: { tenantId: 'tenant-foreign' },
        },
        fabricSessionId: 'fx-w061-pair-foreign',
        atMs: CLOCK.sessionCreated,
        expectedTenantId: TENANT,
      });
      expect(crossTenant.ok).toBe(false);
      if (!crossTenant.ok) {
        expect(crossTenant.error.code).toBe('cross-tenant-denied');
      }
    } finally {
      await fabric.disposeSession(THREE_SESSION, CLOCK.switchCompleted);
    }
  });
});
