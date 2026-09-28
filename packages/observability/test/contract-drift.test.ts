// CONTRACT DRIFT: the committed in-package schema artifacts under
// packages/observability/schemas are byte-identical to the
// deterministic emission of the implementation surface. Regenerate
// with:
//
//     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/observability test contract-drift
//
// (the W036/W038/W024 convention).
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderObservabilityContractFiles, OBSERVABILITY_CONTRACT_DIR } from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const contractDir = path.resolve(here, '..', 'schemas');
const UPDATE = process.env['EPOCH_UPDATE_CONTRACTS'] === '1';

describe('contract drift (committed artifacts vs deterministic emission)', () => {
  it('the committed in-package schema set is byte-identical to the emission', () => {
    const rendered = renderObservabilityContractFiles();
    expect(OBSERVABILITY_CONTRACT_DIR).toBe('packages/observability/schemas');
    if (UPDATE) {
      mkdirSync(contractDir, { recursive: true });
      for (const [file, content] of Object.entries(rendered)) {
        writeFileSync(path.join(contractDir, file), content);
      }
    }
    expect(existsSync(path.join(contractDir, 'manifest.json'))).toBe(true);
    for (const [file, content] of Object.entries(rendered)) {
      const committed = readFileSync(path.join(contractDir, file), 'utf8');
      expect(committed, file).toBe(content);
    }
  });

  it('the manifest declares the contract identity + fidelity policy', () => {
    const manifest = JSON.parse(readFileSync(path.join(contractDir, 'manifest.json'), 'utf8')) as {
      contract: string;
      contractVersion: string;
      recordVersion: number;
      dataTypes: string[];
      jsonSchemaFidelity: string;
      schemas: Array<{ type: string; file: string; sha256: string }>;
    };
    expect(manifest.contract).toBe('epoch/observability');
    expect(manifest.contractVersion).toBe('1.0.0');
    expect(manifest.recordVersion).toBe(1);
    expect(manifest.schemas.length).toBe(manifest.dataTypes.length);
    expect(manifest.jsonSchemaFidelity.startsWith('structural-only')).toBe(true);
    for (const entry of manifest.schemas) {
      expect(entry.file).toBe(
        `${entry.type
          .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
          .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
          .toLowerCase()}.schema.json`,
      );
    }
  });
});
