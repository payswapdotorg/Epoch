// THE NEGATIVE FLOW: bypass attempts, tenant isolation, unknown
// deliveries, stale resolutions, attribution without evidence,
// history-immutable facts, and replay conflicts — every typed guard of
// the host surface.
import { describe, expect, it } from 'vitest';
import { ActualizationRuntime } from '../src/index';
import { sealConflictResolution, sealComparisonFact } from '@epoch/actualization';
import { actualIdOfObservation } from '@epoch/actualization';
import {
  ACTIVITY_ID,
  DELIVERY_ID,
  EVIDENCE_DIGEST,
  OTHER_TENANT,
  PRINCIPAL,
  SOLUTION_ID,
  TENANT,
  T3,
  T4,
  T5,
  T6,
  T7,
  allowContext,
  expectError,
  openedDelivery,
  sealedActualRecord,
  sealedComparisonFact,
  sealedObservation,
  tuesdayObservation,
  uncertainty,
  unwrap,
  comparisonFactContent,
  conflictingTuesdayObservation,
} from './helpers';

const AUTH = { principalId: PRINCIPAL, context: allowContext() };
const POLICY = { mode: 'exact' } as const;

describe('the bypass guard (actuals flow through the W036 authority path only)', () => {
  it('actualization-bypass-rejected: an ACTUAL record cannot enter the observation intake', () => {
    const host = new ActualizationRuntime();
    unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: AUTH, delivery: openedDelivery() }));
    const error = expectError(
      host.intakeObservation({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        observation: sealedActualRecord(),
      }),
    );
    expect(error.code).toBe('actualization-bypass-rejected');
    expect(host.health().observationCount).toBe(0);
  });

  it('the deterministic actual id derivation surfaces through the fold', () => {
    expect(actualIdOfObservation('observation:pit-volume-monday')).toBe('actual:pit-volume-monday');
  });
});

