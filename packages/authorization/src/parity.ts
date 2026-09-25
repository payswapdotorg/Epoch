/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the W009
 * authorization contract guarantee; the JSON-Schema half is
 * test/contract-drift.test.ts; the CROSS-PACKAGE half — W004
 * policy-contracts, tenancy, identity mirrors — is
 * test/w004-parity.types.ts).
 *
 * Every exported alias below compiles ONLY while the zod validators in
 * src/schema.ts infer exactly the published contract types in
 * src/types.ts.
 */
import type { z } from 'zod';
import type { Equals, Expect } from './type-utils';
import type {
  AllowDecision,
  AllowReason,
  AuthorizationContext,
  AuthorizationDecision,
  AuthorizationIssue,
  AuthorizationOutcome,
  AuthorizationPolicyTarget,
  AuthorizationRequest,
  Denial,
  DenialCode,
  DenyDecision,
  EvidencePath,
  MembershipFact,
  NotApplicableDecision,
  NotApplicableReason,
  PrincipalFact,
  PrincipalId,
  PrincipalStatus,
  ProjectId,
  ResourceReference,
  TenantId,
  WorkspaceId,
} from './types';
import type {
  AllowDecisionSchema,
  AllowReasonSchema,
  AuthorizationContextSchema,
  AuthorizationDecisionSchema,
  AuthorizationOutcomeSchema,
  AuthorizationPolicyTargetSchema,
  AuthorizationRecordVersionSchema,
  AuthorizationRequestSchema,
  DenialCodeSchema,
  DenialSchema,
  DenyDecisionSchema,
  EvidencePathSchema,
  MembershipFactSchema,
  NotApplicableDecisionSchema,
  NotApplicableReasonSchema,
  PrincipalFactSchema,
  PrincipalIdSchema,
  PrincipalStatusSchema,
  ProjectIdSchema,
  ResourceReferenceSchema,
  Sha256DigestSchema,
  TenantIdSchema,
  WorkspaceIdSchema,
} from './schema';
import type { Sha256Hex } from '@epoch/agent-protocol';

export type AuthorizationSchemaSync = [
  Expect<Equals<z.infer<typeof AuthorizationRecordVersionSchema>, 1>>,
  Expect<Equals<z.infer<typeof AuthorizationOutcomeSchema>, AuthorizationOutcome>>,
  Expect<Equals<z.infer<typeof DenialCodeSchema>, DenialCode>>,
  Expect<Equals<z.infer<typeof AllowReasonSchema>, AllowReason>>,
  Expect<Equals<z.infer<typeof NotApplicableReasonSchema>, NotApplicableReason>>,
  Expect<Equals<z.infer<typeof PrincipalStatusSchema>, PrincipalStatus>>,
  Expect<Equals<z.infer<typeof PrincipalIdSchema>, PrincipalId>>,
  Expect<Equals<z.infer<typeof TenantIdSchema>, TenantId>>,
  Expect<Equals<z.infer<typeof WorkspaceIdSchema>, WorkspaceId>>,
  Expect<Equals<z.infer<typeof ProjectIdSchema>, ProjectId>>,
  Expect<Equals<z.infer<typeof EvidencePathSchema>, EvidencePath>>,
  Expect<Equals<z.infer<typeof ResourceReferenceSchema>, ResourceReference>>,
  Expect<Equals<z.infer<typeof AuthorizationRequestSchema>, AuthorizationRequest>>,
  Expect<Equals<z.infer<typeof PrincipalFactSchema>, PrincipalFact>>,
  Expect<Equals<z.infer<typeof MembershipFactSchema>, MembershipFact>>,
  Expect<Equals<z.infer<typeof AuthorizationContextSchema>, AuthorizationContext>>,
  Expect<Equals<z.infer<typeof DenialSchema>, Denial>>,
  Expect<Equals<z.infer<typeof AllowDecisionSchema>, AllowDecision>>,
  Expect<Equals<z.infer<typeof DenyDecisionSchema>, DenyDecision>>,
  Expect<Equals<z.infer<typeof NotApplicableDecisionSchema>, NotApplicableDecision>>,
  Expect<Equals<z.infer<typeof AuthorizationDecisionSchema>, AuthorizationDecision>>,
  Expect<Equals<z.infer<typeof AuthorizationPolicyTargetSchema>, AuthorizationPolicyTarget>>,
  Expect<Equals<z.infer<typeof Sha256DigestSchema>, Sha256Hex>>,
];

/** String-literal unions are additionally pinned member-for-member. */
export type AuthorizationLiteralSync = [
  Expect<Equals<AuthorizationOutcome, 'allow' | 'deny' | 'not-applicable'>>,
  Expect<
    Equals<
      DenialCode,
      | 'unknown-principal'
      | 'unknown-tenant'
      | 'cross-tenant-denied'
      | 'cross-workspace-denied'
      | 'cross-project-denied'
      | 'inactive-principal'
      | 'unauthenticated-principal'
    >
  >,
  Expect<Equals<AllowReason, 'covering-membership' | 'active-principal' | 'authenticated-principal'>>,
  Expect<Equals<NotApplicableReason, 'resource-not-tenant-scoped'>>,
  Expect<Equals<PrincipalStatus, 'active' | 'suspended' | 'deactivated'>>,
];

/** Result/error + digest surface shape sanity. */
export type AuthorizationResultSync = [
  Expect<Equals<AuthorizationIssue, { readonly path: string; readonly message: string }>>,
  Expect<Equals<AllowDecision['requestDigest'], Sha256Hex>>,
  Expect<Equals<DenyDecision['requestDigest'], Sha256Hex>>,
  Expect<Equals<NotApplicableDecision['requestDigest'], Sha256Hex>>,
];
