// Shared fixtures for the agent-orchestration tests. Builders return loose
// JSON objects so negative tests can corrupt single fields precisely (the
// W006/W007 helpers pattern). ZERO clock reads: instants are fixed
// constants (caller-supplied data); proposals and capabilities are built
// through the REAL upstream admission pipelines (W003 action-protocol,
// W007 capability-registry) — never hand-rolled digests.
import { parseActionProposal } from '@epoch/action-protocol';
import type { ActionProposal } from '@epoch/action-protocol';
import {
  CapabilityRegistry,
  computeCapabilityManifestDigest,
} from '@epoch/capability-registry';
import type { CapabilityRegistration } from '@epoch/capability-registry';
import { bindOrchestratedAgent } from '../src/index';
import type { AgentBinding } from '../src/index';

export const T0 = '2026-03-01T09:00:00.000Z';
export const T1 = '2026-03-01T09:00:01.000Z';
export const T2 = '2026-03-01T09:00:02.000Z';
export const T3 = '2026-03-01T09:00:03.000Z';
export const T4 = '2026-03-01T09:00:04.000Z';

const SPEC = {
  name: 'load-kn',
  kind: 'number',
  required: true,
  description: 'Rated load in kilonewtons.',
  unit: 'kN',
} as const;

/** A provider-neutral capability manifest as loose JSON. */
export function capabilityManifest(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    capabilityId: 'engineering.stress-analysis',
    category: 'simulation',
    version: '1.2.3',
    descriptor: {
      displayName: 'Stress Analysis',
      description: 'Linear static stress analysis over the reconstructed model.',
      inputs: [SPEC],
      outputs: [
        {
          name: 'max-stress-mpa',
          kind: 'number',
          required: true,
          description: 'Peak von Mises stress.',
          unit: 'MPa',
        },
      ],
      assumptions: ['Linear-elastic material behavior within rated load.'],
    },
    contracts: [{ contractId: 'epoch.simulation-protocol', contractVersion: '1.0.0' }],
    trust: { origin: 'first-party', curator: 'actor:epoch-core' },
    ...overrides,
  };
}

/** Seal a manifest with its recomputed digest; throws on invalid fixtures. */
export function sealedCapability(manifestInput: Record<string, unknown>): CapabilityRegistration {
  return {
    manifest: manifestInput as unknown as CapabilityRegistration['manifest'],
    digest: computeCapabilityManifestDigest(
      manifestInput as unknown as CapabilityRegistration['manifest'],
    ),
  };
}

/**
 * The reference registry for the fixture vocabulary: stress-analysis
 * (registered), drafting (registered, second version deprecated), legacy
 * solver (retired), and a deprecated-but-bindable analyzer.
 */
export function fixtureRegistry(): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  const registrations: Array<[string, string, string]> = [
    ['engineering.stress-analysis', 'simulation', '1.2.3'],
    ['engineering.drafting', 'visualization', '2.0.0'],
    ['engineering.legacy-solver', 'verification', '1.0.0'],
    ['engineering.deprecated-analyzer', 'semantic', '0.9.0'],
  ];
  for (const [capabilityId, category, version] of registrations) {
    const registered = registry.register(
      sealedCapability(
        capabilityManifest({ capabilityId, category, version }),
      ),
    );
    if (!registered.ok) {
      throw new Error(`fixture capability must register: ${JSON.stringify(registered.error)}`);
    }
  }
  // Deprecate the analyzer (advisory — still binds).
  const deprecated = registry.deprecate({
    capabilityId: 'engineering.deprecated-analyzer',
    version: '0.9.0',
  });
  if (!deprecated.ok) {
    throw new Error(`fixture capability must deprecate: ${JSON.stringify(deprecated.error)}`);
  }
  // Retire the legacy solver (terminal — never binds).
  const retired = registry.retire({
    capabilityId: 'engineering.legacy-solver',
    version: '1.0.0',
  });
  if (!retired.ok) {
    throw new Error(`fixture capability must retire: ${JSON.stringify(retired.error)}`);
  }
  return registry;
}

/** An action proposal as loose JSON (the W003 vocabulary, fully populated). */
export function proposalFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'action.proposal',
    messageId: 'msg-proposal-001',
    createdAt: T0,
    proposalId: 'prop-survey-001',
    proposedBy: 'agent:field-surveyor',
    actionType: { id: 'engineering.element.reinforce', version: '1.0.0' },
    target: { kind: 'world-entity', ref: 'element:column-c4' },
    parameters: { load_kn: 42 },
    preconditions: [
      { description: 'Column C4 reconstructed with confidence >= 0.8.' },
    ],
    predictedEffects: [
      {
        description: 'Column C4 load capacity rises to 60 kN.',
        confidence: { kind: 'quantified', value: 0.9 },
      },
    ],
    sideEffects: [
      {
        description: 'Temporary scaffolding required during cure.',
        reversible: true,
      },
    ],
    reversibility: { kind: 'reversible', via: 'manual' },
    authorityRequirements: {
      requiredScopes: ['world:write'],
      requiresHumanApproval: false,
    },
    ...overrides,
  };
}

