/**
 * COMPILE-TIME CONTRACT SYNC (the type-level half of the W022 action-policy
 * contract guarantee; the W009 tenancy pattern).
 *
 * Every exported alias below compiles ONLY while the zod validators in
 * src/schema.ts infer exactly the published contract types in src/types.ts.
 */
import type { z } from 'zod';
import type { Equals, Expect } from './type-utils';
import type {
  ActionPolicySnapshot,
  ApprovalDirective,
  ApprovalRecordContent,
  ApprovalRequestState,
  ApproverScope,
  ExpiryRecordContent,
  PolicyDecisionContent,
  PolicyDenial,
  PolicyProvenance,
  PolicySetEntry,
  RejectionRecordContent,
  SealedApprovalRecord,
  SealedExpiryRecord,
  SealedPolicyDecision,
  SealedRejectionRecord,
} from './types';
import type {
  ApprovalDirectiveSchema,
  ApprovalRecordContentSchema,
  ApprovalRequestStateSchema,
  ApproverScopeSchema,
  ExpiryRecordContentSchema,
  PolicyDecisionContentSchema,
  PolicyDenialSchema,
  PolicyProvenanceSchema,
  RejectionRecordContentSchema,
  SealedApprovalRecordSchema,
  SealedExpiryRecordSchema,
  SealedPolicyDecisionSchema,
  SealedRejectionRecordSchema,
  ActionPolicySnapshotSchema,
} from './schema';

export type ActionPolicySchemaSync = [
  Expect<Equals<z.infer<typeof PolicyDenialSchema>, PolicyDenial>>,
  Expect<Equals<z.infer<typeof ApproverScopeSchema>, ApproverScope>>,
  Expect<Equals<z.infer<typeof PolicyProvenanceSchema>, PolicyProvenance>>,
  Expect<Equals<z.infer<typeof ApprovalDirectiveSchema>, ApprovalDirective>>,
  Expect<Equals<z.infer<typeof PolicyDecisionContentSchema>, PolicyDecisionContent>>,
  Expect<Equals<z.infer<typeof SealedPolicyDecisionSchema>, SealedPolicyDecision>>,
  Expect<Equals<z.infer<typeof ApprovalRecordContentSchema>, ApprovalRecordContent>>,
  Expect<Equals<z.infer<typeof SealedApprovalRecordSchema>, SealedApprovalRecord>>,
  Expect<Equals<z.infer<typeof RejectionRecordContentSchema>, RejectionRecordContent>>,
  Expect<Equals<z.infer<typeof SealedRejectionRecordSchema>, SealedRejectionRecord>>,
  Expect<Equals<z.infer<typeof ExpiryRecordContentSchema>, ExpiryRecordContent>>,
  Expect<Equals<z.infer<typeof SealedExpiryRecordSchema>, SealedExpiryRecord>>,
  Expect<Equals<z.infer<typeof ApprovalRequestStateSchema>, ApprovalRequestState>>,
  Expect<Equals<z.infer<typeof ActionPolicySnapshotSchema>, ActionPolicySnapshot>>,
];

/** Result/error surface shape sanity. */
export type ActionPolicyResultSync = [
  Expect<Equals<PolicyDecisionContent['schemaVersion'], 1>>,
  Expect<Equals<SealedPolicyDecision['previousDecisionDigest'], string | null>>,
  Expect<Equals<PolicyProvenance['policies'], readonly PolicySetEntry[]>>,
];
