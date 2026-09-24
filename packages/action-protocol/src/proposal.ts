/**
 * The action proposal message (`messageKind: "action.proposal"`).
 *
 * Agents PROPOSE typed interventions; the Action Gateway (W022) authorizes
 * and executes. A proposal carries target, parameters, preconditions,
 * predicted effects, side effects, reversibility classification, and
 * authority requirements — the safety-relevant metadata is REQUIRED (not
 * optional), and unknown fields are rejected (strict objects), so a
 * proposal can never smuggle authorization or execution vocabulary.
 */
import { z } from 'zod';
import {
  AgentIdSchema,
  JsonValueSchema,
  MessageIdSchema,
  PARAMETER_NAME_PATTERN,
  QUALIFIED_NAME_PATTERN,
  SEMVER_CORE_PATTERN,
  TimestampSchema,
} from '@epoch/agent-protocol';
import { admitMessage, unwrapOrThrow, type ParseOutcome } from '@epoch/agent-protocol';
import {
  PreconditionSchema,
  PredictedEffectSchema,
  ReversibilityClassificationSchema,
  SideEffectSchema,
  ActionTargetSchema,
} from './targets';
import { AuthorityRequirementsSchema } from './authority';
import {
  ACTION_MESSAGE_KIND_PROPOSAL,
  ACTION_PROTOCOL_VERSION,
  ActionProtocolVersionSchema,
} from './version';

/**
 * Reference to a versioned action type: dot-namespaced id (e.g.
 * `structural.element.reinforce`) plus semver core version. Self-contained
 * in this package (mirrors the agent protocol's QualifiedTypeReference
 * shape) so `contracts/actions` stays an independent published surface.
 */
export const ActionTypeReferenceSchema = z
  .strictObject({
    id: z.string().regex(QUALIFIED_NAME_PATTERN),
    version: z.string().regex(SEMVER_CORE_PATTERN),
  })
  .meta({
    id: 'ActionTypeReference',
    title: 'ActionTypeReference',
    description: 'Reference to a versioned action type: dot-namespaced id plus semver core version.',
  });

export type ActionTypeReference = z.infer<typeof ActionTypeReferenceSchema>;

/**
 * Exact-revision reference to a proposal: the proposal id plus the SHA-256
 * digest of the proposal's canonical JSON. Authorization requests and
 * decisions bind to the exact revision of the proposal they concern.
 */
export const ProposalReferenceSchema = z
  .strictObject({
    proposalId: MessageIdSchema,
    canonicalDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .meta({
    id: 'ProposalReference',
    title: 'ProposalReference',
    description:
      'Exact-revision proposal reference: id plus the SHA-256 digest of the canonical proposal.',
  });

export type ProposalReference = z.infer<typeof ProposalReferenceSchema>;

/**
 * The action proposal message. Runtime refinements beyond the schema:
 * none — but note the structural constraints: `predictedEffects` requires
 * at least one entry (an action that predicts nothing cannot be evaluated
 * before execution, violating R4), `parameters` keys are constrained to
 * the parameter-name charset, and strict objects reject unknown fields
 * (authorization vocabulary cannot be smuggled in).
 */
export const ActionProposalSchema = z
  .strictObject({
    protocolVersion: ActionProtocolVersionSchema,
    messageKind: z.literal(ACTION_MESSAGE_KIND_PROPOSAL),
    messageId: MessageIdSchema,
    createdAt: TimestampSchema,
    proposalId: MessageIdSchema,
    proposedBy: AgentIdSchema,
    actionType: ActionTypeReferenceSchema,
    target: ActionTargetSchema,
    parameters: z.record(z.string().regex(PARAMETER_NAME_PATTERN), JsonValueSchema),
    preconditions: z.array(PreconditionSchema),
    predictedEffects: z.array(PredictedEffectSchema).min(1),
    sideEffects: z.array(SideEffectSchema),
    reversibility: ReversibilityClassificationSchema,
    authorityRequirements: AuthorityRequirementsSchema,
    rationale: z.string().max(10000).optional(),
    /** Opaque evidence identifiers; evidence semantics are owned by W006. */
    evidenceRefs: z.array(z.string().min(1).max(256)).min(1).optional(),
    expiresAt: TimestampSchema.optional(),
  })
  .meta({
    id: 'ActionProposal',
    title: 'ActionProposal',
    description:
      'Typed intervention proposal: target, parameters, preconditions, predicted effects, side effects, reversibility, and authority requirements.',
  });

export type ActionProposal = z.infer<typeof ActionProposalSchema>;

/**
 * Admit an action proposal through the shared pipeline (version gate, kind
 * gate, schema validation, canonical evidence form).
 */
export function parseActionProposal(input: unknown): ParseOutcome<ActionProposal> {
  return admitMessage({
    input,
    expectedVersion: ACTION_PROTOCOL_VERSION,
    expectedKind: ACTION_MESSAGE_KIND_PROPOSAL,
    schema: ActionProposalSchema,
  });
}

/** Throwing variant of {@link parseActionProposal}. */
export function validateActionProposal(input: unknown): ActionProposal {
  return unwrapOrThrow(parseActionProposal(input));
}
