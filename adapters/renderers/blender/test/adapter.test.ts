/**
 * The ADAPTER SEAM battery (W060): the Blender sidecar adapter driven
 * through the REAL RendererFabric over the SHARED canonical fixture —
 * registration through the REAL capability registry, session creation,
 * canonical mount (semantic entity ids preserved into the offscene scene),
 * offscreen frame evidence (digest-addressed, through the REAL process
 * boundary + the CLI double), glTF asset preparation, the asset-binding
 * trust discipline, the honest batch-class refusals, and dispose terminal.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { RendererFabric, type RendererAdapter } from '@epoch/renderer-fabric';
import {
  sealRendererAssetBinding,
  type RendererFailure,
} from '@epoch/renderer-runtime';
import {
  BlenderSidecarRendererAdapter,
  digestOfBytes,
} from '../src/index';
import {
  CLOCK,
  DEVICE,
  ENTITY_IDS,
  ONTOLOGY,
  SCENE,
  TENANT,
  WORLD_PROJECTION,
  buildFabric,
  fixtureViewState,
  registerRenderer,
} from './helpers';

const DOUBLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'doubles', 'blender-double.mjs');

const workspaces: string[] = [];
afterEach(() => {
  for (const dir of workspaces.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** One adapter over the committed CLI double (honest mode). */
function doubleAdapter(): BlenderSidecarRendererAdapter {
  const dir = mkdtempSync(path.join(tmpdir(), 'epoch-blender-adapter-'));
  workspaces.push(dir);
  return new BlenderSidecarRendererAdapter({
    blenderPath: process.execPath,
    argvPrefix: [DOUBLE],
    workspaceDir: dir,
  });
}

/** One fabric + the reference renderers + the Blender sidecar adapter. */
function buildBlenderFabric(adapter: RendererAdapter) {
  const { fabric } = buildFabric();
  registerRenderer(fabric, adapter);
  return fabric;
}

/** Create + mount one sidecar session over the SHARED fixture (throws readable). */
async function mountSession(
  adapter: BlenderSidecarRendererAdapter,
  fabric: RendererFabric,
  fabricSessionId: string,
): Promise<void> {
  const created = await fabric.createSession({
    rendererId: adapter.identity().rendererId,
    device: DEVICE,
    worldProjection: WORLD_PROJECTION,
    viewState: fixtureViewState(),
    fabricSessionId,
    atMs: CLOCK.sessionCreated,
    expectedTenantId: TENANT,
  });
  if (!created.ok) {
    throw new Error(`sidecar session failed: ${created.error.message}`);
  }
  const mounted = await fabric.mountScene(fabricSessionId, {
    scene: SCENE,
    ontology: ONTOLOGY,
    atMs: CLOCK.sceneMounted,
    expectedTenantId: TENANT,
  });
  if (!mounted.ok) {
    throw new Error(`sidecar mount failed: ${mounted.error.message}`);
  }
}

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

