// W014 shell session model: provider-neutral reference identity.
import { describe, expect, it } from 'vitest';
import {
  anonymousSession,
  isActiveSession,
  normalizeGrants,
  validateSessionContext,
  validateSessionPrincipal,
} from './session';
import type { SessionContextValue, SessionPrincipal } from './session';
import { SHELL_RECORD_VERSION } from './version';

const principal: SessionPrincipal = {
  principalId: 'principal:ada',
  kind: 'human',
  status: 'active',
  authenticated: true,
  displayName: 'Ada',
  grants: ['navigator:read'],
};

const activeSession: SessionContextValue = {
  schemaVersion: SHELL_RECORD_VERSION,
  sessionId: 'session:s1',
  state: 'active',
  principal,
};

describe('shell session model', () => {
  it('validates a well-formed active session (positive)', () => {
    const result = validateSessionContext(activeSession);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.principal?.principalId).toBe('principal:ada');
      expect(result.value.principal?.grants).toEqual(['navigator:read']);
    }
  });

  it('normalizes grants deterministically (dedupe + sort)', () => {
    expect(normalizeGrants(['navigator:read', 'navigator:read'])).toEqual(['navigator:read']);
    expect(normalizeGrants([])).toEqual([]);
  });

  it('rejects malformed principals with typed validation errors (negative)', () => {
    const cases: readonly unknown[] = [
      'principal:ada',
      null,
      { ...principal, principalId: 'ada' }, // missing kind prefix
      { ...principal, kind: 'robot' }, // unknown principal kind
      { ...principal, status: 'paused' }, // unknown status
      { ...principal, authenticated: 'yes' }, // not a boolean
      { ...principal, grants: ['admin:all'] }, // undeclared shell permission
      { ...principal, grants: 'navigator:read' }, // not an array
    ];
    for (const input of cases) {
      const result = validateSessionPrincipal(input);
      expect(result.ok, `expected rejection for ${JSON.stringify(input)}`).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('validation');
      }
    }
  });

  it('rejects malformed session contexts with typed validation errors (negative)', () => {
    const cases: readonly unknown[] = [
      { schemaVersion: 2, sessionId: 'session:s1', state: 'active', principal }, // version skew
      { schemaVersion: 1, sessionId: 's1', state: 'active', principal }, // bad session id
      { schemaVersion: 1, sessionId: 'session:s1', state: 'live', principal }, // unknown state
      { schemaVersion: 1, sessionId: 'session:s1', state: 'active' }, // principal missing
      { schemaVersion: 1, sessionId: 'session:s1', state: 'anonymous', principal }, // principal present on anonymous
    ];
    for (const input of cases) {
      const result = validateSessionContext(input);
      expect(result.ok, `expected rejection for ${JSON.stringify(input)}`).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('validation');
      }
    }
  });

  it('the anonymous reference session is well-formed and inactive for gating', () => {
    const anon = anonymousSession();
    expect(validateSessionContext(anon).ok).toBe(true);
    expect(isActiveSession(anon)).toBe(false);
    expect(isActiveSession(activeSession)).toBe(true);
    // A suspended principal is not an active session (fail-closed).
    expect(
      isActiveSession({
        ...activeSession,
        principal: { ...principal, status: 'suspended' },
      }),
    ).toBe(false);
    // An expired session is not active either.
    expect(isActiveSession({ ...activeSession, state: 'expired' })).toBe(false);
  });
});
