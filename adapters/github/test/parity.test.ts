// RUNTIME parity with the REAL W022 action gateway, the REAL W002
// world-model validators, and the REAL W006 evidence pipeline
// (devDependencies only — the frozen runtime dependency policy).
import { describe, expect, it } from 'vitest';
import { ActionGateway } from '@epoch/action-gateway';
import { parseActionProposal } from '@epoch/action-protocol';
import {
  AssertionInputSchema,
  AssertionStatementSchema,
  ConfidenceSchema,
  ProvenanceSchema,
  ValiditySchema,
  WorldModel,
} from '@epoch/world-model';
import { parseEvidenceRecord } from '@epoch/evidence';
import {
  GithubActionAdapter,
  buildChangeProposal,
  parseProviderSnapshot,
  projectSnapshot,
  referenceSnapshot,
  verifyProjection,
} from '../src/index';
import {
  APPROVER,
  DEADLINE,
  TENANT_A,
  T0,
  T1,
  T2,
  adapterSetup,
  allowingContext,
  applicablePolicySet,
  resolver,
  GatewayAuthorityPort,
  PRINCIPAL,
} from './helpers';

describe('W022 action-gateway parity (the REAL gateway behind the authority seam)', () => {
  it('the adapter-built proposal passes the REAL W003 admission pipeline', () => {
    const plan = buildChangeProposal({
      tenantId: TENANT_A,
      workspaceId: 'sw:epoch-reference-app',
      changeKind: 'revision',
      actionId: 'action:parity-change',
      summary: 'parity evidence',
      proposedAt: T1,
    });
    const admitted = parseActionProposal(plan.proposal);
    expect(admitted.ok).toBe(true);
    if (admitted.ok) {
      expect(admitted.value.actionType.id).toBe('software.change.propose');
      expect(admitted.digest).toBe(plan.proposalRef.canonicalDigest);
    }
  });

  it('the requires-approval path: the REAL gateway records a typed decision', () => {
    const { gateway, action, host } = adapterSetup();
    host.ingestSnapshot({ tenantId: TENANT_A, payload: referenceSnapshot(), ingestedAt: T0 });
    const dispatch = action.route({
      tenant: TENANT_A,
      workspace: 'sw:epoch-reference-app',
      changeKind: 'revision',
      summary: 'requires approval evidence',
      actionId: 'action:parity-approval',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T2,
    });
    if (!dispatch.ok) throw new Error(dispatch.error.message);
    expect(dispatch.value.decision.outcome).toBe('requires-approval');
    expect(dispatch.value.disposition).toBe('authority-pending-approval');
    // The decision digest IS the real gateway's sealed decision digest.
    const stored = gateway.getAction({ tenantId: TENANT_A, actionId: 'action:parity-approval' });
    expect(stored.ok).toBe(true);
    if (stored.ok) {
      expect(dispatch.value.decision.decisionDigest).toBe(stored.value.decisionDigest);
      expect(stored.value.status).toBe('awaiting-approval');
    }
  });

  it('the allow path: approval authorizes, the dispatch executes, the outcome is the gateway record', () => {
    const { gateway, action, host } = adapterSetup();
    host.ingestSnapshot({ tenantId: TENANT_A, payload: referenceSnapshot(), ingestedAt: T0 });
    const dispatch = action.route({
      tenant: TENANT_A,
      workspace: 'sw:epoch-reference-app',
      changeKind: 'revision',
      summary: 'allow path evidence',
      actionId: 'action:parity-allow',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T2,
    });
    if (!dispatch.ok) throw new Error(dispatch.error.message);
    expect(dispatch.value.disposition).toBe('authority-pending-approval');

    // The human approval flow on the REAL gateway (approval authorizes
    // exactly the referenced decision + proposal revision).
    const approval = gateway.approveAction({
      tenantId: TENANT_A,
      actionId: 'action:parity-allow',
      decidedBy: APPROVER,
      asRole: 'workspace-maintainer',
      at: T2,
      note: 'approved for parity evidence',
    });
    expect(approval.ok).toBe(true);

    // Re-route the SAME proposal revision (identical inputs -> identical
    // proposal -> the gateway's idempotent duplicate-decision intake; the
    // action is now AUTHORIZED after the human approval).
    const executed = action.route({
      tenant: TENANT_A,
      workspace: 'sw:epoch-reference-app',
      changeKind: 'revision',
      summary: 'allow path evidence',
      actionId: 'action:parity-allow',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T2,
    });
    if (!executed.ok) throw new Error(executed.error.message);
    // The ORIGINAL decision required approval; the authority's approval
    // flow completed, so the action is authorized and the dispatch runs.
    expect(executed.value.decision.outcome).toBe('requires-approval');
    expect(executed.value.decision.actionStatus).toBe('authorized');
    expect(executed.value.disposition).toBe('executed');
    expect(executed.value.outcome?.kind).toBe('succeeded');
    // The outcome digest IS the real gateway's sealed outcome-record digest.
    const stored = gateway.getAction({ tenantId: TENANT_A, actionId: 'action:parity-allow' });
    expect(stored.ok).toBe(true);
    if (stored.ok) {
      expect(stored.value.outcome).toBeDefined();
      expect(executed.value.outcome?.outcomeDigest).toBe(stored.value.outcome?.contentDigest);
      expect(stored.value.status).toBe('executed');
    }
  });

  it('the allow-decision path: a non-approval proposal through the seam records the allow decision', () => {
    // The adapter's own changes ALWAYS require human approval (the safe
    // reference pin). The allow DECISION path is exercised through the
    // same seam with a W003 proposal that does not require approval —
    // proving the seam surfaces the authority's typed allow record.
    const { authority } = adapterSetup();
    const proposal = {
      protocolVersion: '1.0.0',
      messageKind: 'action.proposal',
      messageId: 'msg-parity-allow-path',
      createdAt: T1,
      proposalId: 'prop-parity-allow-path',
      proposedBy: 'agent:software-workspace-adapter',
      actionType: { id: 'software.change.propose', version: '1.0.0' },
      target: { kind: 'external-resource', ref: 'sw:epoch-reference-app' },
      parameters: { workspace: 'sw:epoch-reference-app', summary: 'allow path decision' },
      preconditions: [],
      predictedEffects: [
        {
          description: 'A new revision exists after the authority-authorized execution.',
          confidence: { kind: 'deterministic' },
        },
      ],
      sideEffects: [
        { description: 'The hosted workspace history advances.', reversible: false },
      ],
      reversibility: { kind: 'partially-reversible', notes: 'History entries are immutable.' },
      authorityRequirements: {
        requiredScopes: ['external:software-workspace:read'],
        requiresHumanApproval: false,
      },
      rationale: 'allow-decision parity evidence',
    };
    const submission = authority.submitAction({
      tenantId: TENANT_A,
      actionId: 'action:parity-allow-decision',
      proposal,
      authorization: { principalId: PRINCIPAL, context: allowingContext() },
      decidedAt: T1,
    });
    expect(submission.ok).toBe(true);
    if (!submission.ok) throw new Error(submission.error.message);
    expect(submission.decision.outcome).toBe('allow');
    expect(submission.decision.actionStatus).toBe('authorized');
  });

  it('the deny path: no applicable policy is the typed authority-denied disposition', () => {
    // An EMPTY policy set: the real gateway is fail-closed (no-applicable-policy).
    const { action, host } = adapterSetup({ policies: [] });
    host.ingestSnapshot({ tenantId: TENANT_A, payload: referenceSnapshot(), ingestedAt: T0 });
    const dispatch = action.route({
      tenant: TENANT_A,
      workspace: 'sw:epoch-reference-app',
      changeKind: 'revision',
      summary: 'deny path evidence',
      actionId: 'action:parity-deny',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T2,
    });
    if (!dispatch.ok) throw new Error(dispatch.error.message);
    expect(dispatch.value.decision.outcome).toBe('deny');
    expect(dispatch.value.decision.denialCode).toBe('no-applicable-policy');
    expect(dispatch.value.disposition).toBe('authority-denied');
    expect(dispatch.value.outcome).toBeUndefined();
  });

  it('the constraint-blocked deny path: a blocking policy denies with the constraint provenance', () => {
    const gateway = new ActionGateway();
    const authority = new GatewayAuthorityPort(gateway, {
      policies: applicablePolicySet(),
      resolveConstraint: resolver,
      evaluationContext: { inputs: { changeCount: 99 } },
    });
    const { host } = adapterSetup();
    const action = new GithubActionAdapter({ host, authority, expectedTenantId: TENANT_A });
    host.ingestSnapshot({ tenantId: TENANT_A, payload: referenceSnapshot(), ingestedAt: T0 });
    const dispatch = action.route({
      tenant: TENANT_A,
      workspace: 'sw:epoch-reference-app',
      changeKind: 'revision',
      summary: 'constraint blocked evidence',
      actionId: 'action:parity-blocked',
      authority: { principalId: PRINCIPAL, context: allowingContext() },
      approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
      decidedAt: T1,
      executedAt: T2,
    });
    if (!dispatch.ok) throw new Error(dispatch.error.message);
    expect(dispatch.value.decision.outcome).toBe('deny');
    expect(dispatch.value.decision.denialCode).toBe('constraint-blocked');
  });
});

