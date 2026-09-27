// Provider-neutrality evidence (architecture lock rule 13): the provider's
// vocabulary stays INSIDE src/provider — the neutral seam modules (the
// public record shapes, descriptors, registration manifests, envelope
// schemas) contain NO provider tokens. This is the per-adapter named
// blocklist test required by the work order.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalJsonStringify, type JsonValue } from '@epoch/agent-protocol';
import {
  GITHUB_ADAPTER_DESCRIPTORS,
  deriveCapabilityRegistrations,
} from '../src/index';

/**
 * Provider tokens that must NEVER appear in the neutral seam (the
 * provider's own names, shorthand, and revision-hash vocabulary; also the
 * competing hosted-workspace providers, to prevent vocabulary drift
 * toward any vendor).
 */
const BLOCKLIST = [
  'github',
  'gitlab',
  'bitbucket',
  'gitea',
  'gists',
  'octocat',
  'repo',
  'commit',
  'branch',
  'pull-request',
  'pull request',
  'merge-request',
  'merge request',
  'sha1',
  'sshkey',
];

/**
 * The NEUTRAL seam modules: every src file EXCEPT the quarantined
 * provider layer (src/provider/**) and the compile-time parity module
 * (src/parity.ts references sibling kernel type names for pinning only).
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
function scanForTokens(content: string, source: string, wordBoundary = true): string[] {
  const lower = content.toLowerCase();
  const hits: string[] = [];
  for (const token of BLOCKLIST) {
    const found = wordBoundary
      ? new RegExp(`\\b${token.replace(/[-\s]/g, (m) => (m === '-' ? '\\-' : '\\s'))}\\b`).test(lower)
      : lower.includes(token);
    if (found) hits.push(`${source}: "${token}"`);
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

  it('no provider token appears in the serialized W007 descriptors', () => {
    const hits: string[] = [];
    for (const descriptor of GITHUB_ADAPTER_DESCRIPTORS) {
      hits.push(...scanForTokens(canonicalJsonStringify(descriptor as unknown as JsonValue), descriptor.adapterId, false));
    }
    expect(hits).toEqual([]);
  });

  it('no provider token appears in the derived W007 registration manifests', () => {
    const hits: string[] = [];
    for (const registration of deriveCapabilityRegistrations()) {
      hits.push(
        ...scanForTokens(
          canonicalJsonStringify(registration.manifest as unknown as JsonValue),
          registration.manifest.capabilityId,
          false,
        ),
      );
    }
    expect(hits).toEqual([]);
  });

  it('the provider layer is the ONLY place provider vocabulary lives (quarantine check)', () => {
    const providerFiles = readdirSync(PROVIDER_DIR).filter((file) => file.endsWith('.ts'));
    expect(providerFiles.length).toBeGreaterThan(0);
    // The provider layer MUST name its own provider identity (the fixture
    // envelope pins the service literal) — proving the quarantine is real.
    const payload = readFileSync(join(PROVIDER_DIR, 'payload.ts'), 'utf8');
    expect(payload.toLowerCase().includes('github')).toBe(true);
  });
});