/** Admit a proposal through the REAL W003 pipeline; throws on invalid fixtures. */
export function admittedProposal(
  fixture: Record<string, unknown>,
): { proposal: ActionProposal; digest: string } {
  const parsed = parseActionProposal(fixture);
  if (!parsed.ok) {
    throw new Error(`fixture proposal must admit: ${JSON.stringify(parsed.error)}`);
  }
  return { proposal: parsed.value, digest: parsed.digest };
}

/** An orchestrated agent descriptor as loose JSON. */
export function agentFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    agentId: 'agent:field-surveyor',
    displayName: 'Field Surveyor',
    capabilities: [{ capabilityId: 'engineering.stress-analysis', version: '1.2.3' }],
    ...overrides,
  };
}

/** Bind an agent through the REAL kernel binder; throws on invalid fixtures. */
export function boundAgent(
  registry: CapabilityRegistry,
  fixture: Record<string, unknown> = agentFixture(),
): AgentBinding {
  const bound = bindOrchestratedAgent({ agent: fixture, registry });
  if (!bound.ok) {
    throw new Error(`fixture agent must bind: ${JSON.stringify(bound.error)}`);
  }
  return bound.value;
}

/** An authored plan as loose JSON over the standard three-proposal fixture set. */
export function planFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    tenantId: 'tenant:acme',
    planId: 'plan:column-reinforcement',
    displayName: 'Column C4 reinforcement',
    createdBy: 'principal:lead-eng',
    steps: [
      {
        stepId: 'survey',
        agentId: 'agent:field-surveyor',
        proposal: proposalReference('prop-survey-001'),
        dependsOn: [],
      },
      {
        stepId: 'analyze',
        agentId: 'agent:stress-analyst',
        proposal: proposalReference('prop-analyze-001'),
        dependsOn: ['survey'],
      },
      {
        stepId: 'reinforce',
        agentId: 'agent:stress-analyst',
        proposal: proposalReference('prop-reinforce-001'),
        dependsOn: ['analyze'],
      },
    ],
    ...overrides,
  };
}

/** Proposal-reference shape for plan fixtures (digest filled by the caller). */
export function proposalReference(proposalId: string, digest = '0'.repeat(64)): Record<string, unknown> {
  return { proposalId, canonicalDigest: digest };
}

/**
 * The standard three-proposal admitted set for {@link planFixture}:
 * survey (by field-surveyor), analyze + reinforce (by stress-analyst).
 */
export function standardProposalSet(): Array<Record<string, unknown>> {
  return [
    proposalFixture(),
    proposalFixture({
      messageId: 'msg-proposal-002',
      proposalId: 'prop-analyze-001',
      proposedBy: 'agent:stress-analyst',
      actionType: { id: 'engineering.stress-analysis', version: '1.0.0' },
      target: { kind: 'world-entity', ref: 'element:column-c4' },
    }),
    proposalFixture({
      messageId: 'msg-proposal-003',
      proposalId: 'prop-reinforce-001',
      proposedBy: 'agent:stress-analyst',
      actionType: { id: 'engineering.element.reinforce', version: '1.0.0' },
    }),
  ];
}

/** Bind the two standard agents against the fixture registry. */
export function standardAgents(registry: CapabilityRegistry): AgentBinding[] {
  return [
    boundAgent(registry, agentFixture()),
    boundAgent(
      registry,
      agentFixture({
        agentId: 'agent:stress-analyst',
        displayName: 'Stress Analyst',
        capabilities: [{ capabilityId: 'engineering.stress-analysis', version: '1.2.3' }],
      }),
    ),
  ];
}

/** Fill a plan fixture's proposal references with the REAL proposal digests. */
export function withRealDigests(
  plan: Record<string, unknown>,
  proposals: Array<Record<string, unknown>>,
): Record<string, unknown> {
  const digests = new Map<string, string>();
  for (const fixture of proposals) {
    const admitted = admittedProposal(fixture);
    digests.set(admitted.proposal.proposalId, admitted.digest);
  }
  const steps = (plan.steps as Array<Record<string, unknown>>).map((step) => {
    const reference = step.proposal as { proposalId: string };
    return {
      ...step,
      proposal: proposalReference(reference.proposalId, digests.get(reference.proposalId)),
    };
  });
  return { ...plan, steps };
}
