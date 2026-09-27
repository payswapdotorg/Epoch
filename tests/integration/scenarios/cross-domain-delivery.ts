// W032 — the flagship CROSS-DOMAIN DELIVERY scenario definition.
//
// ONE solution carrying BOTH a construction work-package (W026 BOQ +
// programme projections) and a software work-package (W027 roadmap +
// backlog projections), over the SAME W036 solution-delivery spine:
// shared delivery record, shared actualization fold, shared variance
// ledger. The steps compose the REAL kernels through the
// cross-domain driver (scenarios/cross-domain-driver.ts); nothing is
// mocked; every id is explicit; every instant is a constant.
//
// The scenario is a content-addressed record (digest-stable
// serialization asserted by the harness); the runner double-runs it and
// requires a byte-identical trace (the trace-replay-deterministic gate).
import type { ScenarioDefinition } from '@epoch/test-harness';
import {
  ACTIVITY_DEPLOY_STAGING,
  ACTIVITY_EXCAVATION,
  ATTRIBUTION_ID,
  BASELINE_RECORD_ID,
  DEPLOY_OBSERVATION_ID,
  EXCAVATION_OBSERVATION_ID,
  ISSUE_ID,
  LINE_CHECKOUT_UI,
  LINE_EXCAVATION,
  LINE_STEEL,
  MILESTONE_FOUNDATIONS,
  MILESTONE_STAGING_RELEASE,
  OTHER_TENANT,
  RECEIPT_OBSERVATION_ID,
  TENANT,
  VARIANCE_DEPLOY_ID,
  VARIANCE_EXCAVATION_ID,
  WORK_PACKAGE_RELEASE,
  WORK_PACKAGE_SITEWORKS,
} from './shared';

/** The scenario id (stable, content-addressed). */
export const CROSS_DOMAIN_SCENARIO_ID = 'scenario:cross-domain-delivery';

/** The recovery tamper index (fixed mid-stream position). */
export const RECOVERY_TAMPER_INDEX = 5;

/**
 * The cross-domain delivery scenario: positive path (both packs, shared
 * spine) + negative paths (cross-tenant denial, authority-bypass
 * attempts) + recovery (replay, tamper detection, verified-prefix
 * continuation).
 */
