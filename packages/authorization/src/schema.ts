/**
 * @epoch/authorization — runtime zod validators for the published
 * contract types.
 *
 * Strict object shapes: unknown structural fields are rejected, so
 * provider-specific semantics (vendor, provider, endpoint, token
 * fields) cannot enter kernel types through the authorization door.
 * Every id is opaque; patterns only pin the STRUCTURE of the id spaces
 * (prefix conventions shared with @epoch/identity and @epoch/tenancy —
 * pinned by devDependency parity tests, never runtime imports).
 */
import { z } from 'zod';
import { MessageIdSchema, TimestampSchema } from '@epoch/agent-protocol';
import {
  AUTHORIZATION_RECORD_VERSION,
  DECISION_OUTCOMES,
  DECISION_REASON_CODES,
} from './version';

/** Lowercase hex SHA-256 digest (exactly 64 characters). */
export const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** Opaque principal identity: `principal:` + lowercase slug (identity id space). */
export const PRINCIPAL_ID_PATTERN = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;

/** Opaque tenant identity: `tenant:` + lowercase slug (tenancy id space). */
export const TENANT_ID_PATTERN = /^tenant:[a-z0-9][a-z0-9-]{0,62}$/;

/** Opaque resource identity: non-empty, bounded (owning domain defines the space). */
export const RESOURCE_ID_PATTERN = /^[\x21-\x7E]{1,128}$/;

/** Resource type: a lowercase slug (tenancy kinds and extensions). */
export const RESOURCE_TYPE_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;

/** Action kind: colon-namespaced like the W003 authority scopes (`world:write`). */
export const ACTION_KIND_PATTERN = /^[a-z0-9-]+(:[a-z0-9-]+)+$/;

/** Policy tag: bounded non-empty string (W004 policy-target vocabulary). */
export const POLICY_TAG_PATTERN = /^.{1,256}$/s;

/** SHA-256 digest as lowercase hex. */
export const Sha256DigestSchema = z
  .string()
  .regex(SHA256_HEX_PATTERN, 'must be a lowercase hex SHA-256 digest (64 characters)')
  .meta({
    id: 'Sha256Digest',
    title: 'Sha256Digest',
    description: 'Lowercase hexadecimal SHA-256 digest (exactly 64 characters).',
  });

/** Version discriminator on serialized authorization documents (v1). */
export const AuthorizationRecordVersionSchema = z
  .literal(AUTHORIZATION_RECORD_VERSION)
  .meta({
    id: 'AuthorizationRecordVersion',
    title: 'AuthorizationRecordVersion',
    description: 'Version discriminator carried by every serialized authorization document (currently 1).',
  });

/** Opaque principal identity (the @epoch/identity PrincipalId space). */
export const PrincipalIdSchema = z
  .string()
  .regex(PRINCIPAL_ID_PATTERN, 'must be a principal id: "principal:" + lowercase slug')
  .meta({
    id: 'PrincipalId',
    title: 'PrincipalId',
    description:
      'Opaque principal identity: "principal:" followed by a lowercase slug — the @epoch/identity id space.',
  });

/** Opaque tenant identity (the @epoch/tenancy TenantId space). */
export const TenantIdSchema = z
  .string()
  .regex(TENANT_ID_PATTERN, 'must be a tenant id: "tenant:" + lowercase slug')
  .meta({
    id: 'TenantId',
    title: 'TenantId',
    description:
      'Opaque tenant identity: "tenant:" followed by a lowercase slug — the @epoch/tenancy id space.',
  });

/** Opaque resource identity (owning domain defines the space). */
export const ResourceIdSchema = z
  .string()
  .regex(RESOURCE_ID_PATTERN, 'must be a non-empty opaque resource id (1..128 visible characters)')
  .meta({
    id: 'ResourceId',
    title: 'ResourceId',
    description:
      'Opaque resource identity (1..128 visible characters); the owning domain (tenancy, evidence, actions) defines the space.',
  });

/** Resource type: a lowercase slug. */
export const ResourceTypeSchema = z
  .string()
  .regex(RESOURCE_TYPE_PATTERN, 'must be a resource type slug (lowercase, hyphens)')
  .meta({
    id: 'ResourceType',
    title: 'ResourceType',
    description:
      'Resource class as a lowercase slug (e.g. "workspace", "world", "evidence") — provider-neutral.',
  });

/** Action kind: colon-namespaced (W003 authority-scope style). */
export const ActionKindSchema = z
  .string()
  .regex(ACTION_KIND_PATTERN, 'must be a colon-namespaced action kind, e.g. "world:write"')
  .meta({
    id: 'ActionKind',
    title: 'ActionKind',
    description:
      'Colon-namespaced action class, e.g. "world:write" or "evidence:append" — the same form as the W003 authority scopes.',
  });

/** A policy tag (bounded non-empty string). */
export const PolicyTagSchema = z.string().regex(POLICY_TAG_PATTERN).meta({
  id: 'PolicyTag',
  title: 'PolicyTag',
  description: 'Caller-supplied policy-matching tag (1..256 characters), provider-neutral.',
});

/** The typed (resourceType, resourceId) reference pair. */
export const ResourceReferenceSchema = z
  .strictObject({
    resourceType: ResourceTypeSchema,
    resourceId: ResourceIdSchema,
  })
  .readonly()
  .meta({
    id: 'ResourceReference',
    title: 'ResourceReference',
    description:
      'The resource a request targets: a typed (resourceType, resourceId) reference pair, both opaque to authorization.',
  });

