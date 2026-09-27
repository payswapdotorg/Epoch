// W017 acceptance: provider neutrality (lock rule 13) — no
// engine/vendor/framework/native-toolkit vocabulary in desktop source
// (the reference host is engine-free), and the runtime dependency
// surface stays exactly the frozen W017 pin. The architecture-level
// client-family designation (spec/architecture.md "Clients" + this
// package's README) is the one locked seam where the native-wrapper
// vendor name may appear — src/ and test/ carry none of it.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(fileURLToPath(import.meta.url), '..');
const DESKTOP_ROOT = resolve(here, '..');
const OWNED_TREES = [resolve(DESKTOP_ROOT, 'src')];

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

/**
 * Vendor identifiers that must never appear in desktop source: native
 * wrapper toolkits, windowing/graphics APIs, engines, UI frameworks,
 * auth vendors, and cloud providers. The denylist itself lives in this
 * test file (excluded from the scan, the W014 precedent).
 */
const VENDOR_TOKENS: readonly string[] = [
  // Native wrapper toolkits / desktop stacks (the reserved shell).
  'tauri',
  'electron',
  'webkit',
  'gtk',
  'wxwidgets',
  'cocoa',
  'win32',
  'winui',
  // Graphics APIs / engines (W013/W019 own adapters, never the shell).
  'directx',
  'vulkan',
  'metal',
  'opengl',
  'webgl',
  'webgpu',
  'three.js',
  'babylon',
  'cesium',
  'unity',
  'unreal',
  'godot',
  // UI frameworks (the reference shell renders nothing).
  'react',
  'vue',
  'angular',
  'svelte',
  // Identity/auth vendors.
  'auth0',
  'okta',
  'cognito',
  'clerk',
  'nextauth',
  'firebase',
  'supabase',
  // Cloud/providers.
  'aws',
  'azure',
  'gcp',
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

describe('desktop provider neutrality (lock rule 13)', () => {
  it('no vendor identifiers appear in owned source (the reference host is engine-free)', () => {
    const offenders: string[] = [];
    let scanned = 0;
    for (const tree of OWNED_TREES) {
      for (const file of listSourceFiles(tree)) {
        if (isTestArtifact(file)) continue; // the denylist lives in tests
        scanned += 1;
        const text = readFileSync(file, 'utf-8').toLowerCase();
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

  it('the runtime dependency surface stays exactly the frozen W017 pin', () => {
    // Provider neutrality in dependency form: the ONLY runtime
    // dependencies are the five pinned packages; every other @epoch/*
    // reference is a devDependency parity pin, never a runtime coupling.
    const manifest = JSON.parse(
      readFileSync(join(DESKTOP_ROOT, 'package.json'), 'utf-8'),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      epoch?: { layer?: string };
    };
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual([
      '@epoch/agent-protocol',
      '@epoch/experience-protocol',
      '@epoch/renderer-runtime',
      '@epoch/tenancy',
      'zod',
    ]);
    const devDeps = Object.keys(manifest.devDependencies ?? {}).sort();
    expect(devDeps).toContain('@epoch/experience-compiler');
    expect(devDeps).toContain('@epoch/identity');
    expect(devDeps).toContain('@epoch/authorization');
    for (const dep of Object.keys(manifest.devDependencies ?? {})) {
      if (dep.startsWith('@epoch/')) {
        expect(manifest.devDependencies?.[dep]).toBe('workspace:*');
      }
    }
    // The layer marker stays.
    expect(manifest.epoch?.layer).toBe('app');
  });

  it('runtime source imports stay within the runtime dependency set (no devDep runtime coupling)', () => {
    // Scan src/ import specifiers: only the five pinned packages plus
    // relative imports may appear.
    const allowed = new Set([
      '@epoch/agent-protocol',
      '@epoch/experience-protocol',
      '@epoch/renderer-runtime',
      '@epoch/tenancy',
      'zod',
    ]);
    const offenders: string[] = [];
    for (const file of listSourceFiles(resolve(DESKTOP_ROOT, 'src'))) {
      const text = readFileSync(file, 'utf-8');
      const specs = [...text.matchAll(/\bfrom\s*['"]([^'"\n]+)['"]/g)].map((m) => m[1]);
      for (const spec of specs) {
        if (spec.startsWith('.') || spec.startsWith('node:')) continue;
        const base = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
        if (!allowed.has(base)) {
          offenders.push(`${file}: ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
