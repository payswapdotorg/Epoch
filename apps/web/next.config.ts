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
  // The driver's FULL runtime closure is declared as direct dependencies
  // (flattened at this app's node_modules root) and force-included: the
  // frozen seam's dynamic expression import is invisible to the file
  // tracer, and in the pnpm isolated layout the closure would otherwise
  // live as unresolvable store siblings (found live on the production
  // boots: 'Cannot find module pg' then 'Cannot find module pg-types').
  // Every runtime-reachable file lands at a resolvable lambda path.
  outputFileTracingIncludes: {
    '/api/**': [
      './node_modules/pg/**/*',
      './node_modules/pg-*/**/*',
      './node_modules/pgpass/**/*',
      './node_modules/postgres-*/**/*',
    ],
  },
};

export default nextConfig;
