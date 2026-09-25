/**
 * The agent-orchestration schema surface registry: every data type
 * published at the `@epoch/agent-orchestration` ownership boundary, paired
 * with its zod schema (W020 publishes its versioned contract surface inside
 * the package, the W007/W009/W010 convention; see src/contract-emission.ts
 * and test/contract-drift.test.ts).
 */
import type { ZodType } from 'zod';
import {
  ActionEventPhaseSchema,
  AgentBindingSchema,
  CapabilityPinSchema,
  CapabilityVersionPinSchema,
  CompiledPlanSchema,
  CompiledPlanStepSchema,
  IdempotencyKeySchema,
  OrchestrationIssueSchema,
  OrchestrationPlanSchema,
  OrchestrationPrincipalIdSchema,
  OrchestrationRecordVersionSchema,
  OrchestrationSessionSchema,
  OrchestrationTenantIdSchema,
  OrchestratedAgentSchema,
  PlanIdSchema,
  PlanStepSchema,
  ProposalHandoffSchema,
  RetryPolicySchema,
  RetryableActionPhaseSchema,
  SessionIdSchema,
  SessionStatusSchema,
  SessionStatusTransitionSchema,
  Sha256DigestSchema,
  StepIdSchema,
  StepStateSchema,
  StepStatusSchema,
  StepTransitionSchema,
} from './schema';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of the agent-orchestration contract v1. */
export const AGENT_ORCHESTRATION_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'ActionEventPhase', schema: ActionEventPhaseSchema },
  { type: 'AgentBinding', schema: AgentBindingSchema },
  { type: 'CapabilityPin', schema: CapabilityPinSchema },
  { type: 'CapabilityVersionPin', schema: CapabilityVersionPinSchema },
  { type: 'CompiledPlan', schema: CompiledPlanSchema },
  { type: 'CompiledPlanStep', schema: CompiledPlanStepSchema },
  { type: 'IdempotencyKey', schema: IdempotencyKeySchema },
  { type: 'OrchestratedAgent', schema: OrchestratedAgentSchema },
  { type: 'OrchestrationIssue', schema: OrchestrationIssueSchema },
  { type: 'OrchestrationPlan', schema: OrchestrationPlanSchema },
  { type: 'OrchestrationPrincipalId', schema: OrchestrationPrincipalIdSchema },
  { type: 'OrchestrationRecordVersion', schema: OrchestrationRecordVersionSchema },
  { type: 'OrchestrationSession', schema: OrchestrationSessionSchema },
  { type: 'OrchestrationTenantId', schema: OrchestrationTenantIdSchema },
  { type: 'PlanId', schema: PlanIdSchema },
  { type: 'PlanStep', schema: PlanStepSchema },
  { type: 'ProposalHandoff', schema: ProposalHandoffSchema },
  { type: 'RetryPolicy', schema: RetryPolicySchema },
  { type: 'RetryableActionPhase', schema: RetryableActionPhaseSchema },
  { type: 'SessionId', schema: SessionIdSchema },
  { type: 'SessionStatus', schema: SessionStatusSchema },
  { type: 'SessionStatusTransition', schema: SessionStatusTransitionSchema },
  { type: 'Sha256Digest', schema: Sha256DigestSchema },
  { type: 'StepId', schema: StepIdSchema },
  { type: 'StepState', schema: StepStateSchema },
  { type: 'StepStatus', schema: StepStatusSchema },
  { type: 'StepTransition', schema: StepTransitionSchema },
];
