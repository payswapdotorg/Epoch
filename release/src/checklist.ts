/**
 * @epoch/release-kit — the readiness checklist (Work Order W035).
 *
 * A release candidate's checklist is DERIVED, not authored:
 * `deriveReleaseChecklist(sealedScope)` is a deterministic function of the
 * scope over the fixed DOMAIN_CHECK_TABLE — one typed item per battery
 * command, per benchmark citation, per SDK surface pin, per marketplace
 * readiness check, plus the notes-published and sdk-examples-green items.
 * Same scope -> same items -> same digest, every time (replay-stable).
 *
 * Items complete ONLY with typed EVIDENCE (`evidence.ts`) plus a
 * caller-supplied instant and actor (zero wall-clock). Completion is an
 * IMMUTABLE transition: `completeChecklistItem` returns a NEW sealed
 * checklist; the old one remains the exact-revision record of the prior
 * state. The checklist is sealed at every state (content-addressed); a
 * tampered digest is the typed `digest-mismatch` rejection.
 */
import { z } from 'zod';
import { type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  READINESS_DOMAINS,
  RELEASE_CHECK_KINDS,
  RELEASE_KIT_RECORD_VERSION,
  type ReadinessDomain,
} from './version';
import {
  ChecklistIdSchema,
  ChecklistItemIdSchema,
  ReleaseActorSchema,
  ReleaseIdSchema,
  digestOfJson,
  firstIssueText,
  releaseFail,
  type ReleaseResult,
} from './primitives';
import { ReleaseProvenanceSchema, type ReleaseActorRef } from './provenance';
import {
  CompletionEvidenceSchema,
  validateEvidenceForCheck,
  type CompletionEvidence,
} from './evidence';
import { checklistIdOf, notesIdOf, verifyScopeDigest, type SealedReleaseScope } from './scope';

// --------------------------------------------------------------------------------
// The checklist item.
// --------------------------------------------------------------------------------

/** One readiness checklist item (open until evidence + instant + actor). */
export const ChecklistItemSchema = z
  .strictObject({
    itemId: ChecklistItemIdSchema,
    domain: z.enum(READINESS_DOMAINS),
    checkKind: z.enum(RELEASE_CHECK_KINDS),
    /** The precise subject the item concerns (command / budget id / surface id / listing id...). */
    subject: z.string().min(1).max(256),
    description: z.string().min(1).max(512),
    /** Completion evidence (null until the item is done). */
    evidence: CompletionEvidenceSchema.nullable(),
    completedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/).nullable(),
    completedBy: ReleaseActorSchema.nullable(),
  })
  .readonly();
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

// --------------------------------------------------------------------------------
// The checklist record.
// --------------------------------------------------------------------------------

const checklistShape = z
  .strictObject({
    recordVersion: z.literal(RELEASE_KIT_RECORD_VERSION),
    checklistId: ChecklistIdSchema,
    releaseId: ReleaseIdSchema,
    domains: z.array(z.enum(READINESS_DOMAINS)).min(1),
    items: z.array(ChecklistItemSchema).min(1),
    provenance: ReleaseProvenanceSchema,
  });

/** A readiness checklist (content half). */
export const ReleaseChecklistSchema = checklistShape.readonly();
export type ReleaseChecklist = z.infer<typeof ReleaseChecklistSchema>;

/** A sealed readiness checklist (content-addressed). */
export const SealedReleaseChecklistSchema = checklistShape
  .extend({ digest: z.string().regex(/^[0-9a-f]{64}$/) })
  .readonly();
export type SealedReleaseChecklist = z.infer<typeof SealedReleaseChecklistSchema>;

/** The content half of a sealed checklist (digest excluded). */
export function checklistContent(checklist: SealedReleaseChecklist): Omit<SealedReleaseChecklist, 'digest'> {
  const { digest: _digest, ...rest } = checklist;
  void _digest;
  return rest;
}

/** Compute the canonical digest of checklist content. */
export function computeChecklistDigest(content: ReleaseChecklist): Sha256Hex {
  return digestOfJson(content as unknown as JsonValue);
}

