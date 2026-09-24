# W002 — Canonical World Model
Status: AUTHORIZED (wave 1; dispatch base 1b0d8d240f01de95cc6e269d4ae86471a934f717 post-W001-merge state commit; record exact SHA in the live dispatch issue)
Depends On: W001
Worker Count: 1

## Owned write surfaces
- `packages/world-model/*`
- `contracts/world/*`

## Objective
Implement Canonical World Model exactly inside the frozen Epoch E1.0/X1.0 architecture.

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
