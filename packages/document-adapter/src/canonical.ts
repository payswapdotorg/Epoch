/**
 * Canonical document bytes and digest discipline.
 *
 * A document is TYPED BYTES: exactly one canonical byte form per supported
 * format, so a document's SHA-256 digest addresses its exact revision the
 * same way every other Epoch contract addresses content
 * (agent-protocol canonical machinery, runtime-neutral):
 *
 * - `structured-text` — the UTF-8 text itself (byte-for-byte);
 * - `structured-json` — the canonical JSON serialization (sorted keys, no
 *   insignificant whitespace), so equivalent JSON values always produce
 *   identical bytes and identical digests.
 *
 * `byteLength` is the UTF-8 byte length of the canonical form. The
 * document's opaque artifact identity is derived from its digest
 * (`doc:<sha256>`), so the exact-revision subject of every evidence record
 * and the artifact id can never disagree.
 */
import { canonicalJsonStringify, sha256Hex, type Sha256Hex } from '@epoch/agent-protocol';
import type { DocumentContent, DocumentDescriptor, DocumentId, TenantScope } from './types';

/** The canonical byte form of a document (one per format; deterministic). */
export function canonicalDocumentBytes(content: DocumentContent): string {
  return content.format === 'structured-text'
    ? content.text
    : canonicalJsonStringify(content.json);
}

/** SHA-256 of the canonical bytes — the document's exact-revision address. */
export function computeDocumentDigest(content: DocumentContent): Sha256Hex {
  return sha256Hex(canonicalDocumentBytes(content));
}

/** UTF-8 byte length of the canonical bytes. */
export function canonicalByteLength(content: DocumentContent): number {
  return utf8Length(canonicalDocumentBytes(content));
}

/** Opaque document artifact identity derived from the content address. */
export function documentArtifactId(digest: Sha256Hex): DocumentId {
  return `doc:${digest}`;
}

/** The exact-revision revision label of a content-addressed document. */
export const DOCUMENT_REVISION_LABEL = '1' as const;

const ENCODER = new TextEncoder();

function utf8Length(value: string): number {
  return ENCODER.encode(value).length;
}

/**
 * Derive the well-formed descriptor for a document: the digest and byte
 * length are COMPUTED from the content (never claimed by the caller), so
 * a descriptor built here always describes its exact revision.
 */
export function deriveDocumentDescriptor(
  content: DocumentContent,
  tenantScope: TenantScope,
): DocumentDescriptor {
  const digest = computeDocumentDigest(content);
  return {
    schemaVersion: 1,
    tenantScope,
    digest,
    format: content.format,
    byteLength: canonicalByteLength(content),
  };
}
