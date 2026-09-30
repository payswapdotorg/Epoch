# Mobile Journey Records — Android (W049)

The Android journey records of the Epoch mobile field product (W049),
executed against the product engine of `apps/mobile` (the W018 typed
field surface over the W046 Application Gateway, the offline queue, the
digest-addressed evidence pipeline and the platform seams).

**Governing contract**: `spec/journey-validation.md` (the journey record
fields, severity classes, defect loop, release gate).

**HONEST ENVIRONMENT STATEMENT (the sandbox honesty rule)**: this
work order executed in a Linux (Debian 13) sandbox with OpenJDK 21
present but **NO Android SDK (adb absent) and NO emulator** — and no
Xcode (Linux). A real Android device/emulator run was therefore
**IMPOSSIBLE in this sandbox** and was **NOT performed**. What WAS
executed for real, per journey, is:

1. **The journey simulation** — the complete journey step sequence driven
   through the actual product engine (`MobileFieldHost` over the real
   W046 `ApplicationGateway` seeded from the committed construction
   fixture, the real W038/W022/W043 authorities, the scripted camera +
   network seams). Assertions are pinned in
   `apps/mobile/test/product/journeys.test.ts` (and the named-negative /
   evidence / harness suites). These are REAL executions of the product
   code — not mocks of semantics — at the engine level the native UI
   renders.
2. **The E2E harness** — the complete detox harness for the BUILT
   application (`qa/mobile/`: `.detoxrc.json` with Android
   debug/release/attached configurations, one spec per required journey
   addressing the real rendered testIDs), unit-validated by
   `apps/mobile/test/product/harness-validation.test.ts` (configuration
   shape, spec presence, selector existence, detox 20.51.4 pin). The
   device/emulator execution itself requires infra with the Android
   toolchain — the exact commands are in `qa/mobile/README.md`.

Android build config (delivered): `apps/mobile/app.json` (package
`org.payswapdotorg.epoch`, versionCode 1) + `apps/mobile/eas.json`
(`android-apk` internal APK profile, `android-aab` store AAB profile) —
identifier-pinned by `apps/mobile/test/product/identifiers.test.ts`.

Product version: 1.0.0 · Fixture: `epoch-fixture-construction-v1.0.0`
· Source commit: the W049 branch head (see the PR).

---

## J01 — Onboard / project entry (Android)

- Platform: android · Persona: principal:delivery-lead (field engineer)
- Environment: linux sandbox — engine simulation + harness; device run NOT performed (no Android SDK)
- Preconditions: app installed and launched; bundled fixture identity.
- Steps: launch → onboarding surface (boot mode: transport/secure store/camera honestly rendered) → sign in.
- Expected: session issues through the gateway (`session.issue` over the fixture VERIFIED auth result); the session persists ONLY through the secure store seam; the W018 field session opens; the project context + world projection resolve.
- Observed (engine, real): session active; secure store holds exactly `epoch.field.session`; field session opened; `context.resolve` returned the project node; world snapshot digest available. Harness: `qa/mobile/e2e/j01-onboarding.e2e.js` (onboard-screen / onboard-sign-in / app-root / app-session / network-badge / project tab).
- Evidence: `apps/mobile/test/product/journeys.test.ts` (J01) — green.
- Defects: none. · Regression: the J01 test IS the regression pin.
- Disposition: **simulated-pass** (device run deferred to Android-toolchain infra; harness complete + validated).

## J02 — Understand / reconstruct, inspect known/unknowns (Android, field subset)

- Platform: android · Persona: field engineer.
- Steps: project tab → work packages / schedule folds / world entities / known-unknown surface.
- Expected: the program projections list the fixture work packages; the schedule folds project; the known/unknown discipline (uncertainty on every capture) is surfaced.
- Observed (engine, real): 2 work packages (`work-package:warehouse-substructure`, `work-package:warehouse-superstructure`), 3+ activities, 2 milestones; `program.schedule` folds returned; `world.entities` readable. Harness: `j02-project.e2e.js`.
- Evidence: `apps/mobile/test/product/journeys.test.ts` (J02) — green.
- Defects: none. · Disposition: **simulated-pass** (field subset).

