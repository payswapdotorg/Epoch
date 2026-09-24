/**
 * Digest discipline for verification chains: a chain's identity is the
 * SHA-256 of its canonical JSON serialization (content addressing over the
 * runtime-neutral canonical machinery from @epoch/agent-protocol), so the
 * exact revision of a whole verification chain can be referenced as
 * evidence of verification.
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { VerificationChainSchema } from './schema';
import type { VerificationChain } from './types';

/** Thrown only on programming errors (invalid chains have no canonical form). */
export class VerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VerificationError';
  }
}

/**
 * Content-addressed identity of a verification chain: the SHA-256 of its
 * canonical JSON serialization. Validates defensively first.
 */
export function computeChainDigest(chain: VerificationChain): Sha256Hex {
  const parsed = VerificationChainSchema.safeParse(chain);
  if (!parsed.success) {
    throw new VerificationError(
      `cannot digest an invalid verification chain (${parsed.error.issues[0]?.path.join('.') ?? '?'}: ${
        parsed.error.issues[0]?.message ?? 'invalid'
      })`,
    );
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}
