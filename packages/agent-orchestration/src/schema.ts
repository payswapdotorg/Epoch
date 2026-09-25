/**
 * @epoch/agent-orchestration — runtime zod validators for the published
 * contract types.
 *
 * Strict object shapes: unknown structural fields are rejected, so
 * provider/model/vendor semantics (model names, api keys, endpoints,
 * framework hints) cannot enter kernel types through the orchestration
 * door (same policy as the W002-W011 validators). Every exported schema is
 * part of the published surface emitted under `schemas/`.
 *
 * Runtime vocabulary composition (the W020 dependency policy):
 * - timestamps use @epoch/agent-protocol's `TimestampSchema` and agent ids
 *   its `AgentIdSchema` (canonical UTC form; `agent:` grammar);
 * - proposal references use @epoch/action-protocol's
 *   `ProposalReferenceSchema` directly (W003 grammar — genuine runtime
 *   composition; steps reference proposals, they never embed them);
 * - capability ids/versions use @epoch/capability-registry's
 *   `CapabilityIdSchema`/`SemverCoreSchema` (W007 grammar);
 * - action lifecycle phases use the W010 `ACTION_EVENT_PHASES` vocabulary
 *   from @epoch/event-log;
 * - the tenant/principal id grammars are MIRRORED (W009) and pinned
 *   member-for-member by devDependency parity tests (test/parity.test.ts,
 *   src/kernel-parity.ts) — tenancy/identity are NOT runtime dependencies.
 */
import { z } from 'zod';
import { AgentIdSchema, TimestampSchema } from '@epoch/agent-protocol';
import { ProposalReferenceSchema } from '@epoch/action-protocol';
import { CapabilityCategorySchema, CapabilityIdSchema, SemverCoreSchema } from '@epoch/capability-registry';
import { ACTION_EVENT_PHASES } from '@epoch/event-log';
import {
  MAX_RETRY_ATTEMPTS,
  ORCHESTRATION_PLAN_ID_PATTERN,
  ORCHESTRATION_PRINCIPAL_ID_PATTERN,
  ORCHESTRATION_RECORD_VERSION,
  ORCHESTRATION_SESSION_ID_PATTERN,
  ORCHESTRATION_STEP_ID_PATTERN,
  ORCHESTRATION_TENANT_ID_PATTERN,
  RETRYABLE_ACTION_PHASES,
  SESSION_STATUSES,
  SESSION_TRANSITION_CAUSES,
  STEP_STATUSES,
  STEP_TRANSITION_CAUSES,
} from './version';

/** Lowercase hex SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Lifecycle states a capability pin may record at binding (retired never binds). */
export const BINDABLE_CAPABILITY_LIFECYCLES = ['registered', 'deprecated'] as const;

/** Version discriminator on serialized orchestration records (v1). */
export const OrchestrationRecordVersionSchema = z.literal(ORCHESTRATION_RECORD_VERSION).meta({
  id: 'OrchestrationRecordVersion',
  title: 'OrchestrationRecordVersion',
  description:
    'Version discriminator carried by every serialized agent-orchestration record (currently 1).',
});

/** Tenant scope of an orchestration document (`tenant:<slug>`). */
export const OrchestrationTenantIdSchema = z
  .string()
  .regex(ORCHESTRATION_TENANT_ID_PATTERN, 'must be a tenant id of the form "tenant:<slug>"')
  .meta({
    id: 'OrchestrationTenantId',
    title: 'OrchestrationTenantId',
    description:
      'Opaque tenant scope of an orchestration document: "tenant:" followed by a lowercase slug (W009 grammar).',
  });

/** Principal reference (`principal:<slug>`). */
export const OrchestrationPrincipalIdSchema = z
  .string()
  .regex(ORCHESTRATION_PRINCIPAL_ID_PATTERN, 'must be a principal id of the form "principal:<slug>"')
  .meta({
    id: 'OrchestrationPrincipalId',
    title: 'OrchestrationPrincipalId',
    description:
      'Opaque principal reference: "principal:" followed by a lowercase slug (W009 grammar).',
  });

