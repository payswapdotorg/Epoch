// W014 shell feature isolation — THE SEAM TESTS.
//
// 1. Named negative: "the shell renders with the features directory
//    ABSENT". Features enter the shell ONLY through explicit registration
//    of a typed descriptor (src/shell/mounting.ts) — never through
//    directory discovery, dynamic import, or any implicit coupling. The
//    reference shell therefore renders identically whether or not any
//    feature library is present, and on this Work Order's branch the
//    features tree does not exist at all (the whole battery — typecheck,
//    lint, test, build — runs green with it absent).
//
// 2. Named negative: "no-feature-import invariant". No source file under
//    the W014-owned trees (app/**, src/shell/**, src/shared/**) imports or
//    references the features tree — statically proven, so the directory's
//    absence can never break compilation, and its presence (W023 lands
//    concurrently) can never couple the shell to a concrete feature.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppFrame } from './frame';
import { createReferenceShell, referenceShell } from './bootstrap';
import { HomeRouteSurface } from './route-surfaces';

const here = resolve(fileURLToPath(import.meta.url), '..');
const WEB_ROOT = resolve(here, '..', '..');
const OWNED_TREES = [
  resolve(WEB_ROOT, 'app'),
  resolve(WEB_ROOT, 'src', 'shell'),
  resolve(WEB_ROOT, 'src', 'shared'),
];
const FEATURES_DIR = resolve(WEB_ROOT, 'src', 'features');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

function listSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      out.push(...listSourceFiles(full));
    } else if (SOURCE_EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
      out.push(full);
    }
  }
  return out.sort();
}

/** Every import/require/dynamic-import specifier found in the owned trees. */
function collectImportSpecifiers(): string[] {
  const specifiers: string[] = [];
  // Matches: import ... from 'x', export ... from 'x', import 'x',
  // import('x'), require('x').
  const importPattern = /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;
  for (const tree of OWNED_TREES) {
    for (const file of listSourceFiles(tree)) {
      const text = readFileSync(file, 'utf8');
      for (const match of text.matchAll(importPattern)) {
        specifiers.push(match[1]);
      }
    }
  }
  return specifiers;
}

describe('shell feature isolation', () => {
  it('renders the shell with the features directory absent (named negative: isolation)', () => {
    // This Work Order ships no features tree; the shell must render with
    // zero registered features and empty mounted surfaces. If a later wave
    // lands a features tree, the registration-only seam below remains the
    // binding isolation proof (features never enter implicitly).
    const featuresDirState = existsSync(FEATURES_DIR) ? 'present' : 'absent';
    const shell = createReferenceShell();
    expect(shell.features.listFeatureIds()).toEqual([]);
    const html = renderToStaticMarkup(
      createElement(AppFrame, {
        routes: shell.routes,
        mounts: shell.mounts,
        features: shell.features,
        tenant: shell.tenant,
        session: shell.session,
        children: createElement(HomeRouteSurface, { shell }),
      }),
    );
    // The frame and its empty mounted surfaces render.
    expect(html).toContain('data-region="content"');
    expect(html).toContain('data-mount-empty="mount:content"');
    expect(html).toContain('data-experience-slot="scene"');
    expect(html).toContain('data-experience-slot="narrative"');
    expect(html).toContain('data-experience-slot="controls"');
    // No feature placeholder is rendered: zero registered features.
    expect(html).not.toContain('data-feature=');
    // On this branch the tree is literally absent — record it explicitly.
    if (featuresDirState === 'absent') {
      expect(shell.features.listFeatures()).toEqual([]);
    }
  });

  it('holds the no-feature-import invariant across the owned trees (named negative)', () => {
    const specifiers = collectImportSpecifiers();
    expect(specifiers.length).toBeGreaterThan(0); // the scan found real imports
    const offenders = specifiers.filter((specifier) => /(^|\/)features(\/|$)/.test(specifier));
    expect(offenders).toEqual([]);
    // And the shell source never reads the features tree from disk either.
    const ownedSources = OWNED_TREES.flatMap((tree) => listSourceFiles(tree));
    for (const file of ownedSources) {
      const text = readFileSync(file, 'utf8');
      // Construct the probe from parts so THIS file does not self-match a
      // literal features path used for runtime discovery.
      expect(text).not.toContain(["'src", '/features', "'"].join(''));
    }
  });

  it('the module-level reference shell registers no features by default', () => {
    expect(referenceShell.features.listFeatureIds()).toEqual([]);
  });
});
