# @epoch/observability — Epoch Observability kernel (W030)

Kernel layer. Owned surfaces of Work Order **W030**:
`packages/observability/*` (this package), plus
`services/security/*` (the host runtime — see
`services/security/README.md`), `tests/security/*` (the evidence
suite), `docs/security/*` (the documentation).

The typed **Security/Isolation/Observability** domain model
(architecture.md, binding: *"Public extensions are sandboxed and
capability-scoped."*; lock rule 10: *"Public arbitrary code is
sandboxed."*; R12 tenant isolation).

## Authority split (lock rule 16 — consume, never redefine)

| Authority | Owner | How this kernel consumes it |
| --- | --- | --- |
| Sandbox host machinery (admission, permission enforcement, invocation envelopes) | `@epoch/extension-runtime` (W008) | MIRRORED closed vocabularies (trust classes, flavors, data handling, grant ceilings, host functions, legal scopes) + the `SandboxSubject` structural mirror — parity-pinned, never a runtime edge |
| Authorization decisions | `@epoch/authorization` (W009) | OBSERVED by digest reference (`decisionDigest` in projection summaries; provenance digests in observations); never re-evaluated |
| Tenancy containment / identity | `@epoch/tenancy` / `@epoch/identity` (W009) | id grammars MIRRORED (drift-pinned by parity tests — no runtime coupling) |
| The change history | `@epoch/event-log` (W010) | `security:*` events ride the W010 event SHAPES via the structural mirror; digests identical through the REAL `sealEvent` (devDep parity) |
| Access projections (authorization + redaction) | `@epoch/access-projection` (W041) | the audit family VERIFIES their published invariants (identity preservation, redaction completeness, decision + policy linkage) over MIRRORED summaries |
| Marketplace listings / trust metadata | `@epoch/marketplace` (W023) | the isolation profile may REQUIRE a listing reference; listing verification is the service's composition |
| W020/W021/W022 execution surfaces | `services/agent-runtime` / `packages/simulation-fabric` / `services/action-gateway` | OBSERVED as neutral facts (class `agent-session` / `simulation-run` / `action-dispatch`, bounded detail records); the SERVICE pins the REAL record shapes via parity tests |

## Surface

- **Observations** — sealed, content-addressed, tenant-scoped facts
  (`SealedObservation`): subject kind/id, closed class/outcome/severity
  vocabularies, acting principal, W006 exact-revision provenance digest,
  caller-supplied instant, bounded neutral detail. Append-only;
  idempotent by id + digest.
- **Security policy as data** — sealed `SealedSecurityPolicy` records:
  isolation profile (max trust class, admitted flavors, admitted data
  handling, listing requirement, quarantine-on-violation) + health
  thresholds. Swapping the active revision changes enforcement with
  ZERO code change.
- **The isolation check** — `checkIsolation(subject, profile)`: a
  deterministic pure predicate over the W008-mirrored sandbox subject
  description; fail-closed with the typed violation list (8 closed
  codes), verdict agreement with the REAL W008 `grantExceedsCeiling`
  pinned by parity tests.
- **Quarantine** — append-only impose/release facts, deny-by-default
  derived fold, typed conflicts (double imposition, baseless release).
- **Metrics + health** — `foldObservations` (deterministic counters)
  and `projectSecurityHealth` (healthy / degraded / critical from the
  active policy's thresholds + quarantine state).
- **Audit families** — `auditTenantBoundary` (R12 breach detection over
  the observed record) and `auditProjectionSummary` (the W041
  invariants).
- **Events** — the `security:*` vocabulary over the W010 shapes
  (`sealSecurityEvent`; one stream per observed subject
  `stream:security-<suffix>`, host steps on
  `stream:security-host-<suffix>`).
- **Store** — `ObservabilityStore`: total admission, idempotency,
  tenant guard, sequence/causal discipline, deterministic
  snapshots/projections.

## Determinism

Zero wall-clock reads and zero randomness — every instant is
caller-supplied; every listing/snapshot is sorted (no insertion-order
leaks); observation detail keys are canonicalized before digesting.
Two stores fed the same operations hold byte-identical state (pinned
by the determinism test).

## Runtime dependency policy (frozen, W030 pin)

`@epoch/agent-protocol` (canonical JSON + SHA-256 digests +
timestamps) and `zod` — NOTHING else. `@epoch/tenancy`,
`@epoch/identity`, `@epoch/event-log`, `@epoch/authorization`,
`@epoch/extension-runtime` and `@epoch/access-projection`
compatibility is pinned via devDependencies +
`src/kernel-parity.ts` (compile time) + `test/parity.test.ts`
(runtime).

## Contract surface

W030 owns no `contracts/` tree, so the published contract surface
lives INSIDE the package (the W024 entitlements precedent): the typed
index export, the runtime zod validators, and the committed JSON
Schema projection under `schemas/` pinned byte-for-byte by
`test/contract-drift.test.ts`:

```
EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/observability test contract-drift
```

## How to run

```
pnpm --filter @epoch/observability typecheck
pnpm --filter @epoch/observability lint
pnpm --filter @epoch/observability test
```
