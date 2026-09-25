// Positive battery: session lifecycle round-trips, virtual-time advance,
// state mounting, seal/verify round-trips, and total admission of
// serialized records and traces.
import { describe, expect, it } from 'vitest';
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
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
  sealDeviceSession,
  serializeDeviceSessionRecord,
  serializeRuntimeEventTrace,
  validateFrameSchedule,
  computeDeviceSessionDigest,
  type RuntimeEventTrace,
} from '../src/index';
import {
  DESKTOP_DEVICE,
  SCHEDULE_30_EVERY_2,
  SCHEDULE_60,
  SCOPE_A,
  SCOPE_B,
  TENANT_A,
  openSession,
} from './fixtures';

const STATE_DIGEST = 'a'.repeat(64);

describe('device-session lifecycle (positive)', () => {
  it('opens an active, sealed, scheduled session and emits session-opened', () => {
    const opened = openDeviceSession({
      deviceSessionId: 'ds-alpha-1',
      tenantScope: SCOPE_A,
      device: DESKTOP_DEVICE,
      schedule: SCHEDULE_60,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const { session, events } = opened.value;
    expect(session.state).toBe('active');
    expect(session.virtualTimeMs).toBe(0);
    expect(session.frameIndex).toBe(0);
    expect(session.tickIndex).toBe(0);
    expect(session.eventSequence).toBe(1);
    expect(session.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'session-opened',
      sequence: 1,
      deviceSessionId: 'ds-alpha-1',
      occurredAtMs: 0,
    });
  });

  it('pause -> resume -> close transitions emit ordered lifecycle events', () => {
    const opened = openSession();
    const paused = pauseDeviceSession(opened);
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    expect(paused.value.session.state).toBe('paused');
    expect(paused.value.events[0]).toMatchObject({ kind: 'session-paused', sequence: 2 });

    const resumed = resumeDeviceSession(paused.value.session);
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.value.session.state).toBe('active');
    expect(resumed.value.events[0]).toMatchObject({ kind: 'session-resumed', sequence: 3 });

    const closed = closeDeviceSession(resumed.value.session);
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.value.session.state).toBe('closed');
    expect(closed.value.events[0]).toMatchObject({ kind: 'session-closed', sequence: 4 });
    expect(closed.value.session.eventSequence).toBe(4);
  });

  it('advancing virtual time emits frame and tick events in deterministic order', () => {
    const session = openSession({ schedule: SCHEDULE_30_EVERY_2 });
    const advanced = advanceVirtualTime(session, 100);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    const { session: next, events } = advanced.value;
    // 33ms frames: starts at 0, 33, 66, 99 fall in [0, 100).
    const kinds = events.map((event) => event.kind);
    // Frame 0 and frame 2 are tick boundaries (cadence 2); ticks follow
    // their frame-started events.
    expect(kinds).toEqual([
      'frame-started',
      'tick-advanced',
      'frame-started',
      'frame-started',
      'tick-advanced',
      'frame-started',
    ]);
    expect(events[0]).toMatchObject({ kind: 'frame-started', frameIndex: 0, atMs: 0 });
    expect(events[1]).toMatchObject({ kind: 'tick-advanced', tickIndex: 0, frameIndex: 0 });
    expect(events[5]).toMatchObject({ kind: 'frame-started', frameIndex: 3, atMs: 99 });
    expect(next.virtualTimeMs).toBe(100);
    // 100 / 33 = frame 3 contains time 100; tick 3//2 = 1.
    expect(next.frameIndex).toBe(3);
    expect(next.tickIndex).toBe(1);
    expect(next.eventSequence).toBe(1 + events.length);
  });

  it('an unscheduled session advances time without frame events', () => {
    const session = openSession({ schedule: undefined });
    const advanced = advanceVirtualTime(session, 50);
    expect(advanced.ok).toBe(true);
    if (!advanced.ok) return;
    expect(advanced.value.events).toHaveLength(0);
    expect(advanced.value.session.virtualTimeMs).toBe(50);
    expect(advanced.value.session.frameIndex).toBe(0);
    expect(advanced.value.session.eventSequence).toBe(1);
  });

  it('mounts render state on an active session and records the digest', () => {
    const session = openSession();
    const mounted = mountRenderState(session, { stateDigest: STATE_DIGEST });
    expect(mounted.ok).toBe(true);
    if (!mounted.ok) return;
    expect(mounted.value.session.mountedStateDigest).toBe(STATE_DIGEST);
    expect(mounted.value.session.mountedAtMs).toBe(0);
    expect(mounted.value.events[0]).toMatchObject({
      kind: 'state-mounted',
      sequence: 2,
      stateDigest: STATE_DIGEST,
      atMs: 0,
    });
  });
});

describe('seal / verify / parse round-trips (positive)', () => {
  it('sealDeviceSession digests the canonical content and parse admits the record', () => {
    const session = openSession({ schedule: SCHEDULE_60 });
    const serialized = serializeDeviceSessionRecord(session);
    const parsed = parseDeviceSessionRecord(JSON.parse(serialized));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(serializeDeviceSessionRecord(parsed.value)).toBe(serialized);
    expect(parsed.value.digest).toBe(session.digest);
  });

  it('the record digest equals the canonical SHA-256 of the content', () => {
    const session = openSession();
    const { digest, ...content } = session;
    expect(computeDeviceSessionDigest(content)).toBe(digest);
    expect(digest).toBe(canonicalDigest(content as unknown as JsonValue));
  });

  it('sealDeviceSession admits valid content and rejects tampered digests', () => {
    const session = openSession();
    const { digest: _stripped, ...content } = session;
    void _stripped;
    const sealed = sealDeviceSession(content);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    expect(sealed.value.digest).toBe(session.digest);

    const tampered = parseDeviceSessionRecord({ ...session, digest: 'f'.repeat(64) });
    expect(tampered.ok).toBe(false);
  });

  it('seals a full event trace and parse admits it with the tenant gate', () => {
    const opened = openDeviceSession({
      deviceSessionId: 'ds-beta-1',
      tenantScope: SCOPE_B,
      device: DESKTOP_DEVICE,
      schedule: SCHEDULE_60,
    });
    if (!opened.ok) return;
    const advanced = advanceVirtualTime(opened.value.session, 20);
    if (!advanced.ok) return;
    const events = [...opened.value.events, ...advanced.value.events];
    const trace = sealRuntimeEventTrace({
      schema: 'epoch.experience-runtime.event-trace',
      protocolVersion: '1.0.0',
      deviceSessionId: 'ds-beta-1',
      tenantScope: SCOPE_B,
      events,
    });
    expect(trace.ok).toBe(true);
    if (!trace.ok) return;
    const serialized = serializeRuntimeEventTrace(trace.value);
    const parsed = parseRuntimeEventTrace(JSON.parse(serialized), {
      expectedTenantId: 'tenant-beta',
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(serializeRuntimeEventTrace(parsed.value as RuntimeEventTrace)).toBe(serialized);
    // Sequences stayed contiguous through the whole history.
    expect(parsed.value.events.map((event) => event.sequence)).toEqual(
      events.map((_, index) => index + 1),
    );
  });

  it('validateFrameSchedule admits a canonical schedule', () => {
    const validated = validateFrameSchedule(SCHEDULE_30_EVERY_2);
    expect(validated.ok).toBe(true);
  });

  it('admission honors the expected tenant gate on the owning tenant', () => {
    const session = openSession();
    const parsed = parseDeviceSessionRecord(session, { expectedTenantId: TENANT_A });
    expect(parsed.ok).toBe(true);
  });
});
