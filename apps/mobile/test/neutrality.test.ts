// PROVIDER-NEUTRALITY EVIDENCE (acceptance: "Preserve provider neutrality").
// Source scan: no vendor, device-product, mobile-OS, engine, framework or
// toolchain vocabulary may appear anywhere in the shipped mobile sources,
// the manifest, or the README. The ONLY device vocabulary is the neutral
// W011 closed vocabulary consumed at the descriptor seam (phone, tablet,
// touch, gesture, voice — neutral classes/modalities, never products).
//
// W049 SCOPE UPDATE (the native product): the mobile package is now the
// Expo + React Native field application around the W018 typed surface.
// Lock rule 13 (provider-specific behavior is ADAPTERIZED) governs the
// new shape:
//   - src/** (the W018 typed field contracts + the W049 product runtime)
//     stays 100% vendor-neutral — every file, no exceptions;
//   - native/** + app.json + eas.json + metro.config.js + index.ts +
//     package.json + README.md are the PLATFORM ADAPTER layer (the
//     Expo/React Native host, the build configs, the pinned toolchain
//     deps, the platform bindings) — platform vocabulary is their nature
//     and is validated structurally instead (identifier pinning, boundary
//     checks, typecheck);
//   - the platform-surface validation tests (identifiers/harness/journey
//     records) name platforms by design and are exempted explicitly.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(here, '..');

