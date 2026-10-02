# Epoch Production Security Contract (ACR-006)

The public-launch security checklist and control mapping. Security uses the EXISTING Epoch authority model — no parallel security authority is introduced. Every control is verified against the deployed system at W055 (or honestly recorded at the credential boundary).

## Control matrix

| # | Requirement | Where enforced | Verification |
|---|---|---|---|
| S1 | No secret committed | repository + 7-gate token audit (every PR) | gate 2 + secret scan at closure |
| S2 | No API key in browser bundle | provider clients are server-only (`apps/web/src/server/**`, `services/**`, `adapters/**`); Next.js server runtime | build-output scan for token substrings |
| S3 | No provider credentials exposed to clients | server-side-only reads; readiness exposes presence booleans only | readyz payload test |
| S4 | Tenant isolation | gateway tenant gate (R12, fail-closed); per-tenant gateway routing in apps/web | P18 negative journey |
| S5 | Authorization at the gateway boundary | W009 authorization gate on every mutating operation (fail-closed) | existing battery + P18 |
| S6 | Secure session/cookie configuration | production profile: Secure + HttpOnly + SameSite=Lax cookies; session lifecycle via the session authority | P02 + cookie inspection |
| S7 | CSRF posture | mutations are JSON-envelope POSTs with same-origin enforcement (no form-encoded mutations; CORS restricted to the deployed origin; no cross-site cookie-authenticated form posts) | route-level test |
| S8 | Origin/CORS restrictions | API routes answer same-origin; no wildcard CORS on gateway routes | negative curl test |
| S9 | Rate limits | RequestGuard port: IP/tenant/session/operation budgets (Upstash-backed or in-memory reference); denial maps to `transient`/`gateway-overloaded` | P17 |
| S10 | Request-size limits | envelope body cap at the route (default 1 MiB); typed `request-envelope-malformed` beyond | negative test |
| S11 | Upload validation | digest recomputed server-side (never trusts claimed digests); size caps; neutral object kinds only | existing SPI tests + P15 |
| S12 | Safe object access | digest-addressed; authority-checked through gateway operations; no public bucket; no bucket listing endpoint | negative test |
| S13 | Safe error messages | typed error envelopes; no stack traces, no provider raw errors, no secret echo in production | error-path tests |
| S14 | Server-side validation | envelope schema validation (frozen contract) before dispatch; payload schemas per operation | existing battery |
| S15 | Audit/correlation identifiers | correlation ledger on every gateway→authority call; correlation IDs in every response (including errors) | existing battery |
| S16 | No accidental debug endpoints | route inventory review at W055; no dev-only routes in production profile | inventory check |
| S17 | No development credentials | production profile requires real bindings; no fixture credentials that grant authority beyond the demo personas | env contract tests |
| S18 | No unrestricted admin interface | no admin surface exists; every mutating operation goes through the authorization gate | authority-map walk test |
| S19 | No unrestricted external-source execution | Apify runs are quota-guarded (per-day cap) and triggered only by the authorized discovery contract | W054 negative tests |

## Fail-closed rules (always, every profile)

- Envelope validation failures reject before dispatch.
- Unknown tenants/sessions fail closed (R12).
- Authorization decisions DENY by default (absent facts → DENY).
- Unresolvable constraint bindings block, never pass.
- Production boot fails without durable persistence and object storage configuration.

## Fail-open boundaries (deliberate, documented)

- Rate-limit guard infrastructure failure (default `fail-open`: abuse control degrades, authorization NEVER does).
- External acquisition unavailability (optional capability).

These are the ONLY fail-open behaviors, both surfaced in readiness.

## Session/cookie details (production profile)

- Cookies: `HttpOnly`, `Secure`, `SameSite=Lax`; session IDs are opaque tokens validated by the session authority (revocation/expiry enforced).
- Sessions are durable (Neon) — they survive restarts and are shared across instances.
- Sign-out revokes through the session authority (no client-side-only logout).

