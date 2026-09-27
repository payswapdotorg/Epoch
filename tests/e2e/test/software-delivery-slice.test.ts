// W031 Reference E2E slice 2 — SOFTWARE DELIVERY.
//
// The named E2E test for the software path (scenario definition:
// examples/e2e/scenarios/software-delivery.ts). Named invariants:
//
//   1. roadmap milestone ids ARE canonical ProgramOfWork ids (releaseId
//      === milestoneId, never minted)
//   2. backlog identity is canonical (epics = workPackageId, issues =
//      activityId, observation/actual links carried by id)
//   3. execution events chain + verify (the W038 realization stream)
//   4. the actualization fold drives the W036 authority path
//   5. forecast revisions are APPEND-ONLY (prior digest intact; each
//      revision refines the exact digest of its predecessor; an
//      out-of-lineage refinement is the typed forecast-overwrite)
//   6. cross-tenant intake is denied (R12)
//   7. determinism + round-trip
import { describe, expect, it } from 'vitest';
import { admitForecastRevision, rollForecast } from '@epoch/actualization';
import {
  recordObservation,
  sealDistinctionRecord,
  verifySealedDistinctionRecord,
} from '@epoch/solution-delivery';
import { verifySealedExecutionEvent } from '@epoch/execution-tracking';
import {
  FORECAST_R1_ID,
  MILESTONE_PRODUCTION,
  MILESTONE_STAGING,
  SOFTWARE_ACTUAL_ID,
  SOFTWARE_DELIVERY_ID,
  SOFTWARE_OBSERVATION_ID,
  WORK_PACKAGE_RELEASE,
  runSoftwareDeliveryScenario,
  softwareDeliveryDigestProjection,
} from '../../../examples/e2e/scenarios/software-delivery';
import { OTHER_TENANT, TENANT } from '../../../examples/e2e/scenarios/shared';
import {
  expectCrossTenantDenied,
  expectError,
  expectRoundTrip,
  expectScenarioDeterministic,
  unwrap,
} from './helpers';

