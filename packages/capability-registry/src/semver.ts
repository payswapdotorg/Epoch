/**
 * Semantic-version machinery for the Capability Registry (self-contained).
 *
 * Scope: the semver CORE only (`major.minor.patch`, no prerelease/build
 * suffixes), matching the frozen `SEMVER_CORE_PATTERN` shared primitive in
 * @epoch/agent-protocol that every versioned Epoch contract reference
 * already uses. Parsing is numeric; the string form is admitted by the
 * house pattern (which, like the agent/action protocols, tolerates leading
 * zeros — "01.2.3" parses as 1.2.3; strict-semver leading-zero rejection
 * is recorded as a limitation in the W007 PR).
 *
 * Constraint semantics (R18 — versioned capabilities, no floating
 * references):
 * - `exact` — the candidate must equal the pinned version.
 * - `caret` — major-version compatibility with the npm-caret 0.x
 *   carve-outs: `^M.m.p` admits `>=M.m.p <(M+1).0.0` for M > 0;
 *   `^0.m.p` admits `>=0.m.p <0.(m+1).0` for m > 0; `^0.0.p` admits
 *   exactly `0.0.p`.
 *
 * DELIBERATE DUPLICATION (Tech Lead pin): @epoch/adapter-sdk carries an
 * identical self-contained module because W007's two packages share NO
 * runtime coupling beyond @epoch/agent-protocol (the only permitted @epoch
 * runtime dependency). Cross-package drift is pinned by the semver parity
 * test in @epoch/adapter-sdk (devDependency precedent: W006 evidence ->
 * W002 world-model), which runs both implementations over a shared corpus
 * and asserts identical parse/compare/satisfy results.
 */

/** Parsed semver core. */
export interface SemverParts {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/** Outcome of parsing a semver core. */
export type SemverParse =
  | { readonly ok: true; readonly parts: SemverParts }
  | { readonly ok: false; readonly message: string };

/** Parse the numeric triple out of a `major.minor.patch` string. */
export function parseSemverCore(input: string): SemverParse {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(input);
  if (match === null) {
    return {
      ok: false,
      message: `expected a semver core "major.minor.patch" (digits only), encountered ${JSON.stringify(input)}`,
    };
  }
  return {
    ok: true,
    parts: {
      major: Number(match[1]),
      minor: Number(match[2]),
      patch: Number(match[3]),
    },
  };
}

/** Throw on malformed input — only for already-validated versions. */
function expectParts(input: string): SemverParts {
  const parsed = parseSemverCore(input);
  if (!parsed.ok) {
    throw new Error(`not a semver core: ${input}`);
  }
  return parsed.parts;
}

/**
 * Total order over semver cores: negative when `a` precedes `b`, positive
 * when `a` follows `b`, zero on equality. Throws on malformed input
 * (versions are schema-validated before they reach ordering).
 */
export function compareSemver(a: string, b: string): number {
  const left = expectParts(a);
  const right = expectParts(b);
  return compareParts(left, right);
}

/** Order over parsed parts (shared by compareSemver and range checks). */
function compareParts(a: SemverParts, b: SemverParts): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/**
 * A version constraint (R18): consumers resolve against constraints,
 * never floating references. `exact` pins one version; `caret` is
 * major-version compatibility (npm-caret semantics, 0.x carve-outs — see
 * the module docs).
 */
export type VersionConstraint =
  | { readonly kind: 'exact'; readonly version: string }
  | { readonly kind: 'caret'; readonly version: string };

/**
 * Does `candidate` satisfy `constraint`? Total: malformed candidates
 * satisfy nothing (candidates are schema-validated upstream; the total
 * form keeps the resolver free of thrown exceptions).
 */
export function satisfiesVersionConstraint(
  candidate: string,
  constraint: VersionConstraint,
): boolean {
  const candidateParts = parseSemverCore(candidate);
  if (!candidateParts.ok) return false;
  const anchor = parseSemverCore(constraint.version);
  if (!anchor.ok) return false;
  if (constraint.kind === 'exact') {
    return compareParts(candidateParts.parts, anchor.parts) === 0;
  }
  // caret: [anchor, upper) where upper is the next breaking change.
  const { major, minor, patch } = anchor.parts;
  const upper: SemverParts =
    major > 0
      ? { major: major + 1, minor: 0, patch: 0 }
      : minor > 0
        ? { major: 0, minor: minor + 1, patch: 0 }
        : { major: 0, minor: 0, patch: patch + 1 };
  return (
    compareParts(candidateParts.parts, anchor.parts) >= 0 &&
    compareParts(candidateParts.parts, upper) < 0
  );
}
