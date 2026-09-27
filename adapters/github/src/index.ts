/**
 * @epoch/adapter-github — public API (service layer, Work Order W029).
 *
 * The hosted software-workspace REFERENCE adapter (Git for software
 * workspaces; the provider's vocabulary is quarantined in src/provider).
 * Two W007 surfaces:
 *
 * - SOURCE: content-addressed, idempotent snapshot ingestion + the
 *   deterministic projection of hosted workspace state (revisions,
 *   content trees, work-item references) as W002-convention OBSERVATION
 *   records (statement / provenance / confidence / validity; provenance
 *   carries the adapter identity + the exact source digest);
 * - ACTION: deterministic W003 change proposals routed EXCLUSIVELY
 *   through the W022 action-authority seam — policy decision first
 *   (allow / deny / requires-approval), then the authority's typed
 *   outcome records; the adapter NEVER executes directly and NEVER
 *   bypasses (the typed `gateway-bypass-rejected`).
 *
 * Cross-cutting invariants (tested): tenant isolation
 * (`tenant-isolation-rejected`), tamper detection (`digest-mismatch`),
 * idempotent replay (duplicate = sealed prior record; different content
 * under a key = `replay-conflict`), determinism (identical inputs ->
 * identical digests), provider neutrality (per-adapter blocklist), and
 * W007 registration under the source + action categories.
 *
 * In-memory reference behavior: NO network, NO live provider calls, NO
 * real side effects — fixtures stand in for provider payloads (the
 * W020/W022 reference precedent). Zero wall-clock, zero randomness.
 *
 * Runtime dependency policy (W029 Tech Lead pin, frozen):
 * @epoch/adapter-sdk, @epoch/agent-protocol, @epoch/action-protocol,
 * @epoch/tenancy, and zod — NOTHING else at runtime. Compatibility with
 * @epoch/capability-registry, @epoch/evidence, @epoch/event-log,
 * @epoch/action-policy, @epoch/world-model and the W022 action-gateway
 * service types is exercised via devDependencies + compile-time parity
 * (src/parity.ts) + runtime parity tests — never runtime deps.
 */

// Version + vocabularies.
export {
  CHANGE_DISPATCH_DISPOSITIONS,
  CHANGE_KINDS,
  GITHUB_ADAPTER_CATEGORIES,
  GITHUB_ADAPTER_CONTRACT_VERSION,
  GITHUB_ADAPTER_RECORD_VERSION,
  GITHUB_ACTION_CONTRACT_ID,
  GITHUB_SOURCE_CONTRACT_ID,
  SOFTWARE_ACTION_TYPE_IDS,
  SOFTWARE_ACTION_TYPE_VERSION,
  SOFTWARE_AUTHORITY_SCOPES,
  SOFTWARE_DOMAIN_NAMESPACE,
  SOFTWARE_ENTITY_TYPES,
  SOFTWARE_RELATION_TYPES,
  PROPOSING_AGENT_ID,
} from './version';
export type {
  ChangeDispatchDisposition,
  ChangeKind,
  SoftwareActionTypeId,
  SoftwareEntityType,
  SoftwareRelationType,
} from './version';

// Published contract types (the NEUTRAL seam).
export type {
  ActionAuthorityDecisionResult,
  ActionAuthorityExecutionRequest,
  ActionAuthorityExecutionResult,
  ActionAuthorityPort,
  ActionAuthoritySubmission,
  AuthorityAuthorization,
  AuthorityDecisionRecord,
  AuthorityOutcomeRecord,
  ChangeDispatchRecord,
  ChangeProposalPlan,
  SnapshotIngestionRecord,
  WorkspaceActorRef,
  WorkspaceConfidence,
  WorkspaceConfidenceDistribution,
  WorkspaceEvidenceKind,
  WorkspaceEvidenceRef,
  WorkspaceObservationRecord,
  WorkspaceProjection,
  WorkspaceProvenance,
  WorkspaceSourceRef,
  WorkspaceStatement,
  WorkspaceValidity,
} from './types';

// Typed error taxonomy (values, never thrown).
export type {
  GithubAdapterError,
  GithubAdapterErrorCode,
  GithubAdapterIssue,
  GithubAdapterResult,
} from './errors';

// Runtime validators (the NEUTRAL seam).
export {
  AuthorityDecisionRecordSchema,
  AuthorityOutcomeRecordSchema,
  ChangeDispatchRecordSchema,
  ChangeProposalPlanSchema,
  ProjectionInputSchema,
  ChangeRoutingInputSchema,
  SnapshotIngestionRecordSchema,
  WorkspaceActorRefSchema,
  WorkspaceConfidenceDistributionSchema,
  WorkspaceConfidenceSchema,
  WorkspaceEvidenceRefSchema,
  WorkspaceObservationRecordSchema,
  WorkspaceProjectionSchema,
  WorkspaceProvenanceSchema,
  WorkspaceSourceRefSchema,
  WorkspaceStatementSchema,
  WorkspaceValiditySchema,
  WorkspaceIdSchema,
} from './schema';

// The provider seam (provider vocabulary — fixtures + payload parsing).
export {
  PROVIDER_SERVICE_NAME,
  PROVIDER_SNAPSHOT_VERSION,
  ProviderSnapshotSchema,
  parseProviderSnapshot,
} from './provider/payload';
export type {
  ProviderRevision,
  ProviderSnapshot,
  ProviderTreeEntry,
  ProviderWorkItem,
} from './provider/payload';
export {
  conflictingSnapshot,
  FIXTURE_INSTANT,
  FIXTURE_WORKSPACE_NAME,
  incompleteSnapshot,
  malformedSnapshot,
  referenceSnapshot,
} from './provider/fixtures';

// The deterministic projection (pure functions).
export {
  projectSnapshot,
  snapshotDigestOf,
  verifyProjection,
  workspaceIdOf,
} from './projection';

// The tenant-scoped idempotent ingestion host.
export { GithubAdapterHost } from './ingestion';
export type { IngestSnapshotInput } from './ingestion';

// The action surface (proposal construction + authority routing).
export { buildChangeProposal, routeChange } from './action';
export type { BuildChangeProposalInput, RouteChangeInput } from './action';

// The W007 adapter surfaces.
export {
  GithubActionAdapter,
  GithubSourceAdapter,
} from './adapters';
export type {
  GithubActionAdapterOptions,
  GithubSourceAdapterOptions,
} from './adapters';

// W007 descriptor discipline (content-addressed, provider-neutral).
export {
  ACTION_ADAPTER_DESCRIPTOR,
  ACTION_ADAPTER_DESCRIPTOR_DIGEST,
  CAPABILITY_VERSION,
  GITHUB_ADAPTER_DESCRIPTORS,
  SOURCE_ADAPTER_DESCRIPTOR,
  SOURCE_ADAPTER_DESCRIPTOR_DIGEST,
} from './descriptor';

// W007 capability-registration derivation (the registration conventions).
export { deriveCapabilityRegistrations } from './registration';
export type {
  DerivedCapabilityManifest,
  DerivedCapabilityRegistration,
} from './registration';