describe('software-delivery-slice', () => {
  const { first: scenario } = expectScenarioDeterministic(
    runSoftwareDeliveryScenario,
    softwareDeliveryDigestProjection,
    'software-delivery',
  );

  it('roadmap milestone ids ARE canonical ProgramOfWork ids (identity-pinned releases)', () => {
    expect(scenario.roadmap.releases.length).toBeGreaterThanOrEqual(2);
    for (const release of scenario.roadmap.releases) {
      expect(release.releaseId, 'the release id IS the milestone id (never minted)').toBe(release.milestoneId);
    }
    const releaseIds = scenario.roadmap.releases.map((release) => release.releaseId).sort();
    const programMilestoneIds = scenario.program.milestones.map((milestone) => milestone.milestoneId).sort();
    expect(releaseIds).toEqual(programMilestoneIds);
    expect(releaseIds).toEqual([MILESTONE_PRODUCTION, MILESTONE_STAGING]);
    // The staging release SHIPPED (the universal 'reached' status, software term).
    const staging = scenario.roadmap.releases.find((release) => release.releaseId === MILESTONE_STAGING);
    expect(staging?.status).toBe('reached');
    expect(staging?.statusTerm).toBe('Shipped');
  });

  it('backlog identity is canonical and links the delivery facts by id', () => {
    const epicIds = scenario.backlog.epics.map((epic) => epic.workPackageId).sort();
    const programPackageIds = scenario.program.workPackages.map((workPackage) => workPackage.workPackageId).sort();
    expect(epicIds).toEqual(programPackageIds);
    // The release-rollout issue row links the observation + actual by id.
    const releaseIssue = scenario.backlog.issues.find((issue) => issue.activityId === 'activity:deploy-staging');
    expect(releaseIssue).toBeDefined();
    expect(releaseIssue?.observationIds).toEqual([SOFTWARE_OBSERVATION_ID]);
    expect(releaseIssue?.actualIds).toEqual([SOFTWARE_ACTUAL_ID]);
  });

  it('execution events chain + verify (the W038 realization stream)', () => {
    const events = scenario.executionEvents;
    expect(events.length).toBe(2);
    for (const [index, event] of events.entries()) {
      expect(event.sequence).toBe(index + 1);
      unwrap(verifySealedExecutionEvent(event), 'execution event verification');
    }
    expect(events[1]?.causalParent).toEqual({ streamId: events[1]?.streamId, sequence: 1 });
  });

  it('the actualization fold drives the W036 authority path (actual inherits observation identity)', () => {
    const actual = scenario.delivery.actuals.find((record) => record.recordId === SOFTWARE_ACTUAL_ID);
    expect(actual).toBeDefined();
    expect((actual?.payload as { derivedFromObservationId: string }).derivedFromObservationId).toBe(
      SOFTWARE_OBSERVATION_ID,
    );
    for (const record of scenario.delivery.actuals) {
      unwrap(verifySealedDistinctionRecord(record), 'actual verification');
    }
  });

  it('forecast revisions are APPEND-ONLY (prior digest intact, exact-revision refinement)', () => {
    // r2 refines r1's EXACT digest...
    expect((scenario.forecastR2.record.payload as { refines: string | null }).refines).toBe(FORECAST_R1_ID);
    // ...the ledger holds BOTH revisions (append-only: the prior digest
    // is never rewritten)...
    expect(scenario.forecastLedger.records.map((record) => record.recordId).sort()).toEqual([
      FORECAST_R1_ID,
      'forecast:checkout-release-r2',
    ]);
    expect(
      scenario.forecastLedger.records.find((record) => record.recordId === FORECAST_R1_ID)?.contentDigest,
    ).toBe(scenario.forecastR1.record.contentDigest);
    // ...and the rolling math is the exact decimal fold.
    expect(scenario.forecastR1.remaining).toBe('6');
    expect(scenario.forecastR1.atCompletion).toBe('24');
    expect(scenario.forecastR2.atCompletion).toBe('27');
    // A revision refining a MISSING forecast is the typed
    // forecast-overwrite-rejected (never a silent overwrite).
    const orphan = unwrap(
      rollForecast({
        recordId: 'forecast:checkout-release-orphan',
        tenantId: TENANT,
        subject: {
          solutionId: scenario.solution.solutionId,
          subjectKind: 'work-package',
          subjectId: WORK_PACKAGE_RELEASE,
        },
        planned: { kind: 'quantity', value: '24', unit: 'deliverable' },
        actualsToDate: { kind: 'quantity', value: '18', unit: 'deliverable' },
        asOf: '2026-05-04T16:00:00.000Z',
        refines: { recordId: 'forecast:does-not-exist', contentDigest: '0'.repeat(64) },
        recordedAt: '2026-05-04T16:00:00.000Z',
        recordedBy: 'principal:platform-engineer',
        uncertainty: scenario.forecastR1.record.uncertainty,
      }),
      'roll orphan forecast',
    );
    const ledger = {
      tenantId: TENANT,
      solutionId: scenario.solution.solutionId,
      records: [scenario.forecastR1.record, scenario.forecastR2.record],
    };
    expectError(admitForecastRevision(ledger, orphan.record), 'forecast-overwrite-rejected', 'orphan refinement');
  });

  it('a cross-tenant observation is DENIED at the delivery intake (R12)', () => {
    const foreign = unwrap(
      sealDistinctionRecord({
        schema: 'epoch.solution-delivery.distinction-record',
        schemaVersion: 1,
        kind: 'observation',
        recordId: 'observation:foreign-deploy-progress',
        tenantId: OTHER_TENANT,
        subject: {
          solutionId: scenario.solution.solutionId,
          subjectKind: 'work-package',
          subjectId: WORK_PACKAGE_RELEASE,
        },
        measure: { kind: 'quantity', value: '1', unit: 'deliverable' },
        payload: {
          deliveryId: SOFTWARE_DELIVERY_ID,
          observedAt: '2026-05-04T16:00:00.000Z',
          observedBy: 'principal:platform-engineer',
          evidence: [],
        },
        recordedAt: '2026-05-04T16:00:00.000Z',
        recordedBy: 'principal:platform-engineer',
        uncertainty: scenario.delivery.observations[0]?.uncertainty,
      }),
      'seal foreign observation',
    );
    expectCrossTenantDenied(
      recordObservation(scenario.delivery, foreign),
      TENANT,
      OTHER_TENANT,
      'delivery observation intake',
    );
  });

  it('the scenario projection round-trips (serializes + digest-verifies)', () => {
    const projection = softwareDeliveryDigestProjection(scenario);
    const digest = expectRoundTrip(projection, 'software-delivery projection');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});
