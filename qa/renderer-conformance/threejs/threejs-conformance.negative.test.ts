/**
 * THE W058 THREE.JS RENDERER CONFORMANCE BATTERY — NEGATIVE: typed
 * failures and safety invariants over the SAME shared canonical fixture,
 * exercised against the REAL Three.js adapter.
 *
 * Every documented failure mode of this renderer kind is produced by a
 * REAL interaction with the fabric or the adapter, and every failure is
 * TYPED (a discriminated RendererFailure code + precise fields) — never a
 * bare throw at the seam, never a silent drop. The safety invariants
 * exercised hardest here:
 *
 * - a session that cannot present NEVER gets created (probe rejections
 *   are typed);
 * - digest/tenant continuity is enforced at every mount and switch;
 * - an ABORTED switch never loses the previous (real) session;
 * - DISPOSE IS TERMINAL and total: the GPU ledger releases every tracked
 *   resource (real Three.js dispose events), and disposed sessions refuse
 *   everything;
 * - untrusted assets NEVER mount;
 * - the headless adapter NEVER fabricates GL evidence: frame image
 *   capture is a typed refusal without an injected surface.
 */
import { describe, expect, it } from 'vitest';
import { ReferenceRendererAdapter, type RendererAdapter } from '../../../packages/renderer-fabric/src/index';
import {
  bindRendererSession,
  sealRendererAssetBinding,
  type DeviceSessionSnapshot,
  type RendererFailure,
} from '../../../packages/renderer-runtime/src/index';
import {
  CLOCK,
  DESCRIPTOR_A,
  DEVICE,
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
import {
  HEADLESS_CAPTURE_REFUSAL,
  THREE_RENDERER_ID,
  ThreeJsRendererAdapter,
  projectedPointerOf,
} from '../../../adapters/renderers/threejs/src/index';

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

/** One fabric + the reference renderers + the REAL three.js adapter. */
function buildThreeFabric(adapter: RendererAdapter = new ThreeJsRendererAdapter()) {
  const { fabric } = buildFabric();
  registerRenderer(fabric, adapter);
  return fabric;
}

/** Create + mount one three.js session over the SHARED fixture (throws readable). */
async function mountThreeSession(
  fabric: ReturnType<typeof buildFabric>['fabric'],
  fabricSessionId: string,
): Promise<void> {
  const created = await fabric.createSession({
    rendererId: THREE_RENDERER_ID,
    device: DEVICE,
    worldProjection: WORLD_PROJECTION,
    viewState: fixtureViewState(),
    fabricSessionId,
    atMs: CLOCK.sessionCreated,
    expectedTenantId: TENANT,
  });
  if (!created.ok) {
    throw new Error(`three.js session failed: ${created.error.message}`);
  }
  const mounted = await fabric.mountScene(fabricSessionId, {
    scene: SCENE,
    ontology: ONTOLOGY,
    atMs: CLOCK.sceneMounted,
    expectedTenantId: TENANT,
  });
  if (!mounted.ok) {
    throw new Error(`three.js mount failed: ${mounted.error.message}`);
  }
}

/** A headset device of the fixture tenant (this adapter ships no XR surface). */
function headsetDevice(): DeviceSessionSnapshot {
  return {
    ...structuredClone(DEVICE),
    deviceSessionId: 'ds-w058-headset-1',
    device: { ...structuredClone(DEVICE.device), deviceClass: 'headset' },
  };
}

/** A device of the FOREIGN tenant (cross-tenant negative checks). */
function foreignDevice(): DeviceSessionSnapshot {
  return {
    ...structuredClone(DEVICE),
    deviceSessionId: 'ds-w058-foreign-1',
    tenantScope: { tenantId: TENANT_OTHER },
  };
}

describe('W058 three.js renderer conformance — typed failures (negative)', () => {
  it('refuses sessions on devices this adapter cannot present (typed probe rejection)', async () => {
    const fabric = buildThreeFabric();

    // The pure probe is honest first (no session created, no GL).
    const probed = await fabric.probeRenderer(THREE_RENDERER_ID, headsetDevice(), CLOCK.sessionCreated);
    expect(probed.ok).toBe(true);
    if (!probed.ok) return;
    expect(probed.value.compatible).toBe(false);
    expect(probed.value.reason).toContain('headset');

    // Session creation over the same device is a typed probe-rejected
    // failure — never a silent fallback, never a created-but-broken session.
    const created = await fabric.createSession({
      rendererId: THREE_RENDERER_ID,
      device: headsetDevice(),
      worldProjection: WORLD_PROJECTION,
      fabricSessionId: 'fx-w058-negative-headset',
      atMs: CLOCK.sessionCreated,
      expectedTenantId: TENANT,
    });
    expectFailure(created, 'probe-rejected');
  });

  it('probes small screens compatible under the declared reduced-fidelity degradation', async () => {
    const fabric = buildThreeFabric();
    const phone: DeviceSessionSnapshot = {
      ...structuredClone(DEVICE),
      deviceSessionId: 'ds-w058-phone-1',
      device: { ...structuredClone(DEVICE.device), deviceClass: 'phone' },
    };
    const probed = await fabric.probeRenderer(THREE_RENDERER_ID, phone, CLOCK.sessionCreated);
    expect(probed.ok).toBe(true);
    if (!probed.ok) return;
    expect(probed.value.compatible).toBe(true);
    expect(probed.value.degradation).toBe('reduced-fidelity');
  });

  it('rejects a cross-tenant device/world pairing at session creation', async () => {
    const fabric = buildThreeFabric();
    const created = await fabric.createSession({
      rendererId: THREE_RENDERER_ID,
      device: foreignDevice(),
      worldProjection: WORLD_PROJECTION,
      fabricSessionId: 'fx-w058-negative-tenant',
      atMs: CLOCK.sessionCreated,
      expectedTenantId: TENANT_OTHER,
    });
    const failure = expectFailure(created, 'cross-tenant-denied');
    expect(failure.expectedTenantId).toBe(TENANT);
    expect(failure.encounteredTenantId).toBe(TENANT_OTHER);
  });

  it('refuses mounting a different world revision (digest continuity is enforced)', async () => {
    const three = new ThreeJsRendererAdapter();
    const fabric = buildThreeFabric(three);
    await mountThreeSession(fabric, 'fx-w058-negative-digest');
    // The variant scene is the SAME tenant but a DIFFERENT revision.
    expect(VARIANT_SCENE.digest).not.toBe(SCENE.digest);
    const mounted = await fabric.mountScene('fx-w058-negative-digest', {
      scene: VARIANT_SCENE,
      ontology: ONTOLOGY,
      atMs: CLOCK.sceneMounted,
      expectedTenantId: TENANT,
    });
    const failure = expectFailure(mounted, 'switch-incompatible');
    expect(failure.field).toBe('world-digest');
    expect(failure.expected).toBe(SCENE.digest);
    expect(failure.encountered).toBe(VARIANT_SCENE.digest);
    // Nothing remounted: the session keeps its original presentation.
    expect(three.presentationOf('fx-w058-negative-digest')).toBeDefined();
    expect(
      three.presentationOf('fx-w058-negative-digest')!.mountedWorldDigest,
    ).toBe(SCENE.digest);
  });

  it('rejects malformed input envelopes and unserviced modalities with typed refusals', async () => {
    const fabric = buildThreeFabric();
    await mountThreeSession(fabric, 'fx-w058-negative-input');

    // Malformed envelope (pointer out of the normalized [0,1] range).
    const malformed = await fabric.submitInput('fx-w058-negative-input', {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: 'rin-w058-negative-malformed-1',
      fabricSessionId: 'fx-w058-negative-input',
      atMs: CLOCK.firstInput,
      modality: 'pointer',
      inputKind: 'pointer-down',
      pointer: { x: 1.5, y: 0.5 },
    });
    expectFailure(malformed, 'input-unsupported');

    // Unserviced modality (voice is not in the binding's effective set).
    const voice = await fabric.submitInput('fx-w058-negative-input', {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: 'rin-w058-negative-voice-1',
      fabricSessionId: 'fx-w058-negative-input',
      atMs: CLOCK.firstInput,
      modality: 'voice',
      inputKind: 'pointer-down',
      pointer: { x: 0.5, y: 0.5 },
    });
    const voiceFailure = expectFailure(voice, 'input-unsupported');
    expect(voiceFailure.reason).toContain('undeclared interaction modality');
  });

  it('rejects an unsupported intent hint with a typed refusal (never a silent drop)', async () => {
    const three = new ThreeJsRendererAdapter();
    const fabric = buildThreeFabric(three);
    await mountThreeSession(fabric, 'fx-w058-negative-hint');
    // The pointer aims at a REAL presented entity (derived from the actual
    // projection), so the refusal is about the HINT, not a miss.
    const presentation = three.presentationOf('fx-w058-negative-hint')!;
    const entityId = presentation.presentedEntityIds[0]!;
    const pointer = projectedPointerOf(presentation, entityId)!;
    // An intent hint outside the W016 world-interaction vocabulary (the
    // approve interaction belongs to the ACTION surface, not the world).
    const refused = await fabric.submitInput('fx-w058-negative-hint', {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: 'rin-w058-negative-hint-1',
      fabricSessionId: 'fx-w058-negative-hint',
      atMs: CLOCK.firstInput,
      modality: 'pointer',
      inputKind: 'pointer-down',
      pointer: { x: pointer.x, y: pointer.y },
      intentHint: { intent: { id: 'epoch.world.interaction.approve', version: '1.0.0' } },
    });
    const failure = expectFailure(refused, 'input-unsupported');
    expect(failure.inputKind).toBe('pointer-down');
    expect(failure.message).toContain('unsupported intent hint');
  });

  it('enforces the asset-binding trust discipline at the three.js adapter seam', async () => {
    const three = new ThreeJsRendererAdapter();
    const fabric = buildThreeFabric(three);
    await mountThreeSession(fabric, 'fx-w058-negative-asset');
    const session = three.adapterSessionOf('fx-w058-negative-asset');
    expect(session).toBeDefined();

    // Untrusted assets NEVER mount (the security invariant) — typed
    // asset-rejected, reason untrusted.
    const untrusted = sealRendererAssetBinding({
      schema: 'epoch.renderer-asset-binding',
      fabricProtocolVersion: '1.0.0',
      bindingId: 'rab-w058-untrusted-1',
      fabricSessionId: 'fx-w058-negative-asset',
      tenantScope: { tenantId: TENANT },
      assetDigest: 'a'.repeat(64),
      assetKind: 'mesh',
      byteSize: 4_096,
      trustState: 'untrusted',
      boundAtMs: CLOCK.firstInput,
    });
    const refused = await three.bindAsset!(session!, untrusted);
    const failure = expectFailure(refused, 'asset-rejected');
    expect(failure.reason).toBe('untrusted');

    // Declared + validated asset kinds bind (tracked digest-addressed).
    const validated = sealRendererAssetBinding({
      schema: 'epoch.renderer-asset-binding',
      fabricProtocolVersion: '1.0.0',
      bindingId: 'rab-w058-mesh-1',
      fabricSessionId: 'fx-w058-negative-asset',
      tenantScope: { tenantId: TENANT },
      assetDigest: 'b'.repeat(64),
      assetKind: 'mesh',
      byteSize: 4_096,
      trustState: 'validated',
      validatedAtMs: CLOCK.firstInput,
      boundAtMs: CLOCK.firstInput,
    });
    const bound = await three.bindAsset!(session!, validated);
    expect(bound.ok).toBe(true);

    // An UNDECLARED asset kind is a typed refusal (this adapter binds
    // material/mesh/texture — 'animation' assets are not declared).
    const animation = sealRendererAssetBinding({
      schema: 'epoch.renderer-asset-binding',
      fabricProtocolVersion: '1.0.0',
      bindingId: 'rab-w058-animation-1',
      fabricSessionId: 'fx-w058-negative-asset',
      tenantScope: { tenantId: TENANT },
      assetDigest: 'c'.repeat(64),
      assetKind: 'animation',
      byteSize: 4_096,
      trustState: 'validated',
      validatedAtMs: CLOCK.firstInput,
      boundAtMs: CLOCK.firstInput,
    });
    const kindRefused = await three.bindAsset!(session!, animation);
    const kindFailure = expectFailure(kindRefused, 'asset-rejected');
    expect(kindFailure.reason).toBe('undeclared asset kind');
  });

  it('makes dispose terminal: disposed sessions refuse every invocation', async () => {
    const three = new ThreeJsRendererAdapter();
    const fabric = buildThreeFabric(three);
    await mountThreeSession(fabric, 'fx-w058-negative-disposed');
    const disposed = await fabric.disposeSession('fx-w058-negative-disposed', CLOCK.switchCompleted);
    expect(disposed.ok).toBe(true);

    // Every subsequent invocation is a typed session-disposed failure.
    expectFailure(
      await fabric.mountScene('fx-w058-negative-disposed', {
        scene: SCENE,
        ontology: ONTOLOGY,
        atMs: CLOCK.sceneMounted,
        expectedTenantId: TENANT,
      }),
      'session-disposed',
    );
    expectFailure(
      await fabric.applyFrame('fx-w058-negative-disposed', { atMs: CLOCK.firstFrame }),
      'session-disposed',
    );
    expectFailure(
      await fabric.submitInput('fx-w058-negative-disposed', {
        schema: 'epoch.renderer-input-envelope',
        fabricProtocolVersion: '1.0.0',
        inputId: 'rin-w058-negative-disposed-1',
        fabricSessionId: 'fx-w058-negative-disposed',
        atMs: CLOCK.firstInput,
        modality: 'pointer',
        inputKind: 'pointer-down',
        pointer: { x: 0.5, y: 0.5 },
      }),
      'session-disposed',
    );
    expectFailure(
      await fabric.captureSnapshot('fx-w058-negative-disposed', CLOCK.snapshotCaptured),
      'session-disposed',
    );
    // A second dispose is a typed refusal too (terminal means terminal).
    expectFailure(
      await fabric.disposeSession('fx-w058-negative-disposed', CLOCK.switchCompleted + 1),
      'session-disposed',
    );
    // The adapter's own state refuses as well: the runtime state survives
    // only as disposal evidence; nothing presentational remains.
    expect(three.presentationOf('fx-w058-negative-disposed')).toBeUndefined();
    expect(three.runtimeStateOf('fx-w058-negative-disposed')).toBeUndefined();
    const report = three.disposalReportOf('fx-w058-negative-disposed')!;
    expect(report.disposedEvents).toBe(report.totalTracked);
    expect(report.totalTracked).toBeGreaterThan(0);
  });

  it('refuses frame image capture without an injected GL surface (no fabricated evidence)', async () => {
    const three = new ThreeJsRendererAdapter();
    const fabric = buildThreeFabric(three);
    await mountThreeSession(fabric, 'fx-w058-negative-capture');
    const session = three.adapterSessionOf('fx-w058-negative-capture')!;
    // The declared frame-capture capability is REFUSED headless: no GL
    // surface is attached, and the adapter never fabricates pixel
    // evidence (the browser path — W061 — injects the surface).
    const refused = three.captureFrameImage(session, {
      frameIndex: 1,
      atMs: CLOCK.firstFrame,
      width: 64,
      height: 64,
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.error.code).toBe('session-failed');
    expect(refused.error.message).toBe(HEADLESS_CAPTURE_REFUSAL);
  });

  it('aborts a switch whose target cannot mount — and RETAINS the three.js session', async () => {
    const three = new ThreeJsRendererAdapter();
    const fabric = buildThreeFabric(three);
    // A reference adapter constructed to fail mounts (the typed target
    // failure): registered as a DISTINCT renderer kind.
    const failing = new ReferenceRendererAdapter({
      identity: {
        capabilityId: 'epoch.renderer.w058-failmount',
        rendererId: 'rr-w058-failmount',
        displayName: 'W058 failure-path target (reference)',
        description: 'Contract-only reference renderer constructed to fail mounts.',
      },
      descriptor: { ...DESCRIPTOR_A, rendererId: 'rr-w058-failmount' },
      capabilities: {
        capabilityVersion: 1,
        rendererId: 'rr-w058-failmount',
        hitTesting: true,
        measurement: false,
        annotation: false,
        frameCapture: false,
        sessionSwitching: true,
        snapshotCapture: true,
        degradation: ['none'],
        portableViewState: ['focused-entities'],
        assetKinds: [],
      },
      failMounts: true,
    });
    registerRenderer(fabric, failing);
    await mountThreeSession(fabric, 'fx-w058-negative-abort');

    const outcome = await fabric.switchRenderer(
      {
        schema: 'epoch.renderer-switch-request',
        fabricProtocolVersion: '1.0.0',
        switchId: 'sw-w058-negative-1',
        sourceFabricSessionId: 'fx-w058-negative-abort',
        targetRendererId: 'rr-w058-failmount',
        expectedWorldDigest: SCENE.digest,
        expectedTenantId: TENANT,
        targetFabricSessionId: 'fx-w058-negative-abort-target',
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
    const failure = expectFailure(outcome, 'switch-aborted');
    expect(failure.retainedFabricSessionId).toBe('fx-w058-negative-abort');
    // The source three.js session is RETAINED: still active, still
    // presenting, still interactive (an aborted switch never loses it).
    const retained = fabric.session('fx-w058-negative-abort');
    expect(retained.ok).toBe(true);
    if (retained.ok) {
      expect(retained.value.state).toBe('active');
      expect(retained.value.mountedWorldDigest).toBe(SCENE.digest);
    }
    expect(three.presentationOf('fx-w058-negative-abort')).toBeDefined();
    const stillInteractive = await fabric.submitInput('fx-w058-negative-abort', {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: 'rin-w058-negative-abort-1',
      fabricSessionId: 'fx-w058-negative-abort',
      atMs: CLOCK.firstInput,
      modality: 'pointer',
      inputKind: 'wheel',
      delta: { x: 0, y: -120 },
    });
    expect(stillInteractive.ok).toBe(true);
  });

  it('rejects foreign session handles at the adapter boundary (hardening)', async () => {
    const three = new ThreeJsRendererAdapter();
    const foreign = { handle: { fabricSessionId: 'fx-not-hosted-here' } };
    await expect(three.dispose(foreign)).rejects.toThrow('foreign session handle');
    await expect(three.health(foreign, CLOCK.firstInput)).rejects.toThrow('foreign session handle');
    // An adapter session of a DIFFERENT adapter instance is equally
    // foreign (session handles never cross adapter instances).
    const other = new ThreeJsRendererAdapter();
    const binding = bindRendererSession({
      rendererSessionId: 'rs-w058-other-1',
      renderer: other.descriptor(),
      device: DEVICE,
      boundAtMs: CLOCK.sessionCreated,
    });
    expect(binding.ok).toBe(true);
    if (!binding.ok) return;
    const created = await other.createSession({
      fabricSessionId: 'fx-w058-other-adapter',
      binding: binding.value,
      worldProjection: WORLD_PROJECTION,
      viewState: fixtureViewState(),
      createdAtMs: CLOCK.sessionCreated,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    await expect(three.dispose(created.value)).rejects.toThrow('foreign session handle');
  });
});
