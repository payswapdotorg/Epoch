/**
 * @epoch/adapter-s3-object-store — the S3-compatible ObjectStore (W051,
 * ACR-006).
 *
 * Implements the FROZEN @epoch/object-storage `ObjectStore` SPI
 * (put/get/has/list/size) over any S3-compatible endpoint — Cloudflare
 * R2 is the production target; AWS S3/MinIO/Backblaze B2 work by
 * endpoint change (provider portability, spec/deployment-architecture).
 *
 * Digest addressing stays authoritative IN THE SPI: digests are
 * recomputed server-side (`digestOfBytes` — the same addressing as the
 * in-memory reference, so digests are portable across implementations);
 * claimed digests are never trusted; retrieval is digest-verified.
 *
 * Layout (the bucket is a dumb byte store; Epoch owns the semantics):
 *  - bytes:   `<prefix>objects/<sha256hex>`   (application/octet-stream)
 *  - metadata: `<prefix>meta/<sha256hex>.json` (the neutral ObjectRef
 *    record as canonical JSON — S3 listings do not return user
 *    metadata, so the sidecar is the single metadata source).
 *
 * AWS SigV4 request signing with node:crypto + the platform fetch —
 * ZERO new dependencies. The signer is pinned by the official AWS
 * documentation signature vector (test/sigv4-vectors.test.ts).
 *
 * Failure discipline (spec/production-environment.md): infrastructure
 * failures (timeout, network, non-2xx, malformed provider payloads)
 * return the typed `unavailable` error (the W051 additive seam code) —
 * never raw provider errors, never thrown. Missing bytes are typed
 * `object-not-found`. Digest mismatches are typed `digest-mismatch`.
 * `has()` answers false when the backend is unavailable (the SPI's
 * boolean contract; put/get stay the authoritative paths).
 */
import { createHash, createHmac } from 'node:crypto';
import {
  digestOfBytes,
  OBJECT_KINDS,
  type ObjectMetadata,
  type ObjectRef,
  type ObjectStorageError,
  type ObjectStorageResult,
  type ObjectStore,
  type StoredObject,
} from '@epoch/object-storage';
import type { Sha256Hex, Timestamp } from '@epoch/agent-protocol';

/** The adapter contract version (the frozen SPI it implements). */
export const S3_OBJECT_STORE_ADAPTER_VERSION = '1.0.0' as const;

/** Configuration of the S3-compatible store. */
export interface S3ObjectStoreConfig {
  /** The endpoint base (R2: https://<account>.r2.cloudflarestorage.com). */
  readonly endpoint: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  /** Region for SigV4 (R2: `auto`). */
  readonly region: string;
  /** Key prefix inside the bucket (default: the bucket root). */
  readonly keyPrefix?: string | undefined;
  /** Injectable fetch (tests); defaults to the platform fetch. */
  readonly fetchImpl?: typeof fetch | undefined;
  /** Injectable clock for x-amz-date (tests pin signatures). */
  readonly clock?: (() => Date) | undefined;
  /** Request timeout milliseconds (default 5000). */
  readonly timeoutMs?: number | undefined;
}

/** The injectable fetch port. */
export type FetchLike = typeof fetch;

// ---------------------------------------------------------------------------
// AWS Signature Version 4 (S3): pure functions over node:crypto.
// ---------------------------------------------------------------------------

function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key: string | Uint8Array, data: string): Uint8Array {
  return createHmac('sha256', key).update(data).digest();
}

