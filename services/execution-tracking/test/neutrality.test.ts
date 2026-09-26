// Provider-neutrality evidence (acceptance criterion: no vendor names
// outside adapter seams): the service source and the adapter seam stay
// provider-neutral — no field-platform or vendor tokens anywhere; the
// FieldCapturePort is the ONLY seam where external field systems may
// appear (and the reference adapter names none).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(here, '..', 'src');

const FIELD_PLATFORM_BLOCKLIST = [
  'procore',
  'fieldwire',
  'plangrid',
  'buildertrend',
  'jira',
  'asana',
  'trello',
  'monday.com',
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
  'openai',
  'anthropic',
  'gemini',
  'sap',
  'oracle',
  'primavera',
  'revit',
  'autodesk',
  'bentley',
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

describe('provider neutrality (lock rule 13 — no vendor names outside the adapter seam)', () => {
  it('no service src file mentions a vendor or field-platform token', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const token of [...VENDOR_BLOCKLIST, ...FIELD_PLATFORM_BLOCKLIST]) {
        expect(content.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
  });

  it('the adapter seam mentions external field systems generically, never a vendor', () => {
    const seam = readFileSync(path.join(SRC_DIR, 'field-port.ts'), 'utf8').toLowerCase();
    expect(seam.includes('fieldcaptureport')).toBe(true);
    // The generic field-system vocabulary is allowed; vendor names are not.
    for (const token of [...VENDOR_BLOCKLIST, ...FIELD_PLATFORM_BLOCKLIST]) {
      expect(seam.includes(token)).toBe(false);
    }
  });
});
