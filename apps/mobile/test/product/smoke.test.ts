// W049 smoke: the full product engine over the REAL fixture gateway —
// sign-in, world projection, capture (online), offline interval, sync,
// idempotence. This is the engine-level spine every journey test builds on.
import { describe, expect, it } from 'vitest';
import { buildSignedInHost, fieldUncertainty, quantityMeasure, T12, T13, T14, photoFrame } from './helpers';

describe('the W049 product engine over the real W046 gateway (smoke spine)', () => {
  it('signs in through session.issue and persists the session in the secure store', async () => {
    const bundle = await buildSignedInHost();
    expect(bundle.host.hasSession).toBe(true);
    expect(bundle.host.currentSession?.principalId).toBe('principal:delivery-lead');
    const persisted = await bundle.secureStore.getItem('epoch.field.session');
    expect(persisted).toBeDefined();
    const parsed = JSON.parse(persisted!) as { kind: string; session: { sessionId: string } };
    expect(parsed.kind).toBe('epoch.field.session');
    expect(parsed.session.sessionId).toMatch(/^session:/);
    expect(await bundle.secureStore.usesOnlyKnownKeys()).toBe(true);
  });

  it('projects the world digest equal to the committed fixture world digest (J08 anchor)', async () => {
    const bundle = await buildSignedInHost();
    const world = await bundle.host.worldSnapshot();
    expect(world.ok).toBe(true);
    if (world.ok) {
      const records = bundle.gateway.records;
      expect(world.value.digest).toBe(records.world['digest']);
      expect(world.value.digest).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('captures an observation ONLINE through delivery.observe with digest-addressed evidence', async () => {
    const bundle = await buildSignedInHost({ frames: [photoFrame('smoke-evidence-1')] });
    bundle.clock.advanceTo(T12);
    const capture = await bundle.host.captureObservation({
      anchor: { kind: 'work-package', id: 'work-package:warehouse-substructure' },
      measure: quantityMeasure('118.5', 'm3'),
      uncertainty: fieldUncertainty(T12, 'principal:delivery-lead'),
      observedAt: T12,
      captureId: 'smoke-capture-1',
      evidence: [{ note: 'excavation progress photo' }],
    });
    expect(capture.ok).toBe(true);
    if (capture.ok) {
      expect(capture.mode).toBe('online');
      expect(capture.outcomeDigest).toMatch(/^[0-9a-f]{64}$/);
      expect(capture.capture.link.workPackageId).toBe('work-package:warehouse-substructure');
      expect(capture.evidence).toHaveLength(1);
      expect(capture.evidence[0]!.digestVerified).toBe(true);
      expect(capture.evidence[0]!.digest).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('captures OFFLINE as a pending projection, then syncs exactly once (J07 spine)', async () => {
    const bundle = await buildSignedInHost({ frames: [photoFrame('offline-evidence-1')] });
    bundle.clock.advanceTo(T13);
    bundle.host.goOffline();
    expect(bundle.host.offline).toBe(true);
    const capture = await bundle.host.captureObservation({
      anchor: { kind: 'activity', id: 'activity:warehouse-excavation' },
      measure: quantityMeasure('60', 'm3'),
      uncertainty: fieldUncertainty(T13, 'principal:delivery-lead'),
      observedAt: T13,
      captureId: 'offline-capture-1',
    });
    expect(capture.ok).toBe(true);
    if (capture.ok) {
      expect(capture.mode).toBe('offline-queued');
      expect(bundle.host.queueSnapshot()).toHaveLength(1);
    }
    // The offline interval: a drain attempt fails transiently, stays pending.
    const offlineDrain = await bundle.host.syncNow(T13).catch(() => null);
    // (syncNow forces the network online; the pure-offline drain is asserted
    //  in the J07 journey test through the controller directly.)
    expect(offlineDrain).not.toBeNull();
    if (offlineDrain !== null) {
      expect(offlineDrain.duplicateSideEffects).toBe(0);
      expect(offlineDrain.replayProofs).toHaveLength(1);
      expect(offlineDrain.replayProofs[0]!.replayed).toBe(true);
      expect(offlineDrain.replayProofs[0]!.digestStable).toBe(true);
    }
    bundle.clock.advanceTo(T14);
    expect(bundle.host.queueSnapshot()).toHaveLength(0);
  });
});
