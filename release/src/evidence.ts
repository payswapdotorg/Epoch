/**
 * @epoch/release-kit — typed completion evidence (Work Order W035).
 *
 * A checklist item is complete ONLY with typed EVIDENCE — one evidence
 * shape per check kind, admitted by `validateEvidenceForCheck`:
 *
 * - the evidence KIND must equal the item's check kind;
 * - the evidence must PROVE the positive (a red battery command, an
 *   over-budget citation, a drifted contract version, or a false
 *   verification flag is the typed `evidence-rejected` rejection — the
 *   negative path is part of the contract);
 * - every upstream fact the evidence cites is DIGEST-CARRYING (exact-
 *   revision addressing): battery commands mirror the W033 gate grammar,
 *   benchmark citations mirror the W034 budget-verdict vocabulary,
 *   marketplace facts reference the W023 kernel's public verifiers, and
 *   SDK contract pins reference the published contract versions.
 */
import { z } from 'zod';
import { BUDGET_OUTCOMES, SDK_SURFACE_IDS, type ReleaseCheckKind } from './version';
import {
  NonNegativeDecimalSchema,
  NotesIdSchema,
  PositiveIntSchema,
  SemverCoreSchema,
  firstIssueText,
  releaseFail,
  type ReleaseResult,
} from './primitives';
import { Sha256DigestSchema } from './provenance';

// The marketplace id grammars — MIRRORED from @epoch/marketplace's
// LISTING_ID_PATTERN / ENTITLEMENT_ID_PATTERN (W023); pinned by the
// runtime parity test (test/parity.test.ts).
const LISTING_ID_REGEX = /^listing:[a-z0-9][a-z0-9-]{0,62}$/;
const ENTITLEMENT_ID_REGEX = /^entitlement:[a-z0-9][a-z0-9-]{0,62}$/;

const ListingIdSchema = z.string().regex(LISTING_ID_REGEX, 'must be a listing id of the form "listing:<slug>"');
const EntitlementIdSchema = z
  .string()
  .regex(ENTITLEMENT_ID_REGEX, 'must be an entitlement id of the form "entitlement:<slug>"');

// --------------------------------------------------------------------------------
// The evidence union (one shape per check kind).
// --------------------------------------------------------------------------------

/** Evidence: one verification-battery command ran green. */
export const BatteryGreenEvidenceSchema = z
  .strictObject({
    kind: z.literal('battery-command-green'),
    /** The exact battery command (mirrors the W033 GateCommand grammar). */
    command: z.string().min(1).max(256),
    /** The battery's declared expected exit code. */
    expectExitCode: z.number().int().min(0).max(255),
    /** The observed exit code. */
    exitCode: z.number().int().min(0).max(255),
  })
  .readonly();
export type BatteryGreenEvidence = z.infer<typeof BatteryGreenEvidenceSchema>;

/** Evidence: one cited W034 budget verdict is within (or near) budget. */
export const BenchmarkWithinEvidenceSchema = z
  .strictObject({
    kind: z.literal('benchmark-budget-within'),
    budgetId: z.string().regex(/^budget:[a-z0-9][a-z0-9-]{0,62}$/),
    /** The overall W034 verdict (`within-budget` or `near-budget`). */
    overall: z.enum(BUDGET_OUTCOMES).refine((value) => value !== 'over-budget', {
      message: 'an over-budget citation is not admissible evidence (the W034 regression gate bites first)',
    }),
    /** The digest of the cited budget record. */
    budgetDigest: Sha256DigestSchema,
    /** The digest of the cited sealed budget-verdict record. */
    verdictDigest: Sha256DigestSchema,
  })
  .readonly();
export type BenchmarkWithinEvidence = z.infer<typeof BenchmarkWithinEvidenceSchema>;

/** Evidence: the release notes record is sealed and digest-verified. */
export const NotesPublishedEvidenceSchema = z
  .strictObject({
    kind: z.literal('notes-published'),
    notesId: NotesIdSchema,
    notesDigest: Sha256DigestSchema,
  })
  .readonly();
