/**
 * Authorization messages: request and decision.
 *
 * The Action Gateway (W022) owns the authorization flow; this module
 * defines the protocol message shapes. The authority split is encoded
 * structurally: an {@link AuthorizerReference} may only be an
 * `action-gateway` or a `human-approver` — an agent cannot be expressed as
 * the source of an authorization decision (architecture lock rules 2/3).
 * Principal/role semantics beyond these protocol roles are owned by the
 * tenancy/identity/authorization domain (W009).
 */
import { z } from 'zod';
import { MessageIdSchema, TimestampSchema } from '@epoch/agent-protocol';
import { admitMessage, unwrapOrThrow, type ParseOutcome } from '@epoch/agent-protocol';
import { AuthorityScopeSchema } from './authority';
import { ProposalReferenceSchema } from './proposal';
import {
  ACTION_MESSAGE_KIND_AUTHORIZATION_DECISION,
  ACTION_MESSAGE_KIND_AUTHORIZATION_REQUEST,
  ACTION_PROTOCOL_VERSION,
  ActionProtocolVersionSchema,
} from './version';

/** Roles that may request an authorization decision. */
export const REQUESTING_ROLES = ['action-gateway', 'agent-runtime', 'human'] as const;

export type RequestingRole = (typeof REQUESTING_ROLES)[number];

export const RequestingRoleSchema = z.enum(REQUESTING_ROLES).meta({
  id: 'RequestingRole',
  title: 'RequestingRole',
  description: 'Roles that may request an authorization decision: action-gateway, agent-runtime, or human.',
});

/**
 * Who asked for an authorization decision: the gateway itself, an agent
 * runtime (proposing and requesting is legitimate), or a human.
 */
export const PrincipalReferenceSchema = z
  .strictObject({
    /** Opaque principal identifier (W009 reconciliation). */
    id: z.string().min(1).max(128),
    role: RequestingRoleSchema,
  })
  .meta({
    id: 'PrincipalReference',
    title: 'PrincipalReference',
    description: 'Who requested an authorization decision: action-gateway, agent-runtime, or human.',
  });

export type PrincipalReference = z.infer<typeof PrincipalReferenceSchema>;

/**
 * Roles that may issue an authorization decision. Deliberately narrow —
 * agents are structurally excluded: only the Action Gateway itself or a
 * human approver it delegated to can decide.
 */
export const AUTHORIZER_ROLES = ['action-gateway', 'human-approver'] as const;

export type AuthorizerRole = (typeof AUTHORIZER_ROLES)[number];

export const AuthorizerRoleSchema = z.enum(AUTHORIZER_ROLES).meta({
  id: 'AuthorizerRole',
  title: 'AuthorizerRole',
  description:
    'Roles that may issue an authorization decision: action-gateway or human-approver. Agents are structurally excluded.',
});

export const AuthorizerReferenceSchema = z
  .strictObject({
    /** Opaque authorizer identifier (W009/W022 reconciliation). */
    id: z.string().min(1).max(128),
    role: AuthorizerRoleSchema,
  })
  .meta({
    id: 'AuthorizerReference',
    title: 'AuthorizerReference',
    description:
      'Who issued an authorization decision: the Action Gateway or a human approver. Agents are structurally excluded.',
  });

export type AuthorizerReference = z.infer<typeof AuthorizerReferenceSchema>;

/**
 * A condition attached to an authorization. `constraintRef` is opaque —
 * compiled constraint semantics are owned by W004.
 */
export const AuthorizationConditionSchema = z
  .strictObject({
    description: z.string().min(1).max(2000),
    constraintRef: z.string().min(1).max(256).optional(),
  })
  .meta({
    id: 'AuthorizationCondition',
    title: 'AuthorizationCondition',
    description: 'A condition attached to an authorization, optionally bound to a compiled constraint (W004).',
  });

export type AuthorizationCondition = z.infer<typeof AuthorizationConditionSchema>;

/** Machine-readable denial codes (protocol-level, provider-neutral). */
export const DENIAL_CODES = [
  'missing-authority',
  'policy-violation',
  'precondition-unmet',
  'insufficient-evidence',
  'proposal-expired',
  'out-of-scope',
  'other',
] as const;

export type DenialCode = (typeof DENIAL_CODES)[number];

export const DenialCodeSchema = z.enum(DENIAL_CODES).meta({
  id: 'DenialCode',
  title: 'DenialCode',
  description: 'Machine-readable denial code carried by denied authorization decisions.',
});

/**
 * The authorization request message (`messageKind:
 * "action.authorization-request"`): a request for an authorization decision
 * over an exact proposal revision, with the scopes requested, a mandatory
 * justification (auditability), and optional simulation/evaluation context
 * (R4 — simulate and evaluate before execution; the references are opaque,
 * owned by W005/W021 and the evidence domain).
 */
