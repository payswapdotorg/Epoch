// POSITIVE: information-acquisition requests (the decision-sufficiency
// rule) and the Solution Navigator synchronized projections with
// identity-preserving navigation (SN1.0).
import { describe, expect, it } from 'vitest';
import {
  admitInformationAcquisitionRequest,
  isMaterialDecisionImpact,
  navigateFromWorldEntity,
  navigatorChainIdentities,
  projectNavigator,
  admitDistinctionRecord,
  sealDistinctionRecord,
  acceptObservation,
  actualizeObservation,
  recordObservation,
} from '../src/index';
import {
  baselineApproval,
  distinctionContents,
  emptyLedger,
  observationContent,
  openedDelivery,
  sealedObservation,
  sealedProgram,
  sealedV1,
  sealedV2,
  T4,
  T5,
} from './fixtures';

describe('information-acquisition requests (decision-sufficiency rule)', () => {
  it('admits a material request tied to a decision impact', () => {
    const admitted = admitInformationAcquisitionRequest({
      schema: 'epoch.solution-delivery.info-request',
      schemaVersion: 1,
      requestId: 'info-request:soil-bearing',
      tenantId: 'tenant:globex',
      solutionId: 'solution:tower-retrofit',
      requestedInformation: 'Soil bearing capacity under footing F2',
      decisionImpact: {
        stage: 'decide',
        decisionKind: 'solution-selection',
        materiality: 'material',
        rationale: 'Changes the feasible bracing alternatives',
      },
      freshnessRequirement: { state: 'fresh', assessedAt: T4 },
      requestedFrom: 'external:geotech-lab',
      issuedAt: T4,
      issuedBy: 'principal:delivery-lead',
      status: 'open',
    });
    expect(admitted.ok).toBe(true);
    if (admitted.ok) {
      expect(isMaterialDecisionImpact(admitted.value.decisionImpact)).toBe(true);
    }
  });

  it('an immaterial unknown stays preserved (no request issued)', () => {
    const material = isMaterialDecisionImpact({
      stage: 'learn',
      decisionKind: 'cost-basis',
      materiality: 'immaterial',
      rationale: 'Cannot change the decision outcome',
    });
    expect(material).toBe(false);
  });

  it('a fulfilled request carries its evidence and uncertainty', () => {
    const admitted = admitInformationAcquisitionRequest({
      schema: 'epoch.solution-delivery.info-request',
      schemaVersion: 1,
      requestId: 'info-request:soil-bearing',
      tenantId: 'tenant:globex',
      solutionId: 'solution:tower-retrofit',
      requestedInformation: 'Soil bearing capacity under footing F2',
      decisionImpact: {
        stage: 'decide',
        decisionKind: 'solution-selection',
        materiality: 'material',
        rationale: 'Changes the feasible bracing alternatives',
      },
      issuedAt: T4,
      issuedBy: 'principal:delivery-lead',
      status: 'fulfilled',
      fulfillment: {
        evidence: [{ digest: 'a'.repeat(64) }],
        fulfilledAt: T5,
        fulfilledBy: 'principal:geotech-lab',
        uncertainty: {
          schemaVersion: 1,
          provenance: { kind: 'imported', sourceRef: 'external:geotech-lab' },
          freshness: { state: 'fresh', assessedAt: T5 },
          confidence: { method: 'measured', value: 0.95 },
        },
      },
    });
    expect(admitted.ok).toBe(true);
  });
});

describe('Solution Navigator projections (SN1.0)', () => {
  it('projects the synchronized views over the same identities', () => {
    const v1 = sealedV1();
    const v2 = sealedV2(v1);
    const program = sealedProgram(v1);
    const projected = projectNavigator({
      solutionChain: [v1, v2],
      approvals: [baselineApproval(v1)],
      program,
    });
    expect(projected.ok).toBe(true);
    if (!projected.ok) return;
    expect(projected.value.headVersion).toBe('1.1.0');
    expect(projected.value.baselineApproved).toBe(false); // approval targets v1, not head v2
    expect(projected.value.worldView).toHaveLength(2);
    expect(projected.value.programOfWork).toHaveLength(1);
    expect(projected.value.schedule.quantity.totals).toEqual([
      { unit: 'm3', totalValue: '120' },
      { unit: 'tonne', totalValue: '4' },
    ]);
    expect(projected.value.realization.counts['construction-build']).toBe(1);
  });

  it('projects with incomplete inputs (partial-data behavior)', () => {
    const v1 = sealedV1();
    const projected = projectNavigator({ solutionChain: [v1] });
    expect(projected.ok).toBe(true);
    if (!projected.ok) return;
    expect(projected.value.programOfWork).toEqual([]);
    expect(projected.value.observations).toEqual([]);
    expect(projected.value.schedule.quantity.rows).toEqual([]);
  });

  it('baseline approval of the head marks the projection approved', () => {
    const v1 = sealedV1();
    const projected = projectNavigator({
      solutionChain: [v1],
      approvals: [baselineApproval(v1)],
    });
    expect(projected.ok).toBe(true);
    if (!projected.ok) return;
    expect(projected.value.baselineApproved).toBe(true);
  });
});

