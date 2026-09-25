// Negative battery: named typed rejections of the host model — version
// skew, malformed records (strict objects reject vendor/engine fields),
// digest tampering, cross-tenant access, illegal lifecycle transitions,
// illegal virtual-time deltas, and lifecycle-inconsistent event traces.
import { describe, expect, it } from 'vitest';
import {
  advanceVirtualTime,
  closeDeviceSession,
  mountRenderState,
  openDeviceSession,
  pauseDeviceSession,
  parseDeviceSessionRecord,
  parseRuntimeEventTrace,
  resumeDeviceSession,
  sealRuntimeEventTrace,
} from '../src/index';
import {
  DESKTOP_DEVICE,
  SCHEDULE_60,
  SCOPE_A,
  SCOPE_B,
  TENANT_A,
  TENANT_B,
  expectFailure,
  openSession,
} from './fixtures';

const STATE_DIGEST = 'a'.repeat(64);

describe('malformed-record rejections (strict vendor-field boundary)', () => {
  it('rejects a session record carrying engine/vendor fields at precise paths', () => {
    const failure = expectFailure(
      parseDeviceSessionRecord({
        ...openSession(),
        engine: 'three.js',
      }),
      'malformed-record',
    );
    expect(failure.issues.some((issue) => issue.path === 'engine')).toBe(true);
  });

  it('rejects a device descriptor carrying a vendor field inside the W011 slot', () => {
    const failure = expectFailure(
      parseDeviceSessionRecord({
        ...openSession(),
        device: { ...DESKTOP_DEVICE, webgl: true },
      }),
      'malformed-record',
    );
    expect(
      failure.issues.some((issue) => issue.path === 'device.webgl'),
    ).toBe(true);
  });

  it('rejects a non-object root', () => {
    expectFailure(parseDeviceSessionRecord([]), 'malformed-record');
    expectFailure(parseDeviceSessionRecord('nope'), 'malformed-record');
  });

  it('rejects an invalid device-session id grammar', () => {
    const failure = expectFailure(
      openDeviceSession({
        deviceSessionId: 'Session One',
        tenantScope: SCOPE_A,
        device: DESKTOP_DEVICE,
      }),
      'malformed-record',
    );
    expect(failure.issues.some((issue) => issue.path === 'deviceSessionId')).toBe(true);
  });

  it('rejects an out-of-bounds schedule', () => {
    expectFailure(
      openDeviceSession({
        deviceSessionId: 'ds-alpha-1',
        tenantScope: SCOPE_A,
        device: DESKTOP_DEVICE,
        schedule: { scheduleVersion: 1, frameDurationMs: 0, tickCadence: 1 },
      }),
      'malformed-record',
    );
    expectFailure(
      openDeviceSession({
        deviceSessionId: 'ds-alpha-1',
        tenantScope: SCOPE_A,
        device: DESKTOP_DEVICE,
        schedule: { scheduleVersion: 2, frameDurationMs: 16, tickCadence: 1 },
      }),
      'malformed-record',
    );
  });

  it('rejects a record whose derived frame index drifted from virtual time', () => {
    const failure = expectFailure(
      parseDeviceSessionRecord({ ...openSession({ schedule: SCHEDULE_60 }), frameIndex: 7 }),
      'malformed-record',
    );
    expect(failure.issues.some((issue) => issue.path === 'frameIndex')).toBe(true);
  });

  it('rejects a mounted-state record without a mount time', () => {
    const failure = expectFailure(
      parseDeviceSessionRecord({
        ...openSession(),
        mountedStateDigest: STATE_DIGEST,
      }),
      'malformed-record',
    );
    expect(failure.issues.some((issue) => issue.path === 'mountedAtMs')).toBe(true);
  });
});

describe('version-unsupported rejections', () => {
  it('rejects protocolVersion skew before any schema validation', () => {
    const failure = expectFailure(
      parseDeviceSessionRecord({ ...openSession(), protocolVersion: '2.0.0' }),
      'version-unsupported',
    );
    expect(failure.expected).toBe('1.0.0');
    expect(failure.encountered).toBe('2.0.0');
  });

  it('rejects a skewed event trace', () => {
    const session = openSession();
    const trace = sealRuntimeEventTrace({
      schema: 'epoch.experience-runtime.event-trace',
      protocolVersion: '0.9.0',
      deviceSessionId: session.deviceSessionId,
      tenantScope: SCOPE_A,
      events: [
        {
          kind: 'session-opened',
          sequence: 1,
          deviceSessionId: session.deviceSessionId,
          tenantScope: SCOPE_A,
          device: DESKTOP_DEVICE,
          occurredAtMs: 0,
        },
      ],
    });
    expect(trace.ok).toBe(false);
  });
});