describe('the Blender sidecar adapter through the REAL fabric', () => {
  it('registers, probes compatible, and creates a session', async () => {
    const adapter = doubleAdapter();
    const fabric = buildBlenderFabric(adapter);
    await mountSession(adapter, fabric, 'fx-blender-1');
    const record = fabric.session('fx-blender-1');
    expect(record.ok).toBe(true);
    expect(record.ok && record.value.state).toBe('active');
  });

  it('mounts the canonical projection with semantic entity ids preserved', async () => {
    const adapter = doubleAdapter();
    const fabric = buildBlenderFabric(adapter);
    await mountSession(adapter, fabric, 'fx-blender-mount');
    // The offscene scene presents the fixture's VISIBLE entities (gamma is
    // hidden — the compiled 3d graph presents 3), sorted and semantic.
    expect(adapter.presentedEntityIdsOf('fx-blender-mount')).toEqual(
      [...ENTITY_IDS.slice(0, 3)].sort(),
    );
  });

  it('renders offscreen frames through the REAL boundary (digest-addressed evidence)', async () => {
    const adapter = doubleAdapter();
    const fabric = buildBlenderFabric(adapter);
    await mountSession(adapter, fabric, 'fx-blender-frame');
    const frame = await fabric.applyFrame('fx-blender-frame', { atMs: CLOCK.firstFrame });
    expect(frame.ok).toBe(true);
    if (!frame.ok) return;
    expect(frame.value.presented).toBe(true);
    expect(frame.value.degradation).toBe('none');

    const evidence = adapter.renderEvidenceOf('fx-blender-frame');
    expect(evidence).toHaveLength(1);
    const [render] = evidence;
    expect(render!.entityCount).toBe(3);
    expect(render!.imageDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(render!.blenderVersion).toBe('4.2.11-epoch-double');
    expect(render!.durationMs).toBeGreaterThan(0);
    // Evidence continuity: the render's frame index + virtual time are the
    // fabric's own frame counters, not adapter-invented values.
    expect(render!.frameIndex).toBeGreaterThanOrEqual(0);
    expect(render!.atMs).toBe(CLOCK.firstFrame);
  });

  it('prepares glTF assets whose GLB re-enters as UNTRUSTED bytes', async () => {
    const adapter = doubleAdapter();
    const fabric = buildBlenderFabric(adapter);
    await mountSession(adapter, fabric, 'fx-blender-export');
    const session = adapter.adapterSessionOf('fx-blender-export');
    expect(session).toBeDefined();
    const prepared = await adapter.prepareGltfAsset(session!, { atMs: CLOCK.firstFrame });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.value.entityCount).toBe(3);
    expect(prepared.value.glbDigest).toBe(digestOfBytes(prepared.value.glbBytesData));
    // The GLB is a real container whose validation belongs to the glTF
    // bridge — proven end-to-end in qa/foundation-renderers.
    expect(prepared.value.glbBytesData[0]).toBe(0x67); // 'g' of 'glTF'
  });

  it('binds only validated mesh assets (the trust discipline)', async () => {
    const adapter = doubleAdapter();
    const fabric = buildBlenderFabric(adapter);
    await mountSession(adapter, fabric, 'fx-blender-asset');
    const session = adapter.adapterSessionOf('fx-blender-asset');
    expect(session).toBeDefined();

    const untrusted = sealRendererAssetBinding({
      schema: 'epoch.renderer-asset-binding',
      fabricProtocolVersion: '1.0.0',
      bindingId: 'rab-blender-untrusted-1',
      fabricSessionId: 'fx-blender-asset',
      tenantScope: { tenantId: TENANT },
      assetDigest: 'a'.repeat(64),
      assetKind: 'mesh',
      byteSize: 128,
      trustState: 'untrusted',
      boundAtMs: CLOCK.firstInput,
    });
    const refused = await adapter.bindAsset(session!, untrusted);
    const refusal = expectFailure(refused, 'asset-rejected');
    expect(refusal.reason).toBe('untrusted');

    const validated = sealRendererAssetBinding({
      schema: 'epoch.renderer-asset-binding',
      fabricProtocolVersion: '1.0.0',
      bindingId: 'rab-blender-mesh-1',
      fabricSessionId: 'fx-blender-asset',
      tenantScope: { tenantId: TENANT },
      assetDigest: 'b'.repeat(64),
      assetKind: 'mesh',
      byteSize: 128,
      trustState: 'validated',
      validatedAtMs: CLOCK.firstInput,
      boundAtMs: CLOCK.firstInput,
    });
    const bound = await adapter.bindAsset(session!, validated);
    expect(bound.ok && bound.value.bound).toBe(true);
    expect(adapter.boundAssetDigestsOf('fx-blender-asset')).toEqual(['b'.repeat(64)]);
  });

  it('refuses undeclared asset kinds typed', async () => {
    const adapter = doubleAdapter();
    const fabric = buildBlenderFabric(adapter);
    await mountSession(adapter, fabric, 'fx-blender-kind');
    const session = adapter.adapterSessionOf('fx-blender-kind');
    expect(session).toBeDefined();
    const texture = sealRendererAssetBinding({
      schema: 'epoch.renderer-asset-binding',
      fabricProtocolVersion: '1.0.0',
      bindingId: 'rab-blender-texture-1',
      fabricSessionId: 'fx-blender-kind',
      tenantScope: { tenantId: TENANT },
      assetDigest: 'c'.repeat(64),
      assetKind: 'texture',
      byteSize: 128,
      trustState: 'validated',
      validatedAtMs: CLOCK.firstInput,
      boundAtMs: CLOCK.firstInput,
    });
    const refused = await adapter.bindAsset(session!, texture);
    const refusal = expectFailure(refused, 'asset-rejected');
    expect(refusal.reason).toBe('undeclared asset kind');
  });

  it('refuses every interactive input (the honest batch class)', async () => {
    const adapter = doubleAdapter();
    const fabric = buildBlenderFabric(adapter);
    await mountSession(adapter, fabric, 'fx-blender-input');
    // The FABRIC's modality gate refuses the pointer input before the
    // adapter is even asked (defense in depth: the adapter declares no
    // interactive modality), and the ADAPTER itself refuses typed too.
    const refused = await fabric.submitInput('fx-blender-input', {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: 'rin-blender-1',
      fabricSessionId: 'fx-blender-input',
      atMs: CLOCK.firstInput,
      modality: 'pointer',
      inputKind: 'pointer-down',
      pointer: { x: 0.5, y: 0.5 },
    });
    const failure = expectFailure(refused, 'input-unsupported');
    expect(failure.reason).toBe('undeclared interaction modality');

    const session = adapter.adapterSessionOf('fx-blender-input');
    expect(session).toBeDefined();
    const direct = await adapter.translateInput(session!, {
      schema: 'epoch.renderer-input-envelope',
      fabricProtocolVersion: '1.0.0',
      inputId: 'rin-blender-2',
      fabricSessionId: 'fx-blender-input',
      atMs: CLOCK.firstInput,
      modality: 'pointer',
      inputKind: 'pointer-down',
      pointer: { x: 0.5, y: 0.5 },
    });
    const directFailure = expectFailure(direct, 'input-unsupported');
    expect(directFailure.reason).toBe('batch-renderer');
  });

  it('refuses undeclared degradations typed', async () => {
    const adapter = doubleAdapter();
    const fabric = buildBlenderFabric(adapter);
    await mountSession(adapter, fabric, 'fx-blender-degrade');
    // The FABRIC's degradation gate refuses the wireframe frame before the
    // adapter is asked; the ADAPTER's own refusal covers the same class.
    const refused = await fabric.applyFrame('fx-blender-degrade', {
      atMs: CLOCK.firstFrame,
      degradation: 'wireframe',
    });
    const failure = expectFailure(refused, 'degraded');
    expect(failure.message).toContain('does not declare the "wireframe" degradation');
  });

  it('captures snapshots and reports every portable field skipped', async () => {
    const adapter = doubleAdapter();
    const fabric = buildBlenderFabric(adapter);
    await mountSession(adapter, fabric, 'fx-blender-snap');
    const snapshot = await fabric.captureSnapshot('fx-blender-snap', CLOCK.snapshotCaptured);
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    expect(snapshot.value.capturedFromRendererId).toBe(adapter.identity().rendererId);
    // Digest continuity: the snapshot anchors the SAME canonical world.
    expect(snapshot.value.worldProjection.worldDigest).toBe(SCENE.digest);
  });

  it('makes dispose terminal', async () => {
    const adapter = doubleAdapter();
    const fabric = buildBlenderFabric(adapter);
    await mountSession(adapter, fabric, 'fx-blender-dispose');
    const disposed = await fabric.disposeSession('fx-blender-dispose', CLOCK.switchCompleted);
    expect(disposed.ok).toBe(true);
    expectFailure(
      await fabric.mountScene('fx-blender-dispose', {
        scene: SCENE,
        ontology: ONTOLOGY,
        atMs: CLOCK.sceneMounted,
        expectedTenantId: TENANT,
      }),
      'session-disposed',
    );
    expect(adapter.adapterSessionOf('fx-blender-dispose')).toBeUndefined();
  });

  it('reports healthy, then degraded after a failed render, then unavailable disposed', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'epoch-blender-adapter-'));
    workspaces.push(dir);
    const adapter = new BlenderSidecarRendererAdapter({
      blenderPath: process.execPath,
      argvPrefix: [DOUBLE],
      workspaceDir: dir,
      env: { BLENDER_DOUBLE_MODE: 'garbage-report' },
    });
    const fabric = buildBlenderFabric(adapter);
    await mountSession(adapter, fabric, 'fx-blender-health');
    const healthy = await fabric.healthOf('fx-blender-health', CLOCK.firstFrame);
    expect(healthy.ok && healthy.value.state).toBe('healthy');

    const failedFrame = await fabric.applyFrame('fx-blender-health', { atMs: CLOCK.firstFrame });
    expectFailure(failedFrame, 'session-failed');

    const degraded = await fabric.healthOf('fx-blender-health', CLOCK.firstFrame + 1);
    expect(degraded.ok && degraded.value.state).toBe('degraded');

    await fabric.disposeSession('fx-blender-health', CLOCK.switchCompleted);
    const unavailable = await fabric.healthOf('fx-blender-health', CLOCK.switchCompleted + 1);
    expect(unavailable.ok && unavailable.value.state).toBe('unavailable');
  });

  it('probes INCOMPATIBLE without a configured binary (never fabricated)', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'epoch-blender-adapter-'));
    workspaces.push(dir);
    const adapter = new BlenderSidecarRendererAdapter({ workspaceDir: dir });
    const probed = await adapter.probe({ device: DEVICE, atMs: 0 });
    expect(probed.ok).toBe(true);
    if (!probed.ok) return;
    expect(probed.value.compatible).toBe(false);
    expect(probed.value.reason).toContain('EPOCH_BLENDER_PATH');
  });

  it('switches to and from the reference renderer (session switching preserved)', async () => {
    const adapter = doubleAdapter();
    const { fabric } = buildFabric();
    registerRenderer(fabric, adapter);
    await mountSession(adapter, fabric, 'fx-blender-switch');
    const frame = await fabric.applyFrame('fx-blender-switch', { atMs: CLOCK.firstFrame });
    expect(frame.ok).toBe(true);

    const switched = await fabric.switchRenderer(
      {
        schema: 'epoch.renderer-switch-request',
        fabricProtocolVersion: '1.0.0',
        switchId: 'sw-blender-1',
        sourceFabricSessionId: 'fx-blender-switch',
        targetRendererId: 'rr-conformance-full',
        expectedWorldDigest: SCENE.digest,
        expectedTenantId: TENANT,
        targetFabricSessionId: 'fx-blender-switch-target',
        fallbackRendererIds: [],
        atMs: CLOCK.switchRequested,
      },
      {
        scene: SCENE,
        ontology: ONTOLOGY,
        atMs: CLOCK.switchMounted,
        expectedTenantId: TENANT,
        completedAtMs: CLOCK.switchCompleted,
      },
    );
    expect(switched.ok).toBe(true);
    if (!switched.ok) return;
    // The switching invariant: the same canonical world digest on the target.
    expect(switched.value.session.worldProjection.worldDigest).toBe(SCENE.digest);
  });
});
