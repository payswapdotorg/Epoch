/**
 * @epoch/web — the server-side deterministic product fixture bundle (W047).
 *
 * Loads the COMMITTED W046 deterministic fixture set (qa/fixtures/) and
 * verifies every file byte-for-byte against the committed registry digests
 * (qa/fixtures/registry.json) BEFORE anything else uses it. The fixture
 * files are deployment configuration + authoritative snapshot records the
 * product restores into the REAL kernels (see product-runtime.ts).
 *
 * Determinism: the bundle is read once per process; the registry pins
 * per-file SHA-256 digests; a digest mismatch throws at boot (fail-closed).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { sha256Hex, type JsonValue } from '@epoch/agent-protocol';

/** One fixture domain handled by the product runtime. */
export type ProductDomain = 'construction' | 'software';

/** The domains, deterministic order. */
export const PRODUCT_DOMAINS: readonly ProductDomain[] = ['construction', 'software'];

/**
 * The loaded fixture bundle of one domain (the committed bytes, verified).
 * Structural types only — semantic validation belongs to the kernels.
 */
export interface FixtureBundle {
  readonly domain: ProductDomain;
  readonly fixtureId: string;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly files: Readonly<Record<string, JsonValue>>;
  readonly digests: Readonly<Record<string, string>>;
  readonly principals: readonly {
    readonly principalId: string;
    readonly displayName: string;
    readonly kind: string;
  }[];
  readonly committedAuthentication: {
    readonly resultId: string;
    readonly resultDigest: string;
    readonly principalId: string;
    readonly outcome: string;
  };
}

interface RegistryFileEntry {
  readonly file: string;
  readonly sha256: string;
}

interface RegistryDomainEntry {
  readonly domain: ProductDomain;
  readonly fixtureId: string;
  readonly files: readonly RegistryFileEntry[];
  readonly worldDigest: string;
  readonly solutionContentDigest: string;
  readonly programContentDigest: string;
  readonly deliveryContentDigest: string;
  readonly evidenceDigest: string;
  readonly objectBytesDigest: string;
}

/** The per-domain fixture file names (the W046 set). */
const FIXTURE_FILES: readonly string[] = [
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
];

/** The fixture object bytes (the deterministic field-capture artifacts). */
const FIXTURE_OBJECT_BYTES: Readonly<Record<ProductDomain, Uint8Array>> = {
  construction: new Uint8Array([99, 111, 110, 115, 116, 114, 117, 99, 116, 105, 111, 110, 45, 102, 105, 101, 108, 100, 45, 99, 97, 112, 116, 117, 114, 101]),
  software: new Uint8Array([115, 111, 102, 116, 119, 97, 114, 101, 45, 102, 105, 101, 108, 100, 45, 99, 97, 112, 116, 117, 114, 101]),
};

/** Resolve the fixtures directory (repo checkout under test/build run). */
function fixturesRoot(): string {
  const override = process.env['EPOCH_FIXTURES_DIR'];
  if (override !== undefined && override !== '') return override;
  // `next dev`/`next start`/vitest run with cwd = apps/web.
  const fromApp = path.resolve(process.cwd(), '..', '..', 'qa', 'fixtures');
  try {
    readFileSync(path.join(fromApp, 'registry.json'));
    return fromApp;
  } catch {
    // Running from the repository root.
    return path.resolve(process.cwd(), 'qa', 'fixtures');
  }
}

function readJson(file: string): JsonValue {
  return JSON.parse(readFileSync(file, 'utf8')) as JsonValue;
}

function asRecord(value: JsonValue): Record<string, JsonValue> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, JsonValue>;
  }
  throw new Error('expected a JSON object');
}

