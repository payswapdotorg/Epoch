# Production Journeys — Consolidated Closure Record (ACR-006, W055 → W070)

The consolidated P01-P18 production journey state. Per-journey evidence lives in `production-web.md` (the W052 local-phase execution record + the 2026-10-03 deployed-URL record); this document is the closure roll-up: what passed, the post-credential execution record, and the provider identity. The post-credential verification procedure EXECUTED 2026-10-03 (below) — ACR-006 is COMPLETE-DEPLOYED-LIVE.

Environment at closure: **DEPLOYED-LIVE** — https://epoch-ekonplacidegmailcoms-projects.vercel.app (production deployment `dpl_A5cnn9G7Vig1cEDR`, READY, from `main@a269f829` — the W069 merge, PR #160; target=production, region iad1; the project's SSO deployment protection was removed 2026-10-03 so the production alias serves anonymously). The historical phase evidence (W052: `next build` + `next start`, preview profile, 22/22 journey tests green; phase A 102 public-surface requests, 0 unexpected failures; phase B the rate-limit run) remains recorded in `production-web.md` as the harness provenance.

## Roll-up

| Journey | Final state (DEPLOYED-LIVE, 2026-10-03) | Evidence |
|---|---|---|
| P01 public onboarding | PASS (the deployed URL, over HTTPS from the anonymous public origin) | production-web.md (the deployed-URL battery) |
| P02 sign-in/session | PASS | production-web.md (the deployed-URL battery) |
| P03 tenant/project selection | PASS | production-web.md (the deployed-URL battery) |
| P04 understand/reconstruct | PASS | production-web.md (the deployed-URL battery) |
| P05 capability discovery | PASS | production-web.md (the deployed-URL battery) |
| P06 decide/approve | PASS | production-web.md (the deployed-URL battery) |
| P07 plan/acquire | PASS | production-web.md (the deployed-URL battery) |
| P08 realize/observe/verify | PASS | production-web.md (the deployed-URL battery) |
| P09 offline/reconnect (web portion) | NOT-RUNNABLE-at-HTTP-boundary (unchanged disposition) — covered by the W047 browser suite (the idempotent-replay primitive asserted in P12/P14) | web.md + production-web.md |
| P10 cross-device handoff (web portion) | NOT-RUNNABLE-at-HTTP-boundary (unchanged disposition) — covered by the W047/W050 cross-platform suite | cross-platform.md |
| P11 agent supervision | PASS | production-web.md (the deployed-URL battery) |
| P12 recovery | PASS (every typed failure path) | production-web.md (the deployed-URL battery) |
| P13 release/update path | NOT-RUNNABLE-at-HTTP-boundary (unchanged disposition — requires provider-side deployment events) | production-web.md |
| P14 production persistence | PASS (persistence over the live postgres binding — the Neon-backed production profile) | production-web.md (the deployed-URL battery) |
| P15 object/evidence upload+retrieval | PASS (the R2-backed byte round trip — put/get + P15 evidence upload/retrieval GREEN) | production-web.md (the deployed-URL battery) |
| P16 provider degradation/recovery | VERIFIED by the W053 negative battery (all typed fail-safe: unavailable Redis/object-store/database, malformed responses, migration mismatch, config absence) + Upstash LIVE-verified; the deployed-run provider-side events remain NOT-RUNNABLE-at-HTTP-boundary (unchanged disposition) | infrastructure.md |
| P17 rate-limit behavior | PASS (the typed transient 429 at exactly the configured 120-request/60s IP budget — the LIVE Upstash guard working) | production-web.md (the deployed-URL battery) |
| P18 tenant isolation | PASS (all required negatives fail closed; 4/4 legs on the post-window rerun) + **F-1 CLOSED at W055** (the cross-tenant session-issuance gap fixed by the tenant-scoped session authority; regression-pinned) | production-web.md + product-runtime.test.ts |

## Defect ledger (program roll-up)

