#!/usr/bin/env node
// W060 — the local link state of the glTF asset bridge package (and the
// foundation-bridges battery chain).
//
// adapters/foundations/gltf is a NESTED package path that the frozen
// pnpm-workspace.yaml globs ("adapters/*", "adapters/renderers/*" — one
// level each) do not match, so the package is NOT a pnpm workspace project
// until the Tech Lead's registration pass adds the adapters/foundations/*
// glob entry (the PR #124 / #135 lockfile-reconcile precedents; raised as an
// advisory on the W060 PR). Until then, this script builds the package's
// gitignored LOCAL node_modules so typecheck/lint/test run exactly as they
// will post-registration:
//
//   - @epoch/* workspace packages  -> symlinks to ../../../packages/<pkg>
//     (each resolves its own dependencies through its own real node_modules);
//   - vitest / eslint / typescript / @types/node -> symlinks into
//     @epoch/renderer-fabric's node_modules (the same pinned catalog
//     versions every package uses);
//   - THIS package has ZERO external dependencies (pure-code bridge), so
//     unlike the W058/W059 engine adapters there is nothing to stage from
//     the registry.
//
// This script is also the CHAIN ROOT of the W060 foundation packages: it
// invokes the sibling link scripts (adapters/renderers/blender,
// adapters/foundations/{assimp,openusd,freecad}) so ONE command bootstraps
// every battery dependency, then links the qa/foundation-renderers battery
// (whose vitest run rides THIS package's pipeline).
//
// Idempotent; safe to re-run. When the package IS registered (a pnpm
// node_modules with .modules.yaml appears), the script exits without
// touching it. Nothing here is ever committed (outputs are gitignored).

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rootDir = path.resolve(pkgDir, '..', '..', '..');
const localModules = path.join(pkgDir, 'node_modules');

const log = (msg) => console.log(`[link-local:gltf] ${msg}`);

// Already a real pnpm-installed package (post-registration)? Never touch it.
if (fs.existsSync(path.join(localModules, '.modules.yaml'))) {
  log('pnpm-managed node_modules present (package registered) — nothing to do.');
  process.exit(0);
}

// --- build the local node_modules (workspace packages + toolchain only).
const fabricModules = path.join(rootDir, 'packages', 'renderer-fabric', 'node_modules');
const packages = [
  'agent-protocol',
  'eslint-config',
  'experience-protocol',
  'renderer-runtime',
  'tsconfig',
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
// A self-link so the qa/foundation-renderers battery (and any pre-registration
// consumer) can import the bridge by package name (pnpm provides it
// post-registration).
symlink(pkgDir, path.join(localModules, '@epoch', 'adapter-foundation-gltf'));
log('local node_modules ready (gitignored; workspace symlinks only).');

// --- chain the sibling W060 packages' link scripts (idempotent, tolerant).
// The THREE.JS adapter is chained too: the qa/foundation-renderers battery
// drives the REAL three.js adapter session (the end-to-end proof rides a
// real engine), and its src resolves 'three' through its own package's
// node_modules — which its own link script builds (catalog-pinned stage).
const siblings = [
  ['blender', path.join(rootDir, 'adapters', 'renderers', 'blender', 'scripts', 'link-local.mjs')],
  ['assimp', path.join(rootDir, 'adapters', 'foundations', 'assimp', 'scripts', 'link-local.mjs')],
  ['openusd', path.join(rootDir, 'adapters', 'foundations', 'openusd', 'scripts', 'link-local.mjs')],
  ['freecad', path.join(rootDir, 'adapters', 'foundations', 'freecad', 'scripts', 'link-local.mjs')],
  ['threejs', path.join(rootDir, 'adapters', 'renderers', 'threejs', 'scripts', 'link-local.mjs')],
];
for (const [name, script] of siblings) {
  if (!fs.existsSync(script)) {
    log(`sibling ${name}: no link script (skipped)`);
    continue;
  }
  try {
    execFileSync(process.execPath, [script], { stdio: 'inherit' });
    log(`sibling ${name}: linked`);
  } catch (err) {
    log(`sibling ${name}: link script FAILED (${err.message}) — continuing (its own scripts re-run it)`);
  }
}

// --- link the qa/foundation-renderers battery into this module graph.
const qaDir = path.join(rootDir, 'qa', 'foundation-renderers');
if (fs.existsSync(qaDir)) {
  const qaLink = path.join(qaDir, 'node_modules');
  fs.rmSync(qaLink, { recursive: true, force: true });
  symlink(localModules, qaLink);
  log('linked qa/foundation-renderers/node_modules');
}
