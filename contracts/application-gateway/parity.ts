/**
 * Compile-time conformance assertions for the application-gateway contract
 * surface.
 *
 * Mirrors `contracts/capability-discovery/parity.ts` and
 * `contracts/tenancy/parity.ts`: imports both the published declarations
 * (`./index`) and the runtime implementation (`@epoch/client-runtime`) and
 * asserts strict type identity for every surface type, so the
 * self-contained declarations cannot drift from the implementation types.
 * Compiled by `packages/client-runtime`'s `typecheck` script
 * (`tsconfig.contracts.json`); any drift fails `pnpm typecheck`.
 * Verification-only; no runtime dependency.
 */
import type * as contracts from './index';
import type * as impl from '@epoch/client-runtime';

/** Strictest type identity: distinguishes optionality, readonly, unions. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time assertion helper: fails unless `T` is `true`. */
type Expect<T extends true> = T;

// Versions + vocabularies.
export type ApplicationGatewayContractVersionParity = Expect<
  Equals<contracts.ApplicationGatewayContractVersion, impl.ApplicationGatewayContractVersion>
>;
export type ClientRuntimeRecordVersionParity = Expect<
  Equals<contracts.ClientRuntimeRecordVersion, impl.ClientRuntimeRecordVersion>
>;
export type ClientRuntimeContractVersionParity = Expect<
  Equals<contracts.ClientRuntimeContractVersion, impl.ClientRuntimeContractVersion>
>;
export type GatewayOriginParity = Expect<Equals<contracts.GatewayOrigin, impl.GatewayOrigin>>;
export type GatewayOperationKindParity = Expect<
  Equals<contracts.GatewayOperationKind, impl.GatewayOperationKind>
>;
export type GatewayOperationNameParity = Expect<
  Equals<contracts.GatewayOperationName, impl.GatewayOperationName>
>;
export type GatewayOperationVocabularyParity = Expect<
  Equals<contracts.GatewayOperationVocabulary, impl.GatewayOperationVocabulary>
>;
export type GatewayOperationParity = Expect<
  Equals<contracts.GatewayOperation, impl.GatewayOperation>
>;
export type OfflineAdmissionCodeParity = Expect<
  Equals<contracts.OfflineAdmissionCode, impl.OfflineAdmissionCode>
>;
export type OfflineIntentStateParity = Expect<
  Equals<contracts.OfflineIntentState, impl.OfflineIntentState>
>;

// Error taxonomy.
export type GatewayErrorClassParity = Expect<
  Equals<contracts.GatewayErrorClass, impl.GatewayErrorClass>
>;
export type GatewayErrorCodeParity = Expect<
  Equals<contracts.GatewayErrorCode, impl.GatewayErrorCode>
>;
export type GatewayValidationIssueParity = Expect<
  Equals<contracts.GatewayValidationIssue, impl.GatewayValidationIssue>
>;
export type JsonValueParity = Expect<Equals<contracts.JsonValue, impl.JsonValue>>;
export type GatewayErrorDetailsParity = Expect<
  Equals<contracts.GatewayErrorDetails, impl.GatewayErrorDetails>
>;
export type GatewayErrorParity = Expect<Equals<contracts.GatewayError, impl.GatewayError>>;
export type ClientRecoveryActionParity = Expect<
  Equals<contracts.ClientRecoveryAction, impl.ClientRecoveryAction>
>;

// Correlation.
export type CorrelationIdParity = Expect<Equals<contracts.CorrelationId, impl.CorrelationId>>;
export type CausationIdParity = Expect<Equals<contracts.CausationId, impl.CausationId>>;
export type RequestCorrelationParity = Expect<
  Equals<contracts.RequestCorrelation, impl.RequestCorrelation>
>;

// Session.
export type ClientSessionStateParity = Expect<
  Equals<contracts.ClientSessionState, impl.ClientSessionState>
>;
export type SessionIdParity = Expect<Equals<contracts.SessionId, impl.SessionId>>;
export type ClientSessionParity = Expect<Equals<contracts.ClientSession, impl.ClientSession>>;
export type SessionRefParity = Expect<Equals<contracts.SessionRef, impl.SessionRef>>;

// Idempotency.
export type IdempotencyKeyParity = Expect<Equals<contracts.IdempotencyKey, impl.IdempotencyKey>>;
export type RequestFingerprintParity = Expect<
  Equals<contracts.RequestFingerprint, impl.RequestFingerprint>
>;
export type IdempotencyAddressParity = Expect<
  Equals<contracts.IdempotencyAddress, impl.IdempotencyAddress>
>;
export type IdempotencyRecordParity = Expect<
  Equals<contracts.IdempotencyRecord, impl.IdempotencyRecord>
>;
export type IdempotentReplayParity = Expect<
  Equals<contracts.IdempotentReplay, impl.IdempotentReplay>
>;

// Offline admission.
export type OfflineQueueScopeParity = Expect<
  Equals<contracts.OfflineQueueScope, impl.OfflineQueueScope>
>;
export type QueuedIntentParity = Expect<Equals<contracts.QueuedIntent, impl.QueuedIntent>>;

// Transport.
export type TenantScopeParity = Expect<Equals<contracts.TenantScope, impl.TenantScope>>;
export type GatewayRequestEnvelopeParity = Expect<
  Equals<contracts.GatewayRequestEnvelope, impl.GatewayRequestEnvelope>
>;
export type GatewayOutcomeParity = Expect<Equals<contracts.GatewayOutcome, impl.GatewayOutcome>>;

// Projection cache.
export type ProjectionCacheEntryParity = Expect<
  Equals<contracts.ProjectionCacheEntry, impl.ProjectionCacheEntry>
>;
