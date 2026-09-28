# @epoch/security-runtime — Epoch Security Runtime service (W030)

Service layer. Owned surfaces of Work Order **W030**:
`services/security/*` (this service) + `packages/observability/*` (the
kernel — see `packages/observability/README.md`) +
`tests/security/*` (the evidence suite) + `docs/security/*`.

The thin typed **HOST FACADE** over the `@epoch/observability` kernel:
the enforcement and intake surface of Epoch's
Security/Isolation/Observability domain.

## The host surface

| Operation | What it does |
| --- | --- |
| `registerPolicy` | Admits a security-policy revision (policy is data; idempotent by digest, replay-conflict on skew) and emits `security:policy-registered` on the tenant host stream. |
| `registerListing` | Admits a W023 marketplace listing version (verify-or-seal through the REAL marketplace verifier; R12 developer-tenant agreement; idempotent by digest). |
| `admitExtension` | **The sandbox admission gate**: kernel schema validation → deny-by-default quarantine → fail-closed active-policy lookup → listing provenance resolution → the kernel isolation check → the REAL W008 grant-ceiling differential (mirror/authority disagreement is the fail-closed `isolation-authority-conflict`). Violations emit `security:violation-detected` and (per policy) auto-quarantine. |
| `observeSandboxInvocation` | Records one W008 boundary invocation outcome (allowed/denied + neutral denial reason). |
| `observeAuthorizationDecision` | Records one W009 decision-point outcome (by exact-revision decision digest). |
| `observeTenantBoundary` | Records one R12 tenant-boundary check (the audit family's input). |
| `observeAgentSession` / `observeSimulationRun` / `observeAction` | The W020/W021/W022 execution-surface lifecycle intake (REAL record shapes pinned by the service parity tests). |
| `recordSandboxViolation` | Records a sandbox violation (critical) with optional policy-driven quarantine. |
| `imposeQuarantine` / `releaseQuarantine` | The quarantine lifecycle (deny-by-default; typed conflicts; explicit gated release). |
| `runAuditPass` | Runs both audit families (tenant-boundary R12 + W041 projection invariants); every finding becomes a `security-audit` observation + `security:audit-recorded` event. |
| `projectHealth` | The derived security state (metrics + health + audit findings + quarantine) + `security:health-projected` event. |
| `readAuditTrail` / `readStream` | Tenant-scoped audit reads (sorted; R12 enforced). |
| `health` / `snapshot` | Typed liveness + deterministic host snapshot. |

## Security posture (the fail-closed rules)

1. **The W009 authorization gate denies unauthorized operations BEFORE
   any kernel admission** (every operation names its resource and
   action kind `security.<operation>`; not-applicable is fail-closed).
2. **Tenant isolation (R12)**: single-tenant guard + cross-tenant
   listing/stream denials.
3. **No active policy → no admission** (`unknown-policy`).
4. **Quarantined subjects are deny-by-default** at the admission gate
   (`quarantined-subject-rejected`).
5. **Authority drift fails closed**: the mirrored isolation check and
   the REAL W008 `grantExceedsCeiling` must AGREE on every grant or
   admission is rejected (`isolation-authority-conflict`).
6. **Tampered digests never enter** (sealed inputs are verified at
   admission — policies, observations, quarantine facts, listings).
7. **Every security-relevant step is auditable**: sealed observations +
   `security:*` events on one stream per observed subject
   (`stream:security-<suffix>`), host steps on
   `stream:security-host-<tenant-suffix>`.

## Determinism

Zero wall-clock reads and zero randomness — every instant is
caller-supplied; every read path is sorted (no insertion-order leaks);
the kernel store is the single stream authority. Two hosts fed the
same operations hold byte-identical state (pinned by the determinism
test).

## Runtime dependency policy (frozen, W030 pin)

`@epoch/authorization` (the W009 gate), `@epoch/tenancy` (the tenant
grammar), `@epoch/observability` (the kernel), `@epoch/extension-runtime`
(the REAL W008 ceiling authority for the fail-closed differential),
`@epoch/marketplace` (the REAL listing verifier), `zod` — NOTHING else.
Compatibility with `@epoch/agent-runtime` (W020),
`@epoch/simulation-fabric` (W021), `@epoch/action-gateway` (W022),
`@epoch/access-projection` + `@epoch/solution-delivery` (W041),
`@epoch/event-log` (W010) and their upstream vocabularies
(W003/W004/W007) is pinned via devDependencies + parity tests — never
runtime deps.

## How to run

```
pnpm --filter @epoch/security-runtime typecheck
pnpm --filter @epoch/security-runtime lint
pnpm --filter @epoch/security-runtime test
```

The cross-surface evidence suite lives in `tests/security` (an owned
non-importer surface; see its README).
