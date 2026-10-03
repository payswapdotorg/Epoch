/**
 * W051 (ACR-006) — the S3-compatible ObjectStore adapter tests:
 * the official AWS SigV4 documentation vector pins the signer; fetch
 * doubles exercise the full SPI surface incl. the negative battery
 * (unavailable backend, malformed payloads, digest verification,
 * cross-implementation digest alignment). Live R2 verification is
 * W053's honest-boundary work.
 */
import { describe, expect, it } from 'vitest';
import {
  createS3ObjectStore,
  S3BackendUnavailableError,
  S3ObjectStore,
  signS3Request,
} from '../src/index';
import { InMemoryObjectStore, digestOfBytes, type ObjectStore } from '@epoch/object-storage';
import type { Sha256Hex } from '@epoch/agent-protocol';

const CONFIG = {
  endpoint: 'https://account.r2.cloudflarestorage.com',
  bucket: 'epoch-evidence',
  accessKeyId: 'test-access-key',
  secretAccessKey: 'test-secret-key',
  region: 'auto',
};

const FIXED_CLOCK = () => new Date('2026-10-02T01:02:03.000Z');

describe('signS3Request (the AWS SigV4 signer)', () => {
  it('reproduces the OFFICIAL AWS documentation signature vector (GET Object with Range)', () => {
    // https://docs.aws.amazon.com/AmazonS3/latest/API/sig-v4-header-based-auth.html
    // (virtual-hosted style: bucket in the host, /test.txt in the URI).
    const signed = signS3Request({
      method: 'GET',
      canonicalUri: '/test.txt',
      canonicalQuery: '',
      host: 'examplebucket.s3.amazonaws.com',
      headers: { range: 'bytes=0-9' },
      payloadSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      region: 'us-east-1',
      amzDate: '20130524T000000Z',
    });
    expect(signed.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, ' +
        'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, ' +
        'Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
  });

  it('is deterministic for identical inputs (same signature every time)', () => {
    const input = {
      method: 'PUT' as const,
      canonicalUri: '/bucket/objects/abc',
      canonicalQuery: '',
      host: 'account.r2.cloudflarestorage.com',
      payloadSha256: 'a'.repeat(64),
      accessKeyId: 'k',
      secretAccessKey: 's',
      region: 'auto',
      amzDate: '20261002T010203Z',
    };
    expect(signS3Request(input).authorization).toBe(signS3Request(input).authorization);
  });

  it('constructs the x-amz-date header in the exact SigV4 wire format (single trailing Z)', async () => {
    // ACR-006 post-credential live regression: the s3() construction site
    // appended a second Z to the ISO string ("…T010203ZZ") — every real
    // S3/R2 endpoint rejects that with SignatureDoesNotMatch (found live
    // against R2; the AWS vector test above passes an explicit amzDate and
    // never covered the construction). This pins the EMITTED header of a
    // real request through the store's own clock.
    const seen: string[] = [];
    const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      seen.push(String(headers['x-amz-date']));
      return new Response(new Uint8Array(0), { status: 200 });
    }) as unknown as typeof fetch;
    const store = createS3ObjectStore({ ...CONFIG, fetchImpl, clock: FIXED_CLOCK });
    const outcome = await store.put(new Uint8Array(3), {
      schemaVersion: 1,
      kind: 'evidence-artifact',
      tenantId: 'tenant:t',
      label: 'regression',
      storedAt: '2026-10-02T01:02:03.000Z',
    });
    expect(outcome.ok).toBe(true);
    expect(seen.length).toBeGreaterThan(0);
    for (const date of seen) {
      // Exactly the SigV4 wire format: YYYYMMDD'T'HHMMSS'Z' — one Z.
      expect(date).toMatch(/^\d{8}T\d{6}Z$/);
      expect(date.endsWith('ZZ')).toBe(false);
    }
    expect(seen[0]).toBe('20261002T010203Z');
  });
});

