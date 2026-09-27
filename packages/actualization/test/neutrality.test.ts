// Provider-neutrality evidence (acceptance criterion: source + artifact
// scan — no vendor names outside adapter seams): no vendor tokens in the
// kernel source, the emitted contract surfaces, or the closed
// vocabularies. External observation sources (W038 field systems, W037
// supplier systems) stay behind the service-layer ObservationSourcePort
// adapter seam — the kernel never names them.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ACTUALIZATION_EVENT_DISCRIMINATORS,
  LINEAGE_NODE_KINDS,
  VALIDATION_STATES,
  renderActualizationContractFiles,
  renderActualizationPublicContractFiles,
} from '../src/index';
import { REALIZATION_VARIANTS } from '@epoch/solution-delivery';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(here, '..', 'src');

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
  it('no src file mentions a vendor token', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const token of VENDOR_BLOCKLIST) {
        expect(content.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no emitted artifact mentions a vendor token', () => {
    const rendered = [
      ...Object.entries(renderActualizationContractFiles()),
      ...Object.entries(renderActualizationPublicContractFiles()),
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
      ...Object.values(renderActualizationContractFiles()),
      ...Object.values(renderActualizationPublicContractFiles()),
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

  it('the closed vocabularies stay provider-neutral and lifecycle-first', () => {
    // The lineage node kinds are exactly the five lifecycle-first
    // distinction kinds (USL1.0), never a vendor or tool concept.
    expect([...LINEAGE_NODE_KINDS]).toEqual([
      'prediction',
      'baseline',
      'commitment',
      'actual',
      'forecast',
    ]);
    // The validation states are the typed reconciliation vocabulary.
    expect([...VALIDATION_STATES]).toEqual([
      'insufficient',
      'corroborated',
      'conflicting',
      'resolved',
    ]);
    // The event vocabulary lives in the actualization payload namespace.
    for (const discriminator of ACTUALIZATION_EVENT_DISCRIMINATORS) {
      expect(discriminator.startsWith('actualization:')).toBe(true);
    }
    // The realization variants are the W036 universal catalog (composed
    // at runtime, never re-implemented).
    expect(REALIZATION_VARIANTS.includes('construction-build')).toBe(true);
    expect(REALIZATION_VARIANTS.includes('field-service-repair')).toBe(true);
  });
});
