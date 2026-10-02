#!/usr/bin/env node
// W056 — link the qa/renderer-conformance harness into the
// @epoch/renderer-fabric module graph.
//
// qa/renderer-conformance is NOT a pnpm workspace package
// (pnpm-workspace.yaml is frozen), so its TypeScript harness files have no
// node_modules of their own. The harness resolves every dependency through
// @epoch/renderer-fabric's node_modules; this script creates ONE
// idempotent symlink:
//
//   qa/renderer-conformance/node_modules ->
//     ../../packages/renderer-fabric/node_modules
//
// The harness's own bare imports are 'vitest' only — every product module
// (fabric, renderer-runtime, world-experience, capability-registry) is
// imported RELATIVELY, and each of those files resolves ITS dependencies
// through its own package's node_modules chain (the standard pnpm
// workspace links). No self-links are needed.
//
// Runs as a CLI (idempotent, safe to run manually) AND as the fabric's
// vitest globalSetup (so CI resolves the harness after a fresh pnpm
// install). The TYPECHECK of the harness never depends on this link:
// qa/renderer-conformance/tsconfig.json resolves every bare import
// declaratively (the W048/W050 cold-checkout doctrine).
//
// node_modules is gitignored repository-wide; nothing here is committed.
import { symlinkSync, rmSync, existsSync, lstatSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const harnessRoot = path.join(repoRoot, 'qa', 'renderer-conformance');
const linkPath = path.join(harnessRoot, 'node_modules');
const targetPath = path.join(packageRoot, 'node_modules');

/** Create the harness link (idempotent; throws on structural problems). */
export function linkConformanceHarness() {
  if (!existsSync(targetPath)) {
    throw new Error(
      '[link-conformance-harness] packages/renderer-fabric/node_modules not found — run pnpm install first',
    );
  }
  if (!existsSync(harnessRoot)) {
    throw new Error(`[link-conformance-harness] qa/renderer-conformance not found at ${harnessRoot}`);
  }

  // Remove a stale link/dir (never touch a real directory with content).
  if (existsSync(linkPath)) {
    const isLink = lstatSync(linkPath).isSymbolicLink();
    const isDir = !isLink && statSync(linkPath).isDirectory();
    if (isLink || (isDir && readdirSync(linkPath).length === 0)) {
      rmSync(linkPath, { recursive: true });
    } else {
      throw new Error(
        `[link-conformance-harness] ${linkPath} exists and is not a symlink/empty dir — refusing to remove it`,
      );
    }
  }

  symlinkSync(targetPath, linkPath, 'dir');
  console.log(`[link-conformance-harness] linked ${linkPath} -> ${targetPath}`);
}

// CLI mode (vitest imports this module for globalSetup — argv[1] is then
// the vitest binary, so the CLI block stays dormant).
const invokedAsCli =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsCli) {
  linkConformanceHarness();
}

// Vitest globalSetup mode (vitest 5: a globalSetup file exports setup()).
// Runs the same idempotent link after a fresh `pnpm install`.
export function setup() {
  linkConformanceHarness();
}
