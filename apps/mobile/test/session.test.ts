// FIELD-SESSION EVIDENCE: tenant-scoped capture sessions, the lifecycle
// state machine (immutable sealed transitions), tamper detection, and
// cross-tenant isolation (R12).
import { describe, expect, it } from 'vitest';
import {
  closeFieldSession,
  openFieldSession,
  pauseFieldSession,
  resumeFieldSession,
  sessionTenantGuard,
  verifySealedFieldSession,
  buildFieldDeviceDescriptor,
} from '../src/index';
import {
  FIELD_ENGINEER,
  OTHER_TENANT,
  REVIEWER,
  T0,
  T1,
  T2,
  T3,
  TENANT,
  DELIVERY,
  SOLUTION,
  fieldDevice,
  sealedSession,
} from './helpers';

describe('field session lifecycle (immutable sealed transitions)', () => {
  it('opens an active session scoped to the tenant and work context', () => {
    const session = sealedSession();
    expect(session.state).toBe('active');
    expect(session.tenantId).toBe(TENANT);
    expect(session.scope.solutionId).toBe(SOLUTION);
    expect(session.scope.deliveryId).toBe(DELIVERY);
    expect(session.openedBy).toBe(FIELD_ENGINEER);
  });

  it('every lifecycle transition yields a NEW sealed state (content addressing)', () => {
    const opened = sealedSession();
    const paused = pauseFieldSession(opened, T1);
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    expect(paused.value.state).toBe('paused');
    expect(paused.value.pausedAt).toBe(T1);
    expect(paused.value.contentDigest).not.toBe(opened.contentDigest);

    const resumed = resumeFieldSession(paused.value, T2);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.value.state).toBe('active');
    expect(resumed.value.resumedAt).toBe(T2);

    const closed = closeFieldSession(resumed.value, REVIEWER, T3);
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.value.state).toBe('closed');
    expect(closed.value.closedAt).toBe(T3);
    expect(closed.value.closedBy).toBe(REVIEWER);
  });

  it('pausing a paused session is a typed session-state-conflict', () => {
    const paused = pauseFieldSession(sealedSession(), T1);
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    const again = pauseFieldSession(paused.value, T2);
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error.code).toBe('session-state-conflict');
  });

  it('closing a paused session is a typed session-state-conflict (resume first)', () => {
    const paused = pauseFieldSession(sealedSession(), T1);
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    const closed = closeFieldSession(paused.value, REVIEWER, T2);
    expect(closed.ok).toBe(false);
    if (closed.ok) return;
    expect(closed.error.code).toBe('session-state-conflict');
    expect(closed.error.message).toContain('resume first');
  });

  it('resuming an active session is a typed session-state-conflict', () => {
    const resumed = resumeFieldSession(sealedSession(), T1);
    expect(resumed.ok).toBe(false);
    if (resumed.ok) return;
    expect(resumed.error.code).toBe('session-state-conflict');
  });

  it('the device descriptor must be at field fidelity (non-field descriptors rejected)', () => {
    const device = fieldDevice();
    expect(device.ok).toBe(true);
    if (!device.ok) return;
    const nonField = { ...device.value, deviceClass: 'desktop' as const };
    const opened = openFieldSession({
      sessionId: 'field-session:bad-device',
      tenantId: TENANT,
      device: nonField,
      solutionId: SOLUTION,
      deliveryId: DELIVERY,
      openedBy: FIELD_ENGINEER,
      openedAt: T0,
    });
    expect(opened.ok).toBe(false);
    if (opened.ok) return;
    expect(opened.error.code).toBe('validation');
    expect(opened.error.message).toContain('not a field client class');
  });

  it('JSON round-trip preserves the sealed session and its digest verifies', () => {
    const session = sealedSession();
    const roundTripped = JSON.parse(JSON.stringify(session)) as unknown;
    const verified = verifySealedFieldSession(roundTripped);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(session);
    }
  });

  it('tampering with the sealed session is a typed digest-mismatch', () => {
    const session = sealedSession();
    const tampered = { ...session, openedAt: T3 };
    const verified = verifySealedFieldSession(tampered);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('digest-mismatch');
    expect(verified.error.expectedDigest).not.toBe(verified.error.encounteredDigest);
  });

  it('vendor fields on a session are typed vendor-fields-rejected (strict objects)', () => {
    const session = sealedSession();
    const smuggled = { ...session, vendorDevice: 'field-toolkit-pro' };
    const verified = verifySealedFieldSession(smuggled);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('vendor-fields-rejected');
  });

  it('unknown input shapes are typed validation errors, never exceptions', () => {
    for (const input of [null, 42, 'session', [], {}]) {
      const verified = verifySealedFieldSession(input);
      expect(verified.ok).toBe(false);
      if (verified.ok) return;
      expect(verified.error.code).toBe('validation');
    }
  });
});

describe('field session tenant isolation (R12)', () => {
  it('the tenant guard rejects a session from another tenant (cross-tenant-denied)', () => {
    const other = sealedSession({ tenantId: OTHER_TENANT });
    const guarded = sessionTenantGuard(other, TENANT);
    expect(guarded.ok).toBe(false);
    if (guarded.ok) return;
    expect(guarded.error.code).toBe('cross-tenant-denied');
    expect(guarded.error.expectedTenantId).toBe(TENANT);
    expect(guarded.error.encounteredTenantId).toBe(OTHER_TENANT);
  });

  it('the tenant guard admits the scoped tenant unchanged', () => {
    const session = sealedSession();
    const guarded = sessionTenantGuard(session, TENANT);
    expect(guarded.ok).toBe(true);
    if (guarded.ok) {
      expect(guarded.value).toEqual(session);
    }
  });

  it('the session rejects a schemaVersion skew (version pin)', () => {
    const session = sealedSession();
    const skewed = { ...session, schemaVersion: 2 };
    const verified = verifySealedFieldSession(skewed);
    expect(verified.ok).toBe(false);
  });
});

describe('field session determinism', () => {
  it('identical inputs produce identical session digests', () => {
    const first = sealedSession();
    const second = sealedSession();
    expect(first.contentDigest).toBe(second.contentDigest);
  });

  it('different provenance produces different digests', () => {
    const first = sealedSession();
    const second = sealedSession({ openedAt: T1 });
    expect(first.contentDigest).not.toBe(second.contentDigest);
  });

  it('field device descriptor determinism (identical options -> identical descriptor)', () => {
    const first = buildFieldDeviceDescriptor({ interaction: ['voice', 'touch'] });
    const second = buildFieldDeviceDescriptor({ interaction: ['touch', 'voice'] });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    // Admission sorts + deduplicates the modality set (deterministic set semantics).
    expect(first.value).toEqual(second.value);
    expect(first.value.interaction).toEqual(['touch', 'voice']);
  });
});
