/**
 * The offline/session cache (W017): session-state snapshots and experience
 * caches as typed, content-addressed projections with freshness and
 * invalidation records — NEVER a second semantic store (architecture lock
 * rules 8/16).
 *
 * What the cache holds: verbatim, digest-verified projection documents
 * (sealed W011 graphs, full W012 plan documents) addressed by their own
 * content digests, plus freshness metadata (recorded time, validity,
 * typed invalidation records). What it never holds: kernel state, mutable
 * semantic records, or anything addressed by anything other than a
 * content digest. A stored record whose recomputed digest does not match
 * its claimed address is a typed `digest-mismatch` rejection (tamper
 * detection); a record can never be silently mutated under an existing
 * address.
 *
 * The session-state snapshot is the replay-safe projection of a whole
 * shell session: window states, binding digests, receipt-log digests,
 * cache addresses with freshness, and the seam channel heads — all
 * content-addressed into one sealed snapshot record. Replaying the host
 * envelope chain through a fresh shell reproduces a byte-identical
 * snapshot (test/determinism.test.ts).
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { z } from 'zod';
import { DeviceDescriptorSchema, TenantScopeSchema } from '@epoch/experience-protocol';
import { desktopOk, type DesktopResult } from './errors';
import {
  CACHE_ENTRY_KINDS,
  CACHE_INVALIDATION_REASONS,
  DESKTOP_PROTOCOL_VERSION,
  type CacheEntryKind,
  type CacheInvalidationReason,
} from './version';
import {
  DeviceSessionIdSchema,
  DesktopSessionIdSchema,
  PrincipalIdSchema,
  ProvenanceSchema,
  RendererSessionIdSchema,
  Sha256HexSchema,
  VirtualTimeMsSchema,
  WindowIdSchema,
  type Provenance,
} from './primitives';

/** Schema-name discriminator carried by every cache entry. */
export const CACHE_ENTRY_SCHEMA_NAME = 'epoch.desktop.cache-entry' as const;

/** Schema-name discriminator carried by every session snapshot. */
export const SESSION_SNAPSHOT_SCHEMA_NAME = 'epoch.desktop.session-snapshot' as const;

// ---------------------------------------------------------------------------
// Cache entries.
// ---------------------------------------------------------------------------

/** The freshness record of one cached projection. */
export const CacheFreshnessSchema = z
  .strictObject({
    recordedAtMs: VirtualTimeMsSchema,
    /** Whether the entry is currently fresh (an invalidation flips it). */
    fresh: z.boolean(),
    /** The typed invalidation record, when the entry was invalidated. */
    invalidation: z
      .strictObject({
        reason: z.enum(CACHE_INVALIDATION_REASONS),
        atMs: VirtualTimeMsSchema,
        /** The superseding address, when the reason is supersession. */
        supersededBy: Sha256HexSchema.optional(),
      })
      .optional(),
  })
  .meta({
    id: 'DesktopCacheFreshness',
    title: 'DesktopCacheFreshness',
    description: 'The freshness/invalidation record of one cached projection.',
  });

/** One freshness record. */
export type CacheFreshness = z.infer<typeof CacheFreshnessSchema>;

/** The cache-entry metadata content (the record itself is addressed by `address`). */
export const CacheEntryContentSchema = z
  .strictObject({
    schema: z.literal(CACHE_ENTRY_SCHEMA_NAME),
    protocolVersion: z.literal(DESKTOP_PROTOCOL_VERSION),
    /** The content address of the stored record (its canonical digest). */
    address: Sha256HexSchema,
    kind: z.enum(CACHE_ENTRY_KINDS),
    tenantScope: TenantScopeSchema,
    freshness: CacheFreshnessSchema,
    provenance: ProvenanceSchema,
  })
  .superRefine((entry, ctx) => {
    // A supersession must name its successor.
    if (entry.freshness.invalidation?.reason === 'superseded' && entry.freshness.invalidation.supersededBy === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a superseded entry must name its superseding address',
        path: ['freshness', 'invalidation', 'supersededBy'],
      });
    }
  })
  .meta({
    id: 'DesktopCacheEntryContent',
    title: 'DesktopCacheEntryContent',
    description: 'The metadata of one cached projection: address, kind, tenant scope, freshness, provenance.',
  });