/** An in-bucket S3 fetch double (path-style; stores bytes + meta by URL). */
function s3Double(options: {
  readonly failWith?: 'network' | 'status500' | 'malformedMeta' | 'garbageListings' | 'status403';
} = {}) {
  const store = new Map<string, { readonly body: Uint8Array; readonly contentType: string }>();
  const requests: Array<{ readonly method: string; readonly url: string; readonly authorization: string }> = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = new URL(String(url));
    requests.push({
      method: init?.method ?? 'GET',
      url: String(url),
      authorization: String((init?.headers as Record<string, string>)?.['Authorization'] ?? ''),
    });
    if (options.failWith === 'network') throw new Error('connection refused');
    if (options.failWith === 'status500') return new Response('boom', { status: 500 });
    if (options.failWith === 'status403') {
      return new Response(
        '<?xml version="1.0"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>',
        { status: 403 },
      );
    }
    if (target.searchParams.get('list-type') === '2') {
      if (options.failWith === 'garbageListings') {
        // A 200 whose body is NOT ListBucketResult XML (an HTML error page
        // from a broken proxy, truncated XML, garbage — the R2/HTTP reality).
        return new Response('<html><body><h1>502 Bad Gateway</h1></body></html>', { status: 200 });
      }
      const prefix = target.searchParams.get('prefix') ?? '';
      const keys = [...store.keys()].filter((key) => key.startsWith(prefix)).sort();
      const xml =
        '<?xml version="1.0" encoding="UTF-8"?><ListBucketResult>' +
        keys.map((key) => `<Contents><Key>${key}</Key><Size>${store.get(key)!.body.length}</Size></Contents>`).join('') +
        '<IsTruncated>false</IsTruncated></ListBucketResult>';
      return new Response(xml, { status: 200 });
    }
    const path = target.pathname.replace(/^\/epoch-evidence\//, '');
    if (init?.method === 'PUT') {
      const body = new Uint8Array(await new Response(init.body).arrayBuffer());
      store.set(path, { body, contentType: 'application/octet-stream' });
      return new Response(null, { status: 200 });
    }
    if (init?.method === 'HEAD') {
      return store.has(path) ? new Response(null, { status: 200 }) : new Response(null, { status: 404 });
    }
    const entry = store.get(path);
    if (entry === undefined) return new Response('NoSuchKey', { status: 404 });
    if (options.failWith === 'malformedMeta' && path.includes('meta/')) {
      return new Response('not json at all', { status: 200 });
    }
    return new Response(entry.body, { status: 200 });
  }) as typeof fetch;
  return { store, requests, fetchImpl };
}

const METADATA = {
  schemaVersion: 1 as const,
  kind: 'evidence-artifact' as const,
  tenantId: 'tenant:nordstrand',
  label: 'field capture',
  storedAt: '2026-03-02T13:00:00.000Z',
};

const BYTES = new TextEncoder().encode('epoch production evidence bytes');

