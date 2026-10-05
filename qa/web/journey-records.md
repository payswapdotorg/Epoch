# W047 Web Journey Records — apps/web (Epoch Product)

The W047 browser journey battery evidence (J01–J11 + J12 smoke, web platform),
per `spec/journey-validation.md`. All records ran against the **production
build** (`next build && next start`) with Playwright 1.63.0 / Chromium, one
worker, `fullyParallel: false`, traces + screenshots retained on failure.

- **Source**: branch `work/W047-web-product` (dispatch base `5823249`; final head SHA stated in the PR).
- **Build mode**: production (`next build` + `next start -p 3100`; J12 launches its own `next start -p 3101`).
- **Environment**: Node 24, pnpm 10.34.5, Linux.
- **Fixtures** (deterministic, digest-anchored): `epoch-fixture-construction-v1.0.0` (tenant:nordstrand) and `epoch-fixture-software-v1.0.0` (tenant:lightspeed) — byte-verified at server boot against `qa/fixtures/registry.json`.
- **Interaction discipline**: every step drives the VISIBLE client (no direct kernel/API shortcuts); digests assert the committed fixture anchors.
- **Result**: **24/24 passed** (J01×3, J02, J03×3, J04×3, J05×2, J06, J07×2, J08, J09, J10×2, J11×3, J12×1).

## Per-journey record

### J01 — Onboard / project entry (persona: fresh user)
Fixture: construction + software.
Fresh browser profile → entry surface (environment + registered principal + session duration) → authenticate through the identity boundary → project context + lifecycle navigator.
- 10 stage links render (`data-stage-link`); project-summary carries tenant + solution title; the world digest equals the committed anchor (construction `52b9c01c…`, software `9306022e…`).
- Sign-out returns to the entry surface (recoverable state).
Evidence: `apps/web/e2e/j01-onboard.spec.ts` (3 passing tests).

### J02 — Understand / knowns / unknowns / evidence
Fixture: construction.
World view resolves the authoritative digest (anchor match pill) + 8 materialized entities + 12 live assertions; the information-gap projection renders; evidence capture (`evidence.intake`) closes a gap and `evidence.get` returns the fixture record + the captured observation (2 rows).
Evidence: `e2e/j02-understand.spec.ts` (1 passing test).

### J03 — Capability / role discovery (no model→role mapping)
Fixture: construction + software.
The candidate catalog renders claim-based entries (3 per domain: team, copilot, external); `discovery.run` synthesizes roles from capability demands; the role table contains no model/provider names; capability gaps render; toggling the candidate set changes the resolution (claims drive matching, not labels).
Evidence: `e2e/j03-discovery.spec.ts` (3 passing tests).

### J04 — Alternatives / constraints / verification / Action Gateway approval
Fixture: construction (+ software for the same authority path).
Baseline alternative seals byte-exact to the fixture digest; the constraint engine answers under-limit (pass) and over-limit (violated); the verification chain validates; `solution.approveBaseline` records the human decision; the Action Gateway path runs submit → approve → execute with the authority's own status vocabulary (`awaiting-approval` → authorized → executed).
Evidence: `e2e/j04-decide.spec.ts` (3 passing tests).

### J05 — Program of work / BOQ / domain schedule / acquisition
Fixture: construction + software.
`program.build` over the sealed solution (program id `program:warehouse-extension` / `program:checkout-v2-delivery`); the quantity/cost/milestone schedule folds project the authority's own `{rows, totals}` shapes; the procurement chain grounds quote → purchase order through kernel-sealed cross-references.
Evidence: `e2e/j05-plan-acquire.spec.ts` (2 passing tests).

### J06 — Realize / field observation / actualization / verification / forecast / close / learn
Fixture: construction (+ software projection).
`delivery.open` grounds on the sealed solution; field observation captures through `delivery.observe`; the rolling forecast folds exact decimals; supervision pass + alerts raise; `delivery.close` + `outcome.learn` complete the lifecycle.
Evidence: `e2e/j06-realize.spec.ts` (1 passing test).

### J07 — Offline work / queue / reconnect / idempotent sync
Fixture: construction.
Offline capture fails as typed transient (`Network unavailable`), queues as a PENDING projection (the shared queue panel shows "1 queued offline"); the explicit `Sync now` drain goes through `recovery.replay` — the observation is admitted once (the stage resolves its queued capture from the authoritative drain outcome), a second drain has nothing pending (no double-apply path client-side), and the observation ledger holds exactly ONE entry. Evidence intake queues offline across stages (Understand).
Evidence: `e2e/j07-offline.spec.ts` (2 passing tests).

