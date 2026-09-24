/**
 * The agent registration message (`messageKind: "agent.registration"`).
 *
 * A registered agent declares, in one provider-neutral message: its executor
 * nature (human, program, model, hybrid — never a vendor), its capabilities
 * and tools, its proposal-scoped authority, its cost and latency
 * characteristics, and its evidence requirements. Agent frameworks and
 * models are implementation details behind the protocol.
 */
import { z } from 'zod';
import { AgentIdSchema, MessageIdSchema, TimestampSchema } from './primitives';
import { admitMessage, unwrapOrThrow, type ParseOutcome } from './envelope';
import {
  AGENT_MESSAGE_KIND_REGISTRATION,
  AGENT_PROTOCOL_VERSION,
  ProtocolVersionSchema,
} from './version';
import { CapabilityDeclarationSchema } from './capability';
import { ToolDeclarationSchema } from './tool';
import { AuthorityDeclarationSchema } from './authority';
import { EvidenceRequirementsSchema } from './evidence';
import { CostProfileSchema, LatencyProfileSchema } from './profiles';

/** Executor kinds. Provider-neutral: `model` means any statistical/model-backed
 * executor (LLM or otherwise); `program` covers deterministic and
 * non-deterministic software executors including robots and solvers; `hybrid`
 * covers mixed human/automated executors. */
export const EXECUTOR_KINDS = ['human', 'program', 'model', 'hybrid'] as const;

export type ExecutorKind = (typeof EXECUTOR_KINDS)[number];

export const ExecutorKindSchema = z.enum(EXECUTOR_KINDS).meta({
  id: 'ExecutorKind',
  title: 'ExecutorKind',
  description:
    'Neutral executor nature: human, program (incl. solvers/robots), model (model-backed), or hybrid.',
});

export const ExecutorSchema = z
  .strictObject({
    kind: ExecutorKindSchema,
    deterministic: z.boolean(),
  })
  .meta({
    id: 'Executor',
    title: 'Executor',
    description: 'What implements the agent, neutrally: kind plus a determinism flag.',
  });

export type Executor = z.infer<typeof ExecutorSchema>;

/**
 * Agent registration message schema. Runtime refinements (not representable
 * in the structural JSON Schema projection): capability ids must be unique
 * within the registration, and tool ids must be unique within the
 * registration.
 */
export const AgentRegistrationSchema = z
  .strictObject({
    protocolVersion: ProtocolVersionSchema,
    messageKind: z.literal(AGENT_MESSAGE_KIND_REGISTRATION),
    messageId: MessageIdSchema,
    createdAt: TimestampSchema,
    agentId: AgentIdSchema,
    displayName: z.string().min(1).max(200),
    description: z.string().max(4000).optional(),
    executor: ExecutorSchema,
    capabilities: z.array(CapabilityDeclarationSchema).min(1),
    tools: z.array(ToolDeclarationSchema),
    authority: AuthorityDeclarationSchema,
    costProfile: CostProfileSchema,
    latencyProfile: LatencyProfileSchema,
    evidenceRequirements: EvidenceRequirementsSchema,
  })
  .refine(
    (registration) =>
      new Set(registration.capabilities.map((capability) => capability.capabilityId)).size ===
      registration.capabilities.length,
    'capabilityId values must be unique within a registration',
  )
  .refine(
    (registration) =>
      new Set(registration.tools.map((tool) => tool.toolId)).size === registration.tools.length,
    'toolId values must be unique within a registration',
  )
  .meta({
    id: 'AgentRegistration',
    title: 'AgentRegistration',
    description:
      'Agent protocol registration message: executor, capabilities, tools, proposal authority, cost/latency, and evidence requirements.',
  });

export type AgentRegistration = z.infer<typeof AgentRegistrationSchema>;

/**
 * Admit an agent registration message through the shared pipeline
 * (version gate, kind gate, schema validation, canonical evidence form).
 */
export function parseAgentRegistration(input: unknown): ParseOutcome<AgentRegistration> {
  return admitMessage({
    input,
    expectedVersion: AGENT_PROTOCOL_VERSION,
    expectedKind: AGENT_MESSAGE_KIND_REGISTRATION,
    schema: AgentRegistrationSchema,
  });
}

/** Throwing variant of {@link parseAgentRegistration}. */
export function validateAgentRegistration(input: unknown): AgentRegistration {
  return unwrapOrThrow(parseAgentRegistration(input));
}
