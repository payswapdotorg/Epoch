// Provider-neutrality evidence (acceptance criterion: source + artifact
// scan — no vendor names outside adapter seams): no vendor tokens in the
// kernel source, the emitted contract surfaces, or the closed
// vocabularies. External field systems (mobile capture, IoT, scanners)
// stay behind the service-layer FieldCapturePort adapter seam — the
// kernel never names them.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  DOMAIN_TRACKING_STATE_BINDINGS,
  EXECUTION_EVENT_DISCRIMINATORS,
  renderExecutionTrackingContractFiles,
  renderExecutionTrackingPublicContractFiles,
} from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(here, '..', 'src');

const FIELD_PLATFORM_BLOCKLIST = [
  'procore',
  'autotask',
  'fieldwire',
  'plangrid',
  'buildertrend',
  'clickup',
  'monday.com',
  'jira',
  'asana',
  'trello',
  'iot-hub',
  'aws-iot',
  'azure-iot',
  'bosch',
  'hilti',
  'trimble',
  'leica',
];

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

describe('provider neutrality (lock rule 13 — no vendor names outside adapter seams)', () => {
  it('no src file mentions a vendor or field-platform token', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const token of [...VENDOR_BLOCKLIST, ...FIELD_PLATFORM_BLOCKLIST]) {
        expect(content.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no emitted artifact mentions a vendor or field-platform token', () => {
    const rendered = [
      ...Object.entries(renderExecutionTrackingContractFiles()),
      ...Object.entries(renderExecutionTrackingPublicContractFiles()),
    ];
    for (const [rel, content] of rendered) {
      const lower = content.toLowerCase();
      for (const token of [...VENDOR_BLOCKLIST, ...FIELD_PLATFORM_BLOCKLIST]) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no schema property key names a provider, gateway, credential, or API surface', () => {
    const rendered = [
      ...Object.values(renderExecutionTrackingContractFiles()),
      ...Object.values(renderExecutionTrackingPublicContractFiles()),
    ];
    const forbiddenKeys =
      /^(provider|vendor|gateway|apiKey|apiUrl|endpoint|secret|credential|token|webhook|password|supplierPortal|fieldPlatform|deviceId|vendorId)$/i;
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

  it('construction execution stays ONE realization projection among the domain vocabulary bindings', () => {
    // The domain vocabulary table covers every W036 realization variant
    // (construction is one entry, never the authority).
    const variants = Object.keys(DOMAIN_TRACKING_STATE_BINDINGS).sort();
    expect(variants).toEqual([
      'construction-build',
      'electrical-installation-commissioning',
      'field-service-repair',
      'infrastructure-provisioning',
      'manufacturing',
      'mechanical-fabrication-assembly',
      'software-implementation-deployment',
    ]);
    for (const variant of variants) {
      const bindings = DOMAIN_TRACKING_STATE_BINDINGS[variant]!;
      for (const state of ['not-started', 'in-progress', 'completed', 'blocked'] as const) {
        expect(bindings[state].length, `${variant}/${state}`).toBeGreaterThan(0);
      }
    }
  });

  it('the event vocabulary is namespaced and provider-neutral', () => {
    for (const discriminator of EXECUTION_EVENT_DISCRIMINATORS) {
      expect(discriminator.startsWith('execution:')).toBe(true);
      const lower = discriminator.toLowerCase();
      for (const token of [...VENDOR_BLOCKLIST, ...FIELD_PLATFORM_BLOCKLIST]) {
        expect(lower.includes(token)).toBe(false);
      }
    }
  });
});
