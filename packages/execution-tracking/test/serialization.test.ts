// ROUND-TRIP SERIALIZATION + DIGEST VERIFICATION for every public sealed
// type: seal -> JSON -> parse -> verify; tampered digests and broken
// chains rejected.
import { describe, expect, it } from 'vitest';
import {
  sealTrackingStateRecord,
  verifySealedTrackingStateRecord,
  sealResourceObservation,
  verifySealedResourceObservation,
  sealFieldEvidenceLink,
  verifySealedFieldEvidenceLink,
  sealIssueRecord,
  verifySealedIssueRecord,
  sealIssueResolution,
  verifySealedIssueResolution,
  sealReconciliationProposal,
  verifySealedReconciliationProposal,
  sealExecutionEvent,
  verifySealedExecutionEvent,
  verifySealedDistinctionRecord,
  verifySealedDeliveryRecord,
  executionStreamIdOf,
} from '../src/index';
import {
  ACTIVITY_ID,
  DELIVERY_ID,
  EVIDENCE_DIGEST,
  FOREMAN,
  PRINCIPAL,
  SOLUTION_ID,
  T3,
  T4,
  T5,
  TENANT,
  WORK_PACKAGE_ID,
  sealedObservation,
  sealedSolution,
  openedDelivery,
  uncertainty,
} from './fixtures';
import { expectError, unwrap } from './helpers';

const roundTrip = (record: unknown): unknown => JSON.parse(JSON.stringify(record)) as unknown;

