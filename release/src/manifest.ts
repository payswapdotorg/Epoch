/**
 * @epoch/release-kit — the sealed release manifest (Work Order W035).
 *
 * The manifest is the RELEASE RECORD: the exact identity, label, source
 * revision, component inventory, the green battery evidence, the cited
 * benchmark verdicts, the published SDK contract pins, the marketplace
 * readiness outcomes, and the notes/checklist/evaluation digests —
 * sealed and content-addressed. It is sealable ONLY when the checklist
 * evaluates READY (`release-not-ready` lists the open items otherwise):
 * the manifest gate is the typed refusal point of the whole model.
 *
 * The manifest id is derived deterministically from the content digest
 * (`manifest:<first 16 hex>`) — same content, same id, every time.
 */
import { z } from 'zod';
import { type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  READINESS_DOMAINS,
  RELEASE_CHECK_KINDS,
  RELEASE_KIT_RECORD_VERSION,
} from './version';
import {
  NotesIdSchema,
  ReleaseIdSchema,
  digestOfJson,
  firstIssueText,
  releaseFail,
  type ReleaseResult,
} from './primitives';
import { ReleaseProvenanceSchema, Sha256DigestSchema, type ReleaseProvenance } from './provenance';
import type { CompletionEvidence } from './evidence';
import { type SealedReleaseScope } from './scope';
import type { SealedReleaseChecklist } from './checklist';
import { evaluateReleaseReadiness } from './evaluation';
import type { SealedReleaseNotes } from './notes';

// --------------------------------------------------------------------------------
// The manifest content.
// --------------------------------------------------------------------------------

/** One battery roll-up entry (from completed battery items). */
export const BatteryRollupEntrySchema = z
  .strictObject({
    command: z.string().min(1).max(256),
    expectExitCode: z.number().int().min(0).max(255),
    exitCode: z.number().int().min(0).max(255),
  })
  .readonly();
export type BatteryRollupEntry = z.infer<typeof BatteryRollupEntrySchema>;

/** One benchmark roll-up entry (from completed benchmark items). */
export const BenchmarkRollupEntrySchema = z
  .strictObject({
    budgetId: z.string().regex(/^budget:[a-z0-9][a-z0-9-]{0,62}$/),
    overall: z.enum(['within-budget', 'near-budget']),
    verdictDigest: Sha256DigestSchema,
  })
  .readonly();
export type BenchmarkRollupEntry = z.infer<typeof BenchmarkRollupEntrySchema>;

/** One SDK pin roll-up entry (from completed contract-sync items). */
export const SdkPinRollupEntrySchema = z
  .strictObject({
    surfaceId: z.enum(['adapter-sdk', 'capability-registry', 'extension-sdk', 'marketplace']),
    contractVersion: z.string().regex(/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/),
  })
  .readonly();
export type SdkPinRollupEntry = z.infer<typeof SdkPinRollupEntrySchema>;

/** One marketplace outcome roll-up entry (from completed marketplace items). */
export const MarketplaceRollupEntrySchema = z
  .strictObject({
    checkKind: z.enum(RELEASE_CHECK_KINDS),
    subject: z.string().min(1).max(256),
    evidenceDigest: Sha256DigestSchema,
  })
  .readonly();
export type MarketplaceRollupEntry = z.infer<typeof MarketplaceRollupEntrySchema>;

const manifestShape = z
  .strictObject({
    recordVersion: z.literal(RELEASE_KIT_RECORD_VERSION),
    releaseId: ReleaseIdSchema,
    label: z.string().min(1).max(128),
    /** The exact source revision being released (from the scope). */
    revision: z.string().regex(/^[0-9a-f]{40}$/),
    domains: z.array(z.enum(READINESS_DOMAINS)).min(1),
    /** The deployable component inventory (from the scope). */
    components: z
      .array(
        z
          .strictObject({
            surface: z.string().min(1).max(128),
            kind: z.enum(['package', 'service', 'app', 'adapter', 'pack']),
            description: z.string().min(1).max(256),
          })
          .readonly(),
      )
      .min(1)
      .readonly(),
    /** Green battery evidence roll-up (checklist order). */
    battery: z.array(BatteryRollupEntrySchema).readonly(),
    /** Cited benchmark verdicts roll-up (checklist order). */
    benchmarks: z.array(BenchmarkRollupEntrySchema).readonly(),
    /** Published SDK contract pins roll-up (checklist order). */
    sdk: z.array(SdkPinRollupEntrySchema).readonly(),
    /** Marketplace readiness outcomes roll-up (checklist order). */
    marketplace: z.array(MarketplaceRollupEntrySchema).readonly(),
    /** The notes record this release publishes. */
    notesRef: z
      .strictObject({
        notesId: NotesIdSchema,
        notesDigest: Sha256DigestSchema,
      })
      .readonly(),
    /** Exact-revision input pins. */
    checklistDigest: Sha256DigestSchema,
    evaluationDigest: Sha256DigestSchema,
    /** The instant readiness was achieved (the last item completion). */
    readyAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
    provenance: ReleaseProvenanceSchema,
  });

/** A release manifest (content half). */
export const ReleaseManifestSchema = manifestShape.readonly();
export type ReleaseManifest = z.infer<typeof ReleaseManifestSchema>;

/** A sealed release manifest (content-addressed). */
export const SealedReleaseManifestSchema = manifestShape
  .extend({ digest: z.string().regex(/^[0-9a-f]{64}$/) })
  .readonly();
