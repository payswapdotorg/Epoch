/**
 * Digest discipline — canonical SHA-256 content addressing and tamper
 * detection for the sealed progressive-scene records (machinery reused
 * from @epoch/agent-protocol, the W013 precedent).
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import type { ProgressiveSceneLadder, ProgressiveSceneLadderContent } from './ladder';
import { ProgressiveSceneLadderSchema } from './ladder';
import { digestMismatchError } from './issues';
import type { ProgressiveSceneResult } from './errors';

/** Extract the content of a sealed ladder (everything but the digest). */
export function ladderContentOf(
  ladder: ProgressiveSceneLadder,
): ProgressiveSceneLadderContent {
  const { digest: _sealed, ...content } = ladder;
  void _sealed;
  return content;
}

/** Compute the canonical content digest of a ladder's content. */
export function computeLadderDigest(content: ProgressiveSceneLadderContent): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/**
 * Verify a sealed ladder's claimed digest against its recomputed content
 * digest (tamper detection). Total: schema-invalid envelopes yield typed
 * `malformed-record` errors; digest skew yields `digest-mismatch`.
 */
export function verifyLadderDigest(
  envelope: unknown,
): ProgressiveSceneResult<ProgressiveSceneLadderContent> {
  const parsed = ProgressiveSceneLadderSchema.safeParse(envelope);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'the progressive-scene ladder failed schema admission',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
    };
  }
  const content = ladderContentOf(parsed.data);
  const expected = computeLadderDigest(content);
  if (expected !== parsed.data.digest) {
    return {
      ok: false,
      error: digestMismatchError(['digest'], expected, parsed.data.digest),
    };
  }
  return { ok: true, value: content };
}
