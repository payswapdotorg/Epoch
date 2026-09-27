// W017 acceptance: the typed window model — closed lifecycle table,
// content-addressed records with provenance, tamper detection, and the
// deterministic W013 session-id derivation.
import { describe, expect, it } from 'vitest';
import {
  WINDOW_TRANSITIONS,
  applyWindowEvent,
  deviceSessionIdOf,
  isLegalWindowTransition,
  nextWindowState,
  parseWindowRecord,
  rendererSessionIdOf,
  sealWindowRecord,
  verifyWindowRecord,
} from '../src/index';
import { expectFailure } from './fixtures';

function fixtureRecord(state: 'opening' | 'open' = 'opening') {
  return sealWindowRecord({
    schema: 'epoch.desktop.window-record',
    schemaVersion: 1,
    windowId: 'win-alpha',
    sessionId: 'dss-alpha-1',
    title: 'Reference window',
    state,
    createdAtMs: 0,
    deviceSessionId: 'ds-alpha',
    rendererSessionId: 'rs-alpha',
    provenance: { origin: 'host-envelope', envelopeId: 'env-host-0002' },
  });
}

describe('the window lifecycle table', () => {
  it('admits the canonical open/focus/blur/close path', () => {
    expect(isLegalWindowTransition('opening', 'opened')).toBe(true);
    expect(nextWindowState('opened')).toBe('open');
    expect(isLegalWindowTransition('open', 'focused')).toBe(true);
    expect(nextWindowState('focused')).toBe('focused');
    expect(isLegalWindowTransition('focused', 'blurred')).toBe(true);
    expect(nextWindowState('blurred')).toBe('blurred');
    expect(isLegalWindowTransition('blurred', 'focused')).toBe(true);
    expect(isLegalWindowTransition('open', 'close-requested')).toBe(true);
    expect(isLegalWindowTransition('closing', 'closed')).toBe(true);
  });

  it('rejects illegal transitions (terminal closed, focus from opening/closing)', () => {
    expect(isLegalWindowTransition('closed', 'focused')).toBe(false);
    expect(isLegalWindowTransition('closed', 'opened')).toBe(false);
    expect(isLegalWindowTransition('opening', 'focused')).toBe(false);
    expect(isLegalWindowTransition('closing', 'focused')).toBe(false);
    expect(isLegalWindowTransition('closing', 'opened')).toBe(false);
    expect(WINDOW_TRANSITIONS.closed).toEqual([]);
  });
});

describe('window records', () => {
  it('are content-addressed: identical content produces the identical digest', () => {
    const a = fixtureRecord();
    const b = fixtureRecord();
    expect(a.digest).toBe(b.digest);
    expect(verifyWindowRecord(a)).toBe(true);
  });

  it('carry provenance (origin + originating envelope)', () => {
    const record = fixtureRecord();
    expect(record.provenance.origin).toBe('host-envelope');
    expect(record.provenance.envelopeId).toBe('env-host-0002');
  });

  it('apply events purely (new sealed records, input unchanged)', () => {
    const opening = fixtureRecord();
    const opened = applyWindowEvent(opening, 'opened', 5);
    expect(opened.ok).toBe(true);
    if (opened.ok) {
      expect(opened.value.state).toBe('open');
      expect(opening.state).toBe('opening'); // input unchanged
      expect(opened.value.digest).not.toBe(opening.digest);
    }
    const focused = applyWindowEvent(opened.ok ? opened.value : opening, 'focused', 6);
    expect(focused.ok).toBe(true);
    if (focused.ok) {
      expect(focused.value.state).toBe('focused');
      expect(focused.value.focusedAtMs).toBe(6);
    }
  });

  it('reject illegal event applications with the typed invalid-transition', () => {
    const opened = applyWindowEvent(fixtureRecord(), 'opened', 5);
    if (!opened.ok) {
      throw new Error(opened.error.message);
    }
    expectFailure(applyWindowEvent(opened.value, 'blurred', 6), 'invalid-transition');
    expectFailure(applyWindowEvent(fixtureRecord('open'), 'closed', 6), 'invalid-transition');
    // A closed window is terminal.
    const closing = applyWindowEvent(fixtureRecord('open'), 'close-requested', 6);
    if (!closing.ok) {
      throw new Error(closing.error.message);
    }
    const closed = applyWindowEvent(closing.value, 'closed', 7);
    if (!closed.ok) {
      throw new Error(closed.error.message);
    }
    expectFailure(applyWindowEvent(closed.value, 'focused', 8), 'invalid-transition');
    expectFailure(applyWindowEvent(closed.value, 'close-requested', 8), 'invalid-transition');
  });

  it('round-trip admission: seal -> JSON -> parse -> identical record', () => {
    const record = fixtureRecord('open');
    const parsed = parseWindowRecord(JSON.parse(JSON.stringify(record)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual(record);
    }
  });

  it('tamper detection: a mutated record fails the digest gate', () => {
    const record = fixtureRecord('open');
    const tampered = { ...record, title: 'Tampered title' };
    expectFailure(parseWindowRecord(tampered), 'digest-mismatch');
    expect(verifyWindowRecord(tampered)).toBe(false);
  });

  it('version gates fire before schema diagnostics', () => {
    expectFailure(parseWindowRecord({ ...fixtureRecord(), schemaVersion: 2 }), 'version-unsupported');
    expectFailure(parseWindowRecord({ ...fixtureRecord(), schema: 'other.schema' }), 'version-unsupported');
  });

  it('unknown (vendor) fields are rejected on window records', () => {
    const smuggled = { ...fixtureRecord(), toolkitHandle: 'anything' };
    expectFailure(parseWindowRecord(smuggled), 'malformed-record');
  });

  it('derives lawful W013 session ids deterministically from the window id', () => {
    expect(rendererSessionIdOf('win-alpha')).toBe('rs-alpha');
    expect(deviceSessionIdOf('win-alpha')).toBe('ds-alpha');
    expect(rendererSessionIdOf('win-scene-42')).toBe('rs-scene-42');
    expect(deviceSessionIdOf('win-scene-42')).toBe('ds-scene-42');
  });
});
