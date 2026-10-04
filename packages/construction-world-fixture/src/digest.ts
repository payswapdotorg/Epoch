/**
 * @epoch/construction-world-fixture — the fixture digest (W071, ACR-012).
 *
 * A deterministic FNV-1a-derived 64-hex digest over fixture-local seed
 * strings. This is FIXTURE-ONLY (the W061 precedent): the REAL sealing
 * (`sealWorldSceneContent`) re-digests the canonical-JSON of the scene
 * content. The fixture digest exists so every entity/agent carries a
 * content-addressed reference BEFORE the real sealing re-computes the
 * canonical scene digest — same inputs -> identical digests every run.
 */

/** The deterministic fixture digest of one seed string (64-hex). */
export function digestOf(seed: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  let out = '';
  for (let round = 0; round < 8; round += 1) {
    hash = Math.imul(hash ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
    out += hash.toString(16).padStart(8, '0');
  }
  return out;
}

/** The canonical fixture digest (the digest of the canonical seed). */
export const FIXTURE_DIGEST = digestOf('construction-solution-fixture@1.0.0');
