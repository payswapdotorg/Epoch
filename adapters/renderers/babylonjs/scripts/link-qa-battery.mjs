#!/usr/bin/env node
// W059 — link the qa/renderer-conformance/babylonjs battery into the
// @epoch/adapter-renderer-babylonjs module graph.
//
// qa/renderer-conformance is NOT a pnpm workspace package
// (pnpm-workspace.yaml is frozen), so the battery's TypeScript files have
// no node_modules of their own. The battery resolves every dependency
// through THIS adapter package's node_modules; this script creates ONE
// idempotent symlink:
//
//   qa/renderer-conformance/babylonjs/node_modules ->
//     ../../../../adapters/renderers/babylonjs/node_modules
//
// The battery's own bare import is 'vitest' only — every product module
// (the adapter, the fabric, renderer-runtime, world-experience) is imported
// RELATIVELY, and each of those files resolves ITS dependencies through its
// own package's node_modules chain (the standard pnpm workspace links —
// the W056 cold-checkout doctrine). No self-links are needed.
//
// Runs as a CLI (idempotent, safe to run manually) AND as this package's
// vitest globalSetup (so CI resolves the battery after a fresh pnpm
// install). The TYPECHECK of the battery never depends on this link:
// qa/renderer-conformance/babylonjs/tsconfig.json resolves every bare
// import declaratively.
//
// node_modules is gitignored repository-wide; nothing here is committed.
import { symlinkSync, rmSync, existsSync, lstatSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..');
const repoRoot = path.resolve(packageRoot, '..', '..', '..');
const harnessRoot = path.join(repoRoot, 'qa', 'renderer-conformance', 'babylonjs');
const linkPath = path.join(harnessRoot, 'node_modules');
const targetPath = path.join(packageRoot, 'node_modules');

/** Create the battery link (idempotent; throws on structural problems). */
export function linkQaBattery() {
  if (!existsSync(targetPath)) {
    throw new Error(
      '[link-qa-battery] adapters/renderers/babylonjs/node_modules not found — run pnpm install first',
    );
  }
  if (!existsSync(harnessRoot)) {
    throw new Error(`[link-qa-battery] qa/renderer-conformance/babylonjs not found at ${harnessRoot}`);
  }

  // Remove a stale link/dir (never touch a real directory with content).
  if (existsSync(linkPath)) {
    const isLink = lstatSync(linkPath).isSymbolicLink();
    const isDir = !isLink && statSync(linkPath).isDirectory();
    if (isLink || (isDir && readdirSync(linkPath).length === 0)) {
      rmSync(linkPath, { recursive: true });
    } else {
      throw new Error(
        `[link-qa-battery] ${linkPath} exists and is not a symlink/empty dir — refusing to remove it`,
      );
    }
  }

  symlinkSync(targetPath, linkPath, 'dir');
  console.log(`[link-qa-battery] linked ${linkPath} -> ${targetPath}`);
}

// CLI mode (vitest imports this module for globalSetup — argv[1] is then
// the vitest binary, so the CLI block stays dormant).
const invokedAsCli =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsCli) {
  linkQaBattery();
}

// Vitest globalSetup mode (vitest 5: a globalSetup file exports setup()).
export function setup() {
  linkQaBattery();
}
