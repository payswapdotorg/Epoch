/**
 * Authority requirements for action proposals.
 *
 * Every proposal MUST declare the authority scopes its execution would
 * exercise, whether human approval is required, and (if and only if human
 * approval is required) the approval quorum. The Action Gateway (W022)
 * evaluates these requirements against policy — this module defines the
 * protocol shapes only; no authorization logic lives here (agents propose,
 * the gateway authorizes: architecture lock rules 2/3).
 */
import { z } from 'zod';

/** Colon-namespaced authority scope, e.g. `world:write`, `external:git:write`. */
export const AUTHORITY_SCOPE_PATTERN = /^[a-z0-9-]+(:[a-z0-9-]+)+$/;

export const AuthorityScopeSchema = z.string().regex(AUTHORITY_SCOPE_PATTERN).meta({
  id: 'AuthorityScope',
  title: 'AuthorityScope',
  description: 'Colon-namespaced authority scope, e.g. "world:write" or "external:git:write".',
});

export type AuthorityScope = z.infer<typeof AuthorityScopeSchema>;

/**
 * Human approval quorum: how many approvals from which (opaque) roles are
 * required. Role semantics are owned by the tenancy/authorization domain
 * (W009 — reconciliation recorded as an architecture question).
 */
export const ApprovalQuorumSchema = z
  .strictObject({
    approvals: z.number().int().min(1),
    roles: z.array(z.string().min(1).max(128)).min(1),
  })
  .meta({
    id: 'ApprovalQuorum',
    title: 'ApprovalQuorum',
    description: 'How many approvals from which opaque roles are required.',
  });

export type ApprovalQuorum = z.infer<typeof ApprovalQuorumSchema>;

/**
 * Authority requirements — REQUIRED on every action proposal, with a
 * non-empty scope list. Runtime refinement: `approvalQuorum` must be
 * present if and only if `requiresHumanApproval` is true.
 */
export const AuthorityRequirementsSchema = z
  .strictObject({
    requiredScopes: z.array(AuthorityScopeSchema).min(1),
    requiresHumanApproval: z.boolean(),
    approvalQuorum: ApprovalQuorumSchema.optional(),
  })
  .refine(
    (requirements) =>
      requirements.requiresHumanApproval === (requirements.approvalQuorum !== undefined),
    'approvalQuorum must be present if and only if requiresHumanApproval is true',
  )
  .meta({
    id: 'AuthorityRequirements',
    title: 'AuthorityRequirements',
    description:
      'Required authority scopes and human-approval requirements, evaluated by the Action Gateway (W022).',
  });

export type AuthorityRequirements = z.infer<typeof AuthorityRequirementsSchema>;
