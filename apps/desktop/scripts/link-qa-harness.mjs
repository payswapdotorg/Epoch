#!/usr/bin/env node
// W048 — link the qa/desktop harness into the apps/desktop module graph.
//
// qa/desktop is NOT a pnpm workspace package (pnpm-workspace.yaml is
// frozen — W048 may not edit it), so its TypeScript harness files have no
// node_modules of their own. The harness resolves every dependency
// through apps/desktop's node_modules (the W048 dependency pin set);
// this script creates ONE idempotent symlink:
//
//   qa/desktop/node_modules -> ../../apps/desktop/node_modules
//
// plus the workspace SELF-LINK (apps/desktop/node_modules/@epoch/desktop
// -> apps/desktop) so the harness imports '@epoch/desktop/native' the
// same way external consumers do (pnpm does not create self-links).
//
// Runs as a CLI (idempotent, safe to run manually) AND as the vitest
// globalSetup (so CI resolves the harness after a fresh pnpm install).
// node_modules is gitignored repository-wide; nothing here is committed.
import { symlinkSync, rmSync, existsSync, lstatSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const repoRoot = path.resolve(appRoot, '..', '..');
const harnessRoot = path.join(repoRoot, 'qa', 'desktop');
const linkPath = path.join(harnessRoot, 'node_modules');
const targetPath = path.join(appRoot, 'node_modules');

/** Create the harness links (idempotent; throws on structural problems). */
export function linkQaHarness() {
  if (!existsSync(targetPath)) {
    throw new Error('[link-qa-harness] apps/desktop/node_modules not found — run pnpm install first');
  }
  if (!existsSync(harnessRoot)) {
    throw new Error(`[link-qa-harness] qa/desktop not found at ${harnessRoot}`);
  }

  // Remove a stale link/dir (never touch a real directory with content).
  if (existsSync(linkPath)) {
    const isLink = lstatSync(linkPath).isSymbolicLink();
    const isDir = !isLink && statSync(linkPath).isDirectory();
    if (isLink || (isDir && readdirSync(linkPath).length === 0)) {
      rmSync(linkPath, { recursive: true });
    } else {
      throw new Error(`[link-qa-harness] ${linkPath} exists and is not a symlink/empty dir — refusing to remove it`);
    }
  }

  symlinkSync(targetPath, linkPath, 'dir');
  console.log(`[link-qa-harness] linked ${linkPath} -> ${targetPath}`);

  // Also ensure the workspace SELF-LINK so the harness can import
  // '@epoch/desktop/native' the same way external consumers do.
  const scopeDir = path.join(targetPath, '@epoch');
  const selfLink = path.join(scopeDir, 'desktop');
  if (!existsSync(selfLink)) {
    mkdirSync(scopeDir, { recursive: true });
    symlinkSync(appRoot, selfLink, 'dir');
    console.log(`[link-qa-harness] linked ${selfLink} -> ${appRoot}`);
  }
}

// CLI mode (vitest imports this module for globalSetup — argv[1] is then
// the vitest binary, so the CLI block stays dormant).
const invokedAsCli = process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedAsCli) {
  try {
    linkQaHarness();
  } catch (error) {
    console.error(String(error));
    process.exit(1);
  }
}

// The vitest globalSetup entry (a no-op return: teardown is unnecessary —
// the symlink is idempotent and gitignored).
export default function setup() {
  linkQaHarness();
}
