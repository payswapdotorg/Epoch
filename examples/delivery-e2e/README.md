# W044 — Delivery-to-Learning E2E Fixture (scenario definitions)

The scenario DEFINITIONS behind the delivery-to-learning end-to-end
fixture (the Work Order W044 construction-realization slice; tests:
`tests/delivery-e2e/test`; catalog + evidence chain:
`docs/delivery-e2e/README.md`).

Every scenario module exports:

- a typed **scenario result** (every intermediate record, digest and
  fold, for cross-surface assertions);
- a **runner** (`runDeliveryLearningScenario()`) — a pure function of
  its fixed constants that composes REAL workspace kernels through
  their public admission paths (no mocks; only the external provider is
  fixture-driven per its own committed reference behavior — the mocked
  Aurum chat adapter runs entirely on its committed fixtures, no
  network, no live provider);
- a **digest projection** (`deliveryLearningDigestProjection()`) — the
  canonical digest summary used by the determinism + round-trip gates.

## Modules

| Module | Purpose |
| --- | --- |
| [`scenarios/shared.ts`](./scenarios/shared.ts) | The shared vocabulary: tenants, principals, the fixed instant series `T[…]`, the uncertainty builders, the loud `need()` unwrapper |
| [`scenarios/delivery-learning.ts`](./scenarios/delivery-learning.ts) | The complete universal-lifecycle scenario (see the header comment for the full stage-by-stage map) |

## Determinism discipline

Zero wall-clock (every instant is a `T[…]` constant), zero randomness
(every id explicit), zero network (the W042 mocked Aurum provider runs
on its committed reference fixtures). Two runs of the scenario in the
same process produce byte-identical digest projections — asserted by
the fixture test.

## Importing

These modules are plain TypeScript over the workspace packages; the
fixture tests import them relatively
(`tests/delivery-e2e/test/*.test.ts`). From anywhere with the workspace
packages resolvable:

```ts
import { runDeliveryLearningScenario, deliveryLearningDigestProjection } from
  '<repo-root>/examples/delivery-e2e/scenarios/delivery-learning';
```

See `docs/delivery-e2e/README.md` for how to run the fixture and read
its evidence chain.
