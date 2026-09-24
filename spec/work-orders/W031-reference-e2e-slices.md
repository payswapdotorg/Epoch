# W031 — Reference E2E slices
Status: READY_AFTER_DEPENDENCIES
Depends On: W014,W015,W016,W020,W021,W022,W026,W027,W028,W029
Worker Count: 1

## Owned write surfaces
- `examples/e2e/*`
- `tests/e2e/*`
- `docs/e2e/*`

## Objective
Implement Reference E2E slices within the frozen architecture and only in the owned surfaces.

## Acceptance
1. Scope is exactly the declared Work Order.
2. Dependency/provider boundaries remain explicit and replaceable.
3. Add positive/negative/recovery evidence appropriate to the scope.
4. Preserve tenant, authorization, provenance, replay, and authority invariants.
5. Record exact revision and reproducible verification in the PR.
6. Do not edit governance state or another Work Order's surface.
7. Architecture conflicts become ACRs.

## Dispatch
Ready only after all dependencies are COMPLETE and the Tech Lead confirms ownership disjointness. One branch and one PR. No routine rebase.
