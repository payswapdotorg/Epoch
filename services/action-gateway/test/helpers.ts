// Shared fixtures: valid W003 proposals, W004 policy sets + compiled
// constraints, W009 authorization contexts, and gateway construction.
import { compileConstraint } from '@epoch/policy-contracts';
import type { CompiledConstraint, ConstraintResolver } from '@epoch/policy-contracts';
import type { ActionProposal } from '@epoch/action-protocol';
import { ActionGateway } from '../src/index';

/** Canonical instants (caller-supplied everywhere; zero wall-clock in src). */
export const T0 = '2025-01-15T10:00:00.000Z';
export const T1 = '2025-01-15T12:00:00.000Z';
export const T2 = '2025-01-16T09:00:00.000Z';
export const T3 = '2025-01-17T09:00:00.000Z';
export const DEADLINE = '2025-01-18T10:00:00.000Z';
export const PAST_DEADLINE = '2025-01-19T00:00:00.000Z';

/** The W009 tenant grammars. */
export const TENANT_A = 'tenant:acme';
export const TENANT_B = 'tenant:globex';
export const WORKSPACE = 'workspace:acme-eng';

/** The acting principal (W009 grammar). */
export const PRINCIPAL = 'principal:site-engineer';
export const APPROVER_1 = { id: 'principal:eng-lead', role: 'human-approver' } as const;
export const APPROVER_2 = { id: 'principal:reviewer', role: 'human-approver' } as const;
export const GATEWAY_AUTHORIZER = { id: 'gateway:main', role: 'action-gateway' } as const;

/** A valid proposal that DOES require human approval (quorum 1). */
export function approvalProposal(overrides?: {
  proposalId?: string;
  messageId?: string;
  actionTypeId?: string;
  expiresAt?: string;
  quorum?: number;
}): ActionProposal {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'action.proposal',
    messageId: overrides?.messageId ?? 'msg-8001-proposal',
    createdAt: T0,
    proposalId: overrides?.proposalId ?? 'prop-2025-0100',
    proposedBy: 'agent:stress-checker',
    actionType: { id: overrides?.actionTypeId ?? 'structural.element.reinforce', version: '1.0.0' },
    target: { kind: 'world-entity', ref: 'entity:beam-b-12' },
    parameters: { 'reinforcement-class': 'B', 'concrete-cover-mm': 40 },
    preconditions: [],
    predictedEffects: [
      {
        description: 'Utilization ratio drops from 1.12 to 0.86 under the live-load case.',
        confidence: { kind: 'quantified', value: 0.9 },
      },
    ],
    sideEffects: [{ description: 'Construction crew must be scheduled for rework.', reversible: false }],
    reversibility: {
      kind: 'partially-reversible',
      notes: 'Added reinforcement can be removed, but rework labor cost is unrecoverable.',
    },
    authorityRequirements: {
      requiredScopes: ['world:write'],
      requiresHumanApproval: true,
      approvalQuorum: {
        approvals: overrides?.quorum ?? 1,
        roles: ['senior-structural-engineer', 'lead-reviewer'],
      },
    },
    rationale: 'Live-load utilization exceeds unity; cover increase is the lowest-cost fix.',
    evidenceRefs: ['simrun:2025-01-14-llc-77'],
    expiresAt: overrides?.expiresAt ?? '2025-01-22T10:00:00.000Z',
  };
}

/** A valid proposal that does NOT require human approval. */
export function plainProposal(overrides?: {
  proposalId?: string;
  messageId?: string;
  actionTypeId?: string;
  expiresAt?: string;
}): ActionProposal {
  const base = approvalProposal(overrides);
  return {
    ...base,
    authorityRequirements: {
      requiredScopes: ['world:read'],
      requiresHumanApproval: false,
    },
  };
}

/** Compiled hard constraint: violated iff `spend >= 100`. */
const hardBudgetAuthored = {
  languageVersion: '1.0.0',
  id: 'hard-budget',
  version: '1.0.0',
  inputs: [{ name: 'spend', type: 'number' }],
  class: 'hard',
  predicate: {
    node: 'lt',
    left: { node: 'input', name: 'spend' },
    right: { node: 'lit', type: 'number', value: 100 },
  },
};

function compileFixture(authored: unknown): CompiledConstraint {
  const outcome = compileConstraint(authored);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors));
  return outcome.compiled;
}

export const COMPILED: Record<string, CompiledConstraint> = {
  'hard-budget': compileFixture(hardBudgetAuthored),
};

/** The default resolver. */
export const resolver: ConstraintResolver = (binding) => COMPILED[binding.constraintId];

