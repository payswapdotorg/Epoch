// THE NEGATIVE FLOW through the learning-calibration runtime host: the
// W009 authorization gate denies BEFORE any kernel admission (unknown
// principal, foreign membership, inactive principal), R12 tenant
// isolation (host pinning + foreign candidates), the lineage-required
// gate through the service, stale references, the replay conflict,
// malformed records, and vendor-field rejection.
import { describe, expect, it } from 'vitest';
import { LearningCalibrationRuntime } from '../src/runtime';
import { sealModelRevisionProposal } from '@epoch/learning-calibration';
import {
  BAND_THRESHOLDS,
  OTHER_TENANT,
  PRINCIPAL,
  SOLUTION_ID,
  TENANT,
  T5,
  T6,
  T7,
  allowContext,
  candidateContent,
  eligibleCandidates,
  foreignMembershipContext,
  inactivePrincipalContext,
  unknownPrincipalContext,
} from './helpers';
import { expectError, unwrap } from './helpers';

const AUTH = { principalId: PRINCIPAL, context: allowContext() };

/** One hosted scope with the three eligible candidates + assembled dataset. */
function stockedHost() {
  const runtime = new LearningCalibrationRuntime();
  for (const candidate of eligibleCandidates()) {
    unwrap(
      runtime.intakeLearningRecord({
        tenantId: TENANT,
        authorization: AUTH,
        candidate,
        intakenAt: T5,
      }),
    );
  }
  const assembled = unwrap(
    runtime.assembleDataset({
      tenantId: TENANT,
      authorization: AUTH,
      solutionId: SOLUTION_ID,
      bandThresholds: BAND_THRESHOLDS,
      assembledAt: T6,
    }),
  );
  return { runtime, dataset: assembled.dataset };
}

/** One lineage-complete proposal for the stocked dataset. */
function proposalFor(dataset: { datasetId: string; contentDigest: string }) {
  return unwrap(
    sealModelRevisionProposal({
      schema: 'epoch.learning-calibration.model-revision-proposal',
      schemaVersion: 1,
      proposalId: 'proposal:pit-volume-revision-1',
      draft: {
        schema: 'epoch.learning-calibration.model-revision',
        schemaVersion: 1,
        revisionId: 'model-revision:pit-volume-1',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        modelId: 'model:pit-volume-calibration',
        sequence: 1,
        supersedes: null,
        applicability: { measureClass: 'quantity', packId: null, realizationVariant: null },
        parameters: [{ name: 'epoch.calibration.volume.bias-offset', value: '0' }],
        lineage: {
          datasets: [{ datasetId: dataset.datasetId, contentDigest: dataset.contentDigest }],
          changingObservations: [
            { recordId: 'comparison-fact:pit-volume-f1-a1', contentDigest: '0'.repeat(64) },
          ],
        },
        revisedAt: T7,
        revisedBy: PRINCIPAL,
      },
      justification: [{ kind: 'dataset', reference: dataset.datasetId }],
      proposedAt: T7,
      proposedBy: PRINCIPAL,
    }),
  );
}

