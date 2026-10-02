# W051 — Production Deployment Foundation

Status: AUTHORIZED
Wave: ACR-006 / public deployment foundation (Tech Lead serialized)
Depends On: ACR-006 (W001-W050 complete baseline)
Worker Count: 1

## Objective
Establish the stable production deployment seams and contracts that W052 (web/Vercel), W053 (Neon/R2/Upstash) and W054 (Apify/operations) build against, without hard-coding provider semantics into kernel interfaces.

## Owned write surfaces
- spec/deployment-architecture.md
- spec/production-environment.md
- spec/free-tier-infrastructure.md
- spec/production-security.md
- spec/production-operations.md
- spec/production-rollback.md
- docs/deployment/* (foundation docs: topology, environment contract, provider setup placeholders)
- services/application-gateway/src/rate-limit.ts (+ test) — the RequestGuard port + in-memory reference
- adapters/s3-object-store/* (package skeleton + port re-export + README contract ONLY; implementation is W053)
- adapters/upstash-redis/* (package skeleton + port re-export + README contract ONLY; implementation is W053)
- apps/web/src/server/production-env.ts, apps/web/src/server/production-binding.ts (+ tests)
- apps/web/app/api/healthz/route.ts, apps/web/app/api/readyz/route.ts (+ tests)
- apps/web/.env.example (placeholders only)
- apps/web/vercel.json (deployment manifest, placeholders/framework config)
- spec/development-state/* (program/frontier/dependency/checkpoint)
- spec/PROJECT-STATE.md, AI_CONTINUATION.md, docs/LLM-ARCHITECT-HANDOFF.md (state updates at merge)

Do not: modify kernel packages' semantic behavior; implement provider adapters (W053/W054 own implementations); add any runtime dependency; put real secret values anywhere.

## Required
1. Provider-neutral deployment contracts as spec documents (the six spec files above), including the verified free-tier cost-control contract with official sources.
2. The typed production environment contract (production-env.ts): profile detection, variable validation, placeholder-only template, fail-safe precedence (security gates fail closed; optional capabilities degrade gracefully; production profile refuses to boot with ephemeral persistence).
3. The RequestGuard port (fixed-window rate limiting) in services/application-gateway with an in-memory reference implementation and tests; wired as an option at the gateway boundary (no provider semantics in the port).
4. The production binding layer (production-binding.ts): environment-driven construction of the gateway runtime (PG wire via bindPgPool when EPOCH_DATABASE_URL is present; in-memory fallback otherwise with explicit degraded flags), health/readyz endpoints exposing binding state without secret leakage.
5. Adapter package skeletons for s3-object-store and upstash-redis (manifests with layer `service`, port re-exports from the frozen SPIs, README implementation contracts for W053) — compiling, tested where meaningful, no stubbed-out fake implementations.
6. vercel.json + .env.example with placeholders only; deployment manifest validated by CI (schema check).
7. State manifests updated to ACR-006 program state (W051 active -> complete at merge; W052/W053/W054 eligible; W055 blocked).

## Acceptance
1. All six spec documents exist with the ACR-006 contracts (environment model, secrets, boundaries, security controls, observability, cost ceilings, failure behavior, retention/backup, TLS assumptions).
2. Environment contract validates every documented variable; production profile fails closed on missing durable persistence config; degraded flags surface in readyz.
3. Rate limiting: in-memory reference limiter passes its tests (fixed window, per-key budgets, fail-safe on absent config); the port carries zero provider semantics.
4. healthz/readyz return typed JSON (profile, bindings, migration state, degraded flags) and never leak secret values (verified by test).
5. Boundary/governance checks pass: new adapters declare layer `service`; no kernel package imports them; no root manifest/lockfile change.
6. Full battery green: governance, boundary, typecheck, lint, test, build (turbo) + release-readiness workflow.
7. Zero new runtime dependencies (catalog unchanged — verified by the CI baseline guard).

## Non-goals
No Vercel/Neon/R2/Upstash/Apify account provisioning (operator credentials required — W052/W053/W054 execute connections); no provider adapter implementations; no kernel semantic changes; no UI changes.
