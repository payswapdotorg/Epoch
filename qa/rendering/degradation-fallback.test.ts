/**
 * THE W061 ENGINE-PAIR BATTERY — FORCED DEGRADATION / FAILURE / FALLBACK:
 * the typed ladder across BOTH real engine adapters (W058 Three.js + W059
 * Babylon.js) in ONE fabric, over the SHARED canonical conformance fixture
 * — the W061 work-order acceptance legs "force renderer degradation and
 * verify the declared fallback" and "force renderer failure and verify the
 * declared fallback".
 *
 * The ladder (every step TYPED — never a bare throw, never a silent drop):
 * - DECLARED degradations apply on BOTH engines (reduced-fidelity,
 *   static-frame, wireframe): presentation-only, reversible, recorded in
 *   the frame envelope and the session record ('degraded'), and RECOVER
 *   (a later 'none' frame returns the session to 'active');
 * - UNDECLARED degradations are typed refusals (the fabric gate: a
 *   narrow-capability engine variant declares only 'none'/'static-frame',
 *   so 'wireframe' is refused with the 'degraded' code — declared-only,
 *   never silent);
 * - a switch whose PRIMARY target cannot present (a probe-incompatible
 *   engine variant) COMPLETES through the ordered fallback chain on the
 *   OTHER REAL ENGINE — recorded (fallbackApplied + the typed trigger),
 *   with digest/tenant continuity intact;
 * - a switch whose target cannot MOUNT (a forced-mount-failure engine
 *   variant) ABORTS typed ('switch-aborted', stage 'mount') and the
 *   previous session is RETAINED — still active, still interactive;
 * - a DEGRADED source session still switches with full continuity (the
 *   degradation is presentation state, not identity).
 *
 * Honest headless scope: the deterministic cores of both engines run for
 * real in Node 22; GL rasterization is the browser E2E surface. The typed
 * HEADLESS frame-image-capture refusals of both adapters are pinned by
 * their own unit batteries (adapters/renderers/threejs capture-capabilities,
 * adapters/renderers/babylonjs capture) — not duplicated here.
 */
