# W018 — Mobile Field Client
Status: READY_AFTER_DEPENDENCIES
Depends On: W014,W015,W016
Worker Count: 1

## Owned write surfaces
- `apps/mobile/*`

## Objective
Implement Mobile Field Client exactly within frozen Epoch E1.0/X1.0 contracts. Consume upstream interfaces; do not redefine their authority.

## Acceptance
1. Implement only declared scope and surfaces.
2. Preserve typed/versioned shared contracts.
3. Add positive, negative, and boundary tests appropriate to this subsystem.
4. Preserve provider neutrality and tenant isolation.
5. Produce exact-revision evidence in the PR.
6. No governance-state edits, no shared lockfile edits, no other active Work Order surfaces.
7. Any required architecture change is an ACR, not an implementation shortcut.

## Dispatch
Dispatch only after all dependencies are COMPLETE. One branch, one PR, exact base recorded by Tech Lead. No rebase is expected after dispatch.
