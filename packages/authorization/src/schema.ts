/**
 * @epoch/authorization — runtime zod validators for the published
 * contract types.
 *
 * Strict object shapes: unknown structural fields are rejected, so
 * provider-specific semantics cannot enter kernel types through the
 * authorization door (same policy as the W002-W008 validators). Every
 * exported schema is part of the published surface emitted under
 * `schemas/`.
 */
import { z } from 'zod';
import {
  ALLOW_REASONS,
  AUTHORIZATION_OUTCOMES,
  AUTHORIZATION_RECORD_VERSION,
  DENIAL_CODES,
  EVIDENCE_PATH_PATTERN,
  NOT_APPLICABLE_REASONS,
  PRINCIPAL_ID_PATTERN,
  PRINCIPAL_STATUSES,
  PROJECT_ID_PATTERN,
  TENANT_ID_PATTERN,
  WORKSPACE_ID_PATTERN,
} from './version';

/** Lowercase hex SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Opaque scope strings, bounded like the W004 policy-target strings. */
const scopeString = z.string().min(1).max(256);

/** Version discriminator on serialized authorization records (v1). */
export const AuthorizationRecordVersionSchema = z.literal(AUTHORIZATION_RECORD_VERSION).meta({
  id: 'AuthorizationRecordVersion',
  title: 'AuthorizationRecordVersion',
  description:
    'Version discriminator carried by every serialized authorization record (currently 1).',
});

/** Principal statuses (caller-supplied facts mirroring @epoch/identity). */
export const PrincipalStatusSchema = z.enum(PRINCIPAL_STATUSES).meta({
  id: 'PrincipalStatus',
  title: 'PrincipalStatus',
  description:
    'Principal status fact (mirrors @epoch/identity): active, suspended, or deactivated.',
});

/** The exhaustive decision outcomes. */
export const AuthorizationOutcomeSchema = z.enum(AUTHORIZATION_OUTCOMES).meta({
  id: 'AuthorizationOutcome',
  title: 'AuthorizationOutcome',
  description: 'Exhaustive authorization decision outcome: allow, deny, or not-applicable.',
});

/** The typed denial taxonomy (fail-closed). */
export const DenialCodeSchema = z.enum(DENIAL_CODES).meta({
  id: 'DenialCode',
  title: 'DenialCode',
  description:
    'Machine-readable denial code: unknown-principal, unknown-tenant, cross-tenant-denied, cross-workspace-denied, cross-project-denied, inactive-principal, or unauthenticated-principal.',
});

/** Typed allow reasons. */
export const AllowReasonSchema = z.enum(ALLOW_REASONS).meta({
  id: 'AllowReason',
  title: 'AllowReason',
  description: 'Typed reason an allow decision may cite: covering-membership, active-principal, authenticated-principal.',
});

/** Typed not-applicable reasons. */
export const NotApplicableReasonSchema = z.enum(NOT_APPLICABLE_REASONS).meta({
  id: 'NotApplicableReason',
  title: 'NotApplicableReason',
  description: 'Typed reason a decision is not-applicable: resource-not-tenant-scoped.',
});

/** Opaque principal id (mirrors @epoch/identity). */
export const PrincipalIdSchema = z
  .string()
  .regex(PRINCIPAL_ID_PATTERN, 'must be a principal id of the form "principal:<slug>"')
  .meta({
    id: 'PrincipalId',
    title: 'PrincipalId',
    description: 'Opaque principal id: "principal:" followed by a lowercase slug (mirrors @epoch/identity).',
  });

/** Opaque tenant id (mirrors @epoch/tenancy). */
export const TenantIdSchema = z
  .string()
  .regex(TENANT_ID_PATTERN, 'must be a tenant id of the form "tenant:<slug>"')
  .meta({
    id: 'TenantId',
    title: 'TenantId',
    description: 'Opaque tenant id: "tenant:" followed by a lowercase slug (mirrors @epoch/tenancy).',
  });

/** Opaque workspace id (mirrors @epoch/tenancy). */
export const WorkspaceIdSchema = z
  .string()
  .regex(WORKSPACE_ID_PATTERN, 'must be a workspace id of the form "workspace:<slug>"')
  .meta({
    id: 'WorkspaceId',
    title: 'WorkspaceId',
    description: 'Opaque workspace id: "workspace:" followed by a lowercase slug (mirrors @epoch/tenancy).',
  });

