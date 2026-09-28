// RUNTIME PARITY with the sibling kernel vocabularies (devDependencies
// only — no runtime coupling):
//
// - W003 action-protocol: the escalation proposals this kernel builds
//   parse through the REAL W003 pipeline (parseActionProposal); the
//   escalation decisions parse through the REAL decision pipeline
//   (parseAuthorizationDecision) with the gateway/human-approver roles;
// - W010 event-log: the mirrored principal grammar is
//   pattern-identical to the W010 actor grammar;
// - W006 evidence: the exact-revision digest grammar is the same
//   sha256-hex grammar every alerts content address carries;
// - W038 execution-tracking: a REAL sealed issue-record digest is
//   admitted by the alerts digest grammar (escalation evidence
//   references stay exact-revision addressable);
// - W007 capability-registry: a REAL source-category capability
//   manifest honoring the epoch/alerts contract is admitted by the
//   REAL registry (external notification relays bind through the
//   capability fabric, never as vendor fields).
import { describe, expect, it } from 'vitest';
import { parseActionProposal, parseAuthorizationDecision } from '@epoch/action-protocol';
import { EVENT_ACTOR_PATTERN } from '@epoch/event-log';
import { computeEvidenceDigest, EvidenceRecordSchema } from '@epoch/evidence';
import { CapabilityRegistry, computeCapabilityManifestDigest } from '@epoch/capability-registry';
import { sealIssueRecord } from '@epoch/execution-tracking';
import {
  AlertsPrincipalIdSchema,
  buildEscalationProposal,
  computeProposalDigest,
  planEscalation,
} from '../src/index';
import {
  PRINCIPAL,
  PROPOSER,
  TENANT,
  T3,
  T5,
  T6,
  alertChain,
  findingSummary,
  unwrap,
} from './fixtures';
import type { UncertaintyState } from '@epoch/execution-tracking';

/** One valid uncertainty state (the W036 shape, mirrored for fixtures). */
function uncertainty(): UncertaintyState {
  return {
    schemaVersion: 1,
    provenance: { kind: 'observed', sourceRef: 'source:field-report', actor: PRINCIPAL },
    freshness: { state: 'fresh', assessedAt: T3 },
    confidence: { method: 'measured', value: 0.92, rationale: 'direct field measurement' },
  } as UncertaintyState;
}

describe('W003 action-protocol parity (runtime)', () => {
  it('the escalation proposal parses through the REAL W003 proposal pipeline', () => {
    const chain = alertChain([findingSummary({ findingStatus: 'blocked' })]);
    const proposal = unwrap(
      buildEscalationProposal({
        alert: chain[chain.length - 1]!,
        plan: planEscalation({
          alert: chain[chain.length - 1]!,
          delaySeconds: '900',
          reNotifyCadenceSeconds: '14400',
          notify: [{ targetKind: 'role', targetRef: 'role:site-manager' }],
          escalateTo: [],
        }),
        proposalId: 'proposal-parity-1',
        messageId: 'message-parity-1',
        proposedBy: PROPOSER,
        createdAt: T5,
      }),
    );
    const parsed = parseActionProposal(proposal);
    expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
    expect(computeProposalDigest(proposal)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('the gateway decision parses through the REAL W003 decision pipeline', () => {
    const decision = {
      protocolVersion: '1.0.0',
      messageKind: 'action.authorization-decision',
      messageId: 'message-parity-decision-1',
      createdAt: T6,
      requestId: 'message-parity-request-1',
      proposalRef: { proposalId: 'proposal-parity-1', canonicalDigest: 'a'.repeat(64) },
      decidedBy: { id: 'gateway:action-gateway', role: 'action-gateway' },
      decision: { kind: 'denied', code: 'missing-authority', reason: 'scope not granted' },
    };
    const parsed = parseAuthorizationDecision(decision);
    expect(parsed.ok, JSON.stringify(parsed)).toBe(true);
  });

  it('the mirrored principal grammar is pattern-identical to the W010 actor grammar', () => {
    const valid = ['principal:delivery-lead', 'principal:a'];
    for (const id of valid) {
      expect(AlertsPrincipalIdSchema.safeParse(id).success).toBe(true);
      expect(new RegExp(EVENT_ACTOR_PATTERN).test(id)).toBe(true);
    }
    const invalid = ['principal:', 'Principal:X', 'agent:bot'];
    for (const id of invalid) {
      expect(AlertsPrincipalIdSchema.safeParse(id).success).toBe(false);
      expect(new RegExp(EVENT_ACTOR_PATTERN).test(id)).toBe(false);
    }
  });
});

describe('W006 evidence parity (runtime)', () => {
  it('a REAL W006 evidence digest is admitted by the alerts digest grammar', () => {
    const record = {
      schemaVersion: 1,
      kind: 'measurement',
      subject: { artifactId: 'engineering.excavation-survey', revision: '1.0.0', digest: '0'.repeat(64) },
      producedBy: {
        runId: 'run:site-survey-2026-03-02',
        actorId: 'principal:field-engineer',
        methodId: 'method:visual-inspection',
      },
      observedAt: T3,
      content: { mediaType: 'application/json', data: { passed: true } },
      confidence: { distribution: { kind: 'point', value: 1 }, method: 'measured', rationale: 'direct capture' },
    };
    expect(EvidenceRecordSchema.safeParse(record).success).toBe(true);
    const digest = computeEvidenceDigest(record as never);
    const chain = alertChain([findingSummary()]);
    const alert = chain[0]!;
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(alert.contentDigest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('W038 execution-tracking parity (runtime)', () => {
  it('a REAL sealed W038 issue-record digest fits the alerts exact-revision grammar', () => {
    const uncertaintyState: UncertaintyState = uncertainty();
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
        uncertainty: uncertaintyState,
      }),
    );
    expect(sealed.contentDigest).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('W007 capability-registry parity (runtime)', () => {
  it('a REAL source-category capability manifest honoring the alerts contract registers', () => {
    const manifest = {
      schemaVersion: 1,
      capabilityId: 'epoch.alerts.reference',
      category: 'source',
      version: '1.0.0',
      descriptor: {
        displayName: 'Reference notification relay capability',
        description: 'The in-memory NotificationPort reference adapter published as a source capability',
        inputs: [],
        outputs: [],
        assumptions: ['in-memory reference behavior only'],
      },
      contracts: [
        {
          contractId: 'epoch.alerts',
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
