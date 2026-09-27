// DETERMINISM + CONTRACT DRIFT + PROVIDER NEUTRALITY for the variance
// kernel: identical inputs derive identical digests; the committed
// in-package schema surface is byte-identical to the emission; no vendor
// tokens in the source or the artifacts.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  computePredictionComparison,
  computeVariance,
  foldVarianceRecords,
  renderVarianceContractFiles,
  VARIANCE_CLASSES,
  VARIANCE_SCHEMA_SURFACE,
  admitVarianceRecord,
  openVarianceLedger,
} from '../src/index';
import { unwrap } from './helpers';
import { SOLUTION_ID, TENANT, comparisonInput, varianceInput } from './fixtures';

const here = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_CONTRACTS_DIR = path.resolve(here, '..', 'schemas');
const SRC_DIR = path.resolve(here, '..', 'src');
const UPDATE_MODE = process.env.EPOCH_UPDATE_CONTRACTS === '1';

const VENDOR_BLOCKLIST = [
  'stripe',
  'paypal',
  'braintree',
  'adyen',
  'klarna',
  'razorpay',
  'worldpay',
  'mollie',
  'openai',
  'anthropic',
  'gemini',
  'sap',
  'oracle',
  'primavera',
  'revit',
  'navisworks',
  'autodesk',
  'bentley',
  'procore',
  'autocad',
  'aurum',
  'powerbi',
  'tableau',
];

describe('variance determinism', () => {
  it('identical variance inputs derive identical digests (across class instantiations)', () => {
    for (const varianceClass of VARIANCE_CLASSES) {
      const a = unwrap(
        computeVariance(varianceInput({ varianceClass }) as never),
      );
      const b = unwrap(
        computeVariance(varianceInput({ varianceClass }) as never),
      );
      expect(a.contentDigest, varianceClass).toBe(b.contentDigest);
    }
  });

  it('ledger admission order never leaks into the fold', () => {
    const records = [
      unwrap(computeVariance(varianceInput() as never)),
      unwrap(
        computeVariance(varianceInput({ varianceId: 'variance:pit-volume-price' }) as never),
      ),
    ];
    const build = (order: typeof records): string =>
      JSON.stringify(
        (() => {
          let ledger = openVarianceLedger({ tenantId: TENANT, solutionId: SOLUTION_ID });
          for (const record of order) {
            ledger = unwrap(admitVarianceRecord(ledger, record));
          }
          return foldVarianceRecords(ledger).map((record) => record.varianceId);
        })(),
      );
    expect(build(records)).toBe(build([...records].reverse()));
  });

  it('identical comparison inputs derive identical digests', () => {
    const a = unwrap(computePredictionComparison(comparisonInput() as never));
    const b = unwrap(computePredictionComparison(comparisonInput() as never));
    expect(a.contentDigest).toBe(b.contentDigest);
  });
});

describe('contract drift (packages/variance/schemas)', () => {
  it('renders a manifest plus one schema file per surface type', () => {
    const rendered = renderVarianceContractFiles();
    const paths = Object.keys(rendered).sort();
    expect(paths).toContain('manifest.json');
    expect(paths.filter((p) => p.endsWith('.schema.json'))).toHaveLength(paths.length - 1);
  });

  it.each(Object.keys(renderVarianceContractFiles()).sort())('committed artifact %s matches emission', (rel) => {
    const rendered = renderVarianceContractFiles();
    const target = path.join(PACKAGE_CONTRACTS_DIR, rel);
    if (UPDATE_MODE) {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, rendered[rel]!);
      return;
    }
    expect(existsSync(target), `missing committed artifact: ${rel}`).toBe(true);
    expect(readFileSync(target, 'utf8')).toBe(rendered[rel]!);
  });

  it('emission is deterministic (two renders are byte-identical)', () => {
    expect(renderVarianceContractFiles()).toEqual(renderVarianceContractFiles());
  });

  it('every emitted schema declares a versioned $id and draft 2020-12', () => {
    for (const [rel, content] of Object.entries(renderVarianceContractFiles())) {
      if (rel === 'manifest.json') continue;
      const parsed = JSON.parse(content) as { $schema?: string; $id?: string };
      expect(parsed.$schema, rel).toBe('https://json-schema.org/draft/2020-12/schema');
      expect(parsed.$id, rel).toMatch(/^urn:epoch:variance:[a-z0-9-]+:1\.0\.0$/);
    }
  });

  it('the surface registry covers every published data type', () => {
    expect(VARIANCE_SCHEMA_SURFACE.length).toBeGreaterThanOrEqual(24);
  });
});

describe('provider neutrality (lock rule 13)', () => {
  function listFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        out.push(...listFiles(full));
      } else {
        out.push(full);
      }
    }
    return out;
  }

  it('no src file mentions a vendor token', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const token of VENDOR_BLOCKLIST) {
        expect(content.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no emitted artifact mentions a vendor token', () => {
    for (const [rel, content] of Object.entries(renderVarianceContractFiles())) {
      const lower = content.toLowerCase();
      for (const token of VENDOR_BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no schema property key names a provider, gateway, credential, or API surface', () => {
    const forbiddenKeys =
      /^(provider|vendor|gateway|apiKey|apiUrl|endpoint|secret|credential|token|webhook|password|supplierPortal|fieldPlatform|deviceId|vendorId)$/i;
    for (const content of Object.values(renderVarianceContractFiles())) {
      const schema = JSON.parse(content) as unknown;
      const visit = (node: unknown): void => {
        if (Array.isArray(node)) {
          for (const child of node) visit(child);
          return;
        }
        if (node !== null && typeof node === 'object') {
          const record = node as Record<string, unknown>;
          if ('properties' in record && record.properties !== null && typeof record.properties === 'object') {
            for (const key of Object.keys(record.properties as Record<string, unknown>)) {
              expect(forbiddenKeys.test(key), `declares property "${key}"`).toBe(false);
            }
          }
          for (const child of Object.values(record)) visit(child);
        }
      };
      visit(schema);
    }
  });
});
