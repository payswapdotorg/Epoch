// Provider-neutrality evidence (acceptance criterion: core packages must
// not import Aurum-specific modules/types; no provider tokens in the
// emitted contract surfaces; no schema property key names a provider,
// gateway, credential, or API surface).
//
// The AURUM blocklist pins the architecture.md rule "Aurum Chat is an
// optional reference adapter, never an Epoch prerequisite": no
// Aurum-specific module/type/field can appear in this kernel's source or
// emitted artifacts.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  renderSolutionDeliveryContractFiles,
  renderSolutionDeliveryPublicContractFiles,
} from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(here, '..', 'src');

const AURUM_BLOCKLIST = [
  'aurum',
  'aurumchat',
  'aurum-chat',
];

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

  it('no src file imports an Aurum module', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8');
      const imports = [...content.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const specifier of imports) {
        expect(specifier.toLowerCase().includes('aurum'), `${file} imports "${specifier}"`).toBe(
          false,
        );
      }
    }
  });

  it('no emitted artifact mentions Aurum', () => {
    const rendered = [
      ...Object.entries(renderSolutionDeliveryContractFiles()),
      ...Object.entries(renderSolutionDeliveryPublicContractFiles()),
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
  it('no vendor tokens in any emitted schema or manifest', () => {
    const rendered = [
      ...Object.entries(renderSolutionDeliveryContractFiles()),
      ...Object.entries(renderSolutionDeliveryPublicContractFiles()),
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
      ...Object.values(renderSolutionDeliveryContractFiles()),
      ...Object.values(renderSolutionDeliveryPublicContractFiles()),
    ];
    const forbiddenKeys =
      /^(provider|vendor|gateway|apiKey|apiUrl|endpoint|secret|credential|token|webhook|password|supplierPortal|webhookSecret)$/i;
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

  it('procurement stays one acquisition variant among seven (not the authority)', () => {
    const rendered = renderSolutionDeliveryContractFiles();
    const acquisition = rendered['acquisition-request-detail.schema.json'] ?? '';
    expect(acquisition).toContain('external-procurement');
    expect(acquisition).toContain('internal-allocation');
    expect(acquisition).toContain('subscription-license');
    expect(acquisition).toContain('cloud-service-provisioning');
    expect(acquisition).toContain('fabrication-request');
    expect(acquisition).toContain('specialist-capability-assignment');
    expect(acquisition).toContain('data-evidence-acquisition');
  });
});
