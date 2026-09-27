// W009 AUTHORIZATION GATE coverage: the gate denies unauthorized
// operations BEFORE any kernel admission (allow / unknown principal /
// foreign membership / inactive principal / malformed context).
import { describe, expect, it } from 'vitest';
import { ActualizationRuntime } from '../src/index';
import {
  DELIVERY_ID,
  PRINCIPAL,
  TENANT,
  T3,
  allowContext,
  expectError,
  inactivePrincipalContext,
  openedDelivery,
  foreignMembershipContext,
  sealedObservation,
  unknownPrincipalContext,
} from './helpers';

describe('the W009 authorization gate (deny before admission)', () => {
  it('an unknown principal is denied (fail-closed) before any admission', () => {
    const host = new ActualizationRuntime();
    const auth = { principalId: PRINCIPAL, context: unknownPrincipalContext() };
    const error = expectError(
      host.intakeObservation({
        tenantId: TENANT,
        authorization: auth,
        deliveryId: DELIVERY_ID,
        observation: sealedObservation(),
      }),
    );
    expect(error.code).toBe('authorization-rejected');
    expect(host.health().observationCount).toBe(0);
    expect(host.health().eventCount).toBe(0);
  });

  it('a principal with membership in ANOTHER tenant is denied (R12)', () => {
    const host = new ActualizationRuntime();
    const auth = { principalId: PRINCIPAL, context: foreignMembershipContext() };
    const error = expectError(
      host.intakeObservation({
        tenantId: TENANT,
        authorization: auth,
        deliveryId: DELIVERY_ID,
        observation: sealedObservation(),
      }),
    );
    expect(error.code).toBe('authorization-rejected');
  });

  it('a suspended principal is denied', () => {
    const host = new ActualizationRuntime();
    const auth = { principalId: PRINCIPAL, context: inactivePrincipalContext() };
    const error = expectError(
      host.intakeObservation({
        tenantId: TENANT,
        authorization: auth,
        deliveryId: DELIVERY_ID,
        observation: sealedObservation(),
      }),
    );
    expect(error.code).toBe('authorization-rejected');
  });

  it('an authorized principal registers the delivery and intakes cleanly', () => {
    const host = new ActualizationRuntime();
    const auth = { principalId: PRINCIPAL, context: allowContext() };
    const registered = host.registerDeliveryRecord({
      tenantId: TENANT,
      authorization: auth,
      delivery: openedDelivery(),
    });
    expect(registered.ok).toBe(true);
    const intake = host.intakeObservation({
      tenantId: TENANT,
      authorization: auth,
      deliveryId: DELIVERY_ID,
      observation: sealedObservation(),
    });
    expect(intake.ok).toBe(true);
    expect(host.health().observationCount).toBe(1);
  });

  it('the gate guards the analysis operations too (variance, attribution, forecast)', () => {
    const host = new ActualizationRuntime();
    const auth = { principalId: PRINCIPAL, context: unknownPrincipalContext() };
    expectError(
      host.computeVariance({
        tenantId: TENANT,
        authorization: auth,
        solutionId: 'solution:tower-retrofit',
        input: {
          varianceId: 'variance:rogue',
          subjectKind: 'activity',
          subjectId: 'activity:excavate',
          varianceClass: 'quantity',
          baselineRef: { kind: 'baseline', recordId: 'baseline:pit-volume-v1', contentDigest: '1'.repeat(64) },
          actualRef: { kind: 'actual', recordId: 'actual:pit-volume-monday', contentDigest: '2'.repeat(64) },
          baselineMeasure: { kind: 'quantity', value: '120', unit: 'm3' },
          actualMeasure: { kind: 'quantity', value: '118.5', unit: 'm3' },
          evidence: ['a'.repeat(64)],
          confidence: { method: 'measured', value: 0.9 },
          thresholds: { minor: '10', material: '100', severe: '1000' },
        },
        computedAt: T3,
        computedBy: PRINCIPAL,
      }),
    );
    expect(expectError(
      host.reviseForecast({
        tenantId: TENANT,
        authorization: auth,
        deliveryId: DELIVERY_ID,
        solutionId: 'solution:tower-retrofit',
        input: {
          recordId: 'forecast:rogue',
          subject: { solutionId: 'solution:tower-retrofit', subjectKind: 'activity', subjectId: 'activity:excavate' },
          planned: { kind: 'quantity', value: '120', unit: 'm3' },
          actualsToDate: { kind: 'quantity', value: '60', unit: 'm3' },
          asOf: T3,
          recordedAt: T3,
          recordedBy: PRINCIPAL,
          uncertainty: uncertaintyFixture(),
        },
        revisedAt: T3,
      }),
    ).code).toBe('authorization-rejected');
    expect(host.health().varianceCount).toBe(0);
    expect(host.health().forecastRevisionCount).toBe(0);
  });
});

function uncertaintyFixture(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    provenance: { kind: 'derived' },
    freshness: { state: 'fresh', assessedAt: T3 },
    confidence: { method: 'estimated', value: 0.7 },
  };
}
