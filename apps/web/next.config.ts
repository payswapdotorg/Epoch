import type { NextConfig } from 'next';

// W001: minimal app placeholder. ESLint and typechecking run as dedicated
// turbo tasks (`pnpm lint`, `pnpm typecheck`), so `next build` skips its own
// lint pass to keep the standardized entrypoints single-sourced.
//
// ACR-006 post-credential deployment fix: the pg driver is bound at runtime
// through the frozen service-layer seam (`connectPostgresPool` ->
// `import(PG_DRIVER_MODULE)` — an expression webpack must keep external, per
// the W046 pin-5 boundary). The bundled server therefore resolves 'pg' from
// node_modules at runtime, and the serverless file tracer cannot see the
// dynamic expression: declare the dependency at the deployment importer
// (apps/web — still NO source-level pg import; the boundary test enforces
// code imports only) and force-include the driver files in the lambda trace.
const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  outputFileTracingIncludes: {
    '/api/**': [
      // The driver itself (symlink path) + its FULL pnpm-store dependency
      // closure: in the pnpm isolated layout pg's transitive runtime deps
      // (pg-connection-string, pg-pool, pg-protocol, pg-types, pgpass,
      // pg-cloudflare) live as SIBLINGS under .pnpm/pg@*/node_modules/ —
      // invisible to the tracer exactly like the driver (found live on the
      // first production boot: "Cannot find module 'pg-types'" from
      // pg/lib/defaults.js inside the lambda).
      './node_modules/pg/**/*',
      './node_modules/.pnpm/pg@*/node_modules/**/*',
    ],
  },
};

export default nextConfig;
