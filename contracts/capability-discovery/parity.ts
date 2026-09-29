/**
 * Compile-time conformance assertions for the capability-discovery
 * contract surface.
 *
 * Mirrors `contracts/agent/parity.ts` and `contracts/procurement/parity.ts`:
 * imports both the published declarations (`./index`) and the runtime
 * implementation (`@epoch/capability-discovery`) and asserts strict type
 * identity for every surface type, so the self-contained declarations
 * cannot drift from the zod-inferred implementation types. Compiled by
 * `packages/capability-discovery`'s `typecheck` script
 * (`tsconfig.contracts.json`); any drift fails `pnpm typecheck`.
 * Verification-only; no runtime dependency.
 */
import type * as contracts from './index';
import type * as impl from '@epoch/capability-discovery';

/** Strictest type identity: distinguishes optionality, readonly, unions. */
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Compile-time assertion helper: fails unless `T` is `true`. */
type Expect<T extends true> = T;

// Versions + vocabularies.
export type CapabilityDiscoveryContractVersionParity = Expect<
  Equals<contracts.CapabilityDiscoveryContractVersion, impl.CapabilityDiscoveryContractVersion>
>;
export type CapabilityDiscoveryRecordVersionParity = Expect<
  Equals<contracts.CapabilityDiscoveryRecordVersion, impl.CapabilityDiscoveryRecordVersion>
>;
export type DiscoveryCompilerVersionParity = Expect<
  Equals<contracts.DiscoveryCompilerVersion, impl.DiscoveryCompilerVersion>
>;
export type UniversalLifecycleStageParity = Expect<
  Equals<contracts.UniversalLifecycleStage, impl.UniversalLifecycleStage>
>;
export type TaskSignalKindParity = Expect<Equals<contracts.TaskSignalKind, impl.TaskSignalKind>>;
export type RepresentationKindParity = Expect<
  Equals<contracts.RepresentationKind, impl.RepresentationKind>
>;
export type CapabilityGapStateParity = Expect<
  Equals<contracts.CapabilityGapState, impl.CapabilityGapState>
>;
export type CandidateKindParity = Expect<Equals<contracts.CandidateKind, impl.CandidateKind>>;
export type CandidateEvaluationStateParity = Expect<
  Equals<contracts.CandidateEvaluationState, impl.CandidateEvaluationState>
>;
export type ClaimBasisParity = Expect<Equals<contracts.ClaimBasis, impl.ClaimBasis>>;
export type EvaluationCriterionKindParity = Expect<
  Equals<contracts.EvaluationCriterionKind, impl.EvaluationCriterionKind>
>;
export type EvaluationMetricParity = Expect<
  Equals<contracts.EvaluationMetric, impl.EvaluationMetric>
>;
export type DiscoveryRunKindParity = Expect<
  Equals<contracts.DiscoveryRunKind, impl.DiscoveryRunKind>
>;
export type DiscoveryTriggerParity = Expect<
  Equals<contracts.DiscoveryTrigger, impl.DiscoveryTrigger>
>;
export type DiscoveryStageNameParity = Expect<
  Equals<contracts.DiscoveryStageName, impl.DiscoveryStageName>
>;
export type EcosystemProposalKindParity = Expect<
  Equals<contracts.EcosystemProposalKind, impl.EcosystemProposalKind>
>;
export type EcosystemProposalStatusParity = Expect<
  Equals<contracts.EcosystemProposalStatus, impl.EcosystemProposalStatus>
>;
export type DiscoverySourceKindParity = Expect<
  Equals<contracts.DiscoverySourceKind, impl.DiscoverySourceKind>
>;
export type DiscoveryCadenceKindParity = Expect<
  Equals<contracts.DiscoveryCadenceKind, impl.DiscoveryCadenceKind>
>;

// Primitives.
export type TimestampParity = Expect<Equals<contracts.Timestamp, impl.Timestamp>>;
export type Sha256HexParity = Expect<Equals<contracts.Sha256Hex, impl.Sha256Hex>>;
export type DiscoveryTenantIdParity = Expect<
  Equals<contracts.DiscoveryTenantId, impl.DiscoveryTenantId>
>;
export type DiscoveryRunIdParity = Expect<
  Equals<contracts.DiscoveryRunId, impl.DiscoveryRunId>
>;
export type CapabilityDemandIdParity = Expect<
  Equals<contracts.CapabilityDemandId, impl.CapabilityDemandId>
>;
export type RoleProposalIdParity = Expect<
  Equals<contracts.RoleProposalId, impl.RoleProposalId>
>;
export type CandidateIdParity = Expect<Equals<contracts.CandidateId, impl.CandidateId>>;
export type CapabilityGapIdParity = Expect<
  Equals<contracts.CapabilityGapId, impl.CapabilityGapId>
