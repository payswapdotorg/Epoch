// Provider-neutrality evidence (acceptance criterion: provider-neutral
// interfaces; external systems adapterized): no payment-vendor tokens in
// the emitted contract surface; no schema property key names a provider,
// gateway, credential, or API surface.
import { describe, expect, it } from 'vitest';
import { renderEntitlementsContractFiles } from '../src/index';

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

describe('entitlements contract provider neutrality', () => {
  it('contains no payment-vendor tokens in any emitted schema or manifest', () => {
    const rendered = renderEntitlementsContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      for (const token of BLOCKLIST) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no schema property key names a provider, gateway, credential, or API surface', () => {
    const rendered = renderEntitlementsContractFiles();
    const forbiddenKeys =
      /^(provider|vendor|gateway|apiKey|apiUrl|endpoint|secret|credential|token|webhook|password|iban|bic|cardNumber)$/i;
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

  it('the settlement seam stays brand-free in every schema description', () => {
    const rendered = renderEntitlementsContractFiles();
    for (const [rel, content] of Object.entries(rendered)) {
      const lower = content.toLowerCase();
      expect(lower.includes('never names a provider') || !lower.includes('stripe'), rel).toBe(true);
    }
  });
});