describe('tenant isolation (R12)', () => {
  it('tenant-isolation-rejected: a cross-tenant delivery cannot be hosted', () => {
    const host = new ActualizationRuntime();
    const foreign = openedDelivery({ tenantId: OTHER_TENANT });
    const error = expectError(
      host.registerDeliveryRecord({ tenantId: TENANT, authorization: AUTH, delivery: foreign }),
    );
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('tenant-isolation-rejected: the single-tenant guard', () => {
    const host = new ActualizationRuntime({ expectedTenantId: TENANT });
    const error = expectError(
      host.registerDeliveryRecord({ tenantId: OTHER_TENANT, authorization: AUTH, delivery: openedDelivery() }),
    );
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('tenant-isolation-rejected: a cross-tenant comparison fact', () => {
    const host = new ActualizationRuntime();
    unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: AUTH, delivery: openedDelivery() }));
    const foreign = unwrap(sealComparisonFact(comparisonFactContent({ tenantId: OTHER_TENANT })));
    const error = expectError(
      host.admitComparisonFact({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        fact: foreign,
      }),
    );
    expect(error.code).toBe('tenant-isolation-rejected');
  });
});

describe('unknown-delivery guards', () => {
  it('unknown-delivery: operations on an unregistered delivery', () => {
    const host = new ActualizationRuntime();
    const error = expectError(
      host.intakeObservation({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        observation: sealedObservation(),
      }),
    );
    expect(error.code).toBe('unknown-delivery');
    expect(
      expectError(
        host.assessValidation({
          tenantId: TENANT,
          authorization: AUTH,
          deliveryId: DELIVERY_ID,
          policy: POLICY,
          assessedAt: T3,
        }),
      ).code,
    ).toBe('unknown-delivery');
    expect(
      expectError(
        host.projectState({
          tenantId: TENANT,
          authorization: AUTH,
          deliveryId: DELIVERY_ID,
          policy: POLICY,
          projectedAt: T3,
        }),
      ).code,
    ).toBe('unknown-delivery');
  });
});

describe('the authority-path application guards', () => {
  it('conflict-unresolved-rejected: a conflicting group without a resolution', () => {
    const host = new ActualizationRuntime();
    unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: AUTH, delivery: openedDelivery() }));
    unwrap(
      host.intakeObservation({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        observation: sealedObservation(),
      }),
    );
    unwrap(
      host.intakeObservation({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        observation: conflictingTuesdayObservation(),
      }),
    );
    const snapshotPolicy = { mode: 'exact', foldMode: 'snapshot' } as const;
    const assessments = unwrap(
      host.assessValidation({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        policy: snapshotPolicy,
        assessedAt: T4,
      }),
    );
    const error = expectError(
      host.applyActualization({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        assessment: assessments[0]!,
        application: { acceptedBy: PRINCIPAL, acceptedAt: T4, actualizedBy: PRINCIPAL, actualizedAt: T5 },
      }),
    );
    expect(error.code).toBe('conflict-unresolved-rejected');
    expect(host.health().actualCount).toBe(0);
  });

  it('insufficient-observations-rejected: a group below the policy quorum', () => {
    const host = new ActualizationRuntime();
    unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: AUTH, delivery: openedDelivery() }));
    unwrap(
      host.intakeObservation({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        observation: sealedObservation(),
      }),
    );
    const quorumPolicy = { mode: 'exact', quorum: 2 } as const;
    const assessments = unwrap(
      host.assessValidation({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        policy: quorumPolicy,
        assessedAt: T4,
      }),
    );
    const error = expectError(
      host.applyActualization({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        assessment: assessments[0]!,
        application: { acceptedBy: PRINCIPAL, acceptedAt: T4, actualizedBy: PRINCIPAL, actualizedAt: T5 },
      }),
    );
    expect(error.code).toBe('insufficient-observations-rejected');
  });

  it('version-conflict: re-registering the delivery with different state', () => {
    const host = new ActualizationRuntime();
    unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: AUTH, delivery: openedDelivery() }));
    const different = openedDelivery({ openedAt: T7 });
    const error = expectError(
      host.registerDeliveryRecord({ tenantId: TENANT, authorization: AUTH, delivery: different }),
    );
    expect(error.code).toBe('version-conflict');
  });

  it('version-conflict: the same observation id with different content', () => {
    const host = new ActualizationRuntime();
    unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: AUTH, delivery: openedDelivery() }));
    unwrap(
      host.intakeObservation({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        observation: sealedObservation(),
      }),
    );
    const different = sealedObservation({ measure: { kind: 'quantity', value: '200', unit: 'm3' } });
    const error = expectError(
      host.intakeObservation({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        observation: different,
      }),
    );
    expect(error.code).toBe('version-conflict');
  });
});

describe('attribution + history guards (the named tests through the host)', () => {
  it('attribution-evidence-required: an attribution without evidence is rejected BEFORE admission', () => {
    const host = new ActualizationRuntime();
    const error = expectError(
      host.admitAttribution({
        tenantId: TENANT,
        authorization: AUTH,
        solutionId: SOLUTION_ID,
        attributionId: 'attribution:unevidenced',
        varianceRef: { recordId: 'variance:pit-volume-quantity', contentDigest: '3'.repeat(64) },
        cause: {
          causeKind: 'external-condition',
          recordId: 'condition:storm-eowyn',
          contentDigest: '4'.repeat(64),
        },
        evidence: [],
        attributedAt: T7,
        attributedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('attribution-evidence-required');
    expect(host.health().attributionCount).toBe(0);
  });

  it('history-immutable: a different fact for the SAME (forecast, actual) pair', () => {
    const host = new ActualizationRuntime();
    unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: AUTH, delivery: openedDelivery() }));
    unwrap(
      host.admitComparisonFact({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        fact: sealedComparisonFact(),
      }),
    );
    const replacement = unwrap(
      sealComparisonFact(
        comparisonFactContent({
          factId: 'comparison-fact:pit-volume-f1-a1-replacement',
          deviation: '1',
          bias: 'exact',
        }),
      ),
    );
    const error = expectError(
      host.admitComparisonFact({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        fact: replacement,
      }),
    );
    expect(error.code).toBe('history-immutable');
    expect(host.health().comparisonFactCount).toBe(1);
  });

  it('history-immutable: the same fact id with different content', () => {
    const host = new ActualizationRuntime();
    unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: AUTH, delivery: openedDelivery() }));
    unwrap(
      host.admitComparisonFact({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        fact: sealedComparisonFact(),
      }),
    );
    const mutated = unwrap(
      sealComparisonFact(comparisonFactContent({ deviation: '1', bias: 'exact' })),
    );
    const error = expectError(
      host.admitComparisonFact({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        fact: mutated,
      }),
    );
    expect(error.code).toBe('history-immutable');
  });
});

