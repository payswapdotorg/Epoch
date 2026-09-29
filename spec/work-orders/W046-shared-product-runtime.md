# W046 — Shared Product Runtime + Application Gateway

Status: AUTHORIZED
Wave: ACR-005 / productization foundation
Depends On: W001-W045
Worker Count: 1

## Objective
Provide one client-facing Application Gateway over existing Epoch authorities, with durable persistence/authentication seams and deterministic fixtures used by all three clients.

## Owned write surfaces
- contracts/application-gateway/*
- packages/client-runtime/*
- services/application-gateway/*
- packages/persistence/*
- packages/object-storage/*
- packages/authentication/*
- qa/fixtures/*
- docs/product-runtime/*
- spec/journeys/fixtures/*

Do not edit apps/web, apps/desktop or apps/mobile.

## Required
Typed gateway operations for identity/session, tenant/workspace/project, world/evidence, agents/capability discovery, constraints, solutions/approval, schedule/BOQ, acquisition/delivery, realization/observation, verification, actualization/forecast/outcome, marketplace/developer and recovery.

PostgreSQL durable adapter behind a provider-neutral port; object storage for bytes; tenant-safe authorization propagation; correlation/idempotency; recoverable errors; deterministic construction/software fixtures; cross-client contract parity.

## Acceptance
1. Gateway operations map to existing authorities.
2. PostgreSQL is authoritative when enabled.
3. Evidence/assets remain digest-addressed bytes.
4. Authz, tenant context, correlation and idempotency are enforced.
5. Offline/replay admission cannot become a second semantic ledger.
6. Construction and software fixtures cover the lifecycle needed by W047-W049.
7. Equivalent fixture inputs produce equivalent canonical responses across client families.
8. Governance/boundary/typecheck/lint/test/build are green with complete evidence.

## Non-goals
No visual UI, native hosts or second lifecycle/database.