export type NotesPublishedEvidence = z.infer<typeof NotesPublishedEvidenceSchema>;

/** Evidence: one SDK surface's documentation cites its exact contract version. */
export const SdkContractSyncedEvidenceSchema = z
  .strictObject({
    kind: z.literal('sdk-contract-synced'),
    surfaceId: z.enum(SDK_SURFACE_IDS),
    /** The contract version the documentation declares. */
    documentedVersion: SemverCoreSchema,
    /** The contract version the SDK surface actually exports. */
    actualVersion: SemverCoreSchema,
  })
  .readonly();
export type SdkContractSyncedEvidence = z.infer<typeof SdkContractSyncedEvidenceSchema>;

/** Evidence: the examples/sdk suite ran green. */
export const SdkExamplesGreenEvidenceSchema = z
  .strictObject({
    kind: z.literal('sdk-examples-green'),
    /** The command that ran the examples suite. */
    command: z.string().min(1).max(256),
    expectExitCode: z.number().int().min(0).max(255),
    exitCode: z.number().int().min(0).max(255),
    /** How many example modules ran (at least one). */
    examplesRun: PositiveIntSchema,
  })
  .readonly();
export type SdkExamplesGreenEvidence = z.infer<typeof SdkExamplesGreenEvidenceSchema>;

/** Evidence: the W023 listing version chain verifies. */
export const ListingChainVerifiedEvidenceSchema = z
  .strictObject({
    kind: z.literal('listing-chain-verified'),
    listingId: ListingIdSchema,
    /** Published versions in the chain (at least one). */
    versions: PositiveIntSchema,
    /** Digest of the chain's head (latest) sealed version. */
    headDigest: Sha256DigestSchema,
    chainVerified: z.literal(true),
  })
  .readonly();
export type ListingChainVerifiedEvidence = z.infer<typeof ListingChainVerifiedEvidenceSchema>;

/** Evidence: entitlement grants then revocation flips the check immediately. */
export const EntitlementFlipVerifiedEvidenceSchema = z
  .strictObject({
    kind: z.literal('entitlement-flip-verified'),
    listingId: ListingIdSchema,
    entitlementId: EntitlementIdSchema,
    /** Grant records observed (at least one). */
    grants: PositiveIntSchema,
    /** Revocation records observed (at least one — the flip witness). */
    revocations: PositiveIntSchema,
    /** true: check-positive after grant AND check-negative after revoke. */
    grantedThenDenied: z.literal(true),
  })
  .readonly();
export type EntitlementFlipVerifiedEvidence = z.infer<typeof EntitlementFlipVerifiedEvidenceSchema>;

/** Evidence: usage accounting folds deterministically with exact totals. */
export const UsageFoldVerifiedEvidenceSchema = z
  .strictObject({
    kind: z.literal('usage-fold-verified'),
    entitlementId: EntitlementIdSchema,
    /** Sealed usage events folded (at least one). */
    events: PositiveIntSchema,
    /** The exact decimal-string total of the folded account. */
    totalUnits: NonNegativeDecimalSchema,
    /** true: two folds of the same events (different input order) agree. */
    foldsAgree: z.literal(true),
  })
  .readonly();
export type UsageFoldVerifiedEvidence = z.infer<typeof UsageFoldVerifiedEvidenceSchema>;

/** Evidence: every revenue record carries complete provenance. */
export const RevenueProvenanceEvidenceSchema = z
  .strictObject({
    kind: z.literal('revenue-provenance-complete'),
    listingId: ListingIdSchema,
    /** Revenue records inspected (at least one). */
    records: PositiveIntSchema,
    complete: z.literal(true),
    /** Digest of the latest revenue record (the fold head). */
    lastDigest: Sha256DigestSchema,
  })
  .readonly();
