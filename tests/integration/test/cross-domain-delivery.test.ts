// W032 — the POSITIVE cross-domain evidence: one solution, BOTH packs,
// SHARED delivery/actualization/variance — identity mapping asserted
// end-to-end (the Work Order's core acceptance criterion).
import { describe, expect, it } from 'vitest';
import {
  foldDeliveryActuals,
  verifySealedDeliveryRecord,
  verifySealedProgramOfWork,
} from '@epoch/solution-delivery';
import { foldSupplierDelivery } from '@epoch/procurement';
import { foldVarianceSummary } from '@epoch/variance';
import { runScenario } from '@epoch/test-harness';
import {
  ACTIVITY_DEPLOY_STAGING,
  ACTIVITY_EXCAVATION,
  DEPLOY_ACTUAL_ID,
  EXCAVATION_ACTUAL_ID,
  LINE_CHECKOUT_UI,
  LINE_EXCAVATION,
  LINE_STEEL,
  MILESTONE_FOUNDATIONS,
  MILESTONE_STAGING_RELEASE,
  RECEIPT_ACTUAL_ID,
  VARIANCE_DEPLOY_ID,
  VARIANCE_EXCAVATION_ID,
  WORK_PACKAGE_RELEASE,
  WORK_PACKAGE_SITEWORKS,
} from '../scenarios/shared';
import { crossDomainDeliveryScenario } from '../scenarios/cross-domain-delivery';
import { crossDomainDriver, latestWorld } from '../scenarios/cross-domain-driver';

