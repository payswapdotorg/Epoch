# Epoch — Successor LLM Architect / Tech Lead Handoff

## Mission

Continue Epoch from the verified W001-W045 baseline and turn it into one actually usable engineering product without architectural drift.

The repository is the sole durable source of truth. This handoff is intentionally self-contained.

## Baseline

Main HEAD at handoff: `6912e4af4bab7a77e43d835b6bfc573aacee81f6`.

W001-W045 are complete: 45/45.

ACR-001 through ACR-004 are effective. E1.0/X1.0 authority invariants remain binding.

The current client code is deliberately not yet native/product-complete:
- `apps/web`: Next.js/React shell plus existing navigator/feature projection modules.
- `apps/desktop`: W017 typed shell/reference host; no native installer/bundle.
- `apps/mobile`: W018 typed field shell/reference host; no native app binary.

Therefore a fresh TL must not claim desktop/mobile distribution already exists.

## Effective architecture

ACR-005 — Productization, Native Clients & Journey Validation.

Read in order:
1. AGENTS.md
2. spec/architecture-lock.md
3. spec/architecture-change-requests/ACR-005-productization-native-clients.md
4. spec/productization-architecture.md
5. spec/journey-validation.md
6. spec/PROJECT-STATE.md
7. spec/work-items.md
8. spec/dependency-graph.md
9. spec/worker-runbook.md
10. assigned Work Order
11. live GitHub state

## Product topology

```
             EPOCH AUTHORITATIVE SERVICES
                       |
               Application Gateway
                       |
       +---------------+---------------+
       |               |               |
      Web           Desktop          Mobile
   Next.js/React    Tauri 2          Expo/RN
       |               |               |
       +---------- shared contracts ---+
                       |
             PostgreSQL / object bytes
```

One semantic product. Three clients. No client-side semantic authority.

## Authority invariants

World Model = world truth.
SolutionPackage/SolutionVersion = solution intent/baseline.
DeliveryRecord = delivery state.
ProgramOfWork = schedule authority.
Constraint Engine = constraint authority.
Action Gateway = execution authority.
Simulation = prediction.
Evaluation = judgment.
Verification/Evidence = proof.
Experience/client state = projection/interaction.
Local cache/queue = replay/session/projection only.

Never add a second lifecycle or semantic ledger.

## Platform decisions

### Web

Existing Next.js/React remains canonical. Productize lifecycle navigation, World View, agent/capability discovery, Solution Navigator, delivery/domain projections, marketplace/developer surfaces and recovery UX.

### Desktop

Use Tauri 2 around W017. Target:
- Linux AppImage + Debian-family package;
- Windows installer;
- macOS DMG/app bundle suitable for signing/notarization.

Native host concerns only: windows, filesystem pickers, safe credentials, notifications, updates and offline/session cache.

### Mobile

Use Expo + React Native around W018. Target:
- Android development/preview APK + production AAB;
- iOS simulator/device build + TestFlight-ready production configuration.

Mobile specializes in field capture, evidence, observations, approval, offline queue and synchronization.

## Work Order program

### W046 — Shared Product Runtime + Application Gateway

Initial sole worker; currently authorized.

Owned:
`contracts/application-gateway/*`
`packages/client-runtime/*`
`services/application-gateway/*`
`packages/persistence/*`
`packages/object-storage/*`
`packages/authentication/*`
`qa/fixtures/*`
`docs/product-runtime/*`
`spec/journeys/fixtures/*`

Build the shared client-facing gateway, PostgreSQL/object-storage/auth seams, tenant-safe authorization propagation, idempotency/correlation, recoverable errors, and deterministic construction/software fixtures.

Do not touch client app trees.

### W047 — Web Product + Browser Journey Validation

Depends on W046.

Own only web + web QA/journey record.

Execute J01-J11 + J12 smoke against a real running build. Fix P0/P1 defects and appropriate P2 issues. Browser interaction, not kernel calls, is the acceptance mechanism.

### W048 — Desktop Native Product + Desktop Journey Validation

Depends on W046.

Own only desktop + desktop QA/journey records.

Turn W017 into real Tauri 2 artifacts and test packaged applications on Linux, Windows and macOS. Cover install, launch, relaunch, update, offline/reconnect and cross-device handoff.

### W049 — Mobile Native Product + Mobile Journey Validation

Depends on W046.

Own only mobile + mobile QA/journey records.

Turn W018 into real Expo/RN applications and test Android/iOS built apps. Cover field evidence, offline interval, reconnect/sync, approval and handoff.

### W050 — Cross-Platform Release + Journey Closure

Depends on W047/W048/W049.

Serialized after all three client workers merge. It is the only Work Order permitted to repair all three client trees.

Run final cross-device, recovery and release/update journeys; close integration defects; publish artifact/checksum metadata; update final state docs.

## Journey validation is mandatory

Use spec/journey-validation.md.

Core journeys:
J01 onboarding/project entry
J02 understand/reconstruct
J03 capability/role discovery
J04 decide/approve
J05 plan/acquire
J06 realize/observe/verify
J07 offline/reconnect
J08 cross-device handoff
J09 agent supervision
J10 marketplace/developer
J11 recovery
J12 release/update

Defect loop:
`Observe -> record -> reproduce -> regression test -> fix -> rerun -> close`.

A green source suite alone does not close a client Work Order.

## Dispatch state

Authoritative initial state:
`active=[W046]`
`eligible=[]`
`blocked=[W047,W048,W049,W050]`

Next:
`W046 merged + reconciled -> W047|W048|W049 concurrently`

Then:
`W047 + W048 + W049 merged -> W050`

At most 3 workers.

One Work Order = one branch = one PR.
Workers never merge.
No-rebase default for concurrent disjoint surfaces.
Root manifests/lockfiles are Tech Lead serial work.

## Review gates

Retain the established 7 gates:
1. exact scope;
2. secret/token audit;
3. install preconditions;
4. governance/boundary;
5. independent battery;
6. CI on merge context;
7. complete evidence report.

For product client work add:
8. real artifact/build;
9. actual launch;
10. real journey execution;
11. defect/regression/fix/rerun evidence.

## Completion criteria

W050 cannot close until:
- web production product launches;
- Linux/Windows/macOS artifacts install and launch;
- Android/iOS builds install and launch;
- cross-device state is consistent;
- offline/reconnect is correct;
- Action Gateway remains authoritative;
- no unresolved P0/P1 defects;
- every P2 has disposition/evidence;
- artifacts have exact source commit + checksum;
- CI/E2E/release checks pass;
- PROJECT-STATE, state manifests and this handoff record exact final SHAs.

## Do not expand scope silently

W045 left four advisory questions: scheduler run-history, per-claim evidence digests, richer representation kinds, and richer organization composition. They are not blockers for ACR-005.

Any new semantic subsystem requires a new ACR + Work Order program.

## Final TL instruction

Dispatch W046 first from the current main baseline.

After W046 is accepted and reconciled, dispatch W047/W048/W049 concurrently.

Every platform must be built and actually used through its visible interface. When something breaks: document it in the journey ledger, reproduce it, add regression evidence, fix it, and rerun the affected journey.

Git + CI + journey evidence, not chat, is the completion oracle.
