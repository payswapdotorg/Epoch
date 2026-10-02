# Epoch Product Journey Validation Contract

This is the authoritative validation contract for W047-W050.

## Journey record
Record: journey_id, platform, persona, product_version, source_commit, environment, fixture_id, preconditions, actions, expected/observed outcomes, evidence, defect/severity, fix commit/PR, regression test, rerun result, disposition.

Journey records are evidence, never semantic state.

## Severity
P0 = data loss, cross-tenant exposure, broken authority boundary, impossible install/launch, catastrophic action/approval failure.
P1 = core journey blocked or unrecoverable.
P2 = material impairment with workaround.
P3 = polish/cosmetic.

W047-W049 cannot close with unresolved P0/P1 in owned journeys. P2 requires disposition. W050 closes integration/release defects.

## Journeys
J01 Onboard/project entry.
J02 Understand/reconstruct, inspect known/unknowns, acquire high-value missing information.
J03 Capability/role discovery and organization composition without hard-coded model->role mapping.
J04 Alternatives, constraints, evaluation, verification and Action Gateway approval.
J05 Program of Work, BOQ/domain schedule and acquisition/procurement.
J06 Realize, field observation, actualization, verification and forecast.
J07 Offline work, queue, reconnect, idempotent sync.
J08 Cross-device handoff.
J09 Agent supervision/intervention.
J10 Developer/marketplace capability flow.
J11 Recovery from network/session/input/action/connector/evidence failures.
J12 Install -> launch -> work -> close -> relaunch -> update.

## Minimum platform coverage
Web: J01-J11 + J12 smoke.
Desktop: J01-J09, J11, J12 on Linux, Windows and macOS.
Mobile: J01, J02 field subset, J04 approval subset, J06-J09 field subsets, J11, J12 on Android and iOS.

## Simulation protocol
Use a real running/built product against a deterministic fixture or deployed preview.
Interact through the visible client. Direct kernel calls do not substitute for UI journeys.
Web: browser automation with traces/screenshots on failure.
Desktop: packaged binaries with WebDriver/native UI automation; prefer WebdriverIO + Tauri service.
Mobile: built Android/iOS applications with Maestro or equivalent UI automation.
If automation cannot reliably execute a step, execute it manually and record it.

## Defect loop
Observe -> record -> reproduce -> regression test -> fix -> rerun affected journey -> rerun nearest related journeys -> close.

## Release gate
All required journeys pass; no unresolved P0/P1; every P2 has disposition/evidence; install/launch/relaunch/update passes; cross-device state is consistent.

# Production journeys (ACR-006)

The ACR-006 public deployment program adds the production journey set P01-P18. These are executed against the ACTUAL publicly deployed product (real public URL, HTTPS, production profile) — never from unit tests alone, never from a local dev build. The standard defect loop applies: observe → record → reproduce → regression test → fix → rerun → close.

Journey records follow the same record contract as J01-J12 (journey_id, platform=web-production, persona, product_version, source_commit, environment=production + public URL, fixture_id, preconditions, actions, expected/observed outcomes, evidence, defect/severity, fix commit/PR, regression test, rerun result, disposition). Screenshots or machine-readable traces are recorded where appropriate.

| ID | Journey |
|---|---|
| P01 | Public onboarding: anonymous visitor reaches the public URL over HTTPS, selects domain/persona, signs in, enters a working session. |
| P02 | Sign-in/session: session issue through the gateway; session valid across requests; sign-out. |
| P03 | Create/select tenant + project (the demo tenants' projects; selection, not creation — new tenant creation is out of ACR-006 scope). |
| P04 | Understand/reconstruct: world view over the deployed system. |
| P05 | Capability discovery through the deployed discovery surface. |
| P06 | Decide/approve: alternatives, constraints, Action Gateway approval. |
| P07 | Plan/acquire: Program of Work/BOQ + acquisition flow. |
| P08 | Realize/observe/verify: realization + observation + verification + forecast. |
| P09 | Offline/reconnect where the client permits (web client's offline queue behavior). |
| P10 | Cross-device handoff (web↔web session/state continuity where the client permits). |
| P11 | Agent supervision/intervention. |
| P12 | Recovery: network/session/input/action/connector/evidence failure recovery against the deployed system. |
| P13 | Public release/update path: deployment update (new commit → new deployment → still healthy). |
| P14 | Production persistence: authoritative state survives application/deployment restart. |
| P15 | Object/evidence upload + retrieval through the deployed system (digest-verified round trip). |
| P16 | Provider degradation/recovery: a provider dependency failing → typed degradation surfaced → recovery. |
| P17 | Rate-limit behavior: exceeding the configured budget → typed rate-limit response, no crash. |
| P18 | Tenant isolation: cross-tenant access attempts fail closed over the public endpoint. |

Severity and disposition rules follow the J01-J12 contract (P0/P1 must be zero at closure; every P2 needs disposition). Journeys that require provider credentials not yet available are recorded with honest NOT-RUNNABLE-at-boundary dispositions rather than fabricated passes.

W052 owns the production web journey evidence (docs/journeys/production-web.md); W055 consolidates (docs/journeys/production.md).