export const AuthorizationRequestSchema = z
  .strictObject({
    protocolVersion: ActionProtocolVersionSchema,
    messageKind: z.literal(ACTION_MESSAGE_KIND_AUTHORIZATION_REQUEST),
    messageId: MessageIdSchema,
    createdAt: TimestampSchema,
    requestId: MessageIdSchema,
    proposalRef: ProposalReferenceSchema,
    requestedBy: PrincipalReferenceSchema,
    requestedScopes: z.array(AuthorityScopeSchema).min(1),
    justification: z.string().min(1).max(10000),
    context: z
      .strictObject({
        simulationRunRef: z.string().min(1).max(256).optional(),
        evaluationRef: z.string().min(1).max(256).optional(),
        evidenceRefs: z.array(z.string().min(1).max(256)).min(1).optional(),
      })
      .optional(),
  })
  .meta({
    id: 'AuthorizationRequest',
    title: 'AuthorizationRequest',
    description:
      'Request for an authorization decision over an exact proposal revision, with scopes, justification, and optional simulation/evaluation context.',
  });

export type AuthorizationRequest = z.infer<typeof AuthorizationRequestSchema>;

/** An authorization to execute, possibly under conditions. */
export const AuthorizedDecisionSchema = z
  .strictObject({
    kind: z.literal('authorized'),
    conditions: z.array(AuthorizationConditionSchema),
    validUntil: TimestampSchema.optional(),
  })
  .meta({
    id: 'AuthorizedDecision',
    title: 'AuthorizedDecision',
    description: 'Authorization to execute, possibly under conditions and a validity deadline.',
  });

export type AuthorizedDecision = z.infer<typeof AuthorizedDecisionSchema>;

/** A denial with a machine-readable code and a required reason. */
export const DeniedDecisionSchema = z
  .strictObject({
    kind: z.literal('denied'),
    code: DenialCodeSchema,
    reason: z.string().min(1).max(10000),
  })
  .meta({
    id: 'DeniedDecision',
    title: 'DeniedDecision',
    description: 'Denial with a machine-readable code and a required human-auditable reason.',
  });

export type DeniedDecision = z.infer<typeof DeniedDecisionSchema>;

/** Escalation to another authorizer (gateway role or human approver). */
export const EscalatedDecisionSchema = z
  .strictObject({
    kind: z.literal('escalated'),
    escalatedTo: AuthorizerReferenceSchema,
    reason: z.string().min(1).max(10000),
  })
  .meta({
    id: 'EscalatedDecision',
    title: 'EscalatedDecision',
    description: 'Escalation of the decision to another authorizer (gateway role or human approver).',
  });

export type EscalatedDecision = z.infer<typeof EscalatedDecisionSchema>;

/** The decision itself: authorized, denied, or escalated (exhaustive union). */
export const DecisionSchema = z
  .discriminatedUnion('kind', [
    AuthorizedDecisionSchema,
    DeniedDecisionSchema,
    EscalatedDecisionSchema,
  ])
  .meta({
    id: 'Decision',
    title: 'Decision',
    description: 'Exhaustive authorization decision union: authorized, denied, or escalated.',
  });

export type Decision = z.infer<typeof DecisionSchema>;

/**
 * The authorization decision message (`messageKind:
 * "action.authorization-decision"`): the outcome for one request over one
 * exact proposal revision, issued by the Action Gateway or a human
 * approver. `decidedBy.role` structurally excludes agents.
 */
export const AuthorizationDecisionSchema = z
  .strictObject({
    protocolVersion: ActionProtocolVersionSchema,
    messageKind: z.literal(ACTION_MESSAGE_KIND_AUTHORIZATION_DECISION),
    messageId: MessageIdSchema,
    createdAt: TimestampSchema,
    requestId: MessageIdSchema,
    proposalRef: ProposalReferenceSchema,
    decidedBy: AuthorizerReferenceSchema,
    decision: DecisionSchema,
  })
  .meta({
    id: 'AuthorizationDecision',
    title: 'AuthorizationDecision',
    description:
      'Authorization outcome for one request over an exact proposal revision, issued by the Action Gateway or a human approver.',
  });

export type AuthorizationDecision = z.infer<typeof AuthorizationDecisionSchema>;

/**
 * Admit an authorization request through the shared pipeline.
 */
export function parseAuthorizationRequest(input: unknown): ParseOutcome<AuthorizationRequest> {
  return admitMessage({
    input,
    expectedVersion: ACTION_PROTOCOL_VERSION,
    expectedKind: ACTION_MESSAGE_KIND_AUTHORIZATION_REQUEST,
    schema: AuthorizationRequestSchema,
  });
}

/** Throwing variant of {@link parseAuthorizationRequest}. */
export function validateAuthorizationRequest(input: unknown): AuthorizationRequest {
  return unwrapOrThrow(parseAuthorizationRequest(input));
}

/**
 * Admit an authorization decision through the shared pipeline.
 */
export function parseAuthorizationDecision(input: unknown): ParseOutcome<AuthorizationDecision> {
  return admitMessage({
    input,
    expectedVersion: ACTION_PROTOCOL_VERSION,
    expectedKind: ACTION_MESSAGE_KIND_AUTHORIZATION_DECISION,
    schema: AuthorizationDecisionSchema,
  });
}

/** Throwing variant of {@link parseAuthorizationDecision}. */
export function validateAuthorizationDecision(input: unknown): AuthorizationDecision {
  return unwrapOrThrow(parseAuthorizationDecision(input));
}
