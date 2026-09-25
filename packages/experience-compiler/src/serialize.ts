/**
 * Digest discipline for Render Plans: a plan's identity at a revision is
 * the SHA-256 of the canonical JSON serialization of its content
 * (content addressing over the runtime-neutral canonical machinery from
 * @epoch/agent-protocol — reused, never mirrored). Admission REJECTS a
 * sealed plan whose claimed digest does not match the recomputed one
 * (tamper detection).
 *
 * The digest chain: the plan content embeds `sourceEnvelopeDigest` (the
 * W011 graph's sealed digest), so the plan digest addresses both the
 * compiled form AND the exact envelope revision it compiled from —
 * envelope digest -> plan digest.
 *
 * Determinism: canonical JSON sorts object keys, and the plan schemas
 * enforce canonical stage/Op ordering, so semantically equal plans
 * serialize to identical bytes and their digests are stable.
 */
import { canonicalDigest, canonicalJsonStringify, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { RenderPlanContentSchema, RenderPlanSchema, type RenderPlan, type RenderPlanContent } from './plan';
import { malformedDescriptorError } from './issues';
import type { CompilerError, CompilerResult } from './errors';

function firstIssueMessage(error: Parameters<typeof malformedDescriptorError>[0]): string {
  const first = malformedDescriptorError(error).issues[0];
  return first ? `${first.path}: ${first.message}` : 'invalid';
}

/**
 * Deterministic serialization of a sealed Render Plan envelope (canonical
 * JSON: sorted keys, no insignificant whitespace). Throws on an invalid
 * plan — producers validate first ({@link parseRenderPlan} in
 * src/parse.ts is the total form).
 */
export function serializeRenderPlan(plan: RenderPlan): string {
  const parsed = RenderPlanSchema.safeParse(plan);
  if (!parsed.success) {
    throw new Error(`cannot serialize an invalid render plan (${firstIssueMessage(parsed.error)})`);
  }
  return canonicalJsonStringify(parsed.data as unknown as JsonValue);
}

/**
 * Content digest of a Render Plan: the SHA-256 of the canonical JSON of
 * the CONTENT (every field except `digest` itself). Throws on invalid
 * content.
 */
export function computeRenderPlanDigest(content: RenderPlanContent): Sha256Hex {
  const parsed = RenderPlanContentSchema.safeParse(content);
  if (!parsed.success) {
    throw new Error(`cannot digest an invalid render plan (${firstIssueMessage(parsed.error)})`);
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/**
 * Seal valid plan content into a Render Plan envelope (content + its
 * recomputed digest). Total: invalid content yields a typed
 * `malformed-descriptor` error with flattened issue paths.
 */
export function sealRenderPlan(content: unknown): CompilerResult<RenderPlan> {
  const parsed = RenderPlanContentSchema.safeParse(content);
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
 * Verify a claimed digest against the recomputed content digest of a
 * sealed plan (tamper detection). Total: schema-invalid plans yield a
 * typed `malformed-descriptor` error; digest skew yields
 * `digest-mismatch` with expected and encountered values.
 */
export function verifyRenderPlanDigest(envelope: unknown): CompilerResult<RenderPlanContent> {
  const parsed = RenderPlanSchema.safeParse(envelope);
  if (!parsed.success) {
    return { ok: false, error: malformedDescriptorError(parsed.error) };
  }
  const { digest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== digest) {
    const mismatch: CompilerError = {
      code: 'digest-mismatch',
      message:
        'render plan digest does not match its content (tampered or mismatched envelope) — the document is rejected',
      path: ['digest'],
      expected,
      encountered: digest,
    };
    return { ok: false, error: mismatch };
  }
  return { ok: true, value: content };
}

/**
 * The plan digest chain as data: the envelope digest the plan compiled
 * from and the plan digest that content-addresses the compiled form.
 * The chain is total evidence — the plan digest covers the
 * `sourceEnvelopeDigest` because it is part of the digested content.
 */
export function planDigestChain(plan: RenderPlan): {
  readonly sourceEnvelopeDigest: Sha256Hex;
  readonly planDigest: Sha256Hex;
} {
  return { sourceEnvelopeDigest: plan.sourceEnvelopeDigest, planDigest: plan.digest };
}
