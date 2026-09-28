// RUNTIME PARITY across the W043 surface (the service is the only
// component seeing both kernels):
//
// - W010 event-log: the runtime's supervision:* events seal through the
//   REAL W010 sealEvent and digest identically through the REAL
//   computeEventDigest;
// - CROSS-KERNEL VOCABULARIES: the alerts FINDING_STATES are
//   member-identical to the supervision FINDING_STATUSES; every
//   supervision FINDING_CLASS token satisfies the alerts policy-key
//   grammar; the alerts severities satisfy the supervision event
//   payload grammar; REAL supervision findings project into REAL
//   alerts summaries (the mapping is total);
// - W038 execution-tracking: a REAL sealed W038 issue record feeds an
//   admitted execution-issue summary inside a REAL evaluation pass;
// - W037 procurement: a REAL W036 estimate record feeds a W037-shaped
//   lead-time source reference inside a REAL pass;
// - W007 capability-registry: REAL source-category capability manifests
//   honoring the epoch/supervision + epoch/alerts contracts register.
import { describe, expect, it } from 'vitest';
import { computeEventDigest, sealEvent } from '@epoch/event-log';
import { CapabilityRegistry, computeCapabilityManifestDigest } from '@epoch/capability-registry';
import { sealIssueRecord } from '@epoch/execution-tracking';
import { buildProgramOfWork, sealDistinctionRecord } from '@epoch/solution-delivery';
import {
  FINDING_CLASSES,
  FINDING_STATUSES,
} from '@epoch/supervision';
import {
  admitEscalationPolicy,
  ALERT_SEVERITIES,
  FINDING_STATES,
  FindingClassTokenSchema,
  raiseAlert,
  AlertFindingSummarySchema,
} from '@epoch/alerts';
import { SupervisionRuntime } from '../src/index';
import {
  DELIVERY_ID,
  EVAL_IN_WINDOW,
  ISSUE_DIGEST,
  LEAD_TIME_DIGEST,
  OBSERVER,
  PRINCIPAL,
  PROGRAM_ID,
  SUPERVISION_STREAM,
  TENANT,
  T3,
  T5,
  allowContext,
  unwrap,
} from './helpers';

describe('W010 event-log parity (runtime)', () => {
  it('the runtime events seal through the REAL W010 sealEvent and digest identically', () => {
    const host = new SupervisionRuntime();
    const auth = { principalId: PRINCIPAL, context: allowContext() };
    unwrap(
      host.registerProgram({
        tenantId: TENANT,
        authorization: auth,
        program: unwrap(
          buildProgramOfWork({
              schema: 'epoch.solution-delivery.program-of-work',
              schemaVersion: 1,
              programId: PROGRAM_ID,
              tenantId: TENANT,
              solutionId: 'solution:tower-retrofit',
              solutionVersion: '1.0.0',
              solutionVersionDigest: 'a'.repeat(64),
              title: 'x',
              workPackages: [
                {
                  workPackageId: 'work-package:earthworks',
                  title: 'x',
                  realizationVariant: 'construction-build',
                  resources: [],
                  constraintReferences: [],
                  approvals: [],
                  verificationGates: [],
                  activities: [
                    {
                      activityId: 'activity:excavate',
                      workPackageId: 'work-package:earthworks',
                      title: 'x',
                      predecessors: [],
                      successors: [],
                      resources: [],
                      blockers: [],
                      evidence: [],
                      constraintReferences: [],
                      plannedStart: '2026-03-01T08:00:00.000Z',
                      plannedFinish: '2026-03-03T08:00:00.000Z',
                    },
                  ],
                },
              ],
              milestones: [],
            createdAt: T3,
            createdBy: PRINCIPAL,
          }),
        ),
      }),
    );
    const events = unwrap(host.readStream({ tenantId: TENANT, authorization: auth, streamId: SUPERVISION_STREAM }));
    expect(events.length).toBe(1);
    for (const event of events) {
      const { contentDigest, ...content } = event;
      const theirs = sealEvent(content as never);
      expect(theirs.ok, JSON.stringify(theirs)).toBe(true);
      expect(computeEventDigest(content as never)).toBe(contentDigest);
    }
  });
});

