# W033 — `ops/` (the operations kit)

Typed RUNBOOKS, a deterministic incident SIMULATOR, and release/rollback
procedures as typed checklists — the operations layer over
`deploy/` (`@epoch/deploy-model` in the alias wiring; see
[`deploy/README.md`](../deploy/README.md) for the shared toolchain + the
frozen runtime dependency policy).

## The surface

| Module | What it is |
| --- | --- |
| `src/version.ts` | Contract version + the closed vocabularies: incident classes, detection-signal kinds, runbook actions, recovery checks, error codes |
| `src/errors.ts` | The typed ops error + total-result shape (errors are values) |
| `src/runbooks/` | The runbook record model + the reference catalog — one runbook per incident class, referencing topology components by id |
| `src/incidents/` | Fixture incident traces + the deterministic simulator: replays runbook steps against traces and emits sealed recovery proofs |
| `src/release/` | Release/rollback procedures as typed, provenance-carrying checklists derived from sealed plans/runs |

## How to run

`ops/` has **no `package.json` and no `node_modules`** (the W033 runtime
dependency policy). Its modules are consumed by the thin `deploy/` test
suite; its own typecheck + lint:

```bash
pnpm --filter @epoch/test-harness exec tsc --noEmit -p ../../ops/tsconfig.json
(cd ops && ../packages/test-harness/node_modules/.bin/eslint .)
```

The evidence suite (runbook-reaches-recovery per incident class, the
typed non-recovery negatives, checklist gating) lives in
`deploy/test/ops-runbooks.test.ts` + `deploy/test/ops-release.test.ts` —
see [`deploy/README.md`](../deploy/README.md) for the run command.

## The proof model (documented for reviewers)

An action, WHEN PRESENT in a runbook and applicable, deterministically
performs its neutral effect on the simulated environment; a recovery
check is a typed predicate over the post-mitigation state. A runbook
reaches recovery iff its detection matches the trace AND every recovery
check passes — i.e. the proofs pin RUNBOOK ADEQUACY. The negative
evidence (a runbook with a mitigation step removed, a detection signal
never observed) yields TYPED non-recovery proofs — never a false green.

## Observability note (graceful W030 skip)

`packages/observability` (W030) is not merged at this revision. Runbook
detection signals therefore use the deploy-native vocabulary (probe, gate,
capacity, digest, stall observations). When W030 lands, its event classes
extend `DETECTION_SIGNAL_KINDS` as data — the runbook records themselves
change nothing.