describe('round-trip serialization + digest verification (every public sealed type)', () => {
  it('tracking-state record: seal -> JSON -> verify; tampering is digest-mismatch', () => {
    const sealed = unwrap(
      sealTrackingStateRecord({
        schema: 'epoch.execution-tracking.tracking-state',
        schemaVersion: 1,
        recordId: 'state:round-trip',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        subject: { workPackageId: WORK_PACKAGE_ID, activityId: ACTIVITY_ID },
        fromState: 'not-started',
        toState: 'in-progress',
        cause: 'round trip',
        observedAt: T3,
        recordedAt: T3,
        recordedBy: PRINCIPAL,
        evidenceLinks: [],
        uncertainty: uncertainty(),
      }),
    );
    expect(verifySealedTrackingStateRecord(roundTrip(sealed)).ok).toBe(true);
    const error = expectError(verifySealedTrackingStateRecord({ ...sealed, cause: 'tampered' }));
    expect(error.code).toBe('digest-mismatch');
  });

  it('resource-observation record: seal -> JSON -> verify; tampered digest rejected', () => {
    const sealed = unwrap(
      sealResourceObservation({
        schema: 'epoch.execution-tracking.resource-observation',
        schemaVersion: 1,
        recordId: 'resource-observation:round-trip',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        workPackageId: WORK_PACKAGE_ID,
        resourceKind: 'labor',
        resourceId: 'resource:crew-alpha',
        quantity: '8',
        unit: 'hour',
        usageAt: T3,
        observedBy: PRINCIPAL,
        recordedAt: T3,
        recordedBy: PRINCIPAL,
        evidenceLinks: [
          {
            digest: EVIDENCE_DIGEST,
            evidenceKind: 'photo',
            capturedAt: T3,
            capturedBy: FOREMAN,
          },
        ],
        uncertainty: uncertainty(),
      }),
    );
    expect(verifySealedResourceObservation(roundTrip(sealed)).ok).toBe(true);
    const error = expectError(verifySealedResourceObservation({ ...sealed, contentDigest: 'f'.repeat(64) }));
    expect(error.code).toBe('digest-mismatch');
  });

  it('field-evidence-link record: seal -> JSON -> verify; tampering is digest-mismatch', () => {
    const sealed = unwrap(
      sealFieldEvidenceLink({
        schema: 'epoch.execution-tracking.field-evidence-link',
        schemaVersion: 1,
        recordId: 'evidence-link:round-trip',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        digest: EVIDENCE_DIGEST,
        evidenceKind: 'photo',
        capturedAt: T3,
        capturedBy: FOREMAN,
        workPackageId: WORK_PACKAGE_ID,
        linkedObservationId: 'observation:pit-volume',
        recordedAt: T3,
      }),
    );
    expect(verifySealedFieldEvidenceLink(roundTrip(sealed)).ok).toBe(true);
    const error = expectError(verifySealedFieldEvidenceLink({ ...sealed, note: 'tampered' }));
    expect(error.code).toBe('digest-mismatch');
  });

  it('issue record + resolution: seal -> JSON -> verify; tampering is digest-mismatch', () => {
    const issue = unwrap(
      sealIssueRecord({
        schema: 'epoch.execution-tracking.issue-record',
        schemaVersion: 1,
        recordId: 'defect:round-trip',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        issueKind: 'defect',
        title: 'round trip defect',
        severity: 'minor',
        impact: { workPackageIds: [WORK_PACKAGE_ID], activityIds: [], milestoneIds: [] },
        raisedAt: T3,
        raisedBy: FOREMAN,
        recordedAt: T3,
        evidenceLinks: [],
        uncertainty: uncertainty(),
      }),
    );
    expect(verifySealedIssueRecord(roundTrip(issue)).ok).toBe(true);
    const issueError = expectError(verifySealedIssueRecord({ ...issue, severity: 'critical' }));
    expect(issueError.code).toBe('digest-mismatch');

    const resolution = unwrap(
      sealIssueResolution({
        schema: 'epoch.execution-tracking.issue-resolution',
        schemaVersion: 1,
        recordId: 'issue-resolution:round-trip',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        issueRecordId: 'defect:round-trip',
        resolution: 'resolved',
        resolvedAt: T4,
        resolvedBy: FOREMAN,
        evidenceLinks: [],
      }),
    );
    expect(verifySealedIssueResolution(roundTrip(resolution)).ok).toBe(true);
    const resolutionError = expectError(
      verifySealedIssueResolution({ ...resolution, resolution: 'dismissed' as const }),
    );
    expect(resolutionError.code).toBe('digest-mismatch');
  });

  it('reconciliation proposal: seal -> JSON -> verify; tampering is digest-mismatch', () => {
    const sealed = unwrap(
      sealReconciliationProposal({
        schema: 'epoch.execution-tracking.reconciliation-proposal',
        schemaVersion: 1,
        recordId: 'reconciliation:round-trip',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        deliveryId: DELIVERY_ID,
        entries: [{ observationId: 'observation:pit-volume', proposedActualId: 'actual:pit-volume' }],
        proposedAt: T5,
        proposedBy: PRINCIPAL,
      }),
    );
    expect(verifySealedReconciliationProposal(roundTrip(sealed)).ok).toBe(true);
    const error = expectError(verifySealedReconciliationProposal({ ...sealed, rationale: 'tampered' }));
    expect(error.code).toBe('digest-mismatch');
  });

  it('execution event: seal -> JSON -> verify; tampering is digest-mismatch', () => {
    const sealed = unwrap(
      sealExecutionEvent({
        schemaVersion: 1,
        streamId: executionStreamIdOf(WORK_PACKAGE_ID),
        sequence: 1,
        tenantId: TENANT,
        actor: PRINCIPAL,
        causalParent: null,
        payload: {
          discriminator: 'execution:observation-recorded',
          data: {
            workPackageId: WORK_PACKAGE_ID,
            deliveryId: DELIVERY_ID,
            observationId: 'observation:pit-volume',
            subjectKind: 'activity',
            measureKind: 'quantity',
            observedAt: T3,
          },
        },
        occurredAt: T3,
      }),
    );
    expect(verifySealedExecutionEvent(roundTrip(sealed)).ok).toBe(true);
    const error = expectError(verifySealedExecutionEvent({ ...sealed, occurredAt: T4 }));
    expect(error.code).toBe('digest-mismatch');
  });

  it('the W036 observation record this package produces: seal -> JSON -> verify', () => {
    const sealed = sealedObservation();
    expect(verifySealedDistinctionRecord(roundTrip(sealed)).ok).toBe(true);
    const error = expectError(
      verifySealedDistinctionRecord({ ...sealed, measure: { kind: 'quantity', value: '1', unit: 'm3' } }),
    );
    expect(error.code).toBe('digest-mismatch');
  });

  it('the W036 delivery record: open -> JSON -> verify; tampering is digest-mismatch', () => {
    const solution = sealedSolution();
    const delivery = openedDelivery(solution);
    expect(verifySealedDeliveryRecord(roundTrip(delivery)).ok).toBe(true);
    const error = expectError(verifySealedDeliveryRecord({ ...delivery, status: 'closed' as const }));
    expect(error.code).toBe('digest-mismatch');
  });
});
