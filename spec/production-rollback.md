# Epoch Production Rollback & Recovery (ACR-006)

## Rollback model

Two independent axes:

1. **Application rollback** (code/config): Vercel instant rollback to the previous production deployment (platform feature, one action). The repository `main` is NOT rolled back — the deployed artifact is. A forward-fix commit is the default remediation path; instant rollback is the emergency lever.
2. **Data rollback** (state): there is NO automatic data rollback. PostgreSQL state is forward-only (deterministic migrations are additive/idempotent; no destructive migrations are permitted in this program). Neon Free provides a 6-hour history window and 1 manual snapshot — see Backup posture.

## Rollback procedure (application)

1. Verify the defect: reproduce against the production URL; record in the defect ledger with severity.
2. P0/P1 with no forward fix ready: Vercel dashboard → Deployments → previous healthy production deployment → **Promote to Production** (instant rollback; the URL is stable).
3. Record the rollback in the incident notes (deployment IDs before/after, defect reference).
4. Forward-fix on a branch, standard 7-gate review, redeploy.
5. W055 verifies one rollback test end-to-end (or records the honest boundary state).

## Data-compatibility expectations

- Migrations in this program are additive (new tables/columns only, idempotent, digest-pinned). An application rollback to the previous deployment keeps working against the newer schema (additive compatibility).
- A forward deployment after rollback re-applies idempotent migrations (no-ops).
- No destructive migration may merge in ACR-006 (review gate: W055 migration review).

## Recovery procedures

### PostgreSQL (Neon) unavailability / suspension
- Scale-to-zero cold start: first request pays latency; no action needed (expected free-tier behavior).
- Maintenance/outage: requests degrade to typed `transient` errors; idempotent client retries recover automatically. No data action.
- Corruption/disaster (beyond free-tier history): restore posture = re-run deterministic migrations on a fresh project + fixture bootstrap (demo content is reproducible from the repository); runtime-produced state (sessions/actions) is accepted as lost with a recorded incident — the documented free-tier trade-off (6-hour history window + 1 manual snapshot). Operator may take the 1 manual snapshot before risky operations (documented in the infra runbook).

### R2 unavailability
- Uploads degrade to typed `transient` errors; reads of missing bytes fail typed `object-not-found`; no silent data loss (digest-addressed puts are idempotent).

### Upstash unavailability
- Guards fail-open (default policy) with degraded flags; per-instance in-memory limiting continues; recovery is automatic when Upstash returns.

### Apify failure/exhaustion
- Acquisition degrades (disabled + surfaced); quota guard prevents runaway cost; next scheduled run recovers; no authoritative state was touched (untrusted inputs never mutate semantics directly).

### Vercel deployment failure
- The previous production deployment keeps serving (atomic deploys); platform notification; forward-fix redeploy.

## Backup posture (free-tier reality)

- Schema: fully reproducible from the repository (deterministic migration plan).
- Demo/fixture content: fully reproducible from the repository (digest-verified fixture restore at boot).
- Runtime state (sessions, actions, idempotency, correlation, evidence records): Neon Free 6-hour history + 1 manual snapshot; export procedure documented in the infra runbook (a repository script performs a typed full export through the persistence port — no external tools required).
- Object bytes: content-addressed; fixture bytes reproducible; uploaded evidence is retained in the bucket (no lifecycle deletion).
- Redis: zero retention expectations (ephemeral by contract).
- Provenance/acquisition records: persisted as Epoch evidence records (Neon) — same posture as runtime state.

## Escalation

Any event that would require paid infrastructure to resolve (e.g., exceeding free allowances in a way that threatens data or availability) is an OPERATOR decision, recorded against spec/free-tier-infrastructure.md — never an automated action.
