# W041 — Fine-Grained Access & Authorized Projections
Status: READY_AFTER_DEPENDENCIES
Depends On: W009,W011,W036
Worker Count: 1
Owned surfaces: packages/access-projection/*, services/access-projection/*, contracts/access-projection/*

## Objective
Allow different stakeholders and agents to see authorized projections of the same solution/delivery state.

## Must provide
- resource/field/action permission evaluation;
- section/work-package/evidence/commercial scoping;
- authorized redaction and projection;
- explicit export/share checks;
- service-to-service authorization;
- audit-ready access decisions.

## Acceptance
Tests prove two roles can receive different authorized views of the same delivery object without creating divergent semantic authorities.
