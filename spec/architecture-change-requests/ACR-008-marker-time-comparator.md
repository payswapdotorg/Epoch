# ACR-008 — Marker-Time Ordering Defect Closure

Status: APPROVED — defect-closure program (no architecture change; no lock transition; E1.0/X2.0 invariants remain binding)

Approved: 2026-10-02 (operator standing continuation directive; the disposition was ledgered at the ACR-007 closure: "the comparator fix is a future-ACR disposition")

## Class of change

This is NOT a new semantic subsystem and NOT an architecture extension. It is the closure of a ledgered implementation defect against ALREADY-SPECIFIED behavior. For this reason it requires no lock transition and no contract version bump: the specified intent — "markers must be sorted by (atMs, markerId) ascending and duplicate-free" — is unchanged, and the fix restores it.

## The defect (observed -> recorded -> reproduced; remaining links: fix -> rerun -> close)

- Seam: `packages/world-experience/src/timeline.ts` — `SceneTimelineSchema` `.superRefine` builds STRING keys `` `${m.atMs}\u0000${m.markerId}` `` and compares them with `<=`, so marker times of MIXED DIGIT WIDTH mis-sort lexicographically:
  - `"5000\0mrk-a" > "12000\0mrk-b"` lexicographically, so a numerically ASCENDING timeline (5000 then 12000) is REFUSED with the typed admission error — the honest scene author is rejected;
  - the mirror: a numerically DESCENDING timeline (12000 then 5000) is ADMITTED, and `timelineEndMs` then computes the WRONG end bound (the last marker's 5000, not the track's 12000 event), which rejects in-bounds replay positions through `validateTimelinePosition`.
- Discovered: W057 journey bring-up. Recorded: `docs/journeys/interactive-world.md` (defect ledger) + the qa harness advisory. Reproduced: `qa/world-experience/w016-marker-time-known-issue.test.ts` — a 3-test battery pinned against the REAL admission surface (`admitWorldScene`), deliberately green while the defect stands, designed to FLIP when the comparator is fixed (the defect can never silently drift).
- Ledgered P2 at the ACR-007/W061 closure with the precise repro; dispositioned "future ACR". This ACR is that disposition.

## The fix (binding)

A numeric-aware comparator inside the existing `.superRefine`:

1. compare `atMs` NUMERICALLY (both are validated non-negative integers by `SceneTimelineMarkerSchema` before the refine runs);
2. tie-break on `markerId` with the specified string ordering (lexicographic — `markerId` is a string id and that is its specified ordering);
3. duplicate-free semantics unchanged (strictly ascending `(atMs, markerId)` pairs; equal pairs are still duplicates and still refused).

No other behavior of `SceneTimelineSchema`, `admitWorldScene`, `timelineEndMs`, or `validateTimelinePosition` changes.

## Consumer impact (verified before authorization)

- No consumer relies on the defective ordering: the qa harness fixtures and the W061 leg battery author SAME-DIGIT-WIDTH marker times (the documented authoring workaround — identical under both orderings), and every other in-repo scene producer goes through the same admission surface that was refusing honest authors.
- The pinned battery flips by design: the "ascending refused" case admits; the "descending admitted + wrong end bound" case is refused with the typed admission error; the same-digit-width control stays green. The battery header is re-recorded from KNOWN-ISSUE to the closed-defect regression record (the file path stays stable — it is the discipline-chain record).

## Non-negotiables

- No semantic change, no schema/contract version bump, no new surfaces, no second comparator, no reordering of any other validation.
- Every assertion that changes must flip FOR THE BETTER (ascending admits, descending refuses); nothing else may change behavior.
- The same-digit-width workaround consumers stay green UNCHANGED.
- The full discipline chain closes in public evidence: fix -> rerun -> close, recorded in the defect ledger.

## Implementation binding

Single work order, single worker, serialized:

W062 — `spec/work-orders/W062-marker-time-comparator.md` (depends on ACR-007/W061, complete).

After W062 merges: ACR-008 closes, the frontier returns to EMPTY, and any further program again requires a new ACR.
