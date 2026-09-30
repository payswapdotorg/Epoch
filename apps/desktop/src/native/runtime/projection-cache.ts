/**
 * @epoch/desktop — the durable desktop projection cache (W048).
 *
 * Client-side projections are CACHED SERVER PROJECTIONS: the read-only
 * client-runtime `ProjectionCache` (immutable, digest-addressed,
 * admitted only with the server's digest + revision) plus durable
 * persistence through the host store so relaunch (J12) re-admits the
 * cached projections instead of re-fetching. There is deliberately NO
 * mutation API — the absence is the enforcement (the client-runtime
 * invariant, kept intact here).
 */
import { ProjectionCache, type ProjectionCacheEntry, type Sha256Hex } from '@epoch/client-runtime';
import { admitPersistedRecord, sealPersistedRecord } from './protocol-gate';
import type { HostCommandPort } from '../ipc/host';

/** The durable key the cached projections persist under. */
export const PROJECTION_CACHE_DURABLE_KEY = 'epoch.projection.cache.v1';

/** The desktop projection cache: read-only admission + durable restore. */
export class DesktopProjectionCache {
  private readonly cache = new ProjectionCache();
  private readonly host: HostCommandPort;

  constructor(options: { readonly host: HostCommandPort }) {
    this.host = options.host;
  }

  /** Number of cached projections. */
  get size(): number {
    return this.cache.size;
  }

  /** Admit a SERVER projection (digest + revision + content; immutable once admitted). */
  admitServerProjection(input: {
    readonly digest: Sha256Hex;
    readonly revision: number;
    readonly fetchedAt: string;
    readonly content: import('@epoch/client-runtime').JsonValue;
  }): ProjectionCacheEntry {
    const entry = this.cache.admitServerProjection(input);
    this.digestIndex.add(entry.digest);
    return entry;
  }

  /** Fetch a cached projection by digest (null when absent). */
  get(digest: Sha256Hex): ProjectionCacheEntry | null {
    return this.cache.get(digest);
  }

  /** The latest cached projection by revision (null when empty). */
  latest(): ProjectionCacheEntry | null {
    return this.cache.latest();
  }

  /** Persist the cached projections (protocol-sealed, digest-keyed). */
  async persist(): Promise<void> {
    const entries: ProjectionCacheEntry[] = [];
    for (const digest of this.persistedDigests()) {
      const entry = this.cache.get(digest);
      if (entry !== null) entries.push(entry);
    }
    await this.host.durable.set(
      PROJECTION_CACHE_DURABLE_KEY,
      JSON.stringify(sealPersistedRecord({ entries })),
    );
  }

  /**
   * Restore the persisted projections on relaunch (J08/J12): entries are
   * re-admitted through the SAME read-only admission path (digest-keyed,
   * immutable); an incompatible protocol envelope is REFUSED and discarded.
   */
  async restore(): Promise<readonly ProjectionCacheEntry[] | null> {
    const raw = await this.host.durable.get(PROJECTION_CACHE_DURABLE_KEY);
    if (raw === null) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    const admitted = admitPersistedRecord<{ entries: ProjectionCacheEntry[] }>(parsed);
    if (!admitted.ok) return null;
    for (const entry of admitted.record.entries) {
      this.cache.admitServerProjection({
        digest: entry.digest,
        revision: entry.revision,
        fetchedAt: entry.fetchedAt,
        content: entry.content,
      });
    }
    return admitted.record.entries;
  }

  private persistedDigests(): string[] {
    return [...this.digestIndex];
  }

  private readonly digestIndex = new Set<string>();
}
