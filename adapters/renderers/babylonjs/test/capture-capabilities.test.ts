/**
 * W059 capture + capability battery — the honest headless/browser split
 * and the capability/registration consistency checks.
 *
 * Frame capture is DECLARED in the capability set but is a GL-path
 * capability: the headless host cannot rasterize, so headless capture is a
 * TYPED refusal (no fabricated evidence — the real PNG bytes close with
 * the W061 browser battery). The injected-host seam is proven with a
 * clearly-labeled host double.
 *
 * Registration goes through the REAL capability registry: the sealed
 * visualization-category manifest honoring epoch.renderers@1.1.0, with
 * category/identity consistency enforced typed.
 */
import { describe, expect, it } from 'vitest';
import { sealCapabilityManifest } from '@epoch/capability-registry';
import {
  RendererAdapterRegistry,
  rendererCapabilityManifestOf,
} from '@epoch/renderer-fabric';
import { nullEngineHost } from '../src/host';
import {
  BABYLONJS_CAPABILITIES,
  BABYLONJS_CAPABILITY_ID,
  BABYLONJS_RENDERER_ID,
  BabylonRendererAdapter,
  type BabylonEngineHost,
  type BabylonFrameCapture,
} from '../src/index';
import {
  CLOCK,
  SCENE,
  WORLD_PROJECTION,
  unitBinding,
  unitCompilation,
  unitViewState,
} from './helpers';

async function mounted(adapter: BabylonRendererAdapter, fabricSessionId: string) {
  const session = await adapter.createSession({
    fabricSessionId,
    binding: unitBinding(CLOCK.created),
    worldProjection: WORLD_PROJECTION,
    viewState: unitViewState(),
    createdAtMs: CLOCK.created,
  });
  if (!session.ok) throw new Error(`createSession failed: ${session.error.message}`);
  const mounted = await adapter.mountProjection(session.value, {
    scene: SCENE,
    compilation: unitCompilation(),
    admittedReceipts: [],
  });
  if (!mounted.ok) throw new Error(`mountProjection failed: ${mounted.error.message}`);
  return session.value;
}

/** A clearly-labeled GL-host DOUBLE: proves the injected capture seam only
 * — NOT browser evidence (real captures need a WebGL host; W061). */
function glHostDouble(): BabylonEngineHost {
  return {
    name: 'gl-host-double',
    canRender: true,
    createEngine: () => nullEngineHost().createEngine(),
    presentFrame: () => undefined,
    captureFrame: async (): Promise<BabylonFrameCapture> => ({
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      mediaType: 'image/png',
      width: 4,
      height: 4,
    }),
  };
}

describe('W059 Babylon.js adapter — frame capture (the honest split)', () => {
  it('declares frame capture but refuses it TYPED on the headless host (no fabricated evidence)', async () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    expect(adapter.capabilities().frameCapture).toBe(true);
    const session = await mounted(adapter, 'fx-unit-capture-1');
    const capture = await adapter.captureFrame(session, CLOCK.firstFrame);
    expect(capture.ok).toBe(false);
    if (!capture.ok) {
      expect(capture.error.code).toBe('session-failed');
      expect(capture.error.message).toContain('requires a GL capture host');
    }
    await adapter.dispose(session);
  });

  it('captures typed bytes when the injected host provides the GL path (host-double seam proof)', async () => {
    const adapter = new BabylonRendererAdapter({ host: glHostDouble() });
    const session = await mounted(adapter, 'fx-unit-capture-2');
    const capture = await adapter.captureFrame(session, CLOCK.firstFrame);
    expect(capture.ok).toBe(true);
    if (capture.ok) {
      expect(capture.value.mediaType).toBe('image/png');
      expect(capture.value.bytes.length).toBeGreaterThan(0);
    }
    await adapter.dispose(session);
  });

  it('refuses capture typed when the capability is not declared', async () => {
    const adapter = new BabylonRendererAdapter({
      host: glHostDouble(),
      capabilities: { ...BABYLONJS_CAPABILITIES, frameCapture: false },
    });
    const session = await mounted(adapter, 'fx-unit-capture-3');
    const capture = await adapter.captureFrame(session, CLOCK.firstFrame);
    expect(capture.ok).toBe(false);
    if (!capture.ok) expect(capture.error.message).toContain('does not declare frame capture');
    await adapter.dispose(session);
  });
});

