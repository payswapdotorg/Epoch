# W028 — Document-to-Adapter
Status: AUTHORIZED (wave 6; dispatch base recorded in the live dispatch issue)
Depends On: W002,W004,W006,W007,W008
Worker Count: 1

## Owned write surfaces
- `services/document-adapter/*`
- `packages/document-adapter/*`

## Objective
Implement Document-to-Adapter inside the frozen architecture, using upstream contracts rather than recreating authorities.

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