/** One cache-entry metadata content. */
export type CacheEntryContent = z.infer<typeof CacheEntryContentSchema>;

/** The sealed cache entry: metadata plus its own digest. */
export const CacheEntrySchema = CacheEntryContentSchema.extend({
  digest: Sha256HexSchema,
}).meta({
  id: 'DesktopCacheEntry',
  title: 'DesktopCacheEntry',
  description: 'The sealed cache entry: metadata plus its SHA-256 digest (the stored record is addressed separately).',
});

/** One sealed cache entry. */
export type CacheEntry = z.infer<typeof CacheEntrySchema>;

/** The content of a sealed entry (digest excluded). */
function entryContent(entry: CacheEntry): JsonValue {
  const { digest: _claimed, ...content } = entry;
  void _claimed;
  return content as unknown as JsonValue;
}

/** Seal a valid entry content. */
export function sealCacheEntry(content: CacheEntryContent): CacheEntry {
  return { ...content, digest: canonicalDigest(content as unknown as JsonValue) };
}

/** Verify a sealed entry (metadata tamper detection). */
export function verifyCacheEntry(entry: CacheEntry): boolean {
  return canonicalDigest(entryContent(entry)) === entry.digest;
}

/** One stored cache record (entry metadata + the verbatim document). */
export interface StoredCacheRecord {
  readonly entry: CacheEntry;
  readonly record: JsonValue;
}

/**
 * The content address of a (possibly sealed) document: sealed records
 * carry their digest in a `digest` field, which is EXCLUDED from the
 * addressed content (the W011/W012 sealing convention). Raw records are
 * addressed by their full canonical form.
 */
export function contentAddressOf(record: unknown): string {
  if (typeof record === 'object' && record !== null && !Array.isArray(record) && 'digest' in record) {
    const { digest: _claimed, ...content } = record as Record<string, unknown>;
    void _claimed;
    return canonicalDigest(content as unknown as JsonValue);
  }
  return canonicalDigest(record as unknown as JsonValue);
}

/** The options of {@link ExperienceCache.resolve}. */
export interface CacheResolveOptions {
  /** Require the entry to be fresh (a stale read is a typed cache-violation). */
  readonly requireFresh?: boolean;
  /** The tenant the reader represents (R12 gate). */
  readonly expectedTenantId?: string;
  /** The expected kind (a mismatch is a typed cache-violation). */
  readonly expectedKind?: CacheEntryKind;
}

/** The in-memory experience cache (content-addressed projections only). */
export interface ExperienceCache {
  /** Store one record at its content address (verifies the digest first). */
  put(input: {
    readonly address: string;
    readonly kind: CacheEntryKind;
    readonly record: unknown;
    readonly tenantScope: { readonly tenantId: string; readonly workspaceId?: string; readonly projectId?: string };
    readonly recordedAtMs: number;
    readonly provenance: Provenance;
  }): DesktopResult<CacheEntry>;
  /** Resolve one address (typed rejections: unknown, stale, kind, tenant). */
  resolve(address: string, options?: CacheResolveOptions): DesktopResult<StoredCacheRecord>;
  /** Invalidate one address (a new entry version; never a mutation). */
  invalidate(
    address: string,
    reason: CacheInvalidationReason,
    atMs: number,
    supersededBy?: string,
  ): DesktopResult<CacheEntry>;
  /** All addresses, sorted ascending (deterministic). */
  listAddresses(): readonly string[];
  /** All entries, sorted by address (deterministic). */
  listEntries(): readonly CacheEntry[];
}

