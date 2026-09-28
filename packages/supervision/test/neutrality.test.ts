// Provider-neutrality evidence (lock rule 13 — no vendor names outside
// adapter seams): no vendor tokens in the kernel source or the emitted
// contract surfaces. Notification channels and escalation relays stay
// behind the @epoch/alerts NotificationPort seam and the W042
// external-event bridge — this kernel never names them.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderSupervisionContractFiles } from '../src/index';

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
  'teams',
  'electronic-mail',
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
  it('no src file mentions a vendor or notification-platform token', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const token of [...VENDOR_BLOCKLIST, ...NOTIFICATION_PLATFORM_BLOCKLIST]) {
        expect(content.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no emitted artifact mentions a vendor or notification-platform token', () => {
    const rendered = Object.entries(renderSupervisionContractFiles());
    expect(rendered.length).toBeGreaterThan(0);
    for (const [rel, content] of rendered) {
      const lower = content.toLowerCase();
      for (const token of [...VENDOR_BLOCKLIST, ...NOTIFICATION_PLATFORM_BLOCKLIST]) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no schema property key names a provider, channel, credential, or API surface', () => {
    const rendered = renderSupervisionContractFiles();
    const manifest = JSON.parse(rendered['manifest.json']!) as {
      schemas: Array<{ file: string }>;
    };
    for (const entry of manifest.schemas) {
      const schema = JSON.parse(rendered[entry.file]!) as Record<string, unknown>;
      const properties = (schema['properties'] ?? {}) as Record<string, unknown>;
      for (const key of Object.keys(properties)) {
        expect(key).toMatch(/^[a-z][a-zA-Z0-9]*$/);
        expect(
          [...VENDOR_BLOCKLIST, ...NOTIFICATION_PLATFORM_BLOCKLIST].some((token) =>
            key.toLowerCase().includes(token),
          ),
          `${entry.file} property "${key}" names a provider surface`,
        ).toBe(false);
      }
    }
  });
});
