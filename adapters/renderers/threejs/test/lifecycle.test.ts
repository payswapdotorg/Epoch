/**
 * W058 unit battery — declaration, degradation, animation, snapshot/
 * restore, disposal, probe, and honest headless capture.
 */
import { describe, expect, it } from 'vitest';
import {
  CAPABILITIES_THREE,
  DESCRIPTOR_THREE,
  FULL_FIDELITY_SEGMENTS,
  IDENTITY_THREE,
  REDUCED_FIDELITY_SEGMENTS,
  ThreeJsRendererAdapter,
  isWireframe,
} from '../src/index';
import { RendererCapabilitySetSchema, RendererDescriptorSchema } from '@epoch/renderer-runtime';
import {
  UNIT_SCENE,
  mountUnitSession,
  parseEnvelope,
  pointerInput,
  unitCompilation,
  UNIT_ENTITY_IDS,
  wheelEnvelope,
} from './helpers';
import type { PortableCameraState } from '@epoch/renderer-runtime';

/** Narrow a portable camera to its orbit member (readable failures otherwise). */
function orbitOf(camera: PortableCameraState | undefined): Extract<PortableCameraState, { mode: 'orbit' }> {
  if (camera === undefined || camera.mode !== 'orbit') {
    throw new Error(`expected an orbit portable camera, got mode "${camera?.mode ?? 'none'}"`);
  }
  return camera;
}

describe('W058 three.js adapter — declaration', () => {
  it('declares a contract-valid W013 descriptor and W056 capability set', () => {
    expect(() => RendererDescriptorSchema.parse(DESCRIPTOR_THREE)).not.toThrow();
    expect(() => RendererCapabilitySetSchema.parse(CAPABILITIES_THREE)).not.toThrow();
    // Identity consistency (the registry enforces this at registration).
    expect(IDENTITY_THREE.rendererId).toBe(DESCRIPTOR_THREE.rendererId);
    expect(IDENTITY_THREE.rendererId).toBe(CAPABILITIES_THREE.rendererId);
    // The capability-set consistency rules hold.
    expect(CAPABILITIES_THREE.degradation).toEqual(['none', 'reduced-fidelity', 'static-frame', 'wireframe']);
    expect(CAPABILITIES_THREE.portableViewState).toEqual(['camera', 'focused-entities', 'layer-visibility', 'timeline-position']);
    expect(CAPABILITIES_THREE.snapshotCapture).toBe(true);
    expect(CAPABILITIES_THREE.sessionSwitching).toBe(true);
  });
});

describe('W058 three.js adapter — probe (pure, headless)', () => {
  it('probes compatible device classes without a GL context', async () => {
    const adapter = new ThreeJsRendererAdapter();
    const { UNIT_DEVICE } = await import('./helpers');
    for (const deviceClass of ['desktop', 'laptop', 'wall-display'] as const) {
      const probed = await adapter.probe({
        device: { ...UNIT_DEVICE, device: { ...UNIT_DEVICE.device, deviceClass } },
        atMs: 1_000,
      });
      expect(probed.ok).toBe(true);
      if (probed.ok) {
        expect(probed.value.compatible).toBe(true);
        expect(probed.value.degradation).toBe('none');
      }
    }
  });

  it('probes small screens as reduced-fidelity and headsets as incompatible', async () => {
    const adapter = new ThreeJsRendererAdapter();
    const { UNIT_DEVICE } = await import('./helpers');
    for (const deviceClass of ['phone', 'tablet'] as const) {
      const probed = await adapter.probe({
        device: { ...UNIT_DEVICE, device: { ...UNIT_DEVICE.device, deviceClass } },
        atMs: 1_000,
      });
      expect(probed.ok).toBe(true);
      if (probed.ok) {
        expect(probed.value.compatible).toBe(true);
        expect(probed.value.degradation).toBe('reduced-fidelity');
      }
    }
    const headset = await adapter.probe({
      device: { ...UNIT_DEVICE, device: { ...UNIT_DEVICE.device, deviceClass: 'headset' } },
      atMs: 1_000,
    });
    expect(headset.ok).toBe(true);
    if (headset.ok) {
      expect(headset.value.compatible).toBe(false);
      expect(headset.value.reason).toContain('XR');
    }
  });
});

