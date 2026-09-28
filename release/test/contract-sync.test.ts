// THE CONTRACT-SYNC EVIDENCE (W035): the SDK DOCUMENTATION and the
// EXAMPLES cite the EXACT contract versions the real packages export —
// a drifted pin is a failed release-readiness item by construction. This
// is the machine check behind the `sdk-contract-synced` checklist items:
// it reads the committed doc fixtures (deterministic — content-addressed
// by git) and compares every declared version pin against the REAL
// constants imported from the workspace packages.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ADAPTER_SDK_CONTRACT_VERSION, ADAPTER_SDK_SCHEMA_SURFACE } from '@epoch/adapter-sdk';
import {
  CAPABILITY_REGISTRY_CONTRACT_VERSION,
  CAPABILITY_REGISTRY_SCHEMA_SURFACE,
} from '@epoch/capability-registry';
import { EXTENSION_SDK_CONTRACT_VERSION, EXTENSION_SDK_SCHEMA_SURFACE } from '@epoch/extension-sdk';
import { MARKETPLACE_CONTRACT_VERSION } from '@epoch/marketplace';

const here = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));
const repoRoot = here('../..');

describe('the SDK version matrix is synced with the real packages', () => {
  const matrix = repoRoot + '/docs/sdk/sdk-versions.md';
  const documented = readFileSync(matrix, 'utf8');

  it('documents the exact adapter-sdk contract version', () => {
    expect(documented).toContain(`| \`@epoch/adapter-sdk\` | \`${ADAPTER_SDK_CONTRACT_VERSION}\` |`);
  });

  it('documents the exact capability-registry contract version', () => {
    expect(documented).toContain(`| \`@epoch/capability-registry\` | \`${CAPABILITY_REGISTRY_CONTRACT_VERSION}\` |`);
  });

  it('documents the exact extension-sdk contract version', () => {
    expect(documented).toContain(`| \`@epoch/extension-sdk\` | \`${EXTENSION_SDK_CONTRACT_VERSION}\` |`);
  });

  it('documents the exact marketplace contract version', () => {
    expect(documented).toContain(`| \`@epoch/marketplace\` | \`${MARKETPLACE_CONTRACT_VERSION}\` |`);
  });

  it('documents the exact schema-surface sizes of the three W007/W008 SDK surfaces', () => {
    expect(documented).toContain(`${ADAPTER_SDK_SCHEMA_SURFACE.length} committed JSON Schema files`);
    expect(documented).toContain(`${CAPABILITY_REGISTRY_SCHEMA_SURFACE.length} committed JSON Schema files`);
    expect(documented).toContain(`${EXTENSION_SDK_SCHEMA_SURFACE.length} committed JSON Schema files`);
  });
});

describe('every pinned SDK doc file exists', () => {
  const pins: readonly [string, string][] = [
    ['adapter-sdk', 'docs/sdk/adapter-sdk-guide.md'],
    ['capability-registry', 'docs/sdk/capability-registry-guide.md'],
    ['extension-sdk', 'docs/sdk/extension-sdk-guide.md'],
    ['marketplace', 'docs/sdk/marketplace-listing-guide.md'],
  ];

  for (const [surfaceId, docPath] of pins) {
    it(`the ${surfaceId} pin points at an existing doc`, () => {
      expect(() => readFileSync(repoRoot + '/' + docPath, 'utf8')).not.toThrow();
    });
  }

  it('the release documentation set exists', () => {
    for (const docPath of [
      'docs/release/README.md',
      'docs/release/release-process.md',
      'docs/release/readiness-gate-policy.md',
      'docs/release/release-notes-e1.md',
    ]) {
      expect(() => readFileSync(repoRoot + '/' + docPath, 'utf8')).not.toThrow();
    }
  });

  it('the marketplace readiness documentation set exists', () => {
    for (const docPath of [
      'docs/marketplace-readiness/README.md',
      'docs/marketplace-readiness/readiness-criteria.md',
      'docs/marketplace-readiness/portal-surfaces.md',
    ]) {
      expect(() => readFileSync(repoRoot + '/' + docPath, 'utf8')).not.toThrow();
    }
  });

  it('the examples/sdk README exists and indexes the five examples', () => {
    const readme = readFileSync(repoRoot + '/examples/sdk/README.md', 'utf8');
    for (const module of [
      'capability-registration.ts',
      'adapter-example.ts',
      'extension-example.ts',
      'marketplace-listing-example.ts',
      'release-readiness-example.ts',
    ]) {
      expect(readme).toContain(module);
    }
  });
});

describe('the release notes cite real surfaces', () => {
  it('the E1.0 release notes cite the W034 budget catalog document', () => {
    const notes = readFileSync(repoRoot + '/docs/release/release-notes-e1.md', 'utf8');
    expect(notes).toContain('docs/performance/budget-catalog.md');
  });

  it('the budget ids cited by the release notes exist in the W034 catalog', () => {
    const notes = readFileSync(repoRoot + '/docs/release/release-notes-e1.md', 'utf8');
    const catalog = readFileSync(repoRoot + '/docs/performance/budget-catalog.md', 'utf8');
    const cited = [...notes.matchAll(/`budget:[a-z0-9-]+`/g)].map((match) => match[0]);
    expect(cited.length).toBeGreaterThan(0);
    for (const id of cited) {
      expect(catalog).toContain(id);
    }
  });
});
