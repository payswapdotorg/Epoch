# @epoch/agent-runtime

Epoch **Agent Runtime** service — the long-running HOST MODEL over
`@epoch/agent-orchestration` (Work Order W020, layer: service — the first
Epoch runtime service).

> architecture.md (binding): "Agents propose; the Action Gateway authorizes
> execution."

## What this service owns

- **Session lifecycle management** — tenant-scoped orchestration sessions
  (`createSession` / `startSession` / `suspendSession` / `resumeSession` /
  `cancelSession`) with typed `lifecycle-conflict` rejections on illegal
  transitions; idempotent session creation (`duplicate-suppressed` for the
  same plan, `lifecycle-conflict` for a different plan under the same id).
- **Agent-binding management** — tenant-scoped capability bindings through
  the kernel binder over the REAL `@epoch/capability-registry` (W007).
- **Plan compilation** — `compilePlan` delegates to the kernel compiler,
  resolving steps against the tenant's bound agents and the admitted W003
  proposal set.
- **Event intake (W010 parity)** — `ingestEvent` admits event records
  through the REAL `@epoch/event-log` record pipeline (shape, content
  digest, kernel payload contract), then applies the advance-on-event
  driver.
- **The plan execution driver** — `dispatchReadySteps` emits typed
  `ProposalHandoff` records toward the Action Gateway boundary (W022,
  future); `applyLifecycleEvent` folds `action:lifecycle` facts into step
  states (authorized/executed/failed/rejected, retry re-queue under the
  typed policy, cascade skips, settlement); sessions settle
  `completed`/`failed` deterministically.
- **Idempotent replay** — every admitted intake consumes a content-addressed
  idempotency key; re-ingesting an event is the typed
  `duplicate-suppressed` negative with the state unchanged. Two runtimes
  fed the same session + event history hold byte-identical snapshots.
- **Health/liveness as typed data** — `health()`: deterministic derivation,
  `degraded` exactly when a session has settled `failed`.
- **Whole-host snapshots** — `snapshot()` / `AgentRuntime.fromSnapshot()`
  (deterministic, tamper-checked restoration).

## What it deliberately is NOT

- **NOT** the Action Gateway: authorization is `@epoch/authorization`'s and
  the future W022 gateway's; this host tracks handoffs and lifecycle FACTS,
  it never authorizes or executes.
- **NOT** durable: in-memory reference behavior — NO persistence, NO
  network, NO real processes (future Work Orders adapterize those).
- **NOT** provider-coupled: zero model vendors, model clients, or API keys
  (lock rule 13); model providers are future adapters (W028/W029).
- **NOT** a contract authority: the typed orchestration contract and error
  taxonomy are `@epoch/agent-orchestration`'s — reused verbatim here.

## Determinism

ZERO wall-clock reads and ZERO randomness in src — every instant is
caller-supplied; every listing/snapshot is sorted; dispatch follows the
compiled plan order; cascade skips follow compiled order. Two runtimes fed
the same history hold identical session state digests.

## Dependencies (W020 runtime policy)

Runtime: `@epoch/agent-orchestration` (the kernel),
`@epoch/agent-protocol` (timestamps/ids), `@epoch/capability-registry`
(the real registry the binder resolves against), `@epoch/event-log` (the
W010 event record contract the driver consumes), `zod`. devDependencies
exercise cross-package parity (real W003 proposals, real W002 world-model
entities, W009 tenancy/identity/authorization vocabulary, W004 policy
scope matching) — never runtime deps.

## Tests

Positives: full happy path (bind -> compile -> create -> start -> advance
-> complete), suspend/resume, cancel, snapshot round-trips, retry
re-queue + re-dispatch, cascade skips, recorded echoes, settlement,
health derivation, replay idempotency (byte-identical snapshots + session
state digests), event-order independence for independent steps. Named
negatives: cross-tenant event intake and session access
(`cross-tenant-denied`); duplicate event suppressed (state unchanged);
duplicate session creation (idempotent vs conflicting); uncorrelated and
stale-revision events (`unknown-action-reference`); non-action payloads
and malformed events (`validation` with precise paths); contradictory
facts on settled steps and pre-dispatch facts (`lifecycle-conflict`);
vendor/provider fields rejected at every typed boundary
(provider-neutrality blocklist); tampered snapshots rejected; zero
wall-clock/random source scan (determinism).
