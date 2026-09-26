# Solution Delivery Documentation (W036)

Owned by Work Order **W036** (`packages/solution-delivery/*`,
`contracts/solution-delivery/*`, `docs/solution-delivery/*`). Kernel
layer.

This directory documents the universal delivery domain model implemented
by `@epoch/solution-delivery` (USL1.0 / DP1.0 / SN1.0, binding).

| Document | What it covers |
|---|---|
| [USL implementation map](./usl-implementation-map.md) | Every universal lifecycle stage → the concrete contracts and typed rejections that protect it; the typed transition relations; the `delivery:*` event vocabulary. |
| [ProgramOfWork scheduling model](./program-of-work-scheduling-model.md) | The authoritative schedule dimension: the realization graph, dependency integrity (cycles, mirrors, dangling references), and the deterministic synchronized schedule folds. |
| [Semantic-distinction invariant guide](./semantic-distinction-invariants.md) | The nine distinction record types, the invariants that keep them separate, and the typed rejections (`distinction-collapse-rejected`, `forecast-overwrite-rejected`, …). |
| [Acquisition/realization variant catalogs](./acquisition-realization-variant-catalogs.md) | The closed seven-variant acquisition catalog and seven-variant realization catalog, plus the provider-neutral external request/event seam. |
| [Pack-integration guide](./pack-integration-guide.md) | How a domain pack binds to these contracts per DP1.0: the pack profile, what a pack may do, what it may never do, and the acceptance checklist. |
| [Navigator projection guide](./navigator-projection-guide.md) | The synchronized SN1.0 projections, identity-preserving navigation, partial-data behavior, and the UX adaptation rule. |

## Authority boundaries (one responsibility, one authority)

- World Model = semantic world authority (W002) — referenced opaquely.
- SolutionPackage/SolutionVersion = approved solution intent + baseline
  authority (this kernel).
- DeliveryRecord = live delivery facts + delivery-state authority (this
  kernel).
- ProgramOfWork = authoritative schedule dimension inside the
  solution/delivery domain (this kernel).
- Constraint Engine / Simulation / Evaluation / Verification-Evidence /
  Action Gateway / Experience Runtime / external providers each keep
  their own authority — this kernel carries references onto them, never
  redefinitions.
