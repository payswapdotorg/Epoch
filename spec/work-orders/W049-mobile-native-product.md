# W049 — Mobile Native Product + Mobile Journey Validation

Status: BLOCKED_UNTIL_W046_COMPLETE
Wave: ACR-005 / client
Depends On: W046
Worker Count: 1

## Objective
Turn the W018 typed mobile reference host into a real Expo + React Native Android/iOS field application and validate built apps.

## Owned write surfaces
- apps/mobile/*
- qa/mobile/*
- docs/journeys/mobile-android.md
- docs/journeys/mobile-ios.md

Do not edit web/desktop implementation.

## Required
Expo/RN native host around W018; stable Android/iOS identifiers; camera/evidence capture; offline queue/replay through W046; unambiguous work-package observation/progress; Action Gateway approval; secure session storage; reconnect/sync; Android APK + AAB config; iOS simulator/device + TestFlight-ready config; mobile E2E.

## Journey gate
Execute the mobile subset in spec/journey-validation.md on Android and iOS built applications, including an actual offline interval and reconnect/sync assertion. P0/P1 defects must be fixed before closure.

## Acceptance
- Android installs/launches on supported device/emulator.
- iOS installs/launches on supported simulator/device.
- Evidence is digest-addressed.
- Offline/reconnect is idempotent.
- Ambiguous work-package linkage is rejected.
- Approval cannot bypass gateway.
- Cross-device state is observable.
- Android/iOS journeys and CI are green.
