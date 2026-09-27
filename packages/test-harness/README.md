# @epoch/test-harness — the Cross-domain Integration Harness (W032)

A typed, deterministic **scenario engine** — the generalization of the W031
reference-slice pattern (`tests/e2e`): a harness composes REAL packages
(fixture-driven external providers only), drives them through public APIs,
and asserts cross-surface invariants.

## What it is

| Surface | What it does |
|---|---|
| **Scenario DSL** (`src/scenario.ts`) | Declarative, content-addressed scenario definitions: actors (principals/tenants, W009 grammar), fixtures (named deterministic JSON payloads), a SEQUENCE of typed steps (call steps: a kernel operation with inputs + routing class + declared expectation; assert steps: an invariant check over the execution prefix), an identity map, and the expected invariants. Digest-stable serialization + round-trip. |
| **Driver seam** (`src/driver.ts`) | The typed `ScenarioDriver` contract — the ONLY way the engine touches composed kernels. The TEST TREE implements the driver over real kernels composed as its devDependencies; the harness never mocks Epoch kernels and never imports kernel internals. |
| **Runner** (`src/runner.ts`) | Executes a scenario, recording the typed execution TRACE (per step: input digest, output digest, events emitted, provenance, identity observations, state-digest delta); seals the trace (content-addressed); double-runs for replay determinism; emits the typed RESULT record. |
| **Invariant library** (`src/invariants.ts`) | Reusable typed checks: tenant isolation (R12 typed denials at every boundary), provenance chains (recompute + link), authority routing (direct writes rejected with typed codes AND no state delta), identity preservation across projections (byId + strict bySurface identity-map), trace integrity, expectation conformance, scenario round-trip, replay determinism. |
| **Reporting** (`src/reporting.ts`) | Machine-readable, content-addressed run records + compact summary lines. |

## Runtime dependency policy (W032 Tech Lead pin, frozen)

`@epoch/agent-protocol` (canonical digests), `@epoch/tenancy` (tenant-id
primitives), `zod` — **NOTHING else**. The composed kernels
(solution-delivery, procurement, execution-tracking, actualization,
variance, pack-construction, pack-software, ...) are devDependencies of
the TEST trees (`tests/contracts`, `tests/integration`), never of this
library. This package's own tests run against a synthetic fixture ledger
driver (`test/fixture-driver.ts`) — not a mock of any Epoch kernel — so
the library carries zero kernel dependencies transitively.

## Determinism discipline

Zero wall-clock, zero randomness, zero network. Every digest is derived
from content through the shared canonical-JSON SHA-256 machinery
(`@epoch/agent-protocol`), so harness digests are directly comparable
with kernel digests. Two runs of the same scenario against the same
driver produce **byte-identical traces** — asserted by the runner's
built-in double-run and by the named `trace-replay-deterministic` tests
in `tests/integration`.

## Usage sketch

```ts
import { runScenario } from '@epoch/test-harness';

const run = runScenario(crossDomainScenario, realKernelDriver);
if (run.ok && run.value.result.passed) {
  console.log(run.value.result.traceDigest); // content-addressed evidence
}
```

See `tests/integration` for the reference cross-domain scenario packs and
`tests/contracts` for the contract conformance suite.