### J08 — Cross-device handoff
Fixture: construction.
The second device resumes the SAME session reference through the entry handoff form; `session.validate` re-resolves; the world projection equals the same authoritative digest.
Evidence: `e2e/j08-handoff.spec.ts` (1 passing test).

### J09 — Agent supervision / intervention
Fixture: construction.
Supervision pass evaluates the program + delivery; findings raise alerts; the pending agent action (submitted on Decide) is intervened on through the Action Gateway human-approval path after a full-page navigation away and back (the pending approval re-resolves from the authoritative action stream); the Developers surface shows the live action stream with the intervened action's terminal status (`executed`).
Evidence: `e2e/j09-supervision.spec.ts` (1 passing test).

### J10 — Developer / marketplace capability flow
Fixture: construction (+ software entitlement).
The entitlement check decides through the marketplace authority (entitled capability pack); the pack links into capability discovery; the Developers surface shows the action stream with the just-submitted action's live status (`awaiting-approval`, the newest row — the stream sorts ascending by action id).
Evidence: `e2e/j10-marketplace.spec.ts` (2 passing tests).

### J11 — Recovery (session expiry / connector failure / input failure)
Fixture: construction.
(a) A 1-minute session expires: the typed `auth-session-expired` error + re-authenticate recovery action surface; re-authentication issues a fresh session and the Understand surface re-resolves the authoritative digest. (b) A connector failure aborts exactly one gateway call; the transport retries with backoff under the SAME correlation id and the capture succeeds. (c) A structurally-invalid measure surfaces the execution-tracking authority's rejection verbatim (never a client-invented semantic error).
Evidence: `e2e/j11-recovery.spec.ts` (3 passing tests).

### J12 — Install → launch → work → close → relaunch → update (SMOKE)
Fixture: construction.
The production artifact launches on a private port; a real journey action (evidence capture) works; the server stops; a fresh process resolves the SAME authoritative world digest; a rebuild + relaunch (the update) resolves the same digest again. Server lifecycle is fully reaped (process-group kill + try/finally) — no port leaks.
Evidence: `e2e/j12-lifecycle.spec.ts` (1 passing test).

## W072 — Construction solution workspace journeys (J14–J17)

Per `spec/work-orders/W072-web-construction-solution-workspace.md` (ACR-012, web).
All records ran against the **production build** (`next build` + `next start`,
battery port `:3210`) with Playwright / headless Chromium and REAL software GL
(SwiftShader ANGLE — the renderer string is asserted in-run). The `/world`
surface drives the frozen W058 world stack (world-runtime + renderer fabric +
the Three.js and Babylon.js adapters) through the sealed
`@epoch/construction-world-fixture` (W071, digest-anchored).

- **Source**: branch `work/w072-web-construction-solution-workspace`
  (rebuild base `2e05eb2`; delivery head stated in the PR).
- **Interaction discipline**: same as J01–J12 — every step drives the VISIBLE
  client; 3D picks go through the component's own projector + hit-test (the
  fabric seam), never direct kernel shortcuts.
- **Result**: **j14–j17 green** (4 specs / 4 tests: j14 4.4s, j15 5.0s,
  j16 4.5s, j17 5.6s) + j13 world battery regression green (3 passed +
  3 project-skips) + J01–J12 untouched-green in the final partitioned
  invocations (29 passed + 3 skipped; j07 green isolated after one mid-suite
  flake under load — the known invocation-sensitivity pattern; j12 per the
  defect-ledger W072-3 constraint record) + vitest 216 passed | 22 skipped.

### J14 — Construction world arrival / renderer equivalence / spatial dominance
Fixture: construction (the sealed W071 construction-solution world).
`/world` opens the construction solution (workspace kind + solution bar name +
sealed fixture digest); the frozen 34-entity set (slab/columns/walls/roof/
HVAC/staging) presents BEFORE any interaction with real GL massing pixels
(54 distinct colors / 6.87% non-ground at the drawing buffer); the Babylon.js
surface renders equivalent LIT geometry (30 colors, channel spread 204) over
the same entity set; the three→babylon→three round trip preserves digest,
entity set, selection and timeline position (switch receipt surfaced);
dominance asserted live: row-share ∈ [0.60, 0.80] at the battery canvas,
HUDs float INSIDE the viewport card, the default state never scrolls.
Evidence: `e2e/j14-world-arrival.spec.ts` (1 passing test); ACs 1–5, 20.

