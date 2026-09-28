# Readiness Gate Policy (W035)

**A release manifest may not seal unless the readiness evaluation is
`ready`.** The gate is typed data end to end: the checklist derives
deterministically from the scope, items complete only with admissible
typed evidence, the evaluation is a pure fold over item states, and
sealing re-evaluates from the checklist — never trusting a passed-in
verdict. There is no "seal anyway" path.

## The refusal points

| Condition | Typed refusal | Named test |
| --- | --- | --- |
| Scope content malformed (component kind/surface mismatch, bad revision, empty battery, foreign kind) | `validation` | `readiness.negative.test.ts` — scope admission (negative) |
| Scope digest does not match content | `digest-mismatch` | `readiness.negative.test.ts` — "a tampered scope digest…" |
| Derivation from a tampered scope | `digest-mismatch` | `readiness.negative.test.ts` — "deriving from a tampered scope…" |
| Completing an unknown item | `unknown-item` | `readiness.negative.test.ts` |
| Completing an already-complete item | `item-already-complete` | `readiness.negative.test.ts` |
| Evidence kind ≠ check kind | `evidence-rejected` | `readiness.negative.test.ts` |
| Battery command exited ≠ expected | `evidence-rejected` | `readiness.negative.test.ts` |
| Benchmark citation `over-budget` | `validation` (not admissible evidence) | `readiness.negative.test.ts` |
| SDK contract pin drifted | `evidence-rejected` | `readiness.negative.test.ts` |
| False verification flag | `validation` (the schema forces literal `true`) | `readiness.negative.test.ts` |
| Tampered checklist / evaluation / notes / manifest / event digests | `digest-mismatch` | `readiness.negative.test.ts` |
| Sealing a manifest with an incomplete checklist | `release-not-ready` (+ open item ids) | `readiness.negative.test.ts` |
| Cross-release scope/checklist/notes mix at sealing | `validation` | `readiness.negative.test.ts` |
| Non-contiguous / multi-stream / empty event fold | `validation` | `readiness.negative.test.ts` |
| Foreign payload discriminator / unknown family kind at fold | `validation` (fail-closed replay) | `readiness.negative.test.ts` |

## The verdict model

- **`ready`** — every checklist item carries evidence + completion
  instant + actor. The manifest seals; the publication event journals.
- **`blocked`** — at least one open item; the open items are typed
  values with precise subjects. Nothing is partially sealed: a manifest
  either exists (content-addressed) or the sealing refused.

There is deliberately **no near-ready verdict**: readiness is binary at
the manifest gate. Per-item nuance lives in the evidence — a
`near-budget` benchmark citation is admissible (the W034 regression
gate only bites on `over-budget`), and it stays visible in the manifest
roll-up for reviewers; a `within-budget` citation is the healthy state.

## The evidence admission rules

Evidence is a closed union — one shape per check kind — and must prove
the positive:

1. **Kind match.** The evidence kind must equal the item's check kind
   (the bijection is `EVIDENCE_KIND_TO_CHECK`).
2. **Battery greenness is derived, not asserted.** Battery evidence
   carries both the expected and the observed exit code; the check
   itself compares them (`readiness.negative.test.ts` — "a RED battery
   command…").
3. **Benchmark citations cite digests.** Every citation carries the
   content digests of the budget record and the sealed verdict record
   it cites (exact-revision addressing); `over-budget` is
   inadmissible.
4. **SDK pins must match reality.** Contract-sync evidence carries both
   the documented and the actual contract version; a drift is the
   typed refusal. The machine check behind the pin is
   `release/test/contract-sync.test.ts` — the docs' declared versions
   are compared against the REAL constants the packages export.
5. **Verification flags are literal `true`.** `chainVerified`,
   `grantedThenDenied`, `foldsAgree`, `complete` are `z.literal(true)`
   — a false variant cannot even be constructed.

## The recovery contract

Readiness is data, so recovery is data completion:

1. **Blocked → ready:** complete the open items (same branch, same PR);
   re-evaluate; seal. The intermediate checklists remain verifiable
   exact-revision records — no rewrite
   (`readiness.recovery.test.ts`).
2. **Tampered → re-sealed:** amend the content, re-seal (a NEW digest,
   a NEW exact revision), re-derive. The tampered record never
   re-enters the pipeline (digest verification refuses it first).
3. **Journal extension:** append the missing events; the fold replays
   the recovered state from the journal alone, in any input order.

## Reproducibility

Every gate behavior is deterministic: identical inputs produce
identical refusals with identical messages and digests. Two full runs
of the pipeline — scope → checklist → evaluation → manifest → journal
→ fold — derive byte-identical results
(`release/test/determinism.test.ts`), and the gate policy itself is
exercised by the same battery the reviewers run
(`docs/operations/gate-policy.md` — the reference battery the release
scope mirrors).
