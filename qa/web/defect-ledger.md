# W047 Defect Ledger — Web Product (apps/web)

The defect loop per `spec/journey-validation.md`:
observe → record → reproduce → regression test → fix → rerun affected journey → rerun related journeys → close.
All defects below were reproduced through the browser battery (production
build), fixed, and closed by the final green run (**24/24 passed**). The
regression column is the journey assertion that fails if the defect regresses.

Severity scale: P0 (authority/data breach) / P1 (core journey blocked) /
P2 (material impairment with workaround) / P3 (polish).

| ID | Journey | Severity | Defect (observed) | Root cause | Fix | Regression test | Status |
|---|---|---|---|---|---|---|---|
| SM-1 | J01/J02 | P2 | Playwright strict-mode violation: duplicate `data-stage-link` (root overview + shell navigator) | the home overview repeated the shell's navigation contract attribute | overview uses `data-stage-entry` (the shell stays the single `data-stage-link` source) | j01 stage-link loop | CLOSED |
| SM-2 | J02 | P2 | Strict-mode violation: unscoped `getByTestId('digest')` resolved multiple chips | several digest chips render per surface by design | scoped locators (`world-digest` region) + deterministic `.first()` helper with design note | j02 world-digest chip assertion | CLOSED |
| D-01 | J02 | P1 | Entity table rendered 1 row (expected 8); sometimes "No rows." | the Understand projection misread `world.entities`' materialized shape (the kernel returns `{id, type, properties}` records) | project the materialized records (title from properties, sorted by id) | j02 `toHaveCount(8)` | CLOSED |
| D-02 | J04/J09/J10 | P1 | Action approval path: `approve-success` never rendered; `approve-action` disabled after navigating away; the stream showed `denied` | (a) the submit bound the transient constraint-probe value (20 over the limit) so the policy denied the action; (b) the submit-summary HARDCODED "awaiting approval" masking the authority's verdict; (c) local `actionId` state did not survive full-page navigation | (a) submit binds the declared decision value; (b) the UI surfaces the authority's real status and gates approve/execute affordances on it (a denied action never offers approval); (c) the pending approval re-resolves from the authoritative `action.status` stream on every mount | j04 submit/approve/execute chain; j09 restore+intervene; j10 live status | CLOSED |
| D-03 | J07 | P1 | `queue-pending-count` never rendered: the shell footer's offline-queue state never saw stage enqueues; no post-drain stage update | the offline queue was per-hook-instance React state (the shell's instance never re-read localStorage after a stage's enqueue) | ONE provider-scoped queue (`OfflineQueueProvider`) shared by the shell + stages; the drain is the explicit "Sync now" action through `recovery.replay` (matching the J07 scenario script's explicit reconnect-drain step); the Realize stage resolves its queued capture from the authoritative drain outcome | j07 both tests | CLOSED |
| D-04 | J05 | P1 | The Plan surface crashed to the error boundary ("Unavailable") on Build program | the stage cast the schedule folds as bare arrays; the solution-delivery authority returns `QuantitySchedule`/`CostSchedule`/`MilestoneSchedule` objects (`{rows, totals}`/`{rows, counts}`) | project the folds' `rows` (+ `totals`) defensively and render the real row fields (activityId/unit/plannedValue; plannedAmount/currency; milestoneId/title/status/targetDate) | j05 both tests | CLOSED |
| D-05 | J12 | P2 | Digest read grabbed the fixture EVIDENCE digest (`81130ca4…`) instead of the world digest | the `.first()` digest chip was read while `world.snapshot` was still resolving — during the loading window the first chip in DOM is the evidence panel's fixture digest | wait for the anchor-match pill before reading (the world chip is then unambiguous) | j12 digest1 assertion | CLOSED |
| D-06 | J11 | P2 | Re-auth succeeded but `project-summary` never appeared | the re-auth recovers the CURRENT route (the entry gate swaps back to the Understand stage); `project-summary` lives on the root route only | assert the honest recovery: the Understand surface re-resolves the authoritative digest (world-digest + anchor-match pill) | j11 recovery assertions | CLOSED |
| D-07 | J07/J11 | P1 | The boot revalidation treated a NETWORK failure as session expiry: the page dumped to "Session expired" when offline hit mid-reload | `session.tsx` cleared the stored session for ANY failed `session.validate` — conflating transient unreachability with the authority's expiry verdict | only the authority's typed answers expire the session (`auth-session-expired` class / a non-active state); transient failures retry (paced) and never fabricate a verdict; `revalidate` gained the same guard; the J07 spec waits for the surface before going offline (the offline transition must never land mid-resolution) | j07 (offline capture + drain), j11 (real expiry still expires) | CLOSED |
| D-08 | J12 | P2 | The lifecycle smoke hung on "Resolving authoritative session state…" — no hydration, `entry-domain` never rendered | `stop()` killed only the `npx` wrapper: the orphaned `next-server` child kept port 3101 bound serving a build whose assets the next `rm -rf .next && next build` deleted (chunks 404 → no client JS); a mid-test failure also leaked servers (no cleanup) | process-group lifecycle: `detached` spawn + group SIGTERM with SIGKILL escalation; try/finally reaps every launched server; a pre-flight port check fails loudly on leftovers | j12 (runs clean across consecutive batteries; ports verified free after runs) | CLOSED |

## Dispositions

- **P0**: none found.
- **P1**: 4 (D-01, D-02, D-03, D-04, D-07 — 5 distinct P1s); all fixed with regression coverage in the final green battery.
- **P2**: 5 (SM-1, SM-2, D-05, D-06, D-08); all fixed (no open P2 dispositions remain).
- **P3**: none recorded.

## Advisory (recorded, not a defect of this work order)

- The W046 `world.entities` service passes the type filter under a key the kernel ignores (the filter is silently dropped). The web product compensates with a client-side presentation projection (documented in `understand.tsx`); the seam fix belongs to the service owner.
- Playwright's `reuseExistingServer: true` means a battery re-run against an already-running 3100 server reuses accumulated in-memory authoritative state (sessions, actions). The specs are written to be robust to this (status assertions are order-scoped, not global) — recorded as a deliberate harness property, not a defect.
