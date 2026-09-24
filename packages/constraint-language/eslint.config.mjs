// NOTE: `layer: 'kernel'` is intentionally NOT passed to defineConfig yet.
// @epoch/eslint-config's layerRestrictions() emits a `no-restricted-imports`
// config shape that ESLint 10 rejects for any layer that actually has
// restricted workspace imports (kernel restricts app/experience/pack/service)
// — a latent W001 defect that only fires for kernel/contracts-layer packages.
// The authoritative layer enforcement (scripts/boundary-check.mjs) covers
// this package in `pnpm check` and CI. Re-enable the layer param once the
// eslint-config fix lands on a foundation branch (flagged in the W004 PR).
import { defineConfig } from '@epoch/eslint-config';

export default defineConfig();
