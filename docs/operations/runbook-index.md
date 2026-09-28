# Runbook index (W033)

Runbooks are TYPED, VERSIONED DATA keyed by incident class. Each records
the detection signals that identify the class, the containment steps
(immediate, reversible risk reduction), the mitigation steps (the
corrective work), and the recovery verification (typed predicates that
PROVE recovery). Steps carry neutral operator verbs from the closed
`RUNBOOK_ACTIONS` vocabulary and reference topology components BY ID.

## The incident classes + reference runbooks

| Incident class | Runbook | Containment | Mitigation (summary) | Recovery proof |
| --- | --- | --- | --- | --- |
| `health-degradation` | `rb:health-degradation` | quarantine the degraded component (`cmp:action-gateway`), freeze deploys, notify the operator | pin prior revision → restore placement → re-run health probe → clear quarantine | component healthy; placement revision restored; operator notified |
| `gate-violation` | `rb:gate-violation` | freeze deploys, notify the operator | re-run the verification battery | all gates green; operator notified |
| `capacity-exhaustion` | `rb:capacity-exhaustion` | quarantine the saturated edge (`cmp:web-app`), freeze deploys, notify | scale out within the declared envelope → re-run health probe → clear quarantine | capacity within envelope; component healthy; operator notified |
| `integrity-mismatch` | `rb:integrity-mismatch` | freeze deploys, quarantine the unverifiable component (`cmp:event-log`), notify | verify record digests → pin prior revision → restore placement → re-run health probe → clear quarantine | record digests verified; placement restored; component healthy; operator notified |
| `rollout-stall` | `rb:rollout-stall` | freeze deploys, notify | verify record digests (`cmp:agent-protocol`) → resume deploy steps from the verified prefix → re-run health probe | deploy steps resumed; digests verified; component healthy; operator notified |

The catalog is deterministic data: `runbookCatalog(provenance)` seals the
five runbooks with stable digests (same provenance → same digests).

## Detection signals (the observability seam)

The signal vocabulary is deploy-native at this revision — probe, gate,
capacity, digest and stall observations (`DETECTION_SIGNAL_KINDS`).
**W030 graceful skip:** `packages/observability` (W030) is not merged at
this revision; when it lands, its event classes extend the signal
vocabulary AS DATA — the runbook record shape changes nothing.

## The incident simulator (proof model)

`simulateIncidentRunbook({ runbook, trace, topology, provenance })`
replays a runbook against a typed fixture INCIDENT TRACE (the
observation log of one incident: signals, typed events, prior-good
revisions, post-mitigation probe observations) and emits a sealed
RECOVERY PROOF:

- an action, WHEN PRESENT and applicable, deterministically performs its
  neutral effect on the simulated environment state;
- a recovery check is a typed predicate over the post-mitigation state;
- therefore a runbook reaches recovery iff its steps COVER the
  incident's needs — the proofs pin RUNBOOK ADEQUACY.

The named evidence: `runbook-reaches-recovery:<class>` for each of the
five classes. The negatives prove non-vacuity: a runbook with a needed
mitigation step removed, or a detection signal the trace never observed,
yields a TYPED non-recovery proof (`recoveryReached: false` with the
failing checks named) — never a false green. The simulator also refuses
structurally: cross-class pairings, unknown component references,
topology skew, and tampered digests are typed errors.

## Release + rollback procedures (typed checklists)

- `releaseChecklistFor(plan, battery, provenance)` — derived from a
  sealed plan: one item per battery command + one item per plan step.
- `rollbackChecklistFor(run, provenance)` — derived from a rolled-back
  run: the trigger, one item per restored placement, and the state-digest
  verification.

Completion is typed: items complete only with a caller-supplied instant +
actor; a checklist admits only when EVERY item is complete and its digest
verifies. Double-completing an item is a `duplicate-record` refusal.
Every checklist carries provenance and round-trips with digest
verification.