export type RevenueProvenanceEvidence = z.infer<typeof RevenueProvenanceEvidenceSchema>;

/** The closed evidence union — exactly one shape per check kind. */
export const CompletionEvidenceSchema = z.discriminatedUnion('kind', [
  BatteryGreenEvidenceSchema,
  BenchmarkWithinEvidenceSchema,
  NotesPublishedEvidenceSchema,
  SdkContractSyncedEvidenceSchema,
  SdkExamplesGreenEvidenceSchema,
  ListingChainVerifiedEvidenceSchema,
  EntitlementFlipVerifiedEvidenceSchema,
  UsageFoldVerifiedEvidenceSchema,
  RevenueProvenanceEvidenceSchema,
]);
export type CompletionEvidence = z.infer<typeof CompletionEvidenceSchema>;

/** The check kind each evidence shape proves (the bijection). */
export const EVIDENCE_KIND_TO_CHECK: Readonly<Record<CompletionEvidence['kind'], ReleaseCheckKind>> = {
  'battery-command-green': 'battery-command-green',
  'benchmark-budget-within': 'benchmark-budget-within',
  'notes-published': 'notes-published',
  'sdk-contract-synced': 'sdk-contract-synced',
  'sdk-examples-green': 'sdk-examples-green',
  'listing-chain-verified': 'listing-chain-verified',
  'entitlement-flip-verified': 'entitlement-flip-verified',
  'usage-fold-verified': 'usage-fold-verified',
  'revenue-provenance-complete': 'revenue-provenance-complete',
};

// --------------------------------------------------------------------------------
// Admission.
// --------------------------------------------------------------------------------

/**
 * Admit evidence for a check kind: the evidence must parse, its kind must
 * EQUAL the check kind, and it must prove the positive. Failures are the
 * typed `validation` (malformed) / `evidence-rejected` (kind mismatch,
 * negative outcome, or drifted pin) values.
 */
export function validateEvidenceForCheck(
  checkKind: ReleaseCheckKind,
  evidence: unknown,
): ReleaseResult<CompletionEvidence> {
  if (typeof evidence !== 'object' || evidence === null || !('kind' in evidence)) {
    return releaseFail('validation', 'evidence must be an object carrying a "kind" discriminator');
  }
  const parsed = CompletionEvidenceSchema.safeParse(evidence);
  if (!parsed.success) {
    return releaseFail('validation', `evidence failed validation: ${firstIssueText(parsed.error)}`);
  }
  const value = parsed.data;
  if (EVIDENCE_KIND_TO_CHECK[value.kind] !== checkKind) {
    return releaseFail('evidence-rejected', `evidence kind "${value.kind}" does not prove check kind "${checkKind}"`, {
      subject: checkKind,
    });
  }
  // Positivity conditions per kind (the schema literals already force the
  // boolean flags true; the derived conditions are checked here).
  switch (value.kind) {
    case 'battery-command-green':
      if (value.exitCode !== value.expectExitCode) {
        return releaseFail(
          'evidence-rejected',
          `battery command "${value.command}" exited ${value.exitCode}, expected ${value.expectExitCode}`,
          { subject: value.command },
        );
      }
      break;
    case 'sdk-contract-synced':
      if (value.documentedVersion !== value.actualVersion) {
        return releaseFail(
          'evidence-rejected',
          `SDK surface "${value.surfaceId}" documentation cites version ${value.documentedVersion}, the surface exports ${value.actualVersion}`,
          { subject: value.surfaceId },
        );
      }
      break;
    case 'sdk-examples-green':
      if (value.exitCode !== value.expectExitCode) {
        return releaseFail(
          'evidence-rejected',
          `examples command "${value.command}" exited ${value.exitCode}, expected ${value.expectExitCode}`,
          { subject: value.command },
        );
      }
      break;
    default:
      // The remaining kinds carry z.literal(true) flags — already forced.
      break;
  }
  return { ok: true, value };
}
