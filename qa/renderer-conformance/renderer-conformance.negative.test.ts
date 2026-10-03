/**
 * THE W056 RENDERER CONFORMANCE BATTERY — NEGATIVE: typed failures,
 * degradation, and fallback over the same shared fixture.
 *
 * The RendererFailure taxonomy is behavioral, not decorative: every
 * documented failure mode is produced by a REAL interaction with the
 * fabric, and every failure is TYPED (a discriminated code + precise
 * fields) — never a bare throw, never a silent drop. The two safety
 * invariants exercised hardest here:
 *
 * - an ABORTED switch never loses the previous session (retained, still
 *   presenting, still interactive);
 * - a fallback switch is RECORDED (fallbackApplied + the typed trigger),
 *   and the digest/tenant continuity holds regardless of which renderer
 *   completed the switch.
 */
import { describe, expect, it } from 'vitest';
import {
  ReferenceRendererAdapter,
  rendererCapabilityManifestOf,
} from '../../packages/renderer-fabric/src/index';
import { sealCapabilityManifest } from '../../packages/capability-registry/src/index';
import {
  sealRendererAssetBinding,
  type RendererFailure,
} from '../../packages/renderer-runtime/src/index';
import {
  CAPABILITIES_A,
  CLOCK,
  DESCRIPTOR_A,
  DEVICE,
  ONTOLOGY,
  RENDERER_A_ID,
  RENDERER_B_ID,
  SCENE,
  TENANT,
  TENANT_OTHER,
  VARIANT_SCENE,
  WORLD_PROJECTION,
  buildFabric,
  mountFullSession,
  registerRenderer,
  sessionStateOf,
} from './fixture';

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

