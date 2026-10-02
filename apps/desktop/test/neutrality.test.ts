// W017 + W048 acceptance: provider neutrality (lock rule 13).
//
// W017 pinned the whole package engine-free: no vendor vocabulary in
// source, the runtime dependency surface exactly the five-package pin.
// W048 turns the package into the native PRODUCT around the SAME W017
// experience surface — the discipline now scopes by zone:
//
//  - the W017 LIBRARY zone (src minus src/native): the original pin holds
//    UNCHANGED — engine-free, the frozen five-package runtime surface,
//    imports within the pin (the experience surface is not forked; the
//    reference host stays the typed contract);
//  - the W048 NATIVE ADAPTER zone (src/native): platform toolchains are
//    ADAPTERS, never semantic authorities — vendor vocabulary may appear
//    ONLY in the two declared adapter modules (ipc/host.ts, the host
//    command port, and ipc/transport.ts, the gateway transports); the
//    rest of the native zone (runtime/embedded/bridge) stays vendor-free;
//    the import surface stays within the W048 product pin (client-runtime
//    + the sanctioned composition set + @tauri-apps/api behind the
//    adapter modules only).
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(fileURLToPath(import.meta.url), '..');
const DESKTOP_ROOT = resolve(here, '..');
const LIBRARY_ZONE = resolve(DESKTOP_ROOT, 'src');
const NATIVE_ZONE = resolve(DESKTOP_ROOT, 'src', 'native');
/** The ONLY native-zone modules where vendor vocabulary may appear. */
const NATIVE_ADAPTER_MODULES = ['ipc/host.ts', 'ipc/transport.ts'];

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

/** The files of one zone with the other zone excluded. */
function zoneFiles(root: string, exclude?: string): string[] {
  return listSourceFiles(root).filter((file) => exclude === undefined || !file.startsWith(exclude));
}

