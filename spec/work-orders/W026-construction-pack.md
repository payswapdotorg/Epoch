# W026 — Construction Pack
Status: READY_AFTER_DEPENDENCIES
Depends On: W002,W004,W006,W007,W011,W013,W036
Worker Count: 1

## Owned write surfaces
- `packs/construction/*`

## Objective
Implement Construction Pack inside the frozen architecture, using upstream contracts rather than recreating authorities.

## Delivery integration
The pack must render the universal Solution Delivery model and conform to `spec/domain-pack-contract.md`. For construction this includes the synchronized Program of Work and interactive BOQ, with BOQ/procurement/execution presented as projections of universal Plan/Acquire/Realize concepts.

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


The pack must not introduce a construction-specific lifecycle authority or ledger.