## J04 — Approval subset (Android)

- Platform: android · Persona: chief-engineer (approver) via the delivery-lead session.
- Steps: approvals tab → submit field review proposal → approve → status.
- Expected: the proposal submits through `action.submit` (decision `requires-approval`); the approval applies through `action.approve` ONLY (the mobile approval surface is the strict subset `action.submit|action.approve|action.status` of the frozen vocabulary — pinned by test); the status reads `authorized` after approval.
- Observed (engine, real): submit → `awaiting-approval`; approve → applied through the Action Gateway authority; status → `authorized`. The approval-cannot-bypass-gateway negative is pinned in `named-negatives.test.ts` (b). Harness: `j04-approvals.e2e.js`.
- Evidence: `apps/mobile/test/product/journeys.test.ts` (J04) + `named-negatives.test.ts` (b) — green.
- Defects: none. · Disposition: **simulated-pass** (approval subset).

## J06 — Realize: field observation + digest-addressed evidence (Android)

- Platform: android · Persona: field engineer.
- Steps: capture tab → select work package (unambiguous linkage) → quantity + mandatory uncertainty → attach photo (digest-addressed) → submit.
- Expected: the anchor resolves to exactly ONE work package (ambiguity is a typed rejection — never a guess); the photo digest is computed BEFORE upload and the object-storage authority's recomputation matches; the observation intakes through `delivery.observe` (the W038 authority); progress is projected by the authority, never invented.
- Observed (engine, real): anchor resolved; evidence digest `…` verified (client pre-computation === authority recomputation); `delivery.observe` outcome digest recorded; the progress-measure capture admitted; the capture envelope carries the same evidence digest the authority stored. Harness: `j06-capture.e2e.js`.
- Evidence: `apps/mobile/test/product/journeys.test.ts` (J06), `evidence-capture.test.ts`, `named-negatives.test.ts` (a) — green.
- Defects: none. · Disposition: **simulated-pass**.

## J07 — Offline work, queue, reconnect, idempotent sync (Android)

- Platform: android · Persona: field engineer.
- Steps: queue tab → enter the offline interval → capture (queued) → offline drain attempt → reconnect + sync → read the exactly-once proof.
- Expected: the intent queues as a PENDING projection (never applied locally); the drain DURING the offline interval fails transiently (`network-unavailable`) and stays pending; the reconnect drains THROUGH the Action Gateway path with the idempotency key; the replay of the same key returns the RECORDED outcome — exactly once, zero duplicate side effects.
- Observed (engine, real): queue 1 pending; offline drain stillPending=1 with `lastErrorCode=network-unavailable`; reconnect drained=1; replay proof `replayed=true`, `digestStable=true`, `duplicateSideEffects=0`; a THIRD submission of the same key still returned the recorded outcome. Harness: `j07-offline-sync.e2e.js` (asserts `queue-sync-duplicates` renders 0).
- Evidence: `apps/mobile/test/product/journeys.test.ts` (J07) + `named-negatives.test.ts` (c) — green.
- Defects: none. · Disposition: **simulated-pass** (the ACTUAL offline interval is scripted at the network seam — the transport layer; the queue/replay/idempotence is the real W046 client-runtime machinery over the real gateway).

## J08 — Cross-device handoff (Android)

- Platform: android · Persona: field engineer.
- Steps: status tab → cross-device state (world digest + program digest + session scope).
- Expected: the mobile-resolved digests equal the authoritative registry digests (what the web/desktop products resolve from the same fixtures).
- Observed (engine, real): `worldDigest === registry.worldDigest === bundled native/fixtures/world.json digest`; `programContentDigest === registry.programContentDigest`. Harness: `j08-cross-device.e2e.js` (asserts the match marker).
- Evidence: `apps/mobile/test/product/journeys.test.ts` (J08) + `fixtures.test.ts` — green.
- Defects: none. · Disposition: **simulated-pass** (cross-device state observable).

