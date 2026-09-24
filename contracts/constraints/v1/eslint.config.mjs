// contracts/constraints/v1 — standalone ESLint config for the published
// contract surface.
//
// contracts/ is a plain directory (not a pnpm workspace package), so npm
// specifiers are not resolvable here. This config re-exports the kernel
// package's config; the transitive '@epoch/eslint-config' import resolves
// from that package's own node_modules. The published surface is pure type
// declarations, so the recommended ruleset is fully sufficient.
import config from '../../../packages/constraint-language/eslint.config.mjs';

export default config;
