/**
 * @epoch/desktop — the deterministic fixture source seam (W048).
 *
 * Loads the W046 product fixtures (qa/fixtures — the SAME fixtures the
 * web product uses) for the embedded gateway binding. The seam is
 * environment-neutral: the Node source (node:fs + node:crypto) and the
 * webview source (fetch + SubtleCrypto) live in SEPARATE modules so the
 * webview bundle never carries Node builtins; both verify per-file
 * digests against qa/fixtures/registry.json so a corrupted bundle cannot
 * seed the embedded gateway.
 */
import type { JsonValue } from '@epoch/agent-protocol';

/** One fixture domain. */
export type FixtureDomain = 'construction' | 'software';

/** The fixture file names per domain (the W046 fixture contract). */
export const FIXTURE_FILES = [
  'tenancy.json',
  'identity.json',
  'world.json',
  'solution.json',
  'program-of-work.json',
  'delivery.json',
  'evidence.json',
  'scenario-j07.json',
  'scenario-j08.json',
  'scenario-j11.json',
] as const;

/** The registry shape (qa/fixtures/registry.json). */
export interface FixtureRegistry {
  readonly fixtureVersion: string;
  readonly domains: readonly {
    readonly domain: string;
    readonly fixtureId: string;
    readonly worldDigest: string;
    readonly solutionContentDigest: string;
    readonly programContentDigest: string;
    readonly deliveryContentDigest: string;
    readonly evidenceDigest: string;
    readonly objectBytesDigest: string;
    readonly files: readonly { readonly file: string; readonly sha256: string }[];
  }[];
}

/** A loaded fixture bundle (one domain, all files + the registry digests). */
export interface FixtureBundle {
  readonly domain: FixtureDomain;
  readonly fixtureId: string;
  readonly files: Readonly<Record<string, JsonValue>>;
  readonly digests: Readonly<Record<string, string>>;
  readonly worldDigest: string;
  readonly solutionContentDigest: string;
  readonly programContentDigest: string;
  readonly deliveryContentDigest: string;
  readonly evidenceDigest: string;
  readonly objectBytesDigest: string;
}

/** The fixture-loading seam (environment-neutral). */
export interface FixtureSource {
  loadRegistry(): Promise<FixtureRegistry>;
  /** Load one fixture file; implementations verify the registry digest. */
  loadFile(domain: FixtureDomain, file: string): Promise<JsonValue>;
}

/** Refuse a digest mismatch (typed refusal — never seed from drifted bytes). */
export function refuseFixtureDigestMismatch(file: string, expected: string, actual: string): Error {
  return new Error(
    `fixture digest mismatch for ${file}: registry says ${expected}, loaded bytes hash to ${actual}`,
  );
}

/** Load + verify one domain's fixture bundle through a source. */
export async function loadFixtureBundle(
  source: FixtureSource,
  domain: FixtureDomain,
): Promise<FixtureBundle> {
  const registry = await source.loadRegistry();
  const entry = registry.domains.find((candidate) => candidate.domain === domain);
  if (entry === undefined) {
    throw new Error(`the fixture registry carries no "${domain}" domain`);
  }
  const files: Record<string, JsonValue> = {};
  const digests: Record<string, string> = {};
  for (const descriptor of entry.files) {
    files[descriptor.file] = await source.loadFile(domain, descriptor.file);
    digests[descriptor.file] = descriptor.sha256;
  }
  return {
    domain,
    fixtureId: entry.fixtureId,
    files,
    digests,
    worldDigest: entry.worldDigest,
    solutionContentDigest: entry.solutionContentDigest,
    programContentDigest: entry.programContentDigest,
    deliveryContentDigest: entry.deliveryContentDigest,
    evidenceDigest: entry.evidenceDigest,
    objectBytesDigest: entry.objectBytesDigest,
  };
}
