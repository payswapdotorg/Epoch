// Shared fixtures for the agent-runtime service tests. Builders return
// loose JSON objects so negative tests can corrupt single fields
// precisely (the W006/W007 helpers pattern). ZERO clock reads: instants
// are fixed constants (caller-supplied data). Proposals, capabilities,
// bindings, plans AND events are built through the REAL upstream
// pipelines (W003 action-protocol, W007 capability-registry, W010
// event-log) — never hand-rolled digests.
import { parseActionProposal } from '@epoch/action-protocol';
import type { ActionProposal } from '@epoch/action-protocol';
import {
  CapabilityRegistry,
  computeCapabilityManifestDigest,
} from '@epoch/capability-registry';
import type { CapabilityRegistration } from '@epoch/capability-registry';
import { sealEvent } from '@epoch/event-log';
import type { EventRecord } from '@epoch/event-log';
import { bindOrchestratedAgent } from '@epoch/agent-orchestration';
import type { AgentBinding, CompiledPlan } from '@epoch/agent-orchestration';
import { AgentRuntime } from '../src/index';

export const T0 = '2026-03-01T09:00:00.000Z';
export const T1 = '2026-03-01T09:00:01.000Z';
export const T2 = '2026-03-01T09:00:02.000Z';
export const T3 = '2026-03-01T09:00:03.000Z';
export const T4 = '2026-03-01T09:00:04.000Z';
export const T5 = '2026-03-01T09:00:05.000Z';

export const TENANT = 'tenant:acme';
export const OTHER_TENANT = 'tenant:bridge';
export const SESSION_ID = 'session:run-001';

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

/** The fixture registry: stress-analysis (registered), legacy-solver (retired). */
export function fixtureRegistry(): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  for (const [capabilityId, category, version] of [
    ['engineering.stress-analysis', 'simulation', '1.2.3'],
    ['engineering.legacy-solver', 'verification', '1.0.0'],
  ] as const) {
    const registered = registry.register(sealedCapability(capabilityManifest({ capabilityId, category, version })));
    if (!registered.ok) throw new Error('fixture capability must register');
  }
  const retired = registry.retire({ capabilityId: 'engineering.legacy-solver', version: '1.0.0' });
  if (!retired.ok) throw new Error('fixture capability must retire');
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
    preconditions: [{ description: 'Column C4 reconstructed with confidence >= 0.8.' }],
    predictedEffects: [
      {
        description: 'Column C4 load capacity rises to 60 kN.',
        confidence: { kind: 'quantified', value: 0.9 },
      },
    ],
    sideEffects: [
      { description: 'Temporary scaffolding required during cure.', reversible: true },
    ],
    reversibility: { kind: 'reversible', via: 'manual' },
    authorityRequirements: { requiredScopes: ['world:write'], requiresHumanApproval: false },
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

/** The standard three-proposal admitted set for the standard plan. */
export function standardProposalSet(): Array<Record<string, unknown>> {
  return [
    proposalFixture(),
    proposalFixture({
      messageId: 'msg-proposal-002',
      proposalId: 'prop-analyze-001',
      proposedBy: 'agent:stress-analyst',
      actionType: { id: 'engineering.stress-analysis', version: '1.0.0' },
    }),
    proposalFixture({
      messageId: 'msg-proposal-003',
      proposalId: 'prop-reinforce-001',
      proposedBy: 'agent:stress-analyst',
    }),
  ];
}

/** An authored plan as loose JSON over the standard three-proposal fixture set. */
export function planFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    tenantId: TENANT,
    planId: 'plan:column-reinforcement',
    displayName: 'Column C4 reinforcement',
    createdBy: 'principal:lead-eng',
    steps: [
      {
        stepId: 'survey',
        agentId: 'agent:field-surveyor',
        proposal: { proposalId: 'prop-survey-001', canonicalDigest: '0'.repeat(64) },
        dependsOn: [],
      },
      {
        stepId: 'analyze',
        agentId: 'agent:stress-analyst',
        proposal: { proposalId: 'prop-analyze-001', canonicalDigest: '0'.repeat(64) },
        dependsOn: ['survey'],
      },
      {
        stepId: 'reinforce',
        agentId: 'agent:stress-analyst',
        proposal: { proposalId: 'prop-reinforce-001', canonicalDigest: '0'.repeat(64) },
        dependsOn: ['analyze'],
      },
    ],
    ...overrides,
  };
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
      proposal: { proposalId: reference.proposalId, canonicalDigest: digests.get(reference.proposalId) },
    };
  });
  return { ...plan, steps };
}

