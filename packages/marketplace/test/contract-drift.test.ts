// Contract drift: the committed artifacts under packages/marketplace/schemas
// must be byte-identical to what the implementation emits. Regeneration is
// only possible through the documented update mode, so artifacts can never
// drift silently from the schemas (the W006 in-package precedent).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderMarketplaceContractFiles, MARKETPLACE_SCHEMA_SURFACE } from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(here, '..', 'schemas');
const UPDATE_MODE = process.env.EPOCH_UPDATE_CONTRACTS === '1';

describe('packages/marketplace/schemas drift', () => {
  const rendered = renderMarketplaceContractFiles();

  it('renders a manifest plus one schema file per surface type', () => {
    const paths = Object.keys(rendered).sort();
    expect(paths).toContain('manifest.json');
    expect(paths.filter((p) => p.endsWith('.schema.json'))).toHaveLength(paths.length - 1);
    expect(paths.filter((p) => p.endsWith('.schema.json'))).toHaveLength(MARKETPLACE_SCHEMA_SURFACE.length);
  });

  it.each(Object.keys(rendered).sort())('committed artifact %s matches emission', (rel) => {
    const target = path.join(CONTRACTS_DIR, rel);
    if (UPDATE_MODE) {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, rendered[rel]!);
      return;
    }
    expect(existsSync(target), `missing committed artifact: packages/marketplace/schemas/${rel}`).toBe(
      true,
    );
    expect(readFileSync(target, 'utf8')).toBe(rendered[rel]!);
  });

  it('emission is deterministic (two renders are byte-identical)', () => {
    expect(renderMarketplaceContractFiles()).toEqual(rendered);
  });

  it('every emitted schema declares a versioned $id and draft 2020-12', () => {
    for (const [rel, content] of Object.entries(rendered)) {
      if (rel === 'manifest.json') continue;
      const parsed = JSON.parse(content) as { $schema?: string; $id?: string };
      expect(parsed.$schema, rel).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(parsed.$id, rel).toMatch(/^urn:epoch:marketplace:[a-z0-9-]+:1\.0\.0$/);
    }
  });
});
