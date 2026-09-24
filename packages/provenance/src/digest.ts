/**
 * Digest discipline for provenance graphs: a graph's identity is the SHA-256
 * of its canonical JSON serialization (content addressing over the
 * runtime-neutral canonical machinery from @epoch/agent-protocol), so an
 * exact graph revision can be referenced from evidence or verification
 * records without ambiguity.
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { ProvenanceGraphSchema } from './schema';
import type { ProvenanceGraph } from './types';

/** Thrown only on programming errors (invalid graphs have no canonical form). */
export class ProvenanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProvenanceError';
  }
}

/**
 * Content-addressed identity of a provenance graph: the SHA-256 of its
 * canonical JSON serialization. Validates defensively first.
 */
export function computeProvenanceDigest(graph: ProvenanceGraph): Sha256Hex {
  const parsed = ProvenanceGraphSchema.safeParse(graph);
  if (!parsed.success) {
    throw new ProvenanceError(
      `cannot digest an invalid provenance graph (${parsed.error.issues[0]?.path.join('.') ?? '?'}: ${
        parsed.error.issues[0]?.message ?? 'invalid'
      })`,
    );
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}
