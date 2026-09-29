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
