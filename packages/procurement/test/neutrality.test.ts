// Provider-neutrality evidence (the W037 pin: "Neutrality: source +
// artifact scan — no vendor names outside adapter seams"). The AURUM
// blocklist pins the architecture.md rule; the vendor blocklist pins
// lock rule 13; supplier identity is an opaque id grammar.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderProcurementContractFiles, renderProcurementPublicContractFiles } from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(here, '..', 'src');

const AURUM_BLOCKLIST = ['aurum', 'aurumchat', 'aurum-chat'];

const VENDOR_BLOCKLIST = [
  'stripe',
  'paypal',
  'braintree',
  'adyen',
  'checkout.com',
  'checkout-com',
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
  'trimble',
  'procore',
  'autocad',
  'coupa',
  'ariba',
];

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

describe('Aurum neutrality (acceptance: no Aurum-specific modules/types)', () => {
  it('no src file mentions Aurum', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const token of AURUM_BLOCKLIST) {
        expect(content.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no emitted artifact mentions Aurum', () => {
    const rendered = [
      ...Object.entries(renderProcurementContractFiles()),
      ...Object.entries(renderProcurementPublicContractFiles()),
    ];
    for (const [rel, content] of rendered) {
      const lower = content.toLowerCase();
      for (const token of AURUM_BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });
});

describe('provider neutrality (lock rule 13)', () => {
  it('no vendor tokens in any src file or emitted schema/manifest', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const token of VENDOR_BLOCKLIST) {
        expect(content.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
    const rendered = [
      ...Object.entries(renderProcurementContractFiles()),
      ...Object.entries(renderProcurementPublicContractFiles()),
    ];
    for (const [rel, content] of rendered) {
      const lower = content.toLowerCase();
      for (const token of VENDOR_BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no schema property key names a provider, gateway, credential, or API surface', () => {
    const rendered = [
      ...Object.values(renderProcurementContractFiles()),
      ...Object.values(renderProcurementPublicContractFiles()),
    ];
    const forbiddenKeys =
      /^(provider|vendor|gateway|apiKey|apiUrl|endpoint|secret|credential|token|webhook|password|supplierPortal|webhookSecret|vendorCode|vendorId)$/i;
    for (const content of rendered) {
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

  it('supplier identity stays an OPAQUE id grammar (never vendor names in core types)', () => {
    const rendered = renderProcurementContractFiles();
    const quote = rendered['quote-content.schema.json'] ?? '';
    expect(quote).toContain('supplier:');
    const pkg = rendered['acquisition-package-content.schema.json'] ?? '';
    // The seven-variant catalog stays the W036 closed set (procurement is
    // one projection, not the authority).
    expect(pkg).toContain('external-procurement');
    expect(pkg).toContain('internal-allocation');
    expect(pkg).toContain('subscription-license');
    expect(pkg).toContain('cloud-service-provisioning');
    expect(pkg).toContain('fabrication-request');
    expect(pkg).toContain('specialist-capability-assignment');
    expect(pkg).toContain('data-evidence-acquisition');
  });
});
