import { defineConfig } from '@epoch/eslint-config';

// Service layer (the same class as the W029 adapters): the harness library
// is test infrastructure that may reference kernel-layer runtime
// dependencies (@epoch/agent-protocol for canonical digests, @epoch/tenancy
// for tenant-id primitives). The authoritative enforcement is
// `pnpm check:boundary` (scripts/boundary-check.mjs) over package.json
// edges + static imports, with this lint config as the second layer.
export default defineConfig({ layer: 'service' });