### J15 — World inspection / navigation / identity / measure / annotate
Fixture: construction.
Orbit/pan/zoom through the navigation affordances (reset → 2× orbit → pan →
typed wheel zoom; the HUD readout changes at every step, `zoom applied`
journaled); a REAL 3D pick through the fabric seam resolves the canonical
`cs-site-staging-yard`; the §9 engineering card projects identity, type,
material, dimensions, quantity, phase, status, cost, constraints + the
evidence trail (BOQ line, ⚠ finding, layer, phase — a fixture projection,
never a second ledger); the documented four-pick measurement cadence
(anchor → arm → re-anchor → composed typed intent, 4 journal entries +
`measure-requested` + the live hint HUD); the typed annotate intent attaches
to the focused entity as a CANONICAL revision (digest changes; the note
renders in the world overlay).
Evidence: `e2e/j15-world-inspection.spec.ts` (1 passing test); ACs 6, 10–13.

### J16 — Drawings: plan / section / layers / timeline
Fixture: construction.
True top-down plan with labelled footprints and the A–A cut line (a REAL plan
pick through the component's projector + hit-test); the section exposes the
internals THROUGH the envelope at the default cut and re-projects at the
steppers (a REAL section pick of the duct at the stepped cut); MEP layer
isolation through the typed filter intent — the navigator state AND the
spatial truth (only MEP entities remain; reveal-all restores through the
typed show intent); the timeline phase scrubbers move the programme head
(position, phase HUD, built-count metrics and the DRAWING truth: future
phases dashed, arrived phases solid, all solid at Finishes); the stable-stage
GL round trip returns to 3D.
Evidence: `e2e/j16-world-drawings.spec.ts` (1 passing test); ACs 7–9, 16.

### J17 — Solution exploration: agents / BOQ / findings / variants
Fixture: construction.
≥2 agents visible inside the world (presence rail + projected markers in the
3D chrome AND on the plan at their world positions); the typed follow-agent
intent switches the camera mode (HUD names it; the agent's current-work
element highlights IN the world); the BOQ explores per-layer rollups →
subtotal → contingency → total with BIDIRECTIONAL world cross-highlight
(BOQ line → its entity selected + stroked; world pick → its line
cross-highlighted, persistent until cleared); the ✓/⚠ findings surface with
the MEP-clash ⚠ selection focusing its elements AND revealing the hidden
owning layer through the typed show intent (the duct, the riser AND the
hidden legacy conduit become spatially discoverable); variants compared
THROUGH the world (Alt A: conduit REMOVED, duct rerouted, 3D delta badges;
Alt B: the NEW interior AHU with its success ring; Current: the world
restored — the representation itself changes, never a table-only comparison).
Evidence: `e2e/j17-world-solution.spec.ts` (1 passing test); ACs 14, 15, 17–19.

## Named negatives (the Work Order's binding pins)

Pinned by `apps/web/src/product/authority-pins.test.ts` (vitest, green):

1. **The UI cannot bypass the Action Gateway** — the UI operation surface is a strict subset of the frozen 32-operation gateway vocabulary (`isGatewayOperationName` + registry check); mutating flags match the frozen registry kinds; the only server mutation endpoint is the envelope-only `/api/gateway` route which dispatches through `ApplicationGateway.call` (no route handler constructs kernel mutation entry points).
2. **Reload resolves authoritative state** — the client persists session REFERENCES only (never semantic state; no client-side kernel constructors); boot revalidation goes through `session.validate`; the offline queue holds pending projections of queueable operations only (non-queueable mutating ops are never admitted).
3. **No hard-coded model→role mapping** — no source file in apps/web maps model/provider names to roles; the candidate catalog carries `claimedCapabilities`/`claimBasis` and the discovery input is task/world/evidence/constraint signals. E2E: the J03 role table matches no model-name pattern.

Plus the client-seam pin: `src/product` + `src/client` import only `@epoch/client-runtime` (the derivation stays kernel-free).
