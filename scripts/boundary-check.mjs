#!/usr/bin/env node
// W001 — Epoch package-boundary checker (authoritative CLI).
//
// Enforces the Epoch layer model (IMPLEMENTATION.md: contracts -> implementations
// -> adapters; Experience -> contracts/runtime, never reverse; Packs ->
// contracts/capability APIs). Two independent enforcement layers exist by
// design and their rule tables are intentionally duplicated:
//   1. THIS script — package.json dependency edges + static source-import scan.
//   2. packages/eslint-config/boundary.mjs — `no-restricted-imports` at lint time.
// Keep LAYER_RULES in sync in both places.
//
// Layer model (every workspace package declares "epoch": { "layer": "..." }):
//   tooling     -> tooling
//   kernel      -> kernel, contracts, tooling
//   contracts   -> contracts, tooling
//   experience  -> experience, kernel, contracts, tooling
//   pack        -> contracts, kernel (capability APIs), tooling
//   service/app -> anything, EXCEPT pack internals (deep /src or /internal imports)
// `kernel` and `contracts` can therefore never import experience/pack/app/service
// (the "kernel -> UI" prevention).
//
// Node stdlib only. Deterministic output. Exit 0 = PASS, 1 = violations,
// 2 = usage/internal error.
//
// Usage: node scripts/boundary-check.mjs [--root <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LAYERS = ['tooling', 'kernel', 'contracts', 'experience', 'pack', 'service', 'app'];

export const LAYER_RULES = {
  tooling: ['tooling'],
  kernel: ['kernel', 'contracts', 'tooling'],
  contracts: ['contracts', 'tooling'],
  experience: ['experience', 'kernel', 'contracts', 'tooling'],
  pack: ['contracts', 'kernel', 'tooling'],
  service: LAYERS,
  app: LAYERS,
};

const DEP_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
const SOURCE_RE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.turbo',
  '.next',
  'dist',
  'build',
  'coverage',
  '.cache',
  '.pnpm-store',
]);
// Static import specifier extraction (heuristic multi-pattern scan):
//   1. `... from 'spec'`      (import/export ... from)
//   2. `import 'spec'`        (side-effect import)
//   3. `require('spec')`      (CJS)
//   4. `import('spec')`       (dynamic import)
const IMPORT_RES = [
  /\bfrom\s*(['"])([^'"\n]+)\1/g,
  /\bimport\s*(['"])([^'"\n]+)\1/g,
  /\brequire\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g,
  /\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g,
];

const rel = (root, p) => path.relative(root, p) || '.';

function parseArgs(argv) {
  const args = { root: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root') {
      if (i + 1 >= argv.length) throw new Error('--root requires a directory argument');
      args.root = path.resolve(argv[i + 1]);
      i += 1;
    } else {
      throw new Error(`unknown argument: ${argv[i]}`);
    }
  }
  return args;
}

function readWorkspaceGlobs(root) {
  const file = path.join(root, 'pnpm-workspace.yaml');
  if (!fs.existsSync(file)) {
    throw new Error(`pnpm-workspace.yaml not found at ${root}`);
  }
  const globs = [];
  let inPackages = false;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trimEnd();
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    const item = line.match(/^\s*-\s*['"]?([^'"\s]+)['"]?\s*$/);
    if (item) {
      globs.push(item[1]);
      continue;
    }
    if (line.trim() !== '') inPackages = false; // next top-level key (e.g. `catalog:`)
  }
  if (globs.length === 0) throw new Error('no packages entries found in pnpm-workspace.yaml');
  return globs;
}

function globToDirs(root, glob) {
  if (glob.endsWith('/*')) {
    const parent = path.join(root, glob.slice(0, -2));
    if (!fs.existsSync(parent)) return [];
    return fs
      .readdirSync(parent, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(parent, e.name));
  }
  if (glob === '**' || glob.endsWith('/**')) {
    const base = glob === '**' ? root : path.join(root, glob.slice(0, -3));
    const dirs = [];
    const walk = (dir) => {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!e.isDirectory() || SKIP_DIRS.has(e.name)) continue;
        const child = path.join(dir, e.name);
        dirs.push(child);
        walk(child);
      }
    };
    walk(base);
    return dirs;
  }
  throw new Error(
    `unsupported pnpm-workspace package pattern: ${glob} (supported: "dir/*", "dir/**", "**")`,
  );
}

function loadPackages(root) {
  const dirs = new Set();
  for (const glob of readWorkspaceGlobs(root)) {
    for (const dir of globToDirs(root, glob)) dirs.add(dir);
  }
  const packages = [];
  for (const dir of [...dirs].sort()) {
    const manifestPath = path.join(dir, 'package.json');
    if (!fs.existsSync(manifestPath)) continue;
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (err) {
      packages.push({
        dir,
        root,
        name: path.basename(dir),
        manifest: null,
        layer: undefined,
        error: `invalid package.json: ${err.message}`,
      });
      continue;
    }
    packages.push({
      dir,
      root,
      name: typeof manifest.name === 'string' && manifest.name !== '' ? manifest.name : null,
      manifest,
      layer: manifest?.epoch?.layer,
    });
  }
  return packages;
}

