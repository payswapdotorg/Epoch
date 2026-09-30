'use client';
/**
 * @epoch/web — the session provider (W047).
 *
 * The client session lifecycle: sign-in (identity boundary -> gateway
 * session.issue), persistence of the session REFERENCE in localStorage (a
 * reference only — session state authority is @epoch/authentication's),
 * reload revalidation (session.validate through the gateway: reload always
 * resolves AUTHORITATIVE state), expiry detection with the re-authenticate
 * recovery surface, and sign-out (session.revoke).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { callGateway } from './transport';
import { envelope, correlationId, idempotencyKey } from './envelopes';
import type { ProductConfiguration, ProductSession, UiGatewayError } from '../product/types';

const SESSION_STORAGE_KEY = 'epoch.web.session.v1';

/** The fixture-domain tenants (public deployment topology). */
const DOMAIN_TENANTS: Readonly<Record<ProductSession['domain'], string>> = {
  construction: 'tenant:nordstrand',
  software: 'tenant:lightspeed',
};

/** The session lifecycle states the UI renders. */
export type SessionLifecycle =
  | 'bootstrapping'
  | 'signed-out'
  | 'signing-in'
  | 'active'
  | 'expired';

/** The session context value. */
export interface SessionContextValue {
  readonly lifecycle: SessionLifecycle;
  readonly session: ProductSession | null;
  readonly configuration: ProductConfiguration | null;
  readonly error: UiGatewayError | null;
  signIn(input: {
    readonly domain: ProductConfiguration['domain'];
    readonly principalId: string;
    readonly ttlMs: number;
  }): Promise<void>;
  resumeSession(sessionId: string, domain: ProductConfiguration['domain']): Promise<void>;
  signOut(): Promise<void>;
  revalidate(): Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function readStoredSession(): ProductSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw === null) return null;
    return JSON.parse(raw) as ProductSession;
  } catch {
    return null;
  }
}

function storeSession(session: ProductSession | null): void {
  if (typeof window === 'undefined') return;
  if (session === null) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

async function fetchConfiguration(session: ProductSession): Promise<ProductConfiguration | null> {
  const response = await fetch('/api/product/bootstrap', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ domain: session.domain, sessionId: session.sessionId }),
    cache: 'no-store',
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { ok: boolean; configuration?: ProductConfiguration };
  return body.ok ? (body.configuration ?? null) : null;
}