>;
export type OrganizationIdParity = Expect<
  Equals<contracts.OrganizationId, impl.OrganizationId>
>;
export type EcosystemProposalIdParity = Expect<
  Equals<contracts.EcosystemProposalId, impl.EcosystemProposalId>
>;
export type PromotionIdParity = Expect<Equals<contracts.PromotionId, impl.PromotionId>>;
export type DiscoverySlugParity = Expect<
  Equals<contracts.DiscoverySlug, impl.DiscoverySlug>
>;

// Shared value objects.
export type OperationRefParity = Expect<Equals<contracts.OperationRef, impl.OperationRef>>;
export type QualityTargetParity = Expect<Equals<contracts.QualityTarget, impl.QualityTarget>>;
export type MoneyAmountParity = Expect<Equals<contracts.MoneyAmount, impl.MoneyAmount>>;

// Discovery input.
export type WorldRefParity = Expect<Equals<contracts.WorldRef, impl.WorldRef>>;
export type EvidenceSignalParity = Expect<
  Equals<contracts.EvidenceSignal, impl.EvidenceSignal>
>;
export type ConstraintSignalParity = Expect<
  Equals<contracts.ConstraintSignal, impl.ConstraintSignal>
>;
export type TaskSignalParity = Expect<Equals<contracts.TaskSignal, impl.TaskSignal>>;
export type TaskDescriptionParity = Expect<
  Equals<contracts.TaskDescription, impl.TaskDescription>
>;
export type TemplateApplicabilityParity = Expect<
  Equals<contracts.TemplateApplicability, impl.TemplateApplicability>
>;
export type CapabilityDemandTemplateParity = Expect<
  Equals<contracts.CapabilityDemandTemplate, impl.CapabilityDemandTemplate>
>;
export type RoleTemplateParity = Expect<Equals<contracts.RoleTemplate, impl.RoleTemplate>>;
export type TaskSignalBindingParity = Expect<
  Equals<contracts.TaskSignalBinding, impl.TaskSignalBinding>
>;
export type DomainPackContributionParity = Expect<
  Equals<contracts.DomainPackContribution, impl.DomainPackContribution>
>;
export type DiscoveryInputParity = Expect<Equals<contracts.DiscoveryInput, impl.DiscoveryInput>>;

// Demands + roles.
export type OutputContractEntryParity = Expect<
  Equals<contracts.OutputContractEntry, impl.OutputContractEntry>
>;
export type DemandAuthorityConstraintsParity = Expect<
  Equals<contracts.DemandAuthorityConstraints, impl.DemandAuthorityConstraints>
>;
export type CapabilityDemandParity = Expect<
  Equals<contracts.CapabilityDemand, impl.CapabilityDemand>
>;
export type CapabilityDemandSetParity = Expect<
  Equals<contracts.CapabilityDemandSet, impl.CapabilityDemandSet>
>;
export type RoleInterfaceEntryParity = Expect<
  Equals<contracts.RoleInterfaceEntry, impl.RoleInterfaceEntry>
>;
export type RolePlanningBehaviorParity = Expect<
  Equals<contracts.RolePlanningBehavior, impl.RolePlanningBehavior>
>;
export type RoleAuthorityBoundaryParity = Expect<
  Equals<contracts.RoleAuthorityBoundary, impl.RoleAuthorityBoundary>
>;
export type RoleProvenanceParity = Expect<
  Equals<contracts.RoleProvenance, impl.RoleProvenance>
>;
export type RoleProposalParity = Expect<Equals<contracts.RoleProposal, impl.RoleProposal>>;

// Candidates.
export type ClaimedCapabilityParity = Expect<
  Equals<contracts.ClaimedCapability, impl.ClaimedCapability>
>;
export type LatencyClaimParity = Expect<Equals<contracts.LatencyClaim, impl.LatencyClaim>>;
export type CostClaimParity = Expect<Equals<contracts.CostClaim, impl.CostClaim>>;
export type CandidateProvenanceParity = Expect<
  Equals<contracts.CandidateProvenance, impl.CandidateProvenance>
>;
export type CandidateSecurityParity = Expect<
  Equals<contracts.CandidateSecurity, impl.CandidateSecurity>
>;
export type CandidateProfileParity = Expect<
  Equals<contracts.CandidateProfile, impl.CandidateProfile>
>;
export type HumanDeclarationParity = Expect<
  Equals<contracts.HumanDeclaration, impl.HumanDeclaration>
>;
export type CandidateMatchParity = Expect<
  Equals<contracts.CandidateMatch, impl.CandidateMatch>
>;
export type CandidateAssignmentParity = Expect<
  Equals<contracts.CandidateAssignment, impl.CandidateAssignment>
>;
export type RoleResolutionParity = Expect<
  Equals<contracts.RoleResolution, impl.RoleResolution>