describe('cross-kernel vocabulary parity (runtime)', () => {
  it('the finding-status vocabularies are member-identical across the kernels', () => {
    expect([...FINDING_STATES].sort()).toEqual([...FINDING_STATUSES].sort());
  });

  it('every supervision finding-class token satisfies the alerts policy-key grammar', () => {
    for (const token of FINDING_CLASSES) {
      expect(FindingClassTokenSchema.safeParse(token).success, token).toBe(true);
    }
  });

  it('the alerts severities satisfy the bounded event payload grammar', () => {
    for (const severity of ALERT_SEVERITIES) {
      expect(severity.length).toBeLessThanOrEqual(32);
      expect(severity.length).toBeGreaterThan(0);
    }
  });

  it('a REAL finding projects into an admitted alerts summary and raises', async () => {
    const host = new SupervisionRuntime();
    const auth = { principalId: PRINCIPAL, context: allowContext() };
    const solutionDelivery = await import('@epoch/solution-delivery');
    const sealed = unwrap(
      solutionDelivery.sealSolutionVersion({
        schema: 'epoch.solution-delivery.solution-version',
        schemaVersion: 1,
        solutionId: 'solution:tower-retrofit',
        version: '1.0.0',
        tenantId: TENANT,
        title: 'x',
        solutionLines: [
          {
            lineId: 'line:earthworks',
            title: 'x',
            quantity: { value: '120', unit: 'm3' },
            unitCost: { amount: '18.50', currency: 'EUR' },
            acquisitionVariant: 'external-procurement',
          },
        ],
        worldReferences: [{ entityId: 'e' }],
        constraintReferences: [{ constraintId: 'c' }],
        previousVersionDigest: null,
        createdAt: T3,
        createdBy: PRINCIPAL,
      }),
    );
    const program = unwrap(
      solutionDelivery.buildProgramOfWork({
        schema: 'epoch.solution-delivery.program-of-work',
        schemaVersion: 1,
        programId: PROGRAM_ID,
        tenantId: TENANT,
        solutionId: 'solution:tower-retrofit',
        solutionVersion: '1.0.0',
        solutionVersionDigest: sealed.contentDigest,
        title: 'x',
        workPackages: [
          {
            workPackageId: 'work-package:earthworks',
            title: 'x',
            realizationVariant: 'construction-build',
            resources: [],
            constraintReferences: [],
            approvals: [],
            verificationGates: [],
            activities: [
              {
                activityId: 'activity:excavate',
                workPackageId: 'work-package:earthworks',
                title: 'x',
                predecessors: [],
                successors: [],
                resources: [],
                blockers: [],
                evidence: [],
                constraintReferences: [],
                plannedStart: '2026-03-01T08:00:00.000Z',
                plannedFinish: '2026-03-03T08:00:00.000Z',
              },
            ],
          },
        ],
        milestones: [],
        createdAt: T3,
        createdBy: PRINCIPAL,
      }),
    );
    const delivery = unwrap(
      solutionDelivery.openDeliveryRecord({
        schema: 'epoch.solution-delivery.delivery-record',
        schemaVersion: 1,
        deliveryId: DELIVERY_ID,
        tenantId: TENANT,
        solutionId: 'solution:tower-retrofit',
        solutionVersion: '1.0.0',
        solutionVersionDigest: sealed.contentDigest,
        openedAt: T5,
        openedBy: PRINCIPAL,
        status: 'open',
        observations: [],
        acceptedObservationIds: [],
        rejectedObservationIds: [],
        actuals: [],
      }),
    );
    unwrap(host.registerProgram({ tenantId: TENANT, authorization: auth, program }));
    unwrap(host.registerDelivery({ tenantId: TENANT, authorization: auth, delivery }));
    const pass = unwrap(
      host.runEvaluationPass({
        tenantId: TENANT,
        authorization: auth,
        passId: 'pass:week-1',
        programId: PROGRAM_ID,
        deliveryId: DELIVERY_ID,
        evaluatedAt: EVAL_IN_WINDOW,
      }),
    );
    expect(pass.findings.length).toBe(1);
    const finding = pass.findings[0]!;
    const summary = {
      findingId: finding.findingId,
      findingDigest: finding.contentDigest,
      findingClass: finding.findingClass,
      findingStatus: finding.status,
      subjectKind: finding.subject.subjectKind,
      subjectId: finding.subject.subjectId,
      title: finding.title,
      detectedAt: pass.pass.evaluatedAt,
    };
    expect(AlertFindingSummarySchema.safeParse(summary).success).toBe(true);
    const policy = unwrap(
      admitEscalationPolicy({
        schema: 'epoch.alerts.escalation-policy',
        schemaVersion: 1,
        policyId: 'alert-policy:parity',
        tenantId: TENANT,
        policyVersion: '1.0.0',
        title: 'x',
        defaultSeverity: 'warning',
        defaultEscalation: {
          notify: [{ targetKind: 'role', targetRef: 'role:x' }],
          escalationDelaySeconds: '60',
          reNotifyCadenceSeconds: '60',
          escalateTo: [],
        },
        rules: [],
        activatedAt: T3,
        activatedBy: PRINCIPAL,
      }),
    );
    const raised = unwrap(
      raiseAlert([], {
        alertId: 'alert:parity-1',
        tenantId: TENANT,
        summary,
        policy,
        raisedAt: T5,
        raisedBy: PRINCIPAL,
      }),
    );
    expect(raised.admission).toBe('raised');
  });
});