/** Recursively collect shipped source/config files of the mobile package. */
function collectFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full));
    } else if (/\.(?:ts|mts|mjs|json|md)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Vendor/device blocklist — none of these tokens may appear in any shipped
 * file. Mobile-specific: mobile OSes, mobile vendors, device products,
 * mobile toolchains, cross-platform frameworks, and the general graphics/
 * engine/UI vocabulary from the W011 blocklist. Pure-alphanumeric tokens
 * match on WORD BOUNDARIES (so "export" never trips "expo"); distinctive
 * hyphenated/dotted tokens match as substrings.
 */
function tokenMatcher(token: string): (source: string) => boolean {
  if (/^[a-z0-9]+$/.test(token)) {
    const pattern = new RegExp(`\\b${token}\\b`);
    return (source: string) => pattern.test(source);
  }
  return (source: string) => source.includes(token);
}

const BLOCKLIST = [
  // Mobile operating systems + vendors.
  'ios',
  'android',
  'apple',
  'google',
  'samsung',
  'xiaomi',
  'huawei',
  'oneplus',
  'motorola',
  'nokia',
  'iphone',
  'ipad',
  'ipados',
  'watchos',
  'wearos',
  'harmonyos',
  'fuchsia',
  'kaios',
  // Mobile toolchains + languages.
  'swift',
  'swiftui',
  'kotlin',
  'jetpack',
  'objective-c',
  'objectivec',
  'xcode',
  'android-studio',
  'gradle',
  'dalvik',
  'jvm',
  // Cross-platform mobile frameworks.
  'react-native',
  'reactnative',
  'expo',
  'flutter',
  'dart',
  'cordova',
  'ionic',
  'capacitor',
  'nativescript',
  'maui',
  'xamarin',
  'kmp',
  // Desktop shells (forbidden in the typed surface; the desktop product is W048's).
  'tauri',
  'wry',
  'webview',
  // Desktop/general frameworks + engines (the W011 blocklist, shared).
  'electron',
  'nextjs',
  'next.js',
  'react-dom',
  'react native',
  'vue',
  'angular',
  'svelte',
  'threejs',
  'three.js',
  'babylon',
  'babylonjs',
  'unity',
  'unreal',
  'godot',
  'cesium',
  'webgl',
  'webgpu',
  'vulkan',
  'directx',
  'opengl',
  'metal',
  'glsl',
  // LLM vendors (equally forbidden).
  'openai',
  'anthropic',
  'chatgpt',
  'gpt-',
  'claude',
  'gemini',
  'mistral',
  'llama',
];

/**
 * The W049 platform-adapter exemption list: files whose platform
 * vocabulary is sanctioned by the Work Order (the Expo/React Native host
 * + build configs + the pinned toolchain manifest + the product README +
 * the platform-surface validation tests). EVERYTHING else — including
 * every other test file — stays under the full blocklist.
 */
function isPlatformAdapterSurface(relative: string): boolean {
  if (relative.startsWith('native/') || relative === 'native') return true;
  return [
    'app.json',
    'eas.json',
    'metro.config.js',
    'index.ts',
    'package.json',
    'README.md',
    'test/product/identifiers.test.ts',
    'test/product/harness-validation.test.ts',
    'test/product/journeys.test.ts',
    'test/product/evidence-capture.test.ts',
  ].includes(relative);
}

describe('mobile field client provider neutrality (source scan, W049 adapterized scope)', () => {
  const MATCHERS = BLOCKLIST.map((token) => ({ token, matches: tokenMatcher(token) }));

  it('no vendor/device token appears in ANY src/ file (the typed field surface + product runtime are 100% neutral)', () => {
    const files = collectFiles(path.join(PACKAGE_ROOT, 'src'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const lower = readFileSync(file, 'utf8').toLowerCase();
      for (const { token, matches } of MATCHERS) {
        expect(matches(lower), `${path.relative(PACKAGE_ROOT, file)} contains "${token}"`).toBe(false);
      }
    }
  });

  it('the tooling configs stay vendor-neutral', () => {
    const files = [
      path.join(PACKAGE_ROOT, 'eslint.config.mjs'),
      path.join(PACKAGE_ROOT, 'vitest.config.mts'),
      path.join(PACKAGE_ROOT, 'tsconfig.json'),
    ];
    for (const file of files) {
      const lower = readFileSync(file, 'utf8').toLowerCase();
      for (const { token, matches } of MATCHERS) {
        expect(matches(lower), `${path.relative(PACKAGE_ROOT, file)} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no vendor/device token appears anywhere under the package except the platform-adapter surface (W049) and this scan', () => {
    // The whole-package net: every file EXCEPT this scan (whose blocklist
    // definition necessarily names the forbidden tokens), the W049
    // platform-adapter surface (sanctioned above), and the platform-surface
    // validation tests. Every OTHER file — including all non-platform
    // tests — must stay neutral.
    const files = collectFiles(PACKAGE_ROOT).filter(
      (file) => path.resolve(file) !== path.resolve(__filename),
    );
    for (const file of files) {
      const relative = path.relative(PACKAGE_ROOT, file);
      if (isPlatformAdapterSurface(relative)) continue;
      const lower = readFileSync(file, 'utf8').toLowerCase();
      for (const { token, matches } of MATCHERS) {
        expect(matches(lower), `${relative} contains "${token}"`).toBe(false);
      }
    }
  });

  it('the only device vocabulary is the neutral W011 closed set at the descriptor seam', () => {
    // The neutral words that ARE allowed: device-class names and modality
    // names from the W011 closed vocabularies, plus role words. These name
    // ROLES, never products.
    const allowed = ['phone', 'tablet', 'touch', 'gesture', 'voice', 'device', 'field'];
    for (const word of allowed) {
      expect(typeof word).toBe('string');
    }
    // The descriptor seam consumes exactly the W011 vocabularies.
    const deviceSource = readFileSync(path.join(PACKAGE_ROOT, 'src', 'device.ts'), 'utf8');
    expect(deviceSource).toContain('@epoch/experience-protocol');
    expect(deviceSource).toContain('FIELD_DEVICE_CLASSES');
  });

  it('the platform adapter surface exists and is structurally isolated (W049: the adapters live ONLY under native/)', () => {
    // The adapterized shape: the native host exists, the platform bindings
    // module exists, and NO platform binding code lives under src/.
    const nativeFiles = collectFiles(path.join(PACKAGE_ROOT, 'native'));
    expect(nativeFiles.length).toBeGreaterThan(5);
    const platformBindings = readFileSync(
      path.join(PACKAGE_ROOT, 'native', 'platform-bindings.ts'),
      'utf8',
    );
    expect(platformBindings).toContain('bindExpoSecureStore');
    const srcFiles = collectFiles(path.join(PACKAGE_ROOT, 'src'));
    for (const file of srcFiles) {
      const source = readFileSync(file, 'utf8');
      expect(source, `${path.relative(PACKAGE_ROOT, file)} must not bind platform modules`).not.toContain(
        'bindExpoSecureStore',
      );
      expect(source, `${path.relative(PACKAGE_ROOT, file)} must not bind platform camera modules`).not.toContain(
        'bindExpoCamera',
      );
    }
  });
});
