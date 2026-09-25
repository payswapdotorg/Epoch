// Contract drift: the committed artifacts under
// packages/experience-runtime/schemas must be byte-identical to the
// deterministic emission. Regeneration is only possible through the
// documented update mode, so artifacts can never drift silently from the
// schemas.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderExperienceRuntimeContractFiles } from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEMAS_DIR = path.resolve(here, '..', 'schemas');
const UPDATE_MODE = process.env.EPOCH_UPDATE_CONTRACTS === '1';

describe('packages/experience-runtime/schemas drift', () => {
  const rendered = renderExperienceRuntimeContractFiles();

  it('renders a manifest plus one schema file per surface type', () => {
    const paths = Object.keys(rendered).sort();
    expect(paths).toContain('manifest.json');
    const schemaFiles = paths.filter((p) => p.endsWith('.schema.json'));
    expect(schemaFiles).toHaveLength(paths.length - 1);
  });

  it.each(Object.keys(rendered).sort())('committed artifact %s matches emission', (rel) => {
    const target = path.join(SCHEMAS_DIR, rel);
    if (UPDATE_MODE) {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, rendered[rel]);
      return;
    }
    expect(
      existsSync(target),
      `missing committed artifact: packages/experience-runtime/schemas/${rel}`,
    ).toBe(true);
    expect(readFileSync(target, 'utf8')).toBe(rendered[rel]);
  });

  it('emission is deterministic (two renders are byte-identical)', () => {
    expect(renderExperienceRuntimeContractFiles()).toEqual(rendered);
  });
});
