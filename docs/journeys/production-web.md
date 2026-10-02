# Journey W052 — Production Web (public deployment program, ACR-006)

Platform: web-production (HTTP surface of the deployed application) — **local production build** (this record's environment below)
Persona: delivery lead / chief engineer (construction `tenant:nordstrand`), tech lead (software `tenant:lightspeed`) — the fixture principals, selected at the public entry
Product version: `@epoch/web` (apps/web, Next.js App Router production build; Application Gateway bound in-process — the only client-facing mutation/read path)
Source commit: dispatch base `0feac24135e5666f399a1fd93ef7912124aeba88` on branch `work/W052-public-web-vercel-deployment` (final head SHA stated in the W052 PR)
Environment: **preview-local-production-build** — `next build` + `next start` (port 3155), `EPOCH_DEPLOYMENT_PROFILE=preview` (in-memory bindings, degradation surfaced; the production profile without provider credentials fails closed BY DESIGN — spec/production-environment.md). Phase B restart adds `EPOCH_RATE_LIMIT_IP_REQUESTS_PER_WINDOW=3`.
Fixture: `epoch-fixture-construction-v1.0.0` (`tenant:nordstrand`), `epoch-fixture-software-v1.0.0` (`tenant:lightspeed`) — boot-verified against `qa/fixtures/registry.json`

## HONEST DEPLOYMENT STATUS: NOT-DEPLOYED (awaiting Vercel credentials)

No Vercel credentials exist in the working environment (the ACR-006
honest-blocking rule). **No public URL exists; nothing in this record is a
claim about a deployed site.** What this record evidences:

1. the reusable production journey harness
   (`apps/web/qa/production/`) — every journey below is executable against
   ANY deployment origin by setting `EPOCH_PRODUCTION_BASE_URL`;
2. the journeys executed against the closest honest approximation available
   without credentials: a REAL production build of `apps/web`
   (`next build`, served by `next start`), driven exclusively through its
   public HTTP surface (`/api/gateway`, `/api/product/authenticate`,
   `/api/product/bootstrap`, `/api/healthz`, `/api/readyz`) — no direct
   kernel access, no privileged probes;
3. everything that remains gated on the real deployment (per journey, below).

The complete deployment procedure (operator-ready) is
[docs/deployment/vercel-setup.md](../deployment/vercel-setup.md).

## Preconditions

- Production build from this branch; server processes started with the
  environment stated above (one process per phase; fresh process per phase —
  the in-memory rate-limit window resets with the process).
- The harness (`apps/web/qa/production/production-journeys.test.ts`) sends
  exactly what the visible client sends: the client's own envelope builder
  (`src/client/envelopes.ts`) and the client's own payload derivations
  (`src/product/derivation.ts`).
- Machine-readable traces were captured per call
  (`EPOCH_HARNESS_TRACE`; per-journey request counts + statuses recorded
  below).

## Journey outcomes (executed 2026-10-02, local production build)

| Journey | Steps (public-surface actions) | Expected | Observed | Result | Gated on the real deployment |
|---|---|---|---|---|---|
| Health/readiness (W051 contract) | `GET /api/healthz`, `GET /api/readyz`, `GET /` | typed liveness payload; secret-free readiness (bindings + degraded flags); entry surface serves | `healthz`: `{ok:true, profile:"preview", uptimeMs:…}`; `readyz`: `ready:true`, bindings all `in-memory`, `degraded:["persistence:in-memory","object-store:in-memory","rate-limit:in-memory","acquisition-disabled"]`, `issues:[]`, `criticalIssues:[]`; `/` → 200 | **PASS** | same checks over HTTPS on the `*.vercel.app` URL with `postgres`/`s3`/`upstash` bindings and `degraded:[]` |
| P01 public onboarding | anonymous `GET /` → identity boundary (`POST /api/product/authenticate`, construction + delivery-lead) → `session.issue` through the gateway → first gateway read | verified authentication result; `session:*` id in `tenant:nordstrand`; working session (world read resolves, typed outcome with correlation id + 64-hex digest) | all as expected (4 calls, 0 failures) | **PASS** | the same flow from a real anonymous browser over HTTPS |
| P02 sign-in/session | `session.validate` ×2 (across requests) → `session.revoke` → `session.validate` | active/valid across requests; revocation signs out; post-revoke calls fail closed `auth-session-expired`/`session-revoked` with `reauthRequired` | all as expected (the post-revoke validate returned the typed `session-revoked` envelope) | **PASS** | session validity across deployment instances/restarts (needs the Neon-backed persistence of the production profile) |
| P03 tenant/project selection | sign in both domains → session-gated bootstrap (`POST /api/product/bootstrap`) ×2 → `context.resolve` (project node) | committed tenant/workspace/project ids per domain; the tenancy authority resolves the selected project node with its digest | `tenant:nordstrand`/`workspace:warehouse-extension`/`project:steel-warehouse-b`; `tenant:lightspeed`/`project:checkout-v2`; `context.resolve` → `{node:{nodeId,kind:"project"}, nodeDigest:64-hex}` | **PASS** | — |
| P04 understand/reconstruct | `world.snapshot` → `world.entities` → `evidence.get` | authoritative world digest equals the committed registry anchor; 8 entities (3 BOQ items); evidence records return | digest === registry `worldDigest`; 8 entities; evidence subject records returned | **PASS** | — |
| P05 capability discovery | `discovery.run` (team + copilot candidates selected) | roles synthesized from capability demands (never model names); organizations composed | roles with `drole:*` ids + `roleSlug` + `mission`; organizations > 0; no model-name patterns | **PASS** | — |
| P06 decide/approve | `solution.sealVersion` ×2 (baseline + alternative) → `constraints.evaluate` (12 / 20) → `verification.validateChain` → `solution.approveBaseline` → `action.submit` → `action.approve` → `action.execute` → `action.status` | baseline seals byte-exact to the fixture anchor, alternative distinct; constraint satisfied/violated; chain ADMITTED by the verification authority; baseline approved; the authority's own statuses `awaiting-approval` → `authorized` → `executed`; the action stream carries the executed action | all as expected (13 calls; see defect D-1 below — the first run REVEALED the chain rejection, fixed, rerun green) | **PASS** (after D-1 fix) | — |
| P07 plan/acquire | `program.build` → `program.schedule` → `procurement.quote` → `procurement.order` | program id + digest; quantity fold rows > 0; quote digest; grounded purchase order | `program:warehouse-extension`; fold rows > 0; quote + `po:*` admitted with kernel-validated grounding | **PASS** | — |
| P08 realize/observe/verify | `delivery.open` → `delivery.observe` (field capture) → `verification.validateChain` → `actualization.forecast` | grounded delivery record (digest); observation admitted (digest); chain admitted; exact-decimal forecast (remaining 80, at-completion 128 at factor 1.1) | all as expected (see defect D-1 — same chain fix) | **PASS** (after D-1 fix) | — |
| P11 agent supervision | `supervision.check` (program + delivery) → `alerts.raise` (first finding) → `action.status` | the supervision pass evaluates; findings carry authority ids; alerts raise through the escalation policy; the authoritative action stream lists agent actions | findings with `findingId`s; alert admitted; action stream array | **PASS** | — |
| P12 recovery | malformed JSON body; invented operation (`kernel.world.mutate-directly`); tenantless envelope; 1 ms session → expiry → re-authenticate; idempotent retry (same correlation + idempotency key) | every failure is a TYPED envelope (`validation`/`request-envelope-malformed`, `auth-session-expired` + `reauthRequired`); re-authentication recovers; the retry replays the SAME outcome digest with `replayed:true` | 400 `request-envelope-malformed`; 200+typed `request-envelope-malformed` for the invented op; 400 `request-validation` for the tenantless body; `session-expired` + fresh-session recovery; retry `replayed:true`, identical `outcomeDigest` + result | **PASS** | — |
| P14 production persistence | `session.validate` before/around operations; idempotent replay; `GET /api/readyz` | sessions persist across requests; the idempotency record replays exactly; readiness states the durable-binding truth (kind ⟺ degraded flag) | session valid across all requests; replay identical (`replayed:true`, same digest); `persistence.kind === "in-memory"` with the matching `persistence:in-memory` degraded flag (the preview profile's honest state) | **PASS** (local subset) | **restart-durability NOT-RUNNABLE-at-boundary**: sessions/idempotency surviving a restart require the production profile's Neon binding (W053 provisions; W055 verifies live) |
| P15 object/evidence upload+retrieval | `evidence.intake` (digest-anchored subject) → `evidence.get` | intake receipt digest (64-hex); the captured record returns with the committed object-bytes anchor digest | receipt digest 64-hex; the captured record's `subject.digest` === registry `objectBytesDigest` (`construction-field-capture`) | **PASS** (local: in-memory object store; the fixture bytes restored at boot are the same digest-addressed objects) | the R2-backed byte round trip (production profile's S3 binding — W053) |
| P17 rate-limit behavior | dedicated server phase: `EPOCH_RATE_LIMIT_IP_REQUESTS_PER_WINDOW=3`; hammer `POST /api/gateway` past the budget; then `GET /api/healthz` | typed `transient`/`gateway-overloaded` envelope with HTTP 429, `details.rateLimit.limit === 3`, `retryAfterMs > 0`, `retry-after` header ≥ 1; no crash | 429 on the 4th gateway POST of the window; `limit:3`, `retry-after` present; `healthz` still `ok:true` afterwards | **PASS** | the shared Upstash-backed budget across serverless instances (the deployed run uses the §4.3 procedure of the runbook) |
| P18 tenant isolation | (a) nordstrand session in lightspeed scope; (b) cross-tenant bootstrap; (c) unknown tenant; (d) cross-tenant session ISSUANCE probe → cross-tenant mutation | cross-tenant session USE fails closed (`auth-session-expired`/`session-unknown`); cross-domain bootstrap 401; unknown tenant 400 `request-validation` | (a) `session-unknown` ✅ (b) 401 `auth-session-expired` ✅ (c) 400 `request-validation` ✅ (d) OBSERVATION: the foreign-domain session ISSUANCE SUCCEEDED (see finding F-1 — W051-frozen composition, escalated to the TL); the compensating control held: the cross-tenant MUTATION was denied `authority-rejected`/`authority-denied` by the W009 gate ✅ | **PASS** (required negatives) + finding F-1 recorded | — |
| P09/P10 offline/cross-device | — | browser-client behaviors (offline queue in localStorage, session-ref handoff) — not HTTP-surface behaviors | covered by the W047 browser suite (`apps/web/e2e/`); the idempotent-replay primitive they rely on is asserted here (P12/P14) | **NOT-RUNNABLE** over the HTTP harness (by design) | the deployed-URL browser runs (W055) |
| P13 release/update | — | deployment update (new commit → new deployment → healthy) | requires the real deployment | **NOT-RUNNABLE-at-boundary** | W055 (post-deployment update + health re-check) |
| P16 provider degradation | — | a provider dependency failing → typed degradation surfaced → recovery | requires the real providers (Neon/R2/Upstash) | **NOT-RUNNABLE-at-boundary** | W053 (the nine mandatory negative tests) + W055 |

Run facts: phase A 102 public-surface requests (0 unexpected failures; every
non-ok response was an EXPECTED negative-path verdict — `session-revoked`,
`request-envelope-malformed`, `request-validation`, `session-expired`,
`session-unknown`, 401 cross-tenant bootstrap, `authority-denied`), phase B 6
requests (1 expected 429). Trace: `EPOCH_HARNESS_TRACE` JSON journal
(per-call journey/surface/status/correlation/replay evidence; captured in the
run, not committed — 102 entries).

## Defects (the observe → record → reproduce → fix → rerun loop)

| Defect | Severity | Reproduction | Fix (owned surface) | Regression test | Status |
|---|---|---|---|---|---|
| D-1: the Decide/Verify surfaces submitted a verification chain the verification authority REJECTED (`evidence-run-mismatch`, `evidence-not-produced-by-run`, `evidence-digest-mismatch` — a fabricated web run claimed the fixture evidence; the result cited the solution digest as unproduced evidence), and the UI rendered "Chain validated — verdict: returned" regardless of the authority's verdict | P2 (material: the verification surface mispresented the authority's verdict; no data loss, no boundary breach — the authority itself correctly fail-closed) | P06/P08 first run (harness) + live probe of `verification.validateChain` (the three issues returned verbatim) | `src/product/derivation.ts` `verificationChainPayload` rebuilt: the chain's run is the fixture run that ACTUALLY produced the evidence (the record's own `producedBy`), and the result cites exactly that run's evidence; `src/product/stages/decide.tsx` + `realize.tsx` (VerifyStage) now render the authority's own verdict (admitted → success note; rejected → the issue codes/messages, never a client-invented "validated") | `src/product/derivation.test.ts` (the chain must be ADMITTED: `ok:true`, no issues) + the P06/P08 harness assertions over the deployed surface | **CLOSED** (derivation test 5/5; full local journey rerun green) |
| D-2: the discovery role table rendered an empty Role column (`role.roleId` does not exist on the authority's `RoleProposal` shape — `roleProposalId`/`roleSlug`) | P3 (cosmetic; found by the P05 harness probe) | P05 probe: role rows render with an empty first column | `src/product/stages/decide.tsx`: the role table renders `roleProposalId` + `roleSlug` + `mission` | P05 harness assertion (`roleProposalId` matches `drole:*`; non-empty slug/mission) | **CLOSED** |

## Findings escalated to the Tech Lead (NOT fixable in W052-owned surfaces)

| Finding | Severity | Detail |
|---|---|---|
| F-1: cross-tenant session ISSUANCE at the fixture identity boundary | P2 (defense-in-depth gap; no privileged data exposed — both demo tenants are the deployment's public product content and reachable by domain selection at the entry; the mutation path fails closed) | `POST /api/product/authenticate` (domain=construction) mints a verified authentication result that `session.issue` ACCEPTS in the `tenant:lightspeed` scope (the session manager validates principal↔result and tenant↔manager scope, but not result↔tenant identity registry). The issued session then passes the session/tenant gates for READS in the foreign tenant; MUTATIONS fail closed through the W009 gate (`authority-denied` — the principal is unknown in the foreign tenant's authorization facts). Required fix location (W051/W047-frozen for W052): `apps/web/src/server/product-runtime.ts` (tenant-scoped identity boundary or a tenant-binding check on the authentication result) — a TL decision, recorded here + in the W052 PR body. The REQUIRED P18 negative (a construction SESSION used in the lightspeed scope) fails closed as specified. |

## Evidence

- Run: the two-phase local production run (phase A preview defaults, phase B
  tiny IP budget) — vitest 21 passed / 1 gated-skip (phase A) + 1 passed
  (phase B), zero unexpected failures; captured logs: phase A/B vitest
  output + `healthz`/`readyz` JSON + the per-call JSON trace journal
  (`EPOCH_HARNESS_TRACE`).
- Build: `pnpm --filter @epoch/web build` (the committed
  `apps/web/vercel.json` buildCommand) — success from this checkout; the
  served app was `next start` on the built output.
- Defect evidence: the D-1 probe transcript (the authority's three typed
  issues verbatim) and the pre-fix failing P06/P08 runs; post-fix reruns
  green (derivation test + full harness).
- CI artifact: the W052 PR checks (governance / boundary / typecheck / lint /
  test / build).

## Rerun

Result: **PASS (local production build)** — 22/22 journey tests green across
the two phases (P17 in its dedicated tiny-budget phase); the standard
hermetic battery remains green with the suite skipped (no `BASE_URL`).
Notes: every "PASS" above is a claim about the LOCAL production build only;
the deployed-URL reruns are pending operator credentials and will be recorded
here by the TL/W055 using the same harness
(`EPOCH_PRODUCTION_BASE_URL=https://<project>.vercel.app npx vitest run qa/production`).

## Dispositions

- P0 defects: **0**. P1 defects: **0**.
- P2: D-1 CLOSED (fixed in owned surfaces + regression + rerun); F-1
  ESCALATED (frozen file — TL decision; compensating control verified).
- P3: D-2 CLOSED.
- NOT-RUNNABLE-at-boundary (honest, per spec/journey-validation.md): P14
  restart-durability (needs `EPOCH_DATABASE_URL`), P15 R2-backed byte
  round trip (needs the object-store binding), P13 (needs the real
  deployment), P16 (needs the real providers), P09/P10 browser portions
  (W047 suite covers the client behaviors; W055 runs them against the
  deployed URL).
