import { defineConfig } from '@epoch/eslint-config';

// Pack-layer boundary restriction (DP1.0: a domain pack imports contracts,
// kernel capability APIs and tooling ONLY; the authoritative enforcement is
// `pnpm check:boundary` (scripts/boundary-check.mjs) over package.json edges
// + static imports, with this lint config as the second layer).
export default defineConfig({ layer: 'pack' });