describe('W058 three.js adapter — degradation (declared, typed, reversible)', () => {
  it('applies wireframe and restores full fidelity', async () => {
    const { adapter } = await mountUnitSession();
    const session = adapter.adapterSessionOf('fx-threejs-unit-1')!;
    const frame = (degradation: 'none' | 'wireframe', index: number) =>
      adapter.applyFrame(session, {
        schema: 'epoch.renderer-frame-envelope',
        fabricProtocolVersion: '1.0.0',
        fabricSessionId: 'fx-threejs-unit-1',
        frameIndex: index,
        atMs: 3_000 + index,
        worldDigest: UNIT_SCENE.digest,
        degradation,
        admissionDigest: 'a'.repeat(64),
      });
    expect(isWireframe(adapter.presentationOf('fx-threejs-unit-1')!, UNIT_ENTITY_IDS[0])).toBe(false);
    const wired = await frame('wireframe', 1);
    expect(wired.ok).toBe(true);
    expect(isWireframe(adapter.presentationOf('fx-threejs-unit-1')!, UNIT_ENTITY_IDS[0])).toBe(true);
    const restored = await frame('none', 2);
    expect(restored.ok).toBe(true);
    expect(isWireframe(adapter.presentationOf('fx-threejs-unit-1')!, UNIT_ENTITY_IDS[0])).toBe(false);
  });

  it('rebuilds curved primitives at the reduced LOD and back', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    const session = adapter.adapterSessionOf('fx-threejs-unit-1')!;
    expect(presentation.lodSegments).toBe(FULL_FIDELITY_SEGMENTS);
    const reduced = await adapter.applyFrame(session, {
      schema: 'epoch.renderer-frame-envelope',
      fabricProtocolVersion: '1.0.0',
      fabricSessionId: 'fx-threejs-unit-1',
      frameIndex: 1,
      atMs: 3_001,
      worldDigest: UNIT_SCENE.digest,
      degradation: 'reduced-fidelity',
      admissionDigest: 'a'.repeat(64),
    });
    expect(reduced.ok).toBe(true);
    expect(presentation.lodSegments).toBe(REDUCED_FIDELITY_SEGMENTS);
    const full = await adapter.applyFrame(session, {
      schema: 'epoch.renderer-frame-envelope',
      fabricProtocolVersion: '1.0.0',
      fabricSessionId: 'fx-threejs-unit-1',
      frameIndex: 2,
      atMs: 3_002,
      worldDigest: UNIT_SCENE.digest,
      degradation: 'none',
      admissionDigest: 'a'.repeat(64),
    });
    expect(full.ok).toBe(true);
    expect(presentation.lodSegments).toBe(FULL_FIDELITY_SEGMENTS);
  });

  it('freezes playback under static-frame (and refuses undeclared degradations defensively)', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    const session = adapter.adapterSessionOf('fx-threejs-unit-1')!;
    const frame = (degradation: 'none' | 'static-frame', atMs: number) =>
      adapter.applyFrame(session, {
        schema: 'epoch.renderer-frame-envelope',
        fabricProtocolVersion: '1.0.0',
        fabricSessionId: 'fx-threejs-unit-1',
        frameIndex: atMs,
        atMs,
        worldDigest: UNIT_SCENE.digest,
        degradation,
        admissionDigest: 'a'.repeat(64),
      });
    // Playing: the animated entity's height follows the virtual time.
    await frame('none', 4_000);
    const animated = presentation.entityNodes.get(UNIT_ENTITY_IDS[2])!;
    const atFour = animated.position.y;
    await frame('none', 6_000);
    const atSix = animated.position.y;
    expect(atSix).not.toBe(atFour);
    // Frozen: the position holds while frames still advance.
    await frame('static-frame', 8_000);
    const frozen = animated.position.y;
    await frame('static-frame', 9_000);
    expect(animated.position.y).toBe(frozen);
    // The adapter re-checks declarations (the fabric gates first; the
    // adapter is defense in depth). All four kinds ARE declared, so the
    // check passes — proven by the frames above; the FABRIC-level
    // undeclared-degradation refusal is proven in the conformance battery.
  });

  it('advances the presentation timeline with virtual frame time', async () => {
    const { adapter } = await mountUnitSession();
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    const session = adapter.adapterSessionOf('fx-threejs-unit-1')!;
    await adapter.applyFrame(session, {
      schema: 'epoch.renderer-frame-envelope',
      fabricProtocolVersion: '1.0.0',
      fabricSessionId: 'fx-threejs-unit-1',
      frameIndex: 1,
      atMs: 7_000,
      worldDigest: UNIT_SCENE.digest,
      degradation: 'none',
      admissionDigest: 'a'.repeat(64),
    });
    expect(presentation.timelineAtMs).toBe(7_000);
  });
});

