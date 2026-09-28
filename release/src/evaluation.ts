/**
 * @epoch/release-kit — readiness evaluation (Work Order W035).
 *
 * `evaluateReleaseReadiness` is a PURE function of a sealed checklist:
 * the verdict is `ready` iff EVERY item carries evidence + completion
 * instant + actor; otherwise `blocked` with the open items as typed
 * values (precise itemId / domain / checkKind / subject). The evaluation
 * itself is a sealed, content-addressed record — the exact-revision
 * verdict a release manifest cites.
 *
 * There is no near-ready verdict by design: readiness is binary at the
 * manifest gate (an incomplete checklist cannot seal a manifest), while
 * per-item nuance lives in the evidence (a `near-budget` benchmark
 * citation is admissible but notable — see docs/release/readiness-gate-policy.md).
 */
import { z } from 'zod';
import { type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { READINESS_DOMAINS, READINESS_VERDICTS, RELEASE_KIT_RECORD_VERSION } from './version';
import { ChecklistIdSchema, ReleaseIdSchema, digestOfJson, firstIssueText, releaseFail, type ReleaseResult } from './primitives';
import { Sha256DigestSchema } from './provenance';
import { verifyChecklistDigest, type SealedReleaseChecklist } from './checklist';

// --------------------------------------------------------------------------------
// The blocked-item value.
// --------------------------------------------------------------------------------

/** One open (blocking) checklist item, as a typed value. */
export const OpenItemSchema = z
  .strictObject({
    itemId: z.string().regex(/^item:[1-9][0-9]*:[a-z0-9-]+$/),
    domain: z.enum(READINESS_DOMAINS),
    checkKind: z.string().min(1).max(64),
    subject: z.string().min(1).max(256),
    description: z.string().min(1).max(512),
  })
  .readonly();
export type OpenItem = z.infer<typeof OpenItemSchema>;

// --------------------------------------------------------------------------------
// The evaluation record.
// --------------------------------------------------------------------------------

const evaluationShape = z
  .strictObject({
    recordVersion: z.literal(RELEASE_KIT_RECORD_VERSION),
    releaseId: ReleaseIdSchema,
    checklistId: ChecklistIdSchema,
    verdict: z.enum(READINESS_VERDICTS),
    totalItems: z.number().int().min(1),
    completeItems: z.number().int().min(0),
    /** Digest of the evaluated checklist (exact-revision input pin). */
    checklistDigest: Sha256DigestSchema,
    /** The open items, in checklist order (empty iff verdict is ready). */
    openItems: z.array(OpenItemSchema).readonly(),
    /** Per-domain counts (fixed vocabulary order). */
    summary: z
      .array(
        z
          .strictObject({
            domain: z.enum(READINESS_DOMAINS),
            total: z.number().int().min(0),
            complete: z.number().int().min(0),
          })
          .readonly(),
      )
      .readonly(),
  });

/** A readiness evaluation (content half). */
export const ReadinessEvaluationSchema = evaluationShape.readonly();
export type ReadinessEvaluation = z.infer<typeof ReadinessEvaluationSchema>;

/** A sealed readiness evaluation (content-addressed). */
export const SealedReadinessEvaluationSchema = evaluationShape
  .extend({ digest: z.string().regex(/^[0-9a-f]{64}$/) })
  .readonly();
export type SealedReadinessEvaluation = z.infer<typeof SealedReadinessEvaluationSchema>;

/** The content half of a sealed evaluation (digest excluded). */
export function evaluationContent(evaluation: SealedReadinessEvaluation): Omit<SealedReadinessEvaluation, 'digest'> {
  const { digest: _digest, ...rest } = evaluation;
  void _digest;
  return rest;
}

/** Compute the canonical digest of evaluation content. */
export function computeEvaluationDigest(content: ReadinessEvaluation): Sha256Hex {
  return digestOfJson(content as unknown as JsonValue);
}

// --------------------------------------------------------------------------------
// Evaluation.
// --------------------------------------------------------------------------------

/**
 * Evaluate the readiness of a sealed checklist (pure + deterministic):
 * verifies the checklist digest, then folds item states into the typed
 * verdict. Identical checklists evaluate to identical verdict digests.
 */
export function evaluateReleaseReadiness(
  checklist: SealedReleaseChecklist,
): ReleaseResult<SealedReadinessEvaluation> {
  const verified = verifyChecklistDigest(checklist);
  if (!verified.ok) return verified;

  const openItems: OpenItem[] = [];
  let completeItems = 0;
  for (const item of checklist.items) {
    if (item.evidence !== null && item.completedAt !== null && item.completedBy !== null) {
      completeItems += 1;
    } else {
      openItems.push({
        itemId: item.itemId,
        domain: item.domain,
        checkKind: item.checkKind,
        subject: item.subject,
        description: item.description,
      });
    }
  }

  const summary = READINESS_DOMAINS.map((domain) => {
    const domainItems = checklist.items.filter((item) => item.domain === domain);
    return {
      domain,
      total: domainItems.length,
      complete: domainItems.filter((item) => item.completedAt !== null).length,
    };
  });

  const verdict = openItems.length === 0 ? 'ready' : 'blocked';
  const content: ReadinessEvaluation = {
    recordVersion: RELEASE_KIT_RECORD_VERSION,
    releaseId: checklist.releaseId,
    checklistId: checklist.checklistId,
    verdict,
    totalItems: checklist.items.length,
    completeItems,
    checklistDigest: checklist.digest,
    openItems,
    summary,
  };
  return { ok: true, value: { ...content, digest: computeEvaluationDigest(content) } };
}

/** Verify a sealed evaluation's digest (tamper detection). */
export function verifyEvaluationDigest(
  evaluation: SealedReadinessEvaluation,
): ReleaseResult<SealedReadinessEvaluation> {
  const revalidated = ReadinessEvaluationSchema.safeParse(evaluationContent(evaluation));
  if (!revalidated.success) {
    return releaseFail(
      'validation',
      `evaluation failed validation: ${firstIssueText(revalidated.error)}`,
      { subject: evaluation.releaseId },
    );
  }
  const expected = computeEvaluationDigest(revalidated.data);
  return expected === evaluation.digest
    ? { ok: true, value: evaluation }
    : releaseFail(
        'digest-mismatch',
        `evaluation of "${evaluation.releaseId}": digest does not match content (tampered evaluation)`,
        { subject: evaluation.releaseId },
      );
}
