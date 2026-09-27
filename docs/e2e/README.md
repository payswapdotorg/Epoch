# W031 — Reference E2E Slices

The cross-surface **proof layer** of the Epoch program: five named,
deterministic, in-process E2E slices that compose REAL workspace
packages through their public APIs and assert identity + invariants
ACROSS surfaces.

- **Slice tests**: `tests/e2e/test/*.test.ts` (vitest, 45 tests)
- **Scenario definitions + fixtures**: `examples/e2e/scenarios/*.ts`
  (importable, documented)
- **This catalog + findings**: `docs/e2e/`

## The deterministic-E2E philosophy

Every slice is a **deterministic in-process test scenario**:

1. **REAL kernels, no mocks.** Every record is built through the kernel
   admission paths (`sealSolutionVersion`, `buildProgramOfWork`,
   `recordObservation`, `applyActualization`, `ActionPolicyRegistry`,
   `EventLog.appendEvent`, …). Nothing stubs an Epoch kernel; only
   external providers stay fixture-driven per their own adapters'
   reference behavior (the W029 github reference adapter runs entirely
   on its committed fixtures — no network, no live provider).
2. **Zero wall-clock.** Every instant is a caller-supplied constant (the
   `T[…]` series in `examples/e2e/scenarios/shared.ts`). No test reads a
   clock; no kernel does either.
3. **Zero randomness.** Every id is explicit; every digest is derived
   from content through the kernels' own canonical-JSON SHA-256.
4. **Zero network.** Everything runs in one vitest worker per file.
5. **Total results.** Kernels return `{ok:true,value} | {ok:false,error}`
   — errors are values, never exceptions; the negative paths are
   asserted as typed error codes with field-level shapes.

Consequence: **every slice runs twice in-process and produces
byte-identical derived digests** (asserted by the shared determinism
gate in `tests/e2e/test/helpers.ts`).

## The slice catalog

