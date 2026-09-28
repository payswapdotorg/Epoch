// CONTRACT DRIFT: the committed in-package schema artifacts under
// packages/alerts/schemas are byte-identical to the deterministic
// emission of the implementation surface. Regenerate with:
//
//     EPOCH_UPDATE_CONTRACTS=1 pnpm --filter @epoch/alerts test contract-drift
//
// (the W036/W038 convention).
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderAlertsContractFiles, ALERTS_CONTRACT_DIR } from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const contractDir = path.resolve(here, '..', 'schemas');
const UPDATE = process.env['EPOCH_UPDATE_CONTRACTS'] === '1';

describe('contract drift (committed artifacts vs deterministic emission)', () => {
  it('the committed in-package schema set is byte-identical to the emission', () => {
    const rendered = renderAlertsContractFiles();
    expect(ALERTS_CONTRACT_DIR).toBe('packages/alerts/schemas');
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
});
