# Capability Discovery — Contract Summary (W045)

The published contract surface lives at `contracts/capability-discovery`
(`index.d.ts` self-contained declarations, `parity.ts` compile-time
identity assertions against `@epoch/capability-discovery`, `manifest.json`
exact-revision anchor, `schemas/*.schema.json` structural JSON Schema
projection, draft 2020-12). Regeneration after an intentional schema
change:

```
EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/capability-discovery test contract-drift
```

JSON Schema fidelity is **structural-only**: cross-field refinements
(external candidates below `verified` must be sandbox-required and
outside the Epoch trust domain; hard/evidence criteria need thresholds;
objective criteria need weights; `p95 >= p50`; domain-pack proposals need
their detail) are enforced by the runtime validators and are intentionally
absent from the schema files.

## Record-type inventory (the "data types" of `manifest.json`)

### Versions + vocabularies
`CapabilityDiscoveryContractVersion` (`'1.0.0'`),
`CapabilityDiscoveryRecordVersion` (`1`), `DiscoveryCompilerVersion`
(`'1.0.0'`), and the closed unions `UniversalLifecycleStage` (the eleven
USL1.0 stages), `TaskSignalKind` (13), `RepresentationKind` (9),
`CapabilityGapState` (6), `CandidateKind` (4), `CandidateEvaluationState`
(8), `ClaimBasis`, `EvaluationCriterionKind`, `EvaluationMetric` (8),
`DiscoveryRunKind`, `DiscoveryTrigger`, `DiscoveryStageName` (10),
`EcosystemProposalKind`, `EcosystemProposalStatus`, `DiscoverySourceKind`,
`DiscoveryCadenceKind`.

### Ids + primitives
`Timestamp` (`YYYY-MM-DDTHH:MM:SS.mmmZ`), `Sha256Hex` (64 lowercase hex),
`DiscoveryTenantId` (`tenant:<slug>`, the W009 grammar mirror),
`DiscoveryRunId` (`discrun:<16hex>`), `CapabilityDemandId` (`demand:`),
`RoleProposalId` (`drole:`), `CandidateId` (`cand:`), `CapabilityGapId`
(`gap:`), `OrganizationId` (`org:`), `EcosystemProposalId` (`ecoprop:`),
`PromotionId` (`promo:`), `DiscoverySlug`.

### Input documents
`OperationRef` (qualified name + version constraint), `QualityTarget`,
`MoneyAmount`, `WorldRef` (opaque id + content digest), `EvidenceSignal`,
`ConstraintSignal`, `TaskSignal` (kind-specific payloads: qualityTarget /
latencyBudgetMs / costBudget / uncertaintyConfidence / requirementSlugs /
dependsOnOperation), `TaskDescription`, `TemplateApplicability`,
`CapabilityDemandTemplate`, `RoleTemplate`, `TaskSignalBinding`,
`DomainPackContribution`, `DiscoveryInput`.

### Derived records
`CapabilityDemand` (+ `OutputContractEntry`, `DemandAuthorityConstraints`,
`CapabilityDemandSet`), `RoleProposal` (+ `RoleInterfaceEntry`,
`RoleAuthorityBoundary`, `RolePlanningBehavior`, `RoleProvenance`),
`CandidateProfile` (+ `ClaimedCapability`, `LatencyClaim`, `CostClaim`,
`CandidateProvenance`, `CandidateSecurity`), `HumanDeclaration`,
`CandidateMatch`, `CandidateAssignment`, `RoleResolution`,
`CapabilityGap` (+ `GapTransition`), `EcosystemDiscoveryRequest`,
`OrganizationProposal` (+ `OrganizationRoleBinding`, `HandoffEdge`,
`SupervisionEdge`, `OrganizationEstimates`), `EvaluationCriterion`,
`CriterionResult`, `OrganizationEvaluation`, `OrganizationSelection`,
`DiscoveryRun` (+ `DiscoveryStageLink`, `DiscoveryRunTrigger`),
`DiscoveryRunArtifact` (self-contained: input + candidates + criteria +
maxOrganizations + every derived set).

### External discovery + scheduler
`SourceArtifact`, `SourceScanQuery`, `SourceScanResult`, `SandboxReport`,
`CandidateEvaluationEvidence`, `PolicyApproval`, `PromotionRecord`
(hash-chained), `EcosystemScanReport`, `EcosystemProposal` (+
`EcosystemProposalEvidence`, `DomainPackProposalDetail`),
`DiscoverySchedule`, `DueDiscoveryRun`.

### Errors (total surface)
`DiscoveryIssue`, `DiscoveryErrorCode` (17 codes), `DiscoveryError`
(discriminated union; `lineage-mismatch` carries `brokenStages`),
`DiscoveryResult<T>`.

## Key invariants encoded structurally

1. **`executionAuthority: 'none'`** is the only value admitted on
   `DemandAuthorityConstraints` and `RoleAuthorityBoundary` — granting
   execution authority requires a major contract change (the W003
   convention).
2. **No provider/model field exists anywhere**; strict objects reject
   unknown (vendor) fields at every boundary.
3. **External candidates** below `verified` must carry
   `sandboxRequired: true` + `trustDomain: 'external'` (runtime
   refinement); `external-source` provenance must name its adapter +
   artifact.
4. **All derived ids are content-addressed** (digest suffixes); lineage
   digests chain stage content to the previous stage digest.
5. **No wall-clock/random fields in any persisted record**: `createdAt`,
   `firstObservedAt`, `promotedAt`, `proposedAt`, `dueAt` are
   caller-supplied data and are excluded from identity digests.

## Parity discipline

- `packages/capability-discovery/src/parity.ts`: every zod validator must
  infer exactly the published `src/types.ts` type (compile-time).
- `contracts/capability-discovery/parity.ts`: every published declaration
  must be identical to the implementation's exported type
  (compiled by `packages/capability-discovery/tsconfig.contracts.json`).
- `test/contract-drift.test.ts`: the committed schema files + manifest
  must be byte-identical to the deterministic emission.
