// Shared fixtures: valid protocol documents used across the positive tests.
import type { AgentRegistration } from '../src/registration';
import type { CapabilityDeclaration } from '../src/capability';

export const VALID_CAPABILITY: CapabilityDeclaration = {
  protocolVersion: '1.0.0',
  capabilityId: 'engineering.stress-analysis',
  summary: 'Linear static stress analysis of structural elements.',
  domain: 'structural',
  inputs: [
    {
      name: 'element-id',
      kind: 'entity-reference',
      required: true,
      description: 'World entity holding the element geometry.',
    },
    {
      name: 'load-case',
      kind: 'enum',
      required: true,
      description: 'Load case to evaluate.',
      enumValues: ['dead-load', 'live-load', 'wind'],
    },
    {
      name: 'mesh-density',
      kind: 'integer',
      required: false,
      description: 'Target mesh density multiplier.',
      unit: 'x',
    },
  ],
  outputs: [
    {
      name: 'utilization',
      kind: 'number',
      required: true,
      description: 'Peak utilization ratio.',
      unit: 'ratio',
    },
  ],
  assumptions: ['Linear elastic material behavior.', 'Small deformations.'],
};

export function validRegistration(overrides?: {
  executorKind?: AgentRegistration['executor']['kind'];
  deterministic?: boolean;
  messageId?: string;
}): AgentRegistration {
  return {
    protocolVersion: '1.0.0',
    messageKind: 'agent.registration',
    messageId: overrides?.messageId ?? 'msg-0001-registration',
    createdAt: '2025-01-15T09:30:00.000Z',
    agentId: 'agent:stress-checker',
    displayName: 'Stress Checker',
    description: 'Proposes reinforcement changes for structural elements.',
    executor: {
      kind: overrides?.executorKind ?? 'model',
      deterministic: overrides?.deterministic ?? false,
    },
    capabilities: [VALID_CAPABILITY],
    tools: [
      {
        toolId: 'tool:meshing.automesher',
        summary: 'Automatic tetrahedral meshing.',
        category: 'reconstruction',
        capabilityRef: 'engineering.stress-analysis',
      },
    ],
    authority: {
      executionAuthority: 'none',
      proposableActionTypes: [
        { id: 'structural.element.reinforce', version: '1.0.0' },
        { id: 'structural.element.flag', version: '1.2.0' },
      ],
      requiresHumanCosign: true,
    },
    costProfile: { basis: 'per-proposal', currency: 'USD', amount: '0.25' },
    latencyProfile: { p50Milliseconds: 4_000, p95Milliseconds: 15_000 },
    evidenceRequirements: {
      requiresRationale: true,
      requiresPredictedEffects: true,
      requiresEvidenceRefs: false,
      requiredArtifactKinds: ['rationale'],
    },
  };
}