| Slice | Test file | Surfaces traversed | Invariants asserted |
| --- | --- | --- | --- |
| [`construction-delivery-slice`](./construction-delivery-slice.md) | `tests/e2e/test/construction-delivery-slice.test.ts` (10 tests) | W026 pack-construction, W036 solution-delivery, W037 procurement, W038 execution-tracking, W039 actualization+variance, W006 evidence, W010 event-log | BOQ line id ≡ plan-line id end-to-end; the actualization digest chain verifies; the variance attribution references real evidence (exact digests); supervision folds agree; cross-tenant intake denied; baseline immutable |
| [`software-delivery-slice`](./software-delivery-slice.md) | `tests/e2e/test/software-delivery-slice.test.ts` (7 tests) | W027 pack-software, W036, W038, W039 | Roadmap milestone ids ARE canonical ProgramOfWork ids; backlog identity canonical (epic ≡ workPackageId, issue ≡ activityId, observation/actual links by id); execution events chain + verify; forecast revisions append-only (prior digest intact); cross-tenant intake denied |
| [`adapter-intake-slice`](./adapter-intake-slice.md) | `tests/e2e/test/adapter-intake-slice.test.ts` (11 tests) | W029 adapter-github, W028 document-adapter, W036 external seam, W009 authorization, W006 evidence | One content one address (snapshot digest identical at ingestion and projection); the W028 document leg (digest computed at birth, evidence chain, adapter's own neutral vocabulary); provider vocabulary never leaks past the seam; cross-tenant observation denied AND the denial auditable (sealed W009 decision) |
| [`action-gateway-slice`](./action-gateway-slice.md) | `tests/e2e/test/action-gateway-slice.test.ts` (11 tests) | W003 action-protocol, W020 agent-orchestration, W022 action-policy, W029 adapter-github (action surface), W036 (integration subject), W038, W010 | The proposal digest is THE SAME at every surface (W029 plan → W020 work item + handoff → W022 decisions → W010 lifecycle events); the outcome references the exact proposal digest; the full decision vocabulary (requires-approval → approved → executed; allow; deny × no-applicable-policy / proposal-expired / constraint-blocked); `gateway-bypass-rejected` with the authority never called; the decision chain verifies |
| [`recovery-slice`](./recovery-slice.md) | `tests/e2e/test/recovery-slice.test.ts` (6 tests) | W010 event-log (over slice 1's stream), W036/W039 live state | Replay determinism (twice in-process + from a restored log snapshot → byte-identical state digests); live cross-check (replayed state ≡ kernel state); mid-stream tamper detected (typed `digest-mismatch`, log refuses the append); the fold continues from the verified prefix |

### Cross-cutting assertions

The shared invariant library (`tests/e2e/test/helpers.ts`) is composed
by every slice:

- **Tenant isolation (R12)** — typed cross-tenant denials with
  `expectedTenantId`/`encounteredTenantId` at every boundary crossing
  (W036 intake + correlation, W028 descriptor admission, W029 host
  ingestion, W009 authorization).
- **Provenance chains (W006)** — claimed digests recompute over content;
  hash chains link up (sequence + causal parents).
- **Replay determinism** — each scenario runs twice in-process; the
  digest projections canonically digest identically.
- **Round-trip** — every scenario projection serializes to JSON and
  digest-verifies through the round trip.
- **Authority routing** — kernels' own negative-path exports are
  exercised (e.g. W036 `reviseSolutionBaseline` →
  `baseline-mutation-rejected`); no slice ever writes a kernel's
  authoritative state directly.

## How to run

`tests/e2e` is an owned W031 surface **outside the pnpm-workspace
globs** (the root manifests are frozen for this Work Order), so it is
not a pnpm importer and carries no `node_modules`. The suite borrows
the toolchain of an existing workspace package and resolves imports via
explicit aliases (`tests/e2e/vitest.config.mts` + `tsconfig.json`
paths — the same set `tests/e2e/package.json` declares as
devDependencies).

From the repository root (after `pnpm install`):

```bash
# the five slices (45 tests)
pnpm --filter @epoch/pack-construction exec vitest run --root ../../tests/e2e

# typecheck (tests + examples)
pnpm --filter @epoch/pack-construction exec tsc --noEmit -p ../../tests/e2e/tsconfig.json

# lint
(cd tests/e2e && ../../packs/construction/node_modules/.bin/eslint .)
(cd examples/e2e && ../../packs/construction/node_modules/.bin/eslint .)
```

The repo's own gates (`pnpm check`, `pnpm exec turbo run typecheck lint
test build`) cover the workspace packages and are unaffected by these
surfaces (that is by design: the slices add proof without touching any
gate input).

## Runtime dependency policy

The e2e tests import workspace packages as **devDependencies only**
(declared in `tests/e2e/package.json`; tests never ship runtime deps):
`@epoch/solution-delivery`, `@epoch/procurement`,
`@epoch/execution-tracking`, `@epoch/actualization`, `@epoch/variance`,
`@epoch/pack-construction`, `@epoch/pack-software`,
`@epoch/adapter-github`, `@epoch/document-adapter`,
`@epoch/agent-orchestration`, `@epoch/action-protocol`,
`@epoch/action-policy`, `@epoch/tenancy`, `@epoch/authorization`,
`@epoch/evidence`, `@epoch/event-log`, `@epoch/tsconfig`,
`@epoch/eslint-config`, `vitest`, `typescript`. No third-party
dependencies were added.

**One documented deviation**: `@epoch/policy-contracts` (the W004
compile authority) is declared as ONE additional devDependency. The W022
decision vocabulary is unreachable without at least one SATISFIED
compiled ECL constraint — the W004 composite is fail-closed (an empty
composition is `not-applicable` → deny `no-applicable-policy`), and
compilation is `@epoch/policy-contracts`' authority (an existing
workspace package, already a runtime dependency of `@epoch/action-policy`
itself). Without it, the action-gateway slice's mandated positive path
(decision → outcome record → execution event) collapses to deny-only
evidence. The addition is devDependency-only, workspace-internal,
touches no lockfile (the directory is not a pnpm importer) and adds no
third-party dependency. See
[`action-gateway-slice.md`](./action-gateway-slice.md).

## Known gaps (what a future harness WO would extend)

- **The `allow` outcome through the ADAPTER route**: the W029 github
  reference adapter pins `requiresHumanApproval: true` on every proposal
  it builds (the reference pin), so the `allow` vocabulary is exercised
  at the authority seam (the port over the real W022 registry) rather
  than through an adapter dispatch. A future action adapter without the
  human-approval pin would close this.
- **The workspace-package host services** (`@epoch/action-gateway`,
  `@epoch/agent-runtime`, `@epoch/document-adapter-host`) are outside
  W031's frozen dependency set; the slices compose their KERNELS
  (`@epoch/action-policy`, `@epoch/agent-orchestration`,
  `@epoch/document-adapter`) through the published seams instead. A
  harness WO with the host services in scope could add host-level
  idempotency/snapshot parity evidence.
- **`@epoch/replay`** (the W010 replay kernel) is likewise outside the
  frozen set; the recovery slice implements its verified fold over
  `@epoch/event-log` primitives (seal/verify/append/read) — a harness
  WO could pin the same scenarios against `foldStreams`/
  `resumeFold`/checkpoints for cross-kernel parity.
- **Cross-slice composition**: each slice is self-contained by design;
  a harness WO could compose them (e.g. the adapter-intake observation
  flowing into the construction delivery's actualization).
- **Performance/scale evidence** is W034's surface, not ours.