describe('the stale-resolution guard through the host', () => {
  it('dangling-reference-rejected: a resolution binding a stale assessment revision', () => {
    const host = new ActualizationRuntime();
    unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: AUTH, delivery: openedDelivery() }));
    unwrap(
      host.intakeObservation({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        observation: sealedObservation(),
      }),
    );
    unwrap(
      host.intakeObservation({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        observation: conflictingTuesdayObservation(),
      }),
    );
    const snapshotPolicy = { mode: 'exact', foldMode: 'snapshot' } as const;
    const assessments = unwrap(
      host.assessValidation({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        policy: snapshotPolicy,
        assessedAt: T4,
      }),
    );
    const staleAssessment = assessments[0]!;
    // New evidence arrives: the assessment revision changes.
    unwrap(
      host.intakeObservation({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        observation: sealedObservation({
          recordId: 'observation:pit-volume-wednesday',
          measure: { kind: 'quantity', value: '61', unit: 'm3' },
          payload: {
            deliveryId: DELIVERY_ID,
            observedAt: T6,
            observedBy: 'principal:field-engineer',
            evidence: [],
          },
          uncertainty: uncertainty(),
        }),
      }),
    );
    const resolution = unwrap(
      sealConflictResolution({
        schema: 'epoch.actualization.conflict-resolution',
        schemaVersion: 1,
        resolutionId: 'resolution:pit-volume-tuesday-wins',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        deliveryId: DELIVERY_ID,
        assessmentRef: {
          assessmentId: staleAssessment.assessmentId,
          contentDigest: staleAssessment.contentDigest,
        },
        selectedObservationRefs: [
          {
            recordId: 'observation:pit-volume-tuesday',
            contentDigest: staleAssessment.observationRefs.find(
              (r) => r.recordId === 'observation:pit-volume-tuesday',
            )!.contentDigest,
          },
        ],
        excludedObservationRefs: [
          {
            recordId: 'observation:pit-volume-monday',
            contentDigest: staleAssessment.observationRefs.find(
              (r) => r.recordId === 'observation:pit-volume-monday',
            )!.contentDigest,
          },
        ],
        resolvedBy: PRINCIPAL,
        resolvedAt: T4,
      }),
    );
    const error = expectError(
      host.admitResolution({
        tenantId: TENANT,
        authorization: AUTH,
        deliveryId: DELIVERY_ID,
        resolution,
        policy: snapshotPolicy,
        resolvedAt: T4,
      }),
    );
    expect(error.code).toBe('dangling-reference-rejected');
    expect(host.health().resolutionCount).toBe(0);
  });
});

describe('the variance measure-kind guard through the host', () => {
  it('measure-kind-mismatch: quantity vs cost variance inputs', () => {
    const host = new ActualizationRuntime();
    const error = expectError(
      host.computeVariance({
        tenantId: TENANT,
        authorization: AUTH,
        solutionId: SOLUTION_ID,
        input: {
          varianceId: 'variance:rogue',
          subjectKind: 'activity',
          subjectId: ACTIVITY_ID,
          varianceClass: 'quantity',
          baselineRef: {
            kind: 'baseline',
            recordId: 'baseline:pit-volume-v1',
            contentDigest: '1'.repeat(64),
          },
          actualRef: {
            kind: 'actual',
            recordId: 'actual:pit-volume-monday',
            contentDigest: '2'.repeat(64),
          },
          baselineMeasure: { kind: 'quantity', value: '120', unit: 'm3' },
          actualMeasure: { kind: 'cost', amount: '118.5', currency: 'EUR' },
          evidence: [EVIDENCE_DIGEST],
          confidence: { method: 'measured', value: 0.9 },
          thresholds: { minor: '10', material: '100', severe: '1000' },
        },
        computedAt: T6,
        computedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('measure-kind-mismatch');
    expect(host.health().varianceCount).toBe(0);
  });
});

void tuesdayObservation;
void T3;
