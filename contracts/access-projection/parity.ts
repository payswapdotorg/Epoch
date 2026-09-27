/**
 * Compile-time conformance assertions for the access-projection contract
 * surface.
 *
 * Mirrors `contracts/solution-delivery/parity.ts` and
 * `contracts/procurement/parity.ts`: imports both the published
 * declarations (`./index`) and the runtime implementation
 * (`@epoch/access-projection`) and asserts strict type identity for
 * every surface type, so the self-contained declarations cannot drift
 * from the zod-inferred implementation types. Compiled by
 * `packages/access-projection`'s `typecheck` script
 * (`tsconfig.contracts.json`); any drift fails `pnpm typecheck`.
 * Verification-only; no runtime dependency.
 */
import type * as contracts from './index';
import type * as impl from '@epoch/access-projection';

/** Strictest type identity: distinguishes optionality, readonly, unions. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time assertion helper: fails unless `T` is `true`. */
type Expect<T extends true> = T;

// Versions + closed vocabularies.
export type ProjectionActionParity = Expect<Equals<contracts.ProjectionAction, impl.ProjectionAction>>;
export type ObjectClassParity = Expect<Equals<contracts.ObjectClass, impl.ObjectClass>>;
export type ProjectionPrincipalKindParity = Expect<
  Equals<contracts.ProjectionPrincipalKind, impl.ProjectionPrincipalKind>
>;
export type EvidenceScopeModeParity = Expect<
  Equals<contracts.EvidenceScopeMode, impl.EvidenceScopeMode>
>;
export type SectionVisibilityParity = Expect<
  Equals<contracts.SectionVisibility, impl.SectionVisibility>
>;
export type RedactionClassParity = Expect<Equals<contracts.RedactionClass, impl.RedactionClass>>;
export type PolicyStatusParity = Expect<Equals<contracts.PolicyStatus, impl.PolicyStatus>>;
export type AccessProjectionEventDiscriminatorParity = Expect<
  Equals<contracts.AccessProjectionEventDiscriminator, impl.AccessProjectionEventDiscriminator>
>;
export type AuditOutcomeParity = Expect<
  Equals<contracts.AuditOutcome, Extract<impl.SealedProjectionAudit, { outcome: 'released' | 'denied' }>['outcome']>
>;

// Neutral primitives.
export type JsonValueParity = Expect<Equals<contracts.JsonValue, impl.JsonValue>>;
export type Sha256HexParity = Expect<Equals<contracts.Sha256Hex, impl.Sha256Hex>>;
export type TimestampParity = Expect<Equals<contracts.Timestamp, impl.Timestamp>>;
export type TenantIdParity = Expect<Equals<contracts.TenantId, impl.TenantId>>;
export type PrincipalIdParity = Expect<Equals<contracts.PrincipalId, impl.PrincipalId>>;
export type PolicyIdParity = Expect<Equals<contracts.PolicyId, impl.PolicyId>>;
export type RoleIdParity = Expect<Equals<contracts.RoleId, impl.RoleId>>;
export type AgentTaskClassParity = Expect<Equals<contracts.AgentTaskClass, impl.AgentTaskClass>>;
export type AuditRecordIdParity = Expect<Equals<contracts.AuditRecordId, impl.AuditRecordId>>;
export type AccessStreamIdParity = Expect<Equals<contracts.AccessStreamId, impl.AccessStreamId>>;
export type AccessPrincipalIdParity = Expect<
  Equals<contracts.AccessPrincipalId, impl.AccessPrincipalId>
>;
export type FieldPathTemplateParity = Expect<
  Equals<contracts.FieldPathTemplate, impl.FieldPathTemplate>
>;
export type PositiveIntegerParity = Expect<
  Equals<contracts.PositiveInteger, impl.PositiveInteger>
>;

// Scope filters + redaction rules.
export type EvidenceScopeParity = Expect<Equals<contracts.EvidenceScope, impl.EvidenceScope>>;
export type ScopeFiltersParity = Expect<Equals<contracts.ScopeFilters, impl.ScopeFilters>>;
export type RedactionRuleParity = Expect<Equals<contracts.RedactionRule, impl.RedactionRule>>;

// Projection policies (policy is data).
export type BindingSelectorParity = Expect<
  Equals<contracts.BindingSelector, impl.BindingSelector>
>;
export type PolicyBindingParity = Expect<Equals<contracts.PolicyBinding, impl.PolicyBinding>>;
export type ProjectionSubjectParity = Expect<
  Equals<contracts.ProjectionSubject, impl.ProjectionSubject>
>;
export type PolicyRevisionRefParity = Expect<
  Equals<contracts.PolicyRevisionRef, impl.PolicyRevisionRef>
>;
export type ProjectionPolicyContentParity = Expect<
  Equals<contracts.ProjectionPolicyContent, impl.ProjectionPolicyContent>
>;
export type SealedProjectionPolicyParity = Expect<
  Equals<contracts.SealedProjectionPolicy, impl.SealedProjectionPolicy>
>;
export type TaskProjectionContextParity = Expect<
  Equals<contracts.TaskProjectionContext, impl.TaskProjectionContext>
>;

// Authorized projections.
export type PolicyClauseRefParity = Expect<
  Equals<contracts.PolicyClauseRef, impl.PolicyClauseRef>
>;
export type RedactionMarkerParity = Expect<Equals<contracts.RedactionMarker, impl.RedactionMarker>>;
export type ReleasedFieldParity = Expect<Equals<contracts.ReleasedField, impl.ReleasedField>>;
export type ProjectionEntryParity = Expect<Equals<contracts.ProjectionEntry, impl.ProjectionEntry>>;
export type AuthorizedProjectionContentParity = Expect<
  Equals<contracts.AuthorizedProjectionContent, impl.AuthorizedProjectionContent>
>;
export type SealedAuthorizedProjectionParity = Expect<
  Equals<contracts.SealedAuthorizedProjection, impl.SealedAuthorizedProjection>
>;

// The audit trail.
export type AuditProvenanceParity = Expect<Equals<contracts.AuditProvenance, impl.AuditProvenance>>;
export type AppliedScopesParity = Expect<Equals<contracts.AppliedScopes, impl.AppliedScopes>>;
export type ProjectionAuditContentParity = Expect<
  Equals<contracts.ProjectionAuditContent, impl.ProjectionAuditContent>
>;
export type SealedProjectionAuditParity = Expect<
  Equals<contracts.SealedProjectionAudit, impl.SealedProjectionAudit>
>;

// Events (the W010 event shapes).
export type AccessProjectionEventSequenceParity = Expect<
  Equals<contracts.AccessProjectionEventSequence, impl.AccessProjectionEventSequence>
>;
export type AccessProjectionCausalParentParity = Expect<
  Equals<contracts.AccessProjectionCausalParent, impl.AccessProjectionCausalParent>
>;
export type AccessProjectionEventPayloadParity = Expect<
  Equals<contracts.AccessProjectionEventPayload, impl.AccessProjectionEventPayload>
>;
export type AccessProjectionEventContentParity = Expect<
  Equals<contracts.AccessProjectionEventContent, impl.AccessProjectionEventContent>
>;
export type SealedAccessProjectionEventParity = Expect<
  Equals<contracts.SealedAccessProjectionEvent, impl.SealedAccessProjectionEvent>
>;