describe('W056 renderer conformance — typed failures, degradation, fallback (negative)', () => {
  it('rejects a cross-tenant device/world pairing at session creation', async () => {
    const { fabric } = buildFabric();
    const denied = await fabric.createSession({
      rendererId: RENDERER_A_ID,
      device: { ...DEVICE, tenantScope: { tenantId: TENANT_OTHER } },
      worldProjection: WORLD_PROJECTION,
      fabricSessionId: 'fx-negative-1',
      atMs: CLOCK.sessionCreated,
      expectedTenantId: TENANT,
    });
    const failure = expectFailure(denied, 'cross-tenant-denied');
    expect(failure.expectedTenantId).toBe(TENANT);
    expect(failure.encounteredTenantId).toBe(TENANT_OTHER);
  });

  it('resolves unknown renderers as typed adapter-unavailable failures', async () => {
    const { fabric } = buildFabric();
    const resolved = fabric.resolveRenderer('rr-does-not-exist');
    expectFailure(resolved, 'adapter-unavailable');

    const created = await fabric.createSession({
      rendererId: 'rr-does-not-exist',
      device: DEVICE,
      worldProjection: WORLD_PROJECTION,
      fabricSessionId: 'fx-negative-1',
      atMs: CLOCK.sessionCreated,
    });
    expectFailure(created, 'adapter-unavailable');
  });

  it('refuses mounting a different world revision (digest continuity is enforced at mount)', async () => {
    const { fabric } = buildFabric();
    await mountFullSession(fabric);
    expect(VARIANT_SCENE.digest).not.toBe(SCENE.digest);

    const mounted = await fabric.mountScene('fx-conformance-1', {
      scene: VARIANT_SCENE,
      ontology: ONTOLOGY,
      atMs: CLOCK.sceneMounted + 1,
      expectedTenantId: TENANT,
    });
    const failure = expectFailure(mounted, 'switch-incompatible');
    expect(failure.field).toBe('world-digest');
    expect(failure.expected).toBe(SCENE.digest);
    expect(failure.encountered).toBe(VARIANT_SCENE.digest);
    // The session is untouched: still presenting the canonical revision.
    expect(sessionStateOf(fabric, 'fx-conformance-1')).toBe('active');
  });

  it('rejects malformed input envelopes and unserviced modalities with typed refusals', async () => {
    const { fabric } = buildFabric();
    await mountFullSession(fabric);

    // Malformed envelope (unknown input kind) — schema-typed refusal.
    const malformed = await fabric.submitInput('fx-conformance-1', {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: 'rin-negative-bad-1',
      fabricSessionId: 'fx-conformance-1',
      atMs: CLOCK.firstInput,
      modality: 'pointer',
      inputKind: 'telepathy',
    });
    expectFailure(malformed, 'input-unsupported');

    // Input on a foreign fabric session — typed unknown-session.
    const foreign = await fabric.submitInput('fx-conformance-1', {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: 'rin-negative-foreign-1',
      fabricSessionId: 'fx-conformance-999',
      atMs: CLOCK.firstInput,
      modality: 'pointer',
      inputKind: 'pointer-down',
      pointer: { x: 0.25, y: 0.5 },
    });
    expectFailure(foreign, 'unknown-session');

    // Keyboard input on the pointer-only reduced renderer — the binding's
    // modality gate refuses before the adapter is ever consulted.
    const created = await fabric.createSession({
      rendererId: RENDERER_B_ID,
      device: DEVICE,
      worldProjection: WORLD_PROJECTION,
      fabricSessionId: 'fx-negative-reduced-1',
      atMs: CLOCK.sessionCreated,
      expectedTenantId: TENANT,
    });
    expect(created.ok).toBe(true);
    const reducedMounted = await fabric.mountScene('fx-negative-reduced-1', {
      scene: SCENE,
      ontology: ONTOLOGY,
      atMs: CLOCK.sceneMounted,
      expectedTenantId: TENANT,
    });
    expect(reducedMounted.ok).toBe(true);
    const keyRefused = await fabric.submitInput('fx-negative-reduced-1', {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: 'rin-negative-key-1',
      fabricSessionId: 'fx-negative-reduced-1',
      atMs: CLOCK.firstInput,
      modality: 'keyboard',
      inputKind: 'key-down',
      key: { key: 'escape', modifiers: [] },
    });
    expectFailure(keyRefused, 'input-unsupported');
  });

  it('refuses undeclared capabilities with typed refusals (measurement on the reduced renderer)', async () => {
    const { fabric } = buildFabric();
    // The reduced renderer does not declare measurement: a measure hint
    // is refused (typed) — renderer-specific differences are typed
    // refusals, never silent divergence.
    const created = await fabric.createSession({
      rendererId: RENDERER_B_ID,
      device: DEVICE,
      worldProjection: WORLD_PROJECTION,
      fabricSessionId: 'fx-negative-capability-1',
      atMs: CLOCK.sessionCreated,
      expectedTenantId: TENANT,
    });
    expect(created.ok).toBe(true);
    const mounted = await fabric.mountScene('fx-negative-capability-1', {
      scene: SCENE,
      ontology: ONTOLOGY,
      atMs: CLOCK.sceneMounted,
      expectedTenantId: TENANT,
    });
    expect(mounted.ok).toBe(true);
    const refused = await fabric.submitInput('fx-negative-capability-1', {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: 'rin-negative-measure-1',
      fabricSessionId: 'fx-negative-capability-1',
      atMs: CLOCK.firstInput,
      modality: 'pointer',
      inputKind: 'pointer-down',
      pointer: { x: 0.25, y: 0.5 },
      intentHint: { intent: { id: 'epoch.world.interaction.measure', version: '1.0.0' } },
    });
    expectFailure(refused, 'input-unsupported');

    // The FULL renderer declares measurement: the same hint normalizes
    // to the canonical measure intent (equivalent SUPPORTED outcomes; the
    // capability difference is the typed refusal above, nothing else).
    await mountFullSession(fabric);
    const measured = await fabric.submitInput('fx-conformance-1', {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: 'rin-negative-measure-2',
      fabricSessionId: 'fx-conformance-1',
      atMs: CLOCK.firstInput,
      modality: 'pointer',
      inputKind: 'pointer-down',
      pointer: { x: 0.25, y: 0.5 },
      intentHint: { intent: { id: 'epoch.world.interaction.measure', version: '1.0.0' } },
    });
    expect(measured.ok).toBe(true);
    if (measured.ok) {
      expect(measured.value.intent).toEqual({
        id: 'epoch.world.interaction.measure',
        version: '1.1.0',
      });
    }
  });

  it('rejects an unsupported intent hint with a typed refusal', async () => {
    const { fabric } = buildFabric();
    await mountFullSession(fabric);
    const refused = await fabric.submitInput('fx-conformance-1', {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: 'rin-negative-hint-1',
      fabricSessionId: 'fx-conformance-1',
      atMs: CLOCK.firstInput,
      modality: 'pointer',
      inputKind: 'pointer-down',
      pointer: { x: 0.25, y: 0.5 },
      intentHint: { intent: { id: 'epoch.world.interaction.time-travel', version: '1.0.0' } },
    });
    expectFailure(refused, 'input-unsupported');
  });

  it('rejects a switch whose digest continuity claim is false', async () => {
    const { fabric } = buildFabric();
    await mountFullSession(fabric);
    const denied = await fabric.switchRenderer(
      {
        schema: 'epoch.renderer-switch-request',
        fabricProtocolVersion: '1.0.0',
        switchId: 'sw-negative-1',
        sourceFabricSessionId: 'fx-conformance-1',
        targetRendererId: RENDERER_B_ID,
        expectedWorldDigest: VARIANT_SCENE.digest,
        expectedTenantId: TENANT,
        targetFabricSessionId: 'fx-negative-target-1',
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
    const failure = expectFailure(denied, 'switch-incompatible');
    expect(failure.field).toBe('world-digest');
    // The previous session is retained, still presenting.
    expect(sessionStateOf(fabric, 'fx-conformance-1')).toBe('active');
  });

  it('completes a switch through the ordered fallback chain when the primary target cannot present', async () => {
    const { fabric } = buildFabric();
    // A third renderer kind that cannot present on desktop devices
    // (probe-rejected) — the primary target of the switch.
    const headsetOnly = new ReferenceRendererAdapter({
      identity: {
        capabilityId: 'epoch.renderer.conformance-headset-only',
        rendererId: 'rr-conformance-headset-only',
        displayName: 'Conformance Headset-Only Renderer (reference)',
      },
      descriptor: { ...DESCRIPTOR_A, rendererId: 'rr-conformance-headset-only' },
      capabilities: { ...CAPABILITIES_A, rendererId: 'rr-conformance-headset-only' },
      incompatibleDeviceClasses: ['desktop'],
    });
    registerRenderer(fabric, headsetOnly);
    await mountFullSession(fabric);

    const outcome = await fabric.switchRenderer(
      {
        schema: 'epoch.renderer-switch-request',
        fabricProtocolVersion: '1.0.0',
        switchId: 'sw-negative-fallback-1',
        sourceFabricSessionId: 'fx-conformance-1',
        targetRendererId: 'rr-conformance-headset-only',
        expectedWorldDigest: SCENE.digest,
        expectedTenantId: TENANT,
        targetFabricSessionId: 'fx-negative-fallback-1',
        fallbackRendererIds: [RENDERER_B_ID],
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
    // The FALLBACK completed the switch — recorded, never silent.
    expect(outcome.value.receipt.fallbackApplied).toBe(true);
    expect(outcome.value.receipt.toRendererId).toBe(RENDERER_B_ID);
    const fallback = outcome.value.fallback;
    expect(fallback).toBeDefined();
    if (fallback !== undefined && fallback.code === 'fallback-applied') {
      expect(fallback.fromRendererId).toBe('rr-conformance-headset-only');
      expect(fallback.toRendererId).toBe(RENDERER_B_ID);
      expect(fallback.trigger.code).toBe('probe-rejected');
    }
    // Continuity holds regardless of which renderer completed the switch.
    expect(outcome.value.receipt.worldDigest).toBe(SCENE.digest);
    expect(outcome.value.receipt.tenantScope.tenantId).toBe(TENANT);
    expect(outcome.value.session.mountedWorldDigest).toBe(SCENE.digest);
    expect(sessionStateOf(fabric, 'fx-conformance-1')).toBe('disposed');
    expect(sessionStateOf(fabric, 'fx-negative-fallback-1')).toBe('active');
  });

  it('aborts a switch whose target cannot mount — and RETAINS the previous session', async () => {
    const { fabric } = buildFabric();
    // A fourth renderer kind whose mounts always fail (failure-path
    // testing): it probes fine but cannot mount the canonical projection.
    const failsMounts = new ReferenceRendererAdapter({
      identity: {
        capabilityId: 'epoch.renderer.conformance-fails-mounts',
        rendererId: 'rr-conformance-fails-mounts',
        displayName: 'Conformance Failing Renderer (reference)',
      },
      descriptor: { ...DESCRIPTOR_A, rendererId: 'rr-conformance-fails-mounts' },
      capabilities: { ...CAPABILITIES_A, rendererId: 'rr-conformance-fails-mounts' },
      failMounts: true,
    });
    registerRenderer(fabric, failsMounts);
    await mountFullSession(fabric);

    const aborted = await fabric.switchRenderer(
      {
        schema: 'epoch.renderer-switch-request',
        fabricProtocolVersion: '1.0.0',
        switchId: 'sw-negative-abort-1',
        sourceFabricSessionId: 'fx-conformance-1',
        targetRendererId: 'rr-conformance-fails-mounts',
        expectedWorldDigest: SCENE.digest,
        expectedTenantId: TENANT,
        targetFabricSessionId: 'fx-negative-abort-1',
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
    expect(failure.retainedFabricSessionId).toBe('fx-conformance-1');
    expect(failure.trigger.code).toBe('mount-failed');

    // The previous session is RETAINED and still fully usable: frames
    // keep presenting and inputs keep normalizing.
    expect(sessionStateOf(fabric, 'fx-conformance-1')).toBe('active');
    const frame = await fabric.applyFrame('fx-conformance-1', { atMs: CLOCK.firstFrame });
    expect(frame.ok).toBe(true);
    const input = await fabric.submitInput(
      'fx-conformance-1',
      {
        schema: 'epoch.renderer-input-envelope',
        fabricProtocolVersion: '1.0.0',
        inputId: 'rin-negative-after-abort-1',
        fabricSessionId: 'fx-conformance-1',
        atMs: CLOCK.firstInput,
        modality: 'pointer',
        inputKind: 'pointer-down',
        pointer: { x: 0.25, y: 0.5 },
      },
    );
    expect(input.ok).toBe(true);
    if (input.ok) {
      expect(input.value.outcome).toBe('normalized');
    }
    // The half-created target session was disposed (never orphaned).
    expect(fabric.session('fx-negative-abort-1').ok).toBe(true);
    expect(sessionStateOf(fabric, 'fx-negative-abort-1')).toBe('disposed');
  });

  it('types degradation: undeclared fidelity reductions are refused; declared ones degrade visibly', async () => {
    const { fabric } = buildFabric();
    await mountFullSession(fabric);

    // The FULL renderer declares reduced-fidelity but the REDUCED renderer
    // declares only static-frame — an undeclared reduction is a typed
    // refusal (never a silent fidelity drop).
    const wireframe = await fabric.applyFrame('fx-conformance-1', {
      atMs: CLOCK.firstFrame,
      degradation: 'wireframe',
    });
    expect(wireframe.ok).toBe(true); // FULL declares wireframe
    if (wireframe.ok) {
      expect(wireframe.value.degradation).toBe('wireframe');
      expect(wireframe.value.session.state).toBe('degraded');
    }

    // Declared degradation is visible in health (typed, never silent)...
    const degradedHealth = await fabric.healthOf('fx-conformance-1', CLOCK.firstFrame);
    expect(degradedHealth.ok).toBe(true);
    if (degradedHealth.ok) {
      expect(degradedHealth.value.state).toBe('degraded');
      expect(degradedHealth.value.degradation).toBe('wireframe');
    }

    // ...and recovery returns the session to active.
    const recovered = await fabric.applyFrame('fx-conformance-1', { atMs: CLOCK.firstFrame + 1 });
    expect(recovered.ok).toBe(true);
    if (recovered.ok) {
      expect(recovered.value.session.state).toBe('active');
    }

    // The REDUCED renderer refuses the undeclared wireframe reduction.
    const created = await fabric.createSession({
      rendererId: RENDERER_B_ID,
      device: DEVICE,
      worldProjection: WORLD_PROJECTION,
      fabricSessionId: 'fx-negative-degrade-1',
      atMs: CLOCK.sessionCreated,
      expectedTenantId: TENANT,
    });
    expect(created.ok).toBe(true);
    const mounted = await fabric.mountScene('fx-negative-degrade-1', {
      scene: SCENE,
      ontology: ONTOLOGY,
      atMs: CLOCK.sceneMounted,
      expectedTenantId: TENANT,
    });
    expect(mounted.ok).toBe(true);
    const refused = await fabric.applyFrame('fx-negative-degrade-1', {
      atMs: CLOCK.firstFrame,
      degradation: 'wireframe',
    });
    const failure = expectFailure(refused, 'degraded');
    expect(failure.degradation).toBe('wireframe');
    expect(failure.reason).toBe('undeclared degradation');
    // The declared static-frame reduction works on the reduced renderer.
    const staticFrame = await fabric.applyFrame('fx-negative-degrade-1', {
      atMs: CLOCK.firstFrame + 1,
      degradation: 'static-frame',
    });
    expect(staticFrame.ok).toBe(true);
    if (staticFrame.ok) {
      expect(staticFrame.value.session.state).toBe('degraded');
      expect(staticFrame.value.degradation).toBe('static-frame');
    }
  });

  it('makes dispose terminal: disposed sessions refuse every invocation', async () => {
    const { fabric } = buildFabric();
    await mountFullSession(fabric);
    const disposed = await fabric.disposeSession('fx-conformance-1', CLOCK.switchCompleted);
    expect(disposed.ok).toBe(true);
    if (disposed.ok) {
      expect(disposed.value.state).toBe('disposed');
      expect(disposed.value.mountedWorldDigest).toBeUndefined();
    }
    const frame = await fabric.applyFrame('fx-conformance-1', { atMs: CLOCK.firstFrame });
    expectFailure(frame, 'session-disposed');
    const input = await fabric.submitInput('fx-conformance-1', {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: 'rin-negative-disposed-1',
      fabricSessionId: 'fx-conformance-1',
      atMs: CLOCK.firstInput,
      modality: 'pointer',
      inputKind: 'pointer-down',
      pointer: { x: 0.25, y: 0.5 },
    });
    expectFailure(input, 'session-disposed');
    // Unknown session ids stay unknown (never conflated with disposed).
    const unknown = await fabric.applyFrame('fx-never-existed', { atMs: CLOCK.firstFrame });
    expectFailure(unknown, 'unknown-session');
  });

  it('enforces the asset-binding trust discipline at the adapter seam', async () => {
    const { fabric, full, reduced } = buildFabric();
    await mountFullSession(fabric);
    const session = full.adapterSessionOf('fx-conformance-1');
    expect(session).toBeDefined();

    // Untrusted assets NEVER mount (the security invariant) — typed
    // asset-rejected, reason untrusted.
    const untrusted = sealRendererAssetBinding({
      schema: 'epoch.renderer-asset-binding',
      fabricProtocolVersion: '1.0.0',
      bindingId: 'rab-negative-untrusted-1',
      fabricSessionId: 'fx-conformance-1',
      tenantScope: { tenantId: TENANT },
      assetDigest: 'a'.repeat(64),
      assetKind: 'mesh',
      byteSize: 4_096,
      trustState: 'untrusted',
      boundAtMs: CLOCK.firstInput,
    });
    const refused = await full.bindAsset!(session!, untrusted);
    const failure = expectFailure(refused, 'asset-rejected');
    expect(failure.reason).toBe('untrusted');

    // Declared + validated asset kinds bind.
    const validated = sealRendererAssetBinding({
      schema: 'epoch.renderer-asset-binding',
      fabricProtocolVersion: '1.0.0',
      bindingId: 'rab-negative-mesh-1',
      fabricSessionId: 'fx-conformance-1',
      tenantScope: { tenantId: TENANT },
      assetDigest: 'b'.repeat(64),
      assetKind: 'mesh',
      byteSize: 4_096,
      trustState: 'validated',
      validatedAtMs: CLOCK.firstInput,
      boundAtMs: CLOCK.firstInput,
    });
    const bound = await full.bindAsset!(session!, validated);
    expect(bound.ok).toBe(true);

    // The REDUCED renderer declares no asset kinds — typed refusal.
    const created = await fabric.createSession({
      rendererId: RENDERER_B_ID,
      device: DEVICE,
      worldProjection: WORLD_PROJECTION,
      fabricSessionId: 'fx-negative-asset-1',
      atMs: CLOCK.sessionCreated,
      expectedTenantId: TENANT,
    });
    expect(created.ok).toBe(true);
    const reducedSession = reduced.adapterSessionOf('fx-negative-asset-1');
    expect(reducedSession).toBeDefined();
    const reducedRefused = await reduced.bindAsset!(reducedSession!, validated);
    const reducedFailure = expectFailure(reducedRefused, 'asset-rejected');
    expect(reducedFailure.reason).toBe('undeclared asset kind');
  });

  it('keeps registration honest: category and identity consistency are enforced', () => {
    const { fabric, full } = buildFabric();
    // A manifest whose category is not "visualization".
    const wrongCategory = rendererCapabilityManifestOf({
      capabilityId: 'epoch.renderer.conformance-full',
      version: '2.0.0',
      descriptor: DESCRIPTOR_A,
      capabilities: CAPABILITIES_A,
      displayName: 'Wrong category',
    });
    const sealed = sealCapabilityManifest({ ...wrongCategory, category: 'simulation' });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const registered = fabric.adapters.register({
      manifest: sealed.value.manifest,
      digest: sealed.value.digest,
      adapter: full,
    });
    expectFailure(registered, 'invalid-fabric-record');

    // An adapter whose identity disagrees with its manifest.
    const mismatch = rendererCapabilityManifestOf({
      capabilityId: 'epoch.renderer.conformance-mismatch',
      version: '1.0.0',
      descriptor: DESCRIPTOR_A,
      capabilities: CAPABILITIES_A,
      displayName: 'Identity mismatch',
    });
    const mismatchSealed = sealCapabilityManifest(mismatch);
    expect(mismatchSealed.ok).toBe(true);
    if (!mismatchSealed.ok) return;
    const mismatched = fabric.adapters.register({
      manifest: mismatchSealed.value.manifest,
      digest: mismatchSealed.value.digest,
      adapter: full,
    });
    expectFailure(mismatched, 'invalid-fabric-record');
    // Neither failed registration changed the selector listing.
    expect(fabric.adapters.listRenderers().map((e) => e.descriptor.rendererId)).toEqual([
      RENDERER_A_ID,
      RENDERER_B_ID,
    ]);
  });
});