export function crossDomainDeliveryScenario(): ScenarioDefinition {
  return {
    schemaVersion: 1,
    scenarioId: CROSS_DOMAIN_SCENARIO_ID,
    name: 'Cross-domain delivery (construction + software over one spine)',
    description:
      'One solution carrying BOTH a construction work-package (W026 BOQ/programme projections) and a software work-package (W027 roadmap/backlog projections), sharing the SAME delivery record, actualization fold and variance computation; positive + negative + recovery evidence.',
    tenantId: TENANT,
    actors: [
      { actorId: TENANT, kind: 'tenant', tenantId: TENANT },
      { actorId: 'principal:delivery-lead', kind: 'principal', tenantId: TENANT, role: 'delivery lead' },
      { actorId: 'principal:field-engineer', kind: 'principal', tenantId: TENANT, role: 'field engineer' },
      { actorId: 'principal:platform-engineer', kind: 'principal', tenantId: TENANT, role: 'platform engineer' },
      { actorId: 'principal:chief-engineer', kind: 'principal', tenantId: TENANT, role: 'approver' },
      { actorId: 'principal:procurement-lead', kind: 'principal', tenantId: TENANT, role: 'procurement' },
      { actorId: OTHER_TENANT, kind: 'tenant', tenantId: OTHER_TENANT },
      { actorId: 'principal:initech-agent', kind: 'principal', tenantId: OTHER_TENANT, role: 'foreign actor' },
    ],
    fixtures: [
      {
        fixtureId: 'fixture:solution-lines',
        kind: 'solution-lines',
        label: 'the three plan lines (two construction + one software)',
        content: { lineIds: [LINE_EXCAVATION, LINE_STEEL, LINE_CHECKOUT_UI] },
      },
      {
        fixtureId: 'fixture:work-packages',
        kind: 'work-packages',
        label: 'the two work-packages (one per domain pack, one program)',
        content: {
          construction: { workPackageId: WORK_PACKAGE_SITEWORKS, activities: [ACTIVITY_EXCAVATION, 'activity:steel-erection'] },
          software: { workPackageId: WORK_PACKAGE_RELEASE, activities: [ACTIVITY_DEPLOY_STAGING] },
        },
      },
      {
        fixtureId: 'fixture:milestones',
        kind: 'milestones',
        label: 'the canonical milestones (the roadmap identity-maps them)',
        content: { milestoneIds: [MILESTONE_FOUNDATIONS, MILESTONE_STAGING_RELEASE] },
      },
      {
        fixtureId: 'fixture:observations',
        kind: 'observations',
        label: 'the three shared-delivery observations',
        content: {
          observationIds: [EXCAVATION_OBSERVATION_ID, DEPLOY_OBSERVATION_ID, RECEIPT_OBSERVATION_ID],
        },
      },
      {
        fixtureId: 'fixture:variance',
        kind: 'variance',
        label: 'the shared variance ledger entries (one per domain)',
        content: { varianceIds: [VARIANCE_EXCAVATION_ID, VARIANCE_DEPLOY_ID], attributionId: ATTRIBUTION_ID, baselineRecordId: BASELINE_RECORD_ID, causeRecordId: ISSUE_ID },
      },
    ],
    steps: [
      // -- The two domain packs, admitted through the W036 gate.
      {
        stepId: 'step:admit-construction-pack',
        kind: 'call',
        driverOp: 'packs.admit-construction',
        label: 'admit the W026 construction pack profile',
        actorId: 'principal:delivery-lead',
        route: 'public-api',
        input: {},
        expect: 'ok',
      },
      {
        stepId: 'step:admit-software-pack',
        kind: 'call',
        driverOp: 'packs.admit-software',
        label: 'admit the W027 software pack profile',
        actorId: 'principal:delivery-lead',
        route: 'public-api',
        input: {},
        expect: 'ok',
      },
      // -- The W036 spine.
      {
        stepId: 'step:solution-seal',
        kind: 'call',
        driverOp: 'solution.seal',
        label: 'seal the solution version (three lines, two domains)',
        actorId: 'principal:delivery-lead',
        route: 'public-api',
        input: {},
        expect: 'ok',
      },
      {
        stepId: 'step:baseline-approve',
        kind: 'call',
        driverOp: 'solution.approve-baseline',
        label: 'admit + approve the baseline (the authority act)',
        actorId: 'principal:chief-engineer',
        route: 'public-api',
        input: {},
        expect: 'ok',
      },
      {
        stepId: 'step:program-build',
        kind: 'call',
        driverOp: 'program.build',
        label: 'build the ProgramOfWork (BOTH work-package variants)',
        actorId: 'principal:delivery-lead',
        route: 'public-api',
        input: {},
        expect: 'ok',
      },
      // -- The synchronized projections, both packs over the same program.
      {
        stepId: 'step:projection-boq',
        kind: 'call',
        driverOp: 'projection.boq',
        label: 'the W026 BOQ projection (identity-mapped plan lines)',
        actorId: 'principal:delivery-lead',
        route: 'public-api',
        input: {},
        expect: 'ok',
      },
      {
        stepId: 'step:assert-boq-identity',
        kind: 'assert',
        invariant: 'identity-preservation',
        label: 'the BOQ line items identity-map the solution plan lines',
        argument: { canonicalSurface: 'solution-lines', projectionSurfaces: ['boq-line-items'] },
        expect: 'satisfied',
      },
      {
        stepId: 'step:projection-construction-programme',
        kind: 'call',
        driverOp: 'projection.construction-programme',
        label: 'the W026 construction programme projection',
        actorId: 'principal:delivery-lead',
        route: 'public-api',
        input: {},
        expect: 'ok',
      },
      {
        stepId: 'step:projection-roadmap',
        kind: 'call',
        driverOp: 'projection.roadmap',
        label: 'the W027 roadmap projection (releaseId IS the milestone id)',
        actorId: 'principal:platform-engineer',
        route: 'public-api',
        input: {},
        expect: 'ok',
      },
      {
        stepId: 'step:assert-roadmap-identity',
        kind: 'assert',
        invariant: 'identity-preservation',
        label: 'the roadmap releases identity-map the program milestones (cross-pack)',
        argument: { canonicalSurface: 'program-milestones', projectionSurfaces: ['roadmap-releases'] },
        expect: 'satisfied',
      },
      // -- The SHARED delivery record.
      {
        stepId: 'step:delivery-open',
        kind: 'call',
        driverOp: 'delivery.open',
        label: 'open the SHARED delivery record (one spine for both domains)',
        actorId: 'principal:delivery-lead',
        route: 'public-api',
        input: {},
        expect: 'ok',
      },
      // -- The W037 procurement chain (Acquire, for the steel line).
      { stepId: 'step:procurement-request', kind: 'call', driverOp: 'procurement.request', label: 'admit the acquisition request (steel line)', actorId: 'principal:procurement-lead', route: 'public-api', input: {}, expect: 'ok' },
      { stepId: 'step:procurement-package', kind: 'call', driverOp: 'procurement.package', label: 'seal + admit the acquisition package', actorId: 'principal:procurement-lead', route: 'public-api', input: {}, expect: 'ok' },
      { stepId: 'step:procurement-quote', kind: 'call', driverOp: 'procurement.quote', label: 'seal + admit the quote', actorId: 'principal:procurement-lead', route: 'public-api', input: {}, expect: 'ok' },
      { stepId: 'step:procurement-select', kind: 'call', driverOp: 'procurement.select', label: 'seal + admit the quote selection', actorId: 'principal:procurement-lead', route: 'public-api', input: {}, expect: 'ok' },
      { stepId: 'step:procurement-commit', kind: 'call', driverOp: 'procurement.commit', label: 'seal the procurement commitment', actorId: 'principal:procurement-lead', route: 'public-api', input: {}, expect: 'ok' },
      { stepId: 'step:procurement-order', kind: 'call', driverOp: 'procurement.order', label: 'seal + admit the purchase order', actorId: 'principal:procurement-lead', route: 'public-api', input: {}, expect: 'ok' },
      // -- The W038 execution tracking (Realize, both domains).
      { stepId: 'step:tracking-open', kind: 'call', driverOp: 'tracking.open', label: 'open the execution tracking store over the program index', actorId: 'principal:delivery-lead', route: 'public-api', input: {}, expect: 'ok' },
      { stepId: 'step:field-observe-excavation', kind: 'call', driverOp: 'field.observe-excavation', label: 'intake the excavation field observation (construction)', actorId: 'principal:field-engineer', route: 'public-api', input: {}, expect: 'ok' },
      { stepId: 'step:field-observe-deploy', kind: 'call', driverOp: 'field.observe-deploy', label: 'intake the staging-deploy observation + release tracking state (software)', actorId: 'principal:platform-engineer', route: 'public-api', input: {}, expect: 'ok' },
      { stepId: 'step:issue-record', kind: 'call', driverOp: 'issue.record', label: 'record the change record (the variance attribution cause)', actorId: 'principal:field-engineer', route: 'public-api', input: {}, expect: 'ok' },
      // -- The observation intake through the W036 AUTHORITY path.
      { stepId: 'step:delivery-record-excavation', kind: 'call', driverOp: 'delivery.record-excavation', label: 'record the excavation observation into the SHARED delivery', actorId: 'principal:field-engineer', route: 'public-api', input: {}, expect: 'ok' },
      { stepId: 'step:delivery-record-deploy', kind: 'call', driverOp: 'delivery.record-deploy', label: 'record the staging-deploy observation into the SHARED delivery', actorId: 'principal:platform-engineer', route: 'public-api', input: {}, expect: 'ok' },
      { stepId: 'step:delivery-record-receipt', kind: 'call', driverOp: 'delivery.record-receipt', label: 'record the steel receipt observation (procurement -> delivery)', actorId: 'principal:field-engineer', route: 'public-api', input: {}, expect: 'ok' },
      { stepId: 'step:procurement-receive', kind: 'call', driverOp: 'procurement.receive', label: 'append the supplier delivery transitions through the receipt', actorId: 'principal:procurement-lead', route: 'public-api', input: {}, expect: 'ok' },
      // -- The SHARED W039 actualization fold.
      { stepId: 'step:actualization-intake', kind: 'call', driverOp: 'actualization.intake', label: 'intake all three observations into the SHARED fold', actorId: 'principal:delivery-lead', route: 'public-api', input: {}, expect: 'ok' },
      { stepId: 'step:actualization-assess', kind: 'call', driverOp: 'actualization.assess', label: 'assess the validation groups', actorId: 'principal:chief-engineer', route: 'public-api', input: {}, expect: 'ok' },
      { stepId: 'step:actualization-apply', kind: 'call', driverOp: 'actualization.apply', label: 'apply the actualization fold (the only bridge to delivery actuals)', actorId: 'principal:chief-engineer', route: 'public-api', input: {}, expect: 'ok' },
      // -- The W027 backlog projection over the shared post-actualization delivery.
      {
        stepId: 'step:projection-backlog',
        kind: 'call',
        driverOp: 'projection.backlog',
        label: 'the W027 backlog projection over the SHARED delivery (cross-pack)',
        actorId: 'principal:platform-engineer',
        route: 'public-api',
        input: {},
        expect: 'ok',
      },
      {
        stepId: 'step:assert-backlog-identity',
        kind: 'assert',
        invariant: 'identity-preservation',
        label: 'the backlog epics/issues identity-map the program work-packages/activities (cross-pack)',
        argument: { canonicalSurface: 'program-activities', projectionSurfaces: ['backlog-issues'] },
        expect: 'satisfied',
      },
      // -- W006 evidence + the SHARED variance computation.
      { stepId: 'step:evidence-add', kind: 'call', driverOp: 'evidence.add', label: 'add the field-measurement evidence record', actorId: 'principal:field-engineer', route: 'public-api', input: {}, expect: 'ok' },
      { stepId: 'step:variance-baseline-record', kind: 'call', driverOp: 'variance.baseline-record', label: 'seal the baseline distinction record (the variance baseline)', actorId: 'principal:delivery-lead', route: 'public-api', input: {}, expect: 'ok' },
      {
        stepId: 'step:variance-compute-excavation',
        kind: 'call',
        driverOp: 'variance.compute-excavation',
        label: 'compute + admit the CONSTRUCTION variance (excavation quantity)',
        actorId: 'principal:delivery-lead',
        route: 'public-api',
        input: {},
        expect: 'ok',
      },
      {
        stepId: 'step:variance-compute-deploy',
        kind: 'call',
        driverOp: 'variance.compute-deploy',
        label: 'compute + admit the SOFTWARE variance (staging deploy) into the SAME ledger',
        actorId: 'principal:platform-engineer',
        route: 'public-api',
        input: {},
        expect: 'ok',
      },
      {
        stepId: 'step:variance-attribute',
        kind: 'call',
        driverOp: 'variance.attribute',
        label: 'attribute the excavation variance to the real change record',
        actorId: 'principal:delivery-lead',
        route: 'public-api',
        input: {},
        expect: 'ok',
      },
      // -- The supervision-visible fold (cross-surface agreement).
      {
        stepId: 'step:supervision-fold',
        kind: 'call',
        driverOp: 'supervision.fold',
        label: 'fold the supervision-visible state (both domains agree)',
        actorId: 'principal:delivery-lead',
        route: 'public-api',
        input: {},
        expect: 'ok',
      },
      // -- Recovery: replay, tamper detection, verified-prefix continuation.
      {
        stepId: 'step:recovery-replay',
        kind: 'call',
        driverOp: 'recovery.replay',
        label: 'replay the lifecycle stream from scratch (verified fold)',
        actorId: 'principal:delivery-lead',
        route: 'public-api',
        input: {},
        expect: 'ok',
      },
      {
        stepId: 'step:recovery-tamper',
        kind: 'call',
        driverOp: 'recovery.tamper',
        label: 'tamper a mid-stream record: the log REFUSES the append (typed digest-mismatch)',
        actorId: 'principal:delivery-lead',
        route: 'direct-write-attempt',
        input: { tamperIndex: RECOVERY_TAMPER_INDEX },
        expect: 'authority-rejected',
        expectedErrorCode: 'digest-mismatch',
      },
      {
        stepId: 'step:recovery-prefix-continue',
        kind: 'call',
        driverOp: 'recovery.prefix-continue',
        label: 'continue from the VERIFIED PREFIX (byte-identical prefix state)',
        actorId: 'principal:delivery-lead',
        route: 'public-api',
        input: { tamperIndex: RECOVERY_TAMPER_INDEX },
        expect: 'ok',
      },
      // -- The negatives: cross-tenant denial + authority-bypass rejection.
      {
        stepId: 'step:delivery-observe-foreign',
        kind: 'call',
        driverOp: 'delivery.observe-foreign',
        label: 'a foreign-tenant observation is DENIED at the delivery intake (R12)',
        actorId: 'principal:initech-agent',
        route: 'cross-tenant-attempt',
        input: {},
        expect: 'denied',
        expectedErrorCode: 'cross-tenant-denied',
      },
      {
        stepId: 'step:baseline-revise',
        kind: 'call',
        driverOp: 'baseline.revise',
        label: 'a baseline revision attempt is REJECTED (the baseline is immutable)',
        actorId: 'principal:delivery-lead',
        route: 'direct-write-attempt',
        input: {},
        expect: 'authority-rejected',
        expectedErrorCode: 'baseline-mutation-rejected',
      },
    ],
    identityMap: [
      { canonicalId: LINE_EXCAVATION, surfaces: ['solution-lines', 'boq-line-items', 'delivery-link-lines'], note: 'the construction excavation line across solution, BOQ and delivery links' },
      { canonicalId: LINE_STEEL, surfaces: ['solution-lines', 'boq-line-items', 'delivery-link-lines', 'acquisition-lines'], note: 'the construction steel line across solution, BOQ, delivery links and procurement' },
      { canonicalId: LINE_CHECKOUT_UI, surfaces: ['solution-lines', 'boq-line-items', 'delivery-link-lines'], note: 'the software checkout line across solution, BOQ (preliminaries) and delivery links' },
      { canonicalId: MILESTONE_FOUNDATIONS, surfaces: ['program-milestones', 'roadmap-releases'], note: 'the construction milestone across the program and the W027 roadmap' },
      { canonicalId: MILESTONE_STAGING_RELEASE, surfaces: ['program-milestones', 'roadmap-releases'], note: 'the software milestone across the program and the W027 roadmap' },
      { canonicalId: ACTIVITY_EXCAVATION, surfaces: ['program-activities', 'programme-activities', 'backlog-issues'], note: 'the construction activity across the program, the W026 programme and the W027 backlog' },
      { canonicalId: ACTIVITY_DEPLOY_STAGING, surfaces: ['program-activities', 'programme-activities', 'backlog-issues'], note: 'the software activity across the program, the W026 programme and the W027 backlog' },
      { canonicalId: WORK_PACKAGE_SITEWORKS, surfaces: ['program-work-packages', 'backlog-epics'], note: 'the construction work-package across the program and the W027 backlog epics' },
      { canonicalId: WORK_PACKAGE_RELEASE, surfaces: ['program-work-packages', 'backlog-epics'], note: 'the software work-package across the program and the W027 backlog epics' },
    ],
    invariants: [
      { invariant: 'tenant-isolation', note: 'the cross-tenant denial is recorded in-trace with both tenants' },
      { invariant: 'provenance-chain', note: 'every digest-bearing record recomputes + chains' },
      { invariant: 'authority-routing', note: 'direct writes are rejected with typed codes and no state delta' },
      { invariant: 'identity-preservation', note: 'both packs identity-map the same ProgramOfWork lines' },
      { invariant: 'scenario-round-trip' },
      { invariant: 'replay-determinism' },
    ],
  };
}
