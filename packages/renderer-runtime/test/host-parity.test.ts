// Host parity (devDependency — NO runtime coupling): the renderer hosting
// surface's device-session snapshot is pinned member-for-member against
// the REAL host model in @epoch/experience-runtime. A real host session
// projects onto a snapshot that admits; the mirrored id grammar agrees;
// the virtual-time vocabulary agrees; and a full cross-package composition
// (host session -> snapshot -> binding -> mount -> frame -> intent) works
// end-to-end. The compile-time half lives in src/host-parity.ts.
import { describe, expect, it } from 'vitest';
import {
  DEVICE_SESSION_ID_PATTERN,
  DeviceSessionIdSchema,
  VirtualTimeMsSchema,
  admitInvocation,
  bindRendererSession,
  deviceSessionSnapshotOf,
} from '../src/index';
import {
  DEVICE_SESSION_ID_PATTERN as HOST_PATTERN,
  advanceVirtualTime,
  openDeviceSession,
} from '@epoch/experience-runtime';
import { FULL_RENDERER, expectFailure, sealedGraph } from './fixtures';

describe('device-session snapshot parity (devDependency)', () => {
  it('the mirrored id grammar equals the host grammar', () => {
    expect(DEVICE_SESSION_ID_PATTERN.source).toBe(HOST_PATTERN.source);
    expect(DEVICE_SESSION_ID_PATTERN.flags).toBe(HOST_PATTERN.flags);
  });

  it('a real host session id parses with the mirrored snapshot schema', () => {
    const opened = openDeviceSession({
      deviceSessionId: 'ds-host-parity-1',
      tenantScope: { tenantId: 'tenant-alpha' },
      device: {
        descriptorVersion: 1,
        deviceClass: 'desktop',
        interaction: ['keyboard', 'pointer'],
        display: { stereoscopic: false },
        spatial: { poseTracking: 'none', worldAnchored: false },
      },
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(DeviceSessionIdSchema.safeParse(opened.value.session.deviceSessionId).success).toBe(
      true,
    );
  });

  it('a real host session projects onto a snapshot that admits at the binding', () => {
    const opened = openDeviceSession({
      deviceSessionId: 'ds-host-parity-2',
      tenantScope: { tenantId: 'tenant-alpha' },
      device: {
        descriptorVersion: 1,
        deviceClass: 'desktop',
        interaction: ['keyboard', 'pointer', 'voice'],
        display: { stereoscopic: false },
        spatial: { poseTracking: 'none', worldAnchored: false },
      },
    });
    if (!opened.ok) throw new Error('fixture host session');
    const snapshot = deviceSessionSnapshotOf(opened.value.session);
    const bound = bindRendererSession({
      rendererSessionId: 'rs-parity-1',
      renderer: FULL_RENDERER,
      device: snapshot,
      boundAtMs: opened.value.session.virtualTimeMs,
    });
    expect(bound.ok).toBe(true);
  });

  it('a tampered snapshot (foreign tenant) is rejected by the binding', () => {
    const opened = openDeviceSession({
      deviceSessionId: 'ds-host-parity-3',
      tenantScope: { tenantId: 'tenant-alpha' },
      device: {
        descriptorVersion: 1,
        deviceClass: 'desktop',
        interaction: ['pointer'],
        display: { stereoscopic: false },
        spatial: { poseTracking: 'none', worldAnchored: false },
      },
    });
    if (!opened.ok) throw new Error('fixture host session');
    const failure = expectFailure(
      bindRendererSession(
        {
          rendererSessionId: 'rs-parity-1',
          renderer: FULL_RENDERER,
          device: deviceSessionSnapshotOf({
            ...opened.value.session,
            tenantScope: { tenantId: 'tenant-beta' },
          }),
        },
        { expectedTenantId: 'tenant-alpha' },
      ),
      'cross-tenant-denied',
    );
    expect(failure.encounteredTenantId).toBe('tenant-beta');
  });

  it('the mirrored virtual-time vocabulary agrees with the host vocabulary', () => {
    expect(VirtualTimeMsSchema.safeParse(0).success).toBe(true);
    expect(VirtualTimeMsSchema.safeParse(123_456).success).toBe(true);
    expect(VirtualTimeMsSchema.safeParse(-1).success).toBe(false);
    expect(VirtualTimeMsSchema.safeParse(1.5).success).toBe(false);
  });
});

describe('cross-package composition (host model x hosting surface)', () => {
  it('host session -> snapshot -> bind -> mount -> advance -> intent end-to-end', () => {
    // 1. The host opens a scheduled device session and advances virtual
    //    time (the deterministic host clock drives the renderer).
    const opened = openDeviceSession({
      deviceSessionId: 'ds-compose-host',
      tenantScope: { tenantId: 'tenant-alpha' },
      device: {
        descriptorVersion: 1,
        deviceClass: 'desktop',
        interaction: ['keyboard', 'pointer'],
        display: { stereoscopic: false, refreshHz: 60 },
        spatial: { poseTracking: 'none', worldAnchored: false },
      },
      schedule: { scheduleVersion: 1, frameDurationMs: 16, tickCadence: 1 },
    });
    if (!opened.ok) throw new Error('fixture open');
    const advanced = advanceVirtualTime(opened.value.session, 16);
    if (!advanced.ok) throw new Error('fixture advance');
    const hostSession = advanced.value.session;
    expect(advanced.value.events.map((event) => event.kind)).toEqual([
      'frame-started',
      'tick-advanced',
    ]);

    // 2. The hosting surface binds against the host session's snapshot.
    const bound = bindRendererSession({
      rendererSessionId: 'rs-compose-host',
      renderer: FULL_RENDERER,
      device: deviceSessionSnapshotOf(hostSession),
      boundAtMs: hostSession.virtualTimeMs,
    });
    if (!bound.ok) throw new Error('fixture bind');
    let binding = bound.value;

    // 3. A W011 graph mounts on the binding.
    const graph = sealedGraph('2d');
    const mounted = admitInvocation(
      binding,
      {
        schema: 'epoch.renderer-invocation',
        protocolVersion: '1.0.0',
        kind: 'mount-graph',
        invocationId: 'inv-compose-host-mount',
        rendererSessionId: 'rs-compose-host',
        graphDigest: graph.digest,
        atMs: hostSession.virtualTimeMs,
      },
      { graph },
    );
    if (!mounted.ok) throw new Error('fixture mount');
    binding = mounted.value.binding;

    // 4. The frame the host scheduled executes on the binding.
    const framed = admitInvocation(binding, {
      schema: 'epoch.renderer-invocation',
      protocolVersion: '1.0.0',
      kind: 'advance-frame',
      invocationId: 'inv-compose-host-frame',
      rendererSessionId: 'rs-compose-host',
      frameIndex: hostSession.frameIndex,
      atMs: hostSession.virtualTimeMs,
    });
    if (!framed.ok) throw new Error('fixture frame');
    binding = framed.value.binding;
    if (framed.value.receipt.kind !== 'frame-receipt') throw new Error('fixture receipt');
    expect(framed.value.receipt.stateDigest).toBe(graph.digest);
    expect(framed.value.receipt.frameIndex).toBe(1);

    // 5. A typed intent admits from the negotiated modality set.
    const intented = admitInvocation(binding, {
      schema: 'epoch.renderer-invocation',
      protocolVersion: '1.0.0',
      kind: 'submit-intent',
      invocationId: 'inv-compose-host-intent',
      rendererSessionId: 'rs-compose-host',
      modality: 'pointer',
      intent: { id: 'world.view.refresh', version: '1.0.0' },
    });
    expect(intented.ok).toBe(true);
    if (!intented.ok) return;
    expect(intented.value.binding.invocationCount).toBe(3);
  });
});
