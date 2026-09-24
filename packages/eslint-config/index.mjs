// @epoch/eslint-config — shared ESLint (flat) config factory for the Epoch workspace.
//
// Second enforcement layer for the Epoch package-boundary model:
// scripts/boundary-check.mjs is the authoritative CLI checker (dependency edges
// + static source-import scan); this config adds editor/CI-time
// `no-restricted-imports` enforcement of the same layer rules.
// LAYER_RULES is intentionally duplicated — keep it in sync with
// scripts/boundary-check.mjs.
import eslintJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import { layerRestrictions } from './boundary.mjs';

const SHARED_IGNORES = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.next/**',
  '**/.turbo/**',
];

/**
 * Build the shared flat config for a workspace package.
 *
 * @param {{ layer?: string, root?: string }} [options]
 *   layer - the consuming package's Epoch layer ('tooling' | 'kernel' |
 *           'contracts' | 'experience' | 'pack' | 'service' | 'app'); when
 *           given, layer-boundary import restrictions are appended.
 *   root  - workspace root; defaults to the nearest ancestor directory
 *           containing pnpm-workspace.yaml.
 * @returns {Array<import('eslint').Linter.Config>}
 */
export function defineConfig(options = {}) {
  const { layer } = options;
  const configs = [
    { ignores: SHARED_IGNORES },
    eslintJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
      files: ['**/*.d.ts', '**/*.d.mts', '**/*.d.cts'],
      rules: {
        // Ambient declaration files legitimately use triple-slash references
        // (e.g. apps/web/next-env.d.ts references Next-generated route types).
        '@typescript-eslint/triple-slash-reference': 'off',
      },
    },
  ];
  if (layer) {
    configs.push(layerRestrictions({ layer, root: options.root }));
  }
  return configs;
}

export default defineConfig;
