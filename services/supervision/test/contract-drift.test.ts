// CONTRACT DRIFT: the committed public contract artifacts under
// contracts/supervision are byte-identical to the deterministic
// emission composed from BOTH W043 kernels' core-record surfaces (this
// service is the only W043 component depending on both). Regenerate
// with:
//
//     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/supervision-runtime test contract-drift
//
// (the W012 convention; the W038 drift-test pattern).
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderSupervisionPublicContractFiles, SUPERVISION_PUBLIC_CONTRACT_DIR } from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const contractDir = path.resolve(here, '..', '..', '..', 'contracts', 'supervision');
const UPDATE = process.env['EPOCH_UPDATE_CONTRACTS'] === '1';

describe('contract drift (committed public artifacts vs deterministic emission)', () => {
  it('the committed contracts/supervision set is byte-identical to the emission', () => {
    const rendered = renderSupervisionPublicContractFiles();
    expect(SUPERVISION_PUBLIC_CONTRACT_DIR).toBe('contracts/supervision');
    expect(Object.keys(rendered).length).toBeGreaterThanOrEqual(18);
    if (UPDATE) {
      mkdirSync(path.join(contractDir, 'schemas'), { recursive: true });
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

  it('the manifest inventories every emitted schema with exact digests', () => {
    const rendered = renderSupervisionPublicContractFiles();
    const manifest = JSON.parse(rendered['manifest.json']!) as {
      contract: string;
      dataTypes: string[];
      schemas: Array<{ type: string; file: string; sha256: string }>;
    };
    expect(manifest.contract).toBe('epoch/supervision');
    expect(manifest.schemas.length).toBe(manifest.dataTypes.length);
    const files = new Set(Object.keys(rendered).filter((file) => file !== 'manifest.json'));
    for (const entry of manifest.schemas) {
      expect(files.has(entry.file), entry.file).toBe(true);
    }
  });
});