describe('S3ObjectStore (the SPI over the S3 double)', () => {
  it('put → get round trip: digest-verified, metadata sidecar, byte-identical', async () => {
    const double = s3Double();
    const store = createS3ObjectStore({ ...CONFIG, fetchImpl: double.fetchImpl, clock: FIXED_CLOCK });
    const put = await store.put(BYTES, METADATA);
    expect(put.ok).toBe(true);
    if (put.ok) {
      expect(put.value.digest).toBe(digestOfBytes(BYTES));
      expect(put.value.size).toBe(BYTES.length);
    }
    const digest = digestOfBytes(BYTES);
    const got = await store.get(digest);
    expect(got.ok).toBe(true);
    if (got.ok && got.value !== null) {
      expect(got.value.bytes).toEqual(BYTES);
      expect(got.value.ref.metadata).toEqual(METADATA);
      expect(got.value.ref.digest).toBe(digest);
    }
    // Two S3 puts happened: bytes + metadata sidecar.
    expect(double.requests.filter((r) => r.method === 'PUT').length).toBe(2);
    // Every request carries the SigV4 Authorization header.
    expect(double.requests.every((r) => r.authorization.startsWith('AWS4-HMAC-SHA256 '))).toBe(true);
  });

  it('digest alignment: SAME digests as the in-memory reference (portable addressing)', async () => {
    const memory = new InMemoryObjectStore();
    const inMemoryRef = await memory.put(BYTES, METADATA);
    const double = s3Double();
    const s3 = createS3ObjectStore({ ...CONFIG, fetchImpl: double.fetchImpl, clock: FIXED_CLOCK });
    const s3Ref = await s3.put(BYTES, METADATA);
    expect(inMemoryRef.ok && s3Ref.ok && inMemoryRef.value.digest === s3Ref.value.digest).toBe(true);
  });

  it('get of a missing digest is typed null (never an error, never fake bytes)', async () => {
    const double = s3Double();
    const store = createS3ObjectStore({ ...CONFIG, fetchImpl: double.fetchImpl, clock: FIXED_CLOCK });
    const missing = 'a'.repeat(64) as Sha256Hex;
    const got = await store.get(missing);
    expect(got).toEqual({ ok: true, value: null });
  });

  it('has(): present true, absent false', async () => {
    const double = s3Double();
    const store = createS3ObjectStore({ ...CONFIG, fetchImpl: double.fetchImpl, clock: FIXED_CLOCK });
    const digest = digestOfBytes(BYTES);
    expect(await store.has(digest)).toBe(false);
    await store.put(BYTES, METADATA);
    expect(await store.has(digest)).toBe(true);
  });

  it('put is idempotent by digest (re-put returns the SAME reference)', async () => {
    const double = s3Double();
    const store = createS3ObjectStore({ ...CONFIG, fetchImpl: double.fetchImpl, clock: FIXED_CLOCK });
    const first = await store.put(BYTES, METADATA);
    const second = await store.put(BYTES, METADATA);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.value.digest).toBe(first.value.digest);
      expect(second.value.size).toBe(first.value.size);
    }
  });

  it('list() and size() reflect stored objects (digest-sorted)', async () => {
    const double = s3Double();
    const store = createS3ObjectStore({ ...CONFIG, fetchImpl: double.fetchImpl, clock: FIXED_CLOCK });
    await store.put(BYTES, METADATA);
    await store.put(new TextEncoder().encode('second object'), { ...METADATA, label: 'second' });
    const refs = await store.list();
    expect(refs.length).toBe(2);
    expect(refs[0]!.digest < refs[1]!.digest).toBe(true);
    expect(await store.size()).toBe(2);
  });

  it('NEGATIVE: unavailable backend → typed unavailable (put), null-safe get, honest has, typed list throw', async () => {
    const networkDown = createS3ObjectStore({ ...CONFIG, fetchImpl: s3Double({ failWith: 'network' }).fetchImpl, clock: FIXED_CLOCK });
    const putResult = await networkDown.put(BYTES, METADATA);
    expect(putResult.ok).toBe(false);
    if (!putResult.ok) expect(putResult.error.code).toBe('unavailable');
    const getResult = await networkDown.get(digestOfBytes(BYTES));
    expect(getResult.ok).toBe(false);
    if (!getResult.ok) expect(getResult.error.code).toBe('unavailable');
    expect(await networkDown.has(digestOfBytes(BYTES))).toBe(false);
    await expect(networkDown.list()).rejects.toBeInstanceOf(S3BackendUnavailableError);
  });

  it('NEGATIVE: 5xx provider response → typed unavailable (never a raw error)', async () => {
    const store = createS3ObjectStore({ ...CONFIG, fetchImpl: s3Double({ failWith: 'status500' }).fetchImpl, clock: FIXED_CLOCK });
    const result = await store.put(BYTES, METADATA);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unavailable');
  });

  it('NEGATIVE: tampered bytes behind a digest → typed digest-mismatch on retrieval', async () => {
    const double = s3Double();
    const store = createS3ObjectStore({ ...CONFIG, fetchImpl: double.fetchImpl, clock: FIXED_CLOCK });
    await store.put(BYTES, METADATA);
    // Tamper with the stored bytes behind the digest address.
    const digest = digestOfBytes(BYTES);
    double.store.set(`objects/${digest}`, {
      body: new TextEncoder().encode('tampered'),
      contentType: 'application/octet-stream',
    });
    const got = await store.get(digest);
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.code).toBe('digest-mismatch');
  });

  it('NEGATIVE: malformed metadata sidecar → typed failures (never fake metadata, never thrown raw)', async () => {
    const double = s3Double();
    const store = createS3ObjectStore({ ...CONFIG, fetchImpl: double.fetchImpl, clock: FIXED_CLOCK });
    await store.put(BYTES, METADATA);
    const digest = digestOfBytes(BYTES);
    double.store.set(`meta/${digest}.json`, {
      body: new TextEncoder().encode('<not-json'),
      contentType: 'application/json',
    });
    const got = await store.get(digest);
    expect(got.ok).toBe(false);
    if (!got.ok) {
      expect(got.error.code === 'unavailable' || got.error.code === 'validation').toBe(true);
    }
  });

  it('NEGATIVE: invalid metadata is rejected before any network call', async () => {
    const double = s3Double();
    const store = createS3ObjectStore({ ...CONFIG, fetchImpl: double.fetchImpl, clock: FIXED_CLOCK });
    const bad = await store.put(BYTES, { ...METADATA, kind: 'vendor-specific' as never });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('validation');
    expect(double.requests.length).toBe(0);
  });

  it('validates its configuration (fail-fast, no network)', () => {
    expect(() => new S3ObjectStore({ ...CONFIG, endpoint: 'ftp://x' })).toThrow();
    expect(() => new S3ObjectStore({ ...CONFIG, bucket: '' })).toThrow();
    expect(() => new S3ObjectStore({ ...CONFIG, accessKeyId: '' })).toThrow();
  });

  it('NEGATIVE: invalid credentials (403 AccessDenied) → typed unavailable, never a raw provider XML error', async () => {
    const store = createS3ObjectStore({
      ...CONFIG,
      fetchImpl: s3Double({ failWith: 'status403' }).fetchImpl,
      clock: FIXED_CLOCK,
    });
    const put = await store.put(BYTES, METADATA);
    expect(put.ok).toBe(false);
    if (!put.ok) {
      expect(put.error.code).toBe('unavailable');
      // The provider's XML error body never crosses the SPI boundary.
      expect(put.error.message).not.toContain('<Error>');
      expect(put.error.message).not.toContain('AccessDenied');
    }
    const got = await store.get(digestOfBytes(BYTES));
    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.code).toBe('unavailable');
  });

  it('NEGATIVE: malformed R2 listing payload (200 + non-XML garbage) → typed failure, never a silent empty list', async () => {
    const double = s3Double({ failWith: 'garbageListings' });
    const store = createS3ObjectStore({ ...CONFIG, fetchImpl: double.fetchImpl, clock: FIXED_CLOCK });
    // The garbage-listing backend: list()/size() must fail TYPED — an
    // empty listing would be a silent success on a malformed response.
    await expect(store.list()).rejects.toBeInstanceOf(S3BackendUnavailableError);
    await expect(store.list()).rejects.toThrow(/malformed provider payload/);
    await expect(store.size()).rejects.toBeInstanceOf(S3BackendUnavailableError);
    // The put/get paths are unaffected (they never parse listing XML).
    const put = await store.put(BYTES, METADATA);
    expect(put.ok).toBe(true);
  });

  it('NEGATIVE: truncated XML listing (missing root close) with valid prefix → typed failure or honest entries, never a lie', async () => {
    // A body that HAS <ListBucketResult> but is truncated mid-entry: the
    // regex extraction still yields well-formed <Key> entries only; a
    // truncated entry contributes nothing (no fabricated keys).
    const truncated =
      '<?xml version="1.0"?><ListBucketResult><Contents><Key>meta/abc</Key></Contents><Contents><Key>meta/def';
    const store = createS3ObjectStore({
      ...CONFIG,
      fetchImpl: (async () => new Response(truncated, { status: 200 })) as typeof fetch,
      clock: FIXED_CLOCK,
    });
    const refs = await store.list();
    expect(refs.length).toBe(0); // 'meta/abc' is not a digest key → skipped; nothing fabricated
  });

  it('key prefix support (multi-tenant bucket namespaces)', async () => {
    const double = s3Double();
    const store = createS3ObjectStore({ ...CONFIG, keyPrefix: 'epoch/', fetchImpl: double.fetchImpl, clock: FIXED_CLOCK });
    await store.put(BYTES, METADATA);
    expect(double.store.has(`epoch/objects/${digestOfBytes(BYTES)}`)).toBe(true);
    expect(double.store.has(`epoch/meta/${digestOfBytes(BYTES)}.json`)).toBe(true);
  });
});

/** Compile-time SPI conformance: the adapter IS an ObjectStore. */
const typecheck: ObjectStore = createS3ObjectStore(CONFIG);
void typecheck;