describe('cross-domain-delivery (positive)', () => {
  const run = runScenario(crossDomainDeliveryScenario(), crossDomainDriver);
  expect(run.ok).toBe(true);
  if (!run.ok) {
    throw new Error('the cross-domain scenario failed to run');
  }
  const world = latestWorld();

  it('the scenario result is PASS with every invariant satisfied', () => {
    expect(run.value.result.passed).toBe(true);
    const byInvariant = new Map(run.value.result.invariantResults.map((finding) => [finding.invariant, finding]));
    expect(byInvariant.get('identity-preservation')?.satisfied).toBe(true);
    expect(byInvariant.get('provenance-chain')?.satisfied).toBe(true);
    expect(byInvariant.get('trace-integrity')?.satisfied).toBe(true);
    expect(byInvariant.get('expectation-conformance')?.satisfied).toBe(true);
  });

  it('ONE solution carries BOTH domain packs\' work-packages in ONE ProgramOfWork', () => {
    expect(world.solution?.solutionLines.map((line) => line.lineId).sort()).toEqual([
      LINE_EXCAVATION,
      LINE_CHECKOUT_UI,
      LINE_STEEL,
    ]);
    expect(world.program?.workPackages.map((pkg) => pkg.workPackageId).sort()).toEqual([
      WORK_PACKAGE_RELEASE,
      WORK_PACKAGE_SITEWORKS,
    ]);
    // The realization variants cross the two packs inside the same program.
    const variants = new Set(world.program?.workPackages.map((pkg) => pkg.realizationVariant));
    expect(variants.has('construction-build')).toBe(true);
    expect(variants.has('software-implementation-deployment')).toBe(true);
    expect(verifySealedProgramOfWork(world.program!)).toEqual({ ok: true, value: world.program });
  });

  it('the W026 BOQ line items identity-map the solution plan lines (ALL lines, both domains)', () => {
    expect(world.boq?.lineItems.map((item) => item.lineId).sort()).toEqual(
      world.solution?.solutionLines.map((line) => line.lineId).sort(),
    );
    // The software line lands in the deterministic preliminaries section
    // (unbound to a construction concept) — projected, never dropped.
    const checkoutItem = world.boq?.lineItems.find((item) => item.lineId === LINE_CHECKOUT_UI);
    expect(checkoutItem).toBeDefined();
  });

  it('the W027 roadmap releases identity-map the SAME program milestones (cross-pack consistency)', () => {
    expect(world.roadmap?.releases.map((release) => release.releaseId).sort()).toEqual(
      world.program?.milestones.map((milestone) => milestone.milestoneId).sort(),
    );
    expect(world.roadmap?.releases.map((release) => release.releaseId).sort()).toEqual([
      MILESTONE_FOUNDATIONS,
      MILESTONE_STAGING_RELEASE,
    ]);
  });

  it('the W026 construction programme identity-maps the SAME program activities', () => {
    expect(world.programme?.activities.map((activity) => activity.activityId).sort()).toEqual(
      world.program?.workPackages.flatMap((pkg) => pkg.activities.map((activity) => activity.activityId)).sort(),
    );
  });

  it('the W027 backlog identity-maps the SAME program work-packages (epics) and activities (issues) over the SHARED delivery', () => {
    expect(world.backlog?.epics.map((epic) => epic.workPackageId).sort()).toEqual([
      WORK_PACKAGE_RELEASE,
      WORK_PACKAGE_SITEWORKS,
    ]);
    expect(world.backlog?.issues.map((issue) => issue.activityId).sort()).toEqual(
      world.program?.workPackages.flatMap((pkg) => pkg.activities.map((activity) => activity.activityId)).sort(),
    );
  });

  it('ONE SHARED delivery record carries BOTH domains\' observations AND actuals', () => {
    expect(world.delivery?.observations.map((observation) => observation.recordId).sort()).toEqual([
      'observation:field-pit-progress-monday',
      'observation:field-staging-deploy-monday',
      'observation:steel-receipt',
    ]);
    expect(world.delivery?.actuals.map((actual) => actual.recordId).sort()).toEqual([
      EXCAVATION_ACTUAL_ID,
      DEPLOY_ACTUAL_ID,
      RECEIPT_ACTUAL_ID,
    ]);
    expect(world.delivery?.acceptedObservationIds.sort()).toHaveLength(3);
    expect(verifySealedDeliveryRecord(world.delivery!)).toEqual({ ok: true, value: world.delivery });
  });

  it('the SHARED actualization fold minted actuals for BOTH domains (identity inheritance)', () => {
    const excavationActual = world.delivery?.actuals.find((actual) => actual.recordId === EXCAVATION_ACTUAL_ID);
    expect((excavationActual?.payload as { derivedFromObservationId?: string }).derivedFromObservationId).toBe(
      'observation:field-pit-progress-monday',
    );
    const deployActual = world.delivery?.actuals.find((actual) => actual.recordId === DEPLOY_ACTUAL_ID);
    expect((deployActual?.payload as { derivedFromObservationId?: string }).derivedFromObservationId).toBe(
      'observation:field-staging-deploy-monday',
    );
    // Both domains' subjects appear in the actuals fold.
    const totals = foldDeliveryActuals(world.delivery!).totals;
    const excavationTotal = totals.find(
      (total) => total.subjectId === ACTIVITY_EXCAVATION && total.measureKind === 'quantity',
    );
    const deployTotal = totals.find(
      (total) => total.subjectId === ACTIVITY_DEPLOY_STAGING && total.measureKind === 'quantity',
    );
    expect(excavationTotal?.total).toBe('118.5');
    expect(deployTotal?.total).toBe('18');
  });

  it('the SHARED variance ledger carries BOTH domains\' variances, computed against the SAME spine', () => {
    expect(world.variances.map((variance) => variance.varianceId).sort()).toEqual([
      VARIANCE_EXCAVATION_ID,
      VARIANCE_DEPLOY_ID,
    ]);
    const excavation = world.variances.find((variance) => variance.varianceId === VARIANCE_EXCAVATION_ID)!;
    const deploy = world.variances.find((variance) => variance.varianceId === VARIANCE_DEPLOY_ID)!;
    // 120 planned vs 118.5 actual = 1.5 adverse (minor); 24 vs 18 = 6 adverse (minor).
    expect(excavation.magnitude).toBe('1.5');
    expect(excavation.direction).toBe('adverse');
    expect(excavation.band).toBe('minor');
    expect(deploy.magnitude).toBe('6');
    expect(deploy.direction).toBe('adverse');
    expect(deploy.band).toBe('minor');
    // ONE summary over BOTH domains' variances.
    expect(foldVarianceSummary(world.varianceLedger!)).toEqual([
      { varianceClass: 'quantity', direction: 'adverse', band: 'minor', count: 2, totalMagnitude: '7.5' },
    ]);
  });

  it('the delivery links carry ONE identity spine across BOTH domains (line -> package -> observation -> actual)', () => {
    const links = world.supervision?.links;
    expect(links?.rows.map((row) => row.solutionLineId).sort()).toEqual([
      LINE_EXCAVATION,
      LINE_CHECKOUT_UI,
      LINE_STEEL,
    ]);
    const excavationRow = links?.rows.find((row) => row.solutionLineId === LINE_EXCAVATION);
    expect(excavationRow?.workPackageIds).toEqual([WORK_PACKAGE_SITEWORKS]);
    expect(excavationRow?.observationIds).toContain('observation:field-pit-progress-monday');
    expect(excavationRow?.actualIds).toContain(EXCAVATION_ACTUAL_ID);
    const checkoutRow = links?.rows.find((row) => row.solutionLineId === LINE_CHECKOUT_UI);
    expect(checkoutRow?.workPackageIds).toEqual([WORK_PACKAGE_RELEASE]);
    expect(checkoutRow?.observationIds).toContain('observation:field-staging-deploy-monday');
    expect(checkoutRow?.actualIds).toContain(DEPLOY_ACTUAL_ID);
  });

  it('the supplier delivery fold agrees with the receipt observation (W037 -> W036 identity)', () => {
    const supplier = foldSupplierDelivery(world.supplierDelivery!);
    expect(supplier.state).toBe('received');
    expect(supplier.receiptCount).toBe(1);
  });

  it('supervision-visible folds agree across W036/W038/W039 for BOTH domains', () => {
    const supervision = world.supervision!;
    // The actualization projection corroborated over all three groups.
    expect(supervision.actualizationState.observationCounts.total).toBe(3);
    expect(supervision.actualizationState.deliveryDigest).toBe(world.delivery?.contentDigest);
    for (const group of supervision.actualizationState.validationGroups) {
      expect(['corroborated', 'resolved']).toContain(group.state);
    }
    // The execution projection: both work-packages tracked, release in progress.
    const release = supervision.executionState.workPackages.find((pkg) => pkg.workPackageId === WORK_PACKAGE_RELEASE);
    expect(release?.workPackageState).toBe('in-progress');
    const siteWorks = supervision.executionState.workPackages.find((pkg) => pkg.workPackageId === WORK_PACKAGE_SITEWORKS);
    expect(siteWorks).toBeDefined();
  });

  it('the trace records the positive path with typed outcomes + state deltas', () => {
    const callEntries = run.value.trace.steps.filter((entry) => entry.kind === 'call');
    expect(callEntries.length).toBe(run.value.scenario.steps.filter((step) => step.kind === 'call').length);
    // The authority-path fold mutates kernel state (a real delta); the
    // assert steps are analysis-only (no delta).
    const applyEntry = run.value.trace.steps.find((entry) => entry.stepId === 'step:actualization-apply');
    expect(applyEntry?.stateDelta).toBe(true); // the authority path mutated delivery state
    const assertEntry = run.value.trace.steps.find((entry) => entry.stepId === 'step:assert-boq-identity');
    expect(assertEntry?.stateDelta).toBe(false); // invariant evaluation: no state change
  });
});
