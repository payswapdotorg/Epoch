# W030 — Security/Isolation/Observability Evidence Suite (`tests/security`)

The **cross-surface proof layer** of Work Order W030: one deterministic,
in-process scenario that composes the REAL kernels and the REAL
execution surfaces through their public admission paths, and asserts
the security/isolation/observability invariants ACROSS every surface
it touches.

- **Scenario definition**: `scenarios/security-scenario.ts`
  (importable, documented) + `scenarios/shared.ts`
- **Tests**: `test/*.test.ts` (vitest, 15 tests — positive, negative,
  recovery, and the REAL execution-surface intake)

## The scenario (the inspectable evidence chain)

```
W009 officer context (REAL authorization facts)
        ▼
W030 policy registration (policy is data: t2 ceiling, declarative+wasm,
    sandbox-only+tenant-scoped, quarantine-on-violation)
        ▼
W023 listing registration (REAL sealListingVersion → REAL verifier)
        ▼
W030 sandbox admission (conforming t2/wasm subject) ─── the isolation
    gate + the REAL W008 grantExceedsCeiling differential
        ▼
Execution-surface intake (REAL W020 session, REAL W021 run,
    REAL W022 action, W009 decision, R12 boundary check)
        ▼
Violating admission (t4/remote/external-transfer) ─── typed
    isolation-violation rejection + policy-driven quarantine
        ▼
Audit pass (tenant-boundary R12 family + REAL W041 projection of a
    REAL W036 program — the invariants hold: zero findings)
        ▼
Recovery (explicit quarantine release → remediated re-admission →
    health restored: quarantine lifted, violation facts retained)
```

Every step emits `security:*` events (W010-shaped, one stream per
observed subject `stream:security-<suffix>`, host steps on
`stream:security-host-<tenant-suffix>`), and every event digests
identically through the REAL W010 `sealEvent` (the parity check in
`scenario.positive.test.ts`).

## The named tests (acceptance criteria → evidence)

| Criterion | Named test |
|---|---|
| Security policy as data; swapping revisions changes enforcement with zero code change | `scenario.positive.test.ts` (policy registration + the active-revision selection); `services/security/test/flow.negative.test.ts` (retired revisions never win) |
| Sandbox admission enforces the W008 trust-class ceiling table | `scenario.negative.test.ts` (t4-under-t2, remote-flavor, external-transfer, grant-exceeds-trust-ceiling); `surface-intake`/parity suites (verdict AGREEMENT with the REAL `grantExceedsCeiling`) |
| Fail-closed: no active policy → no admission | `scenario.negative.test.ts` (`unknown-policy`) |
| Quarantine is deny-by-default with typed conflicts | `scenario.negative.test.ts` + `scenario.recovery.test.ts` (rejection of re-admission while quarantined; release + recovery) |
| Tenant isolation (R12) enforced and AUDITED | `scenario.negative.test.ts` (foreign principal, single-tenant guard, cross-tenant stream read); `scenario.positive.test.ts` (the denied boundary observation audits CLEAN); `services/security/test/flow.positive.test.ts` (the allowed-breach audit finding) |
| Tampered digests never enter | `scenario.negative.test.ts` (tampered listing through the REAL W023 verifier); kernel `store.test.ts` (tampered observations/policies/quarantine facts) |
| The W041 access-projection invariants are verified by the audit | `scenario.positive.test.ts` (the REAL projection audits clean); `services/security/test/parity.test.ts` (the forked projection flagged) |
| Every security-relevant step is observable | `scenario.positive.test.ts` (metrics fold: 8 observations, per-class counts, the full trail sorted); `surface-intake.test.ts` (REAL W020/W021/W022 facts admitted) |
| Determinism | `scenario.positive.test.ts` (two runs → byte-identical snapshots/states/trails); kernel + service determinism suites |
| The health projection derives from policy thresholds + quarantine | `scenario.recovery.test.ts` (critical → degraded → quarantine lifted); kernel `metrics-health-audit.test.ts` |

## How to run

`tests/security` is an owned W030 surface **outside the
pnpm-workspace globs** (the root manifests are frozen for this Work
Order), so it is not a pnpm importer and carries no `node_modules`. The
suite borrows the toolchain of this Work Order's own workspace package
(`@epoch/security-runtime`) and resolves imports via explicit aliases
(`vitest.config.mts` + `tsconfig.json` paths — the same set
`package.json` declares as devDependencies).

From the repository root (after `pnpm install`):

```bash
# the security evidence suite (15 tests)
pnpm --filter @epoch/security-runtime exec vitest run --root ../../tests/security

# typecheck
pnpm --filter @epoch/security-runtime exec tsc --noEmit -p ../../tests/security/tsconfig.json

# lint
(cd tests/security && ../../services/security/node_modules/.bin/eslint .)
```

## Runtime dependency policy (W030 pin, frozen)

The composed workspace packages as **devDependencies only** (declared
in `tests/security/package.json`): `@epoch/security-runtime` (this Work
Order's own host — the deliverable this suite exists to exercise),
`@epoch/observability` (this Work Order's own kernel),
`@epoch/authorization`, `@epoch/tenancy`, `@epoch/extension-runtime`,
`@epoch/marketplace`, `@epoch/agent-runtime`,
`@epoch/agent-orchestration`, `@epoch/action-gateway`,
`@epoch/action-protocol`, `@epoch/simulation-fabric`,
`@epoch/simulation-protocol`, `@epoch/capability-registry`,
`@epoch/policy-contracts`, `@epoch/solution-delivery`,
`@epoch/access-projection`, `@epoch/event-log`, `@epoch/tsconfig`,
`@epoch/eslint-config`, `vitest`, `typescript`. No third-party
dependencies were added.
