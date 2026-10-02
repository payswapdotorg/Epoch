import { defineConfig } from '@epoch/eslint-config';

// W060 — the Blender sidecar renderer adapter (experience layer: it
// implements the frozen W056 RendererAdapter seam as an EXTERNAL-PROCESS
// foundation — Blender is invoked as a separate program, never linked).
// Zero external runtime dependencies (Node built-ins only);
// `pnpm check:boundary` remains the authoritative package-edge enforcement.
export default [
  ...defineConfig({ layer: 'experience' }),
  {
    // The local link script (scripts/*.mjs): Node globals for the .mjs zone
    // (the renderer-fabric / W058 scripts-zone precedent).
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        TextEncoder: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
  },
  {
    // The Blender CLI TEST DOUBLE (test/doubles/*.mjs): a plain Node
    // program (no import of the package) — the same Node-globals zone the
    // scripts use, because the double IS a standalone script that emulates
    // the `blender` CLI (spawned as a real subprocess by the boundary
    // tests; process/Buffer/setTimeout are the double's whole runtime).
    files: ['test/doubles/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
];