/** Verify a sealed checklist's digest (tamper detection + revalidation). */
export function verifyChecklistDigest(checklist: SealedReleaseChecklist): ReleaseResult<SealedReleaseChecklist> {
  const revalidated = ReleaseChecklistSchema.safeParse(checklistContent(checklist));
  if (!revalidated.success) {
    return releaseFail(
      'validation',
      `checklist "${checklist.checklistId}" failed validation: ${firstIssueText(revalidated.error)}`,
      { subject: checklist.checklistId },
    );
  }
  const expected = computeChecklistDigest(revalidated.data);
  return expected === checklist.digest
    ? { ok: true, value: checklist }
    : releaseFail(
        'digest-mismatch',
        `checklist "${checklist.checklistId}": digest does not match content (tampered checklist)`,
        { subject: checklist.checklistId },
      );
}

/** Seal valid checklist content (adds the content address). */
export function sealChecklist(input: unknown): ReleaseResult<SealedReleaseChecklist> {
  const parsed = ReleaseChecklistSchema.safeParse(input);
  if (!parsed.success) {
    return releaseFail('validation', `checklist failed validation: ${firstIssueText(parsed.error)}`, {
      subject: 'checklist',
    });
  }
  return { ok: true, value: { ...parsed.data, digest: computeChecklistDigest(parsed.data) } };
}

// --------------------------------------------------------------------------------
// Deterministic derivation (scope -> checklist).
// --------------------------------------------------------------------------------

interface ItemDraft {
  readonly domain: ReadinessDomain;
  readonly checkKind: CompletionEvidence['kind'];
  readonly subject: string;
  readonly description: string;
}

/**
 * Derive the readiness checklist of a sealed scope (deterministic):
 * iterates READINESS_DOMAINS order; within the release domain battery
 * commands come first (scope order), then benchmark citations (scope
 * order), then the notes item; the sdk-docs domain emits one item per
 * SDK surface pin (scope order) then the examples item; the marketplace
 * domain emits its four checks in DOMAIN_CHECK_TABLE order. Identical
 * scopes derive byte-identical checklists.
 */
export function deriveReleaseChecklist(scope: SealedReleaseScope): ReleaseResult<SealedReleaseChecklist> {
  const verified = verifyScopeDigest(scope);
  if (!verified.ok) return verified;

  const drafts: ItemDraft[] = [];
  const domains = scope.domains;
  if (domains.includes('release')) {
    for (const command of scope.battery) {
      drafts.push({
        domain: 'release',
        checkKind: 'battery-command-green',
        subject: command.command,
        description: `Verification battery command green: ${command.command}`,
      });
    }
    for (const citation of scope.benchmarks) {
      drafts.push({
        domain: 'release',
        checkKind: 'benchmark-budget-within',
        subject: citation.budgetId,
        description: `Cited budget ${citation.budgetId} within envelope at ${citation.inputUnit}=${citation.inputSize}`,
      });
    }
    drafts.push({
      domain: 'release',
      checkKind: 'notes-published',
      subject: notesIdOf(scope.releaseId),
      description: `Release notes record sealed and digest-verified (${notesIdOf(scope.releaseId)})`,
    });
  }
  if (domains.includes('sdk-docs')) {
    for (const pin of scope.sdkSurfaces) {
      drafts.push({
        domain: 'sdk-docs',
        checkKind: 'sdk-contract-synced',
        subject: pin.surfaceId,
        description: `SDK docs cite the exact contract version of ${pin.surfaceId} (${pin.docPath})`,
      });
    }
    drafts.push({
      domain: 'sdk-docs',
      checkKind: 'sdk-examples-green',
      subject: 'examples/sdk',
      description: 'The examples/sdk suite ran green (deterministic digest projections)',
    });
  }
  if (domains.includes('marketplace')) {
    drafts.push({
      domain: 'marketplace',
      checkKind: 'listing-chain-verified',
      subject: scope.marketplace.listingId,
      description: `Listing version chain verifies (${scope.marketplace.listingId})`,
    });
    drafts.push({
      domain: 'marketplace',
      checkKind: 'entitlement-flip-verified',
      subject: scope.marketplace.entitlementId,
      description: `Entitlement check flips immediately on revocation (${scope.marketplace.entitlementId})`,
    });
    drafts.push({
      domain: 'marketplace',
      checkKind: 'usage-fold-verified',
      subject: scope.marketplace.entitlementId,
      description: `Usage accounting folds deterministically (${scope.marketplace.entitlementId})`,
    });
    drafts.push({
      domain: 'marketplace',
      checkKind: 'revenue-provenance-complete',
      subject: scope.marketplace.listingId,
      description: `Revenue records carry complete provenance (${scope.marketplace.listingId})`,
    });
  }

  if (drafts.length === 0) {
    return releaseFail('validation', 'scope declares no readiness domains with derivable items', {
      subject: scope.releaseId,
    });
  }

  const items: ChecklistItem[] = drafts.map((draft, index) => {
    const slug = slugOf(draft);
    return {
      itemId: `item:${index + 1}:${slug}`,
      domain: draft.domain,
      checkKind: draft.checkKind,
      subject: draft.subject,
      description: draft.description,
      evidence: null,
      completedAt: null,
      completedBy: null,
    };
  });

  return sealChecklist({
    recordVersion: RELEASE_KIT_RECORD_VERSION,
    checklistId: checklistIdOf(scope.releaseId),
    releaseId: scope.releaseId,
    domains,
    items,
    provenance: {
      actor: scope.provenance.actor,
      method: 'derive-release-checklist',
      instant: scope.provenance.instant,
      derivedFrom: [scope.digest],
    },
  });
}

