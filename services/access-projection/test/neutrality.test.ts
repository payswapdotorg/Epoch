// Provider-neutrality evidence (the W041 pin, service side): no vendor
// tokens in the host source; identity/policy vocabulary stays opaque.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(here, '..', 'src');

const AURUM_BLOCKLIST = ['aurum', 'aurumchat', 'aurum-chat'];

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

describe('provider vocabulary is rejected (provider-vocabulary-rejected, lock rule 13)', () => {
  it('no vendor tokens in any host src file', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const token of [...VENDOR_BLOCKLIST, ...AURUM_BLOCKLIST]) {
        expect(content.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
  });

  it('the host core names the authorization decision point (never a vendor seam)', () => {
    const runtime = readFileSync(path.join(SRC_DIR, 'runtime.ts'), 'utf8');
    expect(runtime).toMatch(/authorization decision point|W009/);
  });
});
