/**
 * THE W059 BABYLON.JS RENDERER CONFORMANCE BATTERY — NEGATIVE: typed
 * failures, degradation, fallback, and the honest headless/browser split
 * over the same W056 shared fixture.
 *
 * Every failure is TYPED (a discriminated code + precise fields) — never a
 * bare throw, never a silent drop. The two safety invariants exercised
 * hardest: an ABORTED switch never loses the previous session (retained,
 * still presenting, still interactive), and a fallback switch is RECORDED
 * (fallbackApplied + the typed trigger) with digest/tenant continuity
 * regardless of which renderer completed it.
 */
import { describe, expect, it } from 'vitest';
import { sealRendererAssetBinding, type RendererFailure } from '../../../packages/renderer-runtime/src/index';
import {
  BabylonRendererAdapter,
  nullEngineHost,
} from '../../../adapters/renderers/babylonjs/src/index';
import {
  CLOCK,
  DEVICE,
  ENTITY_IDS,
  ONTOLOGY,
  SCENE,
  TENANT,
  TENANT_OTHER,
  VARIANT_SCENE,
  WORLD_PROJECTION,
  buildFabric,
  fixtureViewState,
  registerRenderer,
} from '../fixture';
import type { RendererFabric } from '../../../packages/renderer-fabric/src/index';

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

/** Override EVERY declared identity member consistently (the registry
 * enforces identity/descriptor/capability agreement). */
function withRendererId(
  adapter: BabylonRendererAdapter,
  rendererId: string,
  extra: Partial<ConstructorParameters<typeof BabylonRendererAdapter>[0]> = {},
): BabylonRendererAdapter {
  const identity = adapter.identity();
  const descriptor = { ...adapter.descriptor(), rendererId };
  const capabilities = { ...adapter.capabilities(), rendererId };
  // A distinct variant gets its OWN capability identity (the registry keys
  // versions by capability id — a variant must not shadow the real one).
  const capabilityId =
    rendererId === 'rr-babylonjs-embedded'
      ? identity.capabilityId
      : `epoch.renderer.${rendererId.replace(/^rr-/, '')}`;
  return new BabylonRendererAdapter({
    host: nullEngineHost(),
    identity: { ...identity, rendererId, capabilityId },
    descriptor,
    capabilities,
    ...extra,
  });
}

/** A narrow-capability Babylon adapter (measurement off, static-frame only). */
function narrowBabylonRenderer(rendererId = 'rr-babylonjs-embedded'): BabylonRendererAdapter {
  const base = new BabylonRendererAdapter({ host: nullEngineHost() });
  return withRendererId(base, rendererId, {
    capabilities: {
      capabilityVersion: 1,
      rendererId,
      hitTesting: true,
      measurement: false,
      annotation: true,
      frameCapture: true,
      sessionSwitching: true,
      snapshotCapture: true,
      degradation: ['none', 'static-frame'],
      portableViewState: ['focused-entities', 'layer-visibility', 'timeline-position'],
      assetKinds: ['material', 'mesh'],
    },
  });
}

/** A Babylon adapter that rejects desktop probes (fallback-chain testing). */
function incompatibleBabylonRenderer(rendererId = 'rr-babylonjs-incompatible'): BabylonRendererAdapter {
  const base = new BabylonRendererAdapter({ host: nullEngineHost() });
  return withRendererId(base, rendererId, { incompatibleDeviceClasses: ['desktop'] });
}

/** A Babylon adapter constructed to fail mounts (switch-abort testing). */
function failingMountBabylonRenderer(rendererId = 'rr-babylonjs-failmount'): BabylonRendererAdapter {
  const base = new BabylonRendererAdapter({ host: nullEngineHost() });
  return withRendererId(base, rendererId, { failMounts: true });
}

/** Fabric + the named extra Babylon renderer registered (plus the defaults). */
function fabricWith(adapter: BabylonRendererAdapter, version = '1.0.0'): RendererFabric {
  const { fabric } = buildFabric();
  registerRenderer(fabric, adapter, version);
  return fabric;
}

