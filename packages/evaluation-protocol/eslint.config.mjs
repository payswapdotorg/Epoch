import { defineConfig } from '@epoch/eslint-config';

// Layer-boundary restriction for this kernel package, applied directly in
// the ESLint 10 options shape (same approach as @epoch/agent-protocol and
// @epoch/action-protocol — see their configs for the rationale: the W001
// shared config's layerRestrictions() emits a pre-ESLint-10 options shape).
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