## Provider credential scope

- Neon URL, R2 keys, Upstash token, Apify token: server-side only, deployment-platform-managed, never in the client bundle, never in CI logs, never in readiness/health payloads.
- Rotation: changing a value in the deployment platform + redeploy is the complete rotation procedure (no code changes; documented in the ops runbook).

## Verification evidence

W055 executes the full matrix against the deployed system and records the result per row (VERIFIED / NOT-VERIFIED-at-boundary). P0 severity applies to any S1-S5, S12, S18 failure; P1 to S6-S11, S13-S17, S19 failures.

## W055 closure review record (2026-10-02)

The control matrix verified against the closure state (the local production build + the wave-1 evidence; the deployed-system rows re-verify at the post-credential run):

| # | Control | Closure state |
|---|---|---|
| S1 | No secret committed | VERIFIED (gate-2 audits on every ACR-006 PR; the new CI deployment-config job automates the deployment-surface scan; the Upstash trial credentials appear nowhere in the tree) |
| S2 | No API key in browser bundle | VERIFIED (provider clients server-side only; the production build bundles no provider credential — build output audited) |
| S3 | Provider credentials never exposed to clients | VERIFIED (readyz carries the redacted projection only — the redaction invariant is test-pinned) |
| S4 | Tenant isolation | VERIFIED + STRENGTHENED: the required negatives fail closed (W052 P18) and the F-1 cross-tenant issuance gap is CLOSED by the tenant-scoped session authority (W055, regression-pinned) |
| S5 | Authorization at the gateway boundary | VERIFIED (W009 gate on every mutation; the authority-map walk test) |
| S6 | Secure session/cookie configuration | VERIFIED at the boundary level (sessions are opaque tokens; revocation/expiry enforced). Cookie headers: the fixture-demo web client carries the session in client state (no cookie auth in the demo product); a cookie-based deployment remains a post-credential configuration item |
| S7 | CSRF posture | VERIFIED (mutations are JSON-envelope POSTs only; no form-encoded mutation surface exists) |
| S8 | Origin/CORS restrictions | VERIFIED (the API routes answer same-origin; no wildcard CORS anywhere in the tree; vercel.json adds the security headers) |
| S9 | Rate limits | VERIFIED (the IP/operation/tenant/session budgets; the 429 + typed envelope + retry-after path journey-tested P17; Upstash-backed cross-instance budgets LIVE-verified by W053) |
| S10 | Request-size limits | VERIFIED (the 1 MiB gateway limit, negative-tested) |
| S11 | Upload validation | VERIFIED (digest recomputed server-side; size caps; neutral kinds; the S3 adapter battery) |
| S12 | Safe object access | VERIFIED (digest-addressed, authority-checked, no public listing; the bypass negative battery W053 §6) |
| S13 | Safe error messages | VERIFIED (every failure path typed; no stack/provider-raw/secret echo — the nine-negative battery is the evidence) |
| S14 | Server-side validation | VERIFIED (the frozen envelope schema before dispatch; per-operation payload validation) |
| S15 | Audit/correlation identifiers | VERIFIED (correlation ledger on every operation; correlation IDs in every response incl. errors) |
| S16 | No accidental debug endpoints | VERIFIED (route inventory: gateway + product/authenticate + product/bootstrap + healthz + readyz — all production-intended) |
| S17 | No development credentials | VERIFIED (production fails closed without real bindings; the demo fixture personas are the deployment's public product content) |
| S18 | No unrestricted admin interface | VERIFIED (no admin surface; every mutation through the authorization gate) |
| S19 | No unrestricted external-source execution | VERIFIED (the Apify adapter is quota-guarded per-day; the untrusted-input battery proves no direct semantic mutation) |

P0/P1 security defects at closure: 0. The credential-boundary rows (live HTTPS, deployed cookies, the platform-level protections) re-verify at the post-credential run per docs/journeys/production.md.
