// W014 shell provider neutrality: the shell is vendor-neutral by
// construction (lock rule 13) — no authentication/session vendor SDKs, no
// renderer/engine SDKs, no cloud/provider vocabulary in shell types. This
// test statically scans the W014-owned SOURCE files (test files excluded —
// they contain this denylist) for vendor identifiers.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(fileURLToPath(import.meta.url), '..');
const WEB_ROOT = resolve(here, '..', '..');
const OWNED_TREES = [
  resolve(WEB_ROOT, 'app'),
  resolve(WEB_ROOT, 'src', 'shell'),
  resolve(WEB_ROOT, 'src', 'shared'),
];

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

/** Vendor identifiers that must never appear in shell source. */
const VENDOR_TOKENS: readonly string[] = [
  // Identity/auth vendors and protocol SDKs (typed seams only in the shell).
  'auth0',
  'okta',
  'cognito',
  'clerk',
  'nextauth',
  'next-auth',
  'firebase',
  'supabase',
  'amplify',
  'oidc',
  'oauth',
  'openid',
  'passport',
  // Renderer/engine SDKs (W013/W019 own adapters, never the shell).
  'three.js',
  'babylon',
  'webgl',
  'webgpu',
  'cesium',
  // Payment/commerce vendors (marketplace adapters, never the shell).
  'stripe',
  'paypal',
  'plaid',
];

function listSourceFiles(dir: string): string[] {
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

function isTestArtifact(file: string): boolean {
  const base = file.slice(file.lastIndexOf('/') + 1);
  return base.includes('.test.') || base.includes('.types.');
}

describe('shell provider neutrality', () => {
  it('no vendor identifiers appear in owned shell source (lock rule 13)', () => {
    const offenders: string[] = [];
    let scanned = 0;
    for (const tree of OWNED_TREES) {
      for (const file of listSourceFiles(tree)) {
        if (isTestArtifact(file)) continue; // this denylist lives in tests
        scanned += 1;
        const text = readFileSync(file, 'utf8').toLowerCase();
        for (const token of VENDOR_TOKENS) {
          if (text.includes(token)) {
            offenders.push(`${file}: ${token}`);
          }
        }
      }
    }
    expect(scanned).toBeGreaterThan(0); // the scan found real sources
    expect(offenders).toEqual([]);
  });

  it('the runtime dependency surface stays within the W047 pin (next/react/react-dom + @epoch workspace packages)', () => {
    // Provider neutrality in dependency form (W047 pin 8): runtime deps
    // stay minimal — the app framework trio plus @epoch/* workspace
    // packages (the product runtime composition + the frozen client
    // contract surface). NO third-party runtime dependency may appear;
    // every @epoch/* reference (runtime or dev) is a workspace link.
    //
    // The W061/X2.0 sanctioned exception (the world-host GL seam): `three`
    // is the ONE non-framework runtime dependency, catalog-pinned — the
    // engine surface the world host seam (src/features/world/host/
    // browser-gl.ts) constructs the viewport's GL renderer over, behind
    // the frozen renderer-fabric adapter seam (the W061 work order's
    // engine-import discipline: engine imports live ONLY in the adapter
    // packages and that app-level seam). It is a replaceable presentation
    // capability, never semantic authority — the pin's substance holds.
    const manifest = JSON.parse(
      readFileSync(join(WEB_ROOT, 'package.json'), 'utf8'),
    ) as Record<string, Record<string, string>>;
    const runtime = Object.keys(manifest.dependencies ?? {}).sort();
    expect(runtime.length).toBeGreaterThan(0);
    for (const dep of runtime) {
      if (dep.startsWith('@epoch/')) {
        expect(manifest.dependencies?.[dep]).toBe('workspace:*');
      } else if (dep === 'three') {
        // The W061 GL-seam exception: catalog-pinned, never a version literal.
        expect(manifest.dependencies?.[dep]).toBe('catalog:');
      } else if (dep === 'pg') {
        // The ACR-006 post-credential deployment-importer exception
        // (2026-10-03): the DEPLOYMENT root declares the pg driver so the
        // bundled server can resolve the frozen service-layer dynamic
        // import (import(PG_DRIVER_MODULE), external per the W046 pin-5
        // boundary) from node_modules at runtime. Catalog-pinned, never a
        // version literal; NO shell source imports pg (the pg-boundary
        // battery enforces that); the driver binds only at the
        // service-layer seam — the pin's substance holds.
        expect(manifest.dependencies?.[dep]).toBe('catalog:');
      } else if (/^pg-/.test(dep) || dep === 'pgpass' || /^postgres-/.test(dep)) {
        // The flattened runtime closure of the driver (same exception,
        // second leg): exact pins resolved from the driver's own manifest —
        // the pnpm isolated layout places these as store siblings no lambda
        // path can resolve; declaring them at the deployment importer puts
        // every runtime-reachable file at a resolvable path. Never a range.
        expect(manifest.dependencies?.[dep]).toMatch(/^\d+\.\d+\.\d+$/);
      } else {
        expect(['next', 'react', 'react-dom']).toContain(dep);
      }
    }
    for (const dep of Object.keys(manifest.devDependencies ?? {})) {
      if (dep.startsWith('@epoch/')) {
        expect(manifest.devDependencies[dep]).toBe('workspace:*');
      } else if (dep.startsWith('@playwright')) {
        expect(manifest.devDependencies[dep]).toBe('catalog:');
      }
    }
    // The layer marker stays.
    expect((manifest as { epoch?: { layer?: string } }).epoch?.layer).toBe('app');
  });
});
