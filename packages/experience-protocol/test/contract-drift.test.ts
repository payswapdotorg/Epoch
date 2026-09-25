// Contract drift: the committed artifacts under contracts/experience must
// be byte-identical to what the implementation emits. Regeneration is only
// possible through the documented update mode, so artifacts can never drift
// silently from the schemas.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderExperienceContractFiles } from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(here, '..', '..', '..', 'contracts', 'experience');
const UPDATE_MODE = process.env.EPOCH_UPDATE_CONTRACTS === '1';

describe('contracts/experience drift', () => {
  const rendered = renderExperienceContractFiles();

  it('renders a manifest plus one schema file per surface type', () => {
    const paths = Object.keys(rendered).sort();
    expect(paths).toContain('manifest.json');
    expect(paths.filter((p) => p.startsWith('schemas/'))).toHaveLength(paths.length - 1);
  });

  it.each(Object.keys(rendered).sort())('committed artifact %s matches emission', (rel) => {
    const target = path.join(CONTRACTS_DIR, rel);
    if (UPDATE_MODE) {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, rendered[rel]);
      return;
    }
    expect(existsSync(target), `missing committed artifact: contracts/experience/${rel}`).toBe(
      true,
    );
    expect(readFileSync(target, 'utf8')).toBe(rendered[rel]);
  });

  it('emission is deterministic (two renders are byte-identical)', () => {
    expect(renderExperienceContractFiles()).toEqual(rendered);
  });
});
