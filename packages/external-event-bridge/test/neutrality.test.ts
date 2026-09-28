// PROVIDER NEUTRALITY (architecture lock rule 13) + LIFECYCLE
// NEUTRALITY (the universal-domain invariants): two named source-scan
// tests over THIS kernel's source:
//
// - provider-vocabulary-rejected: NO provider token (the reference
//   chat provider's names, its competitors', and generic messaging
//   vocabulary) appears ANYWHERE in the kernel source — the kernel is
//   provider-neutral by construction (the W029 blocklist pattern);
// - pack-branching-rejected: NO domain-pack token (the merged packs'
//   vocabularies) appears in the kernel CODE — the bridge is
//   lifecycle-neutral and may acquire information or relay supervision
//   for ANY domain pack, so zero pack-specific branches exist.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJsonStringify, type JsonValue } from '@epoch/agent-protocol';
import {
  EXTERNAL_EVENT_BRIDGE_SCHEMA_SURFACE,
  CORE_RECORD_SURFACE,
} from '../src/index';

const here = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(here, '..', 'src');

/** All kernel source files (including the parity module — the kernel NEVER names a provider). */
function kernelSourceFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (full.endsWith('.ts')) {
        files.push(full);
      }
    }
  };
  walk(SRC_DIR);
  return files.sort();
}

/** Strip block + line comments (the CODE scan covers identifiers + literals). */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:'"])\/\/.*$/gm, '$1');
}

/** Word-boundary scan (substrings inside identifiers like "reported" do not match). */
function scanForTokens(content: string, source: string, blocklist: readonly string[]): string[] {
  const lower = content.toLowerCase();
  const hits: string[] = [];
  for (const token of blocklist) {
    const pattern = new RegExp(`\\b${token.replace(/[-\s]/g, (m) => (m === '-' ? '\\-' : '\\s'))}\\b`);
    if (pattern.test(lower)) hits.push(`${source}: "${token}"`);
  }
  return hits;
}

/** The provider-vocabulary blocklist: the reference chat provider, its competitors, generic messaging vocabulary. */
const PROVIDER_BLOCKLIST = [
  'aurum',
  'slack',
  'msteams',
  'whatsapp',
  'telegram',
  'discord',
  'wechat',
  'messenger',
  'jabber',
  'xmpp',
  'sms',
  'chatroom',
];

/** The pack-vocabulary blocklist: the merged domain packs' tokens (code scan only). */
const PACK_BLOCKLIST = [
  'construction',
  'software-implementation',
  'infrastructure-provisioning',
  'electrical-installation',
  'mechanical-fabrication',
  'field-service',
  'earthworks',
  'bim',
  'ifc',
  'gis',
];

describe('provider-vocabulary-rejected (the kernel never names a provider)', () => {
  it('no provider token appears in ANY kernel source module (code scan, comments stripped)', () => {
    const hits: string[] = [];
    for (const file of kernelSourceFiles()) {
      hits.push(...scanForTokens(stripComments(readFileSync(file, 'utf8')), file, PROVIDER_BLOCKLIST));
    }
    expect(hits).toEqual([]);
  });

  it('no provider token appears even in the kernel COMMENTS and doc blocks (full-file scan)', () => {
    const hits: string[] = [];
    for (const file of kernelSourceFiles()) {
      hits.push(...scanForTokens(readFileSync(file, 'utf8'), file, PROVIDER_BLOCKLIST));
    }
    expect(hits).toEqual([]);
  });

  it('no provider token appears in the serialized contract surface manifests', () => {
    const hits: string[] = [];
    for (const entry of [...EXTERNAL_EVENT_BRIDGE_SCHEMA_SURFACE, ...CORE_RECORD_SURFACE]) {
      const serialized = canonicalJsonStringify({ type: entry.type } as unknown as JsonValue);
      hits.push(...scanForTokens(serialized, entry.type, PROVIDER_BLOCKLIST));
    }
    expect(hits).toEqual([]);
  });
});

describe('pack-branching-rejected (the kernel is lifecycle-neutral)', () => {
  it('no domain-pack token appears in the kernel CODE (comments stripped)', () => {
    const hits: string[] = [];
    for (const file of kernelSourceFiles()) {
      hits.push(...scanForTokens(stripComments(readFileSync(file, 'utf8')), file, PACK_BLOCKLIST));
    }
    expect(hits).toEqual([]);
  });

  it('no pack-specific branch exists in the runtime host (source scan for pack discriminators)', () => {
    const runtimeSource = readFileSync(join(SRC_DIR, 'runtime.ts'), 'utf8');
    const code = stripComments(runtimeSource);
    // No switch/if branching over a pack identifier namespace:
    expect(/(?:switch|if)\s*\([^)]*(?:pack|domain)/i.test(code)).toBe(false);
    expect(code).not.toMatch(/['"`](?:construction|software|procurement|fabrication|electrical|mechanical):/);
  });
});
