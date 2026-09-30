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
    const manifest = JSON.parse(
      readFileSync(join(WEB_ROOT, 'package.json'), 'utf8'),
    ) as Record<string, Record<string, string>>;
    const runtime = Object.keys(manifest.dependencies ?? {}).sort();
    expect(runtime.length).toBeGreaterThan(0);
    for (const dep of runtime) {
      if (dep.startsWith('@epoch/')) {
        expect(manifest.dependencies?.[dep]).toBe('workspace:*');
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