/** Create an empty in-memory experience cache. */
export function createExperienceCache(): ExperienceCache {
  const store = new Map<string, StoredCacheRecord>();
  const cache: ExperienceCache = {
    put(input) {
      // The claimed address must be the record's recomputed content address
      // (sealed documents address their digest-excluded content).
      const recomputed = contentAddressOf(input.record);
      if (recomputed !== input.address) {
        return {
          ok: false,
          error: {
            code: 'digest-mismatch',
            message: 'the stored record does not match its claimed address — the write is rejected (tamper detection)',
            path: 'address',
            expected: recomputed,
            encountered: input.address,
          },
        };
      }
      const entry = sealCacheEntry({
        schema: CACHE_ENTRY_SCHEMA_NAME,
        protocolVersion: DESKTOP_PROTOCOL_VERSION,
        address: input.address,
        kind: input.kind,
        tenantScope: input.tenantScope,
        freshness: { recordedAtMs: input.recordedAtMs, fresh: true },
        provenance: input.provenance,
      });
      store.set(input.address, { entry, record: input.record as JsonValue });
      return desktopOk(entry);
    },
    resolve(address, options = {}) {
      const stored = store.get(address);
      if (stored === undefined) {
        return {
          ok: false,
          error: {
            code: 'cache-violation',
            message: `no cached projection at address ${address}`,
            reason: 'unknown-address',
            address,
          },
        };
      }
      if (options.expectedKind !== undefined && stored.entry.kind !== options.expectedKind) {
        return {
          ok: false,
          error: {
            code: 'cache-violation',
            message: `the cached projection at ${address} is a ${stored.entry.kind}, not a ${options.expectedKind}`,
            reason: 'kind-mismatch',
            address,
          },
        };
      }
      if (
        options.expectedTenantId !== undefined &&
        stored.entry.tenantScope.tenantId !== options.expectedTenantId
      ) {
        return {
          ok: false,
          error: {
            code: 'cross-tenant-denied',
            message:
              `cross-tenant cache read denied: expected tenant "${options.expectedTenantId}", ` +
              `encountered "${stored.entry.tenantScope.tenantId}"`,
            path: 'entry.tenantScope.tenantId',
            expectedTenantId: options.expectedTenantId,
            encounteredTenantId: stored.entry.tenantScope.tenantId,
          },
        };
      }
      if (options.requireFresh === true && !stored.entry.freshness.fresh) {
        return {
          ok: false,
          error: {
            code: 'cache-violation',
            message: `the cached projection at ${address} is stale (invalidated: ${stored.entry.freshness.invalidation?.reason ?? 'unknown'})`,
            reason: 'stale-read',
            address,
          },
        };
      }
      return desktopOk(stored);
    },
    invalidate(address, reason, atMs, supersededBy) {
      const stored = store.get(address);
      if (stored === undefined) {
        return {
          ok: false,
          error: {
            code: 'cache-violation',
            message: `no cached projection at address ${address}`,
            reason: 'unknown-address',
            address,
          },
        };
      }
      if (reason === 'superseded' && supersededBy === undefined) {
        return {
          ok: false,
          error: {
            code: 'malformed-record',
            message: 'a supersession invalidation must name its superseding address',
            issues: [{ path: 'supersededBy', message: 'required when reason is "superseded"' }],
          },
        };
      }
      const { digest: _stale, ...entryWithoutDigest } = stored.entry;
      void _stale;
      const entry = sealCacheEntry({
        ...entryWithoutDigest,
        freshness: {
          recordedAtMs: stored.entry.freshness.recordedAtMs,
          fresh: false,
          invalidation: { reason, atMs, supersededBy },
        },
      });
      store.set(address, { entry, record: stored.record });
      return desktopOk(entry);
    },
    listAddresses() {
      return [...store.keys()].sort();
    },
    listEntries() {
      return [...store.values()].map((stored) => stored.entry).sort((a, b) =>
        a.address < b.address ? -1 : a.address > b.address ? 1 : 0,
      );
    },
  };
  return cache;
}

