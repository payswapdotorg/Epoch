/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the W009
 * authorization contract guarantee; the JSON-Schema half is
 * test/contract-drift.test.ts).
 *
 * Every exported alias below compiles ONLY while the zod validators in
 * src/schema.ts infer exactly the published contract types in src/types.ts.
 */
import type { z } from 'zod';
import type { Equals, Expect } from './type-utils';
import type { DecisionOutcome, DecisionReasonCode } from './version';
import type {
  ActionKind,
  AuthorizationContext,
  AuthorizationDecision,
  AuthorizationError,
  AuthorizationIssue,
  AuthorizationRecord,
  AuthorizationRequest,
  AuthorizationResult,
  DecisionReason,
  EvidencePath,
  PolicyTargetProjection,
  PrincipalId,
  ResourceId,
  ResourceReference,
  ResourceType,
  TenantId,
} from './types';
import type {
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
  PolicyTargetProjectionSchema,
  PrincipalIdSchema,
  ResourceIdSchema,
  ResourceReferenceSchema,
  ResourceTypeSchema,
  TenantIdSchema,
} from './schema';
import type { AUTHORIZATION_RECORD_VERSION } from './version';

export type AuthorizationSchemaSync = [
  Expect<
    Equals<
      z.infer<typeof AuthorizationRecordVersionSchema>,
      typeof AUTHORIZATION_RECORD_VERSION
    >
  >,
  Expect<Equals<z.infer<typeof PrincipalIdSchema>, PrincipalId>>,
  Expect<Equals<z.infer<typeof TenantIdSchema>, TenantId>>,
  Expect<Equals<z.infer<typeof ResourceIdSchema>, ResourceId>>,
  Expect<Equals<z.infer<typeof ResourceTypeSchema>, ResourceType>>,
  Expect<Equals<z.infer<typeof ActionKindSchema>, ActionKind>>,
  Expect<Equals<z.infer<typeof ResourceReferenceSchema>, ResourceReference>>,
  Expect<Equals<z.infer<typeof AuthorizationContextSchema>, AuthorizationContext>>,
  Expect<Equals<z.infer<typeof AuthorizationRequestSchema>, AuthorizationRequest>>,
  Expect<Equals<z.infer<typeof PolicyTargetProjectionSchema>, PolicyTargetProjection>>,
  Expect<Equals<z.infer<typeof EvidencePathSchema>, EvidencePath>>,
  Expect<Equals<z.infer<typeof DecisionOutcomeSchema>, DecisionOutcome>>,
  Expect<Equals<z.infer<typeof DecisionReasonCodeSchema>, DecisionReasonCode>>,
  Expect<Equals<z.infer<typeof DecisionReasonSchema>, DecisionReason>>,
  Expect<Equals<z.infer<typeof AuthorizationDecisionSchema>, AuthorizationDecision>>,
  Expect<Equals<z.infer<typeof AuthorizationRecordSchema>, AuthorizationRecord>>,
];

/** String-literal unions are additionally pinned member-for-member. */
export type AuthorizationLiteralSync = [
  Expect<Equals<DecisionOutcome, 'allow' | 'deny' | 'not-applicable'>>,
  Expect<
    Equals<
      DecisionReasonCode,
      'principal-verified' | 'tenant-verified' | 'policy-allows' | 'policy-denies' | 'no-applicable-policy'
    >
  >,
  Expect<
    Equals<
      AuthorizationError['code'],
      | 'validation'
      | 'unknown-principal'
      | 'unknown-tenant'
      | 'cross-tenant-denied'
      | 'not-applicable'
      | 'evaluation-failed'
      | 'digest-mismatch'
    >
  >,
];

/** Result/error surface shape sanity. */
export type AuthorizationResultSync = [
  Expect<Equals<AuthorizationIssue, { readonly path: string; readonly message: string }>>,
  Expect<Equals<AuthorizationRecord['decisionDigest'], string>>,
  Expect<
    Equals<
      AuthorizationResult<string>,
      | { readonly ok: true; readonly value: string }
      | { readonly ok: false; readonly error: AuthorizationError }
    >
  >,
  Expect<Equals<AuthorizationDecision['requestId'], AuthorizationRequest['requestId']>>,
];
