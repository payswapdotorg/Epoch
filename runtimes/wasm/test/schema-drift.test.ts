// Contract drift: committed artifacts under runtimes/wasm/schemas must
// be byte-identical to the deterministic rule-table emission.
// Regeneration only via EPOCH_UPDATE_CONTRACTS=1 (see src/emit.ts).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  WASM_LAYOUT_TYPE_NAMES,
  renderWasmLayoutContractFiles,
  sha256Hex,
} from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(here, '..', 'schemas');
const UPDATE_MODE = process.env.EPOCH_UPDATE_CONTRACTS === '1';

describe('runtimes/wasm/schemas drift', () => {
  const rendered = renderWasmLayoutContractFiles();

  it('renders a manifest plus one schema file per published type', () => {
    const paths = Object.keys(rendered).sort();
    expect(paths).toContain('manifest.json');
    const schemaFiles = paths.filter((p) => p.endsWith('.schema.json'));
    expect(schemaFiles).toHaveLength(paths.length - 1);
    expect(schemaFiles.map((p) => p.replace('.schema.json', ''))).toEqual(
      [...WASM_LAYOUT_TYPE_NAMES].map((type) =>
        type.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase(),
      ),
    );
  });

  it.each(Object.keys(rendered).sort())('committed artifact %s matches emission', (rel) => {
    const target = path.join(CONTRACTS_DIR, rel);
    if (UPDATE_MODE) {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, rendered[rel]!);
      return;
    }
    expect(existsSync(target), `missing committed artifact: runtimes/wasm/schemas/${rel}`).toBe(true);
    expect(readFileSync(target, 'utf8')).toBe(rendered[rel]!);
  });

  it('emission is deterministic (two renders are byte-identical)', () => {
    expect(renderWasmLayoutContractFiles()).toEqual(rendered);
  });

  it('every emitted schema declares a versioned $id and draft 2020-12', () => {
    for (const [rel, content] of Object.entries(rendered)) {
      if (rel === 'manifest.json') continue;
      const parsed = JSON.parse(content) as { $schema?: string; $id?: string };
      expect(parsed.$schema, rel).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(parsed.$id, rel).toMatch(/^urn:epoch:wasm-layout:[a-z0-9-]+:1\.0\.0$/);
    }
  });

  it('the manifest.json digest table matches the emitted file bytes', () => {
    const manifest = JSON.parse(rendered['manifest.json']!) as {
      schemas: { file: string; sha256: string }[];
    };
    for (const entry of manifest.schemas) {
      const content = rendered[entry.file];
      expect(content, entry.file).toBeDefined();
      expect(sha256Hex(content!), entry.file).toBe(entry.sha256);
    }
  });

  it('emitted object schemas are strict (additionalProperties: false)', () => {
    for (const [rel, content] of Object.entries(rendered)) {
      if (rel === 'manifest.json') continue;
      const schema = JSON.parse(content) as { type?: string; additionalProperties?: unknown };
      if (schema.type === 'object') {
        expect(schema.additionalProperties, rel).toBe(false);
      }
    }
  });
});
