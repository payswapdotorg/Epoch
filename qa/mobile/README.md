# qa/mobile — the W049 mobile E2E harness (detox)

The detox E2E harness for the Epoch mobile field product (`apps/mobile`):
the journey specs (J01/J02/J04/J06-J09/J11/J12 — the mobile subset of
`spec/journey-validation.md`) executed against the BUILT Android/iOS
applications.

## What is here

| File | Content |
|---|---|
| `.detoxrc.json` | The detox configuration: apps (Android debug/release APK, iOS debug/release simulator builds), devices (Android emulator + attached device, iOS simulator), 5 configurations (android.emulator.debug/release, android.attached.release, ios.simulator.debug/release) |
| `e2e/jest.config.js` | The jest wiring (self-locating; module resolution extends to `apps/mobile/node_modules` where detox is pinned) |
| `e2e/helpers.js` | The shared spec helpers (launch, sign-in, tab navigation, expectations) |
| `e2e/j*.e2e.js` | One spec per journey (the required mobile subset) |

## Prerequisites (the toolchains this sandbox lacks)

- Node 22 + the workspace installed (`pnpm install` at the repo root).
- Android: Android SDK + an emulator AVD (e.g. `Pixel_8_API_35`) or an
  attached device; JAVA 17+ (the sandbox has OpenJDK 21 but NO SDK/adb —
  recorded honestly in the W049 journey records).
- iOS: Xcode + an iOS simulator (e.g. iPhone 16) — macOS only (this Linux
  sandbox has NO Xcode — recorded honestly).

## Running

```bash
# Android (debug, on the emulator):
cd apps/mobile
npx detox test -C ../qa/mobile/.detoxrc.json -c android.emulator.debug

# Android (release, on the emulator):
npx detox test -C ../qa/mobile/.detoxrc.json -c android.emulator.release

# Android (release, attached device):
npx detox test -C ../qa/mobile/.detoxrc.json -c android.attached.release

# iOS (debug, on the simulator):
npx detox test -C ../qa/mobile/.detoxrc.json -c ios.sim.debug

# iOS (release, on the simulator):
npx detox test -C ../qa/mobile/.detoxrc.json -c ios.sim.release
```

The first run builds the app (the `build` command in `.detoxrc.json`:
`expo prebuild` + gradle assemble / xcodebuild). Release artifacts for the
stores come from the EAS profiles (`apps/mobile/eas.json`):
`android-apk`, `android-aab`, `ios-simulator`, `ios-device`,
`ios-testflight`.

## The honest validation state

- This harness is COMPLETE and runnable-on-infra (the configs parse, the
  specs address real testIDs rendered by `apps/mobile/native`, the jest
  wiring resolves detox from the workspace pin).
- It is UNIT-VALIDATED in-sandbox by
  `apps/mobile/test/product/harness-validation.test.ts`: the detox
  configuration shape (apps/devices/configurations for BOTH platforms),
  every required journey spec present, every testID referenced by a spec
  exists in the native sources, and the spec/journey coverage equals the
  mobile journey subset.
- Device/emulator runs were NOT executed in this sandbox (no Android SDK,
  no Xcode — Linux). See `docs/journeys/mobile-android.md` and
  `docs/journeys/mobile-ios.md` for the honest journey records and the
  environment gap.