/** The tenant-scoped policy set applying the hard budget to the action kind. */
export function policySet(): unknown[] {
  return [
    {
      languageVersion: '1.0.0',
      id: 'tenant-budget-policy',
      version: '1.0.0',
      name: 'Tenant budget policy',
      enabled: true,
      applicability: {
        tenantId: TENANT_A,
        actionKinds: ['structural.element.reinforce'],
      },
      bindings: [{ constraintId: 'hard-budget' }],
      precedence: { tier: 'tenant', rank: 5 },
      composition: 'additive',
    },
  ];
}

/** A second, DIFFERENT policy set (changed policy => new decision). */
export function changedPolicySet(): unknown[] {
  return [
    ...policySet(),
    {
      languageVersion: '1.0.0',
      id: 'extra-requirements',
      version: '1.0.0',
      name: 'Extra requirements',
      enabled: true,
      applicability: { tenantId: TENANT_A },
      bindings: [{ constraintId: 'hard-budget' }],
      precedence: { tier: 'workspace', rank: 1 },
      composition: 'additive',
    },
  ];
}

/** A W009 authorization context that ALLOWS PRINCIPAL in TENANT_A. */
export function allowingContext() {
  return {
    schemaVersion: 1,
    principals: [{ principalId: PRINCIPAL, status: 'active', authenticated: true }],
    memberships: [{ principalId: PRINCIPAL, tenantId: TENANT_A }],
    knownTenants: [TENANT_A],
  };
}

/** A W009 authorization context where PRINCIPAL is UNAUTHENTICATED. */
export function unauthenticatedContext() {
  return {
    schemaVersion: 1,
    principals: [{ principalId: PRINCIPAL, status: 'active', authenticated: false }],
    memberships: [{ principalId: PRINCIPAL, tenantId: TENANT_A }],
    knownTenants: [TENANT_A],
  };
}

/** A W009 authorization context where PRINCIPAL is UNKNOWN. */
export function unknownPrincipalContext() {
  return {
    schemaVersion: 1,
    principals: [],
    memberships: [],
    knownTenants: [TENANT_A],
  };
}

/** The canonical intake options (authorization + policy + approval directive). */
export function submitOptions(overrides?: {
  actionId?: string;
  tenantId?: string;
  proposal?: unknown;
  policies?: readonly unknown[];
  spend?: number;
  authorization?: { principalId?: string; context?: unknown; justification?: string };
  decidedAt?: string;
  approval?: { deadline: string; maxDelegationDepth: number } | null;
  scope?: { workspaceId?: string; projectId?: string };
}) {
  return {
    tenantId: overrides?.tenantId ?? TENANT_A,
    actionId: overrides?.actionId ?? 'action:reinforce-beam-b12',
    proposal: overrides?.proposal ?? approvalProposal(),
    policies: overrides?.policies ?? policySet(),
    resolveConstraint: resolver,
    evaluationContext: { inputs: { spend: overrides?.spend ?? 10 } },
    ...(overrides?.scope !== undefined ? { scope: overrides.scope } : {}),
    authorization: {
      principalId: overrides?.authorization?.principalId ?? PRINCIPAL,
      context: overrides?.authorization?.context ?? allowingContext(),
      ...(overrides?.authorization?.justification !== undefined
        ? { justification: overrides.authorization.justification }
        : {}),
    },
    decidedAt: overrides?.decidedAt ?? T1,
    ...(overrides?.approval === null
      ? {}
      : { approval: overrides?.approval ?? { deadline: DEADLINE, maxDelegationDepth: 1 } }),
  };
}

/** The canonical execution options. */
export function executeOptions(overrides?: {
  actionId?: string;
  tenantId?: string;
  expectedProposalDigest?: string;
  evidenceRefs?: readonly string[];
  at?: string;
}) {
  return {
    tenantId: overrides?.tenantId ?? TENANT_A,
    actionId: overrides?.actionId ?? 'action:reinforce-beam-b12',
    ...(overrides?.expectedProposalDigest !== undefined
      ? { expectedProposalDigest: overrides.expectedProposalDigest }
      : {}),
    authorization: { principalId: PRINCIPAL, context: allowingContext() },
    ...(overrides?.evidenceRefs !== undefined ? { evidenceRefs: overrides.evidenceRefs } : {}),
    at: overrides?.at ?? T2,
  };
}

/** Unwrap a gateway result or fail the test with the typed error. */
export function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) {
    throw new Error(`unexpected typed error: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** Build a gateway fed one plain (allow-path) action. */
export function gatewayWithAuthorizedAction(): {
  gateway: ActionGateway;
  actionId: string;
  proposalDigest: string;
} {
  const gateway = new ActionGateway();
  const intake = unwrap(gateway.submitAction(submitOptions({ proposal: plainProposal() })));
  return {
    gateway,
    actionId: intake.action.actionId,
    proposalDigest: intake.action.proposalRef.canonicalDigest,
  };
}

/** The action-event phase of a sealed event (test convenience). */
export function phaseOf(event: { payload: { data: { phase: string } } }): string {
  return event.payload.data.phase;
}
