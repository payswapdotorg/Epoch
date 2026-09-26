// NEUTRALITY: no vendor names outside the SupplierPort adapter seam —
// a source + artifact scan of the service (the W037 pin). The
// supplier-port reference adapter itself stays provider-neutral.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(here, '..', 'src');

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

const AURUM_BLOCKLIST = ['aurum', 'aurumchat', 'aurum-chat'];

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

describe('provider neutrality (lock rule 13)', () => {
  it('no vendor tokens in any service src file (including the adapter seam)', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const token of VENDOR_BLOCKLIST) {
        expect(content.includes(token), `${file} contains "${token}"`).toBe(false);
      }
      for (const token of AURUM_BLOCKLIST) {
        expect(content.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
  });

  it('the SupplierPort seam carries opaque supplier ids only', () => {
    const seam = readFileSync(path.join(SRC_DIR, 'supplier-port.ts'), 'utf8');
    expect(seam).toContain('SupplierPort');
    expect(seam).toContain('supplierId');
    // The seam never names a concrete vendor (the reference adapter is
    // caller-seeded, deterministic and provider-neutral).
    for (const token of VENDOR_BLOCKLIST) {
      expect(seam.toLowerCase().includes(token)).toBe(false);
    }
  });
});
