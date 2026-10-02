# Production Journeys — Consolidated Closure Record (ACR-006, W055)

The consolidated P01-P18 production journey state at W055 closure. Per-journey evidence lives in `production-web.md` (the W052 execution record); this document is the closure roll-up: what passed, what is honestly gated on the credential boundary, and what executes the moment the operator provides provider credentials.

Environment at closure: the local production build evidence (W052: `next build` + `next start`, preview profile, 22/22 journey tests green; phase A 102 public-surface requests, 0 unexpected failures; phase B the rate-limit run). The real public deployment (Vercel + Neon + R2 + Upstash + Apify) is pending operator credentials — no public URL is claimed.

## Roll-up

| Journey | State at closure | Evidence | Gated on (the exact operator input) |
|---|---|---|---|
| P01 public onboarding | PASS (local production build) | production-web.md | the Vercel deployment (then the same flow over HTTPS) |
| P02 sign-in/session | PASS | production-web.md | session durability across instances (Neon) |
| P03 tenant/project selection | PASS | production-web.md | — |
| P04 understand/reconstruct | PASS | production-web.md | — |
| P05 capability discovery | PASS | production-web.md | — |
| P06 decide/approve | PASS (after D-1 fix) | production-web.md | — |
| P07 plan/acquire | PASS | production-web.md | — |
| P08 realize/observe/verify | PASS (after D-1 fix) | production-web.md | — |
| P09 offline/reconnect (web portion) | COVERED by the W047 browser suite (the idempotent-replay primitive asserted in P12/P14) | web.md | the deployed-URL browser runs (W055 post-deployment) |
| P10 cross-device handoff (web portion) | COVERED by the W047/W050 cross-platform suite | cross-platform.md | the deployed-URL browser runs |
| P11 agent supervision | PASS | production-web.md | — |
| P12 recovery | PASS (every typed failure path) | production-web.md | — |
| P13 release/update path | NOT-RUNNABLE-at-boundary | — | a real deployment update (commit → deploy → healthz) |
| P14 production persistence | PASS (local subset: sessions/idempotency across requests, honest in-memory binding state) | production-web.md | restart durability (Neon; `EPOCH_DATABASE_URL`) |
| P15 object/evidence upload+retrieval | PASS (local: digest-verified round trip through the bound store) | production-web.md | the R2-backed byte round trip (`EPOCH_OBJECT_STORE_*`) |
| P16 provider degradation/recovery | VERIFIED by the W053 negative battery (all typed fail-safe: unavailable Redis/object-store/database, malformed responses, migration mismatch, config absence) + Upstash LIVE-verified | infrastructure.md | the deployed multi-provider runs |
| P17 rate-limit behavior | PASS (429 + typed transient/gateway-overloaded + retry-after; healthz alive) | production-web.md | the shared Upstash budget across instances |
| P18 tenant isolation | PASS (all required negatives fail closed) + **F-1 CLOSED at W055** (the cross-tenant session-issuance gap fixed by the tenant-scoped session authority; regression-pinned) | production-web.md + product-runtime.test.ts | — |

## Defect ledger (program roll-up)

| ID | Severity | Description | Status |
|---|---|---|---|
| D-1 | P2 | the Decide/Verify surfaces submitted a verification chain the authority rejected and rendered a client-invented verdict | CLOSED (W052, fixed + regression + rerun) |
| D-2 | P3 | empty Role column (roleProposalId vs roleId) | CLOSED (W052) |
| F-1 | P2 | cross-tenant session issuance at the fixture identity boundary (reads passed; mutations already failed closed) | **CLOSED (W055)** — the tenant-scoped session authority (`TenantScopedSessionManager`) rejects foreign-tenant authentication results at session.issue; the frozen SessionManager/gateway/identity contracts untouched; 3 regression tests |
| W053-L1 | P1-equivalent (live-only) | the Upstash adapter POSTed the eval args to a path prefix the real REST API ignores | CLOSED (W053, found via LIVE verification, fixed + regression-pinned) |

P0 defects: **0**. P1 defects: **0**. Every P2 has disposition (closed). P3: closed.

## The post-credential verification procedure (executes when the operator provides the providers)

1. Provision per `docs/deployment/vercel-setup.md` + `docs/deployment/neon-r2-upstash-setup.md` (placeholders → real values in the Vercel project environment; production profile).
2. Deploy; record the public URL + deployment ID + source commit (release identity).
3. Rerun the full journey harness against the deployed URL: `EPOCH_PRODUCTION_BASE_URL=https://<project>.vercel.app pnpm --filter @epoch/web exec vitest run qa/production` (P01-P18 over HTTPS incl. P13's update path and P14/P15/P16/P17 with the real bindings).
4. The W053 live suites: the env-gated Upstash verification against the production REST credentials; the Neon migration + persistence verification against the production database.
5. The W054 live acquisition run (env-gated) with the Apify token + pinned actor.
6. Record everything here + the release manifest (only verified values); the final TL report flips to DEPLOYED.