| ID | Severity | Description | Status |
|---|---|---|---|
| D-1 | P2 | the Decide/Verify surfaces submitted a verification chain the authority rejected and rendered a client-invented verdict | CLOSED (W052, fixed + regression + rerun) |
| D-2 | P3 | empty Role column (roleProposalId vs roleId) | CLOSED (W052) |
| F-1 | P2 | cross-tenant session issuance at the fixture identity boundary (reads passed; mutations already failed closed) | **CLOSED (W055)** — the tenant-scoped session authority (`TenantScopedSessionManager`) rejects foreign-tenant authentication results at session.issue; the frozen SessionManager/gateway/identity contracts untouched; 3 regression tests |
| W053-L1 | P1-equivalent (live-only) | the Upstash adapter POSTed the eval args to a path prefix the real REST API ignores | CLOSED (W053, found via LIVE verification, fixed + regression-pinned) |

P0 defects: **0**. P1 defects: **0**. Every P2 has disposition (closed). P3: closed.

## The post-credential execution record (EXECUTED 2026-10-03 — the verification procedure ran to completion)

The operator provided the provider credentials 2026-10-03; the procedure below EXECUTED. The results:

### The acceptance surface

- **PUBLIC URL:** https://epoch-ekonplacidegmailcoms-projects.vercel.app (publicly reachable; the project's SSO deployment protection was removed 2026-10-03 so the production alias serves anonymously).
- **Production deployment:** `dpl_A5cnn9G7Vig1cEDR`, READY, from `main@a269f829` (the W069 merge, PR #160), target=production, region iad1. Predecessor chain that proved the surface: `dpl_Hqiz9Z7Qdb3jeRKXBgaLXh1q2b4z` (READY, main@77dbb0b9), `dpl_Bwj4BDT5uMY69sdFzwUhPVz2wEsf` (READY, 2a1382f). Earlier production attempts errored and were fixed (the live-only defect chain — summary below).
- **Live health:** `/api/healthz` over HTTPS → `200 {"ok":true,"profile":"production"}` (anonymous); `/api/readyz` over HTTPS → `200` `ready:true`, ALL FOUR real provider bindings live (persistence `postgres`, objectStore `s3`, rateLimit `upstash`, acquisition `apify` — each `configured:true`), `degraded:[]`, `issues:[]`, `criticalIssues:[]`.

### The per-provider results table (all VERIFIED-live)

| Provider | Binding | Live identity | Result |
|---|---|---|---|
| Neon | persistence (postgres) | project **epoch-production** (id `fancy-snow-69738927`, aws-us-east-1, PostgreSQL 18.6, pooled connection; org `org-shy-shadow-21570034`) | **VERIFIED-live** (the persistence binding + P14 persistence over postgres GREEN) |
| Cloudflare R2 | object store (s3) | bucket **epoch-evidence** (SigV4) | **VERIFIED-live** (put/get round trip + P15 evidence upload/retrieval GREEN) |
| Upstash | rate limit (upstash REST) | database **polished-yeti-167554** | **VERIFIED-live** — with the HONEST DEVIATION recorded below |
| Apify | acquisition | actor **epoch-pinned-acquisition** (id `cBb2bRHo25aZk9raR`, zero-dependency, the pinned contract items) | **VERIFIED-live** (the W054 live acquisition GREEN: run `apifyrun:410fafbac96e5aac`, fetchedAt `2026-10-03T10:56:08.811Z`, rawResultDigest `efa90dd2…`, itemCount 2 / mapped 2 / dropped 0) |
| Vercel | the deployment host | project **epoch** (id `prj_1yCCF5hnx9A6h8nAtTMXK2O0TwFQ`, team `ekonplacide-5312`, GitHub App on `payswapdotorg/Epoch`, region iad1, framework nextjs, rootDirectory `apps/web`) | **VERIFIED-live** (the deployment identity above) |

**THE UPSTASH HONEST DEVIATION (recorded):** the operator-supplied URL
`meet-ewe-145933` did not resolve anywhere (stale/deleted); it was replaced
with the account's actual free-tier database (`polished-yeti-167554`) after
a keyspace inspection (70 keys, all `aise:*` namespaced, ZERO `ratelimit:*`
collisions — co-tenancy safe). The W053 live suite ran GREEN 4/4 + 1 skip from
an E2B sandbox: real counter INCR visible; window deny with epoch-anchored
`retryAfterMs`; fresh-window reset; TTL bounded; invalid-token fail-open
degraded + fail-closed deny, typed.

### The deployed-URL battery result

**22/22 legs GREEN** (the full per-leg table + the run facts in
`production-web.md`). First run 19 passed / 3 failed — all three failures
were P17-window contamination (P17's hammer by design exhausts the
120-request/60s IP budget; the P18 legs immediately after received the typed
gateway-overloaded 429 envelope with rateLimit
`{guardId:"ip", limit:120, remaining:0}`). P17 itself PASSED (the typed
transient 429 at exactly the configured budget — the LIVE Upstash guard
working). P18 rerun after the 60s window reset: 4/4 PASSED. P09/P10 (client
offline-queue + cross-device handoff) and P13/P16 (release-update +
provider-degradation) remain the documented NOT-RUNNABLE-at-HTTP-boundary
dispositions (covered by the W047 browser suite / require provider-side
events).

### The defect-chain summary (the live-only deployment defects — all fixed + regression-pinned)

Eight live-only defects were found on REAL deployments and closed with the
discipline chain (the full ledger in `production-web.md`): #1 the vercel.json
rootDirectory/outputDirectory detection failure; #2 the threejs adapter's
undeclared `@epoch/experience-protocol`; #3 webpack's throwing pg-driver
stub; #4 the S3 double-Z `x-amz-date` (every real R2 request 403
`SignatureDoesNotMatch`; the regression test pinning `^\d{8}T\d{6}Z$`); #5
pg's pnpm-store siblings unresolvable in the lambda (the flattened-closure
approach); #6/#7 the trace-anchor iterations; #8 the `xtend`/`mutable` +
`split2` closure miss (the live `readyz` 503) — closed by W069 with the
CLASS-CLOSING deterministic guard test (walks the driver's full 14-package
runtime closure from the deployment root; red-on-main evidence: `closure
incomplete: undeclared=[split2, xtend] missing-at-root=[split2, xtend]
untraced=[split2, xtend]`) [PR #160, main@a269f829].

## The post-credential verification procedure (the operator runbook — EXECUTED 2026-10-03)

1. Provision per `docs/deployment/vercel-setup.md` + `docs/deployment/neon-r2-upstash-setup.md` (placeholders → real values in the Vercel project environment; production profile). **EXECUTED** — all four providers bound live (the per-provider table above).
2. Deploy; record the public URL + deployment ID + source commit (release identity). **EXECUTED** — https://epoch-ekonplacidegmailcoms-projects.vercel.app, `dpl_A5cnn9G7Vig1cEDR` from `main@a269f829`, target=production, region iad1 (the predecessor chain + the live-only defect chain in `production-web.md`).
3. Rerun the full journey harness against the deployed URL: `EPOCH_PRODUCTION_BASE_URL=https://<project>.vercel.app pnpm --filter @epoch/web exec vitest run qa/production` (P01-P18 over HTTPS incl. P13's update path and P14/P15/P16/P17 with the real bindings). **EXECUTED** — 22/22 legs GREEN (the P17-window contamination + the P18 rerun disclosed in `production-web.md`; P13/P16 remain NOT-RUNNABLE-at-HTTP-boundary — provider-side events).
4. The W053 live suites: the env-gated Upstash verification against the production REST credentials; the Neon migration + persistence verification against the production database. **EXECUTED** — the Upstash live suite GREEN 4/4 + 1 skip from an E2B sandbox (the URL deviation recorded above); the Neon persistence binding VERIFIED-live (P14 GREEN).
5. The W054 live acquisition run (env-gated) with the Apify token + pinned actor. **EXECUTED** — run `apifyrun:410fafbac96e5aac` GREEN (fetchedAt `2026-10-03T10:56:08.811Z`, rawResultDigest `efa90dd2…`, itemCount 2 / mapped 2 / dropped 0).
6. Record everything here + the release manifest (only verified values); the final TL report flips to DEPLOYED. **EXECUTED (this record, W070)** — the final TL report in `spec/development-state/checkpoint-state.json` flips to ACR-006 DEPLOYED-LIVE with the per-provider VERIFIED-live table and the PUBLIC WEB URL.
