'use client';
/**
 * @epoch/web — the read-only projection cache (W047, J08).
 *
 * The client-runtime `ProjectionCache` bound to localStorage: server
 * projections are admitted BY DIGEST (read-only, immutable) and re-read by
 * digest — never a second source of truth. On reload the UI re-fetches the
 * authoritative projection through the gateway and compares digests; the
 * cache admits the server projection only when the digest matches.
 */
import { ProjectionCache } from '@epoch/client-runtime';
import type { ProjectionCacheEntry, Sha256Hex } from '@epoch/client-runtime';
import type { JsonValue } from '@epoch/client-runtime';

const CACHE_STORAGE_KEY = 'epoch.web.projection-cache.v1';

function readPersisted(): ProjectionCacheEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CACHE_STORAGE_KEY);
    if (raw === null) return [];
    return JSON.parse(raw) as ProjectionCacheEntry[];
  } catch {
    return [];
  }
}

function persist(entries: readonly ProjectionCacheEntry[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(entries));
}

/** The persistent projection cache (one per browser profile). */
export class PersistentProjectionCache {
  private readonly cache = new ProjectionCache();
  private loaded = false;

  private ensureLoaded(): void {
    if (this.loaded) return;
    for (const entry of readPersisted()) {
      this.cache.admitServerProjection({
        digest: entry.digest,
        revision: entry.revision,
        fetchedAt: entry.fetchedAt,
        content: entry.content,
      });
    }
    this.loaded = true;
  }

  /** Admit a SERVER projection by digest (idempotent, immutable). */
  admit(input: {
    readonly digest: Sha256Hex;
    readonly revision: number;
    readonly fetchedAt: string;
    readonly content: JsonValue;
  }): ProjectionCacheEntry {
    this.ensureLoaded();
    const entry = this.cache.admitServerProjection(input);
    persist(this.cache.snapshot());
    return entry;
  }

  /** Read a cached projection by digest (null when absent). */
  get(digest: Sha256Hex): ProjectionCacheEntry | null {
    this.ensureLoaded();
    return this.cache.get(digest);
  }

  /** The deterministic snapshot (journey evidence). */
  snapshot(): readonly ProjectionCacheEntry[] {
    this.ensureLoaded();
    return this.cache.snapshot();
  }
}

/** The singleton browser projection cache. */
export const projectionCache = new PersistentProjectionCache();
