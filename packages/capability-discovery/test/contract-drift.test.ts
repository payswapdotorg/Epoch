// Contract drift: the committed artifacts under
// contracts/capability-discovery must be byte-identical to what the
// implementation emits. Regeneration is only possible through the
// documented update mode, so artifacts can never drift silently.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderCapabilityDiscoveryContractFiles } from '../src/contract-emission';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(here, '..', '..', '..', 'contracts', 'capability-discovery');
const UPDATE_MODE = process.env.EPOCH_UPDATE_CONTRACTS === '1';

describe('contracts/capability-discovery drift', () => {
  const rendered = renderCapabilityDiscoveryContractFiles();

  it('renders a manifest plus one schema file per surface type', () => {
    const paths = Object.keys(rendered).sort();
    expect(paths).toContain('manifest.json');
    expect(paths.filter((p) => p.startsWith('schemas/'))).toHaveLength(paths.length - 1);
    expect(paths.length).toBeGreaterThan(80);
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
      `missing committed artifact: contracts/capability-discovery/${rel}`,
    ).toBe(true);
    expect(readFileSync(target, 'utf8')).toBe(rendered[rel]!);
  });

  it('emission is deterministic (two renders are byte-identical)', () => {
    expect(renderCapabilityDiscoveryContractFiles()).toEqual(rendered);
  });

  it('the manifest digests match the emitted schema files', () => {
    const manifest = JSON.parse(rendered['manifest.json']!) as {
      readonly schemas: readonly { readonly file: string; readonly sha256: string }[];
    };
    for (const entry of manifest.schemas) {
      expect(rendered[entry.file]).toBeDefined();
    }
    expect(manifest.schemas.length).toBe(Object.keys(rendered).length - 1);
  });
});
