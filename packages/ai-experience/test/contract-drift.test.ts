// Contract drift: committed artifacts under packages/ai-experience/schemas
// must be byte-identical to the deterministic emission. Regeneration only
// via EPOCH_UPDATE_CONTRACTS=1 (see src/contract-emission.ts).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderAiExperienceContractFiles, AI_EXPERIENCE_SCHEMA_SURFACE } from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(here, '..', 'schemas');
const UPDATE_MODE = process.env.EPOCH_UPDATE_CONTRACTS === '1';

describe('packages/ai-experience/schemas drift', () => {
  const rendered = renderAiExperienceContractFiles();

  it('renders a manifest plus one schema file per surface type', () => {
    const paths = Object.keys(rendered).sort();
    expect(paths).toContain('manifest.json');
    const schemaFiles = paths.filter((p) => p.endsWith('.schema.json'));
    expect(schemaFiles).toHaveLength(paths.length - 1);
    expect(schemaFiles).toHaveLength(AI_EXPERIENCE_SCHEMA_SURFACE.length);
  });

  it.each(Object.keys(rendered).sort())('committed artifact %s matches emission', (rel) => {
    const target = path.join(CONTRACTS_DIR, rel);
    if (UPDATE_MODE) {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, rendered[rel]!);
      return;
    }
    expect(
      existsSync(target),
      `missing committed artifact: packages/ai-experience/schemas/${rel}`,
    ).toBe(true);
    expect(readFileSync(target, 'utf8')).toBe(rendered[rel]!);
  });

  it('emission is deterministic (two renders are byte-identical)', () => {
    expect(renderAiExperienceContractFiles()).toEqual(rendered);
  });

  it('every emitted schema declares a versioned $id and draft 2020-12', () => {
    for (const [rel, content] of Object.entries(rendered)) {
      if (rel === 'manifest.json') continue;
      const parsed = JSON.parse(content) as { $schema?: string; $id?: string };
      expect(parsed.$schema, rel).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(parsed.$id, rel).toMatch(/^urn:epoch:ai-experience:[a-z0-9-]+:1\.0\.0$/);
    }
  });

  it('the manifest pins the contract and record versions and the data-type list', () => {
    const manifest = JSON.parse(rendered['manifest.json']! as string) as {
      contract: string;
      contractVersion: string;
      recordVersion: number;
      dataTypes: string[];
      schemas: { type: string; file: string; sha256: string }[];
    };
    expect(manifest.contract).toBe('epoch/ai-experience');
    expect(manifest.contractVersion).toBe('1.0.0');
    expect(manifest.recordVersion).toBe(1);
    expect(manifest.dataTypes).toEqual(AI_EXPERIENCE_SCHEMA_SURFACE.map((e) => e.type));
    expect(manifest.schemas).toHaveLength(AI_EXPERIENCE_SCHEMA_SURFACE.length);
    for (const entry of manifest.schemas) {
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
