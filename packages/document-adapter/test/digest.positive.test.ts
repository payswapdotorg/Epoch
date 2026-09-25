// Document digest round-trip (positive): canonical bytes, content
// addressing, descriptor derivation, and admission of the exact revision.
// The kernel SHA-256 is cross-checked against node:crypto over the exact
// canonical byte forms (W001-style evidence discipline).
import { describe, expect, it } from 'vitest';
import { canonicalJsonStringify, canonicalDigest, sha256Hex, type JsonValue } from '@epoch/agent-protocol';
import {
  DOCUMENT_FORMAT_MEDIA_TYPES,
  canonicalDocumentBytes,
  computeDocumentDigest,
  documentArtifactId,
  admitDocumentContent,
  admitDocumentDescriptor,
  parseDocument,
} from '../src/index';
import { JSON_DOCUMENT, TEXT_DOCUMENT, jsonFixture, nodeCryptoSha256, textFixture } from './fixtures';
import type { DocumentContent } from '../src/index';

describe('canonical document bytes + digest round-trip (positive)', () => {
  it('structured-text canonical bytes are the exact UTF-8 text', () => {
    const content: DocumentContent = { format: 'structured-text', text: TEXT_DOCUMENT };
    expect(canonicalDocumentBytes(content)).toBe(TEXT_DOCUMENT);
    expect(computeDocumentDigest(content)).toBe(nodeCryptoSha256(TEXT_DOCUMENT));
  });

  it('structured-json canonical bytes are the canonical JSON form (key order irrelevant)', () => {
    const object = JSON_DOCUMENT as { [key: string]: JsonValue };
    const reordered: DocumentContent = {
      format: 'structured-json',
      json: { mappings: object['mappings'], documentKind: 'mapping-table' },
    };
    const a = jsonFixture().content;
    expect(canonicalDocumentBytes(reordered)).toBe(canonicalDocumentBytes(a));
    expect(computeDocumentDigest(reordered)).toBe(computeDocumentDigest(a));
    expect(computeDocumentDigest(a)).toBe(
      nodeCryptoSha256(canonicalJsonStringify(JSON_DOCUMENT)),
    );
  });

  it('the kernel SHA-256 matches node:crypto over deterministic inputs', () => {
    for (const input of ['', 'a', TEXT_DOCUMENT, canonicalJsonStringify(JSON_DOCUMENT)]) {
      expect(sha256Hex(input)).toBe(nodeCryptoSha256(input));
    }
  });

  it('the derived descriptor addresses the exact revision (digest + byte length + format)', () => {
    const { content, descriptor } = textFixture();
    expect(descriptor.digest).toBe(computeDocumentDigest(content));
    expect(descriptor.byteLength).toBe(Buffer.byteLength(TEXT_DOCUMENT, 'utf8'));
    expect(descriptor.format).toBe('structured-text');
    expect(descriptor.tenantScope.tenantId).toBe('tenant:alpha');
    expect(descriptor.schemaVersion).toBe(1);
  });

  it('document artifact ids are derived from the content address', () => {
    const { content, descriptor } = jsonFixture();
    expect(documentArtifactId(descriptor.digest)).toBe(`doc:${descriptor.digest}`);
    expect(documentArtifactId(computeDocumentDigest(content))).toBe(`doc:${descriptor.digest}`);
  });

  it('the media types of the typed forms are the neutral canonical ones', () => {
    expect(DOCUMENT_FORMAT_MEDIA_TYPES['structured-text']).toBe('text/plain');
    expect(DOCUMENT_FORMAT_MEDIA_TYPES['structured-json']).toBe('application/json');
  });

  it('the descriptor round-trips through admission (content + descriptor re-admit cleanly)', () => {
    const { content, descriptor } = jsonFixture();
    const admitted = admitDocumentContent(content);
    expect(admitted.ok).toBe(true);
    const reAdmitted = admitDocumentDescriptor(descriptor);
    expect(reAdmitted.ok).toBe(true);
    if (!reAdmitted.ok || !admitted.ok) return;
    const parsed = parseDocument(admitted.value, reAdmitted.value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.descriptor).toEqual(descriptor);
    expect(parsed.value.rows).toHaveLength(2);
  });

  it('canonical digests of equivalent JSON are equal regardless of key insertion order', () => {
    const first = canonicalDigest({ b: 2, a: 1 });
    const second = canonicalDigest({ a: 1, b: 2 });
    expect(first).toBe(second);
  });

  it('two different documents never share a digest (content addressing)', () => {
    const one = computeDocumentDigest({ format: 'structured-text', text: 'a -> x:y' });
    const two = computeDocumentDigest({ format: 'structured-text', text: 'b -> x:y' });
    expect(one).not.toBe(two);
  });
});
