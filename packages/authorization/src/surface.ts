/**
 * The authorization schema surface registry: every data type published
 * at the `@epoch/authorization` ownership boundary, paired with its zod
 * schema (W009 publishes its versioned contract surface inside the
 * package; see src/contract-emission.ts and test/contract-drift.test.ts).
 */
import type { ZodType } from 'zod';
import {
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

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of the authorization contract v1. */
export const AUTHORIZATION_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'AllowDecision', schema: AllowDecisionSchema },
  { type: 'AllowReason', schema: AllowReasonSchema },
  { type: 'AuthorizationContext', schema: AuthorizationContextSchema },
  { type: 'AuthorizationDecision', schema: AuthorizationDecisionSchema },
  { type: 'AuthorizationOutcome', schema: AuthorizationOutcomeSchema },
  { type: 'AuthorizationPolicyTarget', schema: AuthorizationPolicyTargetSchema },
  { type: 'AuthorizationRecordVersion', schema: AuthorizationRecordVersionSchema },
  { type: 'AuthorizationRequest', schema: AuthorizationRequestSchema },
  { type: 'Denial', schema: DenialSchema },
  { type: 'DenialCode', schema: DenialCodeSchema },
  { type: 'DenyDecision', schema: DenyDecisionSchema },
  { type: 'EvidencePath', schema: EvidencePathSchema },
  { type: 'MembershipFact', schema: MembershipFactSchema },
  { type: 'NotApplicableDecision', schema: NotApplicableDecisionSchema },
  { type: 'NotApplicableReason', schema: NotApplicableReasonSchema },
  { type: 'PrincipalFact', schema: PrincipalFactSchema },
  { type: 'PrincipalId', schema: PrincipalIdSchema },
  { type: 'PrincipalStatus', schema: PrincipalStatusSchema },
  { type: 'ProjectId', schema: ProjectIdSchema },
  { type: 'ResourceReference', schema: ResourceReferenceSchema },
  { type: 'Sha256Digest', schema: Sha256DigestSchema },
  { type: 'TenantId', schema: TenantIdSchema },
  { type: 'WorkspaceId', schema: WorkspaceIdSchema },
];
