# Release Documentation (W035)

Owned by Work Order **W035** (`docs/release/*`, `docs/sdk/*`,
`docs/marketplace-readiness/*`, `examples/sdk/*`, `release/*`,
`.github/workflows/*`). Service layer.

This folder is the **release model**: how an Epoch release candidate is
declared, checked, evaluated, published and journaled — as typed,
deterministic, in-repo DATA. It is written for release engineers,
reviewers and operators; every claim here is pinned by a named test in
`release/test/` (the mapping is recorded in the Work Order's PR).

## The one rule

**Release readiness is DATA, not a process run from memory.** A release
carries a typed SCOPE, a DERIVED checklist, typed EVIDENCE per item, a
typed VERDICT, a sealed MANIFEST, and an append-only EVENT JOURNAL whose
deterministic fold replays the whole progression. Zero wall-clock, zero
randomness, zero network — every instant is caller-supplied, every
record is content-addressed (canonical-JSON SHA-256 over
`@epoch/agent-protocol`, the same discipline every Epoch kernel uses).

## Document index

| Document | What it covers |
| --- | --- |
| [`release-process.md`](./release-process.md) | The typed pipeline: scope → checklist → evidence → evaluation → manifest → notes → events, and how it composes the W033 deploy model |
| [`readiness-gate-policy.md`](./readiness-gate-policy.md) | The readiness gate: what blocks a release, the evidence admission rules, the recovery contract |
| [`release-notes-e1.md`](./release-notes-e1.md) | The reference release notes of the E1.0/X1.0 program release (the projection of the typed notes record) |
| [`client-release-process.md`](./client-release-process.md) | The client release process (W050): artifact identity for the six client platforms — source commit, version/profile, checksums, honest build status (`release/clients/`) |

## The one-page orientation

1. A release candidate declares a **SCOPE** (`release:e1-program-1`):
   the exact source revision (a caller-supplied 40-hex git SHA — the
   model never reads the repository), the component inventory (the
   deployable surfaces shipping, kinds mirroring the W033 component-kind
   vocabulary), the verification battery (the W033 `GateCommand`
   grammar, mirrored), the benchmark citations (the W034 budget records
   the release notes cite), the SDK surface pins (the documented
   surfaces this release publishes), and the marketplace readiness
   subject.
2. The **CHECKLIST** is DERIVED from the scope deterministically —
   one typed item per battery command, per benchmark citation, per SDK
   surface pin, per marketplace readiness check, plus the
   notes-published and sdk-examples-green items. Same scope → same
   items → same digest, every time.
3. Items complete ONLY with typed **EVIDENCE** plus a caller-supplied
   instant and actor. A red battery command, an over-budget citation, a
   drifted SDK contract pin — each is a typed `evidence-rejected`
   refusal; the negative paths are part of the contract.
4. **EVALUATION** is pure: `ready` iff every item carries admissible
   evidence; otherwise `blocked` with the open items as typed values.
   Recovery is completing the missing items — no rewrite, no
   back-channel.
5. The **MANIFEST** seals only when ready (`release-not-ready` is the
   typed refusal that lists the open items). It rolls the evidence up
   per domain and derives its id from its content digest
   (`manifest:<first 16 hex>`).
6. The **EVENT JOURNAL** (`stream:release-<slug>`) records the
   progression as `release:readiness` events over the W010 event shapes;
   the deterministic fold REPLAYS the readiness state from the journal
   alone, input-order independent.

## Where the code lives

- `release/` — the release kit (the typed model) + the evidence suite.
  See [`release/README.md`](../../release/README.md).
- `examples/sdk/` — the five runnable SDK examples, including the
  end-to-end release-readiness example. See
  [`examples/sdk/README.md`](../../examples/sdk/README.md).
- `docs/sdk/` — the SDK documentation set (guides + the version
  matrix). See [`docs/sdk/README.md`](../sdk/README.md).
- `docs/marketplace-readiness/` — the marketplace readiness criteria
  and portal surfaces. See
  [`docs/marketplace-readiness/README.md`](../marketplace-readiness/README.md).

## Upstream surfaces this model composes (never redefines)

| Surface | Work Order | What the release model consumes |
| --- | --- | --- |
| `@epoch/deploy-model` | W033 | The gate battery grammar (`GateCommand`), the reference battery, the component-kind vocabulary, the provenance record shape — all parity-pinned |
| `@epoch/performance` | W034 | The budget-verdict vocabulary and the budget id grammar the citations use — parity-pinned |
| `@epoch/marketplace` | W023 | The listing/entitlement id grammars and the kernel's public verifiers the readiness evidence cites — parity-pinned |
| `@epoch/event-log` | W010 | The event shapes the readiness journal mirrors (type-equal + admitted by the real seal path) — parity-pinned |
| `@epoch/adapter-sdk`, `@epoch/capability-registry`, `@epoch/extension-sdk` | W007/W008 | The published contract versions the SDK docs cite — contract-sync-pinned |
