/**
 * The action-protocol schema surface registry: every data type published at
 * the `contracts/actions` boundary, paired with its zod schema.
 *
 * Invariants enforced by tests (mirroring the agent protocol):
 * - every entry is exported from the package index;
 * - every entry has a declaration in `contracts/actions/index.d.ts`;
 * - every entry has a compile-time parity assertion in
 *   `contracts/actions/parity.ts`;
 * - every entry has an emitted JSON Schema file listed in
 *   `contracts/actions/manifest.json` with a matching digest.
 */
import type { ZodType } from 'zod';
import { ActionProtocolVersionSchema, ActionMessageKindSchema } from './version';
import {
  ActionTargetKindSchema,
  ActionTargetSchema,
  PreconditionSchema,
  PredictedEffectSchema,
  EffectConfidenceSchema,
  SideEffectSchema,
  ReversibilityClassificationSchema,
} from './targets';
import {
  AuthorityScopeSchema,
  ApprovalQuorumSchema,
  AuthorityRequirementsSchema,
} from './authority';
import { ActionTypeReferenceSchema, ProposalReferenceSchema, ActionProposalSchema } from './proposal';
import {
  PrincipalReferenceSchema,
  AuthorizerReferenceSchema,
  AuthorizationConditionSchema,
  DenialCodeSchema,
  AuthorizedDecisionSchema,
  DeniedDecisionSchema,
  EscalatedDecisionSchema,
  DecisionSchema,
  AuthorizationRequestSchema,
  AuthorizationDecisionSchema,
  RequestingRoleSchema,
  AuthorizerRoleSchema,
} from './authorization';
import { ActionProtocolMessageSchema } from './message';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of action protocol v1. */
export const ACTION_PROTOCOL_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'ActionMessageKind', schema: ActionMessageKindSchema },
  { type: 'ActionProtocolMessage', schema: ActionProtocolMessageSchema },
  { type: 'ActionProtocolVersion', schema: ActionProtocolVersionSchema },
  { type: 'ActionProposal', schema: ActionProposalSchema },
  { type: 'ActionTarget', schema: ActionTargetSchema },
  { type: 'ActionTargetKind', schema: ActionTargetKindSchema },
  { type: 'ActionTypeReference', schema: ActionTypeReferenceSchema },
  { type: 'ApprovalQuorum', schema: ApprovalQuorumSchema },
  { type: 'AuthorizationCondition', schema: AuthorizationConditionSchema },
  { type: 'AuthorizationDecision', schema: AuthorizationDecisionSchema },
  { type: 'AuthorizationRequest', schema: AuthorizationRequestSchema },
  { type: 'AuthorityRequirements', schema: AuthorityRequirementsSchema },
  { type: 'AuthorityScope', schema: AuthorityScopeSchema },
  { type: 'AuthorizerReference', schema: AuthorizerReferenceSchema },
  { type: 'AuthorizerRole', schema: AuthorizerRoleSchema },
  { type: 'AuthorizedDecision', schema: AuthorizedDecisionSchema },
  { type: 'Decision', schema: DecisionSchema },
  { type: 'DenialCode', schema: DenialCodeSchema },
  { type: 'DeniedDecision', schema: DeniedDecisionSchema },
  { type: 'EffectConfidence', schema: EffectConfidenceSchema },
  { type: 'EscalatedDecision', schema: EscalatedDecisionSchema },
  { type: 'Precondition', schema: PreconditionSchema },
  { type: 'PredictedEffect', schema: PredictedEffectSchema },
  { type: 'PrincipalReference', schema: PrincipalReferenceSchema },
  { type: 'ProposalReference', schema: ProposalReferenceSchema },
  { type: 'RequestingRole', schema: RequestingRoleSchema },
  { type: 'ReversibilityClassification', schema: ReversibilityClassificationSchema },
  { type: 'SideEffect', schema: SideEffectSchema },
];