describe('identity-preserving navigation (SN1.0 canonical chain)', () => {
  it('traverses world entity -> solution line -> work package -> activity -> observation -> actual -> verification -> outcome without duplicates', () => {
    const v1 = sealedV1();
    const program = sealedProgram(v1);
    // Delivery: one observation on activity:excavate, accepted + actualized.
    let delivery = openedDelivery(v1);
    const observation = sealedObservation();
    const recorded = recordObservation(delivery, observation);
    expect(recorded.ok).toBe(true);
    if (!recorded.ok) return;
    delivery = recorded.value;
    const accepted = acceptObservation(delivery, 'observation:pit-volume', {
      acceptedBy: 'principal:delivery-lead',
      acceptedAt: T4,
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    delivery = accepted.value;
    const actualized = actualizeObservation(delivery, 'observation:pit-volume', {
      actualId: 'actual:pit-volume',
      actualizedBy: 'principal:delivery-lead',
      actualizedAt: T5,
    });
    expect(actualized.ok).toBe(true);
    if (!actualized.ok) return;
    delivery = actualized.value;

    // Ledger: one outcome on the solution + one learning.
    const outcome = sealDistinctionRecord(distinctionContents().outcome);
    const learning = sealDistinctionRecord(distinctionContents().learning);
    expect(outcome.ok && learning.ok).toBe(true);
    if (!outcome.ok || !learning.ok) return;
    let ledger = emptyLedger();
    const withOutcome = admitDistinctionRecord(ledger, outcome.value);
    expect(withOutcome.ok).toBe(true);
    if (!withOutcome.ok) return;
    ledger = withOutcome.value;
    const withLearning = admitDistinctionRecord(ledger, learning.value);
    expect(withLearning.ok).toBe(true);
    if (!withLearning.ok) return;
    ledger = withLearning.value;

    const projected = projectNavigator({
      solutionChain: [v1],
      approvals: [baselineApproval(v1)],
      program,
      delivery,
      ledger,
    });
    expect(projected.ok).toBe(true);
    if (!projected.ok) return;

    // The canonical chain from the world entity 'site-tower-a':
    const chain = navigateFromWorldEntity(projected.value, 'site-tower-a');
    expect(chain.solutionLineIds).toEqual(['line:earthworks']);
    expect(chain.workPackageIds).toEqual(['work-package:earthworks']);
    expect(chain.activityIds).toEqual(['activity:brace-frame', 'activity:excavate']);
    expect(chain.observationIds).toEqual(['observation:pit-volume']);
    expect(chain.actualIds).toEqual(['actual:pit-volume']);
    expect(chain.gateIds).toEqual(['gate:excavation-check']);
    expect(chain.outcomeIds).toEqual(['outcome:tower-delivered']);

    // IDENTITY PRESERVATION: every identity appears exactly once.
    const identities = navigatorChainIdentities(chain);
    expect(new Set(identities).size).toBe(identities.length);
    expect(identities).toContain('world:site-tower-a');
    expect(identities).toContain('actual:pit-volume');

    // The second world entity reaches the structural line but not the
    // earthworks observation chain:
    const other = navigateFromWorldEntity(projected.value, 'site-tower-b');
    expect(other.solutionLineIds).toEqual(['line:structure']);
    expect(other.workPackageIds).toEqual([]); // no work package links to line:structure
    expect(other.observationIds).toEqual([]);
  });

  it('the observation view carries the review state (accepted)', () => {
    const v1 = sealedV1();
    let delivery = openedDelivery(v1);
    const recorded = recordObservation(delivery, sealedObservation());
    if (!recorded.ok) return;
    delivery = recorded.value;
    const projected = projectNavigator({ solutionChain: [v1], delivery });
    if (!projected.ok) return;
    expect(projected.value.observations[0]!.accepted).toBe(false);
    expect(projected.value.observations[0]!.subjectId).toBe('activity:excavate');
    void observationContent;
  });
});
