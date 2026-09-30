/**
 * @epoch/client-runtime — the read-only projection cache.
 *
 * Client-side projections are CACHED SERVER PROJECTIONS: admitted only
 * with the server's content digest + revision, immutable once admitted,
 * and never locally mutated (ACR-005: "Local caches/queues are
 * session/projection/replay state only"). There is deliberately NO
 * mutation API — the absence is the enforcement (pinned by
 * test/projection.test.ts).
 */
import { z } from 'zod';
import { JsonValueSchema, TimestampSchema, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import { CLIENT_RUNTIME_RECORD_VERSION } from './version';

/** One cached server projection (immutable, digest-addressed). */
export interface ProjectionCacheEntry {
  readonly schemaVersion: typeof CLIENT_RUNTIME_RECORD_VERSION;
  readonly digest: Sha256Hex;
  /** Monotonic server revision of the projection (server-assigned). */
  readonly revision: number;
  readonly fetchedAt: string;
  readonly content: JsonValue;
}

export const ProjectionCacheEntrySchema = z
  .strictObject({
    schemaVersion: z.literal(CLIENT_RUNTIME_RECORD_VERSION),
    digest: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .meta({ id: 'Sha256Hex', title: 'Sha256Hex' }),
    revision: z.number().int().min(1),
    fetchedAt: TimestampSchema,
    content: JsonValueSchema,
  })
  .readonly()
  .meta({ id: 'ProjectionCacheEntry', title: 'ProjectionCacheEntry' });

/** The digest-keyed, revision-ordered read-only projection cache. */
export class ProjectionCache {
  private readonly entries = new Map<Sha256Hex, ProjectionCacheEntry>();

  /** Number of cached projections. */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Admit a SERVER projection (the caller must supply the server digest +
   * revision; the cache recomputes nothing and mutates nothing already
   * admitted). Re-admitting the same digest is idempotent.
   */
  admitServerProjection(input: {
    readonly digest: Sha256Hex;
    readonly revision: number;
    readonly fetchedAt: string;
    readonly content: JsonValue;
  }): ProjectionCacheEntry {
    const existing = this.entries.get(input.digest);
    if (existing !== undefined) return existing;
    const entry: ProjectionCacheEntry = {
      schemaVersion: CLIENT_RUNTIME_RECORD_VERSION,
      digest: input.digest,
      revision: input.revision,
      fetchedAt: input.fetchedAt,
      content: input.content,
    };
    this.entries.set(input.digest, entry);
    return entry;
  }

  /** Fetch a cached projection by digest (null when absent). */
  get(digest: Sha256Hex): ProjectionCacheEntry | null {
    return this.entries.get(digest) ?? null;
  }

  /** The latest cached projection by revision (null when empty). */
  latest(): ProjectionCacheEntry | null {
    let best: ProjectionCacheEntry | null = null;
    for (const entry of this.entries.values()) {
      if (best === null || entry.revision > best.revision) best = entry;
    }
    return best;
  }

  /** Deterministic snapshot (sorted by digest). */
  snapshot(): readonly ProjectionCacheEntry[] {
    return [...this.entries.values()].sort((a, b) => (a.digest < b.digest ? -1 : 1));
  }
}
