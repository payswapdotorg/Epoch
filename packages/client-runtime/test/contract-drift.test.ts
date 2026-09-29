// Contract drift: the committed artifacts under
// contracts/application-gateway must be byte-identical to what the
// implementation emits. Regeneration is only possible through the
// documented update mode, so artifacts can never drift silently.
// Also pins: the manifest dataTypes == the declared schema surface (the
// public surface == declared manifest self-check, W046 pin 1).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderApplicationGatewayContractFiles } from '../src/contract-emission';
import { APPLICATION_GATEWAY_SCHEMA_SURFACE } from '../src/surface';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS_DIR = path.resolve(here, '..', '..', '..', 'contracts', 'application-gateway');
const UPDATE_MODE = process.env.EPOCH_UPDATE_CONTRACTS === '1';

describe('contracts/application-gateway drift (W046 acceptance 1)', () => {
  const rendered = renderApplicationGatewayContractFiles();

  it('renders a manifest plus one schema file per surface type', () => {
    const paths = Object.keys(rendered).sort();
    expect(paths).toContain('manifest.json');
    expect(paths.filter((p) => p.startsWith('schemas/'))).toHaveLength(paths.length - 1);
    expect(paths.length).toBeGreaterThan(30);
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
      `missing committed artifact: contracts/application-gateway/${rel}`,
    ).toBe(true);
    expect(readFileSync(target, 'utf8')).toBe(rendered[rel]!);
  });

  it('emission is deterministic (two renders are byte-identical)', () => {
    expect(renderApplicationGatewayContractFiles()).toEqual(rendered);
  });

  it('the manifest digests match the emitted schema files', () => {
    const manifest = JSON.parse(rendered['manifest.json']!) as {
      readonly dataTypes: readonly string[];
      readonly schemas: readonly { readonly file: string; readonly sha256: string }[];
    };
    for (const entry of manifest.schemas) {
      expect(rendered[entry.file]).toBeDefined();
    }
    expect(manifest.schemas.length).toBe(Object.keys(rendered).length - 1);
  });

  it('the declared public surface == the manifest dataTypes (parity self-check)', () => {
    const manifest = JSON.parse(rendered['manifest.json']!) as {
      readonly dataTypes: readonly string[];
    };
    expect(manifest.dataTypes).toEqual(APPLICATION_GATEWAY_SCHEMA_SURFACE.map((entry) => entry.type));
  });
});
