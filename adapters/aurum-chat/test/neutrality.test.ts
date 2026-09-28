// PROVIDER NEUTRALITY (the per-adapter blocklist test, the W029
// pattern): the provider's vocabulary stays INSIDE src/provider — the
// neutral seam modules (the public adapter surface, descriptors,
// registration manifests) contain NO provider tokens. The provider
// blocklist covers the quarantined service's names, shorthand, and
// competing team-chat providers, to prevent vocabulary drift toward
// any vendor.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalJsonStringify, type JsonValue } from '@epoch/agent-protocol';
import {
  CHAT_PROVIDER_ADAPTER_DESCRIPTOR,
  deriveCapabilityRegistrations,
} from '../src/index';

/**
 * Provider tokens that must NEVER appear in the neutral seam (the
 * quarantined service's own names and shorthand; also the competing
 * team-chat providers, to prevent vocabulary drift toward any vendor).
 */
const BLOCKLIST = [
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
  'chatroom',
];

/**
 * The NEUTRAL seam modules: every src file EXCEPT the quarantined
 * provider layer (src/provider/**) and the compile-time parity module
 * (src/parity.ts references sibling kernel type names for pinning
 * only).
 */
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

/** Word-boundary scan (substrings inside identifiers like "reported" do not match). */
function scanForTokens(content: string, source: string): string[] {
  const lower = content.toLowerCase();
  const hits: string[] = [];
  for (const token of BLOCKLIST) {
    const pattern = new RegExp(`\\b${token.replace(/[-\s]/g, (m) => (m === '-' ? '\\-' : '\\s'))}\\b`);
    if (pattern.test(lower)) hits.push(`${source}: "${token}"`);
  }
  return hits;
}

describe('provider-name blocklist (the neutral seam)', () => {
  it('no provider token appears in any neutral seam source module (code scan, comments stripped)', () => {
    const hits: string[] = [];
    for (const file of neutralSourceFiles()) {
      hits.push(...scanForTokens(stripComments(readFileSync(file, 'utf8')), file));
    }
    expect(hits).toEqual([]);
  });

  it('no provider token appears in the serialized W007 descriptor', () => {
    const hits = scanForTokens(
      canonicalJsonStringify(CHAT_PROVIDER_ADAPTER_DESCRIPTOR as unknown as JsonValue),
      CHAT_PROVIDER_ADAPTER_DESCRIPTOR.adapterId,
    );
    expect(hits).toEqual([]);
  });

  it('no provider token appears in the derived capability registrations', () => {
    const hits: string[] = [];
    for (const registration of deriveCapabilityRegistrations()) {
      hits.push(
        ...scanForTokens(
          canonicalJsonStringify(registration as unknown as JsonValue),
          registration.manifest.capabilityId,
        ),
      );
    }
    expect(hits).toEqual([]);
  });

  it('the quarantined provider layer exists (vocabulary stays quarantined, never deleted)', () => {
    const providerFiles = readdirSync(PROVIDER_DIR).filter((name) => name.endsWith('.ts'));
    expect(providerFiles.length).toBeGreaterThanOrEqual(2);
  });
});
