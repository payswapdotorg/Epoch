# The ProgramOfWork Scheduling Model (W036)

The ProgramOfWork is the AUTHORITATIVE SCHEDULE DIMENSION inside the
solution/delivery domain (USL1.0). A domain pack can rename or regroup the
presentation (BOQ + construction programme, BOM + assembly sequence,
roadmap + dependency schedule, commissioning plan), but a pack schedule
must be a ProgramOfWork projection — never a competing schedule authority.

## The realization graph

```
ProgramOfWork
├── workPackages (sorted by workPackageId)
│   ├── realizationVariant        (one of the seven realization variants)
│   ├── solutionLineId?           (Navigator identity preservation)
│   ├── worldEntityId?            (Navigator identity preservation)
│   ├── plannedStart / plannedFinish?  (OPTIONAL — decision sufficiency)
│   ├── resources                 (opaque resource refs + quantity + unit)
│   ├── constraintReferences      (opaque W004 constraint ids)
│   ├── approvals                 (distinct authority acts)
│   ├── verificationGates         (method + criteria + evidence + pass)
│   └── activities (sorted by activityId)
│       ├── plannedQuantity? / plannedCost? / plannedStart / plannedFinish?
│       ├── predecessors ⇄ successors   (MIRRORED dependency edges)
│       ├── resources / responsibleActor? / constraintReferences
│       ├── actualProgress? / actualStart? / actualFinish?
│       ├── blockers / evidence / confidence?
│       └── forecastFinish?
└── milestones (sorted by milestoneId, over activity ids)
```

## Dependency integrity (the acceptance battery)

`buildProgramOfWork` is the total admission; it checks, in order:

1. **Schema validation** — strict objects (vendor fields →
   `vendor-fields-rejected`), canonical ordering everywhere (sorted,
   duplicate-free arrays; unsorted input is a `validation` rejection —
   deterministic serialization is a schema-level invariant).
2. **Activity ownership** — every activity's declared `workPackageId`
   must equal its owning package (`dangling-reference-rejected`).
3. **Cross-program uniqueness** — activity ids are unique across the
   whole program (`validation`).
4. **Dangling references** — every predecessor/successor id, milestone
   activity id, and gate activity id must resolve
   (`dangling-reference-rejected`).
5. **Mirror consistency** — if A lists B as predecessor, B must list A as
   successor, and vice versa (`schedule-integrity-rejected`).
6. **Cycle detection** — depth-first coloring over the predecessor edges;
   a back edge yields the cycle path
   (`schedule-cycle-rejected`, e.g. `a -> b -> a`).

The admitted program is sealed (SHA-256 over canonical JSON); the seal is
never recomputed for an admitted program — tampering is a typed
`digest-mismatch`.

## The synchronized schedule folds

The schedule is a set of DETERMINISTIC FOLDS over the admitted program
(the synchronized quantity/cost/resource schedules of SN1.0):

- `foldQuantitySchedule` — one row per activity carrying a planned
  quantity, plus exact per-unit totals;
- `foldCostSchedule` — one row per activity carrying a planned cost, plus
  exact per-currency totals;
- `foldResourceSchedule` — resource quantities aggregated across
  work-package and activity assignments per (resourceId, unit);
- `foldMilestoneSchedule` — milestones with status counts;
- `foldRealizationVariants` — work-package counts per realization variant.

Properties (tested):

- **Exact arithmetic** — totals use bigint-scaled decimal-string addition
  (`addNonNegativeDecimals`); no float drift ever (2220.00 + 9600.00 =
  11820, exactly).
- **Input-order independence** — folds sort before aggregating; admission
  order and array input order never leak into a fold result.
- **Deterministic digests** — the program content is canonically ordered,
  so semantically equal programs serialize byte-identically and digest
  stably.

## Planned vs actual vs forecast on the schedule

The activity carries planned dates/quantities/costs (the PLAN), actual
progress/dates (via actualized observations — see the delivery model),
and a forecast finish (the FORECAST). These are three SEPARATE fields
over three SEPARATE record families — see the semantic-distinction
invariant guide. The schedule fold only aggregates the PLANNED values;
the delivery fold (`foldDeliveryActuals`) aggregates the ACTUALS; the
forecast records live in the distinction ledger with their own lineage.
