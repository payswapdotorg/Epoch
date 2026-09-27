/**
 * @epoch/adapter-mcp — runtime zod validators for the published
 * contract types (the NEUTRAL seam; tool-protocol vocabulary is absent
 * by construction — pinned by test/neutrality.test.ts).
 *
 * Strict objects throughout: unknown fields are rejected, so
 * protocol-specific semantics cannot enter the neutral records through
 * any door.
 */
import { z } from 'zod';
import { JsonValueSchema, TimestampSchema } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import { ActionProposalSchema, ProposalReferenceSchema } from '@epoch/action-protocol';
/** Justification entry (mirrors the W007/W005 JustificationReference shape exactly). */
const JustificationSchema = z
  .strictObject({
    kind: z.enum(['criterion', 'subject-output', 'subject-failure', 'assumption', 'method']),
    reference: z.string().min(1).max(512),
    statement: z.string().min(1).max(4000),
  })
  .readonly();
import { MCP_ADAPTER_RECORD_VERSION } from './version';
import { INVOCATION_DISPOSITIONS } from './version';

const recordVersion = z.literal(MCP_ADAPTER_RECORD_VERSION);
const digest = z.string().regex(/^[0-9a-f]{64}$/, 'lowercase hex SHA-256 (64 characters)');

/** Neutral tool reference: `tool:` + slug. */
export const ToolRefSchema = z
  .string()
  .regex(/^tool:[a-z0-9][a-z0-9-]{0,63}$/, "tool refs are 'tool:' + slug (protocol-neutral)");

const ToolArgumentSchema = z
  .strictObject({
    name: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
    valueKind: z.enum(['string', 'number', 'boolean']),
    required: z.boolean(),
    description: z.string().min(1).max(2000),
  })
  .readonly();

export const ToolInvocationSurfaceSchema = z
  .strictObject({
    schemaVersion: recordVersion,
    tenantId: TenantIdSchema,
    toolRef: ToolRefSchema,
    capabilityId: z.string().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/, 'dot-namespaced qualified name'),
    displayName: z.string().min(1).max(200),
    description: z.string().min(1).max(4000),
    inputArguments: z.array(ToolArgumentSchema).min(1).readonly(),
    outputSummary: z.string().min(1).max(2000),
    sourceDigest: digest,
    surfaceDigest: digest,
  })
  .readonly()
  .superRefine((surface, ctx) => {
    const names = new Set(surface.inputArguments.map((argument) => argument.name));
    if (names.size !== surface.inputArguments.length) {
      ctx.addIssue({ code: 'custom', message: 'argument names must be unique', path: ['inputArguments'] });
    }
  });

export const InvocationPlanSchema = z
  .strictObject({
    schemaVersion: recordVersion,
    tenantId: TenantIdSchema,
    toolRef: ToolRefSchema,
    actionId: z.string().regex(/^action:[a-z0-9][a-z0-9-]{0,80}$/, "action ids are 'action:' + slug"),
    proposal: ActionProposalSchema,
    proposalRef: ProposalReferenceSchema,
    planDigest: digest,
  })
  .readonly();

export const AuthorityDecisionRecordSchema = z
  .strictObject({
    schemaVersion: recordVersion,
    tenantId: TenantIdSchema,
    actionId: z.string().min(1).max(128),
    outcome: z.enum(['allow', 'deny', 'requires-approval']),
    decisionDigest: digest,
    denialCode: z.string().min(1).max(128).optional(),
    denialReason: z.string().min(1).max(2048).optional(),
    actionStatus: z.string().min(1).max(64),
    decidedAt: TimestampSchema,
  })
  .readonly()
  .superRefine((decision, ctx) => {
    if (decision.outcome === 'deny' && decision.denialCode === undefined) {
      ctx.addIssue({ code: 'custom', message: 'deny decisions carry a denial code', path: ['denialCode'] });
    }
  });

export const AuthorityOutcomeRecordSchema = z
  .strictObject({
    schemaVersion: recordVersion,
    tenantId: TenantIdSchema,
    actionId: z.string().min(1).max(128),
    kind: z.enum(['succeeded', 'failed']),
    failure: z
      .strictObject({
        code: z.string().min(1).max(128),
        reason: z.string().min(1).max(2048),
      })
      .readonly()
      .optional(),
    evidenceRefs: z.array(z.string().min(1).max(256)).readonly(),
    outcomeDigest: digest,
    executedAt: TimestampSchema,
  })
  .readonly()
  .superRefine((outcome, ctx) => {
    if (outcome.kind === 'failed' && outcome.failure === undefined) {
      ctx.addIssue({ code: 'custom', message: 'failed outcomes carry a typed failure', path: ['failure'] });
    }
    if (outcome.kind === 'succeeded' && outcome.failure !== undefined) {
      ctx.addIssue({ code: 'custom', message: 'succeeded outcomes carry no failure', path: ['failure'] });
    }
  });

