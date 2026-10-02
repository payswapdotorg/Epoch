# W055 — Serialized Production Closure

Status: BLOCKED (until W052, W053 and W054 all merge)
Wave: ACR-006 / serialized closure (Tech Lead)
Depends On: W052, W053, W054
Worker Count: 1

## Objective
Final integration and closure of the public deployment program. This Work Order is serialized after the concurrent wave merges and MAY edit cross-cutting deployment/product surfaces because it is the only active work order. No new architecture may be introduced during W055 without another ACR.

## Owned write surfaces
- cross-cutting (serialized): spec/journey-validation.md, spec/PROJECT-STATE.md, spec/development-state/*, AI_CONTINUATION.md, docs/LLM-ARCHITECT-HANDOFF.md, README.md, docs/journeys/production.md (consolidated production journey evidence), release/clients/release-manifest.json (production deployment entries), .github/workflows/* (deployment-config validation job), docs/deployment/*, docs/operations/* (reconciliation), and any cross-surface integration repair the concurrent wave reported.

## Required
1. **Topology verification**: Browser → Vercel → apps/web (in-process Application Gateway) → Neon PostgreSQL / R2 / Upstash / Apify — every hop verified against the real deployment (or honestly recorded as NOT-VERIFIED at the credential boundary).
2. **Environment parity**: the deployed production profile matches spec/production-environment.md; no dev-only behavior in production; environment variables validated.
3. **Integration verification**: web ↔ gateway ↔ Neon ↔ R2 ↔ Redis end-to-end (production persistence across restart; object upload/retrieval P15; provider degradation/recovery P16; rate-limit behavior P17).
4. **External acquisition integration**: the Apify path (or its honest degraded state) integrated in the deployed product; provenance visible.
5. **Auth/tenant/security review**: the Section-9 security checklist verified against the deployed system (no secret committed; no API key in browser bundle; tenant isolation; secure cookies; CSRF posture; origin restrictions; rate limits; request-size limits; upload validation; safe object access; safe error messages; server-side validation; audit/correlation; no debug endpoints; no dev credentials; no unrestricted admin surface; no unrestricted external-source execution).
6. **Rate-limit review**: budgets configured; Upstash binding verified (or in-memory reference active with honest recording).
7. **Production migration review**: deterministic plan digest reproducible from a fresh clone; migration mismatch behavior verified.
8. **Cost guardrail review**: all five providers' usage within the verified free-tier allocations; guardrails active; no paid resource introduced.
9. **Recovery testing**: provider-failure recovery (each provider simulated down → typed degradation → recovery), application restart persistence (P14), rollback test (Vercel rollback to the previous deployment with data-compatibility expectations documented).
10. **Public journey validation**: the consolidated P01-P18 production journey set executed against the deployed product; every journey passes or has recorded honest disposition at the credential boundary.
11. **Production release identity**: release/clients/release-manifest.json gains the production deployment entries (public URL, source commit, deployment identifier, environment profile) — only verified values, never fabricated.
12. **Documentation/state reconciliation**: PROJECT-STATE, the four state manifests, AI_CONTINUATION, the architect handoff, README and the deployment/operations docs record the final program state with exact SHAs, deployment identifiers and the honest VERIFIED/NOT-VERIFIED table per provider.
13. **CI**: the deployment-config validation (env contract schema, manifest schema, migration digest pin) runs in CI; E2E against the deployed environment is wired where the credential boundary permits.

## Acceptance
1. The ACR-006 acceptance gate (all six sections of ACR-006 §Acceptance criteria) is verified against the real deployment, with every item VERIFIED or honestly recorded as blocked at the credential boundary with the exact operator input required.
2. The consolidated journey evidence (docs/journeys/production.md) passes P01-P18 or records honest dispositions; P0=0, P1=0, every P2 dispositioned.
3. The final Tech Lead report (ACR-006 STATUS format) is recorded in the repository state, not just in chat.
4. Standard battery + release-readiness green; no root manifest/lockfile changes; zero new dependencies.

## Non-goals
No new architecture; no new ACR scope; no new semantic subsystem; no provider promotion into authority.
