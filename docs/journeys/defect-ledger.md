# Epoch Journey Defect Ledger — consolidated (W050 closure)

The repository-level consolidated view of every defect observed, fixed
and regression-proven across the W047-W050 productization journeys. The
per-platform ledgers remain the detailed records; this file is the
closure view required by `docs/journeys/README.md` (the expected record
set of the journey evidence tree).

Severity vocabulary: `spec/journey-validation.md` (P0 data loss /
cross-tenant exposure / broken authority boundary / impossible install;
P1 core journey blocked; P2 material impairment with workaround; P3
polish). **Release gate: no unresolved P0/P1; every P2 dispositioned.**

## Consolidated status

| Platform / wave | Defects | P0 | P1 | P2 | P3 | Unresolved |
|---|---|---|---|---|---|---|
| Web (W047) — `qa/web/defect-ledger.md` | 10 | 0 | 5 (D-01..D-04, D-07) | 5 (SM-1, SM-2, D-05, D-06, D-08) | 0 | **0** |
| Desktop (W048) — per-domain journey records | 5 | 0 | 5 | 0 | 0 | **0** |
| Mobile (W049) — per-platform journey records | 0 in-sandbox product defects (harness validated by its own battery) | 0 | 0 | 0 | 0 | **0** |
| Cross-platform (W050) — this ledger | 0 | 0 | 0 | 0 | 0 | **0** |

**Program total at closure: 15 defects, all CLOSED with regression
coverage; 0 unresolved P0/P1; every P2 dispositioned (fixed + regression
test).**

## The closed defects (index)

### Web (W047) — full detail in `qa/web/defect-ledger.md`

| Defect | Severity | One-line disposition |
|---|---|---|
| SM-1 duplicate `data-stage-link` (strict-mode) | P2 | overview switched to `data-stage-entry`; regression j01 |
| SM-2 unscoped digest locator (strict-mode) | P2 | scoped locator + deterministic helper; regression j02 |
| D-01 entity projection shape (8≠1) | P1 | project materialized entity records; regression j02 |
| D-02 approval: policy-denied submit + hardcoded status + state loss | P1 | real authority statuses gate the affordances; regressions j04/j09/j10 |
| D-03 offline queue invisible to the shell | P1 | one provider-scoped queue + explicit Sync now drain; regression j07 |
| D-04 schedule folds crashed the Plan surface | P1 | project `{rows, totals}` fold shapes; regression j05 |
| D-05 digest-chip race (evidence chip read) | P2 | wait for anchor-match pill; regression j12 |
| D-06 re-auth assertion against the wrong route surface | P2 | assert the Understand surface re-resolution; regression j11 |
| D-07 network failure conflated with session expiry | P1 | only the authority's typed verdict expires; transient retries; regressions j07+j11 |
| D-08 server lifecycle leak (orphaned port) | P2 | process-group kill + try/finally + pre-flight port check; regression j12 |

### Desktop (W048) — full detail in `docs/journeys/desktop-linux.md`

| Defect | Severity | One-line disposition |
|---|---|---|
| `program.schedule` milestone fold mis-shaped | P1 | product reads `folds.milestones?.rows`; regression desktop-journeys J05 |
| W017 shell session-open payload rejected (no shell session opened) | P1 | `bindSession` sends the W017 tenancy scope; regression J01 |
| J04 constraint hand-rolled, not a compiled W004 artifact | P1 | harness compiles through the REAL `compileConstraint`; regression J04 |
| Software-domain scenario ids drifted from the fixture | P1 | aligned to registry-verified fixture ids; regression software-domain runs |
| J04 evaluation context hardcoded | P1 | runner passes the scenario's constraint context; regression J04 |

### Mobile (W049)

No in-sandbox product defects: the field product engine passed its
journey simulation set on first full drive (J01/J02/J04/J06/J07/J08/J09/
J11/J12 over the real gateway; the named-negative battery proves the
boundary behavior). The detox E2E harness is delivered complete for
infra with the mobile toolchains — see the honest environment records in
`docs/journeys/mobile-android.md` / `mobile-ios.md`.

### Cross-platform (W050)

No product-level cross-platform defects: the three client products
composed the shared authorities correctly on first drive — digest
continuity, session continuity, capture continuity, approval continuity
and offline no-drift all held without a client-tree repair (the
harness's own bring-up corrections were harness-side; recorded in
`docs/journeys/cross-platform.md`).

## Release gate verdict (W050)

- All required journeys pass: per-platform J-sets (W047/W048/W049
  records) + the cross-platform X-set (this wave) — **green**.
- No unresolved P0/P1: **0 anywhere in the program**.
- Every P2 has a disposition/evidence: **all fixed with regression
  coverage** (indexed above).
- Install/launch/relaunch/update: covered per platform (J12 records) and
  bound to the release identity (`release/clients/release-manifest.json`).
- Cross-device state is consistent: proven at the digest level
  (X-01/X-02/X-03) and the outcome level (X-05).

**ROADMAP GATE: PASS — the program closes at 50/50.**
