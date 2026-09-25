// Deterministic serialization: identical inputs serialize identically
// (sorted iteration, canonical JSON), key-order permutations of the same
// content produce identical digests, two sessions fed identical schedules
// produce identical event traces, and the emission of the published
// in-package contract artifacts is deterministic. The negative halves
// (drifted indices, unordered traces) live in session.negative.test.ts.
import { describe, expect, it } from 'vitest';
import {
  canonicalDigest,
  canonicalJsonStringify,
  type JsonValue,
} from '@epoch/agent-protocol';
import {
  advanceVirtualTime,
  mountRenderState,
  openDeviceSession,
  pauseDeviceSession,
  renderExperienceRuntimeContractFiles,
  resumeDeviceSession,
  sealRuntimeEventTrace,
  serializeDeviceSessionRecord,
  serializeRuntimeEventTrace,
  closeDeviceSession,
  type RuntimeEventTrace,
} from '../src/index';
import { DESKTOP_DEVICE, SCHEDULE_60, SCOPE_A } from './fixtures';

/** Recursively shuffles object key order (deterministic permutation). */
function permuteKeys(value: JsonValue, flip: boolean): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => permuteKeys(item, !flip));
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => [k, permuteKeys(v, !flip)] as const);
    const ordered = flip ? [...entries].reverse() : entries;
    return Object.fromEntries(ordered);
  }
  return value;
}

/** Run an identical fixture script against a fresh session. */
function runScript(): { trace: RuntimeEventTrace; sessionSerialized: string } {
  const opened = openDeviceSession({
    deviceSessionId: 'ds-det-1',
    tenantScope: SCOPE_A,
    device: DESKTOP_DEVICE,
    schedule: SCHEDULE_60,
  });
  if (!opened.ok) throw new Error('fixture open');
  const events = [...opened.value.events];
  let session = opened.value.session;

  const advanced = advanceVirtualTime(session, 50);
  if (!advanced.ok) throw new Error('fixture advance');
  events.push(...advanced.value.events);
  session = advanced.value.session;

  const mounted = mountRenderState(session, { stateDigest: 'b'.repeat(64) });
  if (!mounted.ok) throw new Error('fixture mount');
  events.push(...mounted.value.events);
  session = mounted.value.session;

  const paused = pauseDeviceSession(session);
  if (!paused.ok) throw new Error('fixture pause');
  events.push(...paused.value.events);
  session = paused.value.session;

  const resumed = resumeDeviceSession(session);
  if (!resumed.ok) throw new Error('fixture resume');
  events.push(...resumed.value.events);
  session = resumed.value.session;

  const advancedAgain = advanceVirtualTime(session, 20);
  if (!advancedAgain.ok) throw new Error('fixture advance 2');
  events.push(...advancedAgain.value.events);
  session = advancedAgain.value.session;

  const closed = closeDeviceSession(session);
  if (!closed.ok) throw new Error('fixture close');
  events.push(...closed.value.events);
  session = closed.value.session;

  const trace = sealRuntimeEventTrace({
    schema: 'epoch.experience-runtime.event-trace',
    protocolVersion: '1.0.0',
    deviceSessionId: 'ds-det-1',
    tenantScope: SCOPE_A,
    events,
  });
  if (!trace.ok) throw new Error('fixture trace');
  return {
    trace: trace.value,
    sessionSerialized: serializeDeviceSessionRecord(session),
  };
}

describe('deterministic serialization (positive)', () => {
  it('two sessions fed identical schedules produce identical event traces', () => {
    const first = runScript();
    const second = runScript();
    expect(serializeRuntimeEventTrace(second.trace)).toBe(serializeRuntimeEventTrace(first.trace));
    expect(second.trace.digest).toBe(first.trace.digest);
    expect(second.sessionSerialized).toBe(first.sessionSerialized);
  });

  it('key-order permutations produce identical canonical forms and digests', () => {
    const first = runScript();
    const permutedTrace = permuteKeys(
      JSON.parse(JSON.stringify({ ...first.trace, digest: undefined })) as JsonValue,
      true,
    );
    const resealed = sealRuntimeEventTrace(permutedTrace);
    expect(resealed.ok).toBe(true);
    if (!resealed.ok) return;
    expect(serializeRuntimeEventTrace(resealed.value)).toBe(
      serializeRuntimeEventTrace(first.trace),
    );
    expect(resealed.value.digest).toBe(first.trace.digest);
  });

  it('the canonical form is sorted-key JSON (spot check)', () => {
    const { trace } = runScript();
    const serialized = serializeRuntimeEventTrace(trace);
    // The canonical form starts with the alphabetically-first key.
    expect(serialized.startsWith('{"deviceSessionId":')).toBe(true);
    expect(canonicalJsonStringify(JSON.parse(serialized) as JsonValue)).toBe(serialized);
  });

  it('trace digests are the canonical SHA-256 of the content', () => {
    const { trace } = runScript();
    const { digest: claimed, ...content } = trace;
    expect(canonicalDigest(content as unknown as JsonValue)).toBe(claimed);
  });

  it('contract emission is deterministic (two renders are byte-identical)', () => {
    expect(renderExperienceRuntimeContractFiles()).toEqual(
      renderExperienceRuntimeContractFiles(),
    );
  });
});
