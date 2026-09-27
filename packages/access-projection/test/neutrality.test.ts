// Provider-neutrality evidence (the W041 pin: "provider neutrality (no
// vendor vocabulary in the kernel — provider-vocabulary-rejected
// blocklist test)"). The AURUM blocklist pins the architecture.md rule;
// the vendor blocklist pins lock rule 13; identity/policy vocabulary is
// opaque id grammars.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  renderAccessProjectionContractFiles,
  renderAccessProjectionPublicContractFiles,
} from '../src/index';

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
  'okta',
  'auth0',
  'cognito',
  'onelogin',
  'pingidentity',
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

describe('Aurum neutrality (architecture.md: Aurum is an optional reference adapter)', () => {
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
      ...Object.entries(renderAccessProjectionContractFiles()),
      ...Object.entries(renderAccessProjectionPublicContractFiles()),
    ];
    for (const [rel, content] of rendered) {
      const lower = content.toLowerCase();
      for (const token of AURUM_BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });
});

describe('provider vocabulary is rejected (provider-vocabulary-rejected, lock rule 13)', () => {
  it('no vendor tokens in any src file or emitted schema/manifest', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const token of VENDOR_BLOCKLIST) {
        expect(content.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
    const rendered = [
      ...Object.entries(renderAccessProjectionContractFiles()),
      ...Object.entries(renderAccessProjectionPublicContractFiles()),
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
      ...Object.values(renderAccessProjectionContractFiles()),
      ...Object.values(renderAccessProjectionPublicContractFiles()),
    ];
    const forbiddenKeys =
      /^(provider|vendor|gateway|apiKey|apiUrl|endpoint|secret|credential|token|webhook|password|identityProvider|idpTenant|idpClientId|vendorCode|vendorId)$/i;
    for (const content of rendered) {
      const schema = JSON.parse(content) as unknown;
      const visit = (node: unknown): void => {
        if (Array.isArray(node)) {
          for (const child of node) visit(child);
          return;
        }
        if (node !== null && typeof node === 'object') {
          const record = node as Record<string, unknown>;
          if (
            'properties' in record &&
            record.properties !== null &&
            typeof record.properties === 'object'
          ) {
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

  it('policy and identity vocabulary stays OPAQUE id grammars (never vendor names)', () => {
    const rendered = renderAccessProjectionContractFiles();
    const policy = rendered['projection-policy-content.schema.json'] ?? '';
    expect(policy).toContain('policy:');
    expect(policy).toContain('role:');
    expect(policy).toContain('task-class:');
    const subject = rendered['projection-subject.schema.json'] ?? '';
    expect(subject).toContain('principal:');
  });

  it('the object-class vocabulary is the closed W036 set (no silent new domains)', () => {
    const rendered = renderAccessProjectionContractFiles();
    const binding = rendered['policy-binding.schema.json'] ?? '';
    expect(binding).toContain('program-of-work');
    expect(binding).toContain('delivery-record');
    expect(binding).toContain('solution-version');
    expect(binding).toContain('distinction-record');
  });

  it('event discriminators are namespaced and vendor-free', () => {
    const rendered = renderAccessProjectionContractFiles();
    const manifest = JSON.parse(rendered['manifest.json']!) as { dataTypes: string[] };
    expect(manifest.dataTypes).toContain('AccessProjectionEventContent');
    const lower = JSON.stringify(rendered).toLowerCase();
    for (const token of [...AURUM_BLOCKLIST, ...VENDOR_BLOCKLIST]) {
      expect(lower.includes(token), `artifact mentions "${token}"`).toBe(false);
    }
  });
});