/** RFC 3986 encoding of one URI segment (S3 canonical URI encoding). */
function encodeSegment(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** The SigV4 signing key derivation. */
export function s3SigningKey(secretAccessKey: string, date: string, region: string): Uint8Array {
  let key: Uint8Array = hmac(`AWS4${secretAccessKey}`, date);
  key = hmac(key, region);
  key = hmac(key, 's3');
  return hmac(key, 'aws4_request');
}

/** The signed request (the Authorization header + the amz date). */
export interface SignedRequest {
  readonly authorization: string;
  readonly amzDate: string;
}

/**
 * Sign one S3 request (path-style addressing). `headers` must include
 * host; x-amz-date/x-amz-content-sha256 are added here. Pinned by the
 * official AWS documentation signature vector in the test battery.
 */
export function signS3Request(input: {
  readonly method: string;
  /** Path-style path: /<bucket>/<key> (already segment-encoded). */
  readonly canonicalUri: string;
  /** Sorted, RFC3986-encoded query string (may be empty). */
  readonly canonicalQuery: string;
  readonly host: string;
  readonly headers?: Readonly<Record<string, string>> | undefined;
  readonly payloadSha256: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly region: string;
  readonly amzDate: string;
}): SignedRequest {
  const allHeaders: Record<string, string> = {
    ...(input.headers ?? {}),
    host: input.host,
    'x-amz-content-sha256': input.payloadSha256,
    'x-amz-date': input.amzDate,
  };
  const sortedNames = Object.keys(allHeaders).sort();
  const canonicalHeaders = sortedNames.map((name) => `${name}:${allHeaders[name]!.trim()}\n`).join('');
  const signedHeaders = sortedNames.join(';');
  const canonicalRequest = [
    input.method,
    input.canonicalUri,
    input.canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    input.payloadSha256,
  ].join('\n');
  const date = input.amzDate.slice(0, 8);
  const credentialScope = `${date}/${input.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    input.amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');
  const signature = createHmac('sha256', s3SigningKey(input.secretAccessKey, date, input.region))
    .update(stringToSign)
    .digest('hex');
  return {
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    amzDate: input.amzDate,
  };
}

// ---------------------------------------------------------------------------
// The ObjectStore adapter.
// ---------------------------------------------------------------------------

function validationError(message: string): ObjectStorageResult<never> {
  return { ok: false, error: { code: 'validation', message } };
}

function unavailableError(message: string): ObjectStorageResult<never> {
  return { ok: false, error: { code: 'unavailable', message } };
}

function notFoundError(digest?: Sha256Hex): ObjectStorageResult<never> {
  return {
    ok: false,
    error: {
      code: 'object-not-found',
      message: digest === undefined ? 'the addressed object does not exist' : `no object is stored at digest ${digest}`,
      ...(digest !== undefined ? { digest } : {}),
    },
  };
}

/** Typed listing failure (list()/size() have no SPI error channel). */
export class S3BackendUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'S3BackendUnavailableError';
  }
}

/** Validate neutral metadata (the SPI's grammar; provider fields rejected). */
function validateMetadata(metadata: ObjectMetadata): string | null {
  if (metadata.schemaVersion !== 1) return 'metadata schemaVersion must be 1';
  if (!(OBJECT_KINDS as readonly string[]).includes(metadata.kind)) return `metadata kind must be one of ${OBJECT_KINDS.join('|')}`;
  if (typeof metadata.tenantId !== 'string' || metadata.tenantId === '') return 'metadata tenantId must be a non-empty string';
  if (typeof metadata.storedAt !== 'string' || metadata.storedAt === '') return 'metadata storedAt must be a timestamp';
  return null;
}

/** The canonical sidecar record of one object (fixed key order). */
interface SidecarRecord {
  readonly schemaVersion: 1;
  readonly digest: string;
  readonly size: number;
  readonly metadata: ObjectMetadata;
}

/**
 * The S3-compatible ObjectStore. Path-style addressing:
 * `{endpoint}/{bucket}/{key}`. All state lives in the bucket; the
 * adapter itself is stateless (safe to construct per request).
 */
export class S3ObjectStore implements ObjectStore {
  private readonly endpoint: string;
  private readonly bucket: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly region: string;
  private readonly prefix: string;
  private readonly fetchImpl: FetchLike;
  private readonly clock: () => Date;
  private readonly timeoutMs: number;

  constructor(config: S3ObjectStoreConfig) {
    if (!/^https?:\/\//.test(config.endpoint)) throw new Error('S3ObjectStore: endpoint must be an http(s) URL');
    if (config.bucket === '') throw new Error('S3ObjectStore: bucket must be non-empty');
    if (config.accessKeyId === '') throw new Error('S3ObjectStore: accessKeyId must be non-empty');
    if (config.secretAccessKey === '') throw new Error('S3ObjectStore: secretAccessKey must be non-empty');
    this.endpoint = config.endpoint.replace(/\/+$/, '');
    this.bucket = config.bucket;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.region = config.region || 'auto';
    this.prefix = config.keyPrefix ?? '';
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.clock = config.clock ?? (() => new Date());
    this.timeoutMs = config.timeoutMs ?? 5_000;
  }

  async put(bytes: Uint8Array, metadata: ObjectMetadata): Promise<ObjectStorageResult<ObjectRef>> {
    const metadataIssue = validateMetadata(metadata);
    if (metadataIssue !== null) return validationError(metadataIssue);
    const digest = digestOfBytes(bytes);
    const ref: ObjectRef = { schemaVersion: 1, digest, size: bytes.length, metadata };
    const sidecar: SidecarRecord = { schemaVersion: 1, digest, size: bytes.length, metadata };

    const bytesPut = await this.s3('PUT', this.bytesKey(digest), bytes, 'application/octet-stream');
    if (!bytesPut.ok) return bytesPut;
    const sidecarBytes = new TextEncoder().encode(JSON.stringify(sidecar));
    const metaPut = await this.s3('PUT', this.metaKey(digest), sidecarBytes, 'application/json');
    if (!metaPut.ok) return metaPut;
    return { ok: true, value: ref };
  }

  async get(digest: Sha256Hex): Promise<ObjectStorageResult<StoredObject | null>> {
    const bytesResult = await this.s3('GET', this.bytesKey(digest));
    if (!bytesResult.ok) {
      if (bytesResult.error.code === 'object-not-found') return { ok: true, value: null };
      return bytesResult;
    }
    const bytes = bytesResult.value;
    // Digest discipline: retrieval is digest-verified (claimed digests never trusted).
    if (digestOfBytes(bytes) !== digest) {
      return { ok: false, error: { code: 'digest-mismatch', message: 'retrieved bytes do not hash to their address (tamper detection)', digest } };
    }
    const sidecarResult = await this.s3('GET', this.metaKey(digest));
    if (!sidecarResult.ok) {
      if (sidecarResult.error.code === 'object-not-found') {
        return validationError(`object ${digest} has bytes but its metadata sidecar is missing (degraded store state)`);
      }
      return sidecarResult;
    }
    let sidecar: SidecarRecord;
    try {
      sidecar = JSON.parse(new TextDecoder().decode(sidecarResult.value)) as SidecarRecord;
    } catch {
      return unavailableError(`object ${digest} has an unparseable metadata sidecar (malformed provider payload)`);
    }
    if (sidecar.digest !== digest) {
      return validationError(`object ${digest} metadata sidecar addresses a different digest (corrupt store state)`);
    }
    return {
      ok: true,
      value: { ref: { schemaVersion: 1, digest, size: sidecar.size, metadata: sidecar.metadata }, bytes },
    };
  }

  async has(digest: Sha256Hex): Promise<boolean> {
    const result = await this.s3('HEAD', this.bytesKey(digest));
    return result.ok;
  }

  async list(): Promise<readonly ObjectRef[]> {
    const listing = await this.listAllMetaEntries();
    const refs: ObjectRef[] = [];
    for (const key of listing) {
      const digest = this.digestOfMetaKey(key);
      if (digest === null) continue;
      const sidecarResult = await this.s3('GET', key);
      if (!sidecarResult.ok) continue;
      try {
        const sidecar = JSON.parse(new TextDecoder().decode(sidecarResult.value)) as SidecarRecord;
        refs.push({ schemaVersion: 1, digest: sidecar.digest, size: sidecar.size, metadata: sidecar.metadata });
      } catch {
        // A malformed sidecar is skipped (observable via get()).
      }
    }
    return refs.sort((a, b) => (a.digest < b.digest ? -1 : a.digest > b.digest ? 1 : 0));
  }

  async size(): Promise<number> {
    const listing = await this.listAllMetaEntries();
    return listing.length;
  }

  // -- internals ----------------------------------------------------------

  private bytesKey(digest: string): string {
    return `${this.prefix}objects/${digest}`;
  }

  private metaKey(digest: string): string {
    return `${this.prefix}meta/${digest}.json`;
  }

  private digestOfMetaKey(key: string): string | null {
    const marker = `${this.prefix}meta/`;
    if (!key.startsWith(marker) || !key.endsWith('.json')) return null;
    const digest = key.slice(marker.length, -'.json'.length);
    return /^[0-9a-f]{64}$/.test(digest) ? digest : null;
  }

  /**
   * List every meta-sidecar key (bounded pagination). The SPI's list()
   * has NO error channel (arrays only); this adapter refuses to lie
   * with an empty array on infrastructure failure — it throws the typed
   * `S3BackendUnavailableError` instead (the boundary maps it to a
   * typed transient gateway error; documented deviation).
   */
  private async listAllMetaEntries(): Promise<readonly string[]> {
    const keys: string[] = [];
    let cursor: string | undefined = undefined;
    for (let page = 0; page < 100; page += 1) {
      const listing = await this.listMetaPage(cursor);
      if (!listing.ok) {
        throw new S3BackendUnavailableError(listing.error.message);
      }
      keys.push(...listing.value.entries);
      cursor = listing.value.nextCursor;
      if (cursor === undefined) return keys;
    }
    return keys;
  }

  /** One page of the meta-prefix listing (ListObjectsV2, path-style). */
  private async listMetaPage(cursor: string | undefined): Promise<ObjectStorageResult<{
    readonly entries: readonly string[];
    readonly nextCursor: string | undefined;
  }>> {
    const params: Array<[string, string]> = [['list-type', '2'], ['prefix', `${this.prefix}meta/`]];
    if (cursor !== undefined) params.push(['continuation-token', cursor]);
    params.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const canonicalQuery = params.map(([k, v]) => `${encodeSegment(k)}=${encodeSegment(v)}`).join('&');
    const result = await this.s3('GET', '', undefined, undefined, canonicalQuery);
    if (!result.ok) return result;
    const xml = new TextDecoder().decode(result.value);
    // Malformed provider payload guard (the W053 negative battery): a
    // 200 body that is not a ListBucketResult document (an HTML error
    // page, truncated XML, garbage) must NOT masquerade as an empty
    // listing — that would be a silent success. Typed unavailable.
    if (!xml.includes('<ListBucketResult')) {
      return unavailableError(`s3 listing response is not a ListBucketResult document (malformed provider payload)`);
    }
    const entries: string[] = [];
    const contents = /<Contents>([\s\S]*?)<\/Contents>/g;
    for (const match of xml.matchAll(contents)) {
      const block = match[1] ?? '';
      const key = /<Key>([\s\S]*?)<\/Key>/.exec(block)?.[1];
      if (key === undefined) continue;
      entries.push(decodeXmlEntities(key));
    }
    const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    const nextToken = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1];
    return {
      ok: true,
      value: {
        entries,
        nextCursor: truncated ? decodeXmlEntities(nextToken ?? '') || undefined : undefined,
      },
    };
  }

  /**
   * One signed S3 request. Returns bytes on 2xx; typed results on 404
   * (object-not-found) and infrastructure failure (unavailable).
   */
  private async s3(
    method: 'GET' | 'PUT' | 'HEAD',
    key: string,
    body?: Uint8Array | undefined,
    contentType?: string | undefined,
    canonicalQuery = '',
  ): Promise<ObjectStorageResult<Uint8Array>> {
    const url = new URL(`${this.endpoint}/${this.bucket}/${key}`);
    if (canonicalQuery !== '') url.search = canonicalQuery;
    const host = url.host;
    const canonicalUri = `/${this.bucket}/${key.split('/').map(encodeSegment).join('/')}`;
    // The runtime payload is always a TypedArray over a concrete ArrayBuffer
    // (TextEncoder output or response bytes); the cast only satisfies the
    // DOM BodyInit/BlobPart variance across lib configurations.
    const payload = (body ?? new Uint8Array(0)) as Uint8Array<ArrayBuffer>;
    const payloadSha256 = sha256Hex(payload);
    const now = this.clock();
    // ACR-006 post-credential live fix (the W053 live-only-defect precedent):
    // toISOString() already ends with Z — the previous template appended a
    // second one ("…T010203ZZ"), which real S3/R2 endpoints reject with
    // SignatureDoesNotMatch (verified live against R2 at the first
    // production-profile boot; the pinned AWS vector passes an explicit
    // amzDate, so the construction site was never covered). Single-Z format.
    const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const extraHeaders: Record<string, string> =
      contentType !== undefined && method === 'PUT' ? { 'content-type': contentType } : {};
    const signed = signS3Request({
      method,
      canonicalUri,
      canonicalQuery,
      host,
      headers: extraHeaders,
      payloadSha256,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      region: this.region,
      amzDate,
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method,
        headers: {
          ...extraHeaders,
          Authorization: signed.authorization,
          'x-amz-content-sha256': payloadSha256,
          'x-amz-date': signed.amzDate,
        },
        body: method === 'PUT' ? new Blob([payload], { type: contentType ?? 'application/octet-stream' }) : undefined,
        signal: controller.signal,
      });
      if (response.status === 404) {
        return notFoundError();
      }
      if (!response.ok) {
        return unavailableError(`s3 backend answered ${response.status} for ${method} ${key || '(listing)'}`);
      }
      if (method === 'HEAD') return { ok: true, value: new Uint8Array(0) };
      return { ok: true, value: new Uint8Array(await response.arrayBuffer()) };
    } catch (cause) {
      return unavailableError(`s3 backend unreachable for ${method} ${key || '(listing)'}: ${(cause as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Decode the small XML entity set S3 uses in listing keys. */
function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&amp;/g, '&');
}

/** Construct an S3-compatible ObjectStore from the config. */
export function createS3ObjectStore(config: S3ObjectStoreConfig): ObjectStore {
  return new S3ObjectStore(config);
}

/** Re-export the SPI types the adapter honors (one-stop consumption). */
export type { ObjectMetadata, ObjectRef, ObjectStorageError, ObjectStorageResult, ObjectStore, StoredObject, Timestamp };
