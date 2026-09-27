// Shared fixtures: tenant scope, instants, the REAL W022 action-gateway
// wiring behind the adapter's authority seam, and the REAL W007 registry
// setup. devDependencies only (the runtime dependency policy is frozen).
import { ActionGateway } from '@epoch/action-gateway';
import { compileConstraint } from '@epoch/policy-contracts';
import type { CompiledConstraint, ConstraintResolver } from '@epoch/policy-contracts';
import {
  CapabilityRegistry,
  sealCapabilityManifest,
  type CapabilityRecord,
} from '@epoch/capability-registry';
import { negotiateBinding, type BindingPin } from '@epoch/adapter-sdk';
import {
  McpActionAdapter,
  McpEvaluatorAdapter,
  deriveCapabilityRegistrations,
  discoverTools,
  referenceCatalog,
  type ActionAuthorityPort,
  type ActionAuthoritySubmission,
  type ActionAuthorityExecutionRequest,
  type AuthorityDecisionRecord,
  type AuthorityOutcomeRecord,
  type ToolInvocationSurface,
} from '../src/index';

/** Canonical instants (caller-supplied everywhere; zero wall-clock in src). */
export const T0 = '2026-03-01T09:00:00.000Z';
export const T1 = '2026-03-01T10:00:00.000Z';
export const T2 = '2026-03-01T12:00:00.000Z';
export const DEADLINE = '2026-03-05T10:00:00.000Z';

/** The W009 tenant grammars. */
export const TENANT_A = 'tenant:acme';
export const TENANT_B = 'tenant:globex';

/** The acting principal (W009 grammar). */
export const PRINCIPAL = 'principal:tool-operator';
export const APPROVER = { id: 'principal:tool-lead', role: 'human-approver' } as const;

/** A W009 authorization context that ALLOWS PRINCIPAL in TENANT_A. */
export function allowingContext() {
  return {
    schemaVersion: 1,
    principals: [{ principalId: PRINCIPAL, status: 'active', authenticated: true }],
    memberships: [{ principalId: PRINCIPAL, tenantId: TENANT_A }],
    knownTenants: [TENANT_A],
  };
}

/** Compiled hard constraint: violated iff `invocationCount >= 10`. */
const invocationBudgetAuthored = {
  languageVersion: '1.0.0',
  id: 'invocation-budget',
  version: '1.0.0',
  inputs: [{ name: 'invocationCount', type: 'number' }],
  class: 'hard',
  predicate: {
    node: 'lt',
    left: { node: 'input', name: 'invocationCount' },
    right: { node: 'lit', type: 'number', value: 10 },
  },
};

function compileFixture(authored: unknown): CompiledConstraint {
  const outcome = compileConstraint(authored);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors));
  return outcome.compiled;
}

export const COMPILED: Record<string, CompiledConstraint> = {
  'invocation-budget': compileFixture(invocationBudgetAuthored),
};

/** The default resolver. */
export const resolver: ConstraintResolver = (binding) => COMPILED[binding.constraintId];

/** The tenant-scoped policy set applying the invocation budget to the adapter's action kind. */
export function applicablePolicySet(): unknown[] {
  return [
    {
      languageVersion: '1.0.0',
      id: 'tenant-invocation-budget-policy',
      version: '1.0.0',
      name: 'Tenant invocation budget policy',
      enabled: true,
      applicability: {
        tenantId: TENANT_A,
        actionKinds: ['tool.invoke'],
      },
      bindings: [{ constraintId: 'invocation-budget' }],
      precedence: { tier: 'tenant', rank: 5 },
      composition: 'additive',
    },
  ];
}

/**
 * The reference wiring: the REAL W022 ActionGateway behind the adapter's
 * `ActionAuthorityPort` seam (the compile-time + runtime parity object).
 */
export class GatewayAuthorityPort implements ActionAuthorityPort {
  constructor(
    private readonly gateway: ActionGateway,
    private readonly options: {
      readonly policies: readonly unknown[];
      readonly resolveConstraint: ConstraintResolver;
      readonly evaluationContext?: unknown;
    },
  ) {}

