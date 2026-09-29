// Contract drift: the committed artifacts under
// services/developer-portal/contracts (the W012 declaration-only tree)
// must be byte-identical to what the implementation emits. Regeneration
// is only possible through the documented update mode, so artifacts can
// never drift silently from the schemas (the W006/W023 in-package
// precedent applied to the contracts/ tree).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '@epoch/agent-protocol';
import {
  DEVELOPER_PORTAL_SCHEMA_SURFACE,
  renderDeveloperPortalContractFiles,
} from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(here, '..', 'contracts');
const UPDATE_MODE = process.env.EPOCH_UPDATE_CONTRACTS === '1';

describe('services/developer-portal/contracts drift', () => {
  const rendered = renderDeveloperPortalContractFiles();

  it('renders a manifest plus one schema file per surface type', () => {
    const paths = Object.keys(rendered).sort();
    expect(paths).toContain('manifest.json');
    expect(paths.filter((p) => p.endsWith('.schema.json'))).toHaveLength(paths.length - 1);
    expect(paths.filter((p) => p.endsWith('.schema.json'))).toHaveLength(
      DEVELOPER_PORTAL_SCHEMA_SURFACE.length,
    );
  });

  it.each(Object.keys(rendered).sort())('committed artifact %s matches emission', (rel) => {
    const target = path.join(CONTRACTS_DIR, rel);
    if (UPDATE_MODE) {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, rendered[rel]!);
      return;
    }
    expect(existsSync(target), `missing committed artifact: contracts/${rel}`).toBe(true);
    expect(readFileSync(target, 'utf8')).toBe(rendered[rel]!);
  });

  it('the committed manifest lists every schema surface type with true digests', () => {
    const manifest = JSON.parse(readFileSync(path.join(CONTRACTS_DIR, 'manifest.json'), 'utf8')) as {
      contract: string;
      dataTypes: string[];
      schemas: Array<{ type: string; file: string; sha256: string }>;
    };
    expect(manifest.dataTypes).toEqual(
      DEVELOPER_PORTAL_SCHEMA_SURFACE.map((entry) => entry.type),
    );
    expect(manifest.contract).toBe('epoch/developer-portal');
    for (const entry of manifest.schemas) {
      const bytes = readFileSync(path.join(CONTRACTS_DIR, entry.file), 'utf8');
      expect(entry.sha256).toBe(sha256Hex(bytes));
    }
  });

  it('every emitted schema declares a versioned $id and draft 2020-12', () => {
    for (const [rel, content] of Object.entries(rendered)) {
      if (rel === 'manifest.json') continue;
      const parsed = JSON.parse(content) as { $schema?: string; $id?: string };
      expect(parsed.$schema, rel).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(parsed.$id, rel).toMatch(/^urn:epoch:developer-portal:[a-z0-9-]+:1\.0\.0$/);
    }
  });
});
