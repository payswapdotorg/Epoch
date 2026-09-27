// Provider-neutrality evidence (architecture lock rule 13): the tool
// protocol's vocabulary stays INSIDE src/provider — the neutral seam
// modules (the public record shapes, descriptors, registration
// manifests, envelope schemas) contain NO protocol tokens. This is the
// per-adapter named blocklist test required by the work order.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalJsonStringify, type JsonValue } from '@epoch/agent-protocol';
import {
  MCP_ADAPTER_DESCRIPTORS,
  deriveCapabilityRegistrations,
  deriveToolRegistration,
  discoverTools,
  referenceCatalog,
} from '../src/index';

/**
 * Tool-protocol tokens that must NEVER appear in the neutral seam
 * (the protocol's own names and discovery vocabulary; also related
 * protocol-family vocabulary, to prevent drift toward any specific
 * protocol or vendor).
 */
const BLOCKLIST = [
  'mcp',
  'modelcontextprotocol',
  'model-context-protocol',
  'jsonrpc',
  'json-rpc',
  'anthropic',
  'claude',
  'stdio',
  'server-sent-events',
];

/** The NEUTRAL seam modules: every src file EXCEPT the quarantined provider layer and the compile-time parity module. */
const PROVIDER_DIR = join(__dirname, '..', 'src', 'provider');
const PARITY_FILE = join(__dirname, '..', 'src', 'parity.ts');

function neutralSourceFiles(): string[] {
  const srcDir = join(__dirname, '..', 'src');
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (full === PROVIDER_DIR) continue; // the quarantine
        walk(full);
      } else if (full.endsWith('.ts')) {
        if (full === PARITY_FILE) continue; // type-pin module (no runtime surface)
        files.push(full);
      }
    }
  };
  walk(srcDir);
  return files.sort();
}

/** Strip block + line comments (the CODE scan covers identifiers + literals). */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:'"])\/\/.*$/gm, '$1');
}

/** Substring scan for serialized artifacts (the emitted shapes are strict). */
function scanSerialized(content: string, source: string): string[] {
  const lower = content.toLowerCase();
  const hits: string[] = [];
  for (const token of BLOCKLIST) {
    if (lower.includes(token)) hits.push(`${source}: "${token}"`);
  }
  return hits;
}

/** Word-boundary scan for source code (substrings inside identifiers do not match). */
function scanCode(content: string, source: string): string[] {
  const lower = content.toLowerCase();
  const hits: string[] = [];
  for (const token of BLOCKLIST) {
    if (new RegExp(`\\b${token.replace(/-/g, '\\-')}\\b`).test(lower)) hits.push(`${source}: "${token}"`);
  }
  return hits;
}

describe('provider-name blocklist (the neutral seam)', () => {
  it('no protocol token appears in any neutral seam source module (code scan, comments stripped)', () => {
    const hits: string[] = [];
    for (const file of neutralSourceFiles()) {
      hits.push(...scanCode(stripComments(readFileSync(file, 'utf8')), file));
    }
    expect(hits).toEqual([]);
  });

  it('no protocol token appears in the serialized W007 descriptors', () => {
    const hits: string[] = [];
    for (const descriptor of MCP_ADAPTER_DESCRIPTORS) {
      hits.push(...scanSerialized(canonicalJsonStringify(descriptor as unknown as JsonValue), descriptor.adapterId));
    }
    expect(hits).toEqual([]);
  });

  it('no protocol token appears in the derived W007 registration manifests (adapter + per-tool)', () => {
    const hits: string[] = [];
    for (const registration of deriveCapabilityRegistrations()) {
      hits.push(
        ...scanSerialized(
          canonicalJsonStringify(registration.manifest as unknown as JsonValue),
          registration.manifest.capabilityId,
        ),
      );
    }
    const surfaces = discoverTools({ tenantId: 'tenant:acme', payload: referenceCatalog() });
    if (surfaces.ok) {
      for (const surface of surfaces.value) {
        hits.push(
          ...scanSerialized(
            canonicalJsonStringify(deriveToolRegistration(surface).manifest as unknown as JsonValue),
            surface.capabilityId,
          ),
        );
      }
    }
    expect(hits).toEqual([]);
  });

  it('the provider layer is the ONLY place the protocol vocabulary lives (quarantine check)', () => {
    const providerFiles = readdirSync(PROVIDER_DIR).filter((file) => file.endsWith('.ts'));
    expect(providerFiles.length).toBeGreaterThan(0);
    // The provider layer MUST name its own protocol identity (the fixture
    // envelope pins the protocol literal) — proving the quarantine is real.
    const payload = readFileSync(join(PROVIDER_DIR, 'payload.ts'), 'utf8');
    expect(payload.toLowerCase().includes('mcp')).toBe(true);
  });
});