/** The standard two bound agents. */
export function standardAgents(registry: CapabilityRegistry): AgentBinding[] {
  const bindings: AgentBinding[] = [];
  for (const fixture of [
    agentFixture(),
    agentFixture({
      agentId: 'agent:stress-analyst',
      displayName: 'Stress Analyst',
      capabilities: [{ capabilityId: 'engineering.stress-analysis', version: '1.2.3' }],
    }),
  ]) {
    const bound = bindOrchestratedAgent({ agent: fixture, registry });
    if (!bound.ok) throw new Error(`fixture agent must bind: ${JSON.stringify(bound.error)}`);
    bindings.push(bound.value);
  }
  return bindings;
}

/**
 * A runtime with the standard agents bound and the standard plan
 * compiled (not yet sessioned).
 */
export function fixtureRuntime(): { runtime: AgentRuntime; plan: CompiledPlan; registry: CapabilityRegistry } {
  const registry = fixtureRegistry();
  const runtime = new AgentRuntime();
  for (const binding of standardAgents(registry)) {
    const rebind = runtime.bindAgent({
      tenantId: TENANT,
      agent: binding.agent,
      registry,
    });
    if (!rebind.ok) throw new Error(`fixture agent must bind: ${JSON.stringify(rebind.error)}`);
  }
  const compiled = runtime.compilePlan({
    tenantId: TENANT,
    plan: withRealDigests(planFixture(), standardProposalSet()),
    proposals: standardProposalSet(),
  });
  if (!compiled.ok) throw new Error(`fixture plan must compile: ${JSON.stringify(compiled.error)}`);
  return { runtime, plan: compiled.value, registry };
}

/**
 * A sealed W010 `action:lifecycle` event record (content + content
 * digest). `proposal` defaults to the survey step's reference. Built
 * through the REAL W010 sealing pipeline; histories that must be
 * genuinely ordered use a real EventLog (see parity tests).
 */
export function lifecycleEventFixture(options: {
  proposalId?: string;
  canonicalDigest?: string;
  phase: string;
  sequence: number;
  tenantId?: string;
  streamId?: string;
  occurredAt?: string;
}): EventRecord {
  const proposals = standardProposalSet();
  const proposalId = options.proposalId ?? 'prop-survey-001';
  const known = proposals.find((fixture) => {
    const admitted = admittedProposal(fixture);
    return admitted.proposal.proposalId === proposalId;
  });
  const digest =
    options.canonicalDigest ??
    (known === undefined ? '0'.repeat(64) : admittedProposal(known).digest);
  const content = {
    schemaVersion: 1,
    streamId: options.streamId ?? 'stream:actions',
    sequence: options.sequence,
    tenantId: options.tenantId ?? TENANT,
    actor: 'principal:action-gateway',
    causalParent:
      options.sequence > 1
        ? { streamId: options.streamId ?? 'stream:actions', sequence: options.sequence - 1 }
        : null,
    payload: {
      discriminator: 'action:lifecycle',
      data: {
        action: { proposalId, canonicalDigest: digest },
        actionType: { id: 'engineering.element.reinforce', version: '1.0.0' },
        phase: options.phase,
      },
    },
    occurredAt: options.occurredAt ?? T2,
  };
  const sealed = sealEvent(content);
  if (!sealed.ok) throw new Error(`fixture event must seal: ${JSON.stringify(sealed.error)}`);
  return { event: sealed.value.event, contentDigest: sealed.value.digest };
}

/** Start the standard session on a fixture runtime; throws on failure. */
export function startedSession(runtime: AgentRuntime, plan: CompiledPlan) {
  const created = runtime.createSession({
    tenantId: TENANT,
    sessionId: SESSION_ID,
    plan,
    createdAt: T1,
  });
  if (!created.ok) throw new Error(`fixture session must create: ${JSON.stringify(created.error)}`);
  const started = runtime.startSession({ tenantId: TENANT, sessionId: SESSION_ID, at: T1 });
  if (!started.ok) throw new Error(`fixture session must start: ${JSON.stringify(started.error)}`);
  return started.value;
}
