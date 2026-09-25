// Provider-neutrality evidence (acceptance criterion 4): no payment-vendor
// tokens in the emitted contract surface; no schema property key names a
// provider, gateway, credential, or API surface.
import { describe, expect, it } from 'vitest';
import { renderMarketplaceContractFiles } from '../src/index';

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
  'payoneer',
  'venmo',
  'alipay',
  'wechat-pay',
  'apple-pay',
  'google-pay',
  'amazon-pay',
  'authorizenet',
  'openai',
  'anthropic',
  'gemini',
];

describe('marketplace contract provider neutrality', () => {
  it('contains no payment-vendor tokens in any emitted schema or manifest', () => {
    const rendered = renderMarketplaceContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no schema property key names a provider, gateway, credential, or API surface', () => {
    const rendered = renderMarketplaceContractFiles();
    const forbiddenKeys =
      /^(provider|vendor|gateway|apiKey|apiUrl|endpoint|secret|credential|token|webhook|password)$/i;
    for (const [rel, content] of Object.entries(rendered)) {
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
              expect(forbiddenKeys.test(key), `${rel} declares property "${key}"`).toBe(false);
            }
          }
          for (const child of Object.values(record)) visit(child);
        }
      };
      visit(schema);
    }
  });

  it('the payment seam stays brand-free in every schema description', () => {
    const rendered = renderMarketplaceContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      expect(lower.includes('processor'), `${rel} mentions "processor"`).toBe(false);
    }
  });
});
