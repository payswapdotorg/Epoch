# W023 — Marketplace
Status: READY_AFTER_DEPENDENCIES
Depends On: W007,W008,W009
Worker Count: 1

## Owned write surfaces
- `services/marketplace/*`
- `packages/marketplace/*`
- `apps/web/src/features/marketplace/*`

## Objective
Implement Marketplace inside the frozen architecture, using upstream contracts rather than recreating authorities.

## Acceptance
1. Scope is limited to this Work Order.
2. Interfaces remain typed/versioned and provider-neutral.
3. Add success, failure, authorization/tenancy, and replay/idempotency coverage as applicable.
4. External systems are adapterized.
5. Evidence names exact revision and verification commands.
6. No governance state or other active Work Order surface is modified.
7. Architecture conflicts become ACRs.

## Dispatch
Ready only after every dependency is COMPLETE and no active ownership overlaps. One branch and one PR; no routine rebase.