/** Optional scope refinement (W004 policy-target projection fields). */
export const AuthorizationContextSchema = z
  .strictObject({
    workspaceId: z
      .string()
      .regex(/^workspace:[a-z0-9][a-z0-9-]{0,62}$/, 'must be a workspace id: "workspace:" + lowercase slug')
      .optional(),
    projectId: z
      .string()
      .regex(/^project:[a-z0-9][a-z0-9-]{0,62}$/, 'must be a project id: "project:" + lowercase slug')
      .optional(),
    tags: z.array(PolicyTagSchema).max(256).readonly().optional(),
  })
  .readonly()
  .meta({
    id: 'AuthorizationContext',
    title: 'AuthorizationContext',
    description:
      'Optional request scope refinement: workspace/project ids (tenancy id spaces) and caller-supplied tags for policy matching.',
  });

/**
 * An authorization request. The tenant scope is ALWAYS the explicit
 * `tenantId` field (typed `tenant:` id) — the context carries only
 * workspace/project refinements, so cross-tenant scope smuggling
 * through the context is structurally impossible.
 */
export const AuthorizationRequestSchema = z
  .strictObject({
    schemaVersion: AuthorizationRecordVersionSchema,
    requestId: MessageIdSchema,
    principalId: PrincipalIdSchema,
    tenantId: TenantIdSchema,
    resource: ResourceReferenceSchema,
    actionKind: ActionKindSchema,
    context: AuthorizationContextSchema.optional(),
    requestedAt: TimestampSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'AuthorizationRequest',
    title: 'AuthorizationRequest',
    description:
      'Authorization request: principal + tenant scope + resource reference + action, over opaque ids; the exact-revision evidence anchor of a decision.',
  });

/**
 * The W004-compatible policy-target projection of a request (pinned by
 * devDependency parity tests against @epoch/policy-contracts).
 */
export const PolicyTargetProjectionSchema = z
  .strictObject({
    tenantId: TenantIdSchema,
    workspaceId: z.string().min(1).max(256).optional(),
    projectId: z.string().min(1).max(256).optional(),
    actionKind: ActionKindSchema,
    resourceType: ResourceTypeSchema,
    tags: z.array(PolicyTagSchema).max(256).readonly().optional(),
  })
  .readonly()
  .meta({
    id: 'PolicyTargetProjection',
    title: 'PolicyTargetProjection',
    description:
      'The policy-target projection of an authorization request: exactly the shape @epoch/policy-contracts (W004) policy targets admit.',
  });

/**
 * An exact evidence path: opaque artifact id + revision label + SHA-256
 * content digest — structurally compatible with @epoch/evidence's
 * ExactRevisionRef (pinned by devDependency parity tests).
 */
export const EvidencePathSchema = z
  .strictObject({
    artifactId: z.string().min(1).max(256),
    revision: z.string().min(1).max(128),
    digest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'EvidencePath',
    title: 'EvidencePath',
    description:
      'Exact evidence path: the artifact revision backing a decision — opaque artifact id, revision label, and SHA-256 content digest (the @epoch/evidence exact-revision form).',
  });

/** Decision outcomes: allow, deny, or not-applicable. */
export const DecisionOutcomeSchema = z.enum(DECISION_OUTCOMES).meta({
  id: 'DecisionOutcome',
  title: 'DecisionOutcome',
  description:
    'Authorization decision outcome: allow, deny, or not-applicable (no policy applied — NOT an allow; consumers fail closed).',
});

/** Typed decision reason codes. */
export const DecisionReasonCodeSchema = z.enum(DECISION_REASON_CODES).meta({
  id: 'DecisionReasonCode',
  title: 'DecisionReasonCode',
  description:
    'Typed decision reason: principal-verified, tenant-verified, policy-allows, policy-denies, or no-applicable-policy.',
});

/** One typed decision reason (closed code + bounded detail). */
export const DecisionReasonSchema = z
  .strictObject({
    code: DecisionReasonCodeSchema,
    detail: z.string().min(1).max(2000).optional(),
  })
  .readonly()
  .meta({
    id: 'DecisionReason',
    title: 'DecisionReason',
    description: 'Typed decision reason: a closed code plus optional bounded human-auditable detail.',
  });

/**
 * A typed authorization decision. Runtime refinement: reasons are never
 * empty (auditability — R17).
 */
export const AuthorizationDecisionSchema = z
  .strictObject({
    schemaVersion: AuthorizationRecordVersionSchema,
    outcome: DecisionOutcomeSchema,
    requestId: MessageIdSchema,
    principalId: PrincipalIdSchema,
    tenantId: TenantIdSchema,
    resource: ResourceReferenceSchema,
    actionKind: ActionKindSchema,
    reasons: z.array(DecisionReasonSchema).min(1).readonly(),
    evidencePaths: z.array(EvidencePathSchema).readonly(),
    decidedAt: TimestampSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'AuthorizationDecision',
    title: 'AuthorizationDecision',
    description:
      'Typed authorization decision over an exact request revision: allow/deny/not-applicable with typed reasons and exact evidence paths.',
  });

/**
 * The published decision record: decision + its canonical-JSON SHA-256
 * content address. Parse verifies the digest (tamper detection).
 */
export const AuthorizationRecordSchema = z
  .strictObject({
    schemaVersion: AuthorizationRecordVersionSchema,
    decision: AuthorizationDecisionSchema,
    decisionDigest: Sha256DigestSchema,
  })
  .readonly()
  .meta({
    id: 'AuthorizationRecord',
    title: 'AuthorizationRecord',
    description:
      'Published authorization record: the typed decision plus the SHA-256 digest of its canonical JSON — the exact-revision address of the decision.',
  });