/** Load + verify one domain bundle against the registry. */
function loadBundle(domain: ProductDomain, root: string, registry: RegistryDomainEntry): FixtureBundle {
  const dir = path.join(root, domain);
  const files: Record<string, JsonValue> = {};
  const digests: Record<string, string> = {};
  for (const file of FIXTURE_FILES) {
    const text = readFileSync(path.join(dir, file), 'utf8');
    const digest = sha256Hex(text);
    const registered = registry.files.find((entry) => entry.file === file);
    if (registered === undefined) throw new Error(`registry has no entry for ${domain}/${file}`);
    if (registered.sha256 !== digest) {
      throw new Error(`fixture digest mismatch for ${domain}/${file}: committed ${registered.sha256}, actual ${digest}`);
    }
    files[file] = JSON.parse(text) as JsonValue;
    digests[file] = digest;
  }

  const identity = asRecord(files['identity.json']!);
  const principals = (identity['principals'] as readonly JsonValue[]).map((entry) => {
    const record = asRecord(entry);
    const principal = asRecord(record['principal']!);
    return {
      principalId: String(principal['principalId']),
      displayName: String(principal['displayName']),
      kind: String(principal['kind']),
    };
  });
  const committedAuth = asRecord((identity['authenticationResults'] as readonly JsonValue[])[0]!);
  const committedResult = asRecord(committedAuth['result']!);

  const tenancy = asRecord(files['tenancy.json']!);
  const records = tenancy['records'] as readonly JsonValue[];
  const nodeOf = (kind: string): Record<string, JsonValue> => {
    const found = records.find(
      (entry) => asRecord(asRecord(entry)['node']!)['kind'] === kind,
    );
    if (found === undefined) throw new Error(`fixture tenancy for ${domain} lacks a ${kind} node`);
    return asRecord(asRecord(found)['node']!);
  };
  const tenantNode = nodeOf('tenant');
  const workspaceNode = nodeOf('workspace');
  const projectNode = nodeOf('project');

  return {
    domain,
    fixtureId: registry.fixtureId,
    tenantId: String(tenantNode['nodeId']),
    workspaceId: String(workspaceNode['nodeId']),
    projectId: String(projectNode['nodeId']),
    files,
    digests,
    principals,
    committedAuthentication: {
      resultId: String(committedResult['resultId']),
      resultDigest: String(committedAuth['resultDigest']),
      principalId: String(committedResult['principalId']),
      outcome: String(committedResult['outcome']),
    },
  };
}

/** All domain bundles, loaded + verified once per process. */
export function loadFixtureBundles(): ReadonlyMap<ProductDomain, FixtureBundle> {
  const root = fixturesRoot();
  const registryFile = readFileSync(path.join(root, 'registry.json'));
  const registry = asRecord(JSON.parse(registryFile.toString('utf8')) as JsonValue);
  const domains = registry['domains'] as readonly JsonValue[];
  const bundles = new Map<ProductDomain, FixtureBundle>();
  for (const entry of domains) {
    const domainEntry = entry as unknown as RegistryDomainEntry;
    bundles.set(domainEntry.domain, loadBundle(domainEntry.domain, root, domainEntry));
  }
  if (bundles.size !== PRODUCT_DOMAINS.length) {
    throw new Error(`expected ${PRODUCT_DOMAINS.length} fixture domains, found ${bundles.size}`);
  }
  return bundles;
}

/** The fixture object bytes of one domain (digest-addressed evidence artifact). */
export function fixtureObjectBytes(domain: ProductDomain): Uint8Array {
  return FIXTURE_OBJECT_BYTES[domain];
}

/** The per-domain anchor digests from the registry (journey evidence). */
export function registryAnchors(
  bundles: ReadonlyMap<ProductDomain, FixtureBundle>,
): ReadonlyMap<ProductDomain, {
  readonly worldDigest: string;
  readonly solutionContentDigest: string;
  readonly programContentDigest: string;
  readonly deliveryContentDigest: string;
  readonly evidenceDigest: string;
  readonly objectBytesDigest: string;
}> {
  const root = fixturesRoot();
  const registry = asRecord(JSON.parse(readFileSync(path.join(root, 'registry.json'), 'utf8')) as JsonValue);
  const anchors = new Map<ProductDomain, {
    readonly worldDigest: string;
    readonly solutionContentDigest: string;
    readonly programContentDigest: string;
    readonly deliveryContentDigest: string;
    readonly evidenceDigest: string;
    readonly objectBytesDigest: string;
  }>();
  for (const entry of registry['domains'] as readonly JsonValue[]) {
    const domainEntry = entry as unknown as RegistryDomainEntry;
    if (!bundles.has(domainEntry.domain)) continue;
    anchors.set(domainEntry.domain, {
      worldDigest: domainEntry.worldDigest,
      solutionContentDigest: domainEntry.solutionContentDigest,
      programContentDigest: domainEntry.programContentDigest,
      deliveryContentDigest: domainEntry.deliveryContentDigest,
      evidenceDigest: domainEntry.evidenceDigest,
      objectBytesDigest: domainEntry.objectBytesDigest,
    });
  }
  return anchors;
}

void readJson;
