/**
 * Compile-time conformance assertions for the actions contract surface.
 *
 * Mirrors `contracts/agent/parity.ts`: imports both the published
 * declarations (`./index`) and the runtime implementation
 * (`@epoch/action-protocol`) and asserts strict type identity for every
 * surface type, plus the mirrored shared primitives (owned at
 * `contracts/agent`) so the self-contained redeclarations cannot drift.
 * Compiled by `packages/action-protocol/tsconfig.contracts.json` as part
 * of `pnpm typecheck`. Verification-only; no runtime dependency.
 */
import type * as contracts from './index';
import type * as impl from '@epoch/action-protocol';

/** Strictest type identity: distinguishes optionality, readonly, unions. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time assertion helper: fails unless T is `true`. */
type Expect<T extends true> = T;

// Mirrored shared primitives (owned at contracts/agent).
export type TimestampParity = Expect<Equals<contracts.Timestamp, impl.Timestamp>>;
export type MessageIdParity = Expect<Equals<contracts.MessageId, impl.MessageId>>;
export type AgentIdParity = Expect<Equals<contracts.AgentId, impl.AgentId>>;
export type JsonValueParity = Expect<Equals<contracts.JsonValue, impl.JsonValue>>;

// Action protocol surface.
export type ActionProtocolVersionParity = Expect<
  Equals<contracts.ActionProtocolVersion, impl.ActionProtocolVersion>
>;
export type ActionMessageKindParity = Expect<
  Equals<contracts.ActionMessageKind, impl.ActionMessageKind>
>;
export type ActionTargetKindParity = Expect<
  Equals<contracts.ActionTargetKind, impl.ActionTargetKind>
>;
export type ActionTargetParity = Expect<Equals<contracts.ActionTarget, impl.ActionTarget>>;
export type PreconditionParity = Expect<Equals<contracts.Precondition, impl.Precondition>>;
export type EffectConfidenceParity = Expect<
  Equals<contracts.EffectConfidence, impl.EffectConfidence>
>;
export type PredictedEffectParity = Expect<
  Equals<contracts.PredictedEffect, impl.PredictedEffect>
>;
export type SideEffectParity = Expect<Equals<contracts.SideEffect, impl.SideEffect>>;
export type ReversibilityClassificationParity = Expect<
  Equals<contracts.ReversibilityClassification, impl.ReversibilityClassification>
>;
export type AuthorityScopeParity = Expect<
  Equals<contracts.AuthorityScope, impl.AuthorityScope>
>;
export type ApprovalQuorumParity = Expect<
  Equals<contracts.ApprovalQuorum, impl.ApprovalQuorum>
>;
export type AuthorityRequirementsParity = Expect<
  Equals<contracts.AuthorityRequirements, impl.AuthorityRequirements>
>;
export type ActionTypeReferenceParity = Expect<
  Equals<contracts.ActionTypeReference, impl.ActionTypeReference>
>;
export type ProposalReferenceParity = Expect<
  Equals<contracts.ProposalReference, impl.ProposalReference>
>;
export type ActionProposalParity = Expect<
  Equals<contracts.ActionProposal, impl.ActionProposal>
>;
export type RequestingRoleParity = Expect<
  Equals<contracts.RequestingRole, impl.RequestingRole>
>;
export type PrincipalReferenceParity = Expect<
  Equals<contracts.PrincipalReference, impl.PrincipalReference>
>;
export type AuthorizerRoleParity = Expect<
  Equals<contracts.AuthorizerRole, impl.AuthorizerRole>
>;
export type AuthorizerReferenceParity = Expect<
  Equals<contracts.AuthorizerReference, impl.AuthorizerReference>
>;
export type AuthorizationConditionParity = Expect<
  Equals<contracts.AuthorizationCondition, impl.AuthorizationCondition>
>;
export type DenialCodeParity = Expect<Equals<contracts.DenialCode, impl.DenialCode>>;
export type AuthorizedDecisionParity = Expect<
  Equals<contracts.AuthorizedDecision, impl.AuthorizedDecision>
>;
export type DeniedDecisionParity = Expect<
  Equals<contracts.DeniedDecision, impl.DeniedDecision>
>;
export type EscalatedDecisionParity = Expect<
  Equals<contracts.EscalatedDecision, impl.EscalatedDecision>
>;
export type DecisionParity = Expect<Equals<contracts.Decision, impl.Decision>>;
export type AuthorizationRequestParity = Expect<
  Equals<contracts.AuthorizationRequest, impl.AuthorizationRequest>
>;
export type AuthorizationDecisionParity = Expect<
  Equals<contracts.AuthorizationDecision, impl.AuthorizationDecision>
>;
export type ActionProtocolMessageParity = Expect<
  Equals<contracts.ActionProtocolMessage, impl.ActionProtocolMessage>
>;