/** The deterministic item-id slug of a draft (subject segment, kebab-safe). */
function slugOf(draft: ItemDraft): string {
  const segment = draft.subject.includes(':') ? draft.subject.split(':').slice(1).join('-') : draft.subject;
  const kebab = segment.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  const bounded = kebab.length > 48 ? kebab.slice(0, 48) : kebab;
  return `${draft.checkKind}-${bounded}`.replace(/-{2,}/g, '-').replace(/-+$/g, '');
}

// --------------------------------------------------------------------------------
// Completion (immutable transition).
// --------------------------------------------------------------------------------

/** The evidence digest of a completed item (exact-revision addressing). */
export function evidenceDigestOf(evidence: CompletionEvidence): Sha256Hex {
  return digestOfJson(evidence as unknown as JsonValue);
}

/**
 * Complete one checklist item: validates the evidence against the item's
 * check kind, stamps the caller-supplied instant + actor, and returns a
 * NEW sealed checklist (immutable transition). Typed rejections:
 * `unknown-item`, `item-already-complete`, `evidence-rejected`
 * (kind mismatch / negative outcome / drifted pin), `digest-mismatch`
 * (the input checklist was tampered), `validation`.
 */
export function completeChecklistItem(
  checklist: SealedReleaseChecklist,
  itemId: string,
  evidence: unknown,
  instant: string,
  actor: ReleaseActorRef,
): ReleaseResult<SealedReleaseChecklist> {
  const verified = verifyChecklistDigest(checklist);
  if (!verified.ok) return verified;

  const index = checklist.items.findIndex((item) => item.itemId === itemId);
  if (index === -1) {
    return releaseFail('unknown-item', `checklist "${checklist.checklistId}" has no item "${itemId}"`, {
      subject: itemId,
    });
  }
  const item = checklist.items[index]!;
  if (item.completedAt !== null) {
    return releaseFail('item-already-complete', `item "${itemId}" is already complete`, { subject: itemId });
  }
  const admitted = validateEvidenceForCheck(item.checkKind, evidence);
  if (!admitted.ok) {
    return releaseFail(admitted.error.code, `${admitted.error.message} (item "${itemId}")`, {
      subject: itemId,
    });
  }

  const items = checklist.items.map((candidate, position) =>
    position === index
      ? {
          ...candidate,
          evidence: admitted.value,
          completedAt: instant,
          completedBy: actor.actorId,
        }
      : candidate,
  );

  return sealChecklist({
    ...checklistContent(checklist),
    items,
    provenance: {
      actor,
      method: 'complete-checklist-item',
      instant,
      derivedFrom: [checklist.digest, evidenceDigestOf(admitted.value)],
    },
  });
}

/** Notes id derivation (re-export for callers building the notes item evidence). */
export { notesIdOf } from './scope';
