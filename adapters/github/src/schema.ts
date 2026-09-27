/**
 * @epoch/adapter-github — runtime zod validators for the published
 * contract types (the NEUTRAL seam; provider vocabulary is absent by
 * construction — pinned by test/neutrality.test.ts).
 *
 * Strict objects throughout: unknown fields are rejected, so provider
 * semantics cannot enter the neutral records through any door. The
 * W002-mirror validators (statement / provenance / confidence /
 * validity) mirror the world-model field schemas exactly (runtime parity
 * with the REAL world-model validators is pinned by the parity tests).
 */
import { z } from 'zod';
import { JsonValueSchema, TimestampSchema } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import { ActionProposalSchema, ProposalReferenceSchema } from '@epoch/action-protocol';
import { GITHUB_ADAPTER_RECORD_VERSION } from './version';
import { CHANGE_KINDS, CHANGE_DISPATCH_DISPOSITIONS } from './version';

const recordVersion = z.literal(GITHUB_ADAPTER_RECORD_VERSION);

const digest = z.string().regex(/^[0-9a-f]{64}$/, 'lowercase hex SHA-256 (64 characters)');

/** Neutral workspace identity: `sw:` + slug. */
export const WorkspaceIdSchema = z
  .string()
  .regex(/^sw:[a-z0-9][a-z0-9._-]{0,127}$/, "workspace ids are 'sw:' + slug (provider-neutral)");

export const WorkspaceActorRefSchema = z
  .strictObject({
    id: z.string().min(1).max(256),
    role: z.enum(['human', 'agent', 'system', 'external-provider', 'sensor', 'importer']),
    displayName: z.string().max(256).optional(),
  })
  .readonly();

export const WorkspaceEvidenceRefSchema = z
  .strictObject({
    id: z.string().min(1).max(512),
    kind: z.enum([
      'document',
      'measurement',
      'observation',
      'computation',
      'assertion',
      'external',
      'other',
    ]),
    digest: z.string().regex(/^[0-9a-f]{16,128}$/, 'evidence digests are lowercase hex').optional(),
    locator: z.string().max(2048).optional(),
    description: z.string().max(2048).optional(),
  })
  .readonly();

export const WorkspaceProvenanceSchema = z
  .strictObject({
    actor: WorkspaceActorRefSchema,
    method: z.string().min(1).max(256),
    evidence: z.array(WorkspaceEvidenceRefSchema).readonly(),
    derivedFrom: z.array(z.string().min(1).max(64)).readonly().optional(),
    recordedVia: z.string().min(1).max(256).optional(),
  })
  .readonly();

export const WorkspaceConfidenceDistributionSchema = z.discriminatedUnion('kind', [
  z
    .strictObject({
      kind: z.literal('point'),
      value: z.number().min(0).max(1),
    })
    .readonly(),
  z
    .strictObject({
      kind: z.literal('interval'),
      lower: z.number().min(0).max(1),
      upper: z.number().min(0).max(1),
      bias: z.enum(['none', 'low', 'high']).optional(),
    })
    .readonly()
    .refine((value) => value.lower <= value.upper, 'interval lower bound must not exceed the upper bound'),
  z
    .strictObject({
      kind: z.literal('set'),
      values: z.array(z.number().min(0).max(1)).min(1),
      weights: z.array(z.number().min(0)).optional(),
    })
    .readonly()
    .refine(
      (value) => value.weights === undefined || value.weights.length === value.values.length,
      'weights (when present) align with values',
    ),
]);

export const WorkspaceConfidenceSchema = z
  .strictObject({
    distribution: WorkspaceConfidenceDistributionSchema,
    method: z.enum(['stated', 'measured', 'estimated', 'derived', 'imported']).optional(),
    rationale: z.string().max(2048).optional(),
  })
  .readonly();

export const WorkspaceValiditySchema = z
  .strictObject({
    from: TimestampSchema.optional(),
    to: TimestampSchema.optional(),
  })
  .readonly();

export const WorkspaceStatementSchema = z
  .discriminatedUnion('kind', [
    z
      .strictObject({
        kind: z.literal('entity'),
        entityId: z.string().min(1).max(256),
        entityType: z.string().regex(/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/, "type keys are 'namespace:name'"),
        properties: z.record(z.string().min(1).max(256), JsonValueSchema).optional(),
      })
      .readonly(),
    z
      .strictObject({
        kind: z.literal('entity-property'),
        entityId: z.string().min(1).max(256),
        property: z.string().regex(/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/, 'property names are short stable identifiers'),
        value: JsonValueSchema,
      })
      .readonly(),
    z
      .strictObject({
        kind: z.literal('relation'),
        relationType: z.string().regex(/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/, "type keys are 'namespace:name'"),
        source: z.string().min(1).max(256),
        target: z.string().min(1).max(256),
        properties: z.record(z.string().min(1).max(256), JsonValueSchema).optional(),
      })
      .readonly(),
  ]);

