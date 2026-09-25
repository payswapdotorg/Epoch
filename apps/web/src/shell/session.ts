/**
 * @epoch/web shell session model (W014).
 *
 * Provider-neutral, in-memory REFERENCE identity — no real authentication.
 * The shapes mirror the @epoch/identity principal vocabulary (kinds,
 * lifecycle states, opaque principal ids) and the @epoch/authorization
 * principal-fact projection (status + authenticated), drift-pinned by
 * devDependency parity tests (`src/shell/parity.test.ts`). There is no
 * credential material, no token, no IdP, and no session store anywhere in
 * the shell: a session is caller-supplied typed data threaded through the
 * shell providers. Real authentication arrives through typed seams in a
 * later wave; vendors would be adapters behind them (lock rule 13).
 *
 * Navigation grants are SHELL-OWNED (the `ShellPermission` vocabulary):
 * identity owns principals, authorization owns decisions — the shell owns
 * which of its own surfaces a session may navigate to.
 */
import { shellOk, type ShellResult } from './errors';
import {
  PRINCIPAL_ID_PATTERN,
  PRINCIPAL_KINDS,
  PRINCIPAL_STATUSES,
  SESSION_ID_PATTERN,
  SESSION_STATES,
  SHELL_PERMISSIONS,
  SHELL_RECORD_VERSION,
  type PrincipalKind,
  type PrincipalStatus,
  type SessionState,
  type ShellPermission,
} from './version';

/** Opaque principal identity `principal:<slug>` (mirror of @epoch/identity). */
export type PrincipalId = string;

/** The shell's projection of the @epoch/authorization `PrincipalFact`. */
export interface SessionPrincipalFact {
  readonly principalId: PrincipalId;
  readonly status: PrincipalStatus;
  readonly authenticated: boolean;
}

/**
 * The reference session principal: the principal fact plus the shell-owned
 * navigation grants granted to this principal (sorted, deduplicated).
 */
export interface SessionPrincipal extends SessionPrincipalFact {
  readonly kind: PrincipalKind;
  readonly displayName: string;
  readonly grants: readonly ShellPermission[];
}

/** The session context value threaded through the shell providers (plain JSON). */
export interface SessionContextValue {
  readonly schemaVersion: typeof SHELL_RECORD_VERSION;
  readonly sessionId: string;
  readonly state: SessionState;
  /** Present exactly when the session is not anonymous. */
  readonly principal?: SessionPrincipal | undefined;
}

/** Normalize a grants list: deduplicated and sorted (deterministic). */
export function normalizeGrants(grants: readonly string[]): readonly ShellPermission[] {
  return [...new Set(grants)].sort() as readonly ShellPermission[];
}

/** Validate a session principal (total, typed). */
export function validateSessionPrincipal(input: unknown): ShellResult<SessionPrincipal> {
  const issues: { path: string; message: string }[] = [];
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'Session principal must be a plain object.',
        issues: [{ path: '', message: 'expected a plain object' }],
      },
    };
  }
  const record = input as Record<string, unknown>;
  if (typeof record.principalId !== 'string' || !PRINCIPAL_ID_PATTERN.test(record.principalId)) {
    issues.push({ path: 'principalId', message: 'expected an opaque principal id (principal:<slug>)' });
  }
  if (typeof record.kind !== 'string' || !PRINCIPAL_KINDS.includes(record.kind as PrincipalKind)) {
    issues.push({
      path: 'kind',
      message: `expected one of the principal kinds (${PRINCIPAL_KINDS.join(', ')})`,
    });
  }
  if (
    typeof record.status !== 'string' ||
    !PRINCIPAL_STATUSES.includes(record.status as PrincipalStatus)
  ) {
    issues.push({
      path: 'status',
      message: `expected one of the principal statuses (${PRINCIPAL_STATUSES.join(', ')})`,
    });
  }
  if (typeof record.authenticated !== 'boolean') {
    issues.push({ path: 'authenticated', message: 'expected a boolean' });
  }
  if (typeof record.displayName !== 'string' || record.displayName.trim().length === 0) {
    issues.push({ path: 'displayName', message: 'expected a non-empty display name' });
  }
  const grantsIssue = validateGrants(record.grants);
  if (grantsIssue !== undefined) {
    issues.push({ path: 'grants', message: grantsIssue });
  }
  if (issues.length > 0) {
    return {
      ok: false,
      error: { code: 'validation', message: 'Malformed session principal.', issues },
    };
  }
  const principal: SessionPrincipal = {
    principalId: record.principalId as PrincipalId,
    kind: record.kind as PrincipalKind,
    status: record.status as PrincipalStatus,
    authenticated: record.authenticated as boolean,
    displayName: record.displayName as string,
    grants: normalizeGrants((record.grants as readonly string[]) ?? []),
  };
  return shellOk(principal);
}