function walkSources(dir) {
  const files = [];
  const walk = (current) => {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const child = path.join(current, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(child);
      } else if (e.isFile() && SOURCE_RE.test(e.name)) {
        files.push(child);
      }
    }
  };
  walk(dir);
  return files.sort();
}

function forbiddenEdge(fromLayer, toLayer) {
  const allowed = LAYER_RULES[fromLayer];
  if (!allowed) return false; // invalid layer is reported separately
  return !allowed.includes(toLayer);
}

function classifySpecifier({ spec, file, lineNo, pkg, packages, root }) {
  const at = `${rel(root, file)}:${lineNo}`;
  if (spec.startsWith('.')) {
    const resolved = path.resolve(path.dirname(file), spec);
    if (resolved !== pkg.dir && !resolved.startsWith(pkg.dir + path.sep)) {
      const target = packages.find(
        (t) => t.name && (resolved === t.dir || resolved.startsWith(t.dir + path.sep)),
      );
      const extra = target ? ` (reaches into workspace package ${target.name})` : '';
      return [
        `[relative] ${at}: ${pkg.name} (layer ${pkg.layer}) uses cross-package relative import ` +
          `"${spec}" resolving outside its package${extra}; import the workspace package name instead`,
      ];
    }
    return [];
  }
  if (spec.startsWith('node:')) return [];
  const base = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
  const target = packages.find((t) => t.name === base);
  if (!target || !target.layer || !LAYER_RULES[target.layer]) return []; // external or invalid-layer target
  if (forbiddenEdge(pkg.layer, target.layer)) {
    return [
      `[import] ${at}: ${pkg.name} (layer ${pkg.layer}) imports ${base} (layer ${target.layer}); ` +
        `allowed layers for ${pkg.layer}: ${LAYER_RULES[pkg.layer].join(', ')}`,
    ];
  }
  const rest = spec.slice(base.length);
  if ((pkg.layer === 'app' || pkg.layer === 'service') && target.layer === 'pack' && /^\/(?:src|internal)(?:\/|$)/.test(rest)) {
    return [
      `[import] ${at}: ${pkg.name} (layer ${pkg.layer}) reaches into pack internals "${spec}"; ` +
        `packs expose only their package entry / capability APIs`,
    ];
  }
  return [];
}

export function checkBoundary(root) {
  const violations = [];
  const packages = loadPackages(root);

  // Manifest sanity + layer declarations.
  const valid = [];
  for (const p of packages) {
    if (p.error) {
      violations.push(`[manifest] ${rel(root, p.dir)}: ${p.error}`);
      continue;
    }
    if (!p.name) {
      violations.push(`[manifest] ${rel(root, p.dir)}: package.json is missing "name"`);
      continue;
    }
    if (p.layer === undefined || p.layer === null) {
      violations.push(`[layer] ${p.name} (${rel(root, p.dir)}): package.json is missing "epoch.layer"`);
    } else if (typeof p.layer !== 'string' || !LAYERS.includes(p.layer)) {
      violations.push(
        `[layer] ${p.name} (${rel(root, p.dir)}): unknown epoch.layer ${JSON.stringify(p.layer)} ` +
          `(expected one of: ${LAYERS.join(', ')})`,
      );
    } else {
      valid.push(p);
    }
  }

  // Package-level dependency edges (dependencies / devDependencies / optional / peer).
  for (const p of valid) {
    for (const section of DEP_SECTIONS) {
      const deps = p.manifest?.[section] ?? {};
      for (const depName of Object.keys(deps)) {
        const target = valid.find((t) => t.name === depName);
        if (!target) continue;
        if (forbiddenEdge(p.layer, target.layer)) {
          violations.push(
            `[deps] ${p.name} (layer ${p.layer}) declares ${section} "${depName}" (layer ${target.layer}); ` +
              `allowed layers for ${p.layer}: ${LAYER_RULES[p.layer].join(', ')}`,
          );
        }
      }
    }
  }

  // Source-level import statements inside each package.
  for (const p of valid) {
    for (const file of walkSources(p.dir)) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      for (const re of IMPORT_RES) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(content)) !== null) {
          const spec = m[2];
          const lineNo = content.slice(0, m.index).split('\n').length;
          const lineText = lines[lineNo - 1] ?? '';
          if (/^\s*(?:\*|\/\/|<!--)/.test(lineText)) continue; // crude comment-line skip
          violations.push(...classifySpecifier({ spec, file, lineNo, pkg: p, packages: valid, root }));
        }
      }
    }
  }

  return [...violations].sort();
}

function main() {
  let root;
  try {
    const args = parseArgs(process.argv.slice(2));
    root = args.root ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  } catch (err) {
    console.error(`boundary-check: ${err.message}`);
    process.exit(2);
    return;
  }
  let violations;
  try {
    violations = checkBoundary(root);
  } catch (err) {
    console.error(`boundary-check: ${err.message}`);
    process.exit(2);
    return;
  }
  if (violations.length > 0) {
    console.error(`boundary-check: FAIL (${violations.length} violation${violations.length === 1 ? '' : 's'})`);
    for (const v of violations) console.error(`  - ${v}`);
    process.exit(1);
  }
  console.log('boundary-check: PASS');
}

const invokedAsCli =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsCli) {
  main();
}