>;

// Gaps.
export type GapTransitionParity = Expect<
  Equals<contracts.GapTransition, impl.GapTransition>
>;
export type CapabilityGapParity = Expect<
  Equals<contracts.CapabilityGap, impl.CapabilityGap>
>;
export type EcosystemDiscoveryRequestParity = Expect<
  Equals<contracts.EcosystemDiscoveryRequest, impl.EcosystemDiscoveryRequest>
>;

// Organizations + evaluation.
export type OrganizationRoleBindingParity = Expect<
  Equals<contracts.OrganizationRoleBinding, impl.OrganizationRoleBinding>
>;
export type HandoffEdgeParity = Expect<Equals<contracts.HandoffEdge, impl.HandoffEdge>>;
export type SupervisionEdgeParity = Expect<
  Equals<contracts.SupervisionEdge, impl.SupervisionEdge>
>;
export type OrganizationEstimatesParity = Expect<
  Equals<contracts.OrganizationEstimates, impl.OrganizationEstimates>
>;
export type OrganizationProposalParity = Expect<
  Equals<contracts.OrganizationProposal, impl.OrganizationProposal>
>;
export type EvaluationCriterionParity = Expect<
  Equals<contracts.EvaluationCriterion, impl.EvaluationCriterion>
>;
export type CriterionResultParity = Expect<
  Equals<contracts.CriterionResult, impl.CriterionResult>
>;
export type OrganizationEvaluationParity = Expect<
  Equals<contracts.OrganizationEvaluation, impl.OrganizationEvaluation>
>;
export type OrganizationSelectionParity = Expect<
  Equals<contracts.OrganizationSelection, impl.OrganizationSelection>
>;

// Runs + lineage.
export type DiscoveryStageLinkParity = Expect<
  Equals<contracts.DiscoveryStageLink, impl.DiscoveryStageLink>
>;
export type DiscoveryRunTriggerParity = Expect<
  Equals<contracts.DiscoveryRunTrigger, impl.DiscoveryRunTrigger>
>;
export type DiscoveryRunParity = Expect<Equals<contracts.DiscoveryRun, impl.DiscoveryRun>>;
export type DiscoveryRunArtifactParity = Expect<
  Equals<contracts.DiscoveryRunArtifact, impl.DiscoveryRunArtifact>
>;

// External discovery.
export type SourceArtifactParity = Expect<
  Equals<contracts.SourceArtifact, impl.SourceArtifact>
>;
export type SourceScanQueryParity = Expect<
  Equals<contracts.SourceScanQuery, impl.SourceScanQuery>
>;
export type SourceScanResultParity = Expect<
  Equals<contracts.SourceScanResult, impl.SourceScanResult>
>;
export type SandboxReportParity = Expect<
  Equals<contracts.SandboxReport, impl.SandboxReport>
>;
export type CandidateEvaluationEvidenceParity = Expect<
  Equals<contracts.CandidateEvaluationEvidence, impl.CandidateEvaluationEvidence>
>;
export type PolicyApprovalParity = Expect<
  Equals<contracts.PolicyApproval, impl.PolicyApproval>
>;
export type PromotionRecordParity = Expect<
  Equals<contracts.PromotionRecord, impl.PromotionRecord>
>;
export type EcosystemScanReportParity = Expect<
  Equals<contracts.EcosystemScanReport, impl.EcosystemScanReport>
>;

// Ecosystem proposals.
export type EcosystemProposalEvidenceParity = Expect<
  Equals<contracts.EcosystemProposalEvidence, impl.EcosystemProposalEvidence>
>;
export type DomainPackProposalDetailParity = Expect<
  Equals<contracts.DomainPackProposalDetail, impl.DomainPackProposalDetail>
>;
export type EcosystemProposalParity = Expect<
  Equals<contracts.EcosystemProposal, impl.EcosystemProposal>
>;

// Scheduler.
export type DiscoveryScheduleParity = Expect<
  Equals<contracts.DiscoverySchedule, impl.DiscoverySchedule>
>;
export type DueDiscoveryRunParity = Expect<
  Equals<contracts.DueDiscoveryRun, impl.DueDiscoveryRun>
>;

// Errors.
export type DiscoveryIssueParity = Expect<
  Equals<contracts.DiscoveryIssue, impl.DiscoveryIssue>
>;
export type DiscoveryErrorCodeParity = Expect<
  Equals<contracts.DiscoveryErrorCode, impl.DiscoveryErrorCode>
>;
export type DiscoveryErrorParity = Expect<
  Equals<contracts.DiscoveryError, impl.DiscoveryError>
>;
export type DiscoveryResultParity = Expect<
  Equals<contracts.DiscoveryResult<string>, impl.DiscoveryResult<string>>
>;
