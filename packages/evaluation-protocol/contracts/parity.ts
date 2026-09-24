/**
 * Compile-time conformance assertions for the evaluation contract
 * surface.
 *
 * This file imports both the published declarations (`./index`) and the
 * runtime implementation (`@epoch/evaluation-protocol`) and asserts, for
 * every type in the published surface (plus the documented mirrored
 * primitives), that the two are *identical* under the strictest
 * TypeScript type-equality check. It is compiled by
 * `packages/evaluation-protocol/tsconfig.contracts.json` as part of
 * `pnpm typecheck`; any drift between the published contract and the
 * implementation fails the type check.
 *
 * This file is verification-only: it declares no runtime dependency
 * between the contract surface and the implementation (the import is
 * type-only) and is never shipped.
 */
import type * as contracts from './index';
import type * as impl from '@epoch/evaluation-protocol';

/** Strictest type identity: distinguishes optionality, readonly, unions. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time assertion helper: fails unless T is `true`. */
type Expect<T extends true> = T;

// Mirrored shared primitives (owned at contracts/agent).
export type TimestampParity = Expect<Equals<contracts.Timestamp, impl.Timestamp>>;
export type MessageIdParity = Expect<Equals<contracts.MessageId, impl.MessageId>>;
export type JsonValueParity = Expect<Equals<contracts.JsonValue, impl.JsonValue>>;
export type ParameterKindParity = Expect<
  Equals<contracts.ParameterKind, impl.ParameterKind>
>;
export type ParameterSpecParity = Expect<
  Equals<contracts.ParameterSpec, impl.ParameterSpec>
>;
export type CostProfileParity = Expect<Equals<contracts.CostProfile, impl.CostProfile>>;
export type LatencyProfileParity = Expect<
  Equals<contracts.LatencyProfile, impl.LatencyProfile>
>;

// Evaluation protocol surface.
export type EvaluationProtocolVersionParity = Expect<
  Equals<contracts.EvaluationProtocolVersion, impl.EvaluationProtocolVersion>
>;
export type EvaluationMessageKindParity = Expect<
  Equals<contracts.EvaluationMessageKind, impl.EvaluationMessageKind>
>;
export type EvaluationSubjectKindParity = Expect<
  Equals<contracts.EvaluationSubjectKind, impl.EvaluationSubjectKind>
>;
export type EvaluationSubjectParity = Expect<
  Equals<contracts.EvaluationSubject, impl.EvaluationSubject>
>;
export type EvaluatorIdParity = Expect<Equals<contracts.EvaluatorId, impl.EvaluatorId>>;
export type VerdictFormParity = Expect<Equals<contracts.VerdictForm, impl.VerdictForm>>;
export type JudgmentBasisParity = Expect<
  Equals<contracts.JudgmentBasis, impl.JudgmentBasis>
>;
export type EvaluatorRegistrationParity = Expect<
  Equals<contracts.EvaluatorRegistration, impl.EvaluatorRegistration>
>;
export type EvaluatorReferenceParity = Expect<
  Equals<contracts.EvaluatorReference, impl.EvaluatorReference>
>;
export type EvaluationRequestParity = Expect<
  Equals<contracts.EvaluationRequest, impl.EvaluationRequest>
>;
export type EvaluationRequestReferenceParity = Expect<
  Equals<contracts.EvaluationRequestReference, impl.EvaluationRequestReference>
>;
export type PassFailVerdictParity = Expect<
  Equals<contracts.PassFailVerdict, impl.PassFailVerdict>
>;
export type ScoredVerdictParity = Expect<
  Equals<contracts.ScoredVerdict, impl.ScoredVerdict>
>;
export type VerdictOutcomeParity = Expect<
  Equals<contracts.VerdictOutcome, impl.VerdictOutcome>
>;
export type JustificationKindParity = Expect<
  Equals<contracts.JustificationKind, impl.JustificationKind>
>;
export type JustificationReferenceParity = Expect<
  Equals<contracts.JustificationReference, impl.JustificationReference>
>;
export type EvaluationVerdictParity = Expect<
  Equals<contracts.EvaluationVerdict, impl.EvaluationVerdict>
>;
