/**
 * The authorization schema surface registry: every data type published
 * at the `@epoch/authorization` ownership boundary, paired with its zod
 * schema (W009 publishes its versioned contract surface inside the
 * package, following the W007/W008 conventions; see
 * src/contract-emission.ts and test/contract-drift.test.ts).
 */
import type { ZodType } from 'zod';
import {
  ActionKindSchema,
  AuthorizationContextSchema,
  AuthorizationDecisionSchema,
  AuthorizationRecordSchema,
  AuthorizationRecordVersionSchema,
  AuthorizationRequestSchema,
  DecisionOutcomeSchema,
  DecisionReasonCodeSchema,
  DecisionReasonSchema,
  EvidencePathSchema,
  PolicyTagSchema,
  PolicyTargetProjectionSchema,
  PrincipalIdSchema,
  ResourceIdSchema,
  ResourceReferenceSchema,
  ResourceTypeSchema,
  Sha256DigestSchema,
  TenantIdSchema,
} from './schema';

/** One entry of the published data-type surface. */
export interface SchemaSurfaceEntry {
  readonly type: string;
  readonly schema: ZodType;
}

/** The complete, ordered data-type surface of the authorization contract v1. */
export const AUTHORIZATION_SCHEMA_SURFACE: readonly SchemaSurfaceEntry[] = [
  { type: 'ActionKind', schema: ActionKindSchema },
  { type: 'AuthorizationContext', schema: AuthorizationContextSchema },
  { type: 'AuthorizationDecision', schema: AuthorizationDecisionSchema },
  { type: 'AuthorizationRecord', schema: AuthorizationRecordSchema },
  { type: 'AuthorizationRecordVersion', schema: AuthorizationRecordVersionSchema },
  { type: 'AuthorizationRequest', schema: AuthorizationRequestSchema },
  { type: 'DecisionOutcome', schema: DecisionOutcomeSchema },
  { type: 'DecisionReason', schema: DecisionReasonSchema },
  { type: 'DecisionReasonCode', schema: DecisionReasonCodeSchema },
  { type: 'EvidencePath', schema: EvidencePathSchema },
  { type: 'PolicyTag', schema: PolicyTagSchema },
  { type: 'PolicyTargetProjection', schema: PolicyTargetProjectionSchema },
  { type: 'PrincipalId', schema: PrincipalIdSchema },
  { type: 'ResourceId', schema: ResourceIdSchema },
  { type: 'ResourceReference', schema: ResourceReferenceSchema },
  { type: 'ResourceType', schema: ResourceTypeSchema },
  { type: 'Sha256Digest', schema: Sha256DigestSchema },
  { type: 'TenantId', schema: TenantIdSchema },
];
