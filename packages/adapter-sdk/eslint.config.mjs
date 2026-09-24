import { defineConfig } from '@epoch/eslint-config';

// Kernel-layer boundary restriction (see packages/eslint-config/README.md):
// the authoritative enforcement is `pnpm check:boundary`
// (scripts/boundary-check.mjs) over package.json edges + static imports.
// src/ imports ONLY @epoch/agent-protocol at runtime; the W003/W005/W006
// and @epoch/capability-registry imports are devDependency-only parity
// tests (test/), mirroring the W006 evidence -> W002 world-model kernel
// devDep precedent.
export default defineConfig({ layer: 'kernel' });
