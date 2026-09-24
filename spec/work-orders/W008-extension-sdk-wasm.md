# W008 — Extension SDK + Wasm
Status: AUTHORIZED (wave 4; dispatch base recorded in the live dispatch issue)
Depends On: W003,W007
Worker Count: 1

## Owned write surfaces
- `packages/extension-sdk/*`
- `packages/extension-runtime/*`
- `runtimes/wasm/*`

## Objective
Implement Extension SDK + Wasm exactly inside the frozen Epoch E1.0/X1.0 architecture.

## Acceptance
1. Implement only the declared scope and owned surfaces.
2. Publish typed/versioned contracts at the ownership boundary.
3. Add positive and negative tests for material behavior and authority/security boundaries.
4. Preserve provider neutrality; provider-specific logic belongs behind adapters.
5. Produce exact-revision evidence and record limitations in the PR.
6. Do not edit governance-state files or another active Work Order's surfaces.
7. Any architecture conflict requires an Architecture Change Request instead of scope expansion.

## Dispatch
This item becomes dispatchable only when all dependencies are COMPLETE and ownership remains disjoint. One branch and one PR. No rebase is expected after dispatch.
