# W050 — Cross-Platform Release + Journey Closure

Status: BLOCKED_UNTIL_W047_W048_W049_COMPLETE
Wave: ACR-005 / final acceptance
Depends On: W047,W048,W049
Worker Count: 1

## Objective
Run the final cross-platform release gate, fix integration defects, and leave reproducible downloadable/launchable artifacts plus complete journey evidence.

## Owned write surfaces
- apps/web/*
- apps/desktop/*
- apps/mobile/*
- qa/cross-platform/*
- docs/journeys/*
- release/clients/*
- .github/workflows/*client*
- .github/workflows/*e2e*
- docs/release/*

This is serialized after W047-W049, so it is the only Work Order allowed to repair all three client trees.

## Required
Cross-client contract parity; install/launch/relaunch/update matrix; cross-device handoff; web production smoke; Linux/Windows/macOS artifacts; Android/iOS artifacts; final journey/defect ledgers; client/E2E CI; exact source commit + artifact checksums; final docs/state updates.

## Journey gate
Execute J01-J12 where applicable, J08 in at least two handoff directions, J11 on every client family, and J12 install -> launch -> work -> close -> relaunch -> update. For every defect: reproduce -> regression test -> fix -> rerun.

## Acceptance
- Web, Linux, Windows, macOS, Android and iOS launch.
- Same fixture has no semantic drift across clients.
- No offline duplicate/conflicting canonical records.
- Required journey matrix green.
- No unresolved P0/P1.
- Every P2 has disposition/evidence.
- Artifacts carry exact source/checksum metadata.
- CI/release checks pass.
- Handoff/state docs contain exact final SHAs.