/** Orchestration plan identity (`plan:<slug>`). */
export const PlanIdSchema = z
  .string()
  .regex(ORCHESTRATION_PLAN_ID_PATTERN, 'must be a plan id of the form "plan:<slug>"')
  .meta({
    id: 'PlanId',
    title: 'PlanId',
    description: 'Opaque orchestration plan identity: "plan:" followed by a lowercase slug.',
  });

/** Orchestration session identity (`session:<slug>`). */
export const SessionIdSchema = z
  .string()
  .regex(ORCHESTRATION_SESSION_ID_PATTERN, 'must be a session id of the form "session:<slug>"')
  .meta({
    id: 'SessionId',
    title: 'SessionId',
    description: 'Opaque orchestration session identity: "session:" followed by a lowercase slug.',
  });

/** Plan-local step identity (a bare lowercase slug). */
export const StepIdSchema = z
  .string()
  .regex(ORCHESTRATION_STEP_ID_PATTERN, 'must be a plan-local step slug (lowercase)')
  .meta({
    id: 'StepId',
    title: 'StepId',
    description: 'Plan-local step identity: a bare lowercase slug, unique within its plan.',
  });

/** SHA-256 digest as lowercase hex. */
export const Sha256DigestSchema = z
  .string()
  .regex(SHA256_HEX_PATTERN, 'must be a lowercase hex SHA-256 digest (64 characters)')
  .meta({
    id: 'Sha256Digest',
    title: 'Sha256Digest',
    description: 'Lowercase hexadecimal SHA-256 digest (exactly 64 characters).',
  });

/** Deterministic idempotency key (lowercase hex SHA-256). */
export const IdempotencyKeySchema = z
  .string()
  .regex(SHA256_HEX_PATTERN, 'must be a lowercase hex SHA-256 idempotency key (64 characters)')
  .meta({
    id: 'IdempotencyKey',
    title: 'IdempotencyKey',
    description:
      'Deterministic idempotency key: the SHA-256 of the canonical JSON of the keyed operation scope.',
  });

/** One action lifecycle phase (the W010 vocabulary, consumed from @epoch/event-log). */
export const ActionEventPhaseSchema = z.enum(ACTION_EVENT_PHASES).meta({
  id: 'ActionEventPhase',
  title: 'ActionEventPhase',
  description:
    'Action lifecycle phase recorded by an event (W010 vocabulary): proposed, authorized, rejected, executed, effects-recorded, or failed.',
});

/** One orchestration session lifecycle state. */
export const SessionStatusSchema = z.enum(SESSION_STATUSES).meta({
  id: 'SessionStatus',
  title: 'SessionStatus',
  description:
    'Session lifecycle state: pending, running, suspended, completed, failed, or cancelled (last three terminal).',
});

/** One step execution-tracking state. */
export const StepStatusSchema = z.enum(STEP_STATUSES).meta({
  id: 'StepStatus',
  title: 'StepStatus',
  description:
    'Step execution-tracking state: pending, dispatched, authorized, executed, failed, rejected, or skipped (last four terminal).',
});

/** One retryable action lifecycle phase. */
export const RetryableActionPhaseSchema = z.enum(RETRYABLE_ACTION_PHASES).meta({
  id: 'RetryableActionPhase',
  title: 'RetryableActionPhase',
  description: 'Action lifecycle phases a retry policy may cover: rejected or failed.',
});

