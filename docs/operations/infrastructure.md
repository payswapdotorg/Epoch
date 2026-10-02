# Infrastructure Failure & Recovery Runbook — Neon / R2 / Upstash (W053, ACR-006)

The operator-facing runbook for the three infrastructure providers of
the public deployment. Contracts: `spec/production-operations.md`
(health/degradation), `spec/production-rollback.md` (recovery/backup),
`spec/free-tier-infrastructure.md` (quotas/escalation). Provisioning:
`docs/deployment/neon-r2-upstash-setup.md`.

**The evidence rule:** every failure mode below is pinned by an
automated negative test (the W053 consolidated nine-negative battery —
`services/application-gateway/test/production-negative.test.ts` + the
adapter batteries in `adapters/s3-object-store/test/` and
`adapters/upstash-redis/test/`). The runbook does not describe
hypothetical behavior; it describes SIMULATED, OBSERVED behavior.

---

## 1. Health signals (how to see each provider's state)

`GET /api/readyz` (unauthenticated; secret-free by construction —
presence booleans + binding kinds only):

```json
{
  "ok": true, "ready": true, "profile": "production",
  "bindings": {
    "persistence": { "kind": "postgres", "configured": true, "degraded": false },
    "objectStore": { "kind": "s3", "configured": true, "degraded": false },
    "rateLimit":   { "kind": "upstash", "configured": true, "degraded": false }
  },
  "migrations": { "applied": true, "planDigest": "sha256:…" },
  "degraded": [], "issues": []
}
```

| Symptom in readyz / errors | Provider | Meaning | Section |
|---|---|---|---|
| `persistence.degraded` / boot refusal (production) | Neon | `EPOCH_DATABASE_URL` absent/invalid (boot fails closed — never silently ephemeral) | §2 |
| typed `transient` errors on mutating ops; slow first request | Neon | compute suspended (scale-to-zero) or outage | §2 |
| `objectStore.degraded` / boot refusal (production) | R2 | `EPOCH_OBJECT_STORE_*` absent/partial | §3 |
| typed `transient` on uploads; `object-not-found` on reads | R2 | backend unreachable / missing bytes | §3 |
| `rateLimit.degraded` (kind `in-memory`) | Upstash | unconfigured → per-instance fallback | §4 |
| guard failures resolve per policy (`details.rateLimit.degraded: true`) | Upstash | REST unreachable/401/malformed | §4 |

`GET /api/healthz` is liveness only (process up, profile, version,
uptime) — it never touches a provider, so it stays green during
provider outages (use it to distinguish "app down" from "provider down").

---

## 2. Neon PostgreSQL (durable authoritative state)

### Failure modes and observed behavior (battery evidence)

