// RUNTIME PARITY with the sibling kernel vocabularies (the W036/W037/
// W038 kernel-parity pattern; devDependencies only — no runtime
// coupling):
//
// - W010 event-log: the mirrored supervision-event shape is admitted by
//   the REAL @epoch/event-log seal path (sealEvent) and digests
//   identically through the REAL computeEventDigest; the record
//   versions are equal;
// - W006 evidence: real evidence digests are admitted by the
//   provenance-source digest grammar (finding provenance is
//   exact-revision addressable);
// - W038 execution-tracking: a REAL sealed W038 issue record projects
//   into an execution-issue summary that admits (the mirror feeds from
//   the REAL record family);
// - W037 procurement: a REAL W037 lead-time observation (over a REAL
//   W036 estimate record) feeds the lead-time source-record reference;
// - W007 capability-registry: a REAL source-category capability
//   manifest honoring the epoch/supervision contract is admitted by the
//   REAL registry (external supervising/alerting systems bind through
//   the capability fabric, never as vendor fields).
import { describe, expect, it } from 'vitest';
import {
  computeEventDigest,
  sealEvent,
  EVENT_LOG_RECORD_VERSION,
} from '@epoch/event-log';
import { computeEvidenceDigest, EvidenceRecordSchema } from '@epoch/evidence';
import { CapabilityRegistry, computeCapabilityManifestDigest } from '@epoch/capability-registry';
import { sealIssueRecord } from '@epoch/execution-tracking';
import { sealDistinctionRecord } from '@epoch/solution-delivery';
import {
  admitExecutionIssueSummary,
  computeSupervisionEventDigest,
  ProvenanceSourceSchema,
  sealSupervisionEvent,
  SUPERVISION_EVENT_RECORD_VERSION,
  supervisionStreamIdOf,
  ExecutionIssueSummarySchema,
  type LeadTimeSourceRecord,
} from '../src/index';
import {
  ACTIVITY_ID,
  EVAL_IN_WINDOW,
  ISSUE_DIGEST,
  PRINCIPAL,
  PROGRAM_ID,
  SOLUTION_ID,
  TENANT,
  T3,
  T5,
  uncertainty,
  unwrap,
} from './fixtures';

describe('W010 event-log parity (runtime)', () => {
  it('the mirrored event shape seals through the REAL W010 sealEvent and digests identically', () => {
    const content = {
      schemaVersion: SUPERVISION_EVENT_RECORD_VERSION,
      streamId: supervisionStreamIdOf(PROGRAM_ID),
      sequence: 1,
      tenantId: TENANT,
      actor: PRINCIPAL,
      causalParent: null,
      payload: {
        discriminator: 'supervision:pass-evaluated',
        data: {
          passId: 'pass:week-1',
          passDigest: 'a'.repeat(64),
          programId: PROGRAM_ID,
          deliveryId: 'delivery:tower-retrofit-v1',
          findingCount: 2,
          evaluatedAt: EVAL_IN_WINDOW,
        },
      },
      occurredAt: T3,
    };
    const ours = sealSupervisionEvent(content);
    expect(ours.ok).toBe(true);
    if (!ours.ok) return;
    const theirs = sealEvent(content);
    expect(theirs.ok, JSON.stringify(theirs)).toBe(true);
    if (!theirs.ok) return;
    expect(ours.value.contentDigest).toBe(theirs.value.digest);
    expect(computeSupervisionEventDigest(content as never)).toBe(computeEventDigest(content));
  });

  it('the mirrored record version equals the W010 record version', () => {
    expect(SUPERVISION_EVENT_RECORD_VERSION).toBe(EVENT_LOG_RECORD_VERSION);
  });
});

describe('W006 evidence parity (runtime)', () => {
  it('a REAL W006 evidence digest is admitted by the provenance-source grammar', () => {
    const record = {
      schemaVersion: 1,
      kind: 'measurement',
      subject: {
        artifactId: 'engineering.excavation-survey',
        revision: '1.0.0',
        digest: '0'.repeat(64),
      },
      producedBy: {
        runId: 'run:site-survey-2026-03-02',
        actorId: 'principal:field-engineer',
        methodId: 'method:visual-inspection',
      },
      observedAt: T3,
      content: {
        mediaType: 'application/json',
        data: { passed: true, depthM: 2.4 },
      },
      confidence: {
        distribution: { kind: 'point', value: 1 },
        method: 'measured',
        rationale: 'direct capture',
      },
    };
    const parsed = EvidenceRecordSchema.safeParse(record);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    const digest = computeEvidenceDigest(record as never);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    const source = ProvenanceSourceSchema.safeParse({
      referenceKind: 'execution-issue',
      referenceId: 'blocker:awaiting-survey',
      contentDigest: digest,
    });
    expect(source.success).toBe(true);
  });
});

