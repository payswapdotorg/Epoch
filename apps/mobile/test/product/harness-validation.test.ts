// THE E2E HARNESS VALIDATION (the W049 "unit-validated harness" pin):
// the detox harness under qa/mobile/ cannot run device/emulator tests in
// this sandbox (no Android SDK, no Xcode) — but its CORRECTNESS is
// validated here:
//   1. the .detoxrc.json parses and carries the complete shape (apps for
//      BOTH platforms, devices, configurations for emulator + attached +
//      simulator);
//   2. every required journey spec exists (the mobile journey subset);
//   3. every testID referenced by a spec EXISTS in the native sources
//      (a broken selector is a caught defect BEFORE infra runs);
//   4. the jest wiring resolves detox from the workspace pin;
//   5. the journey coverage equals the contract's mobile subset.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(here, '..', '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const HARNESS_ROOT = path.join(REPO_ROOT, 'qa', 'mobile');

const detoxrc = JSON.parse(readFileSync(path.join(HARNESS_ROOT, '.detoxrc.json'), 'utf8')) as {
  apps: Record<string, { type: string; binaryPath: string; build?: string }>;
  devices: Record<string, { type: string }>;
  configurations: Record<string, { device: string; app: string }>;
};

/** Every testID referenced by the e2e specs (the by.id('...') literals). */
function testIdsOfSpec(source: string): string[] {
  const ids: string[] = [];
  const pattern = /by\.id\(\s*'([^']+)'\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    ids.push(match[1]!);
  }
  return ids;
}

/** The native sources (where the testIDs must exist). */
function nativeSources(): string {
  const nativeDir = path.join(PACKAGE_ROOT, 'native');
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(tsx|ts)$/.test(entry.name)) files.push(readFileSync(full, 'utf8'));
    }
  };
  walk(nativeDir);
  return files.join('\n');
}

const REQUIRED_JOURNEYS = ['j01', 'j02', 'j04', 'j06', 'j07', 'j08', 'j09', 'j11', 'j12'];

