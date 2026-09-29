# W047 — Web Product + Browser Journey Validation

Status: BLOCKED_UNTIL_W046_COMPLETE
Wave: ACR-005 / client
Depends On: W046
Worker Count: 1

## Objective
Turn apps/web into the canonical usable Epoch product and validate it through real browser journeys.

## Owned write surfaces
- apps/web/*
- qa/web/*
- docs/journeys/web.md

Do not edit desktop/mobile implementation.

## Required
Productize tenant/project entry, lifecycle navigator, World View, unknowns/evidence, agent/capability discovery, solution alternatives/constraints/evaluation/verification, Solution Navigator, Program of Work/domain schedule/BOQ projections, acquisition/delivery/realization/actualization/forecast, Gateway approval, marketplace/developer and recovery states. Provide responsive/accessibility baseline and browser E2E.

## Journey gate
Execute J01-J11 + J12 smoke from spec/journey-validation.md against a real running build. Use browser automation/traces. Reproduce -> regression test -> fix -> rerun every P0/P1 and appropriate P2 issue found in scope.

## Acceptance
- Fresh user reaches a project and navigator.
- Construction fixture reaches decision, approved solution, schedule/BOQ, field observation, verification and forecast.
- Software fixture reaches architecture/release-plan/verification projections.
- Capability discovery is visible without hard-coded model->role semantics.
- UI cannot bypass Action Gateway.
- Reload resolves authoritative state.
- Required journeys and CI are green.
