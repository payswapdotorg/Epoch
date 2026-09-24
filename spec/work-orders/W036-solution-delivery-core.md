# W036 — Solution Delivery Core
Status: READY_AFTER_DEPENDENCIES
Depends On: W002,W003,W004,W006,W009,W010,W011
Worker Count: 1
Owned surfaces: packages/solution-delivery/*, contracts/solution-delivery/*, docs/solution-delivery/*

## Objective
Implement the universal SolutionPackage/SolutionVersion/DeliveryRecord/ProgramOfWork semantic contracts.

## Must provide
- immutable solution baselines and explicit revisions;
- work packages, activities, dependencies and milestones;
- synchronized quantity/cost/resource schedules;
- procurement/execution/verification references;
- prediction, estimate, commitment, actual and forecast distinction;
- uncertainty/provenance/freshness/confidence states;
- information-acquisition requests;
- provider-neutral external request/event contracts;
- delivery lifecycle event vocabulary;
- program-of-work views usable by domain packs.

## Acceptance
Contract tests prove round-trip serialization, immutability/versioning, schedule dependency integrity, lifecycle-state separation and provider-neutral external event/request types. Core packages must not import Aurum-specific modules/types.
