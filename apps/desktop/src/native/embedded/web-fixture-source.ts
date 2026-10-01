/**
 * @epoch/desktop — the webview fixture source (W048).
 *
 * Browser-only: fetches the fixtures synced into the static frontend
 * (scripts/sync-fixtures.mjs copies qa/fixtures into public/fixtures and
 * verifies every digest against the registry at build time), and
 * RE-VERIFIES each file's sha256 at load time (SubtleCrypto) so a
 * corrupted bundle cannot seed the embedded gateway.
 */
import { refuseFixtureDigestMismatch, type FixtureDomain, type FixtureRegistry, type FixtureSource } from './fixture-source';

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The webview fixture source: fetch + digest verification. */
export class WebFixtureSource implements FixtureSource {
  constructor(private readonly baseUrl: string = 'fixtures') {}

  async loadRegistry(): Promise<FixtureRegistry> {
    const response = await fetch(`${this.baseUrl}/registry.json`);
    if (!response.ok) throw new Error(`the fixture registry could not be loaded (${response.status})`);
    return (await response.json()) as FixtureRegistry;
  }

  async loadFile(domain: FixtureDomain, file: string): Promise<import('@epoch/agent-protocol').JsonValue> {
    const response = await fetch(`${this.baseUrl}/${domain}/${file}`);
    if (!response.ok) throw new Error(`fixture ${domain}/${file} could not be loaded (${response.status})`);
    const text = await response.text();
    const registry = await this.loadRegistry();
    const descriptor = registry.domains
      .find((candidate) => candidate.domain === domain)
      ?.files.find((candidate) => candidate.file === file);
    if (descriptor !== undefined) {
      const actual = await sha256Hex(text);
      if (actual !== descriptor.sha256) {
        throw refuseFixtureDigestMismatch(file, descriptor.sha256, actual);
      }
    }
    return JSON.parse(text) as import('@epoch/agent-protocol').JsonValue;
  }
}