function validateGrants(input: unknown): string | undefined {
  if (input === undefined) {
    return 'expected an array of shell permissions (possibly empty)';
  }
  if (!Array.isArray(input)) {
    return 'expected an array of shell permissions';
  }
  for (const grant of input) {
    if (typeof grant !== 'string' || !SHELL_PERMISSIONS.includes(grant as ShellPermission)) {
      return `every grant must be a declared shell permission (${SHELL_PERMISSIONS.join(', ')})`;
    }
  }
  return undefined;
}

/** Validate a session context value (total, typed). */
export function validateSessionContext(input: unknown): ShellResult<SessionContextValue> {
  const issues: { path: string; message: string }[] = [];
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'Session context must be a plain object.',
        issues: [{ path: '', message: 'expected a plain object' }],
      },
    };
  }
  const record = input as Record<string, unknown>;
  if (record.schemaVersion !== SHELL_RECORD_VERSION) {
    issues.push({
      path: 'schemaVersion',
      message: `expected ${SHELL_RECORD_VERSION} (version skew is rejected before any other diagnostic)`,
    });
  }
  if (typeof record.sessionId !== 'string' || !SESSION_ID_PATTERN.test(record.sessionId)) {
    issues.push({ path: 'sessionId', message: 'expected an opaque session id (session:<slug>)' });
  }
  if (
    typeof record.state !== 'string' ||
    !SESSION_STATES.includes(record.state as SessionState)
  ) {
    issues.push({
      path: 'state',
      message: `expected one of the session states (${SESSION_STATES.join(', ')})`,
    });
  }
  if (record.state === 'anonymous') {
    if (record.principal !== undefined) {
      issues.push({ path: 'principal', message: 'must be absent when the session is anonymous' });
    }
  } else if (record.principal === undefined) {
    issues.push({ path: 'principal', message: 'must be present when the session is not anonymous' });
  } else {
    const principal = validateSessionPrincipal(record.principal);
    if (!principal.ok && principal.error.code === 'validation') {
      for (const issue of principal.error.issues) {
        issues.push({ path: `principal.${issue.path}`, message: issue.message });
      }
    }
  }
  if (issues.length > 0) {
    return {
      ok: false,
      error: { code: 'validation', message: 'Malformed session context.', issues },
    };
  }
  const state = record.state as SessionState;
  let principal: SessionPrincipal | undefined;
  if (state !== 'anonymous') {
    const validated = validateSessionPrincipal(record.principal);
    // Non-null by construction: principal validation reported no issues above.
    principal = validated.ok ? validated.value : undefined;
  }
  const value: SessionContextValue = {
    schemaVersion: SHELL_RECORD_VERSION as typeof SHELL_RECORD_VERSION,
    sessionId: record.sessionId as string,
    state,
    principal,
  };
  return shellOk(value);
}

/**
 * The anonymous reference session (no principal; navigation targets that
 * require permissions are fail-closed denied).
 */
export function anonymousSession(sessionId = 'session:anonymous'): SessionContextValue {
  return {
    schemaVersion: SHELL_RECORD_VERSION,
    sessionId,
    state: 'anonymous',
  };
}

/** Whether the session may act (an active, authenticated, non-suspended principal). */
export function isActiveSession(session: SessionContextValue): boolean {
  return (
    session.state === 'active' &&
    session.principal !== undefined &&
    session.principal.authenticated &&
    session.principal.status === 'active'
  );
}
