import type { CSSProperties, ReactNode } from 'react';

/**
 * The Epoch Desktop root layout (W048).
 *
 * The whole desktop product runs inside the Tauri webview as a static
 * export: the layout only establishes the document shell (English locale,
 * the dark slate desktop surface) — every product surface composes
 * client-side from `app/page.tsx`.
 */
export const metadata = {
  title: 'Epoch Desktop',
  description:
    'Epoch Desktop — the native desktop product over the frozen Application Gateway vocabulary (embedded fixture-backed binding, typed IPC bridge, offline queue and cross-device handoff).',
};

const bodyStyle: CSSProperties = {
  margin: 0,
  background: '#15181d',
  color: '#ececec',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontSize: '14px',
  lineHeight: 1.5,
  WebkitFontSmoothing: 'antialiased',
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body style={bodyStyle}>{children}</body>
    </html>
  );
}
