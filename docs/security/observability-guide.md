# Observability Guide (W030)

The **observation model** of the Epoch security surface: what is
recorded, where it flows, how health derives, and how the W033 ops kit
consumes it. Everything is deterministic, provider-neutral, and
append-only.

## The record types

| Record | Owner module | Address |
|---|---|---|
| `SealedObservation` | `@epoch/observability` (observation.ts) | content-addressed (`contentDigest` = SHA-256 over canonical JSON; detail keys canonicalized) |
| `SealedSecurityPolicy` | policy.ts | content-addressed, tenant-scoped, revisioned |
| `SealedQuarantineFact` | quarantine.ts | content-addressed, append-only impose/release |
| `SealedSecurityEvent` | events.ts | W010-shaped, one stream per subject, sequence-contiguous |

## The observation vocabulary (closed sets)

- **Subject kinds** (`OBSERVATION_SUBJECT_KINDS`): `extension`,
  `agent-session`, `simulation-run`, `action`, `principal`,
  `workspace`, `tenant`, `security-policy`. Subject ids are opaque
  kind-prefixed slugs (`session:…`, `simrun:…`, `action:…` — the
  sibling surfaces' grammars, agreement-checked at admission).
- **Classes** (`OBSERVATION_CLASSES`): `sandbox-admission`,
  `sandbox-invocation`, `sandbox-violation`,
  `authorization-decision`, `tenant-boundary-check`,
  `agent-session`, `simulation-run`, `action-dispatch`,
  `security-audit`.
- **Outcomes**: `observed` (a neutral lifecycle fact), `allowed`,
  `denied`, `violated`.
- **Severities**: `info` (lifecycle), `notice` (enforcement success),
  `warning` (enforcement denial), `critical` (violations + audit
  findings).

Cross-kernel vocabulary (W008 violation codes, W009 denial codes,
W020/W021/W022 status tokens) rides as **bounded neutral strings**
inside `detail` — never re-declared typed vocabularies.

## Provenance (the W006 convention)

Every observation carries `provenance.sourceDigest` — the exact-revision
digest of the SOURCE record it was derived from (a W008 surface, a W009
decision, a W020 session snapshot, a W021 run, a W022 action, a W041
projection). The referenced record need not be locally present: the
observation owns the FACT, the digest owns the address.

## The `security:*` event vocabulary (W010 shapes)

| Discriminator | Emitted when |
|---|---|
| `security:policy-registered` | a policy revision is admitted (host stream) |
| `security:observation-recorded` | every admitted observation (the subject's stream) |
| `security:violation-detected` | a sandbox violation observation (the subject's stream) |
| `security:quarantine-imposed` / `security:quarantine-released` | the quarantine lifecycle (the subject's stream) |
| `security:health-projected` | a health projection pass (host stream) |
| `security:audit-recorded` | an audit pass (host stream) |

Stream layout: one stream per observed subject
(`stream:security-<subject-suffix>`), host-level steps on
`stream:security-host-<tenant-suffix>`. Sequences are strictly
contiguous from 1; same-stream causal parents chain
(`causalParent: {streamId, sequence}`); the kernel store enforces the
W010 sequence/causal discipline at admission. Digests are identical
through the REAL W010 `sealEvent` (pinned by parity tests).

## The metrics fold

`foldObservations(observations)` is a PURE commutative fold producing
the canonical counter record — every closed vocabulary key is always
present (zero when absent), order never matters:

- `observationsTotal`, `violationsTotal`, `criticalViolations`,
  `deniedTotal`;
- `sandboxAdmissionsConforming` (allowed admissions) /
  `sandboxAdmissionsViolating` (violation observations + denied or
  violating admissions);
- `byClass`, `byOutcome`, `bySeverity` (the full closed sets).

## The health projection

`projectSecurityHealth(metrics, thresholds, quarantinedSubjects)` —
the derived, deterministic state:

1. `critical` — any quarantined subject OR `criticalViolations ≥
   criticalAtCriticalViolations`;
2. `degraded` — `criticalViolations ≥ degradedAtCriticalViolations`;
3. `healthy` — otherwise.

The thresholds come from the tenant's ACTIVE policy (policy as data);
a thresholdless health claim is a typed validation failure (the store
never invents defaults). **Health recovers; metrics never forget**:
releasing a quarantine restores `healthy`/`degraded` state, but the
violation facts stay counted (the audit trail is append-only).

## Reading the trail

- `readAuditTrail({tenantId, subjectId?})` — the sorted observation
  trail (tenant-scoped, W009-gated, R12-enforced).
- `readStream({tenantId, streamId})` — one `security:*` event stream
  (cross-tenant reads are typed denials).
- `projectHealth({...})` — metrics + health + audit findings +
  quarantine + the full trail.
- The host `health()` — liveness as typed data (tenant count,
  observation count, quarantined subjects, admitted listings; status
  `degraded` while any subject is quarantined).

## Integration with the W033 ops kit (documented mapping)

The W030 surface consumes `deploy/` + `ops/` (W033) read-only; no ops
file is modified. The W033 detection-signal vocabulary was published
EXPECTING this surface ("the W030 observability event classes join
here as data when that surface lands" — `ops/src/version.ts`), so the
integration is a documented DATA mapping from the W030 health
projection + audit findings onto the W033 `DetectionSignalKind` /
`IncidentClass` vocabularies:

| W030 fact | W033 mapping |
|---|---|
| health `degraded` (critical violations at the degraded threshold) | `DetectionSignalKind` `health-probe-degraded` (incident class `health-degradation`) |
| health `critical` (threshold breach) | `DetectionSignalKind` `health-probe-failed` (incident class `health-degradation`) |
| any quarantined subject | incident class `gate-violation` — the W030 quarantine IS the containment the runbook model expects (`RUNBOOK_ACTIONS` carries `quarantine-component`; release maps to the recovery checks) |
| audit finding `cross-tenant-breach` | incident class `gate-violation` (an authorization-gate breach signal) |
| audit finding `projection-*` | incident class `integrity-mismatch` (a data-exposure / identity-fork signal) |
| typed `digest-mismatch` rejections (tamper detection) | `DetectionSignalKind` `digest-mismatch-observed` (incident class `integrity-mismatch`) |

Concretely: a W033 operator derives the signal from the W030 health
projection (`projectHealth`) and the audit findings, then runs the
matching runbook from the catalog. External security monitoring
systems (SIEMs, alerting vendors) remain future ADAPTERS behind the
capability fabric (lock rule 13) — the kernel and host carry zero
vendor vocabulary (pinned by the neutrality tests).

## Determinism checklist (enforced by tests)

- Zero wall-clock reads and zero randomness in `src` (static scans in
  the kernel + service + evidence determinism suites).
- Every instant is caller-supplied payload data.
- Every read path sorts (no insertion-order leaks); observation detail
  keys are canonicalized before digesting.
- Two stores/hosts fed the same operations hold byte-identical state
  (snapshots, projections, streams).
