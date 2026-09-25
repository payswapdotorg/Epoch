/**
 * Digest discipline for world documents: a world scene's identity at a
 * revision is the SHA-256 of the canonical JSON serialization of its
 * content (content addressing over the runtime-neutral canonical
 * machinery from @epoch/agent-protocol — reused, never mirrored).
 * Admission REJECTS a sealed scene whose claimed digest does not match
 * the recomputed one (tamper detection).
 *
 * Determinism: canonical JSON sorts object keys, and the scene schema
 * enforces sorted, duplicate-free collections, so semantically equal
 * scenes serialize to identical bytes and their digests are stable.
 */
import {
  canonicalDigest,
  canonicalJsonStringify,
  type JsonValue,
} from '@epoch/agent-protocol';
import {
  WorldSceneContentSchema,
  WorldSceneSchema,
  sealWorldSceneContent,
  type WorldScene,
  type WorldSceneContent,
  admitWorldSceneContent,
  type SceneStoreOptions,
} from './scene';
import { digestMismatchError, malformedRecordError } from './issues';
import type { WorldExperienceResult } from './errors';

/**
 * Deterministic serialization of a sealed world scene (canonical JSON:
 * sorted keys, no insignificant whitespace). Throws on an invalid scene —
 * producers validate first ({@link admitWorldScene} in src/parse.ts is
 * the total form).
 */
export function serializeWorldScene(scene: WorldScene): string {
  const parsed = WorldSceneSchema.safeParse(scene);
  if (!parsed.success) {
    throw new Error(
      `cannot serialize an invalid world scene (${firstIssueMessage(parsed.error)})`,
    );
  }
  return canonicalJsonStringify(parsed.data as unknown as JsonValue);
}

/**
 * Content digest of a world scene: the SHA-256 of the canonical JSON of
 * the CONTENT (every field except `digest` itself). Throws on invalid
 * content.
 */
export function computeWorldSceneDigest(content: WorldSceneContent): string {
  const parsed = WorldSceneContentSchema.safeParse(content);
  if (!parsed.success) {
    throw new Error(
      `cannot digest an invalid world scene (${firstIssueMessage(parsed.error)})`,
    );
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/**
 * Seal valid scene content into a world scene envelope (content + its
 * recomputed digest). Total: admission runs first, so invalid content
 * yields the typed admission error, never a half-sealed record.
 */
export function sealWorldScene(
  content: unknown,
  options?: SceneStoreOptions,
): WorldExperienceResult<WorldScene> {
  const admitted = admitWorldSceneContent(content, options);
  if (!admitted.ok) {
    return admitted;
  }
  return { ok: true, value: sealWorldSceneContent(admitted.value) };
}

/**
 * Verify a claimed digest against the recomputed content digest of a
 * sealed scene (tamper detection). Total: schema-invalid scenes yield a
 * typed `malformed-record` error; digest skew yields `digest-mismatch`
 * with expected and encountered values.
 */
export function verifyWorldSceneDigest(envelope: unknown): WorldExperienceResult<WorldSceneContent> {
  const parsed = WorldSceneSchema.safeParse(envelope);
  if (!parsed.success) {
    return { ok: false, error: malformedRecordError(parsed.error) };
  }
  const { digest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== digest) {
    return {
      ok: false,
      error: digestMismatchError(['digest'], expected, digest),
    };
  }
  return { ok: true, value: content };
}

function firstIssueMessage(error: Parameters<typeof malformedRecordError>[0]): string {
  const first = malformedRecordError(error).issues[0];
  return first ? `${first.path}: ${first.message}` : 'invalid';
}