/** Retry policy as typed data. */
export const RetryPolicySchema = z
  .strictObject({
    maxAttempts: z
      .number()
      .int('maxAttempts must be an integer')
      .min(1, 'maxAttempts starts at 1 (one attempt, no retries)')
      .max(MAX_RETRY_ATTEMPTS, `maxAttempts is bounded at ${MAX_RETRY_ATTEMPTS}`),
    retryOn: z.array(RetryableActionPhaseSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'RetryPolicy',
    title: 'RetryPolicy',
    description:
      'Retry policy as typed data: total dispatch attempts allowed and the action phases that re-queue the step.',
  });

/** One authored plan step (a typed action-proposal reference plus scheduling facts). */
export const PlanStepSchema = z
  .strictObject({
    stepId: StepIdSchema,
    agentId: AgentIdSchema,
    proposal: ProposalReferenceSchema,
    dependsOn: z.array(StepIdSchema).readonly(),
    retryPolicy: RetryPolicySchema.optional(),
  })
  .readonly()
  .meta({
    id: 'PlanStep',
    title: 'PlanStep',
    description:
      'Authored plan step: an exact-revision action proposal reference, the assigned agent, dependencies, and a retry policy.',
  });

/** An authored orchestration plan / runbook. */
export const OrchestrationPlanSchema = z
  .strictObject({
    schemaVersion: OrchestrationRecordVersionSchema,
    tenantId: OrchestrationTenantIdSchema,
    planId: PlanIdSchema,
    displayName: z.string().min(1).max(200).optional(),
    createdBy: OrchestrationPrincipalIdSchema.optional(),
    steps: z.array(PlanStepSchema).min(1, 'a plan carries at least one step').readonly(),
  })
  .readonly()
  .meta({
    id: 'OrchestrationPlan',
    title: 'OrchestrationPlan',
    description:
      'Tenant-scoped, caller-authored orchestration plan: steps as typed action-proposal references (never embedded action semantics).',
  });

/** A compiled plan step (canonical dependencies, defaulted retry policy). */
export const CompiledPlanStepSchema = z
  .strictObject({
    stepId: StepIdSchema,
    agentId: AgentIdSchema,
    proposal: ProposalReferenceSchema,
    dependsOn: z.array(StepIdSchema).readonly(),
    retryPolicy: RetryPolicySchema,
  })
  .readonly()
  .meta({
    id: 'CompiledPlanStep',
    title: 'CompiledPlanStep',
    description:
      'Compiled plan step: the authored step with dependsOn canonically sorted and the retry policy defaulted.',
  });

/** The compiled, content-addressed plan. */
export const CompiledPlanSchema = z
  .strictObject({
    schemaVersion: OrchestrationRecordVersionSchema,
    tenantId: OrchestrationTenantIdSchema,
    planId: PlanIdSchema,
    displayName: z.string().min(1).max(200).optional(),
    createdBy: OrchestrationPrincipalIdSchema.optional(),
    planDigest: Sha256DigestSchema,
    steps: z.array(CompiledPlanStepSchema).min(1).readonly(),
    stepCount: z.number().int().min(1),
  })
  .refine(
    (plan) => plan.stepCount === plan.steps.length,
    'stepCount must equal the compiled step list length',
  )
  .readonly()
  .meta({
    id: 'CompiledPlan',
    title: 'CompiledPlan',
    description:
      'Validated, normalized, content-addressed plan: deterministic topological step order and the plan digest.',
  });

/** An exact capability version pin (W007 vocabulary). */
export const CapabilityVersionPinSchema = z
  .strictObject({
    capabilityId: CapabilityIdSchema,
    version: SemverCoreSchema,
  })
  .readonly()
  .meta({
    id: 'CapabilityVersionPin',
    title: 'CapabilityVersionPin',
    description:
      'Exact capability version pin: dot-namespaced capability id plus semver core version (W007 registry grammar).',
  });

/** A provider-neutral orchestrated agent descriptor. */
export const OrchestratedAgentSchema = z
  .strictObject({
    schemaVersion: OrchestrationRecordVersionSchema,
    agentId: AgentIdSchema,
    displayName: z.string().min(1).max(200).optional(),
    capabilities: z
      .array(CapabilityVersionPinSchema)
      .min(1, 'an orchestrated agent binds at least one capability')
      .readonly(),
  })
  .refine(
    (agent) =>
      new Set(agent.capabilities.map((pin) => `${pin.capabilityId}@${pin.version}`)).size ===
      agent.capabilities.length,
    'capability pins must be unique within an agent descriptor',
  )
  .readonly()
  .meta({
    id: 'OrchestratedAgent',
    title: 'OrchestratedAgent',
    description:
      'Provider-neutral orchestrated agent: registered agent id plus exact capability version pins (never a vendor/model descriptor).',
  });

/** A capability resolved and pinned at binding time. */
export const CapabilityPinSchema = z
  .strictObject({
    capabilityId: CapabilityIdSchema,
    version: SemverCoreSchema,
    category: CapabilityCategorySchema,
    lifecycleAtBinding: z.enum(BINDABLE_CAPABILITY_LIFECYCLES),
  })
  .readonly()
  .meta({
    id: 'CapabilityPin',
    title: 'CapabilityPin',
    description:
      'A capability resolved against the W007 registry at binding time: id, version, category, and the lifecycle state observed (retired never binds).',
  });

/** An agent binding (descriptor + resolved pins + binding digest). */
export const AgentBindingSchema = z
  .strictObject({
    schemaVersion: OrchestrationRecordVersionSchema,
    agent: OrchestratedAgentSchema,
    capabilities: z.array(CapabilityPinSchema).min(1).readonly(),
    bindingDigest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'AgentBinding',
    title: 'AgentBinding',
    description:
      'Capability-scoped agent binding: the orchestrated agent descriptor, its resolved capability pins, and the binding digest.',
  });

/** One step's execution-tracking record. */
export const StepStateSchema = z
  .strictObject({
    stepId: StepIdSchema,
    status: StepStatusSchema,
    attempt: z.number().int().min(0),
    lastPhase: ActionEventPhaseSchema.optional(),
    lastEventDigest: Sha256DigestSchema.optional(),
    dispatchedAt: TimestampSchema.optional(),
    settledAt: TimestampSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'StepState',
    title: 'StepState',
    description:
      'Execution-tracking record of one step: status, attempts, and the last action-lifecycle fact recorded against it.',
  });

/** One session-status transition. */
export const SessionStatusTransitionSchema = z
  .strictObject({
    from: SessionStatusSchema,
    to: SessionStatusSchema,
    cause: z.enum(SESSION_TRANSITION_CAUSES),
    at: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'SessionStatusTransition',
    title: 'SessionStatusTransition',
    description: 'Replayable session-status transition with its typed cause and instant.',
  });

/** One step-status transition. */
export const StepTransitionSchema = z
  .strictObject({
    stepId: StepIdSchema,
    from: StepStatusSchema,
    to: StepStatusSchema,
    cause: z.enum(STEP_TRANSITION_CAUSES),
    phase: ActionEventPhaseSchema.optional(),
    eventDigest: Sha256DigestSchema.optional(),
    attempt: z.number().int().min(0),
    at: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'StepTransition',
    title: 'StepTransition',
    description:
      'Replayable step-status transition with its typed cause, the driving action phase/event digest, and instant.',
  });

/** An orchestration session (the replayable execution of one compiled plan). */
export const OrchestrationSessionSchema = z
  .strictObject({
    schemaVersion: OrchestrationRecordVersionSchema,
    sessionId: SessionIdSchema,
    tenantId: OrchestrationTenantIdSchema,
    plan: CompiledPlanSchema,
    agents: z.array(AgentBindingSchema).min(1).readonly(),
    status: SessionStatusSchema,
    steps: z.array(StepStateSchema).min(1).readonly(),
    sessionTransitions: z.array(SessionStatusTransitionSchema).readonly(),
    stepTransitions: z.array(StepTransitionSchema).readonly(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'OrchestrationSession',
    title: 'OrchestrationSession',
    description:
      'Tenant-scoped orchestration session: one compiled plan, its bound agents, step execution-tracking states, and the replayable transition history.',
  });

/** A proposal handoff record (the typed boundary toward the Action Gateway). */
export const ProposalHandoffSchema = z
  .strictObject({
    schemaVersion: OrchestrationRecordVersionSchema,
    sessionId: SessionIdSchema,
    tenantId: OrchestrationTenantIdSchema,
    stepId: StepIdSchema,
    agentId: AgentIdSchema,
    proposal: ProposalReferenceSchema,
    attempt: z.number().int().min(1),
    handedOffAt: TimestampSchema,
    handoffDigest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'ProposalHandoff',
    title: 'ProposalHandoff',
    description:
      'Typed handoff of a step proposal toward the Action Gateway (W022): tracked as data, never executed or transported here.',
  });

/** One flattened validation issue. */
export const OrchestrationIssueSchema = z
  .strictObject({
    path: z.string(),
    message: z.string().min(1),
  })
  .readonly()
  .meta({
    id: 'OrchestrationIssue',
    title: 'OrchestrationIssue',
    description: 'One flattened validation issue: dotted path plus message ("$" = root).',
  });
