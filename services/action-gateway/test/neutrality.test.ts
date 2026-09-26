// Provider-neutrality evidence (acceptance criterion 2): no vendor tokens
// in the action-gateway source surface — the adapter seam is the ONLY
// place external systems may appear, and even there no vendor is named
// (lock rule 13: provider behavior is adapterized).
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
  'zapier',
  'http://',
  'https://',
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

describe('action-gateway provider neutrality', () => {
  it('contains no vendor tokens or absolute URLs in any source file', () => {
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