describe('the W009 authorization gate (denials BEFORE any kernel admission)', () => {
  const denials = [
    { label: 'unknown principal', context: unknownPrincipalContext() },
    { label: 'foreign membership', context: foreignMembershipContext() },
    { label: 'inactive principal', context: inactivePrincipalContext() },
  ] as const;

  it.each(denials)('denies intake for a $label', (denial) => {
    const runtime = new LearningCalibrationRuntime();
    const error = expectError(
      runtime.intakeLearningRecord({
        tenantId: TENANT,
        authorization: { principalId: PRINCIPAL, context: denial.context },
        candidate: eligibleCandidates()[0]!,
        intakenAt: T5,
      }),
    );
    expect(error.code).toBe('authorization-rejected');
    // Nothing was admitted (the gate fired BEFORE the kernel).
    expect(runtime.health().candidateCount).toBe(0);
    expect(runtime.health().eventCount).toBe(0);
  });

  it.each(denials)('denies dataset assembly for a $label', (denial) => {
    const { runtime } = stockedHost();
    const before = runtime.health().eventCount;
    const error = expectError(
      runtime.assembleDataset({
        tenantId: TENANT,
        authorization: { principalId: PRINCIPAL, context: denial.context },
        solutionId: SOLUTION_ID,
        bandThresholds: BAND_THRESHOLDS,
        assembledAt: T6,
      }),
    );
    expect(error.code).toBe('authorization-rejected');
    expect(runtime.health().eventCount).toBe(before);
  });

  it.each(denials)('denies model revision for a $label', (denial) => {
    const { runtime, dataset } = stockedHost();
    const error = expectError(
      runtime.admitModelRevision({
        tenantId: TENANT,
        authorization: { principalId: PRINCIPAL, context: denial.context },
        solutionId: SOLUTION_ID,
        proposal: proposalFor(dataset),
        proposedAt: T7,
        admittedAt: T7,
      }),
    );
    expect(error.code).toBe('authorization-rejected');
    expect(runtime.health().revisionCount).toBe(0);
  });
});

