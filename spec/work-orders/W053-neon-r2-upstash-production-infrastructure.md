# W053 — Neon + R2 + Upstash Production Infrastructure

Status: BLOCKED (until W051 merges)
Wave: ACR-006 / concurrent wave 1 (infrastructure adapters)
Depends On: W051
Worker Count: 1

## Objective
Implement and verify the production infrastructure adapter surfaces assigned by W051: connect PostgreSQL through Neon behind the frozen persistence SPI, implement the S3-compatible object-store adapter (R2) and the Upstash rate-limit adapter against the W051-frozen ports, provision/verify production schemas and migrations, verify tenant isolation, the content-addressed evidence/object flow, provider failure/degradation, and rate limiting/idempotency where applicable — with reproducible setup documentation.

No provider may become semantic authority.

## Owned write surfaces
- adapters/s3-object-store/src/* (implementation + tests; the W051 package skeleton/manifest is extended, not replaced)
- adapters/upstash-redis/src/* (implementation + tests; the W051 package skeleton/manifest is extended, not replaced)
- packages/persistence/src/postgres/* (production hardening ONLY if strictly required — SSL/connection options; NO semantic changes; if untouched, stay read-only)
- docs/operations/infrastructure.md (provider health/failure/recovery runbook)
- docs/deployment/neon-r2-upstash-setup.md (reproducible provisioning/setup guide, placeholders for secrets)

## Required
(Scoped 2026-10-02: W051 delivered the adapter IMPLEMENTATIONS — adapters/s3-object-store and adapters/upstash-redis are real, double-tested code. W053 owns the CONNECTION + VERIFICATION work against real providers; adapter bug fixes found during live verification land in the same owned surfaces.)

1. **Live verification of the S3-compatible object-store adapter** (adapters/s3-object-store/src/*): connect to the real R2 bucket (credentials per the W051 environment contract), verify the full SPI round trip against real infrastructure (put/get/has/list/size, digest verification, the fixture-restore boot path), fix any live-only defects in the adapter, and extend the test battery where live behavior revealed gaps. The SigV4 signer is already pinned by the official AWS documentation vector.
2. **Live verification of the Upstash rate-limit adapter** (adapters/upstash-redis/src/*): connect to real Upstash REST (a free database — the no-signup trial suffices for adapter verification; production credentials remain operator input), verify the epoch-anchored window behavior against the real REST API, verify quota-conserving TTL behavior, fix any live-only defects.
3. **Neon PostgreSQL connection**: verify the existing pg-backed gateway persistence (bindPgPool) against a real Neon connection string when credentials are available (SSL required); verify deterministic migrations apply cleanly to a fresh Neon project and that the migration plan digest is reproducible; verify reset/seed scripts refuse production targets (profile guard + connection-string check). Until credentials are provided, verify the same code paths against the embedded real-engine test suite (PGlite) and record the honest connection state.
4. **Tenant isolation + evidence flow verification**: content-addressed evidence/object put/get round-trip through the adapter (digest verified); cross-tenant access attempts fail closed at the gateway boundary (negative test); storage/object authorization bypass attempts fail (negative test).
5. **Mandatory negative tests** (recorded as automated tests where possible): Redis unavailable; object storage unavailable; database unavailable; malformed provider response; cross-tenant access attempt; storage/object authorization bypass attempt; duplicate idempotency request; migration mismatch; configuration/secret absence. Every failure must be typed, observable and fail-safe — never a raw provider error, never a crash, never silent success.
6. **Reproducible setup documentation**: step-by-step provisioning guides for Neon/R2/Upstash free tiers (with the verified free-tier limits from spec/free-tier-infrastructure.md), secret placement instructions (Vercel env vars), and the failure/recovery runbook.

## Acceptance
1. Both adapters fully implement their frozen ports with green test batteries (unit + test-double negative tests; real-provider verification recorded honestly as VERIFIED/NOT VERIFIED per the credential boundary).
2. SigV4 signing verified against a deterministic test vector suite (known-key/signature checks) — correctness does not depend on a live R2 account.
3. Upstash adapter verified against the Upstash REST contract (test double + optional live verification against a temporary free database — the adapter code path is exercised against real Upstash infrastructure when the no-signup trial is used; production credentials remain operator input).
4. Neon path verified: PGlite real-engine suite + (when credentials exist) live Neon migration + persistence verification.
5. All nine mandatory negative tests exist and pass with typed fail-safe outcomes.
6. No provider semantics leak into kernel types (boundary check green); no root manifest/lockfile changes; zero new dependencies.
7. Setup + operations documentation complete with placeholders only (no secret values).
8. Standard battery green on the PR.

## Non-goals
No semantic changes to persistence/object-storage SPIs; no provider-native data model; no moving authoritative state into Redis; no paid resources; no infrastructure provisioning without operator credentials.
