#!/usr/bin/env node
// W071 — link the qa/construction-solution harness into the
// @epoch/construction-world-fixture module graph.
//
// qa/construction-solution is NOT a pnpm workspace package
// (pnpm-workspace.yaml is frozen for the harness path), so its TypeScript
// harness files have no node_modules of their own. The harness resolves
// every dependency through @epoch/construction-world-fixture's
// node_modules; this script creates ONE idempotent symlink:
//
//   qa/construction-solution/node_modules ->
//     ../../packages/construction-world-fixture/node_modules
//
// The harness's own bare imports are 'vitest' only — every product module
// (construction-world-fixture, world-experience, renderer-fabric,
// renderer-runtime, capability-registry) is imported either by package
// name (when the harness exercises the public API) or RELATIVELY (when the
// harness exercises the package's own source), and each of those files
// resolves ITS dependencies through its own package's node_modules chain
// (the standard pnpm workspace links). No self-links are needed.
//
// Runs as a CLI (idempotent, safe to run manually) AND as the package's
// vitest globalSetup (so CI resolves the harness after a fresh pnpm
// install). The TYPECHECK of the harness never depends on this link:
// qa/construction-solution/tsconfig.json resolves every bare import
// declaratively (the W048/W050 cold-checkout doctrine).
//
// node_modules is gitignored repository-wide; nothing here is committed.
/* eslint-disable no-undef */
import { symlinkSync, rmSync, existsSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const harnessRoot = path.join(repoRoot, 'qa', 'construction-solution');
const linkPath = path.join(harnessRoot, 'node_modules');
const targetPath = path.join(packageRoot, 'node_modules');

/** Create the harness link (idempotent; throws on structural problems). */
export function linkConstructionHarness() {
  if (!existsSync(targetPath)) {
    // Nothing to link yet (fresh checkout before pnpm install); the
    // typecheck path does not depend on this link, and tests run only
    // after pnpm install has populated node_modules.
    return { linked: false, reason: 'target-missing' };
  }
  if (existsSync(linkPath)) {
    const stat = lstatSync(linkPath);
    if (stat.isSymbolicLink()) {
      // Already linked; idempotent no-op.
      return { linked: false, reason: 'already-linked' };
    }
    // A non-symlink obstruction (e.g. a stale directory); remove + relink.
    rmSync(linkPath, { recursive: true, force: true });
  }
  symlinkSync(targetPath, linkPath, 'dir');
  return { linked: true, reason: 'created' };
}

// CLI mode (vitest imports this module for globalSetup — argv[1] is then
// the vitest binary, so the CLI block stays dormant).
const invokedAsCli =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsCli) {
  const result = linkConstructionHarness();
  console.log(`link-construction-harness: ${result.reason}`);
}

// Vitest globalSetup mode (vitest 5: a globalSetup file exports setup()).
// Runs the same idempotent link after a fresh `pnpm install`.
export function setup() {
  linkConstructionHarness();
}
/* eslint-enable no-undef */
