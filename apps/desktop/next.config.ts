import type { NextConfig } from 'next';

// W048: the desktop frontend is a STATIC EXPORT. `next build` emits the
// pre-rendered site into `out/` (distDir itself stays at the default
// `.next/` for build intermediates), and the Tauri webview loads exactly
// that directory — src-tauri's window URL and the bundler `frontendDist`
// point at `apps/desktop/out`. There is NO Next server at runtime: the
// whole product composes client-side in the webview (the product root is
// built in a mount effect, never during prerender).
//
// Local development runs the Next dev server on port 4310 (`pnpm dev` in
// apps/desktop; the Tauri dev profile points the webview at it).
//
// ESLint and typechecking run as dedicated repo tasks (`pnpm lint`,
// `pnpm typecheck`), so `next build` skips its own lint pass to keep the
// standardized entrypoints single-sourced; typedRoutes stay off because
// the export carries a single static route.
const nextConfig: NextConfig = {
  output: 'export' as const,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typedRoutes: false,
};

export default nextConfig;
