/**
 * Compile-time conformance assertions for the simulation contract
 * surface.
 *
 * This file imports both the published declarations (`./index`) and the
 * runtime implementation (`@epoch/simulation-protocol`) and asserts, for
 * every type in the published surface (plus the documented mirrored
 * primitives), that the two are *identical* under the strictest
 * TypeScript type-equality check. It is compiled by
 * `packages/simulation-protocol/tsconfig.contracts.json` as part of
 * `pnpm typecheck`; any drift between the published contract and the
 * implementation fails the type check.
 *
 * This file is verification-only: it declares no runtime dependency
 * between the contract surface and the implementation (the import is
 * type-only) and is never shipped.
 */
import type * as contracts from './index';
import type * as impl from '@epoch/simulation-protocol';

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

// Simulation protocol surface.
export type SimulationProtocolVersionParity = Expect<
  Equals<contracts.SimulationProtocolVersion, impl.SimulationProtocolVersion>
>;
export type SimulationMessageKindParity = Expect<
  Equals<contracts.SimulationMessageKind, impl.SimulationMessageKind>
>;
export type SimulatorIdParity = Expect<Equals<contracts.SimulatorId, impl.SimulatorId>>;
export type FidelityProfileParity = Expect<
  Equals<contracts.FidelityProfile, impl.FidelityProfile>
>;
export type ValidityDomainParity = Expect<
  Equals<contracts.ValidityDomain, impl.ValidityDomain>
>;
export type SeedPolicyParity = Expect<Equals<contracts.SeedPolicy, impl.SeedPolicy>>;
export type ReproducibilityProfileParity = Expect<
  Equals<contracts.ReproducibilityProfile, impl.ReproducibilityProfile>
>;
export type SimulatorRegistrationParity = Expect<
  Equals<contracts.SimulatorRegistration, impl.SimulatorRegistration>
>;
export type SimulatorReferenceParity = Expect<
  Equals<contracts.SimulatorReference, impl.SimulatorReference>
>;
export type SimulationInvocationRequestParity = Expect<
  Equals<contracts.SimulationInvocationRequest, impl.SimulationInvocationRequest>
>;
export type InvocationReferenceParity = Expect<
  Equals<contracts.InvocationReference, impl.InvocationReference>
>;
export type SimulationFailureCodeParity = Expect<
  Equals<contracts.SimulationFailureCode, impl.SimulationFailureCode>
>;
export type SimulationFailureParity = Expect<
  Equals<contracts.SimulationFailure, impl.SimulationFailure>
>;
export type SimulationResultStatusParity = Expect<
  Equals<contracts.SimulationResultStatus, impl.SimulationResultStatus>
>;
export type CompletedSimulationResultParity = Expect<
  Equals<contracts.CompletedSimulationResult, impl.CompletedSimulationResult>
>;
export type FailedSimulationResultParity = Expect<
  Equals<contracts.FailedSimulationResult, impl.FailedSimulationResult>
>;
export type SimulationOutcomeParity = Expect<
  Equals<contracts.SimulationOutcome, impl.SimulationOutcome>
>;
export type SimulationResultParity = Expect<
  Equals<contracts.SimulationResult, impl.SimulationResult>
>;
