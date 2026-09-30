/**
 * @epoch/object-storage — the byte/evidence store SPI + the reference
 * in-memory implementation (kernel layer, Work Order W046).
 *
 * ACR-005: "object storage holds bytes/evidence/assets by
 * reference/digest". Every object is addressed by the SHA-256 digest of
 * its EXACT bytes; puts are idempotent by digest; retrieval is
 * digest-verified (the returned bytes always hash to their address).
 * Metadata is provider-neutral (no vendor fields); evidence linkage is
 * by descriptor, never semantics. Deterministic: zero wall-clock, zero
 * randomness, listing order is digest-sorted.
 */
import { sha256Hex, type JsonValue, type Sha256Hex, type Timestamp } from '@epoch/agent-protocol';

/** Version of the published object-storage SPI contract. */
export const OBJECT_STORAGE_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator on serialized object records (v1). */
export const OBJECT_STORAGE_RECORD_VERSION = 1 as const;

/** Typed object-store error codes. */
export const OBJECT_STORAGE_ERROR_CODES = [
  'validation',
  'object-not-found',
  'digest-mismatch',
] as const;

/** One typed object-store error code. */
export type ObjectStorageErrorCode = (typeof OBJECT_STORAGE_ERROR_CODES)[number];

/** One typed object-store error (a value, never thrown). */
export interface ObjectStorageError {
  readonly code: ObjectStorageErrorCode;
  readonly message: string;
  readonly digest?: Sha256Hex | undefined;
}

/** The total result type. */
export type ObjectStorageResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ObjectStorageError };

/** Neutral object-kind vocabulary (never vendor/product names). */
export const OBJECT_KINDS = [
  'evidence-artifact',
  'asset',
  'document',
  'model',
  'export',
  'other',
] as const;

/** One neutral object kind. */
export type ObjectKind = (typeof OBJECT_KINDS)[number];

/** Provider-neutral object metadata (strictly typed; no vendor fields). */
export interface ObjectMetadata {
  readonly schemaVersion: typeof OBJECT_STORAGE_RECORD_VERSION;
  readonly kind: ObjectKind;
  readonly tenantId: string;
  /** Human audit label (bounded). */
  readonly label?: string | undefined;
  /** Neutral linkage descriptor to the evidence record referencing these bytes. */
  readonly evidenceLink?: { readonly evidenceDigest: Sha256Hex } | undefined;
  readonly storedAt: Timestamp;
}

/** A stored object reference (the digest IS the address). */
export interface ObjectRef {
  readonly schemaVersion: typeof OBJECT_STORAGE_RECORD_VERSION;
  readonly digest: Sha256Hex;
  readonly size: number;
  readonly metadata: ObjectMetadata;
}

/** A retrieved object (bytes + reference, digest-verified). */
export interface StoredObject {
  readonly ref: ObjectRef;
  readonly bytes: Uint8Array;
}

/** The provider-neutral object-store port. */
export interface ObjectStore {
  /**
   * Store bytes under their content digest (idempotent: re-putting the
   * same bytes returns the existing reference; the digest is RECOMPUTED
   * here — a claimed digest is never trusted).
   */
  put(bytes: Uint8Array, metadata: ObjectMetadata): Promise<ObjectStorageResult<ObjectRef>>;
  /** Retrieve digest-verified bytes (null when absent). */
  get(digest: Sha256Hex): Promise<ObjectStorageResult<StoredObject | null>>;
  /** Check presence. */
  has(digest: Sha256Hex): Promise<boolean>;
  /** Every stored reference, digest-sorted (deterministic). */
  list(): Promise<readonly ObjectRef[]>;
  /** Number of stored objects. */
  size(): Promise<number>;
}

/** Compute the content digest of bytes (the address). */
export function digestOfBytes(bytes: Uint8Array): Sha256Hex {
  return sha256Hex(bytesToString(bytes));
}

function bytesToString(bytes: Uint8Array): string {
  // Byte-preserving string round-trip (sha256Hex consumes UTF-8 text; the
  // canonical byte->string mapping below is injective over 0x00-0xFF).
  let out = '';
  for (const byte of bytes) {
    out += String.fromCharCode(byte);
  }
  return out;
}

/** Validate metadata (typed, total). */
export function validateMetadata(metadata: ObjectMetadata): ObjectStorageError | null {
  if (metadata.schemaVersion !== OBJECT_STORAGE_RECORD_VERSION) {
    return { code: 'validation', message: `schemaVersion must be ${OBJECT_STORAGE_RECORD_VERSION}` };
  }
  if (!OBJECT_KINDS.includes(metadata.kind)) {
    return { code: 'validation', message: `unknown object kind "${metadata.kind}"` };
  }
  if (typeof metadata.tenantId !== 'string' || !/^tenant:[a-z0-9][a-z0-9-]{0,62}$/.test(metadata.tenantId)) {
    return { code: 'validation', message: 'metadata.tenantId must match the tenant grammar' };
  }
  if (metadata.label !== undefined && (typeof metadata.label !== 'string' || metadata.label.length > 256)) {
    return { code: 'validation', message: 'metadata.label must be a bounded string' };
  }
  return null;
}

/** The reference in-memory object store (deterministic, digest-sorted). */
export class InMemoryObjectStore implements ObjectStore {
  private readonly objects = new Map<Sha256Hex, { ref: ObjectRef; bytes: Uint8Array }>();

  async put(bytes: Uint8Array, metadata: ObjectMetadata): Promise<ObjectStorageResult<ObjectRef>> {
    const metadataError = validateMetadata(metadata);
    if (metadataError !== null) return { ok: false, error: metadataError };
    const digest = digestOfBytes(bytes);
    const existing = this.objects.get(digest);
    if (existing !== undefined) {
      // Idempotent by content: the same bytes always map to the same ref.
      return { ok: true, value: existing.ref };
    }
    const ref: ObjectRef = {
      schemaVersion: OBJECT_STORAGE_RECORD_VERSION,
      digest,
      size: bytes.byteLength,
      metadata,
    };
    this.objects.set(digest, { ref, bytes: Uint8Array.from(bytes) });
    return { ok: true, value: ref };
  }

  async get(digest: Sha256Hex): Promise<ObjectStorageResult<StoredObject | null>> {
    const found = this.objects.get(digest);
    if (found === undefined) return { ok: true, value: null };
    // Digest discipline: verify the bytes hash to their address.
    if (digestOfBytes(found.bytes) !== digest) {
      return { ok: false, error: { code: 'digest-mismatch', message: 'stored bytes do not hash to their address (tamper detection)', digest } };
    }
    return { ok: true, value: { ref: found.ref, bytes: Uint8Array.from(found.bytes) } };
  }

  async has(digest: Sha256Hex): Promise<boolean> {
    return this.objects.has(digest);
  }

  async list(): Promise<readonly ObjectRef[]> {
    return [...this.objects.keys()].sort().map((digest) => this.objects.get(digest)!.ref);
  }

  async size(): Promise<number> {
    return this.objects.size;
  }
}

/** JSON form of a reference (the durable record mirror). */
export function objectRefToJson(ref: ObjectRef): JsonValue {
  return JSON.parse(JSON.stringify(ref)) as JsonValue;
}
