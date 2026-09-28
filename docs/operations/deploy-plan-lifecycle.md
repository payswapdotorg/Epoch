# Deploy-plan lifecycle (W033)

A plan is IMMUTABLE INTENT; the run is EFFECTS. The lifecycle:

```
topology revision ──┐
component set ──────┤
environment ────────┼──> planDeployment ──> sealed plan (digest + derived planId)
gate policy ────────┤                         │
caller instants ────┘                         v
                              executeDeployPlan(fixture state, gate reports,
                                                 health probes, instants)
                                               │
                     ┌─────────────────────────┴────────────────────────┐
                     v                                                v
              all steps succeed                            a health check fails
                     v                                                v
              run: deployed                              typed failed outcome
              receipt sealed                             atomic rollback
                                                              v
                                                    run: rolled-back
                                                    rollback receipt sealed
```

## 1. Planning (deterministic)

`planDeployment` is a pure function. It resolves the DEPENDENCY CLOSURE of
the requested set (a component never deploys without its dependencies),
orders it topologically (dependencies first; lexicographic tiebreak — a
total, stable order), and emits per component the fixed micro-sequence:

```
build → verify(gate) → rollback-point → promote → health-check
```

Every step is content-addressed; the plan digest covers the sealed steps.
Identical inputs produce the IDENTICAL plan digest (byte-compare), and
the request's component ORDER never reaches the digest. The plan id is
derived from the digest (`plan:<16hex>`) — a replay-stable identity.

The plan's `deploymentRevision` is derived from the topology revision
digest (`rev:<16hex>`): one topology revision = one deployment unit; every
promote of the plan installs exactly that revision.

## 2. Admission (the refusal points, before any step runs)

The executor refuses — with typed errors and NO steps executed — when:

- the plan, gate policy or state is tampered (`digest-mismatch`);
- the state derives from a different topology (`topology-skew`);
- the gate policy is not the plan's gate (`plan-gate-skew`);
- a required battery command has no green report (`gate-skip-rejected`);
- a report has the wrong exit code (`gate-failed-rejected`);
- the state contradicts the plan's declared rollback points
  (`fixture-state-skew`);
- a health-check step lacks its fixture probe (`validation`).

## 3. Execution

Steps run in ordinal order. Each emits a sealed, provenance-carrying
STEP OUTCOME:

| Step kind | Outcome payload |
| --- | --- |
| `build` | the content-derived `artifactDigest` |
| `verify` | the gate id + battery command count (all green) |
| `rollback-point` | the prior revision (or null for a fresh deploy) + the state digest BEFORE the promote |
| `promote` | from/to revisions + the state digest AFTER |
| `health-check` | the observed probe result (`degraded` passes, noted; `failed` fails) + the typed `health-check-failed` error |

## 4. Rollback (atomic)

A failed health check STOPS forward execution and rolls back EVERY
promote of the run, in REVERSE promote order, to the revision recorded at
each component's rollback point (a null prior = un-place). The rollback
receipt is sealed with the restored placements, and the run ends
`rolled-back` with the post-rollback state digest EQUAL to the
pre-deploy state digest — the byte-exact
`rollback-restores-prior-revision` invariant.

## 5. Receipts + replay

Every run yields a compact, sealed RECEIPT (the operator-facing
projection: statuses, per-step outcome digests, rollback digest, state
digests). Re-running the same inputs produces byte-identical runs and
receipts — deployment evidence is replayable, and the release/rollback
checklists ([runbook index](./runbook-index.md)) are DERIVED from the
sealed artifacts, never hand-written.
