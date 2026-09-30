# Mobile Journey Records — iOS (W049)

The iOS journey records of the Epoch mobile field product (W049), executed
against the product engine of `apps/mobile` (the W018 typed field surface
over the W046 Application Gateway, the offline queue, the digest-addressed
evidence pipeline and the platform seams).

**Governing contract**: `spec/journey-validation.md`.

**HONEST ENVIRONMENT STATEMENT (the sandbox honesty rule)**: this work
order executed in a Linux (Debian 13) sandbox — **macOS/Xcode is
structurally unavailable on Linux**, so an iOS simulator/device run was
**IMPOSSIBLE in this sandbox** and was **NOT performed**. What WAS
executed for real (identical to the Android record, because the product
engine, the fixtures, the harness specs and the assertions are
platform-shared — only the build target differs):

1. **The journey simulation** — the complete journey step sequence through
   the actual product engine (`apps/mobile/test/product/journeys.test.ts`
   produces a record for BOTH platforms; every iOS record below asserts
   the same real executions).
2. **The E2E harness** — the complete detox harness with the iOS
   configurations (`qa/mobile/.detoxrc.json`: `ios.sim.debug` /
   `ios.sim.release` on an iPhone-16-class simulator, the xcodebuild app
   builds against the Expo prebuild workspace), the SAME journey specs
   (the UI testIDs are platform-identical), unit-validated by
   `apps/mobile/test/product/harness-validation.test.ts`. The
   simulator/device execution requires macOS infra — commands in
   `qa/mobile/README.md`.

iOS build config (delivered): `apps/mobile/app.json` (bundleIdentifier
`org.payswapdotorg.epoch`, buildNumber "1", supportsTablet) +
`apps/mobile/eas.json` (`ios-simulator` internal build profile,
`ios-device` adhoc profile, `ios-testflight` store/TestFlight-ready
profile) — identifier-pinned by
`apps/mobile/test/product/identifiers.test.ts`.

Product version: 1.0.0 · Fixture: `epoch-fixture-construction-v1.0.0`
· Source commit: the W049 branch head (see the PR).

---

## J01 — Onboard / project entry (iOS)

- Platform: ios · Persona: principal:delivery-lead (field engineer)
- Environment: linux sandbox — engine simulation + harness; simulator run NOT performed (no Xcode on Linux).
- Preconditions/steps/expected: identical to the Android J01 record (the platform-shared engine).
- Observed (engine, real): session issued through the gateway; secure-store-only persistence; field session opened; project context + world digest resolved. Harness: `qa/mobile/e2e/j01-onboarding.e2e.js` (same specs, iOS configurations).
- Evidence: `apps/mobile/test/product/journeys.test.ts` (J01, ios record) — green.
- Defects: none. · Disposition: **simulated-pass** (simulator run deferred to macOS infra; harness complete + validated).

## J02 — Understand / inspect known/unknowns (iOS, field subset)

- Observed (engine, real): the fixture work packages/activities/milestones project; the schedule folds return; the world entities projection is readable. Harness: `j02-project.e2e.js`.
- Evidence: `journeys.test.ts` (J02, ios) — green.
- Defects: none. · Disposition: **simulated-pass** (field subset).

## J04 — Approval subset (iOS)

- Observed (engine, real): submit → `awaiting-approval` (decision `requires-approval`); approve → applied through the Action Gateway ONLY; status → `authorized`. The strict-subset + no-local-settlement negatives pinned. Harness: `j04-approvals.e2e.js`.
- Evidence: `journeys.test.ts` (J04, ios) + `named-negatives.test.ts` (b) — green.
- Defects: none. · Disposition: **simulated-pass** (approval subset).

## J06 — Realize: field observation + digest-addressed evidence (iOS)

- Observed (engine, real): the anchor resolved to exactly one work package; the photo digest computed BEFORE upload matched the authority's recomputation; `delivery.observe` recorded the outcome; the progress capture admitted. Harness: `j06-capture.e2e.js`.
- Evidence: `journeys.test.ts` (J06, ios) + `evidence-capture.test.ts` + `named-negatives.test.ts` (a) — green.
- Defects: none. · Disposition: **simulated-pass**.

## J07 — Offline work, queue, reconnect, idempotent sync (iOS)

- Observed (engine, real): the actual offline interval (network seam) → queued pending projection → transient drain failure (`network-unavailable`) → reconnect drain THROUGH the gateway with the idempotency key → replay proof `replayed=true`, `digestStable=true`, `duplicateSideEffects=0` → a third submission of the same key still returned the recorded outcome. Harness: `j07-offline-sync.e2e.js` (asserts zero duplicates).
- Evidence: `journeys.test.ts` (J07, ios) + `named-negatives.test.ts` (c) — green.
- Defects: none. · Disposition: **simulated-pass**.

## J08 — Cross-device handoff (iOS)

- Observed (engine, real): the mobile-resolved world/program digests equal the registry anchors (what web/desktop resolve from the same fixtures) and the bundled fixture digest. Harness: `j08-cross-device.e2e.js`.
- Evidence: `journeys.test.ts` (J08, ios) + `fixtures.test.ts` — green.
- Defects: none. · Disposition: **simulated-pass** (cross-device state observable).

## J09 — Agent supervision / intervention (iOS, field subset)

- Observed (engine, real): the supervision pass sealed over the fixture program + delivery; the pending actions readable. Harness: `j09-supervision.e2e.js`.
- Evidence: `journeys.test.ts` (J09, ios) — green.
- Defects: none. · Disposition: **simulated-pass**.

## J11 — Recovery (iOS)

- Observed (engine, real): session expiry → typed `re-authenticate`; re-auth restored; the offline drain's transient error; the authority rejection verbatim. Harness: `j11-recovery.e2e.js`.
- Evidence: `journeys.test.ts` (J11, ios) — green.
- Defects: none. · Disposition: **simulated-pass**.

## J12 — Install → launch → work → close → relaunch → update (iOS)

- Observed (engine, real): relaunch restored the session from the secure store (same identity); sign-out revoked + cleared; fresh sign-in after. The simulator install/update cycle is macOS-infra scope (the ios-simulator/device/TestFlight profiles + buildNumber pinning). Harness: `j12-relaunch.e2e.js`.
- Evidence: `journeys.test.ts` (J12, ios) — green.
- Defects: none. · Disposition: **simulated-pass** (binary cycle deferred to macOS infra; the state machine pinned).

---

## Defect ledger (iOS)

| Defect | Severity | Reproduction | Fix | Regression test | Status |
|---|---|---|---|---|---|
| none recorded | — | — | — | — | — |

No P0/P1 defects. No unresolved P2.

## Honest limitations

- **No simulator/device run**: Linux has no Xcode (audit recorded in the
  PR: `xcodebuild -version` → command not found). The built-app journeys
  must run on macOS infra:
  `cd apps/mobile && npx detox test -C ../qa/mobile/.detoxrc.json -c ios.sim.debug`
  (or the release configuration). The harness is complete and
  unit-validated; the engine-level simulations all passed for real.
- TestFlight submission readiness is CONFIG-delivered (the
  `ios-testflight` EAS store profile + the stable bundle identifier +
  buildNumber); an actual submission requires an Apple developer account +
  EAS credentials on infra — outside the sandbox by nature.
- The camera/secure-store platform bindings are structural adapter seams
  (see the Android record's camera note — identical on iOS).