describe('digest-mismatch rejections (tamper detection)', () => {
  it('rejects a session record whose claimed digest does not match its content', () => {
    const failure = expectFailure(
      parseDeviceSessionRecord({ ...openSession(), digest: '0'.repeat(64) }),
      'digest-mismatch',
    );
    expect(failure.path).toEqual(['digest']);
    expect(failure.expected).toMatch(/^[0-9a-f]{64}$/);
    expect(failure.encountered).toBe('0'.repeat(64));
  });

  it('rejects an event trace whose claimed digest does not match its content', () => {
    const session = openSession();
    const sealed = sealRuntimeEventTrace({
      schema: 'epoch.experience-runtime.event-trace',
      protocolVersion: '1.0.0',
      deviceSessionId: session.deviceSessionId,
      tenantScope: SCOPE_A,
      events: [
        {
          kind: 'session-opened',
          sequence: 1,
          deviceSessionId: session.deviceSessionId,
          tenantScope: SCOPE_A,
          device: DESKTOP_DEVICE,
          occurredAtMs: 0,
        },
      ],
    });
    if (!sealed.ok) throw new Error('fixture trace');
    const failure = expectFailure(
      parseRuntimeEventTrace({ ...sealed.value, digest: '1'.repeat(64) }),
      'digest-mismatch',
    );
    expect(failure.path).toEqual(['digest']);
  });
});

describe('cross-tenant-denied rejections (R12)', () => {
  it('rejects opening a session for another tenant', () => {
    const failure = expectFailure(
      openDeviceSession(
        {
          deviceSessionId: 'ds-alpha-1',
          tenantScope: SCOPE_A,
          device: DESKTOP_DEVICE,
        },
        { expectedTenantId: TENANT_B },
      ),
      'cross-tenant-denied',
    );
    expect(failure.expectedTenantId).toBe(TENANT_B);
    expect(failure.encounteredTenantId).toBe(TENANT_A);
  });

  it('rejects lifecycle operations on another tenant session', () => {
    const session = openSession();
    expectFailure(
      pauseDeviceSession(session, { expectedTenantId: TENANT_B }),
      'cross-tenant-denied',
    );
    expectFailure(
      advanceVirtualTime(session, 16, { expectedTenantId: TENANT_B }),
      'cross-tenant-denied',
    );
    expectFailure(
      mountRenderState(session, { stateDigest: STATE_DIGEST }, { expectedTenantId: TENANT_B }),
      'cross-tenant-denied',
    );
    expectFailure(
      closeDeviceSession(session, { expectedTenantId: TENANT_B }),
      'cross-tenant-denied',
    );
  });

  it('rejects admitting a session record for another tenant', () => {
    const failure = expectFailure(
      parseDeviceSessionRecord(openSession(), { expectedTenantId: TENANT_B }),
      'cross-tenant-denied',
    );
    expect(failure.path).toEqual(['tenantScope', 'tenantId']);
  });

  it('rejects admitting an event trace for another tenant', () => {
    const session = openSession();
    const sealed = sealRuntimeEventTrace({
      schema: 'epoch.experience-runtime.event-trace',
      protocolVersion: '1.0.0',
      deviceSessionId: session.deviceSessionId,
      tenantScope: SCOPE_A,
      events: [
        {
          kind: 'session-opened',
          sequence: 1,
          deviceSessionId: session.deviceSessionId,
          tenantScope: SCOPE_A,
          device: DESKTOP_DEVICE,
          occurredAtMs: 0,
        },
      ],
    });
    if (!sealed.ok) throw new Error('fixture trace');
    expectFailure(
      parseRuntimeEventTrace(sealed.value, { expectedTenantId: TENANT_B }),
      'cross-tenant-denied',
    );
  });
});

describe('invalid-transition rejections (lifecycle + virtual time)', () => {
  it('rejects pausing a paused session and resuming an active session', () => {
    const session = openSession();
    const paused = pauseDeviceSession(session);
    if (!paused.ok) throw new Error('fixture pause');
    const failure = expectFailure(pauseDeviceSession(paused.value.session), 'invalid-transition');
    expect(failure.operation).toBe('pause');
    expect(failure.sessionState).toBe('paused');
    expectFailure(resumeDeviceSession(session), 'invalid-transition');
  });

  it('rejects closing a closed session (terminal)', () => {
    const session = openSession();
    const closed = closeDeviceSession(session);
    if (!closed.ok) throw new Error('fixture close');
    const failure = expectFailure(closeDeviceSession(closed.value.session), 'invalid-transition');
    expect(failure.operation).toBe('close');
    expect(failure.sessionState).toBe('closed');
  });

  it('rejects advancing time or mounting state on paused/closed sessions', () => {
    const paused = pauseDeviceSession(openSession());
    if (!paused.ok) throw new Error('fixture pause');
    expectFailure(advanceVirtualTime(paused.value.session, 16), 'invalid-transition');
    expectFailure(
      mountRenderState(paused.value.session, { stateDigest: STATE_DIGEST }),
      'invalid-transition',
    );
    const closed = closeDeviceSession(openSession());
    if (!closed.ok) throw new Error('fixture close');
    expectFailure(advanceVirtualTime(closed.value.session, 16), 'invalid-transition');
    expectFailure(
      mountRenderState(closed.value.session, { stateDigest: STATE_DIGEST }),
      'invalid-transition',
    );
  });

  it('rejects non-positive, non-integer, and oversized deltas', () => {
    const session = openSession();
    expectFailure(advanceVirtualTime(session, 0), 'invalid-transition');
    expectFailure(advanceVirtualTime(session, -16), 'invalid-transition');
    expectFailure(advanceVirtualTime(session, 16.5), 'invalid-transition');
    expectFailure(advanceVirtualTime(session, 60_001), 'invalid-transition');
  });
});

