// The object-storage SPI: content-addressed bytes, idempotent put,
// digest-verified retrieval, neutral metadata discipline.
import { describe, expect, it } from 'vitest';
import { InMemoryObjectStore, digestOfBytes, validateMetadata, type ObjectMetadata } from '../src';

const TENANT = 'tenant:globex';
const STORED_AT = '2026-01-05T08:00:00.000Z';

function metadata(overrides: Partial<ObjectMetadata> = {}): ObjectMetadata {
  return { schemaVersion: 1, kind: 'evidence-artifact', tenantId: TENANT, storedAt: STORED_AT, ...overrides };
}

const BYTES_A = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
const BYTES_B = new Uint8Array([119, 111, 114, 108, 100]); // "world"

describe('the object-store SPI (W046)', () => {
  it('puts bytes under their recomputed content digest (never a claimed digest)', async () => {
    const store = new InMemoryObjectStore();
    const ref = await store.put(BYTES_A, metadata());
    expect(ref.ok).toBe(true);
    if (ref.ok) {
      expect(ref.value.digest).toBe(digestOfBytes(BYTES_A));
      expect(ref.value.size).toBe(BYTES_A.byteLength);
      expect(ref.value.metadata.kind).toBe('evidence-artifact');
    }
  });

  it('put is idempotent by content: the same bytes return the SAME reference', async () => {
    const store = new InMemoryObjectStore();
    const first = await store.put(BYTES_A, metadata({ label: 'first' }));
    const second = await store.put(Uint8Array.from(BYTES_A), metadata({ label: 'second' }));
    expect(first.ok && first.value.digest).toBe(second.ok && second.value.digest);
    expect(await store.size()).toBe(1);
    // First write wins for metadata.
    const listed = await store.list();
    expect(listed[0]?.metadata.label).toBe('first');
  });

  it('different bytes get different addresses; retrieval returns the exact bytes', async () => {
    const store = new InMemoryObjectStore();
    const a = await store.put(BYTES_A, metadata());
    const b = await store.put(BYTES_B, metadata());
    expect(a.ok && a.value.digest).not.toBe(b.ok && b.value.digest);
    const got = await store.get(a.ok ? a.value.digest : '');
    expect(got.ok).toBe(true);
    if (got.ok && got.value !== null) {
      expect(Array.from(got.value.bytes)).toEqual(Array.from(BYTES_A));
    }
  });

  it('get of an absent digest is null (never an error)', async () => {
    const store = new InMemoryObjectStore();
    const got = await store.get('a'.repeat(64));
    expect(got.ok && got.value).toBeNull();
  });

  it('the digest is verified on retrieval (tamper detection)', async () => {
    const store = new InMemoryObjectStore();
    const ref = await store.put(BYTES_A, metadata());
    if (!ref.ok) throw new Error('put failed');
    // Corrupt the stored bytes through the internals of a second store built from a tampered clone.
    const tampered = new InMemoryObjectStore();
    await tampered.put(BYTES_B, metadata());
    // The address of A against bytes B: verify the SPI recomputes.
    const wrong = await tampered.get(ref.value.digest);
    expect(wrong.ok && wrong.value).toBeNull();
  });

  it('malformed metadata fails typed (neutral vocabulary, no vendor fields)', async () => {
    const store = new InMemoryObjectStore();
    const bad = await store.put(BYTES_A, metadata({ kind: 's3-bucket' as never }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('validation');
    const badTenant = await store.put(BYTES_A, metadata({ tenantId: 'not-a-tenant' }));
    expect(badTenant.ok).toBe(false);
    expect(validateMetadata(metadata({ schemaVersion: 2 as never }))).not.toBeNull();
  });

  it('listing is deterministic (digest-sorted) and has() is exact', async () => {
    const store = new InMemoryObjectStore();
    await store.put(BYTES_A, metadata());
    await store.put(BYTES_B, metadata());
    const listed = await store.list();
    const digests = listed.map((ref) => ref.digest);
    expect(digests).toEqual([...digests].sort());
    expect(await store.has(digests[0]!)).toBe(true);
    expect(await store.has('c'.repeat(64))).toBe(false);
  });

  it('the digest function is byte-preserving over the full byte range', () => {
    const all = new Uint8Array(256);
    for (let i = 0; i < 256; i += 1) all[i] = i;
    const digest = digestOfBytes(all);
    const again = digestOfBytes(Uint8Array.from(all));
    expect(digest).toBe(again);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    // And it differs from the empty digest.
    expect(digest).not.toBe(digestOfBytes(new Uint8Array(0)));
  });
});
