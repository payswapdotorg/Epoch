/**
 * Digest discipline for renderer-runtime documents: a binding's or
 * receipt's identity at a revision is the SHA-256 of the canonical JSON
 * serialization of its content (content addressing over the
 * runtime-neutral canonical machinery from @epoch/agent-protocol — reused,
 * never mirrored). Admission REJECTS a sealed record whose claimed digest
 * does not match the recomputed one (tamper detection).
 *
 * Determinism: canonical JSON sorts object keys, and the record schemas
 * enforce deterministic set semantics and negotiated-limit consistency,
 * so semantically equal records serialize to identical bytes and their
 * digests are stable.
 */
import {
  canonicalDigest,
  canonicalJsonStringify,
  type JsonValue,
  type Sha256Hex,
} from '@epoch/agent-protocol';
import {
  RendererBindingContentSchema,
  RendererBindingSchema,
  type RendererBinding,
  type RendererBindingContent,
} from './binding';
import {
  RendererReceiptContentSchema,
  RendererReceiptSchema,
  type RendererReceipt,
  type RendererReceiptContent,
} from './receipt';
import { malformedRecordError } from './issues';
import type { RendererRuntimeResult } from './errors';

function firstIssueMessage(error: Parameters<typeof malformedRecordError>[0]): string {
  const first = malformedRecordError(error).issues[0];
  return first ? `${first.path}: ${first.message}` : 'invalid';
}

/**
 * Deterministic serialization of a sealed renderer binding (canonical
 * JSON: sorted keys, no insignificant whitespace). Throws on an invalid
 * record — producers validate first ({@link parseRendererBinding} in
 * src/parse.ts is the total form).
 */
export function serializeRendererBinding(binding: RendererBinding): string {
  const parsed = RendererBindingSchema.safeParse(binding);
  if (!parsed.success) {
    throw new Error(`cannot serialize an invalid renderer binding (${firstIssueMessage(parsed.error)})`);
  }
  return canonicalJsonStringify(parsed.data as unknown as JsonValue);
}

/**
 * Deterministic serialization of a sealed renderer receipt. Throws on an
 * invalid receipt.
 */
export function serializeRendererReceipt(receipt: RendererReceipt): string {
  const parsed = RendererReceiptSchema.safeParse(receipt);
  if (!parsed.success) {
    throw new Error(`cannot serialize an invalid renderer receipt (${firstIssueMessage(parsed.error)})`);
  }
  return canonicalJsonStringify(parsed.data as unknown as JsonValue);
}

/**
 * Content digest of a renderer binding: the SHA-256 of the canonical JSON
 * of the CONTENT (every field except `digest` itself). Throws on invalid
 * content.
 */
export function computeRendererBindingDigest(content: RendererBindingContent): Sha256Hex {
  const parsed = RendererBindingContentSchema.safeParse(content);
  if (!parsed.success) {
    throw new Error(`cannot digest an invalid renderer binding (${firstIssueMessage(parsed.error)})`);
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/**
 * Content digest of a renderer receipt. Throws on invalid content.
 */
export function computeRendererReceiptDigest(content: RendererReceiptContent): Sha256Hex {
  const parsed = RendererReceiptContentSchema.safeParse(content);
  if (!parsed.success) {
    throw new Error(`cannot digest an invalid renderer receipt (${firstIssueMessage(parsed.error)})`);
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/**
 * Seal valid binding content into a sealed record (content + its
 * recomputed digest). Total: invalid content yields a typed
 * `malformed-record` error with flattened issue paths.
 */
export function sealRendererBinding(
  content: unknown,
): RendererRuntimeResult<RendererBinding> {
  const parsed = RendererBindingContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: malformedRecordError(parsed.error) };
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
 * Seal valid receipt content into a sealed receipt record. Total: invalid
 * content yields a typed `malformed-record` error.
 */
export function sealRendererReceipt(
  content: unknown,
): RendererRuntimeResult<RendererReceipt> {
  const parsed = RendererReceiptContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: malformedRecordError(parsed.error) };
  }
  return {
    ok: true,
    value: {
      ...parsed.data,
      digest: canonicalDigest(parsed.data as unknown as JsonValue),
    } as RendererReceipt,
  };
}

/**
 * Verify a claimed digest against the recomputed content digest of a
 * renderer binding (tamper detection). Total: schema-invalid records
 * yield a typed `malformed-record` error; digest skew yields
 * `digest-mismatch` with expected and encountered values.
 */
export function verifyRendererBindingDigest(
  binding: unknown,
): RendererRuntimeResult<RendererBindingContent> {
  const parsed = RendererBindingSchema.safeParse(binding);
  if (!parsed.success) {
    return { ok: false, error: malformedRecordError(parsed.error) };
  }
  const { digest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== digest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'renderer binding digest does not match its content (tampered or mismatched record) — the document is rejected',
        path: ['digest'],
        expected,
        encountered: digest,
      },
    };
  }
  return { ok: true, value: content };
}

/**
 * Verify a claimed digest against the recomputed content digest of a
 * renderer receipt (tamper detection). Total; see
 * {@link verifyRendererBindingDigest}.
 */
export function verifyRendererReceiptDigest(
  receipt: unknown,
): RendererRuntimeResult<RendererReceiptContent> {
  const parsed = RendererReceiptSchema.safeParse(receipt);
  if (!parsed.success) {
    return { ok: false, error: malformedRecordError(parsed.error) };
  }
  const { digest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== digest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'renderer receipt digest does not match its content (tampered or mismatched record) — the document is rejected',
        path: ['digest'],
        expected,
        encountered: digest,
      },
    };
  }
  return { ok: true, value: content as RendererReceiptContent };
}