export const ToolInvocationRecordSchema = z
  .strictObject({
    schemaVersion: recordVersion,
    tenantId: TenantIdSchema,
    toolRef: ToolRefSchema,
    actionId: z.string().regex(/^action:[a-z0-9][a-z0-9-]{0,80}$/, "action ids are 'action:' + slug"),
    arguments: z.record(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/), JsonValueSchema).readonly(),
    planDigest: digest,
    decision: AuthorityDecisionRecordSchema,
    outcome: AuthorityOutcomeRecordSchema.optional(),
    disposition: z.enum(INVOCATION_DISPOSITIONS),
    invocationId: z.string().regex(/^invocation-[0-9a-f]{12}$/, "invocation ids are 'invocation-' + 12 hex"),
    contentDigest: digest,
  })
  .readonly()
  .superRefine((record, ctx) => {
    const dispatched = record.disposition === 'executed' || record.disposition === 'execution-failed';
    if (dispatched !== (record.outcome !== undefined)) {
      ctx.addIssue({
        code: 'custom',
        message: 'the authority outcome is present exactly when the invocation reached execution',
        path: ['outcome'],
      });
    }
    if (record.disposition === 'executed' && record.outcome?.kind !== 'succeeded') {
      ctx.addIssue({
        code: 'custom',
        message: 'an executed disposition requires a succeeded authority outcome',
        path: ['disposition'],
      });
    }
    if (record.disposition === 'execution-failed' && record.outcome?.kind !== 'failed') {
      ctx.addIssue({
        code: 'custom',
        message: 'an execution-failed disposition requires a failed authority outcome',
        path: ['disposition'],
      });
    }
  });

export const InvocationCriteriaSchema = z
  .strictObject({
    'expected-disposition': z.enum(INVOCATION_DISPOSITIONS),
    'require-evidence': z.boolean().optional(),
  })
  .readonly();

export const InvocationEvaluationSchema = z
  .strictObject({
    schemaVersion: recordVersion,
    tenantId: TenantIdSchema,
    subjectId: z.string().regex(/^invocation-[0-9a-f]{12}$/, 'the evaluation subject is an invocation record id'),
    subjectDigest: digest,
    verdict: z.discriminatedUnion('verdictForm', [
      z
        .strictObject({
          verdictForm: z.literal('pass-fail'),
          outcome: z.enum(['pass', 'fail']),
        })
        .readonly(),
      z
        .strictObject({
          verdictForm: z.literal('scored'),
          score: z.number(),
          scale: z
            .strictObject({
              minimum: z.number(),
              maximum: z.number(),
            })
            .readonly(),
        })
        .readonly()
        .refine(
          (verdict) => verdict.score >= verdict.scale.minimum && verdict.score <= verdict.scale.maximum,
          'the score must lie within the declared scale',
        ),
    ]),
    justification: z.array(JustificationSchema).min(1),
    evaluationDigest: digest,
  })
  .readonly();

/** The neutral invocation input (the W007 action envelope's parameters — parameter-name keys are lowercase kebab). */
export const InvocationInputSchema = z
  .strictObject({
    tenant: TenantIdSchema,
    tool: ToolRefSchema,
    arguments: z.record(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/), JsonValueSchema),
    authority: z
      .strictObject({
        principalId: z.string().min(1).max(128),
        context: z.unknown(),
        justification: z.string().max(2000).optional(),
      })
      .readonly(),
    'decided-at': TimestampSchema,
    approval: z
      .strictObject({
        deadline: TimestampSchema,
        maxDelegationDepth: z.number().int().min(0).max(8),
      })
      .readonly()
      .optional(),
    /** Present and non-"propose" ONLY for the bypass-rejection evidence path. */
    mode: z.string().max(32).optional(),
  })
  .readonly();

/** The neutral evaluation criteria as they ride the W007 evaluator envelope (the tenant rides the criteria record — parameter-name keys are lowercase kebab). */
export const EnvelopeCriteriaSchema = z
  .strictObject({
    tenant: TenantIdSchema,
    'expected-disposition': z.enum(INVOCATION_DISPOSITIONS),
    'require-evidence': z.boolean().optional(),
    /** Present and non-"judged" ONLY for the bypass-rejection evidence path. */
    mode: z.string().max(32).optional(),
  })
  .readonly();
