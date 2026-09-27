// Provider-neutrality evidence (the W038 service pattern): no vendor
// tokens in the service source or the closed vocabularies. External
// observation sources (W038 field systems, W037 supplier systems) stay
// behind the ObservationSourcePort adapter seam — the core never names
// them.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ACTUALIZATION_EVENT_DISCRIMINATORS } from '@epoch/actualization';
import { VARIANCE_CLASSES } from '@epoch/variance';

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
  'jira',
  'asana',
  'trello',
  'monday.com',
  'fieldwire',
  'plangrid',
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

  it('the closed vocabularies stay provider-neutral (actualization:* + the variance classes)', () => {
    for (const discriminator of ACTUALIZATION_EVENT_DISCRIMINATORS) {
      expect(discriminator.startsWith('actualization:')).toBe(true);
    }
    for (const varianceClass of VARIANCE_CLASSES) {
      expect(varianceClass).toMatch(/^[a-z-]+$/);
    }
  });

  it('the ObservationSourcePort seam carries no provider vocabulary', () => {
    // The port interface (src/types.ts) names only provider-neutral
    // concepts: pollObservations/submit over sealed W036 records.
    const typesSource = readFileSync(path.join(SRC_DIR, 'types.ts'), 'utf8').toLowerCase();
    expect(typesSource.includes('observationsourceport')).toBe(true);
    for (const token of VENDOR_BLOCKLIST) {
      expect(typesSource.includes(token), `types.ts contains "${token}"`).toBe(false);
    }
  });
});
