// Provider-neutrality evidence for the service (the W043 pin): no
// vendor or notification-platform tokens in the service source —
// external channels stay behind the NotificationPort adapter seam (the
// in-memory reference adapter is provider-neutral; concrete relays are
// future adapters). The `provider-vocabulary-rejected` runtime
// rejection itself is proven in @epoch/alerts
// (packages/alerts/test/notifications.test.ts).
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

const NOTIFICATION_PLATFORM_BLOCKLIST = [
  'aurum',
  'aurumchat',
  'aurum-chat',
  'slack',
  'pagerduty',
  'opsgenie',
  'victorops',
  'sendgrid',
  'mailgun',
  'twilio',
  'telegram',
  'whatsapp',
  'discord',
  'msteams',
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

describe('provider neutrality (lock rule 13 — no vendor names outside the NotificationPort seam)', () => {
  it('no src file mentions a vendor or notification-platform token', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const token of [...VENDOR_BLOCKLIST, ...NOTIFICATION_PLATFORM_BLOCKLIST]) {
        expect(content.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
  });

  it('the runtime exposes no provider configuration surface (constructor options stay neutral)', () => {
    const source = readFileSync(path.join(SRC_DIR, 'types.ts'), 'utf8');
    expect(source).toContain('notificationPort');
    expect(source).not.toContain('webhook');
    expect(source).not.toContain('apiKey');
    expect(source).not.toContain('endpoint');
  });
});