  submitAction(request: ActionAuthoritySubmission) {
    const result = this.gateway.submitAction({
      tenantId: request.tenantId,
      actionId: request.actionId,
      proposal: request.proposal,
      policies: this.options.policies,
      resolveConstraint: this.options.resolveConstraint,
      ...(this.options.evaluationContext !== undefined
        ? { evaluationContext: this.options.evaluationContext }
        : {}),
      authorization: request.authorization,
      decidedAt: request.decidedAt,
      ...(request.approval !== undefined ? { approval: request.approval } : {}),
    });
    if (!result.ok) {
      // Idempotent intake: a re-submission of the SAME proposal revision
      // under the same policy set is the gateway's typed
      // duplicate-decision — the existing decision stands.
      if (result.error.code === 'duplicate-decision') {
        const decision = result.error.existingDecision;
        const stored = this.gateway.getAction({ tenantId: request.tenantId, actionId: request.actionId });
        const record: AuthorityDecisionRecord = {
          schemaVersion: 1,
          tenantId: request.tenantId,
          actionId: request.actionId,
          outcome: decision.outcome,
          decisionDigest: decision.contentDigest,
          ...(decision.denial !== undefined
            ? { denialCode: decision.denial.code, denialReason: decision.denial.reason }
            : {}),
          actionStatus: stored.ok ? stored.value.status : 'awaiting-approval',
          decidedAt: decision.decidedAt,
        };
        return { ok: true as const, decision: record };
      }
      return { ok: false as const, error: { code: result.error.code, message: result.error.message } };
    }
    const decision = result.value.decision;
    const record: AuthorityDecisionRecord = {
      schemaVersion: 1,
      tenantId: request.tenantId,
      actionId: request.actionId,
      outcome: decision.outcome,
      decisionDigest: decision.contentDigest,
      ...(decision.denial !== undefined
        ? { denialCode: decision.denial.code, denialReason: decision.denial.reason }
        : {}),
      actionStatus: result.value.action.status,
      decidedAt: decision.decidedAt,
    };
    return { ok: true as const, decision: record };
  }

  executeAction(request: ActionAuthorityExecutionRequest) {
    const result = this.gateway.executeAction({
      tenantId: request.tenantId,
      actionId: request.actionId,
      authorization: request.authorization,
      ...(request.evidenceRefs !== undefined ? { evidenceRefs: request.evidenceRefs } : {}),
      at: request.at,
    });
    if (!result.ok) {
      return { ok: false as const, error: { code: result.error.code, message: result.error.message } };
    }
    const outcome = result.value.outcome;
    const record: AuthorityOutcomeRecord = {
      schemaVersion: 1,
      tenantId: request.tenantId,
      actionId: request.actionId,
      kind: outcome.kind,
      ...(outcome.failure !== undefined
        ? { failure: { code: outcome.failure.code, reason: outcome.failure.reason } }
        : {}),
      evidenceRefs: outcome.evidenceRefs,
      outcomeDigest: outcome.contentDigest,
      executedAt: outcome.executedAt,
    };
    return { ok: true as const, outcome: record };
  }
}

/** The REAL W007 registry with the adapter's derived registrations admitted. */
export function registryWithAdapter(): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  for (const registration of deriveCapabilityRegistrations()) {
    const sealed = sealCapabilityManifest(registration.manifest);
    if (!sealed.ok) {
      throw new Error(`derived manifest failed W007 sealing: ${sealed.error.message}`);
    }
    if (sealed.value.digest !== registration.digest) {
      throw new Error('derived digest does not equal the registry-computed digest');
    }
    const admitted = registry.register(sealed.value);
    if (!admitted.ok) {
      throw new Error(`registration rejected: ${admitted.error.message}`);
    }
  }
  return registry;
}

/** The binding pin for an adapter surface, negotiated through the REAL SDK. */
export function pinFor(
  adapter: McpActionAdapter | McpEvaluatorAdapter,
  registry: CapabilityRegistry,
): BindingPin {
  const record = registry
    .list({ category: adapter.descriptor.category })
    .find((entry: CapabilityRecord) => entry.manifest.capabilityId === adapter.descriptor.binding.capabilityId);
  if (record === undefined) {
    throw new Error(`capability ${adapter.descriptor.binding.capabilityId} is not registered`);
  }
  const negotiated = negotiateBinding(adapter.descriptor, record);
  if (!negotiated.ok) {
    throw new Error(`binding negotiation failed: ${negotiated.error.message}`);
  }
  return negotiated.value;
}

/** The discovered invocation surfaces of the reference catalog. */
export function referenceSurfaces(): readonly ToolInvocationSurface[] {
  const discovered = discoverTools({ tenantId: TENANT_A, payload: referenceCatalog() });
  if (!discovered.ok) throw new Error(discovered.error.message);
  return discovered.value;
}

/** The canonical adapter setup: discovery + both surfaces wired to the REAL gateway. */
export function adapterSetup(options?: { readonly policies?: readonly unknown[] }) {
  const gateway = new ActionGateway();
  const authority = new GatewayAuthorityPort(gateway, {
    policies: options?.policies ?? applicablePolicySet(),
    resolveConstraint: resolver,
    evaluationContext: { inputs: { invocationCount: 1 } },
  });
  const action = new McpActionAdapter({
    surfaces: referenceSurfaces(),
    authority,
    expectedTenantId: TENANT_A,
  });
  const evaluator = new McpEvaluatorAdapter({
    invocations: action.invocationStore(),
    expectedTenantId: TENANT_A,
  });
  return { gateway, authority, action, evaluator };
}
