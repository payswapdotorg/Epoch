# The Release Process (W035)

The typed, deterministic release pipeline of Epoch. Every stage is a
pure function over typed, content-addressed data; every refusal is a
typed value. This document walks the pipeline stage by stage and maps
each behavior to the named test that proves it.

## The pipeline

```
SCOPE ──derive──▶ CHECKLIST ──complete*──▶ CHECKLIST' ──evaluate──▶ VERDICT
  │                                             │                      │
  │                                             │        (ready only)  ▼
  │                                             └──────────────▶ MANIFEST
  │                                                                    │
  └────────────────── release:readiness EVENTS ◀───────────────────────┘
                                │
                                └──fold──▶ REPLAYED readiness state
```

## Stage 1 — declare the scope

A release candidate is declared as a `ReleaseScope` record
(`release/src/scope.ts`): identity (`release:<slug>`), label, the exact
source **revision** (a caller-supplied 40-hex git SHA — data, never
read from the environment), the readiness **domains** in play (subset
of `release` / `sdk-docs` / `marketplace` — the three W035 domains),
the component **inventory** (deployable repository surfaces whose
prefixes must match their W033 component kinds), the verification
**battery** (the W033 `GateCommand` grammar: command + expected exit
code + declared timeout), the **benchmark citations** (W034 budget
records with their input unit/size and overall verdict), the **SDK
surface pins** (which documented SDK surfaces ship, and where their
docs live), and the **marketplace readiness subject** (the reference
listing + entitlement the readiness evidence is gathered against).

