/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the W020
 * agent-orchestration contract guarantee; the JSON-Schema half is
 * test/contract-drift.test.ts).
 *
 * Every exported alias below compiles ONLY while the zod validators in
 * src/schema.ts infer exactly the published contract types in src/types.ts.
 *
 * Tenancy/identity shape parity (the kernel-to-kernel devDep precedent):
 * `src/kernel-parity.ts` additionally pins the MIRRORED tenant/principal id
 * grammars against @epoch/tenancy and @epoch/identity — those are
 * devDependency parity checks, never runtime couplings.
 */
import type { z } from 'zod';
import type { Equals, Expect } from './type-utils';
import type { AgentId, Sha256Hex, Timestamp } from '@epoch/agent-protocol';
import type { ProposalReference } from '@epoch/action-protocol';
import type { CapabilityCategory } from '@epoch/capability-registry';
import type { ActionEventPhase } from '@epoch/event-log';
import type { SessionStatus, StepStatus } from './version';
import type {
  AgentBinding,
  CapabilityPin,
  CapabilityVersionPin,
  CompiledPlan,
  CompiledPlanStep,
  IdempotencyKey,
  OrchestrationPlan,
  OrchestrationPrincipalId,
  OrchestrationSession,
  OrchestrationTenantId,
  OrchestratedAgent,
  PlanId,
  PlanStep,
  ProposalHandoff,
  RetryPolicy,
  SessionId,
  SessionStatusTransition,
  StepId,
  StepState,
  StepTransition,
} from './types';
import type {
  ActionEventPhaseSchema,
  AgentBindingSchema,
  CapabilityPinSchema,
  CapabilityVersionPinSchema,
  CompiledPlanSchema,
  CompiledPlanStepSchema,
  IdempotencyKeySchema,
  OrchestrationPlanSchema,
  OrchestrationPrincipalIdSchema,
  OrchestrationSessionSchema,
  OrchestrationTenantIdSchema,
  OrchestratedAgentSchema,
  PlanIdSchema,
  PlanStepSchema,
  ProposalHandoffSchema,
  RetryPolicySchema,
  SessionIdSchema,
  SessionStatusSchema,
  SessionStatusTransitionSchema,
  StepIdSchema,
  StepStateSchema,
  StepStatusSchema,
  StepTransitionSchema,
} from './schema';

export type AgentOrchestrationSchemaSync = [
  Expect<Equals<z.infer<typeof OrchestrationTenantIdSchema>, OrchestrationTenantId>>,
  Expect<Equals<z.infer<typeof OrchestrationPrincipalIdSchema>, OrchestrationPrincipalId>>,
  Expect<Equals<z.infer<typeof PlanIdSchema>, PlanId>>,
  Expect<Equals<z.infer<typeof SessionIdSchema>, SessionId>>,
  Expect<Equals<z.infer<typeof StepIdSchema>, StepId>>,
  Expect<Equals<z.infer<typeof IdempotencyKeySchema>, IdempotencyKey>>,
  Expect<Equals<z.infer<typeof SessionStatusSchema>, SessionStatus>>,
  Expect<Equals<z.infer<typeof StepStatusSchema>, StepStatus>>,
  Expect<Equals<z.infer<typeof ActionEventPhaseSchema>, ActionEventPhase>>,
  Expect<Equals<z.infer<typeof RetryPolicySchema>, RetryPolicy>>,
  Expect<Equals<z.infer<typeof PlanStepSchema>, PlanStep>>,
  Expect<Equals<z.infer<typeof OrchestrationPlanSchema>, OrchestrationPlan>>,
  Expect<Equals<z.infer<typeof CompiledPlanStepSchema>, CompiledPlanStep>>,
  Expect<Equals<z.infer<typeof CompiledPlanSchema>, CompiledPlan>>,
  Expect<Equals<z.infer<typeof CapabilityVersionPinSchema>, CapabilityVersionPin>>,
  Expect<Equals<z.infer<typeof OrchestratedAgentSchema>, OrchestratedAgent>>,
  Expect<Equals<z.infer<typeof CapabilityPinSchema>, CapabilityPin>>,
  Expect<Equals<z.infer<typeof AgentBindingSchema>, AgentBinding>>,
  Expect<Equals<z.infer<typeof StepStateSchema>, StepState>>,
  Expect<Equals<z.infer<typeof SessionStatusTransitionSchema>, SessionStatusTransition>>,
  Expect<Equals<z.infer<typeof StepTransitionSchema>, StepTransition>>,
  Expect<Equals<z.infer<typeof OrchestrationSessionSchema>, OrchestrationSession>>,
  Expect<Equals<z.infer<typeof ProposalHandoffSchema>, ProposalHandoff>>,
];

export type AgentOrchestrationVocabularySync = [
  Expect<Equals<SessionStatus, 'pending' | 'running' | 'suspended' | 'completed' | 'failed' | 'cancelled'>>,
  Expect<
    Equals<
      StepStatus,
      'pending' | 'dispatched' | 'authorized' | 'executed' | 'failed' | 'rejected' | 'skipped'
    >
  >,
  Expect<Equals<RetryPolicy['retryOn'][number], 'rejected' | 'failed'>>,
  Expect<Equals<CapabilityPin['category'], CapabilityCategory>>,
  Expect<Equals<PlanStep['agentId'], AgentId>>,
  Expect<Equals<PlanStep['proposal'], ProposalReference>>,
  Expect<Equals<StepState['lastPhase'], ActionEventPhase | undefined>>,
  Expect<Equals<StepState['dispatchedAt'], Timestamp | undefined>>,
  Expect<Equals<CompiledPlan['planDigest'], Sha256Hex>>,
  Expect<Equals<ProposalHandoff['handoffDigest'], Sha256Hex>>,
];
