# Epoch Project State

Architecture: E1.0 / X1.0
Work Order schema: WO1.0
Default branch: main
Max concurrent workers: 3

Current frontier:
- W001-W007 COMPLETE
- W008/W009/W011 AUTHORIZED — wave 4, three workers, pairwise-disjoint surfaces
- W010 WAITING_ON_DEPENDENCIES (needs W009); all other successor work remains dependency-gated.

Current main head: c7430b6478213b0fe9e97f4c159ff9608be77b32

## Approved architecture change
ACR-001 was approved 2026-09-24.

Approved target:
- SolutionPackage/Version + DeliveryRecord
- Program of Work synchronized with the BOQ/solution schedule
- procurement, execution, actualization, variance and forecast
- outcome learning/calibration
- low-friction partial observations and confidence/provenance
- fine-grained access projections
- supervision/alerts
- optional provider-neutral external event bridge, with Aurum Chat as a reference adapter only.

ACR-001 is not effective for new implementation yet. The current W008/W009/W011 wave remains on E1.0/X1.0. The Architect/Tech Lead must record the lock transition and frontier update after that wave is stabilized before dispatching W036.

## Delivery successor frontier
W036-W044 are defined under spec/work-items.md and individual work-order files, all READY_AFTER_DEPENDENCIES. No W036-W044 item is currently authorized.

Every merge must update this file with exact ancestry, verification baseline, frontier and review lessons.