import { describe, expect, it } from 'vitest';
import { RendererFabric } from '../../packages/renderer-fabric/src/index';
import type { FabricResult, RendererFailure, RendererSession } from '../../packages/renderer-runtime/src/index';
import {
  THREE_RENDERER_ID,
  ThreeJsRendererAdapter,
  isWireframe,
  playbackFrozen,
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
// Battery helpers.
// ---------------------------------------------------------------------------

/** The fabric session ids of this battery. */
const THREE_SESSION = 'fx-w061-ladder-three';
const BABYLON_SESSION = 'fx-w061-ladder-babylon';
const FALLBACK_SESSION = 'fx-w061-ladder-fallback';
const DEGRADED_BACK = 'fx-w061-ladder-degraded-back';

/**
 * Override EVERY declared identity member of a Babylon adapter variant
 * consistently (the registry enforces identity/descriptor/capability
 * agreement — the W059 battery pattern).
 */
function babylonVariant(
  rendererId: string,
  extra: Partial<ConstructorParameters<typeof BabylonRendererAdapter>[0]>,
): BabylonRendererAdapter {
  const base = new BabylonRendererAdapter({ host: nullEngineHost() });
  const identity = base.identity();
  return new BabylonRendererAdapter({
    host: nullEngineHost(),
    identity: {
      ...identity,
      rendererId,
      capabilityId: `epoch.renderer.${rendererId.replace(/^rr-/, '')}`,
    },
    descriptor: { ...base.descriptor(), rendererId },
    capabilities: { ...base.capabilities(), rendererId },
    ...extra,
  });
}

/** Build the engine-pair fabric + the named variant registered. */
function ladderFabric(
  ...variants: readonly BabylonRendererAdapter[]
): {
  readonly fabric: RendererFabric;
  readonly three: ThreeJsRendererAdapter;
  readonly babylon: BabylonRendererAdapter;
} {
  const fabric = new RendererFabric();
  const three = new ThreeJsRendererAdapter();
  const babylon = new BabylonRendererAdapter({ host: nullEngineHost() });
  registerRenderer(fabric, three);
  registerRenderer(fabric, babylon);
  for (const variant of variants) {
    registerRenderer(fabric, variant);
  }
  return { fabric, three, babylon };
}

/** Create + mount one engine session over the shared fixture. */
async function mountEngine(
  fabric: RendererFabric,
  rendererId: string,
  fabricSessionId: string,
): Promise<RendererSession> {
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
  return mounted.value;
}

/** Narrow a fabric failure to its typed code (readable mismatches). */
function expectFailure<C extends RendererFailure['code']>(
  result: { ok: true } | { ok: false; error: RendererFailure },
  code: C,
): Extract<RendererFailure, { code: C }> {
  if (!result.ok) {
    if (result.error.code === code) {
      return result.error as Extract<RendererFailure, { code: C }>;
    }
    throw new Error(
      `expected typed "${code}" failure, got "${result.error.code}": ${result.error.message}`,
    );
  }
  throw new Error(`expected typed "${code}" failure, got a success`);
}

/** One raw wheel envelope (interactive-source evidence). */
function wheelDown(fabricSessionId: string, inputId: string): Record<string, unknown> {
  return {
    schema: 'epoch.renderer-input-envelope',
    fabricProtocolVersion: '1.0.0',
    inputId,
    fabricSessionId,
    atMs: CLOCK.firstInput,
    modality: 'pointer',
    inputKind: 'wheel',
    delta: { x: 0, y: -120 },
  };
}

describe('the W061 forced degradation / failure / fallback ladder (both real engines)', () => {
  it('applies every DECLARED degradation on the Three.js engine — presentation-only, reversible, recorded', async () => {
    const { fabric, three } = ladderFabric();
    await mountEngine(fabric, THREE_RENDERER_ID, THREE_SESSION);
    try {
      // reduced-fidelity: the frame reports it; the session record degrades.
      const reduced = await fabric.applyFrame(THREE_SESSION, {
        atMs: CLOCK.firstFrame,
        degradation: 'reduced-fidelity',
      });
      expect(reduced.ok).toBe(true);
      if (reduced.ok) {
        expect(reduced.value.degradation).toBe('reduced-fidelity');
        expect(reduced.value.frame.worldDigest).toBe(SCENE.digest);
      }
      expect(sessionStateOf(fabric.session(THREE_SESSION))).toBe('degraded');
      // static-frame: playback freezes (presentation-only).
      const frozen = await fabric.applyFrame(THREE_SESSION, {
        atMs: CLOCK.firstFrame + 1,
        degradation: 'static-frame',
      });
      expect(frozen.ok).toBe(true);
      expect(playbackFrozen(three.presentationOf(THREE_SESSION)!)).toBe(true);
      // wireframe: the entity materials flip (typed presentation evidence).
      const wire = await fabric.applyFrame(THREE_SESSION, {
        atMs: CLOCK.firstFrame + 2,
        degradation: 'wireframe',
      });
      expect(wire.ok).toBe(true);
      expect(isWireframe(three.presentationOf(THREE_SESSION)!, ENTITY_IDS[0]!)).toBe(true);
      // RECOVERY: a 'none' frame returns the session to active.
      const recovered = await fabric.applyFrame(THREE_SESSION, { atMs: CLOCK.firstFrame + 3 });
      expect(recovered.ok).toBe(true);
      if (recovered.ok) {
        expect(recovered.value.degradation).toBe('none');
      }
      expect(sessionStateOf(fabric.session(THREE_SESSION))).toBe('active');
      expect(playbackFrozen(three.presentationOf(THREE_SESSION)!)).toBe(false);
      expect(isWireframe(three.presentationOf(THREE_SESSION)!, ENTITY_IDS[0]!)).toBe(false);
    } finally {
      await fabric.disposeSession(THREE_SESSION, CLOCK.switchCompleted);
    }
  });

  it('applies every DECLARED degradation on the Babylon.js engine — presentation-only, reversible, recorded', async () => {
    const { fabric, babylon } = ladderFabric();
    await mountEngine(fabric, BABYLONJS_RENDERER_ID, BABYLON_SESSION);
    try {
      // wireframe then reduced-fidelity: the frame reports each kind and
      // the session record degrades.
      for (const kind of ['wireframe', 'reduced-fidelity'] as const) {
        const applied = await fabric.applyFrame(BABYLON_SESSION, {
          atMs: CLOCK.firstFrame,
          degradation: kind,
        });
        expect(applied.ok).toBe(true);
        if (applied.ok) {
          expect(applied.value.degradation).toBe(kind);
          expect(applied.value.frame.worldDigest).toBe(SCENE.digest);
        }
        expect(
          sessionStateOf(fabric.session(BABYLON_SESSION)),
        ).toBe('degraded');
      }
      // static-frame: the adapter reports the frame NOT presented (the
      // last presented frame stays — playback stops advancing).
      const frozen = await fabric.applyFrame(BABYLON_SESSION, {
        atMs: CLOCK.firstFrame + 1,
        degradation: 'static-frame',
      });
      expect(frozen.ok).toBe(true);
      if (frozen.ok) {
        expect(frozen.value.presented).toBe(false);
        expect(frozen.value.degradation).toBe('static-frame');
      }
      // RECOVERY: a 'none' frame presents again and returns the record to
      // active.
      const recovered = await fabric.applyFrame(BABYLON_SESSION, { atMs: CLOCK.firstFrame + 2 });
      expect(recovered.ok).toBe(true);
      if (recovered.ok) {
        expect(recovered.value.presented).toBe(true);
        expect(recovered.value.degradation).toBe('none');
      }
      expect(
        sessionStateOf(fabric.session(BABYLON_SESSION)),
      ).toBe('active');
      expect(babylon.adapterSessionOf(BABYLON_SESSION)).toBeDefined();
    } finally {
      await fabric.disposeSession(BABYLON_SESSION, CLOCK.switchCompleted);
    }
  });

  it('refuses UNDECLARED degradations typed (the fabric gate: declared-only, never silent)', async () => {
    // A narrow-capability Babylon variant declares only
    // 'none'/'static-frame' — the same gate every real adapter passes
    // through; 'wireframe' must be a typed refusal.
    const narrow = babylonVariant('rr-babylonjs-narrow-degrade', {
      capabilities: {
        ...new BabylonRendererAdapter({ host: nullEngineHost() }).capabilities(),
        rendererId: 'rr-babylonjs-narrow-degrade',
        degradation: ['none', 'static-frame'],
      },
    });
    const { fabric } = ladderFabric(narrow);
    await mountEngine(fabric, 'rr-babylonjs-narrow-degrade', BABYLON_SESSION);
    try {
      const refused = await fabric.applyFrame(BABYLON_SESSION, {
        atMs: CLOCK.firstFrame,
        degradation: 'wireframe',
      });
      const failure = expectFailure(refused, 'degraded');
      expect(failure.degradation).toBe('wireframe');
      expect(failure.reason).toBe('undeclared degradation');
      // The REAL Three.js engine in the SAME fabric still accepts the same
      // declared degradation (the gate is per-adapter-declaration).
      await mountEngine(fabric, THREE_RENDERER_ID, THREE_SESSION);
      const accepted = await fabric.applyFrame(THREE_SESSION, {
        atMs: CLOCK.firstFrame,
        degradation: 'wireframe',
      });
      expect(accepted.ok).toBe(true);
    } finally {
      await fabric.disposeSession(BABYLON_SESSION, CLOCK.switchCompleted);
      await fabric.disposeSession(THREE_SESSION, CLOCK.switchCompleted);
    }
  });

  it('completes a cross-engine switch through the ordered FALLBACK chain when the primary target cannot present', async () => {
    // The PRIMARY TARGET is a Babylon variant that rejects desktop probes;
    // the fallback is the REAL Three.js engine — the switch must COMPLETE
    // on Three.js, RECORDED as a fallback, with continuity intact.
    const incompatible = babylonVariant('rr-babylonjs-incompatible', {
      incompatibleDeviceClasses: ['desktop'],
    });
    const { fabric } = ladderFabric(incompatible);
    await mountEngine(fabric, BABYLONJS_RENDERER_ID, BABYLON_SESSION);
    try {
      const outcome = await fabric.switchRenderer(
        {
          schema: 'epoch.renderer-switch-request',
          fabricProtocolVersion: '1.0.0',
          switchId: 'sw-w061-ladder-1',
          sourceFabricSessionId: BABYLON_SESSION,
          targetRendererId: 'rr-babylonjs-incompatible',
          expectedWorldDigest: SCENE.digest,
          expectedTenantId: TENANT,
          targetFabricSessionId: FALLBACK_SESSION,
          fallbackRendererIds: [THREE_RENDERER_ID],
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
      // The FALLBACK (the real Three.js engine) completed the switch.
      expect(outcome.value.receipt.fallbackApplied).toBe(true);
      expect(outcome.value.receipt.toRendererId).toBe(THREE_RENDERER_ID);
      expect(outcome.value.receipt.fromRendererId).toBe(BABYLONJS_RENDERER_ID);
      // Continuity intact regardless of which renderer completed it.
      expect(outcome.value.receipt.worldDigest).toBe(SCENE.digest);
      expect(outcome.value.receipt.tenantScope.tenantId).toBe(TENANT);
      expect(outcome.value.fallback?.code).toBe('fallback-applied');
      // The target session presents the same world, interactive.
      const fallbackRecord = fabric.session(FALLBACK_SESSION);
      expect(fallbackRecord.ok && fallbackRecord.value.state).toBe('active');
      if (fallbackRecord.ok) {
        expect(fallbackRecord.value.mountedWorldDigest).toBe(SCENE.digest);
      }
      const wheel = await fabric.submitInput(FALLBACK_SESSION, wheelDown(FALLBACK_SESSION, 'rin-w061-ladder-fb-1'));
      expect(wheel.ok).toBe(true);
    } finally {
      await fabric.disposeSession(BABYLON_SESSION, CLOCK.switchCompleted);
      await fabric.disposeSession(FALLBACK_SESSION, CLOCK.switchCompleted);
    }
  });

  it('aborts a switch whose target cannot MOUNT — and RETAINS the previous session (still interactive)', async () => {
    // The TARGET is a Babylon variant constructed to fail mounts; with no
    // further fallback the switch aborts typed at the mount stage and the
    // SOURCE (the real Three.js session) is retained.
    const failMount = babylonVariant('rr-babylonjs-failmount', { failMounts: true });
    const { fabric, three } = ladderFabric(failMount);
    await mountEngine(fabric, THREE_RENDERER_ID, THREE_SESSION);
    try {
      // The source is interactive BEFORE the failed switch.
      const before = await fabric.submitInput(THREE_SESSION, wheelDown(THREE_SESSION, 'rin-w061-ladder-abort-1'));
      expect(before.ok).toBe(true);
      const aborted = await fabric.switchRenderer(
        {
          schema: 'epoch.renderer-switch-request',
          fabricProtocolVersion: '1.0.0',
          switchId: 'sw-w061-ladder-2',
          sourceFabricSessionId: THREE_SESSION,
          targetRendererId: 'rr-babylonjs-failmount',
          expectedWorldDigest: SCENE.digest,
          expectedTenantId: TENANT,
          targetFabricSessionId: FALLBACK_SESSION,
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
      const failure = expectFailure(aborted, 'switch-aborted');
      expect(failure.stage).toBe('mount');
      expect(failure.retainedFabricSessionId).toBe(THREE_SESSION);
      expect(failure.trigger?.code).toBe('mount-failed');
      // The previous session is RETAINED: still active, still presenting,
      // still interactive — the abort never loses the workspace.
      const retained = fabric.session(THREE_SESSION);
      expect(retained.ok && retained.value.state).toBe('active');
      if (retained.ok) {
        expect(retained.value.mountedWorldDigest).toBe(SCENE.digest);
      }
      expect(three.presentationOf(THREE_SESSION)).toBeDefined();
      const after = await fabric.submitInput(THREE_SESSION, wheelDown(THREE_SESSION, 'rin-w061-ladder-abort-2'));
      expect(after.ok).toBe(true);
      // The half-created target session is disposed (no orphan sessions).
      expect(sessionStateOf(fabric.session(FALLBACK_SESSION))).toBe('disposed');
    } finally {
      await fabric.disposeSession(THREE_SESSION, CLOCK.switchCompleted);
      await fabric.disposeSession(FALLBACK_SESSION, CLOCK.switchCompleted);
    }
  });

  it('switches a DEGRADED session with full continuity (degradation is presentation, not identity)', async () => {
    const { fabric, three } = ladderFabric();
    await mountEngine(fabric, THREE_RENDERER_ID, THREE_SESSION);
    try {
      // Degrade the source (static-frame — playback frozen).
      const degraded = await fabric.applyFrame(THREE_SESSION, {
        atMs: CLOCK.firstFrame,
        degradation: 'static-frame',
      });
      expect(degraded.ok).toBe(true);
      expect(sessionStateOf(fabric.session(THREE_SESSION))).toBe('degraded');
      // The switch still carries the world identity + portable state.
      const toBabylon = await fabric.switchRenderer(
        {
          schema: 'epoch.renderer-switch-request',
          fabricProtocolVersion: '1.0.0',
          switchId: 'sw-w061-ladder-3',
          sourceFabricSessionId: THREE_SESSION,
          targetRendererId: BABYLONJS_RENDERER_ID,
          expectedWorldDigest: SCENE.digest,
          expectedTenantId: TENANT,
          targetFabricSessionId: DEGRADED_BACK,
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
      expect(toBabylon.value.receipt.worldDigest).toBe(SCENE.digest);
      expect(toBabylon.value.receipt.toRendererId).toBe(BABYLONJS_RENDERER_ID);
      expect(toBabylon.value.restoredViewFields).toContain('camera');
      // The degraded source is disposed; the TARGET starts fresh (active).
      expect(sessionStateOf(fabric.session(THREE_SESSION))).toBe('disposed');
      const target = fabric.session(DEGRADED_BACK);
      expect(target.ok && target.value.state).toBe('active');
      // The engine pair is symmetric: the reverse switch also holds.
      const back = await fabric.switchRenderer(
        {
          schema: 'epoch.renderer-switch-request',
          fabricProtocolVersion: '1.0.0',
          switchId: 'sw-w061-ladder-4',
          sourceFabricSessionId: DEGRADED_BACK,
          targetRendererId: THREE_RENDERER_ID,
          expectedWorldDigest: SCENE.digest,
          expectedTenantId: TENANT,
          targetFabricSessionId: THREE_SESSION,
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
      expect(back.ok).toBe(true);
      if (!back.ok) return;
      expect(back.value.receipt.worldDigest).toBe(SCENE.digest);
      expect(back.value.receipt.toRendererId).toBe(THREE_RENDERER_ID);
      expect(three.presentationOf(THREE_SESSION)).toBeDefined();
    } finally {
      await fabric.disposeSession(THREE_SESSION, CLOCK.switchCompleted);
      await fabric.disposeSession(DEGRADED_BACK, CLOCK.switchCompleted);
    }
  });
});