export const WorkspaceObservationRecordSchema = z
  .strictObject({
    schemaVersion: recordVersion,
    tenantId: TenantIdSchema,
    workspaceId: WorkspaceIdSchema,
    recordId: z.string().regex(/^obs-[0-9a-f]{16}$/, "record ids are 'obs-' + 16 hex (content-derived)"),
    statement: WorkspaceStatementSchema,
    provenance: WorkspaceProvenanceSchema,
    confidence: WorkspaceConfidenceSchema,
    validity: WorkspaceValiditySchema.optional(),
    observedAt: TimestampSchema,
    contentDigest: digest,
  })
  .readonly();

export const WorkspaceSourceRefSchema = z
  .strictObject({
    artifactId: z.string().min(1).max(512),
    revision: z.string().min(1).max(128),
    digest,
  })
  .readonly();

export const WorkspaceProjectionSchema = z
  .strictObject({
    schemaVersion: recordVersion,
    tenantId: TenantIdSchema,
    workspaceId: WorkspaceIdSchema,
    source: WorkspaceSourceRefSchema,
    observedAt: TimestampSchema,
    records: z.array(WorkspaceObservationRecordSchema).readonly(),
    projectionDigest: digest,
  })
  .readonly()
  .superRefine((projection, ctx) => {
    const ids = projection.records.map((record) => record.recordId);
    const sorted = [...ids].sort();
    if (ids.some((id, index) => id !== sorted[index])) {
      ctx.addIssue({ code: 'custom', message: 'records must be sorted by recordId ascending', path: ['records'] });
    }
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', message: 'record ids must be unique within a projection', path: ['records'] });
    }
  });

export const SnapshotIngestionRecordSchema = z
  .strictObject({
    schemaVersion: recordVersion,
    tenantId: TenantIdSchema,
    workspaceId: WorkspaceIdSchema,
    snapshotDigest: digest,
    revisionCount: z.number().int().nonnegative(),
    workItemCount: z.number().int().nonnegative(),
    ingestedAt: TimestampSchema,
    disposition: z.enum(['ingested', 'duplicate']),
    contentDigest: digest,
  })
  .readonly();

export const ChangeProposalPlanSchema = z
  .strictObject({
    schemaVersion: recordVersion,
    tenantId: TenantIdSchema,
    workspaceId: WorkspaceIdSchema,
    changeKind: z.enum(CHANGE_KINDS),
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

export const ChangeDispatchRecordSchema = z
  .strictObject({
    schemaVersion: recordVersion,
    tenantId: TenantIdSchema,
    workspaceId: WorkspaceIdSchema,
    changeKind: z.enum(CHANGE_KINDS),
    actionId: z.string().regex(/^action:[a-z0-9][a-z0-9-]{0,80}$/, "action ids are 'action:' + slug"),
    planDigest: digest,
    decision: AuthorityDecisionRecordSchema,
    outcome: AuthorityOutcomeRecordSchema.optional(),
    disposition: z.enum(CHANGE_DISPATCH_DISPOSITIONS),
    contentDigest: digest,
  })
  .readonly()
  .superRefine((record, ctx) => {
    const dispatched = record.disposition === 'executed' || record.disposition === 'execution-failed';
    if (dispatched !== (record.outcome !== undefined)) {
      ctx.addIssue({
        code: 'custom',
        message: 'the authority outcome is present exactly when the dispatch reached execution',
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

/** The neutral projection input (the W007 source envelope's inputs). */
export const ProjectionInputSchema = z
  .strictObject({
    tenant: TenantIdSchema,
    workspace: WorkspaceIdSchema,
  })
  .readonly();

/** The neutral change-routing input (the W007 action envelope's parameters — parameter-name keys are lowercase kebab per the frozen shared pattern). */
export const ChangeRoutingInputSchema = z
  .strictObject({
    tenant: TenantIdSchema,
    workspace: WorkspaceIdSchema,
    'change-kind': z.enum(CHANGE_KINDS),
    summary: z.string().min(1).max(512),
    'subject-revision': z.string().regex(/^[0-9a-f]{40}$/).optional(),
    'base-revision': z.string().regex(/^[0-9a-f]{40}$/).optional(),
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
