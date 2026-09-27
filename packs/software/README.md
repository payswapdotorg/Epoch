# @epoch/pack-software

The Epoch Software/Infrastructure Domain Pack (W027, DP1.0): DATA + PURE
PROJECTION FUNCTIONS over the universal solution-delivery state (W036
`@epoch/solution-delivery`). The pack teaches Epoch how software
delivery expresses the universal lifecycle — it never holds lifecycle
authority, never keeps a parallel tracker or ledger, never writes
canonical state, executes no deployment, renders no UI, and names no
provider.

## What the pack provides

- **The DP1.0 pack profile** (`softwarePackProfile(tenantId)`): the W036
  `SolutionPackProfile` shape instantiated — pack id/version, the
  supported universal lifecycle version, the stage display vocabulary for
  the eleven universal stages (realize -> "Build & Deploy", the Work
  Order pin), the projection rules over the eleven Navigator projections,
  measurement/migration notes and capability dependencies (the W007
  `software-engineering-workspaces` class). Admitted through the W036
  `admitPackProfile` path (`admitSoftwarePackProfile`);
  authority-claim fields and non-universal stage bindings are
  `authority-violation-rejected` by the kernel itself.
- **Software vocabulary as typed data** (one sealed `VocabularyBundle`,
  content-addressed):
  - World Model entity bindings (`software:system|service|environment|
    repository|release-unit` W002 type keys -> software concepts) —
    descriptive bindings, never new authorities;
  - the work-item vocabulary (epics/issues/tasks/changes) bound onto
    canonical work-package/activity lines — display terms, never a
    parallel tracker;
  - measurement methods (effort-hours with net/contingency rules;
    deliverable/deployment/environment counts) — deterministic quantity
    derivations as pure functions over plan quantity schedules;
  - cost/resource classifications (engineering/infrastructure/licensing/
    operations) applied as folds over the W036
    `CostSchedule`/`ResourceSchedule`;
  - verification-method descriptors (test-suite pass, review approval,
    deploy gate, SLO check) referencing the W006 provenance conventions —
    descriptors only, the verification authority is never re-implemented;
  - constraint descriptors compatible with the W004 `policyBindingSchema`
    (pinned by the devDep parity tests);
  - outcome types (release delivered/accepted, SLO attainment/breach
    residual, service handover) as projections over the universal W036
    outcome kinds;
  - deployment environments (development/integration/staging/production —
    provider-neutral tiers).
- **The canonical activity display-state derivation**
  (`activityDisplayStateOf` / `workPackageDisplayStateOf`): issue-tracker
  and rollout states are DERIVED from the canonical lifecycle states on
  each W036 Activity (actualFinish/actualStart/actualProgress/blockers);
  the canonical DeliveryRecord state is the ONLY truth — display states
  are recomputed on every projection, never stored.
- **Work templates**: versioned, content-addressed software
  work-package/activity templates (feature delivery, bugfix, migration,
  infrastructure change — `softwareWorkTemplates()`).
  `instantiateWorkTemplate` is a CALLER-SIDE fold producing
  plan-compatible `WorkPackage` shapes admitted by the W036
  `buildProgramOfWork` — never a canonical write.
- **The synchronized projections** (pure folds over W036 sealed state,
  recomputed on every call, digest-bearing):
  - `projectRoadmap` — the roadmap view: releases (releaseId IS the
    canonical milestone id — the SAME id, never minted), milestones
    (identity-mapped, software status terms Planned/Shipped/Missed),
    tracks (grouped by canonical solution-line/work-package anchors) and
    the deduplicated dependency edges of the ProgramOfWork;
  - `projectBacklog` — the issue-tracker view model: epic rows over the
    canonical work packages and issue/task/change rows over the canonical
    activities (identity-mapped ids, derived display states, linked
    observations/actuals from the canonical DeliveryRecord) — never a
    stored tracker;
  - `projectDeploymentPlan` — the deployment-plan view: rollout steps
    identity-mapped to canonical activity ids, grouped into
    deployment-environment tiers through a caller-supplied assignment
    index (typed data referencing canonical ids), with deploy gates,
    blockers and milestones carried through.
- **The deploy-proposal seam**: `softwareDeployProposalTemplates()` and
  `renderDeployProposal` — versioned, content-addressed W003
  action-proposal templates (release rollout, infrastructure change,
  rollback) with the REQUIRED W003 safety metadata (preconditions,
  predicted effects, side effects, reversibility, authority
  requirements). `renderDeployProposal` binds caller parameters into a
  typed `ActionProposal` validated through the W003 admission pipeline —
  the ONLY way a deployment action leaves this pack. Authorization and
  execution belong to the W022 Action Gateway; the pack NEVER executes.

## Discipline

- `parallel-tracker-rejected` — a record attempting to store
  issue/backlog/roadmap/deployment tracker state or keep a parallel
  ledger through the pack (typed pre-classification at every pack
  admission surface);
- `gateway-bypass-rejected` — a record attempting a direct deployment
  execution path outside the W003/W022 authority seam;
- tenant isolation on every record the pack produces
  (`cross-tenant-denied`);
- determinism + replay: identical inputs -> identical digests for every
  derived view; input order never leaks;
- SN1.0 partial-data behavior: missing inputs project as empty
  views/defaults, never as blockers;
- provider neutrality: no vendor vocabulary anywhere (blocklist-tested);
- zero wall-clock, zero randomness, zero IO (source-scan tested).

## Verification

```
pnpm check
pnpm exec turbo run typecheck lint test build --concurrency=1 --force
```
