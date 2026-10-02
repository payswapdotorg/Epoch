#!/usr/bin/env node
// W060 — the local link state of the Blender sidecar adapter package.
//
// adapters/renderers/blender is a NESTED package path that the frozen
// pnpm-workspace.yaml globs ("adapters/*", "adapters/renderers/*" — one
// level each) do not match, so the package is NOT a pnpm workspace project
// until the Tech Lead's registration pass covers it (the PR #124 / #135
// lockfile-reconcile precedents; raised as an advisory on the W060 PR).
// Until then, this script builds the package's gitignored LOCAL node_modules
// so typecheck/lint/test run exactly as they will post-registration:
//
//   - @epoch/* workspace packages  -> symlinks to ../../../packages/<pkg>
//     (each resolves its own dependencies through its own real node_modules);
//   - vitest / eslint / typescript / @types/node -> symlinks into
//     @epoch/renderer-fabric's node_modules (the same pinned catalog
//     versions every package uses);
//   - THIS package has ZERO external dependencies (Node built-ins only), so
//     unlike the W058/W059 engine adapters there is nothing to stage from
//     the registry. Blender itself is NEVER downloaded or bundled here —
//     operators supply the binary (EPOCH_BLENDER_PATH; see
//     docs/rendering/blender.md for the live battery).
//
// Idempotent; safe to re-run. When the package IS registered (a pnpm
// node_modules with .modules.yaml appears), the script exits without
// touching it. Nothing here is ever committed (outputs are gitignored).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = path.resolve(pkgDir, '..', '..', '..');
const localModules = path.join(pkgDir, 'node_modules');

const log = (msg) => console.log(`[link-local:blender] ${msg}`);

// Already a real pnpm-installed package (post-registration)? Never touch it.
if (fs.existsSync(path.join(localModules, '.modules.yaml'))) {
  log('pnpm-managed node_modules present (package registered) — nothing to do.');
  process.exit(0);
}

// --- build the local node_modules (workspace packages + toolchain only).
const fabricModules = path.join(rootDir, 'packages', 'renderer-fabric', 'node_modules');
const packages = [
  'agent-protocol',
  'capability-registry',
  'eslint-config',
  'experience-protocol',
  'renderer-fabric',
  'renderer-runtime',
  'tsconfig',
  'world-experience',
];

fs.rmSync(localModules, { recursive: true, force: true });
fs.mkdirSync(path.join(localModules, '@epoch'), { recursive: true });
fs.mkdirSync(path.join(localModules, '@types'), { recursive: true });
fs.mkdirSync(path.join(localModules, '.bin'), { recursive: true });

const symlink = (from, to) => fs.symlinkSync(path.relative(path.dirname(to), from), to, 'junction');
for (const name of packages) {
  symlink(path.join(rootDir, 'packages', name), path.join(localModules, '@epoch', name));
}
// The shared toolchain (the same pinned versions the fabric package uses).
symlink(path.join(fabricModules, 'vitest'), path.join(localModules, 'vitest'));
symlink(path.join(fabricModules, 'eslint'), path.join(localModules, 'eslint'));
symlink(path.join(fabricModules, 'typescript'), path.join(localModules, 'typescript'));
symlink(path.join(fabricModules, '@types', 'node'), path.join(localModules, '@types', 'node'));
if (fs.existsSync(path.join(fabricModules, '@types', 'espree'))) {
  symlink(path.join(fabricModules, '@types', 'espree'), path.join(localModules, '@types', 'espree'));
}
for (const bin of ['tsc', 'tsserver', 'vitest', 'eslint']) {
  const target = path.join(fabricModules, '.bin', bin);
  if (fs.existsSync(target)) {
    fs.symlinkSync(
      path.relative(path.join(localModules, '.bin'), target),
      path.join(localModules, '.bin', bin),
      'junction',
    );
  }
}
// A self-link so pre-registration consumers can import the adapter by
// package name (pnpm provides it post-registration).
symlink(pkgDir, path.join(localModules, '@epoch', 'adapter-renderer-blender'));

log('local node_modules ready (gitignored; workspace symlinks only).');