## J09 — Agent supervision / intervention (Android, field subset)

- Platform: android · Persona: chief-engineer (supervisor).
- Steps: status tab → supervision pass; approvals tab → pending actions.
- Expected: the supervision pass evaluates over the real W043 authority (the fixture program + delivery); the pending actions project through `action.status`.
- Observed (engine, real): `supervision.check` returned the sealed pass (`pass:j09-field`); the action list readable. Harness: `j09-supervision.e2e.js`.
- Evidence: `apps/mobile/test/product/journeys.test.ts` (J09) — green.
- Defects: none. · Disposition: **simulated-pass** (supervision field subset).

## J11 — Recovery from session/network/authority failures (Android)

- Platform: android · Persona: field engineer.
- Steps: expire the session (short TTL) → call → re-authenticate → go offline + drain → submit a malformed proposal.
- Expected: the expired session maps to the typed `auth-session-expired` error with the `re-authenticate` recovery action; re-authentication restores a working session; the offline drain fails with the typed transient error; the authority rejection surfaces verbatim with its typed details.
- Observed (engine, real): `auth-session-expired`/`session-expired` → `re-authenticate`; re-auth active; `network-unavailable` (transient); `authority-rejected` carrying `@epoch/action-gateway` validation issues. Harness: `j11-recovery.e2e.js`.
- Evidence: `apps/mobile/test/product/journeys.test.ts` (J11) — green.
- Defects: none. · Disposition: **simulated-pass**.

## J12 — Install → launch → work → close → relaunch → update (Android)

- Platform: android · Persona: field engineer.
- Steps: launch + sign in + capture (work) → relaunch (fresh host over the same authorities) → sign out → relaunch (fresh sign-in).
- Expected: the relaunch restores the session from the secure store (validated against the gateway); the restored session keeps the identity; sign-out revokes through the gateway and clears the secure store; the next launch signs in fresh.
- Observed (engine, real): restored=true with the SAME sessionId; world digest consistent across relaunch; secure store cleared after sign-out; fresh sign-in (restored=false). The install/update cycle itself is infra/CI scope: the APK/AAB build profiles + versionCode pinning (`identifiers.test.ts`). Harness: `j12-relaunch.e2e.js` (background + newInstance relaunch).
- Evidence: `apps/mobile/test/product/journeys.test.ts` (J12) — green.
- Defects: none. · Disposition: **simulated-pass** (the binary install/update cycle requires Android-toolchain infra; the state machine is pinned).

---

## Defect ledger (Android)

| Defect | Severity | Reproduction | Fix | Regression test | Status |
|---|---|---|---|---|---|
| none recorded | — | — | — | — | — |

No P0/P1 defects. No unresolved P2. (The full W049 defect notes —
including the in-development findings fixed before delivery — are in the
PR body; every fix carries its regression test.)

## Honest limitations

- **No device/emulator run**: the sandbox has no Android SDK/adb/emulator
  (audit recorded in the PR: `adb --version` → command not found). The
  built-app journeys must run on infra with the Android toolchain:
  `cd apps/mobile && npx detox test -C ../qa/mobile/.detoxrc.json -c android.emulator.debug`
  (or the release/attached configurations). The harness is complete and
  unit-validated; the engine-level simulations all passed for real.
- The camera on device binds the platform camera module through the
  structural adapter seam (`native/platform-bindings.ts`); in this sandbox
  every evidence capture ran on the scripted deterministic frame source.
  The digest-addressing invariant is identical either way (the pipeline
  hashes whatever bytes the seam returns).
- The gateway composition is the W046 single-process (in-process typed
  library) binding; the HTTP transport deployment is the documented
  upgrade seam (unchanged above the transport port).
