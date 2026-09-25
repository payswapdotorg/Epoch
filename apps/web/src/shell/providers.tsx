'use client';

/**
 * @epoch/web shell providers (W014).
 *
 * Tenant and session context providers — the typed seam that threads the
 * shell-boundary context to every hosted surface. The values are plain
 * serialization-friendly JSON (they cross the App Router server/client
 * boundary); the identity behind them is the provider-neutral, in-memory
 * REFERENCE identity (`src/shell/bootstrap.ts`) — no real authentication,
 * no vendor SDK, no session store.
 *
 * The provider module is the shell's only client component surface: the
 * frame itself stays server-rendered (client state minimal and typed).
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { SessionContextValue } from './session';
import type { TenantContextValue } from './tenancy';

/** Typed error thrown when a hosted surface reads the tenant context outside its provider. */
export class MissingTenantContextError extends Error {
  readonly code = 'missing-tenant-context' as const;

  constructor() {
    super(
      'useTenantContext() requires a mounted <TenantProvider> (the shell establishes tenant context at its boundary).',
    );
    this.name = 'MissingTenantContextError';
  }
}

/** Typed error thrown when a hosted surface reads the session context outside its provider. */
export class MissingSessionContextError extends Error {
  readonly code = 'missing-session-context' as const;

  constructor() {
    super(
      'useSessionContext() requires a mounted <SessionProvider> (the shell establishes session context at its boundary).',
    );
    this.name = 'MissingSessionContextError';
  }
}

const TenantContext = createContext<TenantContextValue | null>(null);
const SessionContext = createContext<SessionContextValue | null>(null);

/** Provides the tenant context to hosted surfaces. */
export function TenantProvider({
  value,
  children,
}: {
  readonly value: TenantContextValue;
  readonly children: ReactNode;
}): ReactNode {
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

/** Provides the session context to hosted surfaces. */
export function SessionProvider({
  value,
  children,
}: {
  readonly value: SessionContextValue;
  readonly children: ReactNode;
}): ReactNode {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Read the tenant context (typed error outside the provider). */
export function useTenantContext(): TenantContextValue {
  const value = useContext(TenantContext);
  if (value === null) {
    throw new MissingTenantContextError();
  }
  return value;
}

/** Read the session context (typed error outside the provider). */
export function useSessionContext(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new MissingSessionContextError();
  }
  return value;
}

/** The composed shell providers: tenant + session in canonical order. */
export function ShellProviders({
  tenant,
  session,
  children,
}: {
  readonly tenant: TenantContextValue;
  readonly session: SessionContextValue;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <TenantProvider value={tenant}>
      <SessionProvider value={session}>{children}</SessionProvider>
    </TenantProvider>
  );
}