describe('R12 tenant isolation', () => {
  it('a host pinned to one tenant rejects foreign-tenant operations', () => {
    const runtime = new LearningCalibrationRuntime({ expectedTenantId: TENANT });
    const error = expectError(
      runtime.intakeLearningRecord({
        tenantId: OTHER_TENANT,
        authorization: { principalId: PRINCIPAL, context: allowContext(PRINCIPAL, OTHER_TENANT) },
        candidate: eligibleCandidates()[0]!,
        intakenAt: T5,
      }),
    );
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('a foreign-tenant candidate is rejected at the host scope gate', () => {
    const runtime = new LearningCalibrationRuntime();
    const error = expectError(
      runtime.intakeLearningRecord({
        tenantId: OTHER_TENANT,
        authorization: { principalId: PRINCIPAL, context: allowContext(PRINCIPAL, OTHER_TENANT) },
        candidate: eligibleCandidates()[0]!,
        intakenAt: T5,
      }),
    );
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('an operation on an unknown scope is unknown-scope', () => {
    const runtime = new LearningCalibrationRuntime();
    const error = expectError(
      runtime.assembleDataset({
        tenantId: TENANT,
        authorization: AUTH,
        solutionId: 'solution:ghost-scope',
        bandThresholds: BAND_THRESHOLDS,
        assembledAt: T6,
      }),
    );
    expect(error.code).toBe('unknown-scope');
  });
});

describe('the controlled update gate through the service', () => {
  it('a lineage-less proposal is model-revision-lineage-required', () => {
    const { runtime, dataset } = stockedHost();
    const lineageLess = unwrap(
      sealModelRevisionProposal({
        schema: 'epoch.learning-calibration.model-revision-proposal',
        schemaVersion: 1,
        proposalId: 'proposal:pit-volume-lineage-less',
        draft: {
          schema: 'epoch.learning-calibration.model-revision',
          schemaVersion: 1,
          revisionId: 'model-revision:pit-volume-1',
          tenantId: TENANT,
          solutionId: SOLUTION_ID,
          modelId: 'model:pit-volume-calibration',
          sequence: 1,
          supersedes: null,
          applicability: { measureClass: 'quantity', packId: null, realizationVariant: null },
          parameters: [{ name: 'epoch.calibration.volume.bias-offset', value: '0' }],
          lineage: { datasets: [], changingObservations: [] },
          revisedAt: T7,
          revisedBy: PRINCIPAL,
        },
        justification: [{ kind: 'dataset', reference: dataset.datasetId }],
        proposedAt: T7,
        proposedBy: PRINCIPAL,
      }),
    );
    const error = expectError(
      runtime.admitModelRevision({
        tenantId: TENANT,
        authorization: AUTH,
        solutionId: SOLUTION_ID,
        proposal: lineageLess,
        proposedAt: T7,
        admittedAt: T7,
      }),
    );
    expect(error.code).toBe('model-revision-lineage-required');
  });

  it('a stale dataset reference is stale-reference-rejected', () => {
    const { runtime } = stockedHost();
    const stale = proposalFor({
      datasetId: 'dataset:ghost-00000000',
      contentDigest: '0'.repeat(64),
    });
    const error = expectError(
      runtime.admitModelRevision({
        tenantId: TENANT,
        authorization: AUTH,
        solutionId: SOLUTION_ID,
        proposal: stale,
        proposedAt: T7,
        admittedAt: T7,
      }),
    );
    expect(error.code).toBe('stale-reference-rejected');
  });

  it('a tampered observation digest is stale-reference-rejected', () => {
    const { runtime, dataset } = stockedHost();
    const tampered = unwrap(
      sealModelRevisionProposal({
        schema: 'epoch.learning-calibration.model-revision-proposal',
        schemaVersion: 1,
        proposalId: 'proposal:pit-volume-tampered',
        draft: {
          schema: 'epoch.learning-calibration.model-revision',
          schemaVersion: 1,
          revisionId: 'model-revision:pit-volume-1',
          tenantId: TENANT,
          solutionId: SOLUTION_ID,
          modelId: 'model:pit-volume-calibration',
          sequence: 1,
          supersedes: null,
          applicability: { measureClass: 'quantity', packId: null, realizationVariant: null },
          parameters: [{ name: 'epoch.calibration.volume.bias-offset', value: '0' }],
          lineage: {
            datasets: [{ datasetId: dataset.datasetId, contentDigest: dataset.contentDigest }],
            changingObservations: [
              { recordId: 'comparison-fact:pit-volume-f1-a1', contentDigest: '0'.repeat(64) },
            ],
          },
          revisedAt: T7,
          revisedBy: PRINCIPAL,
        },
        justification: [{ kind: 'dataset', reference: dataset.datasetId }],
        proposedAt: T7,
        proposedBy: PRINCIPAL,
      }),
    );
    const error = expectError(
      runtime.admitModelRevision({
        tenantId: TENANT,
        authorization: AUTH,
        solutionId: SOLUTION_ID,
        proposal: tampered,
        proposedAt: T7,
        admittedAt: T7,
      }),
    );
    expect(error.code).toBe('stale-reference-rejected');
  });
});

describe('history immutability through the service', () => {
  it('the replay conflict (same dataset identity, different policy) is history-immutable', () => {
    const runtime = new LearningCalibrationRuntime();
    for (const candidate of eligibleCandidates()) {
      unwrap(
        runtime.intakeLearningRecord({
          tenantId: TENANT,
          authorization: AUTH,
          candidate,
          intakenAt: T5,
        }),
      );
    }
    unwrap(
      runtime.assembleDataset({
        tenantId: TENANT,
        authorization: AUTH,
        solutionId: SOLUTION_ID,
        bandThresholds: BAND_THRESHOLDS,
        assembledAt: T6,
      }),
    );
    const error = expectError(
      runtime.assembleDataset({
        tenantId: TENANT,
        authorization: AUTH,
        solutionId: SOLUTION_ID,
        bandThresholds: { minor: '1', material: '2', severe: '3' },
        assembledAt: T7,
      }),
    );
    expect(error.code).toBe('history-immutable');
  });

  it('a tampered candidate envelope is digest-mismatch', () => {
    const runtime = new LearningCalibrationRuntime();
    const candidate = eligibleCandidates()[0]!;
    const error = expectError(
      runtime.intakeLearningRecord({
        tenantId: TENANT,
        authorization: AUTH,
        candidate: { ...candidate, contentDigest: '0'.repeat(64) },
        intakenAt: T5,
      }),
    );
    expect(error.code).toBe('digest-mismatch');
  });

  it('a malformed candidate is a typed validation rejection', () => {
    const runtime = new LearningCalibrationRuntime();
    const error = expectError(
      runtime.intakeLearningRecord({
        tenantId: TENANT,
        authorization: AUTH,
        candidate: { ...candidateContent(), schemaVersion: 2 },
        intakenAt: T5,
      }),
    );
    expect(error.code).toBe('validation');
  });
});
