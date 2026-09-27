# W031 Reference E2E Slices — scenario definitions & fixtures

The importable, documented scenario DEFINITIONS behind the five named
E2E slices (tests: `tests/e2e/test`; catalog + findings:
`docs/e2e/README.md`).

Every scenario module exports:

- a typed **scenario result** (every intermediate record, digest and
  fold, for cross-surface assertions);
- a **runner** (`run…Scenario()`) — a pure function of its fixed
  constants that composes REAL workspace kernels through their public
  admission paths (no mocks; failures throw loudly with the kernel's
  typed error);
- a **digest projection** (`…DigestProjection()`) — the canonical
  digest summary used by the determinism + round-trip gates.

## Modules

| Module | Slice |
| --- | --- |
| [`shared.ts`](./scenarios/shared.ts) | The shared vocabulary: tenants, principals, the fixed instant series `T[…]`, the uncertainty builders |
| [`construction-delivery.ts`](./scenarios/construction-delivery.ts) | `construction-delivery-slice` |
| [`software-delivery.ts`](./scenarios/software-delivery.ts) | `software-delivery-slice` |
| [`adapter-intake.ts`](./scenarios/adapter-intake.ts) | `adapter-intake-slice` |
| [`action-gateway.ts`](./scenarios/action-gateway.ts) | `action-gateway-slice` (includes the `PolicyRegistryAuthorityPort` — the W029 authority seam over the REAL W022 `ActionPolicyRegistry` — and the bypass envelope builder) |
| [`recovery.ts`](./scenarios/recovery.ts) | `recovery-slice` (the replay model + the verified fold over slice 1's event stream) |

## Determinism discipline

Zero wall-clock (every instant is a `T[…]` constant), zero randomness
(every id explicit), zero network (the W029 adapter runs on its
committed reference fixtures). Two runs of any scenario in the same
process produce byte-identical digest projections — asserted by every
slice test.

## Importing

These modules are plain TypeScript over the workspace packages; the
slice tests import them relatively (`tests/e2e/test/*.test.ts`). From
anywhere with the workspace packages resolvable:

```ts
import { runConstructionDeliveryScenario, constructionDeliveryDigestProjection } from
  '<repo-root>/examples/e2e/scenarios/construction-delivery';
```