/** Create + mount a Babylon session over the shared fixture. */
async function mountBabylon(fabric: RendererFabric, fabricSessionId: string, rendererId = 'rr-babylonjs-embedded') {
  const created = await fabric.createSession({
    rendererId,
    device: DEVICE,
    worldProjection: WORLD_PROJECTION,
    viewState: fixtureViewState(),
    fabricSessionId,
    atMs: CLOCK.sessionCreated,
    expectedTenantId: TENANT,
  });
  if (!created.ok) throw new Error(`session failed: ${created.error.message}`);
  const mounted = await fabric.mountScene(fabricSessionId, {
    scene: SCENE,
    ontology: ONTOLOGY,
    atMs: CLOCK.sceneMounted,
    expectedTenantId: TENANT,
  });
  if (!mounted.ok) throw new Error(`mount failed: ${mounted.error.message}`);
  return mounted.value;
}

describe('W059 Babylon.js conformance — typed failures, degradation, fallback (negative)', () => {
  it('rejects a cross-tenant device/world pairing at session creation', async () => {
    const fabric = fabricWith(new BabylonRendererAdapter({ host: nullEngineHost() }));
    const denied = await fabric.createSession({
      rendererId: 'rr-babylonjs-embedded',
      device: { ...DEVICE, tenantScope: { tenantId: TENANT_OTHER } },
      worldProjection: WORLD_PROJECTION,
      fabricSessionId: 'fx-babylon-negative-1',
      atMs: CLOCK.sessionCreated,
      expectedTenantId: TENANT,
    });
    const failure = expectFailure(denied, 'cross-tenant-denied');
    expect(failure.expectedTenantId).toBe(TENANT);
    expect(failure.encounteredTenantId).toBe(TENANT_OTHER);
  });

  it('resolves unknown renderers as typed adapter-unavailable failures', async () => {
    const fabric = fabricWith(new BabylonRendererAdapter({ host: nullEngineHost() }));
    expectFailure(fabric.resolveRenderer('rr-babylonjs-does-not-exist'), 'adapter-unavailable');
    const created = await fabric.createSession({
      rendererId: 'rr-babylonjs-does-not-exist',
      device: DEVICE,
      worldProjection: WORLD_PROJECTION,
      fabricSessionId: 'fx-babylon-negative-2',
      atMs: CLOCK.sessionCreated,
    });
    expectFailure(created, 'adapter-unavailable');
  });

  it('refuses mounting a different world revision (digest continuity at mount)', async () => {
    const fabric = fabricWith(new BabylonRendererAdapter({ host: nullEngineHost() }));
    await mountBabylon(fabric, 'fx-babylon-negative-3');
    expect(VARIANT_SCENE.digest).not.toBe(SCENE.digest);
    const mounted = await fabric.mountScene('fx-babylon-negative-3', {
      scene: VARIANT_SCENE,
      ontology: ONTOLOGY,
      atMs: CLOCK.sceneMounted,
      expectedTenantId: TENANT,
    });
    const failure = expectFailure(mounted, 'switch-incompatible');
    expect(failure.field).toBe('world-digest');
  });

  it('refuses unserviced modalities and malformed input with typed refusals', async () => {
    const fabric = fabricWith(new BabylonRendererAdapter({ host: nullEngineHost() }));
    await mountBabylon(fabric, 'fx-babylon-negative-4');
    // 'voice' is not serviced by the binding (the descriptor declares
    // keyboard + pointer + touch).
    const voice = await fabric.submitInput('fx-babylon-negative-4', {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: 'rin-babylon-negative-voice-1',
      fabricSessionId: 'fx-babylon-negative-4',
      atMs: CLOCK.firstInput,
      modality: 'voice',
      inputKind: 'pointer-down',
      pointer: { x: 0.5, y: 0.5 },
    });
    const voiceFailure = expectFailure(voice, 'input-unsupported');
    expect(voiceFailure.reason).toContain('undeclared interaction modality');
    // Malformed envelopes are typed refusals too.
    const malformed = await fabric.submitInput('fx-babylon-negative-4', {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: 'rin-babylon-negative-malformed-1',
      fabricSessionId: 'fx-babylon-negative-4',
      atMs: CLOCK.firstInput,
      modality: 'pointer',
      inputKind: 'pointer-down',
      pointer: { x: 5, y: 0.5 }, // out of [0, 1]
    });
    expectFailure(malformed, 'input-unsupported');
  });

  it('refuses measurement typed on the narrow-capability adapter', async () => {
    const narrow = narrowBabylonRenderer();
    const fabric = fabricWith(narrow);
    await mountBabylon(fabric, 'fx-babylon-negative-5');
    // Aim the measure hint at a REAL hit (the capability gate applies after
    // the semantic hit-test — a miss is a no-target, not a refusal).
    const session = narrow.adapterSessionOf('fx-babylon-negative-5')!;
    const projected = narrow.projectedPositionOf(session, ENTITY_IDS[0]);
    expect(projected).not.toBeNull();
    const refused = await fabric.submitInput('fx-babylon-negative-5', {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: 'rin-babylon-negative-measure-1',
      fabricSessionId: 'fx-babylon-negative-5',
      atMs: CLOCK.firstInput,
      modality: 'pointer',
      inputKind: 'pointer-down',
      pointer: { x: projected!.x, y: projected!.y },
      intentHint: { intent: { id: 'epoch.world.interaction.measure', version: '1.0.0' } },
    });
    const failure = expectFailure(refused, 'input-unsupported');
    expect(failure.reason).toContain('measurement');
  });

  it('types degradation: undeclared fidelity reductions are refused; declared ones degrade the Babylon session visibly', async () => {
    const fabric = fabricWith(new BabylonRendererAdapter({ host: nullEngineHost() }));
    await mountBabylon(fabric, 'fx-babylon-negative-6');
    // The full Babylon adapter declares every degradation: wireframe works.
    const wireframe = await fabric.applyFrame('fx-babylon-negative-6', {
      atMs: CLOCK.firstFrame,
      degradation: 'wireframe',
    });
    expect(wireframe.ok).toBe(true);
    if (wireframe.ok) {
      expect(wireframe.value.session.state).toBe('degraded');
      expect(wireframe.value.degradation).toBe('wireframe');
    }
    const health = await fabric.healthOf('fx-babylon-negative-6', CLOCK.firstFrame);
    expect(health.ok).toBe(true);
    if (health.ok) {
      expect(health.value.state).toBe('degraded');
      expect(health.value.degradation).toBe('wireframe');
    }
    // The NARROW adapter declares only static-frame: wireframe is refused.
    const fabric2 = fabricWith(narrowBabylonRenderer());
    await mountBabylon(fabric2, 'fx-babylon-negative-7');
    const refused = await fabric2.applyFrame('fx-babylon-negative-7', {
      atMs: CLOCK.firstFrame,
      degradation: 'wireframe',
    });
    const failure = expectFailure(refused, 'degraded');
    expect(failure.degradation).toBe('wireframe');
    expect(failure.reason).toBe('undeclared degradation');
    // The declared static-frame reduction presents on the narrow adapter.
    const staticFrame = await fabric2.applyFrame('fx-babylon-negative-7', {
      atMs: CLOCK.firstFrame + 1,
      degradation: 'static-frame',
    });
    expect(staticFrame.ok).toBe(true);
    if (staticFrame.ok) {
      expect(staticFrame.value.session.state).toBe('degraded');
      expect(staticFrame.value.degradation).toBe('static-frame');
      expect(staticFrame.value.presented).toBe(false);
    }
  });

  it('makes dispose terminal: disposed Babylon sessions refuse every invocation', async () => {
    const fabric = fabricWith(new BabylonRendererAdapter({ host: nullEngineHost() }));
    await mountBabylon(fabric, 'fx-babylon-negative-8');
    const disposed = await fabric.disposeSession('fx-babylon-negative-8', CLOCK.switchCompleted);
    expect(disposed.ok).toBe(true);
    if (disposed.ok) {
      expect(disposed.value.state).toBe('disposed');
      expect(disposed.value.mountedWorldDigest).toBeUndefined();
    }
    const frame = await fabric.applyFrame('fx-babylon-negative-8', { atMs: CLOCK.firstFrame });
    expectFailure(frame, 'session-disposed');
    const input = await fabric.submitInput('fx-babylon-negative-8', {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: 'rin-babylon-negative-disposed-1',
      fabricSessionId: 'fx-babylon-negative-8',
      atMs: CLOCK.firstInput,
      modality: 'pointer',
      inputKind: 'pointer-down',
      pointer: { x: 0.5, y: 0.5 },
    });
    expectFailure(input, 'session-disposed');
    const snapshot = await fabric.captureSnapshot('fx-babylon-negative-8', CLOCK.snapshotCaptured);
    expectFailure(snapshot, 'session-disposed');
    // Unknown session ids stay unknown (never conflated with disposed).
    const unknown = await fabric.applyFrame('fx-babylon-never', { atMs: CLOCK.firstFrame });
    expectFailure(unknown, 'unknown-session');
  });

  it('refuses headless frame capture TYPED (the honest headless/browser split — no fabricated evidence)', async () => {
    const babylon = new BabylonRendererAdapter({ host: nullEngineHost() });
    const fabric = fabricWith(babylon);
    await mountBabylon(fabric, 'fx-babylon-negative-9');
    const session = babylon.adapterSessionOf('fx-babylon-negative-9')!;
    const capture = await babylon.captureFrame(session, CLOCK.firstFrame);
    const failure = expectFailure(capture, 'session-failed');
    expect(failure.message).toContain('GL capture host');
  });

  it('enforces the asset-binding trust discipline at the adapter seam', async () => {
    const babylon = new BabylonRendererAdapter({ host: nullEngineHost() });
    const fabric = fabricWith(babylon);
    await mountBabylon(fabric, 'fx-babylon-negative-10');
    const session = babylon.adapterSessionOf('fx-babylon-negative-10')!;
    // Untrusted assets NEVER mount.
    const untrusted = sealRendererAssetBinding({
      schema: 'epoch.renderer-asset-binding',
      fabricProtocolVersion: '1.0.0',
      bindingId: 'rab-babylon-negative-untrusted-1',
      fabricSessionId: 'fx-babylon-negative-10',
      tenantScope: { tenantId: TENANT },
      assetDigest: 'a'.repeat(64),
      assetKind: 'texture',
      byteSize: 4_096,
      trustState: 'untrusted',
      boundAtMs: CLOCK.firstInput,
    });
    const refused = await babylon.bindAsset!(session, untrusted);
    const untrustedFailure = expectFailure(refused, 'asset-rejected');
    expect(untrustedFailure.reason).toBe('untrusted');
    // Declared + validated asset kinds bind.
    const validated = sealRendererAssetBinding({
      schema: 'epoch.renderer-asset-binding',
      fabricProtocolVersion: '1.0.0',
      bindingId: 'rab-babylon-negative-texture-1',
      fabricSessionId: 'fx-babylon-negative-10',
      tenantScope: { tenantId: TENANT },
      assetDigest: 'b'.repeat(64),
      assetKind: 'texture',
      byteSize: 4_096,
      trustState: 'validated',
      validatedAtMs: CLOCK.firstInput,
      boundAtMs: CLOCK.firstInput,
    });
    const bound = await babylon.bindAsset!(session, validated);
    expect(bound.ok).toBe(true);
    // The NARROW adapter declares no texture kind — typed refusal.
    const narrow = narrowBabylonRenderer();
    const fabric2 = fabricWith(narrow);
    await mountBabylon(fabric2, 'fx-babylon-negative-11');
    const narrowSession = narrow.adapterSessionOf('fx-babylon-negative-11')!;
    const narrowRefused = await narrow.bindAsset!(narrowSession, validated);
    const narrowFailure = expectFailure(narrowRefused, 'asset-rejected');
    expect(narrowFailure.reason).toBe('undeclared asset kind');
  });

  it('completes a switch through the ordered fallback chain when the primary Babylon target cannot present', async () => {
    // The SOURCE is the normal Babylon renderer; the PRIMARY TARGET is a
    // Babylon variant that rejects desktop probes (the fallback chain).
    const fabric = fabricWith(incompatibleBabylonRenderer());
    registerRenderer(fabric, new BabylonRendererAdapter({ host: nullEngineHost() }));
    await mountBabylon(fabric, 'fx-babylon-negative-12');
    const outcome = await fabric.switchRenderer(
      {
        schema: 'epoch.renderer-switch-request',
        fabricProtocolVersion: '1.0.0',
        switchId: 'sw-babylon-negative-1',
        sourceFabricSessionId: 'fx-babylon-negative-12',
        targetRendererId: 'rr-babylonjs-incompatible',
        expectedWorldDigest: SCENE.digest,
        expectedTenantId: TENANT,
        targetFabricSessionId: 'fx-babylon-negative-13',
        fallbackRendererIds: ['rr-conformance-full'],
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
    // The fallback completed the switch — RECORDED, with continuity intact.
    expect(outcome.value.receipt.fallbackApplied).toBe(true);
    expect(outcome.value.receipt.toRendererId).toBe('rr-conformance-full');
    expect(outcome.value.receipt.worldDigest).toBe(SCENE.digest);
    expect(outcome.value.receipt.tenantScope.tenantId).toBe(TENANT);
    expect(outcome.value.fallback?.code).toBe('fallback-applied');
  });

  it('aborts a switch whose Babylon target cannot mount — and RETAINS the previous session', async () => {
    // The SOURCE is the normal Babylon renderer; the TARGET is a Babylon
    // variant constructed to fail mounts (the abort path).
    const fabric = fabricWith(failingMountBabylonRenderer());
    registerRenderer(fabric, new BabylonRendererAdapter({ host: nullEngineHost() }));
    await mountBabylon(fabric, 'fx-babylon-negative-14');
    const sourceReceipt = await fabric.submitInput(
      'fx-babylon-negative-14',
      {
        schema: 'epoch.renderer-input-envelope',
        fabricProtocolVersion: '1.0.0',
        inputId: 'rin-babylon-negative-abort-1',
        fabricSessionId: 'fx-babylon-negative-14',
        atMs: CLOCK.firstInput,
        modality: 'pointer',
        inputKind: 'pointer-down',
        pointer: { x: 0.5, y: 0.5 },
      },
    );
    expect(sourceReceipt.ok).toBe(true);
    const aborted = await fabric.switchRenderer(
      {
        schema: 'epoch.renderer-switch-request',
        fabricProtocolVersion: '1.0.0',
        switchId: 'sw-babylon-negative-2',
        sourceFabricSessionId: 'fx-babylon-negative-14',
        targetRendererId: 'rr-babylonjs-failmount',
        expectedWorldDigest: SCENE.digest,
        expectedTenantId: TENANT,
        targetFabricSessionId: 'fx-babylon-negative-15',
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
    expect(failure.retainedFabricSessionId).toBe('fx-babylon-negative-14');
    // The previous session is RETAINED: still active, still interactive.
    const retained = fabric.session('fx-babylon-negative-14');
    expect(retained.ok).toBe(true);
    if (retained.ok) {
      expect(retained.value.state).toBe('active');
      expect(retained.value.mountedWorldDigest).toBe(SCENE.digest);
    }
    const stillInteractive = await fabric.submitInput(
      'fx-babylon-negative-14',
      {
        schema: 'epoch.renderer-input-envelope',
        fabricProtocolVersion: '1.0.0',
        inputId: 'rin-babylon-negative-abort-2',
        fabricSessionId: 'fx-babylon-negative-14',
        atMs: CLOCK.secondInput,
        modality: 'pointer',
        inputKind: 'pointer-down',
        pointer: { x: 0.5, y: 0.5 },
      },
    );
    expect(stillInteractive.ok).toBe(true);
  });
});
