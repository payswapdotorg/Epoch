/**
 * @epoch/mobile — the stable product identifiers (W049).
 *
 * THE single source of truth for the Android/iOS product identity every
 * build config and journey record references:
 *  - the Android application id (`org.payswapdotorg.epoch`);
 *  - the iOS bundle identifier (the SAME value — one product identity);
 *  - the Expo slug/scheme and the human product name;
 *  - the product version + versionCode/buildNumber (bumped together).
 *
 * `app.json` (the Expo config) and `eas.json` (the build profiles) carry the
 * SAME values; test/product/identifiers.test.ts parses BOTH files and pins
 * them to this module, so identifier drift fails CI (the "stable identifiers"
 * acceptance: an update that changes one without the other is a typed test
 * failure, never a silent store rejection).
 *
 * Values are literals (deterministic, no randomness, no wall-clock).
 */

/** The Android application id (the Play Store identity). */
export const ANDROID_APPLICATION_ID = 'org.payswapdotorg.epoch' as const;

/** The iOS bundle identifier (the App Store identity — one product identity). */
export const IOS_BUNDLE_IDENTIFIER = 'org.payswapdotorg.epoch' as const;

/** The Expo project slug (the EAS build identity). */
export const EXPO_SLUG = 'epoch-field' as const;

/** The Expo deep-link scheme (provider-neutral: no vendor vocabulary). */
export const EXPO_SCHEME = 'epochfield' as const;

/** The human product name shown under the launcher icon. */
export const PRODUCT_NAME = 'Epoch Field' as const;

/** The product version (SemVer; the store-visible version). */
export const PRODUCT_VERSION = '1.0.0' as const;

/** The Android versionCode (monotonic integer; bumped with every release). */
export const ANDROID_VERSION_CODE = 1 as const;

/** The iOS buildNumber (monotonic; bumped with every release). */
export const IOS_BUILD_NUMBER = '1' as const;

/** The EAS build profiles the product ships (qa/mobile + eas.json reference them). */
export const EAS_BUILD_PROFILES = [
  'android-apk',
  'android-aab',
  'ios-simulator',
  'ios-device',
  'ios-testflight',
] as const;

/** One EAS build profile name. */
export type EasBuildProfile = (typeof EAS_BUILD_PROFILES)[number];

/** The two platforms a field build targets (journey-record platform values). */
export const MOBILE_PLATFORMS = ['android', 'ios'] as const;

/** One mobile platform. */
export type MobilePlatform = (typeof MOBILE_PLATFORMS)[number];

/** The mapping platform -> store-ready distribution channel (documentation-grade). */
export const PLATFORM_DISTRIBUTION: Readonly<Record<MobilePlatform, string>> = {
  android: 'APK (internal/sideload + emulator) and AAB (Play Store)',
  ios: 'simulator build (internal), device build (adhoc), TestFlight (store)',
} as const;

/**
 * The stable identity record (what every journey record's
 * `product_version`/environment fields and every build config carry).
 */
export interface MobileProductIdentity {
  readonly productName: string;
  readonly androidApplicationId: string;
  readonly iosBundleIdentifier: string;
  readonly expoSlug: string;
  readonly expoScheme: string;
  readonly productVersion: string;
  readonly androidVersionCode: number;
  readonly iosBuildNumber: string;
}

/** The stable identity (frozen). */
export const MOBILE_PRODUCT_IDENTITY: MobileProductIdentity = {
  productName: PRODUCT_NAME,
  androidApplicationId: ANDROID_APPLICATION_ID,
  iosBundleIdentifier: IOS_BUNDLE_IDENTIFIER,
  expoSlug: EXPO_SLUG,
  expoScheme: EXPO_SCHEME,
  productVersion: PRODUCT_VERSION,
  androidVersionCode: ANDROID_VERSION_CODE,
  iosBuildNumber: IOS_BUILD_NUMBER,
} as const;