describe('event-trace consistency rejections', () => {
  function openedEvent(sessionId = 'ds-alpha-1') {
    return {
      kind: 'session-opened' as const,
      sequence: 1,
      deviceSessionId: sessionId,
      tenantScope: SCOPE_A,
      device: DESKTOP_DEVICE,
      occurredAtMs: 0,
    };
  }

  it('rejects a trace with a sequence gap', () => {
    const sealed = sealRuntimeEventTrace({
      schema: 'epoch.experience-runtime.event-trace',
      protocolVersion: '1.0.0',
      deviceSessionId: 'ds-alpha-1',
      tenantScope: SCOPE_A,
      events: [openedEvent(), { ...openedEvent(), sequence: 3 }],
    });
    expectFailure(sealed, 'malformed-record');
  });

  it('rejects a trace mixing sessions', () => {
    const sealed = sealRuntimeEventTrace({
      schema: 'epoch.experience-runtime.event-trace',
      protocolVersion: '1.0.0',
      deviceSessionId: 'ds-alpha-1',
      tenantScope: SCOPE_A,
      events: [openedEvent(), openedEvent('ds-alpha-2')],
    });
    expectFailure(sealed, 'malformed-record');
  });

  it('rejects a trace that does not begin with session-opened', () => {
    const sealed = sealRuntimeEventTrace({
      schema: 'epoch.experience-runtime.event-trace',
      protocolVersion: '1.0.0',
      deviceSessionId: 'ds-alpha-1',
      tenantScope: SCOPE_A,
      events: [
        {
          kind: 'frame-started',
          sequence: 1,
          deviceSessionId: 'ds-alpha-1',
          frameIndex: 0,
          frameDurationMs: 16,
          atMs: 0,
        },
      ],
    });
    expectFailure(sealed, 'malformed-record');
  });

  it('rejects a lifecycle-illegal event order (paused then resumed twice)', () => {
    const paused = {
      kind: 'session-paused' as const,
      sequence: 2,
      deviceSessionId: 'ds-alpha-1',
      occurredAtMs: 0,
    };
    const resumed = { ...paused, kind: 'session-resumed' as const, sequence: 3 };
    const sealed = sealRuntimeEventTrace({
      schema: 'epoch.experience-runtime.event-trace',
      protocolVersion: '1.0.0',
      deviceSessionId: 'ds-alpha-1',
      tenantScope: SCOPE_A,
      events: [openedEvent(), paused, resumed, resumed],
    });
    expectFailure(sealed, 'malformed-record');
  });

  it('rejects a frame event on a paused session in the replayed lifecycle', () => {
    const paused = {
      kind: 'session-paused' as const,
      sequence: 2,
      deviceSessionId: 'ds-alpha-1',
      occurredAtMs: 0,
    };
    const frame = {
      kind: 'frame-started' as const,
      sequence: 3,
      deviceSessionId: 'ds-alpha-1',
      frameIndex: 0,
      frameDurationMs: 16,
      atMs: 16,
    };
    const sealed = sealRuntimeEventTrace({
      schema: 'epoch.experience-runtime.event-trace',
      protocolVersion: '1.0.0',
      deviceSessionId: 'ds-alpha-1',
      tenantScope: SCOPE_A,
      events: [openedEvent(), paused, frame],
    });
    expectFailure(sealed, 'malformed-record');
  });

  it('rejects a trace whose opened event carries a foreign tenant scope', () => {
    const sealed = sealRuntimeEventTrace({
      schema: 'epoch.experience-runtime.event-trace',
      protocolVersion: '1.0.0',
      deviceSessionId: 'ds-alpha-1',
      tenantScope: SCOPE_A,
      events: [{ ...openedEvent(), tenantScope: SCOPE_B }],
    });
    expectFailure(sealed, 'malformed-record');
  });
});