// ---------------------------------------------------------------------------
// Session-state snapshots.
// ---------------------------------------------------------------------------

/** One window summary inside a session snapshot. */
export const SnapshotWindowSchema = z
  .strictObject({
    windowId: WindowIdSchema,
    state: z.enum(['opening', 'open', 'focused', 'blurred', 'closing', 'closed']),
    deviceSessionId: DeviceSessionIdSchema,
    rendererSessionId: RendererSessionIdSchema,
    /** The sealed binding's content digest. */
    bindingDigest: Sha256HexSchema,
    /** The mounted graph digest, when a state is mounted. */
    mountedGraphDigest: Sha256HexSchema.optional(),
    mountedAtMs: VirtualTimeMsSchema.optional(),
    lastFrameIndex: z.number().int().nonnegative().optional(),
    invocationCount: z.number().int().nonnegative(),
  })
  .meta({
    id: 'DesktopSnapshotWindow',
    title: 'DesktopSnapshotWindow',
    description: 'One window summary inside a session snapshot (digest-addressed render hosting).',
  });

/** One window summary. */
export type SnapshotWindow = z.infer<typeof SnapshotWindowSchema>;

/** One receipt-log entry summary (digest-addressed evidence). */
export const SnapshotReceiptSchema = z
  .strictObject({
    receiptDigest: Sha256HexSchema,
    invocationId: z.string().regex(/^inv-[a-z0-9][a-z0-9-]{0,62}$/),
    kind: z.enum(['mount-receipt', 'frame-receipt', 'intent-receipt']),
    windowId: WindowIdSchema,
  })
  .meta({
    id: 'DesktopSnapshotReceipt',
    title: 'DesktopSnapshotReceipt',
    description: 'One receipt-log entry summary inside a session snapshot (execution evidence, digest-addressed).',
  });

/** One receipt summary. */
export type SnapshotReceipt = z.infer<typeof SnapshotReceiptSchema>;

/** One cache-address summary inside a snapshot. */
export const SnapshotCacheAddressSchema = z
  .strictObject({
    address: Sha256HexSchema,
    kind: z.enum(CACHE_ENTRY_KINDS),
    fresh: z.boolean(),
  })
  .meta({
    id: 'DesktopSnapshotCacheAddress',
    title: 'DesktopSnapshotCacheAddress',
    description: 'One cached-projection address summary inside a session snapshot.',
  });

/** One cache-address summary. */
export type SnapshotCacheAddress = z.infer<typeof SnapshotCacheAddressSchema>;

/** The seam channel heads at snapshot time. */
export const SnapshotChannelsSchema = z
  .strictObject({
    host: z.strictObject({
      lastSequence: z.number().int().nonnegative(),
      lastDigest: Sha256HexSchema,
    }),
    shell: z.strictObject({
      lastSequence: z.number().int().nonnegative(),
      lastDigest: Sha256HexSchema,
    }),
  })
  .meta({
    id: 'DesktopSnapshotChannels',
    title: 'DesktopSnapshotChannels',
    description: 'The host/shell seam channel heads at snapshot time (replay position).',
  });

/** One seam channel-heads record. */
export type SnapshotChannels = z.infer<typeof SnapshotChannelsSchema>;

