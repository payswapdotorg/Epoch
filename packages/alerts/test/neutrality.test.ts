// Provider-neutrality evidence (the `provider-vocabulary-rejected`
// blocklist test, the W042 precedent): no vendor or notification-
// platform tokens in the kernel source or the emitted contract
// surfaces. Concrete channels stay behind the NotificationPort seam —
// the kernel never names them.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderAlertsContractFiles } from '../src/index';

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

describe('provider neutrality (lock rule 13 — the provider-vocabulary-rejected blocklist)', () => {
  it('no src file mentions a vendor or notification-platform token', () => {
    for (const file of listFiles(SRC_DIR)) {
      const content = readFileSync(file, 'utf8').toLowerCase();
      for (const token of [...VENDOR_BLOCKLIST, ...NOTIFICATION_PLATFORM_BLOCKLIST]) {
        expect(content.includes(token), `${file} contains "${token}"`).toBe(false);
      }
    }
  });

  it('no emitted artifact mentions a vendor or notification-platform token', () => {
    const rendered = Object.entries(renderAlertsContractFiles());
    expect(rendered.length).toBeGreaterThan(0);
    for (const [rel, content] of rendered) {
      const lower = content.toLowerCase();
      for (const token of [...VENDOR_BLOCKLIST, ...NOTIFICATION_PLATFORM_BLOCKLIST]) {
        expect(lower.includes(token), `${rel} contains "${token}"`).toBe(false);
      }
    }
  });

  it('the closed channel/target vocabularies contain no provider token', () => {
    const rendered = renderAlertsContractFiles();
    const manifest = JSON.parse(rendered['manifest.json']!) as {
      dataTypes: string[];
      schemas: Array<{ type: string; file: string }>;
    };
    expect(manifest.dataTypes).toContain('NotificationTarget');
    const targetEntry = manifest.schemas.find((entry) => entry.type === 'NotificationTarget');
    expect(targetEntry).toBeDefined();
    const schema = JSON.parse(rendered[targetEntry!.file]!) as Record<string, unknown>;
    expect(JSON.stringify(schema)).toContain('targetKind');
    expect(JSON.stringify(schema)).toContain('targetRef');
  });
});
