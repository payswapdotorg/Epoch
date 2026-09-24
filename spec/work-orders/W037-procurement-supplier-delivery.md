# W037 — Resource Acquisition + Supplier Delivery
Status: READY_AFTER_DEPENDENCIES
Depends On: W036,W007,W009
Worker Count: 1
Owned surfaces: packages/procurement/*, services/procurement/*, contracts/procurement/*

## Objective

Implement resource acquisition as the universal acquisition layer, with procurement and supplier delivery as a concrete construction/commercial projection.

## Must provide
- requirement to acquisition-package lineage;
- quotes/offers/allocations and selection;
- commitment records;
- purchase-order and supplier-delivery support;
- receipt/acceptance and consumption linkage;
- substitutions/changes with constraint evaluation;
- lead-time and acquisition status;
- provider-neutral supplier contracts.

The implementation must leave extension points for internal allocation, subscription/license acquisition, cloud/service provisioning and fabrication requests without creating separate lifecycle authorities.

## Acceptance

Contract tests prove acquisition lineage, authorization, idempotency, supplier delivery state and explicit separation of prediction/baseline/commitment/actual values.
