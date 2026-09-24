# W041 — Fine-Grained Authorization + Authorized Projections
Status: READY_AFTER_DEPENDENCIES
Depends On: W009,W011,W036
Worker Count: 1
Owned surfaces: packages/access-projection/*, services/access-projection/*, contracts/access-projection/*

## Objective

Expose the same canonical solution and delivery state through least-privilege projections for clients, engineers, contractors, procurement users and agents.

## Must provide
- object/action/field-aware authorization;
- projection policies and evaluation;
- minimum-necessary field selection;
- evidence/commercial/supplier scoping;
- agent task-specific projections;
- auditability of projection decisions;
- stable semantic identity across projections.

## Acceptance

Fixtures prove two authorized roles can receive different projections of one semantic object without creating duplicate authorities or leaking fields outside policy.
