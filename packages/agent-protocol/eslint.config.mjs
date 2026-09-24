import { defineConfig } from '@epoch/eslint-config';

// Layer-boundary restriction for this kernel package, applied directly in
// the ESLint 10 options shape.
//
// Why not `defineConfig({ layer: 'kernel' })`: the W001 shared config's
// `layerRestrictions()` emits `no-restricted-imports` options in the
// pre-ESLint-10 shape (`{ paths: [{ group, message }] }`), which ESLint 10
// rejects at config-load time whenever the restriction list is non-empty
// (first exercised by this package — kernel layers have forbidden targets).
// The shared config is owned outside this Work Order's surfaces, so the fix
// is raised as an architecture question in the W003 PR; meanwhile this
// package enforces the identical kernel-layer restriction itself.
//
// The authoritative boundary check remains `pnpm check:boundary`
// (scripts/boundary-check.mjs), which enforces the full layer model
// (kernel -> kernel/contracts/tooling) on package.json edges and source
// imports.
const FORBIDDEN_FOR_KERNEL = [
  '@epoch/web',
  '@epoch/web/**',
  '@epoch/desktop',
  '@epoch/desktop/**',
  '@epoch/mobile',
  '@epoch/mobile/**',
];

const config = defineConfig();
config.push({
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: FORBIDDEN_FOR_KERNEL,
            message:
              'Epoch layer boundary: kernel packages may not import app-layer packages (allowed layers for kernel: kernel, contracts, tooling).',
          },
        ],
      },
    ],
  },
});

export default config;