export type SealedReleaseManifest = z.infer<typeof SealedReleaseManifestSchema>;

/** The content half of a sealed manifest (digest excluded). */
export function manifestContent(manifest: SealedReleaseManifest): Omit<SealedReleaseManifest, 'digest'> {
  const { digest: _digest, ...rest } = manifest;
  void _digest;
  return rest;
}

/** Compute the canonical digest of manifest content. */
export function computeManifestDigest(content: ReleaseManifest): Sha256Hex {
  return digestOfJson(content as unknown as JsonValue);
}

/** The deterministic manifest id of a content digest (first 16 hex). */
export function manifestIdOf(digest: Sha256Hex): string {
  return `manifest:${digest.slice(0, 16)}`;
}

// --------------------------------------------------------------------------------
// Sealing (the readiness gate).
// --------------------------------------------------------------------------------

/**
 * Seal the release manifest of a READY checklist + its scope + its notes:
 *
 * - verifies the scope, checklist and notes digests (tamper gates);
 * - RE-EVALUATES readiness from the checklist (never trusts a passed-in
 *   verdict) and refuses with `release-not-ready` + the open items when
 *   any item is incomplete;
 * - rolls the completed items' evidence up into the manifest domains;
 * - derives the manifest id from the content digest.
 */
export function sealReleaseManifest(input: {
  readonly scope: SealedReleaseScope;
  readonly checklist: SealedReleaseChecklist;
  readonly notes: SealedReleaseNotes;
  readonly provenance: ReleaseProvenance;
}): ReleaseResult<SealedReleaseManifest> {
  const { scope, checklist, notes, provenance } = input;

  if (checklist.releaseId !== scope.releaseId) {
    return releaseFail('validation', `checklist "${checklist.checklistId}" does not belong to release "${scope.releaseId}"`, {
      subject: scope.releaseId,
    });
  }
  if (notes.releaseId !== scope.releaseId) {
    return releaseFail('validation', `notes "${notes.notesId}" do not belong to release "${scope.releaseId}"`, {
      subject: scope.releaseId,
    });
  }

  const evaluation = evaluateReleaseReadiness(checklist);
  if (!evaluation.ok) return evaluation;
  if (evaluation.value.verdict !== 'ready') {
    return releaseFail(
      'release-not-ready',
      `release "${scope.releaseId}" is not ready: ${evaluation.value.openItems.length} open item(s)`,
      {
        subject: scope.releaseId,
        openItems: evaluation.value.openItems.map((item) => item.itemId),
      },
    );
  }

  const battery: BatteryRollupEntry[] = [];
  const benchmarks: BenchmarkRollupEntry[] = [];
  const sdk: SdkPinRollupEntry[] = [];
  const marketplace: MarketplaceRollupEntry[] = [];
  for (const item of checklist.items) {
    const evidence = item.evidence as CompletionEvidence;
    if (item.domain === 'release') {
      if (evidence.kind === 'battery-command-green') {
        battery.push({ command: evidence.command, expectExitCode: evidence.expectExitCode, exitCode: evidence.exitCode });
      } else if (evidence.kind === 'benchmark-budget-within') {
        benchmarks.push({ budgetId: evidence.budgetId, overall: evidence.overall, verdictDigest: evidence.verdictDigest });
      }
    } else if (item.domain === 'sdk-docs') {
      if (evidence.kind === 'sdk-contract-synced') {
        sdk.push({ surfaceId: evidence.surfaceId, contractVersion: evidence.actualVersion });
      }
    } else {
      marketplace.push({ checkKind: item.checkKind, subject: item.subject, evidenceDigest: digestOfJson(evidence as unknown as JsonValue) });
    }
  }

  const completedInstants = checklist.items.map((item) => item.completedAt ?? '').sort();
  const readyAt = completedInstants[completedInstants.length - 1] ?? provenance.instant;

  const content: ReleaseManifest = {
    recordVersion: RELEASE_KIT_RECORD_VERSION,
    releaseId: scope.releaseId,
    label: scope.label,
    revision: scope.revision,
    domains: scope.domains,
    components: scope.components,
    battery,
    benchmarks,
    sdk,
    marketplace,
    notesRef: { notesId: notes.notesId, notesDigest: notes.digest },
    checklistDigest: checklist.digest,
    evaluationDigest: evaluation.value.digest,
    readyAt,
    provenance: {
      actor: provenance.actor,
      method: 'seal-release-manifest',
      instant: provenance.instant,
      derivedFrom: [scope.digest, checklist.digest, notes.digest, evaluation.value.digest],
    },
  };
  return { ok: true, value: { ...content, digest: computeManifestDigest(content) } };
}

/** Verify a sealed manifest's digest (tamper detection). */
export function verifyManifestDigest(manifest: SealedReleaseManifest): ReleaseResult<SealedReleaseManifest> {
  const revalidated = ReleaseManifestSchema.safeParse(manifestContent(manifest));
  if (!revalidated.success) {
    return releaseFail('validation', `manifest failed validation: ${firstIssueText(revalidated.error)}`, {
      subject: manifest.releaseId,
    });
  }
  const expected = computeManifestDigest(revalidated.data);
  if (expected !== manifest.digest) {
    return releaseFail('digest-mismatch', `manifest of "${manifest.releaseId}": digest does not match content (tampered manifest)`, {
      subject: manifest.releaseId,
    });
  }
  return { ok: true, value: manifest };
}
