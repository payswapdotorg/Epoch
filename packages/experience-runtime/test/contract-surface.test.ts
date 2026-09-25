// Contract surface integrity: the published in-package manifest must cover
// exactly the package's declared schema surface — no missing, no extra,
// no drift.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  EXPERIENCE_RUNTIME_SCHEMA_SURFACE,
  EXPERIENCE_RUNTIME_CONTRACT_VERSION,
  EXPERIENCE_RUNTIME_DOCUMENT_KINDS,
  EXPERIENCE_RUNTIME_PROTOCOL_VERSION,
  renderExperienceRuntimeContractFiles,
} from '../src/index';
import { sha256Hex } from '@epoch/agent-protocol';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = path.resolve(here, '..', 'schemas');
const UPDATE_MODE = process.env.EPOCH_UPDATE_CONTRACTS === '1';

const surfaceTypes = EXPERIENCE_RUNTIME_SCHEMA_SURFACE.map((entry) => entry.type);

describe('packages/experience-runtime/schemas surface integrity', () => {
  it.skipIf(UPDATE_MODE)('manifest dataTypes equal the package schema surface', () => {
    const manifest = JSON.parse(readFileSync(path.join(SCHEMAS_DIR, 'manifest.json'), 'utf8'));
    expect(manifest.contract).toBe('epoch/experience-runtime');
    expect(manifest.contractVersion).toBe(EXPERIENCE_RUNTIME_CONTRACT_VERSION);
    expect(manifest.protocolVersion).toBe(EXPERIENCE_RUNTIME_PROTOCOL_VERSION);
    expect(manifest.documentKinds).toEqual([...EXPERIENCE_RUNTIME_DOCUMENT_KINDS]);
    expect(manifest.dataTypes).toEqual(surfaceTypes);
    expect(manifest.jsonSchemaFidelity).toContain('structural-only');
  });

  it.skipIf(UPDATE_MODE)('manifest schema digests match the committed files', () => {
    const manifest = JSON.parse(readFileSync(path.join(SCHEMAS_DIR, 'manifest.json'), 'utf8'));
    for (const entry of manifest.schemas as Array<{ type: string; file: string; sha256: string }>) {
      const committed = readFileSync(path.join(SCHEMAS_DIR, entry.file), 'utf8');
      expect(entry.sha256, entry.file).toBe(sha256Hex(committed));
    }
    const rendered = renderExperienceRuntimeContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      if (rel === 'manifest.json') continue;
      expect(readFileSync(path.join(SCHEMAS_DIR, rel), 'utf8')).toBe(content);
    }
  });

  it('the surface registry is duplicate-free and sorted', () => {
    const names = surfaceTypes;
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([...names].sort());
  });
});