The scope is sealed (`sealScope`) and content-addressed; a tampered
scope is the typed `digest-mismatch` rejection
(`release/test/readiness.negative.test.ts` — "a tampered scope digest
is the typed digest-mismatch rejection").

**Evidence:**

- Scope admission, digest verification and round-trip:
  `release/test/readiness.positive.test.ts` — "the reference scope
  seals, verifies, and round-trips its digest".
- Component surface/kind consistency, revision shape, battery
  non-emptiness, closed component-kind vocabulary:
  `release/test/readiness.negative.test.ts` — the scope admission
  (negative) block.

## Stage 2 — derive the checklist

`deriveReleaseChecklist(sealedScope)` is a pure function of the sealed
scope over the fixed `DOMAIN_CHECK_TABLE`: one typed item per battery
command (scope order), per benchmark citation (scope order), plus the
notes-published item; one per SDK surface pin (scope order), plus the
sdk-examples-green item; and the four marketplace readiness checks
(listing-chain-verified, entitlement-flip-verified,
usage-fold-verified, revenue-provenance-complete) in fixed order.
Deriving from a tampered scope is refused (digest verification first).

**Evidence:**

- Fixed order, stable ids, complete coverage:
  `release/test/readiness.positive.test.ts` — "derives every expected
  item in fixed domain order with stable ids".
- Replay stability: `release/test/determinism.test.ts` — "scope →
  checklist → evaluation → manifest derives identical digests on both
  runs".
- Provenance derivation: `release/test/readiness.positive.test.ts` —
  "the checklist carries provenance derived from the scope digest".

## Stage 3 — complete items with typed evidence

An item completes ONLY with typed `CompletionEvidence`
(`release/src/evidence.ts`) matching its check kind — one evidence
shape per check kind, a closed union — plus a caller-supplied instant
and a typed actor reference (opaque id + role, the W033 actor grammar).
Completion is an IMMUTABLE transition (`completeChecklistItem` returns
a NEW sealed checklist; the prior one remains the exact-revision record
of the prior state).

The evidence must PROVE the positive:

| Refusal | When |
| --- | --- |
| `evidence-rejected` | the evidence kind does not match the item's check kind |
| `evidence-rejected` | a battery command exited a code other than the battery's expected exit code |
| `validation` | a benchmark citation carries `over-budget` (not admissible evidence — the W034 regression gate bites first) |
| `evidence-rejected` | an SDK contract pin drifted (documented version ≠ the version the surface exports) |
| `validation` | a verification flag is anything but literal `true` (false flags cannot be constructed) |
| `unknown-item` / `item-already-complete` | the item does not exist / is already complete |

**Evidence:** the checklist completion blocks of
`release/test/readiness.positive.test.ts` (immutable transition) and
`release/test/readiness.negative.test.ts` (every refusal in the table
above, one named test each).

## Stage 4 — evaluate readiness

`evaluateReleaseReadiness(sealedChecklist)` verifies the checklist
digest and folds item states into the typed verdict: `ready` iff every
item carries evidence + instant + actor; otherwise `blocked` with the
open items as typed values (`OpenItem`: itemId, domain, checkKind,
subject, description) and per-domain counts. The evaluation itself is a
sealed, content-addressed record — the exact-revision verdict the
manifest cites.

**Evidence:**

- `release/test/readiness.positive.test.ts` — "an incomplete checklist
  evaluates blocked with typed open items" and "the fully-completed
  checklist evaluates ready with an empty open list".
- `release/test/readiness.negative.test.ts` — tampered checklist /
  evaluation digests are refused.

## Stage 5 — seal the manifest

`sealReleaseManifest({ scope, checklist, notes, provenance })` — the
typed refusal point of the whole model:

- verifies the three inputs belong to the same release;
- RE-EVALUATES readiness from the checklist (never trusts a passed-in
  verdict) and refuses with `release-not-ready` + the open item ids
  when any item is incomplete;
- rolls the completed items' evidence up into the manifest domains
  (battery entries, benchmark citations, SDK contract pins,
  marketplace outcomes with evidence digests);
- derives the manifest id from the content digest
  (`manifest:<first 16 hex>` — same content, same id, every time).

**Evidence:**

- `release/test/readiness.positive.test.ts` — "a ready checklist seals
  a manifest rolling the evidence up per domain".
- `release/test/readiness.negative.test.ts` — "an INCOMPLETE checklist
  cannot seal a manifest (release-not-ready with open items)", plus the
  cross-release and tamper refusals.

## Stage 6 — publish the notes

Release notes are typed records (`release/src/notes.ts`): typed
sections with typed CITATIONS across a closed vocabulary (work orders
`W###`, pull requests `PR #n`, budgets `budget:<slug>`, tests, docs,
surfaces — each grammar-checked at admission). The notes item on the
checklist cites the sealed notes digest; the human-readable rendering
([`release-notes-e1.md`](./release-notes-e1.md)) is a PROJECTION of the
record, never a second source of truth.

**Evidence:**

- `release/test/readiness.positive.test.ts` — "notes seal, verify, and
  cite across the closed citation kinds".
- `release/test/readiness.negative.test.ts` — citation grammar and
  tamper refusals.

## Stage 7 — journal and replay

The readiness progression is journaled as `release:readiness` events
over the **W010 event shapes** (`release/src/events.ts`): one stream
per release candidate (`stream:release-<slug>`), 1-based contiguous
sequences, tenant scope, principal actor, causal parents, and typed
payload data per event kind (`checklist-derived` → `item-completed*` →
`readiness-evaluated` → `release-published`).

`foldReleaseEvents` is the deterministic REPLAY: input order is
irrelevant (records sort by stream + sequence), every payload parses
through the typed family parser, and the fold reconstructs the
readiness state — derived checklist, completed items, verdict,
published manifest — from the journal alone.

The event content is a STRUCTURAL MIRROR of `@epoch/event-log`'s
`EventContent`, type-equal member-for-member and admitted by the REAL
W010 seal path with identical digests — pinned by
`release/test/parity.test.ts` ("a release event is admitted by the REAL
W010 seal path", "the mirrored digest equals the REAL W010 digest for
the same content").

**Evidence:**

- `release/test/readiness.positive.test.ts` — "the readiness journal
  replays through the deterministic fold" and "the fold is
  input-order independent (replay over shuffled records)".
- `release/test/readiness.negative.test.ts` — non-contiguous streams,
  multi-stream folds, empty folds, tampered digests, foreign payload
  discriminators.
- `release/test/readiness.recovery.test.ts` — "the fold reconstructs
  readiness from the journal alone, in any input order".

## Recovery

Readiness is data, so recovery is completing the missing items — the
same branch, the same PR, no history rewrite. A blocked release that
completes its open items re-evaluates `ready` and seals its manifest;
a partial event journal extends to the full journal and the fold
replays the recovered state
(`release/test/readiness.recovery.test.ts` — "a blocked release
recovers by completing the open items (no rewrite)" and "the fold
reconstructs readiness from the journal alone, in any input order").

## How this composes the W033 deployment model

The release model deliberately reuses the deployment model's grammars
instead of inventing parallels (architecture lock rule 16 — one
responsibility, one authority; the deploy model remains the deployment
authority):

- the battery grammar IS `GateCommand` (parity-pinned: the release
  scope battery parses through the real W033 schema, and the reference
  scope battery IS the W033 `REFERENCE_BATTERY_COMMANDS` verbatim);
- the component-kind vocabulary IS the W033 `COMPONENT_KINDS`;
- the provenance record IS the W033 `DeployProvenance` shape (typed
  actor: opaque id + closed role vocabulary, method, instant,
  derived-from digests);
- a real deployment's release checklist derivation (W033
  `ops/releaseChecklistFor`) remains the ops tree's authority — the
  release checklist here is the READINESS model over the release's
  own domains, not a redefinition of the ops procedure.

**Evidence:** `release/test/parity.test.ts` — the W033 deploy-model
parity block (battery grammar, reference battery, component kinds,
provenance roles + shape).

## Determinism contract

Zero wall-clock, zero randomness, zero I/O. Every instant is a fixed
`T[…]` constant (caller-supplied); every id/digest derives from content
through the canonical-JSON SHA-256 machinery. Identical inputs derive
identical outputs at every stage — scope digests, checklist
derivations, completions, evaluations, manifests, events, folds — and
the five SDK examples produce byte-identical digest projections across
runs (`release/test/determinism.test.ts`).