/** Opaque project id (mirrors @epoch/tenancy). */
export const ProjectIdSchema = z
  .string()
  .regex(PROJECT_ID_PATTERN, 'must be a project id of the form "project:<slug>"')
  .meta({
    id: 'ProjectId',
    title: 'ProjectId',
    description: 'Opaque project id: "project:" followed by a lowercase slug (mirrors @epoch/tenancy).',
  });

/** Exact evidence paths (dotted pointers into the request/context). */
export const EvidencePathSchema = z
  .string()
  .regex(
    EVIDENCE_PATH_PATTERN,
    'must be an evidence path rooted at request/principals/memberships/knownTenants (e.g. "request.resource.tenantId", "memberships[2]")',
  )
  .meta({
    id: 'EvidencePath',
    title: 'EvidencePath',
    description:
      'Exact evidence path: a dotted pointer into the request or context that grounds a decision (e.g. "request.resource.tenantId", "memberships[2]").',
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

/**
 * The tenancy-scoped resource reference. Runtime refinement: the scope
 * chain is complete — a workspace requires a tenant; a project requires
 * a workspace (scope chain gaps are rejected).
 */
export const ResourceReferenceSchema = z
  .strictObject({
    resourceType: scopeString,
    resourceId: scopeString,
    tenantId: TenantIdSchema.optional(),
    workspaceId: WorkspaceIdSchema.optional(),
    projectId: ProjectIdSchema.optional(),
  })
  .readonly()
  .refine(
    (resource) =>
      (resource.workspaceId === undefined || resource.tenantId !== undefined) &&
      (resource.projectId === undefined || resource.workspaceId !== undefined),
    'the scope chain must be complete: a workspace requires a tenant; a project requires a workspace',
  )
  .meta({
    id: 'ResourceReference',
    title: 'ResourceReference',
    description:
      'The tenancy-scoped resource a request acts on: opaque type and id plus the optional tenant/workspace/project scope (a resource without a tenant is platform-scoped).',
  });

/** The authorization request. */
export const AuthorizationRequestSchema = z
  .strictObject({
    schemaVersion: AuthorizationRecordVersionSchema,
    principalId: PrincipalIdSchema,
    actionKind: scopeString,
    resource: ResourceReferenceSchema,
    justification: z.string().min(1).max(10000).optional(),
  })
  .readonly()
  .meta({
    id: 'AuthorizationRequest',
    title: 'AuthorizationRequest',
    description:
      'Typed authorization request: principal id, opaque action kind, and the tenancy-scoped resource, over opaque ids only.',
  });

/** Caller-supplied principal facts. */
export const PrincipalFactSchema = z
  .strictObject({
    principalId: PrincipalIdSchema,
    status: PrincipalStatusSchema,
    authenticated: z.boolean(),
  })
  .readonly()
  .meta({
    id: 'PrincipalFact',
    title: 'PrincipalFact',
    description:
      'Caller-supplied principal fact: status and authentication state projected from @epoch/identity records by the host.',
  });

/**
 * Caller-supplied membership facts. Runtime refinement: the scope chain
 * is complete (a workspace membership requires its tenant; a project
 * membership requires its workspace).
 */
export const MembershipFactSchema = z
  .strictObject({
    principalId: PrincipalIdSchema,
    tenantId: TenantIdSchema,
    workspaceId: WorkspaceIdSchema.optional(),
    projectId: ProjectIdSchema.optional(),
  })
  .readonly()
  .refine(
    (membership) =>
      (membership.workspaceId === undefined || membership.tenantId !== undefined) &&
      (membership.projectId === undefined || membership.workspaceId !== undefined),
    'the scope chain must be complete: a workspace membership requires its tenant; a project membership requires its workspace',
  )
  .meta({
    id: 'MembershipFact',
    title: 'MembershipFact',
    description:
      'Caller-supplied tenancy membership fact: tenant-wide (tenant only), workspace-wide (tenant + workspace), or project-scoped (tenant + workspace + project).',
  });

/**
 * The decision context. Runtime refinements: principal facts are
 * duplicate-free (one fact per principal — conflicting facts are
 * rejected, not averaged) and every membership references a principal
 * that has a fact.
 */
export const AuthorizationContextSchema = z
  .strictObject({
    schemaVersion: AuthorizationRecordVersionSchema,
    principals: z.array(PrincipalFactSchema).readonly(),
    memberships: z.array(MembershipFactSchema).readonly(),
    knownTenants: z.array(TenantIdSchema).readonly(),
  })
  .readonly()
  .refine(
    (context) =>
      new Set(context.principals.map((fact) => fact.principalId)).size ===
      context.principals.length,
    'principal facts must be duplicate-free (one fact per principal)',
  )
  .refine(
    (context) =>
      context.memberships.every((membership) =>
        context.principals.some((fact) => fact.principalId === membership.principalId),
      ),
    'every membership must reference a principal that has a fact',
  )
  .meta({
    id: 'AuthorizationContext',
    title: 'AuthorizationContext',
    description:
      'Caller-supplied decision context: principal facts, membership facts, and known tenants (projected from @epoch/identity and @epoch/tenancy by the host).',
  });

/** A machine-readable denial. */
export const DenialSchema = z
  .strictObject({
    code: DenialCodeSchema,
    message: z.string().min(1).max(2000),
  })
  .readonly()
  .meta({
    id: 'Denial',
    title: 'Denial',
    description: 'A machine-readable denial: exactly one typed code plus an audit message.',
  });

const decisionBase = {
  schemaVersion: AuthorizationRecordVersionSchema,
  requestDigest: Sha256DigestSchema,
  evidence: z.array(EvidencePathSchema).readonly(),
} as const;

/** The allow decision. */
export const AllowDecisionSchema = z
  .strictObject({
    ...decisionBase,
    outcome: z.literal('allow'),
    reasons: z.array(AllowReasonSchema).readonly(),
  })
  .readonly()
  .meta({
    id: 'AllowDecision',
    title: 'AllowDecision',
    description: 'Allow decision: typed reasons plus exact evidence paths, answering one exact request revision.',
  });

/** The deny decision. */
export const DenyDecisionSchema = z
  .strictObject({
    ...decisionBase,
    outcome: z.literal('deny'),
    denial: DenialSchema,
  })
  .readonly()
  .meta({
    id: 'DenyDecision',
    title: 'DenyDecision',
    description: 'Deny decision: exactly one typed denial plus exact evidence paths (fail-closed).',
  });

/** The not-applicable decision. */
export const NotApplicableDecisionSchema = z
  .strictObject({
    ...decisionBase,
    outcome: z.literal('not-applicable'),
    reason: NotApplicableReasonSchema,
    message: z.string().min(1).max(2000),
  })
  .readonly()
  .meta({
    id: 'NotApplicableDecision',
    title: 'NotApplicableDecision',
    description:
      'Not-applicable decision: this decision point has nothing to say (e.g. a platform-scoped resource); the caller routes to the responsible authority.',
  });

/** The exhaustive decision union. */
export const AuthorizationDecisionSchema = z
  .discriminatedUnion('outcome', [
    AllowDecisionSchema,
    DenyDecisionSchema,
    NotApplicableDecisionSchema,
  ])
  .meta({
    id: 'AuthorizationDecision',
    title: 'AuthorizationDecision',
    description:
      'Exhaustive authorization decision union: allow (typed reasons), deny (typed denial), or not-applicable (typed reason) — each carrying the request digest and exact evidence paths.',
  });

/** The W004 policy-target projection (parity-pinned against PolicyTarget). */
export const AuthorizationPolicyTargetSchema = z
  .strictObject({
    tenantId: scopeString.optional(),
    workspaceId: scopeString.optional(),
    projectId: scopeString.optional(),
    actionKind: scopeString.optional(),
    resourceType: scopeString.optional(),
    tags: z.array(scopeString).optional(),
  })
  .meta({
    id: 'AuthorizationPolicyTarget',
    title: 'AuthorizationPolicyTarget',
    description:
      'The W004 policy-target projection of an authorization request: tenant/workspace/project scope, action kind, resource type, and optional tags (shape-compatible with @epoch/policy-contracts PolicyTarget; pinned by parity tests).',
  });
