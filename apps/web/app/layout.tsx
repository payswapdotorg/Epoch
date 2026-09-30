import type { ReactNode } from 'react';
import './globals.css';
import { AppRoot } from '../src/product/app-root';

export const metadata = {
  title: 'Epoch',
  description:
    'Epoch — the canonical web product: the universal engineering lifecycle as one synchronized projection. Every action flows through the Action Gateway.',
};

/**
 * The root layout: the product app root (session provider + shell frame).
 * Route content renders inside the shell's content region.
 */
export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppRoot>{children}</AppRoot>
      </body>
    </html>
  );
}
