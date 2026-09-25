# @epoch/agent-orchestration

Epoch **Agent Orchestration** kernel — the typed orchestration MODEL (Work
Order W020, layer: kernel).

> architecture.md (binding): "Agents propose; the Action Gateway authorizes
> execution."

The orchestration layer SCHEDULES, it never authorizes: this kernel owns
plans/runbooks as typed data (steps as typed action-PROPOSAL references —
never embedded action semantics), capability-scoped agent bindings,
deterministic content-addressed plan compilation, retry/reconciliation
policy shapes as typed data, idempotency keys, orchestration sessions as
typed documents, and the typed orchestration error taxonomy.

## What this package owns

- `OrchestrationPlan` / `PlanStep` — tenant-scoped authored plans whose
  steps reference exact-revision action proposals
  (`@epoch/action-protocol` `ProposalReference`), the assigned agent, and
  dependencies; steps never embed action semantics.
- `compilePlan` — deterministic compilation: strict admission (version →
  schema → semantics → proposal resolution → normalization), topological
  ordering with sorted ready admission (ties broken by step id), canonical
  `dependsOn`, defaulted retry policies, and the content-addressed
  `planDigest` (SHA-256 over canonical JSON). Identical semantic content
  produces identical compiled plans.
- `bindOrchestratedAgent` — capability-scoped agent bindings resolved
  through the REAL `@epoch/capability-registry`: unknown ids are
  `unknown-capability`; retired records are `lifecycle-conflict`
  (deprecation is advisory and binds, mirroring registry semantics).
- `OrchestratedAgent` / `AgentBinding` / `CapabilityPin` — the
  provider-neutral agent descriptors (strict objects: vendor/model fields
  are structurally rejected).
- `RetryPolicy` / `RetryableActionPhase` — retry/reconciliation policy
  shapes as typed data (the runtime service interprets them).
- `deriveEventIdempotencyKey` / `deriveSessionIdempotencyKey` —
  deterministic, content-addressed idempotency keys.
- `createSessionRecord` / `transitionSessionStatus` /
  `evaluateSessionOutcome` — the PURE session record machinery
  (`OrchestrationSession`, `StepState`, typed transition logs).
- `ProposalHandoff` — the typed boundary artifact toward the Action
  Gateway (W022, future): tracked as data, never executed or transported
  here.
- Digest discipline: `computePlanDigest` / `verifyCompiledPlanDigest`
  (tamper detection), `computeAgentBindingDigest`,
  `computeProposalHandoffDigest`, `computeSessionStateDigest`.

## What it deliberately is NOT

- **NOT** an authority: authorization decisions belong to
  `@epoch/authorization` and the future Action Gateway (W022); world
  semantics are `@epoch/world-model`'s; events are `@epoch/event-log`'s.
- **NOT** a host: session lifecycle management, event intake, and the
  advance-on-event driver are the runtime SERVICE's
  (`services/agent-runtime`, W020) — this kernel is pure typed data +
  pure functions.
- **NOT** provider-coupled: zero model vendors, model clients, or API
  keys; concrete model providers are future adapters (W028/W029).
- **NOT** persistent: no storage, no network, no processes — the reference
  machinery is in-memory and serialization-friendly.

## Contract surface

Versioned contract published inside the package (`schemas/` + the typed
index export + runtime zod validators + compile-time parity in
`src/parity.ts` and `src/kernel-parity.ts`). Regenerate after an
intentional schema change:

```
EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/agent-orchestration test contract-drift
```

## Dependencies (W020 runtime policy)

Runtime dependencies (the only @epoch ones): `@epoch/agent-protocol`
(ids, digests, canonical JSON, timestamps), `@epoch/action-protocol`
(proposal vocabulary — genuine runtime consumption),
`@epoch/capability-registry` (capability binding vocabulary),
`@epoch/event-log` (the W010 action-phase vocabulary). Compatibility with
`@epoch/world-model`, `@epoch/tenancy`, `@epoch/identity`,
`@epoch/authorization` and `@epoch/policy-contracts` is pinned via
devDependencies + compile-time parity (`src/kernel-parity.ts`) and runtime
parity tests — never runtime deps.

## Tests

Positives: plan round-trips, deterministic compilation (authoring-order
independence, tie-broken topological order), capability binding (incl.
deprecated-still-binds), session records and legal transitions,
idempotency-key derivation, contract drift/surface, parity with W002/W003/
W004/W007/W009/W010 vocabularies. Named negatives: malformed plans with
precise dotted paths; version skew; duplicate step ids; self/unknown/cyclic
dependencies; unassigned agents; duplicate proposal references;
`unknown-action-reference`; tampered proposal revision pins
(`digest-mismatch`); `unknown-capability`; retired capability
(`lifecycle-conflict`); illegal session transitions; vendor/provider
fields rejected (provider-neutrality blocklist); zero wall-clock/random
source scan (determinism).
