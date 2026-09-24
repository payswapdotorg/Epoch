import type { NextConfig } from 'next';

// W001: minimal app placeholder. ESLint and typechecking run as dedicated
// turbo tasks (`pnpm lint`, `pnpm typecheck`), so `next build` skips its own
// lint pass to keep the standardized entrypoints single-sourced.
const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
