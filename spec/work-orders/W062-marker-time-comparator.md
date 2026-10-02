# W062 — Marker-Time Ordering Defect Closure

Status: AUTHORIZED
Wave: ACR-008 / serialized (single work order)
Depends On: ACR-007/W061
Worker Count: 1

**Owned surfaces**
- `packages/world-experience/src/timeline.ts`
- `packages/world-experience/test/*` (comparator regression additions only)
- `qa/world-experience/w016-marker-time-known-issue.test.ts`
- `docs/journeys/interactive-world.md`
- `spec/PROJECT-STATE.md`
- `spec/development-state/*`
- `AI_CONTINUATION.md`

## Objective

Close the ledgered W016 marker-time P2 defect with the full public discipline chain (fix -> rerun -> close): replace the lexicographic string-key comparator with the specified numeric `(atMs, markerId)` ordering, flip the pinned known-issue battery into the regression battery, and close the defect-ledger entry.

## The frozen seam

`packages/world-experience/src/timeline.ts` — `SceneTimelineSchema` `.superRefine`: the current code maps markers to `` `${m.atMs}\u0000${m.markerId}` `` STRING keys and compares with `<=`, so mixed-digit-width marker times mis-sort lexicographically. The specified intent (the admission error message itself): "markers must be sorted by (atMs, markerId) ascending and duplicate-free".

## Required work

1. The comparator: compare `atMs` numerically (non-negative integers, already schema-validated); tie-break on `markerId` lexicographically (the specified string-id ordering); duplicate-free unchanged (strictly ascending pairs; equal pairs still refused as duplicates). Nothing else in the refine or the package changes.
2. The battery flip (`qa/world-experience/w016-marker-time-known-issue.test.ts`, file path stable): the numerically-ascending mixed-width case ADMITS; the numerically-descending case is REFUSED with the typed admission error; the wrong-end-bound consequences disappear (`timelineEndMs` == 12000 for the mirrored case; the in-track position validates); the same-digit-width control stays green. Re-record the file header from the KNOWN-ISSUE pin to the closed-defect regression record (keep the discipline-chain narrative: observed -> recorded -> reproduced -> FIXED -> rerun -> closed).
3. The ledger: `docs/journeys/interactive-world.md` — close the W016 defect-ledger entry with the fix -> rerun -> close chain and the exact evidence.
4. A focused comparator regression in `packages/world-experience/test/` (mixed-width ascending admits, mixed-width descending refused, duplicate refused, markerId tie-break ordering, same-width control) — additive only; do not modify unrelated tests.

## Non-negotiables

- No semantic change; no schema/contract version bump; no new surfaces beyond the owned list; no second comparator.
- Every assertion that changes must flip FOR THE BETTER; nothing else may change behavior.
- The same-digit-width workaround consumers (qa harness fixtures, the W061 leg battery) stay green UNCHANGED.
- Zero new runtime dependencies; root manifests/lockfiles untouched.

## Verification (record all of it honestly)

- `packages/world-experience`: typecheck + lint + full test battery.
- `qa/world-experience`: the full journey/parity battery INCLUDING the flipped W016 record.
- Scoped regressions: `packages/world-runtime` battery (the marker consumers), root governance + boundary check.
- Before/after table for the three pinned cases in the PR report.

## Delivery discipline

One branch `work/W062-marker-time-comparator`, one PR, base `main`. The report ends with the literal marker line `=== W062 COMPLETION REPORT ===` followed by the final line `W062 COMPLETE`. The worker NEVER merges its own PR. Owned surfaces only — zero files outside the list above.
