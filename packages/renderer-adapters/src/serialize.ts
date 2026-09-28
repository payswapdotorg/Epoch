/**
 * Digest discipline — canonical SHA-256 content addressing and tamper
 * detection for the sealed renderer-adapters records (machinery reused
 * from @epoch/agent-protocol, the W013 precedent).
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import type { RendererAdapterSelection, RendererAdapterSelectionContent } from './selection';
import type { RendererMountPlan, RendererMountPlanContent } from './plan';
import { RendererAdapterSelectionSchema } from './selection';
import { RendererMountPlanSchema } from './plan';
import { digestMismatchError } from './issues';
import type { RendererAdaptersResult } from './errors';

/** Extract the content of a sealed selection (everything but the digest). */
export function selectionContentOf(
  selection: RendererAdapterSelection,
): RendererAdapterSelectionContent {
  const { digest: _sealed, ...content } = selection;
  void _sealed;
  return content;
}

/** Compute the canonical content digest of a selection's content. */
export function computeSelectionDigest(content: RendererAdapterSelectionContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/**
 * Verify a sealed selection's claimed digest against its recomputed
 * content digest (tamper detection). Total.
 */
export function verifySelectionDigest(
  envelope: unknown,
): RendererAdaptersResult<RendererAdapterSelectionContent> {
  const parsed = RendererAdapterSelectionSchema.safeParse(envelope);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the renderer adapter selection failed schema admission',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  const content = selectionContentOf(parsed.data);
  const expected = computeSelectionDigest(content);
  if (expected !== parsed.data.digest) {
    return {
      ok: false,
      error: digestMismatchError(['digest'], expected, parsed.data.digest),
    };
  }
  return { ok: true, value: content };
}

/** Extract the content of a sealed mount plan (everything but the digest). */
export function mountPlanContentOf(plan: RendererMountPlan): RendererMountPlanContent {
  const { digest: _sealed, ...content } = plan;
  void _sealed;
  return content;
}

/** Compute the canonical content digest of a mount plan's content. */
export function computeMountPlanDigest(content: RendererMountPlanContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/**
 * Verify a sealed mount plan's claimed digest against its recomputed
 * content digest (tamper detection). Total.
 */
export function verifyMountPlanDigest(
  envelope: unknown,
): RendererAdaptersResult<RendererMountPlanContent> {
  const parsed = RendererMountPlanSchema.safeParse(envelope);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the renderer mount plan failed schema admission',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  const content = mountPlanContentOf(parsed.data);
  const expected = computeMountPlanDigest(content);
  if (expected !== parsed.data.digest) {
    return {
      ok: false,
      error: digestMismatchError(['digest'], expected, parsed.data.digest),
    };
  }
  return { ok: true, value: content };
}
