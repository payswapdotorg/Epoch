/**
 * @epoch/desktop — the Node filesystem fixture source (W048).
 *
 * Node-only (node:fs + node:crypto): the journey runner, the test
 * battery and dev tooling load qa/fixtures from the repository. NEVER
 * imported from webview/client code (the browser bundle would not carry
 * Node builtins) — the webview uses web-fixture-source.ts instead.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { refuseFixtureDigestMismatch, type FixtureBundle, type FixtureDomain, type FixtureRegistry, type FixtureSource } from './fixture-source';

/** The repository root (five levels up from src/native/embedded). */
export function repoFixtureRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '..', '..', '..', '..', '..');
}

/** The Node filesystem fixture source (qa/fixtures in the repository). */
export class NodeFsFixtureSource implements FixtureSource {
  private readonly root: string;
  private registry: FixtureRegistry | null = null;

  constructor(options: { readonly fixtureRoot?: string } = {}) {
    this.root = options.fixtureRoot ?? path.join(repoFixtureRoot(), 'qa', 'fixtures');
  }

  async loadRegistry(): Promise<FixtureRegistry> {
    if (this.registry === null) {
      this.registry = JSON.parse(readFileSync(path.join(this.root, 'registry.json'), 'utf8')) as FixtureRegistry;
    }
    return this.registry;
  }

  async loadFile(domain: FixtureDomain, file: string): Promise<import('@epoch/agent-protocol').JsonValue> {
    const text = readFileSync(path.join(this.root, domain, file), 'utf8');
    const registry = await this.loadRegistry();
    const descriptor = registry.domains
      .find((candidate) => candidate.domain === domain)
      ?.files.find((candidate) => candidate.file === file);
    if (descriptor !== undefined) {
      const actual = createHash('sha256').update(text, 'utf8').digest('hex');
      if (actual !== descriptor.sha256) {
        throw refuseFixtureDigestMismatch(file, descriptor.sha256, actual);
      }
    }
    return JSON.parse(text) as import('@epoch/agent-protocol').JsonValue;
  }
}

/** Synchronous bundle load (Node tooling convenience). */
export function loadFixtureBundleSync(domain: FixtureDomain, fixtureRoot?: string): FixtureBundle {
  const root = fixtureRoot ?? path.join(repoFixtureRoot(), 'qa', 'fixtures');
  const registry = JSON.parse(readFileSync(path.join(root, 'registry.json'), 'utf8')) as FixtureRegistry;
  const entry = registry.domains.find((candidate) => candidate.domain === domain);
  if (entry === undefined) throw new Error(`the fixture registry carries no "${domain}" domain`);
  const files: Record<string, import('@epoch/agent-protocol').JsonValue> = {};
  const digests: Record<string, string> = {};
  for (const descriptor of entry.files) {
    const text = readFileSync(path.join(root, domain, descriptor.file), 'utf8');
    const actual = createHash('sha256').update(text, 'utf8').digest('hex');
    if (actual !== descriptor.sha256) {
      throw refuseFixtureDigestMismatch(descriptor.file, descriptor.sha256, actual);
    }
    files[descriptor.file] = JSON.parse(text) as import('@epoch/agent-protocol').JsonValue;
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