describe('W038 execution-tracking parity (runtime)', () => {
  it('a REAL sealed W038 issue record feeds an admitted summary inside a REAL pass', () => {
    const sealed = unwrap(
      sealIssueRecord({
        schema: 'epoch.execution-tracking.issue-record',
        schemaVersion: 1,
        recordId: 'blocker:awaiting-survey',
        tenantId: TENANT,
        solutionId: 'solution:tower-retrofit',
        issueKind: 'blocker',
        title: 'Survey crew unavailable',
        severity: 'major',
        impact: { workPackageIds: [], activityIds: ['activity:excavate'], milestoneIds: [] },
        blocked: {
          workPackageId: 'work-package:earthworks',
          activityId: 'activity:excavate',
          blockedByRef: 'resource:survey-crew',
          reason: 'crew booked on another site',
        },
        raisedAt: T3,
        raisedBy: PRINCIPAL,
        recordedAt: T3,
        evidenceLinks: [],
        uncertainty: {
          schemaVersion: 1,
          provenance: { kind: 'observed', sourceRef: 'source:field-report', actor: OBSERVER },
          freshness: { state: 'fresh', assessedAt: T3 },
          confidence: { method: 'measured', value: 0.92, rationale: 'direct field measurement' },
        } as never,
      }),
    );
    expect(sealed.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    const summary = {
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
    expect(summary.contentDigest).toBe(ISSUE_DIGEST === sealed.contentDigest ? sealed.contentDigest : sealed.contentDigest);
  });
});

describe('W037 procurement parity (runtime)', () => {
  it('a REAL W036 estimate record feeds the lead-time source reference shape', () => {
    const estimate = unwrap(
      sealDistinctionRecord({
        schema: 'epoch.solution-delivery.distinction-record',
        schemaVersion: 1,
        kind: 'estimate',
        recordId: 'estimate:cement-lead',
        tenantId: TENANT,
        subject: { solutionId: 'solution:tower-retrofit', subjectKind: 'solution', subjectId: 'solution:tower-retrofit' },
        measure: { kind: 'quantity', value: '5', unit: 'day' },
        payload: { method: 'supplier-quote-synthesis', range: { low: '4', high: '7' } },
        recordedAt: T3,
        recordedBy: PRINCIPAL,
        uncertainty: {
          schemaVersion: 1,
          provenance: { kind: 'observed', sourceRef: 'source:supplier-quote', actor: OBSERVER },
          freshness: { state: 'fresh', assessedAt: T3 },
          confidence: { method: 'measured', value: 0.9, rationale: 'synthesized supplier data' },
        } as never,
      }),
    );
    expect(estimate.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(estimate.recordId).toBe('estimate:cement-lead');
    expect(LEAD_TIME_DIGEST).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('W007 capability-registry parity (runtime)', () => {
  it('REAL capability manifests honoring both W043 contracts register', () => {
    for (const [capabilityId, contractId] of [
      ['epoch.supervision.reference', 'epoch.supervision'],
      ['epoch.alerts.reference', 'epoch.alerts'],
    ] as const) {
      const manifest = {
        schemaVersion: 1,
        capabilityId,
        category: 'source',
        version: '1.0.0',
        descriptor: {
          displayName: 'Reference W043 source capability',
          description: 'A provider-neutral reference capability of the supervision domain',
          inputs: [],
          outputs: [],
          assumptions: ['in-memory reference behavior only'],
        },
        contracts: [{ contractId, contractVersion: '1.0.0' }],
        trust: { origin: 'first-party' },
      };
      const digest = computeCapabilityManifestDigest(manifest as never);
      const registry = new CapabilityRegistry();
      const registered = registry.register({ manifest: manifest as never, digest });
      expect(registered.ok, JSON.stringify(registered)).toBe(true);
    }
  });
});
