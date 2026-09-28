/**
 * @epoch/release-kit — public API (Work Order W035).
 *
 * The RELEASE/SDK-DOCS/MARKETPLACE READINESS MODEL of Epoch, in-repo and
 * deterministic:
 *
 *   SCOPE     — what ships (components), what proves it ready (battery +
 *               benchmark citations + SDK pins + the marketplace subject),
 *               the exact revision — all typed, content-addressed data.
 *   CHECKLIST — derived deterministically from the scope over the fixed
 *               DOMAIN_CHECK_TABLE; items complete only with typed
 *               EVIDENCE + caller-supplied instant + actor (immutable
 *               transitions; sealed at every state).
 *   EVALUATION— ready iff every item carries admissible evidence; the
 *               verdict is itself a sealed, content-addressed record.
 *   NOTES     — release notes as typed records with typed citations.
 *   MANIFEST  — the release record: sealed ONLY when ready (the typed
 *               refusal point), rolling the evidence up per domain.
 *   EVENTS    — the readiness journal: append-only events over the W010
 *               event shapes; the deterministic fold REPLAYS readiness.
 *
 * Cross-cutting invariants (all pinned by release/test/*.test.ts):
 * provenance on every record, zero wall-clock / zero randomness / zero
 * I/O (instants are caller-supplied), determinism + replay (identical
 * inputs -> identical digests; the fold is input-order-independent),
 * tamper detection on every sealed record, and provider neutrality (no
 * vendor, brand, payment processor or tool name enters any vocabulary).
 *
 * Runtime dependency policy (W035 Tech Lead pin, frozen):
 * @epoch/agent-protocol (canonical digests + timestamp primitive),
 * @epoch/tenancy (tenant-id primitive) and zod — NOTHING else. release/
 * is NOT a workspace package (no package.json): typed TS modules + data
 * consumed by the thin release/ test suite (release/README.md), which
 * ALSO composes the REAL W007/W008/W023/W033/W034/W010 surfaces as
 * test-only imports (the parity + contract-sync + examples evidence).
 */

// Versions + closed vocabularies.
export {
  BENCHMARK_INPUT_UNITS,
  BUDGET_OUTCOMES,
  CHECKLIST_ID_PATTERN,
  CHECKLIST_ITEM_ID_PATTERN,
  COMPONENT_SURFACE_PREFIXES,
  DOMAIN_CHECK_TABLE,
  MANIFEST_ID_PATTERN,
  NOTES_ID_PATTERN,
  READINESS_DOMAINS,
  READINESS_VERDICTS,
  RELEASE_ACTOR_PATTERN,
  RELEASE_CHECK_KINDS,
  RELEASE_COMPONENT_KINDS,
  RELEASE_ERROR_CODES,
  RELEASE_EVENT_DISCRIMINATOR,
  RELEASE_EVENT_KINDS,
  RELEASE_EVENT_RECORD_VERSION,
  RELEASE_ID_PATTERN,
  RELEASE_KIT_CONTRACT_VERSION,
  RELEASE_KIT_RECORD_VERSION,
  RELEASE_STREAM_ID_PATTERN,
  REVISION_PATTERN,
  SDK_SURFACE_IDS,
} from './version';
export type {
  BenchmarkInputUnit,
  BudgetOutcome,
  ReadinessDomain,
  ReadinessVerdict,
  ReleaseCheckKind,
  ReleaseComponentKind,
  ReleaseErrorCode,
  ReleaseEventKind,
  SdkSurfaceId,
} from './version';

// Primitives (ids, digests, typed errors, the total result).
export {
  ChecklistIdSchema,
  ChecklistItemIdSchema,
  ManifestIdSchema,
  NotesIdSchema,
  NonNegativeDecimalSchema,
  NonNegativeIntSchema,
  PositiveIntSchema,
  ReleaseActorSchema,
  ReleaseIdSchema,
  RevisionSchema,
  SemverCoreSchema,
  digestOfJson,
  releaseFail,
  type ReleaseError,
  type ReleaseResult,
} from './primitives';

// Provenance.
export {
  RELEASE_PROVENANCE_ROLES,
  ReleaseActorRefSchema,
  ReleaseProvenanceSchema,
  Sha256DigestSchema,
  rootProvenance,
  type ReleaseActorRef,
  type ReleaseProvenance,
  type ReleaseProvenanceRole,
} from './provenance';

