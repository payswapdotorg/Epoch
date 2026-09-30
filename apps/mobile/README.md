# @epoch/mobile

Epoch Mobile Field Product (W018 typed reference host -> W049 native
application). Per `spec/architecture.md` §Clients: *web canonical; mobile
is optimized for field capture/review/approval* — this package is now the
real Expo + React Native Android/iOS field application around the W018
typed field surface, bound to the W046 shared product runtime.

## The product shape (W049)

```
native/                     the platform application (the adapter layer)
  App.tsx                   the field shell: onboarding + 5 field tabs
  screens/                  Onboard(J01) Project(J02) Capture(J06)
                            Approvals(J04) Queue(J07) Status(J08/J09/J11/J12)
  bootstrap.ts              boots the field product: the REAL W046 gateway
                            in-process + the platform seams
  platform-bindings.ts      the structural platform-module bindings (secure
                            store + camera) — vendor vocabulary lives ONLY here
  identifiers.ts            the stable product identity (the single source
                            app.json/eas.json/journey records pin against)
  fixtures/                 the bundled deterministic fixture records
                            (byte-identical to qa/fixtures/construction)
index.ts                    the Expo entry (registerRootComponent)
app.json / eas.json         the Expo config + the EAS build profiles
                            (APK, AAB, iOS simulator/device/TestFlight)
metro.config.js             the Expo Metro config

src/                        the typed surface — 100% provider-neutral
  (W018 contracts…)         sessions, capture envelopes, evidence,
                            approvals, queue, sync host (unchanged)
  product/                  the W049 product runtime (node-testable)
    gateway-client.ts       the typed client bridge over the frozen
                            32-operation Application Gateway vocabulary
    fixture-gateway.ts      the REAL W046 gateway seeded from the committed
                            fixtures (tenancy/world/evidence/action/session)
    field-host.ts           the product engine (J01-J12 surfaces)
    offline.ts              the offline queue/reconnect/idempotent sync
                            (client-runtime OfflineProjectionQueue + replay)
    capture-pipeline.ts     W018 envelopes -> W038 authority intake
    evidence-capture.ts     the digest-addressed evidence pipeline
    secure-store.ts         the platform secure-store SEAM (tokens NEVER
                            in AsyncStorage/plaintext)
    camera.ts               the field camera SEAM
    sha256.ts               pure-TS SHA-256 (digest BEFORE upload)
```

## The authority discipline (unchanged from W018, now over the gateway)

- **Actions execute only through the Action Gateway** (lock rule 3): every
  observation/approval leaves through the frozen gateway vocabulary
  (`delivery.observe`, `action.submit`, `action.approve`); the mobile
  approval surface is a strict subset of that vocabulary (test-pinned);
  there is no local settlement code path anywhere.
- **No second semantic store** (lock rules 8/16): the offline queue holds
  PENDING PROJECTIONS of user intent only (the five W046 named negatives,
  enforced by `@epoch/client-runtime` admission); reconnect drains through
  the Action Gateway path with idempotency keys — exactly once, verified.
- **Evidence is digest-addressed**: camera bytes are hashed (pure-TS
  SHA-256) BEFORE upload; the object-storage authority recomputes the
  digest; every record references the digest, never a local path.
- **Unambiguous work-package linkage**: anchors resolve to exactly one
  work package client-side; ambiguity is a typed rejection (and the W038
  authority re-enforces it server-side).
- **Sessions persist only through the platform secure store seam**.
- **Determinism**: zero wall-clock, zero randomness in the product core.

## Scripts

```
pnpm --filter @epoch/mobile typecheck   # tsc --noEmit (src + native)
pnpm --filter @epoch/mobile lint        # eslint .
pnpm --filter @epoch/mobile test        # vitest run (unit + integration + journey simulation)
```

## Running the native app (infra with the mobile toolchains)

```
cd apps/mobile
npx expo start                 # the dev server (Expo Go / dev client)
npx expo run:android           # the Android device/emulator build
npx expo run:ios               # the iOS simulator/device build
```

EAS build profiles (`eas.json`): `android-apk` (internal APK),
`android-aab` (store AAB), `ios-simulator` (internal simulator build),
`ios-device` (adhoc), `ios-testflight` (store/TestFlight-ready).
Stable identifiers: `org.payswapdotorg.epoch` (Android package + iOS
bundle identifier), version 1.0.0, versionCode/buildNumber 1 — pinned by
`test/product/identifiers.test.ts` against `app.json` + `eas.json`.

The E2E harness (detox) lives under `qa/mobile/` — see `qa/mobile/README.md`.

See `spec/work-orders/W049-mobile-native-product.md` for the Work Order,
`spec/worker-runbook.md` for the branch/PR/evidence rules, and
`docs/journeys/mobile-{android,ios}.md` for the journey records.
