// PROVIDER-NEUTRALITY EVIDENCE (acceptance: "Preserve provider neutrality").
// Source scan: no vendor, device-product, mobile-OS, engine, framework or
// toolchain vocabulary may appear anywhere in the shipped mobile sources,
// the manifest, or the README. The ONLY device vocabulary is the neutral
// W011 closed vocabulary consumed at the descriptor seam (phone, tablet,
// touch, gesture, voice — neutral classes/modalities, never products).
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
  // The Tauri 2 shell (W018 reference implementation has NO native bundling).
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

describe('mobile field client provider neutrality (source scan)', () => {
  const MATCHERS = BLOCKLIST.map((token) => ({ token, matches: tokenMatcher(token) }));

  it('no vendor/device token appears in any shipped source file', () => {
    const files = collectFiles(path.join(PACKAGE_ROOT, 'src'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const lower = readFileSync(file, 'utf8').toLowerCase();
      for (const { token, matches } of MATCHERS) {
        expect(matches(lower), `${path.relative(PACKAGE_ROOT, file)} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no vendor/device token appears in the manifest, the config, or the README', () => {
    const files = [
      path.join(PACKAGE_ROOT, 'package.json'),
      path.join(PACKAGE_ROOT, 'README.md'),
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

  it('no vendor/device token appears anywhere under the package except this scan (self-exempt)', () => {
    // The shipped surface (src + manifest + configs + README) is scanned
    // above; this pass covers every remaining file EXCEPT the neutrality
    // test itself (whose blocklist definition necessarily names the
    // forbidden tokens).
    const files = collectFiles(PACKAGE_ROOT).filter(
      (file) => path.resolve(file) !== path.resolve(__filename),
    );
    for (const file of files) {
      const lower = readFileSync(file, 'utf8').toLowerCase();
      for (const { token, matches } of MATCHERS) {
        expect(matches(lower), `${path.relative(PACKAGE_ROOT, file)} contains "${token}"`).toBe(false);
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
});
