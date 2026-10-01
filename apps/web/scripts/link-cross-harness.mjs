#!/usr/bin/env node
// W050 — link the qa/cross-platform harness into the apps/web module graph.
//
// qa/cross-platform is NOT a pnpm workspace package (pnpm-workspace.yaml
// is frozen — W050 may not edit it), so its TypeScript harness files have
// no node_modules of their own. The harness resolves every dependency
// through apps/web's node_modules; this script creates ONE idempotent
// symlink:
//
//   qa/cross-platform/node_modules -> ../../apps/web/node_modules
//
// The harness's own bare imports are 'vitest' only — every product module
// (web / desktop / mobile) is imported RELATIVELY, and each of those
// files resolves ITS dependencies through its own app's node_modules
// chain (the standard pnpm workspace links). No self-links are needed.
//
// Runs as a CLI (idempotent, safe to run manually) AND as the apps/web
// vitest globalSetup (so CI resolves the harness after a fresh pnpm
// install). The apps/web TYPECHECK of the harness never depends on this
// link: qa/cross-platform/tsconfig.json resolves every bare import
// declaratively (the W048 cold-checkout doctrine).
//
// node_modules is gitignored repository-wide; nothing here is committed.
import { symlinkSync, rmSync, existsSync, lstatSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const harnessRoot = path.join(repoRoot, 'qa', 'cross-platform');
const linkPath = path.join(harnessRoot, 'node_modules');
const targetPath = path.join(appRoot, 'node_modules');

/** Create the harness link (idempotent; throws on structural problems). */
export function linkCrossHarness() {
  if (!existsSync(targetPath)) {
    throw new Error('[link-cross-harness] apps/web/node_modules not found — run pnpm install first');
  }
  if (!existsSync(harnessRoot)) {
    throw new Error(`[link-cross-harness] qa/cross-platform not found at ${harnessRoot}`);
  }

  // Remove a stale link/dir (never touch a real directory with content).
  if (existsSync(linkPath)) {
    const isLink = lstatSync(linkPath).isSymbolicLink();
    const isDir = !isLink && statSync(linkPath).isDirectory();
    if (isLink || (isDir && readdirSync(linkPath).length === 0)) {
      rmSync(linkPath, { recursive: true });
    } else {
      throw new Error(`[link-cross-harness] ${linkPath} exists and is not a symlink/empty dir — refusing to remove it`);
    }
  }

  symlinkSync(targetPath, linkPath, 'dir');
  console.log(`[link-cross-harness] linked ${linkPath} -> ${targetPath}`);
}

// CLI mode (vitest imports this module for globalSetup — argv[1] is then
// the vitest binary, so the CLI block stays dormant).
const invokedAsCli = process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedAsCli) {
  try {
    linkCrossHarness();
  } catch (error) {
    console.error(String(error));
    process.exit(1);
  }
}

// The vitest globalSetup entry (a no-op return: teardown is unnecessary —
// the symlink is idempotent and gitignored).
export default function setup() {
  linkCrossHarness();
}
