import { defineConfig } from '@epoch/eslint-config';

// NOTE (W002): the shared `layerRestrictions` fragment from
// @epoch/eslint-config/boundary.mjs is currently rejected by ESLint 10 when
// the restriction set is non-empty: it emits `no-restricted-imports`
// `paths: [{ group, message }]`, but `group` is only valid under `patterns`.
// Every earlier package (apps/web, layer 'app') had an EMPTY restriction
// set, so this W001-shipped defect was never exercised. Fixing it belongs
// to the eslint-config owner's surface (serialized Tech-Lead change) — see
// the Architecture Questions section of the W002 PR.
//
// Layer-boundary enforcement for this package is NOT weakened: the
// authoritative CLI checker (scripts/boundary-check.mjs, dependency edges +
// static import scan) runs in `pnpm check` and in CI for every push.
export default defineConfig();
