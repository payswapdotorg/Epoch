/**
 * Digest discipline for experience documents: an Experience Graph's
 * identity at a revision is the SHA-256 of the canonical JSON
 * serialization of its content (content addressing over the
 * runtime-neutral canonical machinery from @epoch/agent-protocol — reused,
 * never mirrored). Admission REJECTS a sealed envelope whose claimed
 * digest does not match the recomputed one (tamper detection).
 *
 * Determinism: canonical JSON sorts object keys, and the graph schemas
 * enforce sorted, duplicate-free node/edge/reference arrays, so
 * semantically equal graphs serialize to identical bytes and their
 * digests are stable.
 */
import {
  canonicalDigest,
  canonicalJsonStringify,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/agent-protocol';
import {
  ExperienceGraphContentSchema,
  ExperienceGraphSchema,
  type ExperienceGraph,
  type ExperienceGraphContent,
} from './graph';
import { ProjectionRequestSchema, type ProjectionRequest } from './request';
import { malformedDescriptorError } from './issues';
import type { ExperienceResult } from './errors';

function firstIssueMessage(error: Parameters<typeof malformedDescriptorError>[0]): string {
  const first = malformedDescriptorError(error).issues[0];
  return first ? `${first.path}: ${first.message}` : 'invalid';
}

/**
 * Deterministic serialization of an Experience Graph envelope (canonical
 * JSON: sorted keys, no insignificant whitespace). Throws on an invalid
 * envelope — producers validate first ({@link parseExperienceGraph} in
 * src/parse.ts is the total form).
 */
export function serializeExperienceGraph(graph: ExperienceGraph): string {
  const parsed = ExperienceGraphSchema.safeParse(graph);
  if (!parsed.success) {
    throw new Error(
      `cannot serialize an invalid experience graph (${firstIssueMessage(parsed.error)})`,
    );
  }
  return canonicalJsonStringify(parsed.data as unknown as JsonValue);
}

/**
 * Deterministic serialization of a projection request (canonical JSON).
 * Throws on an invalid request.
 */
export function serializeProjectionRequest(request: ProjectionRequest): string {
  const parsed = ProjectionRequestSchema.safeParse(request);
  if (!parsed.success) {
    throw new Error(
      `cannot serialize an invalid projection request (${firstIssueMessage(parsed.error)})`,
    );
  }
  return canonicalJsonStringify(parsed.data as unknown as JsonValue);
}

/**
 * Content digest of an Experience Graph: the SHA-256 of the canonical JSON
 * of the CONTENT (every field except `digest` itself). Throws on invalid
 * content.
 */
export function computeExperienceGraphDigest(content: ExperienceGraphContent): Sha256Hex {
  const parsed = ExperienceGraphContentSchema.safeParse(content);
  if (!parsed.success) {
    throw new Error(
      `cannot digest an invalid experience graph (${firstIssueMessage(parsed.error)})`,
    );
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/**
 * Seal valid graph content into an Experience Graph envelope (content +
 * its recomputed digest). Total: invalid content yields a typed
 * `malformed-descriptor` error with flattened issue paths.
 */
export function sealExperienceGraph(content: unknown): ExperienceResult<ExperienceGraph> {
  const parsed = ExperienceGraphContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: malformedDescriptorError(parsed.error) };
  }
  return {
    ok: true,
    value: {
      ...parsed.data,
      digest: canonicalDigest(parsed.data as unknown as JsonValue),
    },
  };
}

/**
 * Verify a claimed digest against the recomputed content digest of an
 * envelope (tamper detection). Total: schema-invalid envelopes yield a
 * typed `malformed-descriptor` error; digest skew yields
 * `digest-mismatch` with expected and encountered values.
 */
export function verifyExperienceGraphDigest(
  envelope: unknown,
): ExperienceResult<ExperienceGraphContent> {
  const parsed = ExperienceGraphSchema.safeParse(envelope);
  if (!parsed.success) {
    return { ok: false, error: malformedDescriptorError(parsed.error) };
  }
  const { digest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== digest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'experience graph digest does not match its content (tampered or mismatched envelope) — the document is rejected',
        path: ['digest'],
        expected,
        encountered: digest,
      },
    };
  }
  return { ok: true, value: content };
}