const PARSED_FIXTURE = parseProviderSnapshot(referenceSnapshot());
const PROJECTION = PARSED_FIXTURE.success
  ? projectSnapshot({ tenantId: TENANT_A, snapshot: PARSED_FIXTURE.data, observedAt: T0 })
  : undefined;

describe('W002 world-model parity (observation records are assertion-shaped)', () => {
  const projection = PROJECTION;

  it('every projected statement passes the REAL W002 statement validator', () => {
    if (projection === undefined) throw new Error('fixture parse failed');
    for (const record of projection.records) {
      const statement = AssertionStatementSchema.safeParse(record.statement);
      expect(statement.success, JSON.stringify(record.statement)).toBe(true);
    }
  });

  it('every projected provenance/confidence/validity passes the REAL W002 validators', () => {
    if (projection === undefined) throw new Error('fixture parse failed');
    for (const record of projection.records) {
      expect(ProvenanceSchema.safeParse(record.provenance).success).toBe(true);
      expect(ConfidenceSchema.safeParse(record.confidence).success).toBe(true);
      if (record.validity !== undefined) {
        expect(ValiditySchema.safeParse(record.validity).success).toBe(true);
      }
    }
  });

  it('each observation maps to a REAL W002 AssertionInput (authority-gated write input)', () => {
    if (projection === undefined) throw new Error('fixture parse failed');
    for (const record of projection.records) {
      const input = {
        statement: record.statement,
        provenance: record.provenance,
        confidence: record.confidence,
        validity: record.validity,
        at: record.observedAt,
      };
      const admitted = AssertionInputSchema.safeParse(input);
      expect(admitted.success, JSON.stringify(input)).toBe(true);
    }
  });

  it('the REAL WorldModel authority admits the projected observations as world assertions', () => {
    if (projection === undefined) throw new Error('fixture parse failed');
    const world = WorldModel.create();
    // The projected 'software:' vocabulary is DOMAIN-PACK territory (the
    // adapter maps INTO it, never owns it): the host registers the
    // vocabulary before the authority admits the observations.
    world.registerEntityType({ key: 'software:workspace', extends: 'core:entity', description: 'A hosted software workspace.' });
    world.registerEntityType({ key: 'software:revision', extends: 'core:entity', description: 'One revision of a software workspace.' });
    world.registerEntityType({ key: 'software:work-item', extends: 'core:entity', description: 'One tracked work item of a software workspace.' });
    world.registerRelationType({ key: 'software:contains-revision', description: 'The workspace contains the revision.', sourceType: 'core:entity', targetType: 'core:entity' });
    world.registerRelationType({ key: 'software:parent-revision', description: 'The revision descends from the parent revision.', sourceType: 'core:entity', targetType: 'core:entity' });
    world.registerRelationType({ key: 'software:references-revision', description: 'The work item references the revision.', sourceType: 'core:entity', targetType: 'core:entity' });
    // Entities first, then properties/relations (a host ingests in
    // dependency order; the world model validates relation endpoints).
    const entities = projection.records.filter((record) => record.statement.kind === 'entity');
    const derived = projection.records.filter((record) => record.statement.kind !== 'entity');
    for (const record of [...entities, ...derived]) {
      const input = {
        statement: record.statement,
        provenance: record.provenance,
        confidence: record.confidence,
        validity: record.validity,
        at: record.observedAt,
      };
      // The world model ASSIGNS assertion ids and sequence numbers: the
      // adapter produced INPUTS, never authority records.
      const assertion = world.applyAssertion(input);
      expect(assertion.id).toMatch(/^ass-[0-9]+$/);
      expect(assertion.provenance.actor.role).toBe('external-provider');
      expect(assertion.status).toBe('live');
    }
    const statistics = world.statistics();
    expect(statistics.assertionCount).toBe(projection.records.length);
    expect(statistics.liveAssertionCount).toBe(projection.records.length);
  });
});

describe('W006 evidence parity (the source reference is exact-revision evidence)', () => {
  const projection = PROJECTION;
  it('a projection observation addresses a W006 evidence record (exact-revision subject)', () => {
    if (projection === undefined) throw new Error('fixture parse failed');
    const evidence = {
      schemaVersion: 1,
      kind: 'observation',
      subject: {
        artifactId: projection.source.artifactId,
        revision: projection.source.revision,
        digest: projection.source.digest,
      },
      producedBy: {
        runId: `projection:${projection.projectionDigest}`,
        actorId: 'adapter:software-workspace-source',
      },
      observedAt: projection.observedAt,
      content: {
        mediaType: 'application/json',
        data: { projectionDigest: projection.projectionDigest },
      },
      confidence: {
        distribution: { kind: 'point', value: 1 },
        method: 'imported',
      },
    };
    const parsed = parseEvidenceRecord(evidence);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
  });

  it('the projection verifies end-to-end (digest discipline)', () => {
    if (projection === undefined) throw new Error('fixture parse failed');
    expect(verifyProjection(projection).ok).toBe(true);
  });
});
