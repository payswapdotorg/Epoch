// Shared fixtures: valid W003 proposals, W004 policy sets, compiled
// constraints and evaluation inputs used across the action-policy tests.
import { compileConstraint } from '@epoch/policy-contracts';
import type { CompiledConstraint, ConstraintResolver } from '@epoch/policy-contracts';
import type { ActionProposal } from '@epoch/action-protocol';
import type { PolicyEvaluationInput } from '../src/index';
import type { SealedPolicyDecision } from '../src/index';

/** Canonical instants (caller-supplied everywhere; zero wall-clock in src). */
export const T0 = '2025-01-15T10:00:00.000Z';
export const T1 = '2025-01-15T12:00:00.000Z';
export const T2 = '2025-01-16T09:00:00.000Z';
export const T3 = '2025-01-17T09:00:00.000Z';

/** The W009 tenant grammars. */
export const TENANT_A = 'tenant:acme';
export const TENANT_B = 'tenant:globex';
export const WORKSPACE = 'workspace:acme-eng';
export const PROJECT = 'project:acme-retrofit';

/** A valid proposal that DOES require human approval (W003 fixture style). */
export function approvalProposal(overrides?: {
  proposalId?: string;
  messageId?: string;
  actionTypeId?: string;
  expiresAt?: string;
}): ActionProposal {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'action.proposal',
    messageId: overrides?.messageId ?? 'msg-7001-proposal',
    createdAt: T0,
    proposalId: overrides?.proposalId ?? 'prop-2025-0042',
    proposedBy: 'agent:stress-checker',
    actionType: { id: overrides?.actionTypeId ?? 'structural.element.reinforce', version: '1.0.0' },
    target: { kind: 'world-entity', ref: 'entity:beam-b-12' },
    parameters: { 'reinforcement-class': 'B', 'concrete-cover-mm': 40 },
    preconditions: [
      {
        description: 'Element is not already at maximum reinforcement ratio.',
        constraintRef: 'constraint:reinforcement-ratio-max',
      },
    ],
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
      approvalQuorum: { approvals: 1, roles: ['senior-structural-engineer', 'lead-reviewer'] },
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

/** Compiled soft constraint: violated iff `spend >= 20` (penalty 4). */
const preferCheapAuthored = {
  languageVersion: '1.0.0',
  id: 'prefer-cheap',
  version: '1.0.0',
  inputs: [{ name: 'spend', type: 'number' }],
  class: 'soft',
  predicate: {
    node: 'lt',
    left: { node: 'input', name: 'spend' },
    right: { node: 'lit', type: 'number', value: 20 },
  },
  weight: 4,
};

function compileFixture(authored: unknown): CompiledConstraint {
  const outcome = compileConstraint(authored);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors));
  return outcome.compiled;
}

export const COMPILED: Record<string, CompiledConstraint> = {
  'hard-budget': compileFixture(hardBudgetAuthored),
  'prefer-cheap': compileFixture(preferCheapAuthored),
};

/** The default resolver: resolves both fixtures, nothing else. */
export const resolver: ConstraintResolver = (binding) => COMPILED[binding.constraintId];

/** A resolver that resolves NOTHING (fail-closed unresolved constraints). */
export const emptyResolver: ConstraintResolver = () => undefined;

/** The tenant-scoped policy set applying the hard budget to the action kind. */
export function policySet(overrides?: {
  actionKinds?: string[];
  extraPolicy?: unknown;
  dropTenantScope?: boolean;
}): unknown[] {
  const policies: unknown[] = [
    {
      languageVersion: '1.0.0',
      id: 'tenant-budget-policy',
      version: '1.0.0',
      name: 'Tenant budget policy',
      enabled: true,
      applicability: {
        ...(overrides?.dropTenantScope === true ? {} : { tenantId: TENANT_A }),
        actionKinds: overrides?.actionKinds ?? ['structural.element.reinforce'],
      },
      bindings: [{ constraintId: 'hard-budget' }],
      precedence: { tier: 'tenant', rank: 5 },
      composition: 'additive',
    },
  ];
  if (overrides?.extraPolicy !== undefined) {
    policies.push(overrides.extraPolicy);
  }
  return policies;
}

/** A second, DIFFERENT policy set (changed policy => new decision identity). */
export function changedPolicySet(): unknown[] {
  return [
    ...policySet(),
    {
      languageVersion: '1.0.0',
      id: 'workspace-preferences',
      version: '1.0.0',
      name: 'Workspace preferences',
      enabled: true,
      applicability: { workspaceId: WORKSPACE },
      bindings: [{ constraintId: 'prefer-cheap' }],
      precedence: { tier: 'workspace', rank: 1 },
      composition: 'additive',
    },
  ];
}

/** A spend-under-budget evaluation context. */
export function contextWithSpend(spend: number): { inputs: { spend: number } } {
  return { inputs: { spend } };
}

/** The canonical evaluation input (approval path, compliant spend). */
export function evaluationInput(overrides?: {
  tenantId?: string;
  proposal?: unknown;
  policies?: readonly unknown[];
  spend?: number;
  resolveConstraint?: ConstraintResolver;
  decidedAt?: string;
  approval?: { deadline: string; maxDelegationDepth: number } | null;
  scope?: { workspaceId?: string; projectId?: string };
}): PolicyEvaluationInput {
  return {
    tenantId: overrides?.tenantId ?? TENANT_A,
    scope: overrides?.scope,
    proposal: overrides?.proposal ?? approvalProposal(),
    policies: overrides?.policies ?? policySet(),
    resolveConstraint: overrides?.resolveConstraint ?? resolver,
    evaluationContext: contextWithSpend(overrides?.spend ?? 10),
    decidedAt: overrides?.decidedAt ?? T1,
    approval:
      overrides?.approval === null
        ? undefined
        : (overrides?.approval ?? { deadline: '2025-01-18T10:00:00.000Z', maxDelegationDepth: 1 }),
  };
}

/** Unwrap a registry result or fail the test with the typed error. */
export function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) {
    throw new Error(`unexpected typed error: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** The human approver references (W003 AuthorizerReference grammar). */
export const APPROVER_1 = { id: 'principal:eng-lead', role: 'human-approver' } as const;
export const APPROVER_2 = { id: 'principal:reviewer', role: 'human-approver' } as const;
export const GATEWAY = { id: 'gateway:main', role: 'action-gateway' } as const;

/** The head of a decision chain (the in-force decision). */
export function chainHead(chain: readonly SealedPolicyDecision[]): SealedPolicyDecision {
  return chain[chain.length - 1]!;
}
