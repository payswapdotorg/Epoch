# Journey W047 — Web Product (apps/web)

Platform: Web (Chromium, Playwright 1.63.0, production build)
Persona: delivery lead / field engineer / chief engineer (construction), tech lead / on-call / staff engineer (software)
Product version: @epoch/web 1.0.0 (`apps/web`, Next.js App Router production build)
Source commit: dispatch base `5823249` on branch `work/W047-web-product` (final head SHA stated in the W047 PR)
Environment: Node 24 / pnpm 10.34.5 / Linux; `next build` + `next start` (port 3100; J12 private relaunch port 3101)
Fixture: `epoch-fixture-construction-v1.0.0` (tenant:nordstrand), `epoch-fixture-software-v1.0.0` (tenant:lightspeed) — boot-verified against `qa/fixtures/registry.json`

## Preconditions

- Deterministic fixture bundles restored byte-exactly at server boot (world/evidence/object digests verified against the committed registry anchors — fail-closed).
- One `ApplicationGateway` per fixture tenant, bound in-process by the server-only product runtime (the W046 seam).
- Fresh browser profile per test (no carried state); every step drives the VISIBLE client.
- Full records: [qa/web/journey-records.md](../../qa/web/journey-records.md); defect loop: [qa/web/defect-ledger.md](../../qa/web/defect-ledger.md).

## Steps

| # | User action | Expected | Observed | Result |
|---|---|---|---|---|
| J01 | Fresh user picks environment + principal + duration, signs in | Project context + 10-stage lifecycle navigator; world digest = fixture anchor; sign-out returns to entry | Project summary, navigator links, anchor-matched digest, sign-out recovery — both domains | PASS |
| J02 | World view + evidence capture | Authoritative digest, 8 entities, 12 live assertions, unknowns projection; intake closes a gap; lookup returns 2 records | All rendered; anchor match pill; 2 evidence rows after capture | PASS |
| J03 | Candidate selection + discovery run | Roles synthesized from capability demands; no model names; gaps render; toggling candidates changes resolution | 3 claim-based candidates; role table without model-name patterns; gaps + toggle-variant resolution — both domains | PASS |
| J04 | Seal alternative, evaluate constraints, validate chain, approve baseline, submit/approve/execute action | Byte-exact baseline seal; under/over-limit constraint verdicts; chain validated; baseline approved; the Action Gateway path completes with the authority's own statuses | `awaiting-approval` → approve → authorized → execute → executed — both domains | PASS |
| J05 | Build program, fold schedules, quote, order | Program id; BOQ/cost/milestone folds from the authority's `{rows,…}` shapes; grounded quote → PO chain | Program summaries per domain; non-zero schedule rows; quote + order admitted | PASS |
| J06 | Open delivery, observe, forecast, supervise, alert, close, learn | Grounded delivery record; observation admitted; exact-decimal forecast; findings/alerts; closing + outcome registration | All admitted through the gateway with digests | PASS |
| J07 | Offline capture → reconnect → Sync now | Typed transient error; 1 queued offline (shared panel); drain through `recovery.replay` exactly once; ledger = 1 entry; evidence queues offline across stages | Exactly-once drain with authoritative outcome resolution in the stage | PASS |
| J08 | Second device resumes the session ref | Same session validated by the authority; same world digest | Handoff resumed; digest identical | PASS |
| J09 | Supervision pass → alert → return to Decide → approve → execute → stream | Pending agent action re-resolves after full-page navigation; intervention completes; live stream shows `executed` | Pending action restored from the authoritative stream; intervention + stream check passed | PASS |
| J10 | Entitlement check → pack → discovery link → submit action → stream | Marketplace authority decides; pack participates in discovery; the just-submitted action is the newest stream row `awaiting-approval` | Entitled pack, link, live status — both domains | PASS |
| J11 | 1m session expiry; aborted connector; invalid measure | Typed auth-session-expired + re-auth recovery; retry with the SAME correlation id succeeds; authority rejection verbatim | Recovery across all three failure classes | PASS |
| J12 | Launch → work → close → relaunch → update | Identical authoritative world digest across every phase; clean server lifecycle | Same digest on relaunch + after rebuild; no port leaks | PASS |

## Defects

