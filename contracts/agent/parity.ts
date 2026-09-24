/**
 * Compile-time conformance assertions for the agent contract surface.
 *
 * This file imports both the published declarations (`./index`) and the
 * runtime implementation (`@epoch/agent-protocol`) and asserts, for every
 * type in the published surface, that the two are *identical* under the
 * strictest TypeScript type-equality check. It is compiled by
 * `packages/agent-protocol/tsconfig.contracts.json` as part of
 * `pnpm typecheck`; any drift between the published contract and the
 * implementation fails the type check.
 *
 * This file is verification-only: it declares no runtime dependency between
 * the contract surface and the implementation (the import is type-only) and
 * is never shipped.
 */
import type * as contracts from './index';
import type * as impl from '@epoch/agent-protocol';

/** Strictest type identity: distinguishes optionality, readonly, unions. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time assertion helper: fails unless T is `true`. */
type Expect<T extends true> = T;

export type ProtocolVersionParity = Expect<
  Equals<contracts.ProtocolVersion, impl.ProtocolVersion>
>;
export type MessageKindParity = Expect<Equals<contracts.MessageKind, impl.MessageKind>>;
export type TimestampParity = Expect<Equals<contracts.Timestamp, impl.Timestamp>>;
export type MessageIdParity = Expect<Equals<contracts.MessageId, impl.MessageId>>;
export type AgentIdParity = Expect<Equals<contracts.AgentId, impl.AgentId>>;
export type JsonValueParity = Expect<Equals<contracts.JsonValue, impl.JsonValue>>;
export type QualifiedTypeReferenceParity = Expect<
  Equals<contracts.QualifiedTypeReference, impl.QualifiedTypeReference>
>;
export type ExecutorKindParity = Expect<Equals<contracts.ExecutorKind, impl.ExecutorKind>>;
export type ExecutorParity = Expect<Equals<contracts.Executor, impl.Executor>>;
export type ParameterKindParity = Expect<
  Equals<contracts.ParameterKind, impl.ParameterKind>
>;
export type ParameterSpecParity = Expect<
  Equals<contracts.ParameterSpec, impl.ParameterSpec>
>;
export type CapabilityDeclarationParity = Expect<
  Equals<contracts.CapabilityDeclaration, impl.CapabilityDeclaration>
>;
export type ToolDeclarationParity = Expect<
  Equals<contracts.ToolDeclaration, impl.ToolDeclaration>
>;
export type AuthorityDeclarationParity = Expect<
  Equals<contracts.AuthorityDeclaration, impl.AuthorityDeclaration>
>;
export type CostProfileParity = Expect<Equals<contracts.CostProfile, impl.CostProfile>>;
export type LatencyProfileParity = Expect<
  Equals<contracts.LatencyProfile, impl.LatencyProfile>
>;
export type EvidenceRequirementsParity = Expect<
  Equals<contracts.EvidenceRequirements, impl.EvidenceRequirements>
>;
export type AgentRegistrationParity = Expect<
  Equals<contracts.AgentRegistration, impl.AgentRegistration>
>;