/** The session provider (client). Establishes authoritative session state. */
export function SessionProvider({ children }: { readonly children: ReactNode }): ReactNode {
  const [lifecycle, setLifecycle] = useState<SessionLifecycle>('bootstrapping');
  const [session, setSession] = useState<ProductSession | null>(null);
  const [configuration, setConfiguration] = useState<ProductConfiguration | null>(null);
  const [error, setError] = useState<UiGatewayError | null>(null);

  const applySession = useCallback((next: ProductSession) => {
    setSession(next);
    storeSession(next);
    setLifecycle('active');
  }, []);

  const loadConfiguration = useCallback(async (active: ProductSession) => {
    const config = await fetchConfiguration(active);
    setConfiguration(config);
  }, []);

  // Boot: reload resolves AUTHORITATIVE state (session.validate).
  // A network failure is NOT an authoritative verdict: only the gateway's
  // typed answers decide (auth-session-expired / a non-active session
  // state => expired; a typed non-transient rejection => the reference is
  // unusable). An unreachable authority leaves the session state UNKNOWN —
  // the revalidation retries, and the surface stays on the resolving state
  // (never a fabricated 'expired' the authority never issued).
  useEffect(() => {
    const stored = readStoredSession();
    if (stored === null) {
      setLifecycle('signed-out');
      return;
    }
    let cancelled = false;
    const discard = (lifecycle: 'expired' | 'signed-out'): void => {
      storeSession(null);
      setSession(null);
      setConfiguration(null);
      setLifecycle(lifecycle);
    };
    const attempt = async (retriesLeft: number): Promise<void> => {
      const result = await callGateway(
        envelope('session.validate', stored, {}, { correlation: correlationId('session-reload') }),
      );
      if (cancelled) return;
      if (result.ok) {
        const validated = result.value.result as { sessionId: string; state: string };
        if (validated.state === 'active') {
          applySession(stored);
          await loadConfiguration(stored);
          return;
        }
        // The authority answered: the session is not active (expired or
        // revoked) — its verdict stands.
        discard('expired');
        return;
      }
      if (result.error.class === 'auth-session-expired') {
        // The authority's typed expiry verdict (session-expired /
        // session-revoked) — re-authentication is the recovery.
        discard('expired');
        return;
      }
      if (result.error.class === 'transient') {
        // Unreachable authority: UNKNOWN, not expired. Retry (paced; the
        // transport already retried per-call). Exhausted retries leave the
        // resolving state — the next navigation re-attempts.
        if (retriesLeft > 0) {
          setTimeout(() => void attempt(retriesLeft - 1), 1_000);
        }
        return;
      }
      // A typed non-transient rejection: the stored reference is unusable.
      discard('signed-out');
    };
    void attempt(10);
    return () => {
      cancelled = true;
    };
  }, [applySession, loadConfiguration]);

  const signIn = useCallback(
    async (input: { readonly domain: ProductConfiguration['domain']; readonly principalId: string; readonly ttlMs: number }) => {
      setLifecycle('signing-in');
      setError(null);
      // 1. The identity boundary: verified authentication result.
      const authResponse = await fetch('/api/product/authenticate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ domain: input.domain, principalId: input.principalId }),
        cache: 'no-store',
      });
      const authBody = (await authResponse.json()) as {
        ok: boolean;
        tenantId?: string;
        authentication?: { resultId: string; resultDigest: string; principalId: string; outcome: string };
        error?: string;
      };
      if (!authBody.ok || authBody.authentication === undefined || authBody.tenantId === undefined) {
        setError({
          schemaVersion: 1,
          class: 'validation',
          code: 'sign-in-failed',
          message: authBody.error ?? 'sign-in failed',
          operation: 'session.issue',
          correlationId: 'corr:unattributed',
        });
        setLifecycle('signed-out');
        return;
      }
      // 2. The gateway session (envelope through the frozen vocabulary).
      const result = await callGateway(
        envelope(
          'session.issue',
          { sessionId: 'session:bootstrap', tenantId: authBody.tenantId },
          {
            authentication: authBody.authentication,
            principalId: input.principalId,
            tenantId: authBody.tenantId,
            ttlMs: input.ttlMs,
            nonce: `nonce-${idempotencyKey('nonce').replace('idem:', '')}`,
          },
        ),
      );
      if (!result.ok) {
        setError(result.error);
        setLifecycle('signed-out');
        return;
      }
      const issued = result.value.result as {
        sessionId: string;
        principalId: string;
        tenantId: string;
        issuedAt: string;
        expiresAt: string;
      };
      const next: ProductSession = {
        sessionId: issued.sessionId,
        principalId: issued.principalId,
        tenantId: issued.tenantId,
        domain: input.domain,
        issuedAt: issued.issuedAt,
        expiresAt: issued.expiresAt,
      };
      applySession(next);
      await loadConfiguration(next);
    },
    [applySession, loadConfiguration],
  );

  const resumeSession = useCallback(
    async (sessionId: string, domain: ProductSession['domain']) => {
      setLifecycle('signing-in');
      setError(null);
      // Cross-device handoff: the second device resumes the SAME session
      // reference through the tenant of the handoff domain (the session
      // scope is validated by the authority — nothing is minted locally).
      const tenantId = DOMAIN_TENANTS[domain];
      const probe: ProductSession = {
        sessionId,
        principalId: 'principal:handoff',
        tenantId,
        domain,
        issuedAt: '',
        expiresAt: '',
      };
      const result = await callGateway(
        envelope('session.validate', probe, {}, { correlation: correlationId('session-resume') }),
      );
      if (!result.ok) {
        setError(result.error);
        const stored = readStoredSession();
        setLifecycle(stored === null ? 'signed-out' : 'active');
        return;
      }
      const validated = result.value.result as {
        sessionId: string;
        principalId: string;
        tenantId: string;
        issuedAt: string;
        expiresAt: string;
        state: string;
      };
      if (validated.state !== 'active' || validated.tenantId !== tenantId) {
        storeSession(null);
        setSession(null);
        setLifecycle('expired');
        return;
      }
      const next: ProductSession = {
        sessionId: validated.sessionId,
        principalId: validated.principalId,
        tenantId: validated.tenantId,
        domain,
        issuedAt: validated.issuedAt,
        expiresAt: validated.expiresAt,
      };
      applySession(next);
      await loadConfiguration(next);
    },
    [applySession, loadConfiguration],
  );

  const signOut = useCallback(async () => {
    const current = session ?? readStoredSession();
    if (current !== null) {
      await callGateway(
        envelope('session.revoke', current, { sessionId: current.sessionId }),
      );
    }
    storeSession(null);
    setSession(null);
    setConfiguration(null);
    setLifecycle('signed-out');
  }, [session]);

  const revalidate = useCallback(async () => {
    const current = session ?? readStoredSession();
    if (current === null) {
      setLifecycle('signed-out');
      return;
    }
    const result = await callGateway(
      envelope('session.validate', current, {}, { correlation: correlationId('session-revalidate') }),
    );
    if (result.ok && (result.value.result as { state: string }).state === 'active') {
      return;
    }
    if (!result.ok && result.error.class === 'transient') {
      // Unreachable authority: no verdict — the lifecycle stays as-is (the
      // triggering operation's own typed error already surfaced).
      return;
    }
    storeSession(null);
    setSession(null);
    setConfiguration(null);
    setLifecycle('expired');
  }, [session]);

  const value = useMemo<SessionContextValue>(
    () => ({
      lifecycle,
      session,
      configuration,
      error,
      signIn,
      resumeSession,
      signOut,
      revalidate,
    }),
    [lifecycle, session, configuration, error, signIn, resumeSession, signOut, revalidate],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** The session context hook (fails loudly outside the provider). */
export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) throw new Error('useSession requires the SessionProvider');
  return value;
}