describe('W059 Babylon.js adapter — capability declaration + registration', () => {
  it('declares a self-consistent, deterministically ordered capability set', () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const capabilities = adapter.capabilities();
    expect(capabilities.capabilityVersion).toBe(1);
    expect(capabilities.rendererId).toBe(BABYLONJS_RENDERER_ID);
    expect(capabilities.rendererId).toBe(adapter.descriptor().rendererId);
    expect(adapter.identity().capabilityId).toBe(BABYLONJS_CAPABILITY_ID);
    // Sorted, duplicate-free sets (the frozen contract's determinism).
    expect(capabilities.degradation).toEqual([...capabilities.degradation].sort());
    expect(new Set(capabilities.degradation).size).toBe(capabilities.degradation.length);
    expect(capabilities.portableViewState).toEqual([...capabilities.portableViewState].sort());
    expect(capabilities.assetKinds).toEqual([...capabilities.assetKinds].sort());
    // The descriptor hosts every compiled graph kind the battery mounts.
    expect(adapter.descriptor().graphKinds).toContain('3d');
    expect(adapter.descriptor().graphKinds).toContain('animation');
    expect(adapter.descriptor().graphKinds).toContain('timeline-replay');
    // The pinned engine identity (license snapshot in docs/rendering/babylonjs.md).
    expect(adapter.identity().displayName).toContain('Babylon.js');
  });

  it('registers through the REAL capability registry as a visualization-category epoch.renderers@1.1.0 capability', () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const manifest = rendererCapabilityManifestOf({
      capabilityId: adapter.identity().capabilityId,
      version: '1.0.0',
      descriptor: adapter.descriptor(),
      capabilities: adapter.capabilities(),
      displayName: adapter.identity().displayName,
      description: adapter.identity().description,
    });
    const sealed = sealCapabilityManifest(manifest);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const registry = new RendererAdapterRegistry();
    const registered = registry.register({
      manifest: sealed.value.manifest,
      digest: sealed.value.digest,
      adapter,
    });
    expect(registered.ok).toBe(true);
    if (registered.ok) {
      expect(registered.value.manifest.category).toBe('visualization');
      expect(registered.value.manifest.contracts).toContainEqual({
        contractId: 'epoch.renderers',
        contractVersion: '1.1.0',
      });
    }
    // The registry lists it for the Epoch renderer selector.
    const listed = registry.listRenderers();
    expect(listed.map((entry) => entry.descriptor.rendererId)).toContain(BABYLONJS_RENDERER_ID);
    // And resolves it lifecycle-aware.
    const resolved = registry.resolveByRendererId(BABYLONJS_RENDERER_ID);
    expect(resolved.ok).toBe(true);
  });

  it('enforces registration consistency typed (identity mismatch is an invalid-fabric-record)', () => {
    const adapter = new BabylonRendererAdapter({ host: nullEngineHost() });
    const manifest = rendererCapabilityManifestOf({
      capabilityId: 'epoch.renderer.someone-else',
      version: '1.0.0',
      descriptor: adapter.descriptor(),
      capabilities: adapter.capabilities(),
      displayName: adapter.identity().displayName,
    });
    const sealed = sealCapabilityManifest(manifest);
    if (!sealed.ok) return;
    const registry = new RendererAdapterRegistry();
    const registered = registry.register({
      manifest: sealed.value.manifest,
      digest: sealed.value.digest,
      adapter,
    });
    expect(registered.ok).toBe(false);
    if (!registered.ok) expect(registered.error.code).toBe('invalid-fabric-record');
  });
});