describe('desktop provider neutrality (lock rule 13)', () => {
  it('no vendor identifiers appear in the W017 library zone (the reference host stays engine-free)', () => {
    const offenders: string[] = [];
    let scanned = 0;
    for (const file of zoneFiles(LIBRARY_ZONE, NATIVE_ZONE)) {
      if (isTestArtifact(file)) continue; // the denylist lives in tests
      scanned += 1;
      const text = readFileSync(file, 'utf-8').toLowerCase();
      for (const token of VENDOR_TOKENS) {
        if (text.includes(token)) {
          offenders.push(`${file}: ${token}`);
        }
      }
    }
    expect(scanned).toBeGreaterThan(0); // the scan found real sources
    expect(offenders).toEqual([]);
  });

  it('vendor identifiers appear ONLY in the declared native adapter modules (never in the native runtime)', () => {
    // The native-zone discipline tests COUPLING, not prose: docs may NAME
    // the platform toolkit (the adapter-zone comments say "Tauri"), but a
    // vendor IMPORT or dynamic vendor load may exist ONLY inside the two
    // declared adapter modules — the native runtime itself stays
    // engine-free exactly like the W017 library zone.
    const VENDOR_PACKAGE_PREFIXES = ['@tauri-apps', 'tauri', 'electron', 'webkit', 'gtk'];
    const offenders: string[] = [];
    let scanned = 0;
    for (const file of zoneFiles(NATIVE_ZONE)) {
      if (isTestArtifact(file)) continue;
      const relative = file.slice(NATIVE_ZONE.length + 1).split('\\').join('/');
      const isAdapter = NATIVE_ADAPTER_MODULES.includes(relative);
      scanned += 1;
      const text = readFileSync(file, 'utf-8');
      const specs = [
        ...[...text.matchAll(/\bfrom\s*['"]([^'"\n]+)['"]/g)].map((m) => m[1] ?? ''),
        ...[...text.matchAll(/import\(\s*['"]([^'"\n]+)['"]/g)].map((m) => m[1] ?? ''),
        ...[...text.matchAll(/\brequire\(\s*['"]([^'"\n]+)['"]/g)].map((m) => m[1] ?? ''),
      ];
      for (const spec of specs) {
        if (spec.startsWith('.') || spec.startsWith('node:')) continue;
        const isVendor = VENDOR_PACKAGE_PREFIXES.some((prefix) => spec === prefix || spec.startsWith(`${prefix}/`) || spec.startsWith(`${prefix}.`));
        if (isVendor && !isAdapter) {
          offenders.push(`${relative}: ${spec}`);
        }
      }
    }
    expect(scanned).toBeGreaterThan(10); // the native zone is real
    expect(offenders).toEqual([]);
    // And the adapter modules themselves exist (the declaration is live)
    // with their vendor coupling declared.
    for (const module of NATIVE_ADAPTER_MODULES) {
      expect(readFileSync(join(NATIVE_ZONE, module), 'utf-8').length).toBeGreaterThan(0);
    }
  });

  it('the runtime dependency surface is the frozen W017 pin PLUS the declared W048 product pin', () => {
    const manifest = JSON.parse(
      readFileSync(join(DESKTOP_ROOT, 'package.json'), 'utf-8'),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      epoch?: { layer?: string };
    };
    // The W017 library pin (src/index.ts + the reference host) plus the
    // W048 product pin: the gateway vocabulary, the composition
    // authorities (embedded mode), the webview vendor trio, and zod —
    // plus the W057 world-host wiring pin (the interactive world
    // composes the real experience-layer stack: the fabric, the world
    // runtime, the canonical projection, the capability registry) — and
    // the W061 closure pin: the two REAL engine renderers (the W058
    // Three.js + W059 Babylon.js adapters behind the frozen fabric seam)
    // plus `three` (catalog-pinned), the ONE engine runtime dependency —
    // the GL surface the desktop world-host seam
    // (app/components/world-host/browser-gl.ts) constructs the viewport
    // renderer over. The Babylon engine enters through the ADAPTER's
    // exported host factories (no @babylonjs/core import at the app
    // layer); replaceable presentation capabilities, never authority.
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual([
      '@epoch/action-gateway',
      '@epoch/adapter-renderer-babylonjs',
      '@epoch/adapter-renderer-threejs',
      '@epoch/agent-protocol',
      '@epoch/application-gateway',
      '@epoch/authentication',
      '@epoch/capability-registry',
      '@epoch/client-runtime',
      '@epoch/event-log',
      '@epoch/evidence',
      '@epoch/experience-protocol',
      '@epoch/object-storage',
      '@epoch/persistence',
      '@epoch/renderer-fabric',
      '@epoch/renderer-runtime',
      '@epoch/tenancy',
      '@epoch/world-experience',
      '@epoch/world-model',
      '@epoch/world-runtime',
      '@tauri-apps/api',
      'next',
      'react',
      'react-dom',
      'three',
      'zod',
    ]);
    expect(manifest.dependencies?.three).toBe('catalog:');
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

  it('library-zone imports stay within the W017 pin (the experience surface is not forked)', () => {
    const allowed = new Set([
      '@epoch/agent-protocol',
      '@epoch/experience-protocol',
      '@epoch/renderer-runtime',
      '@epoch/tenancy',
      'zod',
    ]);
    const offenders: string[] = [];
    for (const file of zoneFiles(LIBRARY_ZONE, NATIVE_ZONE)) {
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

  it('native-zone imports stay within the W048 product pin (adapters carry the vendor, never the runtime)', () => {
    // The native zone: client-runtime (the bridge), the composition
    // authorities (embedded mode), tenancy (the W017 runtime pin the shell
    // resolves scopes through), and @tauri-apps/api ONLY inside the two
    // adapter modules.
    const nativeAllowed = new Set([
      '@epoch/agent-protocol',
      '@epoch/client-runtime',
      '@epoch/action-gateway',
      '@epoch/application-gateway',
      '@epoch/authentication',
      '@epoch/authorization',
      '@epoch/event-log',
      '@epoch/evidence',
      '@epoch/object-storage',
      '@epoch/persistence',
      '@epoch/tenancy',
      '@epoch/world-model',
    ]);
    const offenders: string[] = [];
    for (const file of zoneFiles(NATIVE_ZONE)) {
      const relative = file.slice(NATIVE_ZONE.length + 1).split('\\').join('/');
      const isAdapter = NATIVE_ADAPTER_MODULES.includes(relative);
      const text = readFileSync(file, 'utf-8');
      const specs = [...text.matchAll(/\bfrom\s*['"]([^'"\n]+)['"]/g)].map((m) => m[1]);
      for (const spec of specs) {
        if (spec.startsWith('.') || spec.startsWith('node:')) continue;
        const base = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
        if (nativeAllowed.has(base)) continue;
        if (base === '@tauri-apps/api' && isAdapter) continue; // the declared adapter boundary
        offenders.push(`${relative}: ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
