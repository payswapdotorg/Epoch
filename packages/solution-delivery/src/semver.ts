/**
 * Semver-core comparison (MAJOR.MINOR.PACKET lexical-free numeric
 * comparison). Reimplemented locally because @epoch/capability-registry
 * (the canonical home of `compareSemver`) is NOT a runtime dependency of
 * this kernel (the W036 runtime-dependency policy); the grammar itself is
 * the agent-protocol SEMVER_CORE_PATTERN.
 */

/** Parse a semver core into its three numeric components. */
function parseSemver(version: string): [number, number, number] {
  const [major, minor, patch] = version.split('.');
  return [Number(major), Number(minor), Number(patch)];
}

/**
 * Compare two semver cores: negative when `a < b`, zero when equal,
 * positive when `a > b`.
 */
export function compareSemver(a: string, b: string): number {
  const [aMajor, aMinor, aPatch] = parseSemver(a);
  const [bMajor, bMinor, bPatch] = parseSemver(b);
  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  return aPatch - bPatch;
}
