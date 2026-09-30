/**
 * @epoch/mobile — the platform secure store seam (W049).
 *
 * W049 Tech Lead pin 6: "tokens in the platform secure store (the
 * platform secure-store module or documented equivalent), never
 * AsyncStorage/plaintext; secrets never committed."
 *
 * This module is the SEAM, not the platform binding (the platform module
 * binding lives in the adapter layer — native/platform-bindings.ts, the
 * structural duck-typing point; provider vocabulary stays there, never
 * in this typed surface):
 *
 *  - `SecureStorePort` is the typed interface the product runtime uses for
 *    EVERY session/credential-shaped value (the issued session descriptor,
 *    the bootstrap authentication material). Nothing session-shaped ever
 *    touches AsyncStorage/plain files — there is no such code path.
 *  - `MemorySecureStore` is the deterministic in-memory implementation the
 *    test/harness and the device fallback use (values live only for the
 *    process lifetime; the queue/camera caches hold NO secrets).
 *
 * Deterministic, zero wall-clock, zero randomness. Values are opaque strings
 * to the seam (the caller serializes typed records); the seam never parses
 * them, never logs them, and the memory implementation never exposes them
 * through iteration.
 */

/** The platform secure store seam (the platform secure-store module or documented equivalent). */
export interface SecureStorePort {
  /** Read one value by key (undefined when absent — never a throw). */
  getItem(key: string): Promise<string | undefined>;
  /** Write one value (create or replace). */
  setItem(key: string, value: string): Promise<void>;
  /** Remove one value (absent keys are a no-op). */
  deleteItem(key: string): Promise<void>;
  /** True when the key exists. */
  hasItem(key: string): Promise<boolean>;
}

/** The storage keys the field product uses (closed vocabulary, no secret VALUES). */
export const SECURE_STORE_KEYS = [
  'epoch.field.session',
  'epoch.field.bootstrap.authentication',
  'epoch.field.host.state',
] as const;

/** One secure-store storage key. */
export type SecureStoreKey = (typeof SECURE_STORE_KEYS)[number];

/**
 * The deterministic in-memory secure store (test/harness + device fallback).
 * Implements the same port; values NEVER leave the process.
 */
export class MemorySecureStore implements SecureStorePort {
  private readonly values = new Map<string, string>();

  async getItem(key: string): Promise<string | undefined> {
    return this.values.get(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async deleteItem(key: string): Promise<void> {
    this.values.delete(key);
  }

  async hasItem(key: string): Promise<boolean> {
    return this.values.has(key);
  }

  /** The number of stored values (test introspection ONLY — never the values). */
  get size(): number {
    return this.values.size;
  }

  /** True when NO value is stored under a key outside the closed vocabulary (test assertion). */
  async usesOnlyKnownKeys(): Promise<boolean> {
    for (const key of this.values.keys()) {
      if (!(SECURE_STORE_KEYS as readonly string[]).includes(key)) return false;
    }
    return true;
  }
}