// Evidence (the typed completion-evidence union + admission).
export {
  BatteryGreenEvidenceSchema,
  BenchmarkWithinEvidenceSchema,
  CompletionEvidenceSchema,
  EntitlementFlipVerifiedEvidenceSchema,
  EVIDENCE_KIND_TO_CHECK,
  ListingChainVerifiedEvidenceSchema,
  NotesPublishedEvidenceSchema,
  RevenueProvenanceEvidenceSchema,
  SdkContractSyncedEvidenceSchema,
  SdkExamplesGreenEvidenceSchema,
  UsageFoldVerifiedEvidenceSchema,
  validateEvidenceForCheck,
  type BatteryGreenEvidence,
  type BenchmarkWithinEvidence,
  type CompletionEvidence,
  type EntitlementFlipVerifiedEvidence,
  type ListingChainVerifiedEvidence,
  type NotesPublishedEvidence,
  type RevenueProvenanceEvidence,
  type SdkContractSyncedEvidence,
  type SdkExamplesGreenEvidence,
  type UsageFoldVerifiedEvidence,
} from './evidence';

// Scope.
export {
  BatteryCommandSchema,
  BenchmarkCitationSchema,
  MarketplaceReadinessSubjectSchema,
  ReleaseComponentSchema,
  ReleaseScopeSchema,
  SdkSurfacePinSchema,
  SealedReleaseScopeSchema,
  checklistIdOf,
  computeScopeDigest,
  notesIdOf,
  parseReleaseScope,
  scopeContent,
  sealScope,
  serializeScope,
  verifyScopeDigest,
  type BatteryCommand,
  type BenchmarkCitation,
  type MarketplaceReadinessSubject,
  type ReleaseComponent,
  type ReleaseScope,
  type SealedReleaseScope,
  type SdkSurfacePin,
} from './scope';

// Checklist.
export {
  ChecklistItemSchema,
  ReleaseChecklistSchema,
  SealedReleaseChecklistSchema,
  checklistContent,
  completeChecklistItem,
  computeChecklistDigest,
  deriveReleaseChecklist,
  evidenceDigestOf,
  sealChecklist,
  verifyChecklistDigest,
  type ChecklistItem,
  type ReleaseChecklist,
  type SealedReleaseChecklist,
} from './checklist';

// Evaluation.
export {
  OpenItemSchema,
  ReadinessEvaluationSchema,
  SealedReadinessEvaluationSchema,
  computeEvaluationDigest,
  evaluateReleaseReadiness,
  evaluationContent,
  verifyEvaluationDigest,
  type OpenItem,
  type ReadinessEvaluation,
  type SealedReadinessEvaluation,
} from './evaluation';

// Notes.
export {
  CITATION_KINDS,
  CitationSchema,
  NotesSectionSchema,
  ReleaseNotesSchema,
  SealedReleaseNotesSchema,
  computeNotesDigest,
  notesContent,
  parseReleaseNotes,
  sealReleaseNotes,
  verifyNotesDigest,
  type Citation,
  type CitationKind,
  type NotesSection,
  type ReleaseNotes,
  type SealedReleaseNotes,
} from './notes';

// Manifest.
export {
  BatteryRollupEntrySchema,
  BenchmarkRollupEntrySchema,
  MarketplaceRollupEntrySchema,
  ReleaseManifestSchema,
  SealedReleaseManifestSchema,
  SdkPinRollupEntrySchema,
  computeManifestDigest,
  manifestContent,
  manifestIdOf,
  sealReleaseManifest,
  verifyManifestDigest,
  type BatteryRollupEntry,
  type BenchmarkRollupEntry,
  type MarketplaceRollupEntry,
  type ReleaseManifest,
  type SealedReleaseManifest,
  type SdkPinRollupEntry,
} from './manifest';

// Events (append-only, over the W010 shapes).
export {
  ChecklistDerivedDataSchema,
  ItemCompletedDataSchema,
  ReadinessEvaluatedDataSchema,
  ReleaseCausalParentSchema,
  ReleaseEventActorSchema,
  ReleaseEventContentSchema,
  ReleaseEventDataSchema,
  ReleaseEventPayloadSchema,
  ReleaseEventRecordSchema,
  ReleaseEventSequenceSchema,
  ReleasePublishedDataSchema,
  ReleaseStreamIdSchema,
  computeReleaseEventDigest,
  foldReleaseEvents,
  parseReleaseEventData,
  releaseEventStreamIdOf,
  sealReleaseEvent,
  verifyReleaseEventDigest,
  type ChecklistDerivedData,
  type ItemCompletedData,
  type ReadinessEvaluatedData,
  type ReleaseCausalParent,
  type ReleaseEventActor,
  type ReleaseEventContent,
  type ReleaseEventData,
  type ReleaseEventPayload,
  type ReleaseEventRecord,
  type ReleaseEventSequence,
  type ReleasePublishedData,
  type ReleaseReplay,
  type ReleaseStreamId,
} from './events';