describe('the qa/mobile detox harness (W049: complete, runnable-on-infra, unit-validated)', () => {
  it('the .detoxrc.json carries the complete shape: apps for BOTH platforms, devices, and the 5 configurations', () => {
    // The apps: Android debug + release, iOS debug + release.
    expect(Object.keys(detoxrc.apps)).toContain('android.debug');
    expect(Object.keys(detoxrc.apps)).toContain('android.release');
    expect(Object.keys(detoxrc.apps)).toContain('ios.debug');
    expect(Object.keys(detoxrc.apps)).toContain('ios.release');
    expect(detoxrc.apps['android.debug']!.type).toBe('android.apk');
    expect(detoxrc.apps['ios.debug']!.type).toBe('ios.app');
    // The devices: Android emulator + attached, iOS simulator.
    expect(Object.keys(detoxrc.devices)).toContain('android.emulator');
    expect(Object.keys(detoxrc.devices)).toContain('android.attached');
    expect(Object.keys(detoxrc.devices)).toContain('ios.simulator');
    // The configurations.
    const configurations = Object.keys(detoxrc.configurations);
    expect(configurations).toContain('android.emulator.debug');
    expect(configurations).toContain('android.emulator.release');
    expect(configurations).toContain('android.attached.release');
    expect(configurations).toContain('ios.simulator.debug');
    expect(configurations).toContain('ios.simulator.release');
    // Every configuration references existing devices + apps.
    for (const configuration of Object.values(detoxrc.configurations)) {
      expect(detoxrc.devices[configuration.device]).toBeDefined();
      expect(detoxrc.apps[configuration.app]).toBeDefined();
    }
  });

  it('the app build commands + binary paths point at the apps/mobile tree (the Expo prebuild flow)', () => {
    for (const app of Object.values(detoxrc.apps)) {
      expect(app.binaryPath.startsWith('../../apps/mobile/')).toBe(true);
      if (app.build !== undefined) {
        expect(app.build).toContain('apps/mobile');
      }
    }
    // The Android builds use the Expo prebuild + gradle flow.
    expect(detoxrc.apps['android.debug']!.build).toContain('prebuild');
    expect(detoxrc.apps['android.debug']!.build).toContain('gradlew');
    // The iOS builds use xcodebuild against the generated workspace.
    expect(detoxrc.apps['ios.debug']!.build).toContain('xcodebuild');
  });

  it('every required journey spec exists (the mobile journey subset)', () => {
    const e2eDir = path.join(HARNESS_ROOT, 'e2e');
    const specs = readdirSync(e2eDir).filter((file) => file.endsWith('.e2e.js'));
    for (const journey of REQUIRED_JOURNEYS) {
      const matching = specs.filter((spec) => spec.startsWith(journey));
      expect(matching.length, `the ${journey} journey spec must exist under qa/mobile/e2e`).toBeGreaterThan(0);
    }
    // The shared helpers + jest wiring exist.
    expect(existsSync(path.join(e2eDir, 'helpers.js'))).toBe(true);
    expect(existsSync(path.join(e2eDir, 'jest.config.js'))).toBe(true);
  });

  it('every testID referenced by the specs EXISTS in the native sources (no broken selectors)', () => {
    const sources = nativeSources();
    // Static testIDs: testID="literal".
    const staticIds = new Set<string>();
    for (const match of sources.matchAll(/testID="([^"]+)"/g)) {
      staticIds.add(match[1]!);
    }
    // Dynamic (template) testIDs: testID={`prefix-${...}`}.
    const templatePrefixes: string[] = [];
    for (const match of sources.matchAll(/testID=\{`([A-Za-z0-9-]+)-\$\{/g)) {
      templatePrefixes.push(`${match[1]!}-`);
    }
    const e2eDir = path.join(HARNESS_ROOT, 'e2e');
    for (const spec of readdirSync(e2eDir).filter((file) => file.endsWith('.e2e.js'))) {
      const source = readFileSync(path.join(e2eDir, spec), 'utf8');
      for (const testId of testIdsOfSpec(source)) {
        const staticMatch = staticIds.has(testId);
        const templateMatch = templatePrefixes.some((prefix) => testId.startsWith(prefix));
        expect(
          staticMatch || templateMatch,
          `${spec} references testID "${testId}" which does not exist in apps/mobile/native`,
        ).toBe(true);
      }
    }
  });

  it('the jest wiring resolves detox from the workspace pin (apps/mobile/node_modules)', () => {
    const jestConfig = readFileSync(path.join(HARNESS_ROOT, 'e2e', 'jest.config.js'), 'utf8');
    expect(jestConfig).toContain('moduleDirectories');
    expect(jestConfig).toContain('apps');
    // The pinned detox version is installed in the workspace.
    const detoxPackage = JSON.parse(
      readFileSync(path.join(PACKAGE_ROOT, 'node_modules', 'detox', 'package.json'), 'utf8'),
    ) as { version: string };
    expect(detoxPackage.version).toBe('20.51.4');
  });

  it('the journey coverage equals the mobile subset of spec/journey-validation.md', () => {
    // J01, J02 field subset, J04 approval subset, J06-J09 field subsets,
    // J11, J12 — one spec per journey, on BOTH platform configurations.
    const covered = new Set(
      readdirSync(path.join(HARNESS_ROOT, 'e2e'))
        .filter((file) => file.endsWith('.e2e.js'))
        .map((file) => file.split('.')[0]!.split('-')[0]!),
    );
    for (const journey of REQUIRED_JOURNEYS) {
      expect(covered.has(journey)).toBe(true);
    }
  });

  it('the harness README documents the prerequisites + the honest sandbox gap', () => {
    const readme = readFileSync(path.join(HARNESS_ROOT, 'README.md'), 'utf8');
    expect(readme).toContain('detox');
    expect(readme).toContain('Android SDK');
    expect(readme).toContain('Xcode');
    expect(readme).toContain('harness-validation.test.ts');
  });
});