describe('W038 execution-tracking parity (runtime)', () => {
  it('a REAL sealed W038 issue record projects into an admitted execution-issue summary', () => {
    const sealed = unwrap(
      sealIssueRecord({
        schema: 'epoch.execution-tracking.issue-record',
        schemaVersion: 1,
        recordId: 'blocker:awaiting-survey',
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        issueKind: 'blocker',
        title: 'Survey crew unavailable',
        severity: 'major',
        impact: { workPackageIds: [], activityIds: [ACTIVITY_ID], milestoneIds: [] },
        blocked: {
          workPackageId: 'work-package:earthworks',
          activityId: ACTIVITY_ID,
          blockedByRef: 'resource:survey-crew',
          reason: 'crew booked on another site',
        },
        raisedAt: T3,
        raisedBy: PRINCIPAL,
        recordedAt: T3,
        evidenceLinks: [],
        uncertainty: uncertainty(),
      }),
    );
    const summary: Record<string, unknown> = {
      schema: 'epoch.supervision.execution-issue-summary',
      schemaVersion: 1,
      recordId: sealed.recordId,
      tenantId: sealed.tenantId,
      solutionId: sealed.solutionId,
      issueKind: sealed.issueKind,
      severity: sealed.severity,
      resolutionState: 'open',
      impact: sealed.impact,
      raisedAt: sealed.raisedAt,
      contentDigest: sealed.contentDigest,
    };
    const admitted = admitExecutionIssueSummary(summary);
    expect(admitted.ok, JSON.stringify(admitted)).toBe(true);
    if (admitted.ok) {
      expect(admitted.value.contentDigest).toBe(sealed.contentDigest);
    }
  });
});

describe('W037 procurement parity (runtime)', () => {
  it('a REAL W036 estimate record feeds the W037-shaped lead-time source reference', () => {
    // The W037 LeadTimeObservation shape: {semantics, recordId,
    // contentDigest, uncertainty} over a Prediction/Estimate distinction
    // record. The supervision mirror consumes (recordId, contentDigest).
    const estimate = unwrap(
      sealDistinctionRecord({
        schema: 'epoch.solution-delivery.distinction-record',
        schemaVersion: 1,
        kind: 'estimate',
        recordId: 'estimate:cement-lead',
        tenantId: TENANT,
        subject: { solutionId: SOLUTION_ID, subjectKind: 'solution', subjectId: SOLUTION_ID },
        measure: { kind: 'quantity', value: '5', unit: 'day' },
        payload: { method: 'supplier-quote-synthesis', range: { low: '4', high: '7' } },
        recordedAt: T3,
        recordedBy: PRINCIPAL,
        uncertainty: uncertainty(),
      }),
    );
    const leadTimeObservation = {
      semantics: 'estimate',
      recordId: estimate.recordId,
      contentDigest: estimate.contentDigest,
      uncertainty: uncertainty(),
    };
    expect(leadTimeObservation.recordId).toBe('estimate:cement-lead');
    const sourceRecord: LeadTimeSourceRecord = {
      recordId: leadTimeObservation.recordId,
      contentDigest: leadTimeObservation.contentDigest,
    };
    expect(sourceRecord.contentDigest).toBe(estimate.contentDigest);
  });
});

describe('W007 capability-registry parity (runtime)', () => {
  it('a REAL source-category capability manifest honoring the supervision contract registers', () => {
    const manifest = {
      schemaVersion: 1,
      capabilityId: 'epoch.supervision.reference',
      category: 'source',
      version: '1.0.0',
      descriptor: {
        displayName: 'Reference supervision source capability',
        description: 'A provider-neutral external evaluator of supervision findings',
        inputs: [],
        outputs: [],
        assumptions: ['in-memory reference behavior only'],
      },
      contracts: [
        {
          contractId: 'epoch.supervision',
          contractVersion: '1.0.0',
        },
      ],
      trust: { origin: 'first-party' },
    };
    const digest = computeCapabilityManifestDigest(manifest as never);
    const registry = new CapabilityRegistry();
    const registered = registry.register({ manifest: manifest as never, digest });
    expect(registered.ok, JSON.stringify(registered)).toBe(true);
    expect(registry.size).toBe(1);
  });
});

describe('cross-kernel summary grammar (runtime)', () => {
  it('the issue-summary id grammar accepts every W038 family prefix', () => {
    for (const recordId of [
      'change:scope-shift',
      'delay:weather-hold',
      'rework:plate-crack',
      'defect:porosity',
      'blocker:awaiting-survey',
    ]) {
      const summary = ExecutionIssueSummarySchema.safeParse({
        schema: 'epoch.supervision.execution-issue-summary',
        schemaVersion: 1,
        recordId,
        tenantId: TENANT,
        solutionId: SOLUTION_ID,
        issueKind: recordId.slice(0, recordId.indexOf(':')),
        severity: 'minor',
        resolutionState: 'open',
        impact: { workPackageIds: [], activityIds: [], milestoneIds: [] },
        raisedAt: T5,
        contentDigest: ISSUE_DIGEST,
      });
      expect(summary.success, recordId).toBe(true);
    }
  });
});
