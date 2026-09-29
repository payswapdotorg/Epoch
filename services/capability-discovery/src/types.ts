/**
 * Service-level types: the caller-supplied authorization decision, the
 * service error taxonomy and the scheduler invocation results.
 */
import type {
  CandidateEvaluationState,
  CandidateProfile,
  CapabilityGap,
  DiscoveryRunArtifact,
  DiscoverySchedule,
  EcosystemProposal,
  EcosystemProposalKind,
  DomainPackProposalDetail,
  PromotionRecord,
  Timestamp,
  DiscoveryTenantId,
  DiscoverySourceAdapter,
} from '@epoch/capability-discovery';

/**
 * The caller-supplied authorization decision (fail-closed). The service
 * does NOT own authorization (lock rule 12): the deployment's
 * authorization authority (identity -> decision) supplies the decision,
 * and everything except an explicit allow is the typed
 * `authorization-rejected` failure. Authorization NEVER travels through
 * model prompts (acceptance 9).
 */
export type AuthorizationDecision =
  | { readonly allowed: true; readonly scope?: string | undefined }
  | { readonly allowed: false; readonly reason: string };

/** The principal reference requesting an operation. */
export interface ServicePrincipal {
  readonly principalId: string;
  readonly roles?: readonly string[] | undefined;
}

/** Service error codes (a superset wrapper over the kernel taxonomy). */
export type ServiceErrorCode =
  | 'validation'
  | 'authorization-rejected'
  | 'cross-tenant-denied'
  | 'unknown-tenant'
  | 'promotion-gate-rejected'
  | 'unknown-candidate'
  | 'unknown-schedule'
  | 'lineage-mismatch'
  | 'kernel-error';

/** One service error value (errors are values, never exceptions). */
export interface ServiceError {
  readonly code: ServiceErrorCode;
  readonly message: string;
}

/** Result of a service operation. */
export type ServiceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ServiceError };

/** Problem-driven discovery request. */
export interface ProblemDiscoveryRequest {
  readonly principal: ServicePrincipal;
  readonly authorization: AuthorizationDecision;
  readonly tenantId: DiscoveryTenantId;
  readonly input: Parameters<typeof import('@epoch/capability-discovery').runProblemDrivenDiscovery>[0];
  readonly options: Omit<
    Parameters<typeof import('@epoch/capability-discovery').runProblemDrivenDiscovery>[1],
    'at'
  >;
  readonly at: Timestamp;
}

/** Ecosystem scan request (gap/scheduled/event triggered). */
export interface EcosystemScanRequest {
  readonly principal: ServicePrincipal;
  readonly authorization: AuthorizationDecision;
  readonly tenantId: DiscoveryTenantId;
  readonly trigger: 'gap' | 'scheduled' | 'event';
  readonly invokedBy?: string | undefined;
  readonly adapters: readonly DiscoverySourceAdapter[];
  readonly scanLimit?: number | undefined;
  readonly at: Timestamp;
}

/** Promotion request. */
export interface PromotionRequest {
  readonly principal: ServicePrincipal;
  readonly authorization: AuthorizationDecision;
  readonly tenantId: DiscoveryTenantId;
  readonly candidateId: string;
  readonly targetState: CandidateEvaluationState;
  readonly evidenceDigest: string;
  readonly sandboxReport?: import('@epoch/capability-discovery').SandboxReport | undefined;
  readonly evaluationEvidence?:
    | readonly import('@epoch/capability-discovery').CandidateEvaluationEvidence[]
    | undefined;
  readonly policyApproval?: import('@epoch/capability-discovery').PolicyApproval | undefined;
  readonly at: Timestamp;
}

/** Ecosystem proposal request. */
export interface EcosystemProposalRequest {
  readonly principal: ServicePrincipal;
  readonly authorization: AuthorizationDecision;
  readonly tenantId: DiscoveryTenantId;
  readonly kind: EcosystemProposalKind;
  readonly summary: string;
  readonly gapIds?: readonly string[] | undefined;
  readonly taskExamples?: readonly string[] | undefined;
  readonly missingSemantics?: readonly string[] | undefined;
  readonly domainPackDetail?: DomainPackProposalDetail | undefined;
  readonly at: Timestamp;
}

/** One scheduler tick outcome entry. */
export interface ScheduledScanOutcome {
  readonly scheduleId: string;
  readonly tenantId: DiscoveryTenantId;
  readonly status: 'ran' | 'authorization-rejected' | 'no-gaps' | 'failed';
  readonly message: string;
}

/** Re-exported record shapes for callers of the service API. */
export type {
  CandidateProfile,
  CapabilityGap,
  DiscoveryRunArtifact,
  DiscoverySchedule,
  EcosystemProposal,
  PromotionRecord,
};
