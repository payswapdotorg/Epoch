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
import { negotiateBinding } from '@epoch/adapter-sdk';
import {
  GithubActionAdapter,
  GithubAdapterHost,
  GithubSourceAdapter,
  deriveCapabilityRegistrations,
  type ActionAuthorityPort,
  type ActionAuthoritySubmission,
  type ActionAuthorityExecutionRequest,
  type AuthorityDecisionRecord,
  type AuthorityOutcomeRecord,
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
export const PRINCIPAL = 'principal:workspace-engineer';
export const APPROVER = { id: 'principal:workspace-lead', role: 'human-approver' } as const;

/** A W009 authorization context that ALLOWS PRINCIPAL in TENANT_A. */
export function allowingContext() {
  return {
    schemaVersion: 1,
    principals: [{ principalId: PRINCIPAL, status: 'active', authenticated: true }],
    memberships: [{ principalId: PRINCIPAL, tenantId: TENANT_A }],
    knownTenants: [TENANT_A],
  };
}

/** Compiled hard constraint: violated iff `changeCount >= 10`. */
const changeBudgetAuthored = {
  languageVersion: '1.0.0',
  id: 'change-budget',
  version: '1.0.0',
  inputs: [{ name: 'changeCount', type: 'number' }],
  class: 'hard',
  predicate: {
    node: 'lt',
    left: { node: 'input', name: 'changeCount' },
    right: { node: 'lit', type: 'number', value: 10 },
  },
};

function compileFixture(authored: unknown): CompiledConstraint {
  const outcome = compileConstraint(authored);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors));
  return outcome.compiled;
}

export const COMPILED: Record<string, CompiledConstraint> = {
  'change-budget': compileFixture(changeBudgetAuthored),
};

/** The default resolver. */
export const resolver: ConstraintResolver = (binding) => COMPILED[binding.constraintId];

/**
 * The tenant-scoped policy set applying the change budget to the
 * adapter's action kinds (NON-blocking when changeCount < 10).
 */
export function applicablePolicySet(): unknown[] {
  return [
    {
      languageVersion: '1.0.0',
      id: 'tenant-change-budget-policy',
      version: '1.0.0',
      name: 'Tenant change budget policy',
      enabled: true,
      applicability: {
        tenantId: TENANT_A,
        actionKinds: [
          'software.change.propose',
          'software.integration.propose',
        ],
      },
      bindings: [{ constraintId: 'change-budget' }],
      precedence: { tier: 'tenant', rank: 5 },
      composition: 'additive',
    },
  ];
}

/**
 * The reference wiring: the REAL W022 ActionGateway behind the adapter's
 * `ActionAuthorityPort` seam. This is the compile-time + runtime parity
 * object: the fields the adapter passes are exactly the fields the real
 * gateway consumes, and the decision/outcome records are the gateway's
 * own sealed records.
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
      // duplicate-decision — the existing decision stands, so the seam
      // surfaces it as the current decision (the adapter stays one-shot).
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

/** The binding pin for a capability record, negotiated through the REAL SDK. */
export function pinFor(
  adapter: GithubSourceAdapter | GithubActionAdapter,
  registry: CapabilityRegistry,
): { capabilityId: string; capabilityVersion: string; manifestDigest: string; adapterId: string; adapterDescriptorDigest: string } {
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

/** The canonical adapter host + both surfaces, wired for tests. */
export function adapterSetup(options?: {
  readonly policies?: readonly unknown[];
  readonly tenantId?: string;
}) {
  const host = new GithubAdapterHost({ expectedTenantId: options?.tenantId ?? TENANT_A });
  const gateway = new ActionGateway();
  const authority = new GatewayAuthorityPort(gateway, {
    policies: options?.policies ?? applicablePolicySet(),
    resolveConstraint: resolver,
    evaluationContext: { inputs: { changeCount: 1 } },
  });
  const source = new GithubSourceAdapter({ host, expectedTenantId: TENANT_A });
  const action = new GithubActionAdapter({ host, authority, expectedTenantId: TENANT_A });
  return { host, gateway, authority, source, action };
}
