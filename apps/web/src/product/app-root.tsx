'use client';
/**
 * @epoch/web — the app root (W047).
 *
 * The client composition of the product: the session provider (authoritative
 * session lifecycle) and the product shell (frame + navigator + status).
 * Route content renders inside the shell's content region.
 */
import type { ReactNode } from 'react';
import { SessionProvider, useSession } from '../client/session';
import { OfflineQueueProvider } from '../client/offline';
import { ProductShell } from './shell';
import { EntrySurface } from './entry';
import { Loading } from './ui';

function GatedShell({ children }: { readonly children: ReactNode }): ReactNode {
  const { lifecycle } = useSession();
  if (lifecycle === 'bootstrapping') {
    return (
      <ProductShell>
        <Loading label="Resolving authoritative session state…" />
      </ProductShell>
    );
  }
  return <ProductShell>{children}</ProductShell>;
}

/** The app root: providers + shell. Entry gating happens per-route. */
export function AppRoot({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <SessionProvider>
      <OfflineQueueProvider>
        <GatedShell>{children}</GatedShell>
      </OfflineQueueProvider>
    </SessionProvider>
  );
}

/** The entry gate: renders the entry surface when signed out/expired,
 * and the loading state while the bootstrap configuration resolves. */
export function EntryGate({ children }: { readonly children: ReactNode }): ReactNode {
  const { lifecycle, configuration } = useSession();
  if (lifecycle === 'signed-out' || lifecycle === 'expired' || lifecycle === 'signing-in') {
    return <EntrySurface />;
  }
  if (configuration === null) {
    return <Loading label="Resolving the product configuration…" />;
  }
  return <>{children}</>;
}
