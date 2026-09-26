// Provider-neutrality evidence (acceptance criterion 2): no vendor tokens
// in the action-policy source surface; no record field names a provider,
// gateway credential, or API surface (strict objects reject unknown fields
// structurally — this test proves the surface does not NAME them either).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';

const BLOCKLIST = [
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
  'mistral',
  'bedrock',
  'azure',
  'aws',
  'gcp',
  'google-cloud',
  'slack',
  'twilio',
  'sendgrid',
  'kubernetes',
  'docker',
];

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      files.push(...sourceFiles(path));
    } else if (/\.(ts|mts)$/.test(entry)) {
      files.push(path);
    }
  }
  return files;
}

describe('action-policy provider neutrality', () => {
  it('contains no vendor tokens in any source file', () => {
    // The published surface is src/** (the test fixtures legitimately
    // reference nothing vendor-specific either, but the blocklist itself
    // lives in this file — scan the src surface).
    const files = sourceFiles(join(import.meta.dirname, '..', 'src'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const lower = readFileSync(file, 'utf-8').toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
  });
});
