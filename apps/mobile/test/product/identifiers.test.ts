// The stable-identifier pinning: app.json (the Expo config) + eas.json
// (the build profiles) must carry EXACTLY the identity values declared in
// native/identifiers.ts — one product identity across Android/iOS, every
// build profile present, versions bumped together. Identifier drift is a
// test failure, never a silent store rejection.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ANDROID_APPLICATION_ID,
  ANDROID_VERSION_CODE,
  EAS_BUILD_PROFILES,
  EXPO_SCHEME,
  EXPO_SLUG,
  IOS_BUILD_NUMBER,
  IOS_BUNDLE_IDENTIFIER,
  MOBILE_PLATFORMS,
  MOBILE_PRODUCT_IDENTITY,
  PLATFORM_DISTRIBUTION,
  PRODUCT_NAME,
  PRODUCT_VERSION,
} from '../../native/identifiers';

const here = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(here, '..', '..');

const appJson = JSON.parse(readFileSync(path.join(PACKAGE_ROOT, 'app.json'), 'utf8')) as {
  expo: Record<string, unknown>;
};
const easJson = JSON.parse(readFileSync(path.join(PACKAGE_ROOT, 'eas.json'), 'utf8')) as {
  build: Record<string, unknown>;
};

describe('the stable product identifiers (W049 acceptance)', () => {
  it('app.json pins the exact identity: name, slug, version, scheme, Android package + versionCode, iOS bundle + buildNumber', () => {
    const expo = appJson.expo!;
    expect(expo['name']).toBe(PRODUCT_NAME);
    expect(expo['slug']).toBe(EXPO_SLUG);
    expect(expo['version']).toBe(PRODUCT_VERSION);
    expect(expo['scheme']).toBe(EXPO_SCHEME);
    const android = expo['android'] as Record<string, unknown>;
    expect(android['package']).toBe(ANDROID_APPLICATION_ID);
    expect(android['versionCode']).toBe(ANDROID_VERSION_CODE);
    const ios = expo['ios'] as Record<string, unknown>;
    expect(ios['bundleIdentifier']).toBe(IOS_BUNDLE_IDENTIFIER);
    expect(ios['buildNumber']).toBe(IOS_BUILD_NUMBER);
  });

  it('the Android application id and the iOS bundle identifier are the SAME value (one product identity)', () => {
    expect(ANDROID_APPLICATION_ID).toBe(IOS_BUNDLE_IDENTIFIER);
    expect(MOBILE_PRODUCT_IDENTITY.androidApplicationId).toBe(MOBILE_PRODUCT_IDENTITY.iosBundleIdentifier);
    expect(ANDROID_APPLICATION_ID).toMatch(/^org\.payswapdotorg\.epoch$/);
  });

  it('every EAS build profile exists in eas.json (APK, AAB, iOS simulator/device/TestFlight-ready)', () => {
    const profiles = Object.keys(easJson.build!);
    for (const profile of EAS_BUILD_PROFILES) {
      expect(profiles, `eas.json must define the "${profile}" build profile`).toContain(profile);
    }
    // The distribution semantics: store profiles for the AAB + TestFlight.
    expect((easJson.build!['android-aab']! as Record<string, unknown>)['distribution']).toBe('store');
    expect((easJson.build!['ios-testflight']! as Record<string, unknown>)['distribution']).toBe('store');
    expect((easJson.build!['android-apk']! as Record<string, unknown>)['distribution']).toBe('internal');
    expect((easJson.build!['ios-simulator']! as Record<string, unknown>)['distribution']).toBe('internal');
    // The APK/AAB build types.
    expect(
      (easJson.build!['android-apk']! as Record<string, unknown>)['android'],
    ).toEqual({ buildType: 'apk' });
    expect(
      (easJson.build!['android-aab']! as Record<string, unknown>)['android'],
    ).toEqual({ buildType: 'app-bundle' });
    // The iOS simulator profile targets the simulator.
    expect(
      (easJson.build!['ios-simulator']! as Record<string, unknown>)['ios'],
    ).toEqual({ simulator: true });
  });

  it('the platforms + distribution channels are declared (journey-record platform vocabulary)', () => {
    expect([...MOBILE_PLATFORMS].sort()).toEqual(['android', 'ios']);
    for (const platform of MOBILE_PLATFORMS) {
      expect(PLATFORM_DISTRIBUTION[platform]).toMatch(/APK|simulator|TestFlight/);
    }
  });

  it('the version is a valid SemVer and the codes are monotonic-start integers', () => {
    expect(PRODUCT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(Number.isInteger(ANDROID_VERSION_CODE)).toBe(true);
    expect(ANDROID_VERSION_CODE).toBeGreaterThan(0);
    expect(IOS_BUILD_NUMBER).toMatch(/^\d+$/);
  });
});