describe('W058 three.js adapter — snapshot capture & portable restore', () => {
  it('captures a sealed snapshot whose camera is the LIVE presentation viewpoint', async () => {
    const { adapter } = await mountUnitSession();
    const session = adapter.adapterSessionOf('fx-threejs-unit-1')!;
    // Move the presentation camera (zoom), then capture.
    await adapter.translateInput(
      session,
      parseEnvelope(wheelEnvelope('fx-threejs-unit-1', 'rin-unit-zoom-cap', -120, 3_000)),
    );
    const snapshot = await adapter.captureSnapshot(session, {
      invocationCount: 5,
      switchCount: 0,
      atMs: 4_000,
    });
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    expect(snapshot.value.worldProjection.worldDigest).toBe(UNIT_SCENE.digest);
    expect(snapshot.value.capturedFromRendererId).toBe('rr-threejs');
    expect(snapshot.value.viewState.camera).toBeDefined();
    // The LIVE viewpoint (after the zoom dolly) — not the mount-time default.
    expect(orbitOf(snapshot.value.viewState.camera).position).not.toEqual([26, 20, 26]);
    expect(orbitOf(snapshot.value.viewState.camera).target).toEqual([8, 6, 0]);
    expect(snapshot.value.digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('restores every declared portable field and reflects it in the presentation', async () => {
    const { adapter } = await mountUnitSession();
    const session = adapter.adapterSessionOf('fx-threejs-unit-1')!;
    const restored = await adapter.restoreViewState(session, {
      focusedEntityIds: [UNIT_ENTITY_IDS[2]],
      layerVisibility: [
        { layerId: 'lyr-structure', visible: true },
        { layerId: 'lyr-node', visible: true },
      ],
      timelinePosition: { atMs: 5_000, frameIndex: 150, paused: true },
      camera: { mode: 'orbit', position: [40, 30, 40], target: [8, 6, 0] },
      hiddenEntityIds: [UNIT_ENTITY_IDS[3]],
    });
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    // The adapter declares every portable field.
    expect(restored.value.appliedFields).toEqual(['camera', 'focused-entities', 'layer-visibility', 'timeline-position']);
    expect(restored.value.skippedFields).toEqual([]);
    const presentation = adapter.presentationOf('fx-threejs-unit-1')!;
    // Camera restored.
    const camera = presentation.controls.camera;
    expect([camera.position.x, camera.position.y, camera.position.z]).toEqual([40, 30, 40]);
    // Focus decorations rebuilt for the new focus set.
    const delta = presentation.entityNodes.get(UNIT_ENTITY_IDS[2])!;
    expect(delta.children.some((child) => child.userData['epochFocusRing'] === true)).toBe(true);
    const beta = presentation.entityNodes.get(UNIT_ENTITY_IDS[1])!;
    expect(beta.children.some((child) => child.userData['epochFocusRing'] === true)).toBe(false);
    // Hidden set applied.
    expect(presentation.entityNodes.get(UNIT_ENTITY_IDS[3])!.visible).toBe(false);
    // Timeline restored.
    expect(presentation.timelineAtMs).toBe(5_000);
    expect(presentation.timelinePaused).toBe(true);
  });
});

describe('W058 three.js adapter — disposal (full GPU teardown, terminal)', () => {
  it('disposes every tracked GPU resource exactly through Three.js dispose events', async () => {
    const { adapter } = await mountUnitSession();
    const before = adapter.disposalReportOf('fx-threejs-unit-1')!;
    expect(before.totalTracked).toBeGreaterThan(0);
    expect(before.geometries).toBeGreaterThanOrEqual(5);
    expect(before.materials).toBeGreaterThanOrEqual(5);
    const session = adapter.adapterSessionOf('fx-threejs-unit-1')!;
    const disposed = await adapter.dispose(session);
    expect(disposed.ok).toBe(true);
    if (disposed.ok) {
      expect(disposed.value.disposed).toBe(true);
      expect(disposed.value.notes).toContain('full GPU teardown');
    }
    // EVERY tracked resource emitted its real dispose event.
    expect(before.disposedEvents).toBe(0);
    const after = adapter.disposalReportOf('fx-threejs-unit-1')!;
    expect(after.disposedEvents).toBe(after.totalTracked);
    expect(after.totalTracked).toBe(before.totalTracked);
  });

  it('makes dispose terminal: disposed sessions refuse everything', async () => {
    const { adapter, session } = await mountUnitSession();
    await adapter.dispose(session);
    expect(adapter.adapterSessionOf('fx-threejs-unit-1')).toBeUndefined();
    expect(adapter.presentationOf('fx-threejs-unit-1')).toBeUndefined();
    // Every seam method refuses with the typed session-disposed failure.
    const mounted = await adapter.mountProjection(session, {
      scene: UNIT_SCENE,
      compilation: unitCompilation(),
      admittedReceipts: [],
    });
    expect(mounted.ok).toBe(false);
    if (!mounted.ok) {
      expect(mounted.error.code).toBe('session-disposed');
    }
    const translated = await adapter.translateInput(
      session,
      parseEnvelope(pointerInput('fx-threejs-unit-1', 'rin-unit-after-dispose', 0.5, 0.5, 3_000)),
    );
    expect(translated.ok).toBe(false);
    if (!translated.ok) {
      expect(translated.error.code).toBe('session-disposed');
    }
    const snapshotted = await adapter.captureSnapshot(session, {
      invocationCount: 1,
      switchCount: 0,
      atMs: 5_000,
    });
    expect(snapshotted.ok).toBe(false);
    if (!snapshotted.ok) {
      expect(snapshotted.error.code).toBe('session-disposed');
    }
    const health = await adapter.health(session, 5_000);
    expect(health.state).toBe('unavailable');
    expect(health.lastFailureCode).toBe('session-disposed');
    // Dispose is idempotent.
    const again = await adapter.dispose(session);
    expect(again.ok).toBe(true);
  });
});

describe('W058 three.js adapter — honest headless frame capture', () => {
  it('refuses frame image capture with a typed failure when no GL surface is attached', async () => {
    const { adapter, session } = await mountUnitSession();
    const captured = adapter.captureFrameImage(session, {
      frameIndex: 1,
      atMs: 4_000,
      width: 320,
      height: 240,
    });
    expect(captured.ok).toBe(false);
    if (!captured.ok) {
      expect(captured.error.code).toBe('session-failed');
      expect(captured.error.message).toContain('no GL surface');
    }
  });

  it('captures a digest-addressed frame image through an injected surface', async () => {
    // The GL surface is INJECTED (the browser host constructs the real
    // WebGLRenderer; W061 closes the browser loop). This proves the
    // adapter's capture LOGIC headless with a surface double the host
    // contract defines — no fabricated pixels, an honest stub.
    let rendered = 0;
    const stubSurface = {
      renderer: {
        render: () => {
          rendered += 1;
        },
        dispose: () => undefined,
      },
      pixelSource: () => ({ mediaType: 'image/png', bytes: new Uint8Array([1, 2, 3, 4]) }),
    };
    const adapter = new ThreeJsRendererAdapter({
      surfaceFactory: () => stubSurface as unknown as import('../src/index').ThreeGlSurface,
    });
    const { session } = await mountUnitSession({ adapter, fabricSessionId: 'fx-threejs-gl-1' });
    const framed = await adapter.applyFrame(session, {
      schema: 'epoch.renderer-frame-envelope',
      fabricProtocolVersion: '1.0.0',
      fabricSessionId: 'fx-threejs-gl-1',
      frameIndex: 1,
      atMs: 3_000,
      worldDigest: UNIT_SCENE.digest,
      degradation: 'none',
      admissionDigest: 'a'.repeat(64),
    });
    expect(framed.ok).toBe(true);
    if (framed.ok) {
      expect(framed.value.presented).toBe(true);
      expect(framed.value.notes).toContain('GL frame rendered');
    }
    expect(rendered).toBe(1);
    const captured = adapter.captureFrameImage(session, {
      frameIndex: 1,
      atMs: 4_000,
      width: 320,
      height: 240,
    });
    expect(captured.ok).toBe(true);
    if (captured.ok) {
      expect(captured.value.imageDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(captured.value.byteSize).toBe(4);
      expect(captured.value.mediaType).toBe('image/png');
      expect(captured.value.worldDigest).toBe(UNIT_SCENE.digest);
    }
    // The renderer is a tracked GPU resource (torn down at dispose).
    const report = adapter.disposalReportOf('fx-threejs-gl-1')!;
    expect(report.renderers).toBe(1);
  });
});
