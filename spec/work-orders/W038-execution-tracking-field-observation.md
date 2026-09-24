# W038 — Realization Tracking + Low-Friction Field Observation
Status: READY_AFTER_DEPENDENCIES
Depends On: W036,W006,W007,W010
Worker Count: 1
Owned surfaces: packages/execution-tracking/*, services/execution-tracking/*, contracts/execution/*

## Objective

Implement the universal realization-tracking layer and low-friction observation ingestion. Construction execution is one projection; other domains may use build, deployment, fabrication, installation or commissioning terminology.

## Must provide
- work-package/activity state;
- progress actualization;
- labor/equipment/material/resource observations;
- field evidence references;
- changes, delays, rework, defects and blockers;
- confidence/provenance/freshness;
- replay/idempotent observation handling;
- explicit separation of Observation from Actual.

## Acceptance

Fixtures prove partial observations can be recorded without destructive overwrites and can be reconciled into delivery state without bypassing authority or verification boundaries.
