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
  // The driver stays EXTERNAL (never bundled): the static anchor import
  // (services/application-gateway pg-driver-anchor -> apps/web
  // production-binding) then emits a real static driver require in the
  // server bundle, which the file tracer FOLLOWS — carrying the driver's
  // full transitive module tree (pg-types and friends) into the lambda. The
  // explicit include below is the belt-and-suspenders for the driver itself
  // (the frozen seam's dynamic expression import remains invisible to the
  // tracer).
  serverExternalPackages: ['pg'],
  outputFileTracingIncludes: {
    '/api/**': ['./node_modules/pg/**/*'],
  },
};

export default nextConfig;