| Defect | Severity | Reproduction | Fix | Regression test | Status |
|---|---|---|---|---|---|
| SM-1 duplicate `data-stage-link` (strict-mode) | P2 | J01 with the overview + navigator | overview switched to `data-stage-entry` | j01 stage-link loop | CLOSED |
| SM-2 unscoped digest locator (strict-mode) | P2 | J02 multi-chip surface | scoped locator + deterministic helper | j02 chip assertion | CLOSED |
| D-01 entity projection shape (8≠1) | P1 | J02 after load | project materialized entity records | j02 `toHaveCount(8)` | CLOSED |
| D-02 action approval: policy-denied submit + hardcoded status + state loss | P1 | J04 (submit with over-limit probe), J09 (navigate away), J10 (stream) | real authority statuses gate the affordances; pending action re-resolved from `action.status` | j04/j09/j10 chains | CLOSED |
| D-03 offline queue invisible to the shell | P1 | J07 enqueue | one provider-scoped queue + explicit Sync now drain + authoritative post-drain resolution | j07 both tests | CLOSED |
| D-04 schedule folds crashed the Plan surface | P1 | J05 build program | project `{rows, totals}` fold shapes | j05 both tests | CLOSED |
| D-05 digest-chip race (evidence chip read) | P2 | J12 before world resolves | wait for anchor-match pill | j12 digest1 | CLOSED |
| D-06 re-auth assertion against the wrong route surface | P2 | J11 recovery | assert the Understand surface re-resolution | j11 recovery | CLOSED |
| D-07 network failure conflated with session expiry | P1 | J07 offline mid-reload | only the authority's typed verdict expires; transient retries | j07 + j11 | CLOSED |
| D-08 server lifecycle leak (orphaned port) | P2 | J12 after a failed prior run | process-group kill + try/finally + pre-flight port check | j12 | CLOSED |

Full ledger with root causes: [qa/web/defect-ledger.md](../../qa/web/defect-ledger.md).

## Evidence
- CI artifact: the W047 PR checks (governance, boundary, typecheck, lint, test, build — turbo serial, CI regenerates the lockfile per its manifest protocol).
- Trace/screenshot: `apps/web/e2e-results/` (Playwright JSON reporter + `retain-on-failure` traces; empty artifacts on the final green run; failure artifacts from the diagnosis runs retained under `e2e-results/artifacts/` only when a failure occurred).
- Logs: the battery ran with one worker, `fullyParallel: false`, 24/24 passed (final run).

## Rerun
Result: **24/24 passed** (final battery after all defect closures; consecutive full reruns clean, ports verified free).
Notes: fixture ids `epoch-fixture-construction-v1.0.0` / `epoch-fixture-software-v1.0.0`; the battery re-runs green against both a fresh server and a reused server (status assertions are order-scoped).

## Accessibility baseline (WCAG 2.1 AA)

The product ships an accessibility baseline implemented and verified through the
shell + shared components (`apps/web/src/product/shell.tsx`, `ui.tsx`,
`src/shared/components.tsx`, `app/globals.css`):

- **1.3.1 / 2.4.1 landmarks + bypass**: semantic `header` / `nav` / `main` / `footer` regions (`data-region` attributes); the navigator is a labelled `nav` ("Solution Navigator"); the content region is a single `main` per route.
- **1.3.1 tables + captions**: every data table renders a `<caption>` + a `role="region"` `aria-label` (DataTable); digest chips carry `title` with the full label + value.
- **1.4.3 / 1.4.11 contrast (AA)**: the token palette (`src/shared/tokens.ts`) pairs foreground/background to at least 4.5:1 text and 3:1 UI contrast — measured: `textPrimary #1c1917` on `background #f8f7f4` 16.3:1, `textSecondary #57534e` on `surface #ffffff` 7.6:1, warning `#7a5b13` on `#f7ecd9` 5.4:1, negative `#7f1d1d` on `#f8e3e3` 8.2:1, positive `#31572c` on `#e7f0e4` 7.1:1, accent foreground `#fafaf9` on `#44403c` 9.8:1.
- **2.4.7 / 2.4.11 focus visible**: global `*:focus-visible` + link focus styles (`app/globals.css`); keyboard-scrollable regions keep visible focus.
- **2.5.5 / 2.5.8 target size**: buttons are ≥ 44×44 px (`minHeight/minWidth: 44px`); navigator links ≥ 32 px height with padding; inputs ≥ 40 px.
- **3.3.2 labels**: every input pairs an explicit `<label htmlFor>` (Field/SelectInput/TextInput); custom controls carry `aria-label` (e.g. "Approve the pending action through the human approval flow").
- **4.1.2 / 4.1.3 status messages**: `role="alert"` error banners, `role="status"` success notes + `aria-live="polite"` loading states; the current navigator link carries `aria-current="page"`.
- **2.3.3 reduced motion**: the global stylesheet respects `prefers-reduced-motion` (transitions/animations disabled).
- **Error identification (3.3.1/3.3.3)**: typed error banners surface the authority's message + code + the recovery action ("Retry" affordances), never bare exceptions; the render boundary is a typed `StateView` with a "Try again" affordance.
- **Keyboard operability**: all interactive elements are native `button`/`select`/`input`/`a` (no custom key handlers needed); the full journey battery (J01–J12) exercises every affordance as a real click/fill/select through the accessible tree.
