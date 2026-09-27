// DETERMINISM — identical inputs derive identical digests at every
// layer: observation intake, assessment derivation, authority-path
// application, rolling forecasts, calibration folds, and the derived
// state projection. Intake order never leaks.
import { describe, expect, it } from 'vitest';
import {
  admitConflictResolution,
  applyActualization,
  currentAssessments,
  intakeObservation,
  openActualizationStore,
  projectActualizationState,
  rollForecast,
  sealConflictResolution,
  admitComparisonFact,
  foldComparisonFacts,
  sealComparisonFact,
  foldCalibration,
  sealLineageEdge,
  admitLineageEdge,
  openLineageStore,
  traceLineageForward,
} from '../src/index';
import { unwrap } from './helpers';
import {
  ACTIVITY_ID,
  ACTIVITY_ID_2,
  DELIVERY_ID,
  SOLUTION_ID,
  TENANT,
  T4,
  T5,
  comparisonFactContent,
  conflictingObservations,
  corroboratingObservations,
  costObservation,
  lineageEdgeContent,
  openedDelivery,
  progressObservations,
  uncertainty,
} from './fixtures';

describe('end-to-end determinism (identical inputs -> identical digests)', () => {
  it('two stores fed the same observations in DIFFERENT orders derive identical assessments, actuals and projections', () => {
    const observations = [...corroboratingObservations(), costObservation(), ...progressObservations()];
    const build = (order: typeof observations): { assessmentDigests: string[]; deliveryDigest: string } => {
      let store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
      for (const observation of order) {
        store = unwrap(intakeObservation(store, observation)).store;
      }
      const assessments = unwrap(currentAssessments(store, { mode: 'exact' }));
      let delivery = openedDelivery();
      for (const assessment of assessments) {
        delivery = unwrap(
          applyActualization(delivery, assessment, observations, {
            acceptedBy: 'principal:delivery-lead',
            acceptedAt: T4,
            actualizedBy: 'principal:delivery-lead',
            actualizedAt: T5,
          }),
        ).delivery;
      }
      const projection = unwrap(projectActualizationState(store, delivery, { mode: 'exact' }));
      expect(projection.validationGroups.length).toBeGreaterThan(0);
      return {
        assessmentDigests: assessments.map((assessment) => assessment.contentDigest),
        deliveryDigest: delivery.contentDigest,
      };
    };
    const a = build(observations);
    const b = build([...observations].reverse());
    expect(a.assessmentDigests).toEqual(b.assessmentDigests);
    expect(a.deliveryDigest).toBe(b.deliveryDigest);
  });

  it('the resolved-conflict flow is deterministic end-to-end', () => {
    const run = (): { storeDigestFacts: string[]; deliveryDigest: string } => {
      let store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
      const observations = conflictingObservations();
      for (const observation of observations) {
        store = unwrap(intakeObservation(store, observation)).store;
      }
      const policy = { mode: 'exact' as const, foldMode: 'snapshot' as const };
      const assessment = unwrap(currentAssessments(store, policy))[0]!;
      const resolution = unwrap(
        sealConflictResolution({
          schema: 'epoch.actualization.conflict-resolution',
          schemaVersion: 1,
          resolutionId: 'resolution:pit-volume-tuesday-wins',
          tenantId: TENANT,
          solutionId: SOLUTION_ID,
          deliveryId: DELIVERY_ID,
          assessmentRef: { assessmentId: assessment.assessmentId, contentDigest: assessment.contentDigest },
          selectedObservationRefs: [
            {
              recordId: 'observation:pit-volume-tuesday',
              contentDigest: assessment.observationRefs.find((r) => r.recordId === 'observation:pit-volume-tuesday')!
                .contentDigest,
            },
          ],
          excludedObservationRefs: [
            {
              recordId: 'observation:pit-volume-monday',
              contentDigest: assessment.observationRefs.find((r) => r.recordId === 'observation:pit-volume-monday')!
                .contentDigest,
            },
          ],
          resolvedBy: 'principal:delivery-lead',
          resolvedAt: T4,
        }),
      );
      store = unwrap(admitConflictResolution(store, resolution, policy));
      const applied = unwrap(
        applyActualization(
          openedDelivery(),
          assessment,
          observations,
          {
            acceptedBy: 'principal:delivery-lead',
            acceptedAt: T4,
            actualizedBy: 'principal:delivery-lead',
            actualizedAt: T5,
          },
          resolution,
        ),
      );
      return {
        storeDigestFacts: store.comparisonFacts.map((fact) => fact.contentDigest),
        deliveryDigest: applied.delivery.contentDigest,
      };
    };
    const a = run();
    const b = run();
    expect(a.storeDigestFacts).toEqual(b.storeDigestFacts);
    expect(a.deliveryDigest).toBe(b.deliveryDigest);
  });

  it('rolling forecast revisions replay idempotently (same input -> same sealed record)', () => {
    const input = {
      recordId: 'forecast:pit-volume-r1',
      tenantId: TENANT,
      subject: { solutionId: SOLUTION_ID, subjectKind: 'activity' as const, subjectId: ACTIVITY_ID },
      planned: { kind: 'quantity' as const, value: '120', unit: 'm3' },
      actualsToDate: { kind: 'quantity' as const, value: '60', unit: 'm3' },
      performanceFactor: '1.25',
      asOf: T4,
      refines: null,
      recordedAt: T4,
      recordedBy: 'principal:delivery-lead',
      uncertainty: uncertainty(),
    };
    const first = unwrap(rollForecast(input));
    const second = unwrap(rollForecast(input));
    expect(first.record.contentDigest).toBe(second.record.contentDigest);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('calibration folds are order-invariant and deterministic', () => {
    const facts = [
      unwrap(sealComparisonFact(comparisonFactContent())),
      unwrap(
        sealComparisonFact(
          comparisonFactContent({
            factId: 'comparison-fact:pit-volume-f2-a2',
            comparisonRef: { recordId: 'comparison:pit-volume-f2-a2', contentDigest: 'e'.repeat(64) },
            forecastRef: { recordId: 'forecast:pit-volume-r2', contentDigest: 'a'.repeat(64) },
            actualRef: { recordId: 'actual:pit-volume-tuesday', contentDigest: 'b'.repeat(64) },
            forecastMeasure: { kind: 'quantity', value: '110', unit: 'm3' },
            actualMeasure: { kind: 'quantity', value: '115', unit: 'm3' },
            deviation: '5',
            bias: 'under-forecast',
          }),
        ),
      ),
    ];
    const fold = (order: typeof facts): string =>
      unwrap(
        foldCalibration(
          { tenantId: TENANT, solutionId: SOLUTION_ID },
          { solutionId: SOLUTION_ID, subjectKind: 'activity', subjectId: ACTIVITY_ID },
          order,
        ),
      ).contentDigest;
    expect(fold(facts)).toBe(fold([...facts].reverse()));
  });

  it('lineage admission order never leaks into the traversal fold', () => {
    const edges = [
      unwrap(
        sealLineageEdge(
          lineageEdgeContent({
            edgeId: 'lineage:e2',
            from: { kind: 'baseline', recordId: 'baseline:pit-volume-v1', contentDigest: '2'.repeat(64) },
            to: { kind: 'commitment', recordId: 'commitment:pit-volume-supplier', contentDigest: '3'.repeat(64) },
          }),
        ),
      ),
      unwrap(
        sealLineageEdge(
          lineageEdgeContent({
            edgeId: 'lineage:e1',
            from: { kind: 'prediction', recordId: 'prediction:pit-volume', contentDigest: '1'.repeat(64) },
            to: { kind: 'baseline', recordId: 'baseline:pit-volume-v1', contentDigest: '2'.repeat(64) },
          }),
        ),
      ),
    ];
    const build = (order: typeof edges): string => {
      let store = openLineageStore({ tenantId: TENANT, solutionId: SOLUTION_ID });
      for (const edge of order) {
        store = unwrap(admitLineageEdge(store, edge));
      }
      return JSON.stringify(
        traceLineageForward(store, 'prediction:pit-volume').nodes.map((node) => node.recordId),
      );
    };
    expect(build(edges)).toBe(build([...edges].reverse()));
  });

  it('comparison-fact admission order never leaks into the store fold', () => {
    const facts = [
      unwrap(sealComparisonFact(comparisonFactContent())),
      unwrap(
        sealComparisonFact(
          comparisonFactContent({
            factId: 'comparison-fact:pit-volume-f2-a2',
            comparisonRef: { recordId: 'comparison:pit-volume-f2-a2', contentDigest: 'e'.repeat(64) },
            forecastRef: { recordId: 'forecast:pit-volume-r2', contentDigest: 'a'.repeat(64) },
            actualRef: { recordId: 'actual:pit-volume-tuesday', contentDigest: 'b'.repeat(64) },
            forecastMeasure: { kind: 'quantity', value: '110', unit: 'm3' },
            actualMeasure: { kind: 'quantity', value: '115', unit: 'm3' },
            deviation: '5',
            bias: 'under-forecast',
          }),
        ),
      ),
    ];
    const build = (order: typeof facts): string =>
      JSON.stringify(
        (() => {
          let store = openActualizationStore({ tenantId: TENANT, solutionId: SOLUTION_ID, deliveryId: DELIVERY_ID });
          for (const fact of order) {
            store = unwrap(admitComparisonFact(store, fact));
          }
          return foldComparisonFacts(store).map((fact) => fact.factId);
        })(),
      );
    expect(build(facts)).toBe(build([...facts].reverse()));
  });
});

void ACTIVITY_ID_2;
