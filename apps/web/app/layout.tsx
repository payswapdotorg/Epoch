import type { ReactNode } from 'react';
// Direct module import (Next.js client-boundary discipline): the providers
// module carries the 'use client' directive.
import { ShellProviders } from '../src/shell/providers';
// Server-side frame + reference assembly (in-memory reference identity).
import { AppFrame } from '../src/shell/frame';
import { referenceShell } from '../src/shell/bootstrap';

export const metadata = {
  title: 'Epoch',
  description:
    'Epoch web app shell — the composition layer that hosts synchronized projections of the universal engineering lifecycle.',
};

/**
 * The root layout: composes the shell providers (tenant + session context,
 * established at the shell boundary) and the app frame (header / navigation
 * / content / status regions). Route content renders inside the frame's
 * content region.
 */
export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ShellProviders tenant={referenceShell.tenant} session={referenceShell.session}>
          <AppFrame
            routes={referenceShell.routes}
            mounts={referenceShell.mounts}
            features={referenceShell.features}
            tenant={referenceShell.tenant}
            session={referenceShell.session}
          >
            {children}
          </AppFrame>
        </ShellProviders>
      </body>
    </html>
  );
}