| Failure | Observed behavior (test-pinned) |
|---|---|
| **Database unavailable at boot** — the wire raw-throws `ECONNREFUSED`-style driver errors | `gateway.prepare()` returns the TYPED gateway error (`unrecoverable` / `internal-invariant-violated`, "the gateway table migration failed: …") — never a raw pg error, never a stack leak. Production boot fails closed (the instance does not serve traffic on unmigrated durable state). [#3] |
| **SPI operations on a dead wire** | Every operation returns the TYPED persistence failure — `adapter-error` (autocommit channel) or `transaction-rolled-back` (all-or-nothing holds; nothing partially commits). Never a raw throw. [#3] |
| **Mid-flight death (boot healthy, DB dies before the next request)** | The gateway boundary stays up with typed outcome envelopes; the durable records of that call do not land (surfaced by readiness/next boot — the in-process authority of the moment answers; PostgreSQL remains the durable authority of record). No raw pg error ever crosses the boundary. [#3] |
| **Migration mismatch** — a DIFFERENT plan with a malformed shape (duplicate table, non-monotonic versions, invalid grammar) | TYPED `validation` failure; nothing applies. A different WELL-FORMED plan is additive by design (`CREATE IF NOT EXISTS`, never destructive) and is DETECTED by the plan digest: the digest is byte-stable (`2dd476dbdc…68389f` for the gateway plan, pinned by test) and differs for any different plan — readiness surfaces `planDigest`, so drift is visible. [#8] |
| **Duplicate request while the DB is down** | The store cannot load the record → reserve returns `new` → the operation re-executes (retry semantics — the replay engine never invents an outcome it cannot verify). [#7/#3] |

### Recovery procedures

- **Scale-to-zero cold start (expected, ~5 min idle):** the first
  request pays 0.5–2 s compute wake. No action. This is free-tier
  behavior, not an incident.
- **Transient outage/maintenance:** mutating operations answer typed
  `transient`/`gateway-overloaded` — idempotent client retries recover
  automatically (every mutating gateway operation carries an
  idempotency key). No data action.
- **Prolonged outage:** the app fails safe (typed errors; no retry
  storms — bounded, idempotent retries only); recovery is automatic when
  Neon returns. Readyz keeps reporting the binding state.
- **Corruption/disaster (beyond the 6-hour history window):** restore
  posture below (§5) — deterministic migrations + fixture bootstrap on a
  fresh project; runtime-produced state is accepted as lost with a
  recorded incident (the documented free-tier trade-off).

### Quota monitoring

Neon console → Project → Metrics (compute hours, storage, egress —
free). Caps are hard (suspension, not billing). At demo scale Epoch
uses kilobytes/minutes — far under the 100 CU-h / 1 GB / 5 GB caps.
Spending notifications are NOT available on Free; check the console
after traffic events.

---

## 3. Cloudflare R2 (object/evidence bytes)

### Failure modes and observed behavior (battery evidence)

| Failure | Observed behavior (test-pinned) |
|---|---|
| **Backend unreachable (network down)** | `put`/`get` return the TYPED `unavailable` result; `has()` answers false (the SPI's boolean contract); `list()`/`size()` throw the TYPED `S3BackendUnavailableError` (the adapter refuses to LIE with an empty listing). At the gateway seam, `evidence.intake` maps to `authority-rejected` carrying `authorityCode: "unavailable"` — never raw, never a crash, and the boundary stays alive for the next call. [#2] |
| **5xx provider response** | Same typed `unavailable`. [#2] |
| **403 AccessDenied (invalid credentials)** | Typed `unavailable`; the provider's XML error body NEVER crosses the SPI boundary. [#2] |
| **Malformed metadata sidecar (bytes present, sidecar garbage)** | Typed failure (`unavailable`/`validation`) — never fake metadata, never thrown raw. [#4] |
| **Malformed R2 LISTING payload (200 + non-XML garbage — e.g. a broken proxy's HTML page)** | Typed `S3BackendUnavailableError` ("malformed provider payload") — a silent EMPTY listing would be a silent success; the adapter refuses. (A W053 live-readiness fix: the W051 code accepted any 200 body.) [#4] |
| **Tampered bytes behind a digest address** | Typed `digest-mismatch` on retrieval (retrieval is digest-verified; content addressing is authoritative in the SPI). [#4] |

### Recovery procedures

- **Transient failures:** uploads degrade to typed `transient` (retry
  safe — puts are idempotent by digest); reads of missing bytes fail
  typed `object-not-found`. No silent data loss by construction.
- **Credential rotation:** generate a new Object Read & Write token,
  update the two Vercel env vars, redeploy. The adapter is stateless.
- **Bucket loss:** demo/fixture bytes are reproducible from the
  repository (digest-verified fixture restore at boot re-puts them);
  uploaded production evidence retention follows the bucket's lifecycle
  (no auto-delete configured) — restore from the operator's own backups
  if configured; otherwise the loss is recorded (§5).

### Quota monitoring

Cloudflare dashboard → R2 (storage, Class A writes/lists, Class B
reads/heads). NOTE: R2 is the one provider whose over-allowance BILLs
(card on file) instead of degrading — demo-scale consumption is KB-scale
by design, but if allowances are ever threatened: **suspend new writes
first** (the escalation rule — any paid action is an operator decision,
recorded against spec/free-tier-infrastructure.md).

---

## 4. Upstash Redis (ephemeral: rate-limit counters ONLY)

### Failure modes and observed behavior (battery evidence — doubles AND live)

| Failure | Observed behavior (test-pinned) |
|---|---|
| **REST unreachable / 5xx / timeout** | The guard resolves per its DECLARED failure policy — `fail-open` (default): allow + `degraded: true` (rate limiting is abuse control, never authorization); `fail-closed`: typed denial `transient`/`gateway-overloaded` with `details.rateLimit.degraded: true`. Never a throw, never a raw provider error. [#1] |
| **Invalid token (401 Unauthorized)** | Same policy resolution — LIVE-VERIFIED: fail-open `allowed=true, degraded=true`; fail-closed `allowed=false, degraded=true, retryAfter>0`. [#1] |
| **Malformed response (non-JSON body, e.g. an HTML error page; or a non-number result)** | Same policy resolution — the JSON parse failure is caught and resolved by policy; the adapter NEVER propagates. [#4] |
| **Unconfigured (no `EPOCH_RATE_LIMIT_*`)** | Never blocks boot: the per-instance in-memory reference limiter + a surfaced degraded flag (`rate-limit:in-memory`). |

### Recovery procedures

- Automatic: guards fail open (default) while Upstash is down and
  recover the moment it returns — no operator action. Abuse control
  weakens to per-instance during the outage (readyz shows it).
- **Quota exhaustion (500K commands/month):** hard throttle, not
  billing. One command per check by design (a single atomic EVAL:
  INCR + EXPIRE NX) keeps consumption at thousands/month at demo
  traffic. If ever threatened, the degradation order applies (§
  free-tier contract): in-memory fallback + surfaced flag.
- Redis holds NO authoritative state — losing the database entirely
  loses nothing durable (counters only, all TTL-bounded).

### Quota monitoring

Upstash console → database → Metrics (commands, bandwidth, memory) —
free. The trial database used for live verification expires after 3
days (scratch infrastructure — production Upstash is operator input).

---

## 5. Backup / restore posture (free-tier reality)

From `spec/production-rollback.md`:

| Asset | Posture |
|---|---|
| **Schema** | Fully reproducible from the repository — the deterministic migration plan (digest `2dd476dbdc100c725283ce7283ad983b900f504fb3c480ec87dad4890e68389f`), idempotent, additive-only. |
| **Demo/fixture content** | Fully reproducible from the repository (digest-verified fixture restore at boot). |
| **Runtime state (sessions, actions, idempotency, correlation, evidence records)** | Neon Free: 6-hour history window + **1 manual snapshot** (operator-managed; take it before risky operations). |
| **Object bytes** | Content-addressed; fixture bytes reproducible; uploaded evidence retained in the bucket (no lifecycle deletion). |
| **Redis** | Zero retention expectations (ephemeral by contract). |

**Restore path (documented, deterministic):** fresh Neon project →
re-run migrations (the deterministic plan; verify the digest in readyz
matches the pinned value) → fixture bootstrap (digest-verified) → the
deployment is back to the fixture baseline; runtime-produced state is
accepted as lost with a recorded incident, or restored from the manual
snapshot where one exists. Application rollback is independent
(spec/production-rollback.md): Vercel instant rollback for code; data is
forward-only (no destructive migrations in this program).

**Reset/seed protection:** reset/seed/bootstrap scripts refuse
production targets — the profile guard
(`EPOCH_DEPLOYMENT_PROFILE=production` → refuse) + the
connection-string denylist (target host == the production database
host, derived from `EPOCH_DATABASE_URL` → refuse). The guard is
`refusesProductionTarget` in `@epoch/application-gateway` (pinned by
the battery [#9]); usage snippet in
docs/deployment/neon-r2-upstash-setup.md §4.

---

## 6. Escalation rule (the cost-control contract)

Anything that would require PAID infrastructure to resolve (exceeding a
free allowance in a way that threatens data or availability) is an
**OPERATOR decision**, recorded against
`spec/free-tier-infrastructure.md` — never an automated action. The
application fails safe rather than generate paid usage: no auto-scaling
to paid tiers, no retry storms, no unbounded queues, quota guards in
code.

---

## 7. The nine-negative battery index (evidence map)

| # | Failure | Pinned by (test → outcome) |
|---|---|---|
| 1 | Redis (Upstash) unavailable | `production-negative.test.ts` #1 (gateway seam: fail-open boundary up / fail-closed typed `gateway-overloaded` + degraded) + `adapters/upstash-redis/test/upstash-rest-guard.test.ts` (the real adapter: 5xx/401/non-JSON/timeout → policy) + `live-upstash-verification.test.ts` (LIVE: invalid token → fail-open degraded / fail-closed deny) |
| 2 | Object storage unavailable | `production-negative.test.ts` #2 (gateway seam: typed `authority-rejected` + `authorityCode: "unavailable"`, boundary stays alive) + `s3-object-store.test.ts` (network down / 5xx / 403 → typed `unavailable`; typed list throw) |
| 3 | Database unavailable | `production-negative.test.ts` #3 (prepare fails typed; SPI ops typed `adapter-error`/`transaction-rolled-back`; mid-flight keeps the boundary up — never a raw pg error) |
| 4 | Malformed provider response | `s3-object-store.test.ts` (malformed sidecar; **malformed R2 listing XML → typed failure, never a silent empty list** — the W053 fix; truncated XML yields no fabricated keys) + `upstash-rest-guard.test.ts` (non-JSON body; non-number result → policy) |
| 5 | Cross-tenant access attempt | `production-negative.test.ts` #5 (typed `tenant-scope-mismatch` BEFORE any durable interaction — zero persistence statements; production-binding level) + `gateway-session.test.ts` (the R12 envelope battery) |
| 6 | Storage/object authorization bypass attempt | `production-negative.test.ts` #6 (claimed foreign tenantId NEVER lands — the session tenant is stamped; claimed vendor kind → typed validation; digest recomputed server-side) + `s3-object-store.test.ts` (SPI validation before any network I/O) |
| 7 | Duplicate idempotency request | `production-negative.test.ts` #7 (over the REAL embedded PostgreSQL engine: first applies, duplicate replays the RECORDED outcome `replayed: true`; a fresh gateway over the same engine replays WITHOUT executing) + `gateway-session`/`gateway-actions` suites |
| 8 | Migration mismatch | `production-negative.test.ts` #8 (digest byte-stable + pinned literal; malformed different plan → typed `validation`; well-formed different plan → additive + digest-detected; mid-migration failure → typed gateway error) |
| 9 | Configuration/secret absence | `production-negative.test.ts` #9 (the refusal guard: profile / connection-string denylist / no false matches on unparseable input) + `apps/web/src/server/production-env.test.ts` (the W051-frozen fail-closed boot refusal: production without `EPOCH_DATABASE_URL`/`EPOCH_OBJECT_STORE_*` refuses to boot — verified, not modified) |

### Live Upstash evidence (redacted excerpt; full run in the W053 PR)

Executed 2026-10-02 against a temporary no-signup Upstash trial database
(3-day lifetime; scratch infrastructure — production credentials remain
operator input). Sandbox note: this sandbox's DNS resolves `*.upstash.io`
through two pools of which only one is reachable, so the one-time run
piped the adapter's HTTP through a local TCP→TLS forwarder to a pinned
reachable endpoint IP — the adapter's HTTP semantics are unchanged and
every response below is from the real Upstash REST API.

```text
[live-upstash] INCR visible — key ratelimit:tenant:tenant:live-verify-<run>:incr:<window> reads 2
                after two checks; decisions remaining=98 degraded=false
[live-upstash] TTL on ratelimit:tenant:tenant:live-verify-<run>:ttl:<window> = 20s (<= 2x window; self-expiring key)
[live-upstash] window behavior — 3 allowed, 4th denied (retryAfterMs=8000);
                next epoch-anchored window fresh (remaining=2)
[live-upstash] invalid token — fail-open: allowed=true degraded=true; fail-closed:
                allowed=false degraded=true (typed, never a raw provider error)

Test Files  1 passed (1) — Tests  4 passed | 1 skipped (the inactive-skip guard)
```

The live run also **found and fixed a live-only defect**: the W051
adapter posted the command to the `/eval` path prefix with a JSON body —
real Upstash ignores the body on path-style endpoints (arguments come
from the path) and answered `ERR wrong number of arguments for 'eval'`.
The corrected, live-verified form POSTs the command array
(`["EVAL", <script>, "1", <key>, <ttl>]`) to the REST **root**
(`adapters/upstash-redis/src/index.ts`; regression-pinned by the updated
adapter test asserting the root URL + body shape).