/** The session-snapshot content (digest-sealed form). */
export const SessionSnapshotContentSchema = z
  .strictObject({
    schema: z.literal(SESSION_SNAPSHOT_SCHEMA_NAME),
    protocolVersion: z.literal(DESKTOP_PROTOCOL_VERSION),
    sessionId: DesktopSessionIdSchema,
    tenantScope: TenantScopeSchema,
    principal: PrincipalIdSchema,
    sessionState: z.enum(['opening', 'active', 'suspended', 'closing', 'closed']),
    /** The session's device descriptor (typed data; the W011 slot). */
    device: DeviceDescriptorSchema,
    windows: z.array(SnapshotWindowSchema),
    receipts: z.array(SnapshotReceiptSchema),
    cacheAddresses: z.array(SnapshotCacheAddressSchema),
    channels: SnapshotChannelsSchema,
    capturedAtMs: VirtualTimeMsSchema,
    provenance: ProvenanceSchema,
  })
  .meta({
    id: 'DesktopSessionSnapshotContent',
    title: 'DesktopSessionSnapshotContent',
    description:
      'The content of a session-state snapshot: tenant-scoped session facts, digest-addressed windows/bindings/receipts/cache, channel heads, and provenance.',
  });

/** One session-snapshot content. */
export type SessionSnapshotContent = z.infer<typeof SessionSnapshotContentSchema>;

/** The sealed session snapshot: content plus its SHA-256 digest. */
export const SessionSnapshotSchema = SessionSnapshotContentSchema.extend({
  digest: Sha256HexSchema,
}).meta({
  id: 'DesktopSessionSnapshot',
  title: 'DesktopSessionSnapshot',
  description: 'The sealed session-state snapshot: content plus its SHA-256 content digest (replay verification).',
});

/** One sealed session snapshot. */
export type SessionSnapshot = z.infer<typeof SessionSnapshotSchema>;

/** The content of a sealed snapshot (digest excluded). */
function snapshotContent(snapshot: SessionSnapshot): JsonValue {
  const { digest: _claimed, ...content } = snapshot;
  void _claimed;
  return content as unknown as JsonValue;
}

/** Seal a valid snapshot content. */
export function sealSessionSnapshot(content: SessionSnapshotContent): SessionSnapshot {
  return { ...content, digest: canonicalDigest(content as unknown as JsonValue) };
}

/** Verify a sealed snapshot (tamper detection). */
export function verifySessionSnapshot(snapshot: SessionSnapshot): boolean {
  return canonicalDigest(snapshotContent(snapshot)) === snapshot.digest;
}

/** Total snapshot admission (version gate -> schema gate -> digest gate). */
export function parseSessionSnapshot(input: unknown): DesktopResult<SessionSnapshot> {
  if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
    const encountered = (input as Record<string, unknown>).protocolVersion;
    if (typeof encountered === 'string' && encountered !== DESKTOP_PROTOCOL_VERSION) {
      return {
        ok: false,
        error: {
          code: 'version-unsupported',
          message: `protocol version mismatch: expected ${DESKTOP_PROTOCOL_VERSION}, encountered ${encountered}`,
          expected: DESKTOP_PROTOCOL_VERSION,
          encountered,
        },
      };
    }
    const schemaName = (input as Record<string, unknown>).schema;
    if (typeof schemaName === 'string' && schemaName !== SESSION_SNAPSHOT_SCHEMA_NAME) {
      return {
        ok: false,
        error: {
          code: 'version-unsupported',
          message: `schema discriminator mismatch: expected ${SESSION_SNAPSHOT_SCHEMA_NAME}, encountered ${schemaName}`,
          expected: SESSION_SNAPSHOT_SCHEMA_NAME,
          encountered: schemaName,
        },
      };
    }
  }
  const parsed = SessionSnapshotSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: 'malformed-record',
        message: 'session snapshot failed schema validation',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length === 0 ? '$' : issue.path.join('.'),
          message: issue.message,
        })),
      },
    };
  }
  if (!verifySessionSnapshot(parsed.data)) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'session snapshot digest does not match its content — the snapshot is rejected (tamper detection)',
        path: '$',
        expected: canonicalDigest(snapshotContent(parsed.data)),
        encountered: parsed.data.digest,
      },
    };
  }
  return desktopOk(parsed.data);
}

/** The digest of a snapshot (its exact-revision address). */
export function snapshotDigest(snapshot: SessionSnapshot): Sha256Hex {
  return snapshot.digest;
}
