// Provider-neutrality evidence (architecture lock rule 13): the
// co-simulation standard's vocabulary stays INSIDE src/provider — the
// neutral seam modules (the public record shapes, descriptors,
// registration manifests, envelope schemas) contain NO standard tokens.
// This is the per-adapter named blocklist test required by the work
// order.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalJsonStringify, type JsonValue } from '@epoch/agent-protocol';
import { deriveCapabilityRegistrations, deriveParticipantRegistration } from '../src/index';
import { referenceParticipantTyped } from './helpers';

/**
 * Co-simulation-standard tokens that must NEVER appear in the neutral
 * seam (the standard's own names and model-description vocabulary; also
 * related standard-family vocabulary, to prevent drift toward any
 * specific standard).
 */
const BLOCKLIST = [
  'fmi',
  'fmu',
  'fmus',
  'fmpy',
  'modeldescription',
  'functional-mock-up',
  'functional mock-up',
  'cosimulation',
  'causality',
  'variability',
  'initial-unknown',
  'tolerance-controlled',
  'model-exchange',
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
    if (new RegExp(`\\b${token.replace(/[-\s]/g, (m) => (m === '-' ? '\\-' : '\\s'))}\\b`).test(lower)) hits.push(`${source}: "${token}"`);
  }
  return hits;
}

describe('provider-name blocklist (the neutral seam)', () => {
  it('no standard token appears in any neutral seam source module (code scan, comments stripped)', () => {
    const hits: string[] = [];
    for (const file of neutralSourceFiles()) {
      hits.push(...scanCode(stripComments(readFileSync(file, 'utf8')), file));
    }
    expect(hits).toEqual([]);
  });

  it('no standard token appears in the serialized W007 descriptor + registration manifests', () => {
    const hits: string[] = [];
    for (const registration of deriveCapabilityRegistrations()) {
      hits.push(
        ...scanSerialized(
          canonicalJsonStringify(registration.manifest as unknown as JsonValue),
          registration.manifest.capabilityId,
        ),
      );
    }
    expect(hits).toEqual([]);
  });

  it('no standard token appears in the derived W005 registration document', () => {
    const derived = deriveParticipantRegistration({ participant: referenceParticipantTyped() });
    const hits = scanSerialized(
      canonicalJsonStringify(derived.registration as unknown as JsonValue),
      derived.registration.simulatorId,
    );
    expect(hits).toEqual([]);
  });

  it('the provider layer is the ONLY place the standard vocabulary lives (quarantine check)', () => {
    const providerFiles = readdirSync(PROVIDER_DIR).filter((file) => file.endsWith('.ts'));
    expect(providerFiles.length).toBeGreaterThan(0);
    // The provider layer MUST name its own standard identity (the fixture
    // envelope pins the standard literal) — proving the quarantine is real.
    const payload = readFileSync(join(PROVIDER_DIR, 'payload.ts'), 'utf8');
    expect(payload.toLowerCase().includes('fmi')).toBe(true);
  });
});
