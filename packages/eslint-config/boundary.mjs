// Epoch layer-boundary restrictions for ESLint (flat config, no-restricted-imports).
//
// DUAL ENFORCEMENT: LAYER_RULES is intentionally duplicated from
// scripts/boundary-check.mjs so the CLI checker and the lint-time restriction
// remain independent enforcement layers — if one is bypassed or broken, the
// other still holds. Keep both tables in sync.
import fs from 'node:fs';
import path from 'node:path';

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

export function findWorkspaceRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(start);
    dir = parent;
  }
}

function workspaceGlobs(root) {
  const text = fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8');
  const globs = [];
  let inPackages = false;
  for (const raw of text.split(/\r?\n/)) {
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
    if (line.trim() !== '') inPackages = false;
  }
  return globs;
}

export function scanWorkspacePackages(root = findWorkspaceRoot()) {
  const packages = [];
  const seen = new Set();
  for (const glob of workspaceGlobs(root)) {
    const dirs = [];
    if (glob.endsWith('/*')) {
      const parent = path.join(root, glob.slice(0, -2));
      if (fs.existsSync(parent)) {
        for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
          if (entry.isDirectory()) dirs.push(path.join(parent, entry.name));
        }
      }
    } else if (glob === '**' || glob.endsWith('/**')) {
      const base = glob === '**' ? root : path.join(root, glob.slice(0, -3));
      const walk = (dir) => {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;
          const child = path.join(dir, entry.name);
          dirs.push(child);
          walk(child);
        }
      };
      walk(base);
    } else {
      // Unsupported pattern here; scripts/boundary-check.mjs is authoritative.
      continue;
    }
    for (const dir of dirs) {
      if (seen.has(dir)) continue;
      seen.add(dir);
      const manifestPath = path.join(dir, 'package.json');
      if (!fs.existsSync(manifestPath)) continue;
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        packages.push({ dir, name: manifest.name, layer: manifest?.epoch?.layer });
      } catch {
        // Invalid manifests are reported by scripts/boundary-check.mjs.
      }
    }
  }
  return packages;
}

/**
 * Flat-config fragment restricting imports according to the Epoch layer model.
 *
 * @param {{ layer: string, root?: string }} options
 * @returns {import('eslint').Linter.Config}
 */
export function layerRestrictions({ layer, root = findWorkspaceRoot() }) {
  const allowed = LAYER_RULES[layer];
  if (!allowed) {
    throw new Error(
      `@epoch/eslint-config: unknown Epoch layer '${layer}' (expected one of: ${LAYERS.join(', ')})`,
    );
  }
  const packages = scanWorkspacePackages(root).filter(
    (p) => p.name && p.layer && LAYERS.includes(p.layer),
  );
  const paths = [];
  for (const p of packages.filter((p) => !allowed.includes(p.layer))) {
    paths.push({
      group: [p.name, `${p.name}/**`],
      message:
        `Epoch layer boundary: layer '${layer}' may not import '${p.name}' (layer '${p.layer}'). ` +
        `Allowed layers for '${layer}': ${allowed.join(', ')}.`,
    });
  }
  if (layer === 'app' || layer === 'service') {
    for (const p of packages.filter((p) => p.layer === 'pack')) {
      paths.push({
        group: [`${p.name}/src/**`, `${p.name}/internal/**`],
        message:
          `Epoch layer boundary: layer '${layer}' may not reach into pack internals of '${p.name}'; ` +
          `packs expose only their package entry / capability APIs.`,
      });
    }
  }
  return { rules: paths.length > 0 ? { 'no-restricted-imports': ['error', { paths }] } : {} };
}
