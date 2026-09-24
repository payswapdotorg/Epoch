// Shared fixtures: valid action-protocol documents used across tests.
import type { ActionProposal } from '../src/proposal';
import type { AuthorizationDecision, AuthorizationRequest } from '../src/authorization';

export function validProposal(overrides?: {
  proposedBy?: string;
  messageId?: string;
}): ActionProposal {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'action.proposal',
    messageId: overrides?.messageId ?? 'msg-1001-proposal',
    createdAt: '2025-01-15T10:00:00.000Z',
    proposalId: 'prop-2025-0001',
    proposedBy: overrides?.proposedBy ?? 'agent:stress-checker',
    actionType: { id: 'structural.element.reinforce', version: '1.0.0' },
    target: { kind: 'world-entity', ref: 'entity:beam-b-12' },
    parameters: {
      'reinforcement-class': 'B',
      'concrete-cover-mm': 40,
      'notes': 'Increase cover on the tension face.',
    },
    preconditions: [
      {
        description: 'Element is not already at maximum reinforcement ratio.',
        constraintRef: 'constraint:reinforcement-ratio-max',
        targetRef: { kind: 'world-entity', ref: 'entity:beam-b-12' },
      },
    ],
    predictedEffects: [
      {
        description: 'Utilization ratio drops from 1.12 to 0.86 under the live-load case.',
        targetRef: { kind: 'world-entity', ref: 'entity:beam-b-12' },
        confidence: { kind: 'quantified', value: 0.9 },
      },
      {
        description: 'Material cost increases by the added reinforcement volume.',
        confidence: { kind: 'deterministic' },
      },
    ],
    sideEffects: [
      {
        description: 'Construction crew must be scheduled for rework.',
        reversible: false,
      },
    ],
    reversibility: {
      kind: 'partially-reversible',
      notes: 'Added reinforcement can be removed, but rework labor cost is unrecoverable.',
    },
    authorityRequirements: {
      requiredScopes: ['world:write', 'external:scheduling:write'],
      requiresHumanApproval: true,
      approvalQuorum: { approvals: 1, roles: ['senior-structural-engineer'] },
    },
    rationale: 'Live-load utilization exceeds unity; cover increase is the lowest-cost fix.',
    evidenceRefs: ['simrun:2025-01-14-llc-77'],
    expiresAt: '2025-01-22T10:00:00.000Z',
  };
}

export function validAuthorizationRequest(overrides?: {
  proposalDigest?: string;
}): AuthorizationRequest {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'action.authorization-request',
    messageId: 'msg-2001-authz-req',
    createdAt: '2025-01-15T10:05:00.000Z',
    requestId: 'authzreq-2025-0001',
    proposalRef: {
      proposalId: 'prop-2025-0001',
      canonicalDigest:
        overrides?.proposalDigest ?? 'a'.repeat(64),
    },
    requestedBy: { id: 'gateway:main', role: 'action-gateway' },
    requestedScopes: ['world:write', 'external:scheduling:write'],
    justification:
      'Proposal prop-2025-0001 requests world:write and external:scheduling:write for structural rework.',
    context: {
      simulationRunRef: 'simrun:2025-01-14-llc-77',
      evaluationRef: 'eval:2025-01-14-llc-77',
    },
  };
}

export function validAuthorizationDecision(overrides?: {
  proposalDigest?: string;
  decision?: AuthorizationDecision['decision'];
}): AuthorizationDecision {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'action.authorization-decision',
    messageId: 'msg-3001-authz-dec',
    createdAt: '2025-01-15T10:10:00.000Z',
    requestId: 'authzreq-2025-0001',
    proposalRef: {
      proposalId: 'prop-2025-0001',
      canonicalDigest:
        overrides?.proposalDigest ?? 'a'.repeat(64),
    },
    decidedBy: { id: 'gateway:main', role: 'action-gateway' },
    decision: overrides?.decision ?? {
      kind: 'authorized',
      conditions: [
        {
          description: 'Execute only outside occupied hours.',
          constraintRef: 'constraint:site-hours',
        },
      ],
      validUntil: '2025-01-20T10:10:00.000Z',
    },
  };
}
