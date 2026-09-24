# W038 — Execution Tracking & Field Observation
Status: READY_AFTER_DEPENDENCIES
Depends On: W036,W006,W007,W010
Worker Count: 1
Owned surfaces: packages/execution-tracking/*, services/execution-tracking/*, contracts/execution/*

## Objective
Track execution progress and lightweight field observations without requiring exhaustive manual data entry.

## Must provide
- work package/activity execution state;
- planned vs actual quantity/time/resource records;
- material consumption, waste and rework;
- defects/issues and verification references;
- observation ingestion with provenance/confidence;
- one-tap/low-friction observation forms at contract level;
- estimated/assumed/inferred values that remain usable with confidence;
- automatic progress updates when validated observations arrive.

## Acceptance
Fixtures prove partial observations can update delivery state, retain provenance and confidence, and leave unresolved unknowns explicit rather than blocking unrelated work.
