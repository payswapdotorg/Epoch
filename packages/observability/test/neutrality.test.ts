// NEUTRALITY: no vendor/provider vocabulary anywhere in the published
// records (lock rule 13 — provider semantics live behind adapters,
// never in kernel types).
import { describe, expect, it } from 'vitest';
import {
  checkIsolation,
  sealObservation,
  sealSecurityEvent,
  sealSecurityPolicy,
  securityStreamIdOf,
  securityHostStreamIdOf,
} from '../src/index';
import {
  conformingSubject,
  sealedAdmissionObservation,
  sealedPolicy,
} from './fixtures';

const VENDOR_TERMS = [
  'aws',
  'azure',
  'gcp',
  'google',
  'amazon',
  'kafka',
  'splunk',
  'datadog',
  'grafana',
  'prometheus',
  'oauth',
  'okta',
  'auth0',
  'stripe',
  'vault',
];

describe('provider neutrality (lock rule 13)', () => {
  it('sealed records carry no vendor vocabulary', () => {
    const records = [
      JSON.stringify(sealedPolicy()),
      JSON.stringify(sealedAdmissionObservation()),
      JSON.stringify(
        sealedAdmissionObservation() && {
          ...sealedAdmissionObservation(),
          contentDigest: undefined,
        },
      ),
    ];
    for (const serialized of records) {
      const lowered = serialized.toLowerCase();
      for (const term of VENDOR_TERMS) {
        expect(lowered.includes(`"${term}`), term).toBe(false);
      }
    }
  });

  it('the isolation check emits neutral violation codes', () => {
    const subject = conformingSubject({ trustClass: 't4' });
    const verdict = checkIsolation(JSON.parse(JSON.stringify(subject)) as never, {
      maxTrustClass: 't2',
      allowedFlavors: ['declarative', 'wasm'],
      allowedDataHandling: ['sandbox-only', 'tenant-scoped'],
      requireMarketplaceListing: false,
      quarantineOnViolation: true,
    });
    for (const violation of verdict.violations) {
      expect(VENDOR_TERMS.some((term) => violation.code.includes(term))).toBe(false);
    }
  });

  it('the stream id derivations are neutral', () => {
    expect(securityStreamIdOf('extension:terrain-viewer')).toBe('stream:security-terrain-viewer');
    expect(securityHostStreamIdOf('tenant:globex')).toBe('stream:security-host-globex');
  });

  it('an event carrying a vendor FIELD is rejected (strict objects)', async () => {
    const { expectError } = await import('./fixtures');
    const error = expectError(
      sealSecurityEvent({
        schemaVersion: 1,
        streamId: 'stream:security-terrain-viewer',
        sequence: 1,
        tenantId: 'tenant:globex',
        actor: 'principal:security-officer',
        causalParent: null,
        payload: { discriminator: 'security:future-kind', data: {} },
        occurredAt: '2026-03-02T09:00:00.000Z',
        vendorSink: 'datadog',
      }),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('an observation carrying a vendor FIELD is rejected', async () => {
    const { expectError } = await import('./fixtures');
    const error = expectError(
      sealObservation({
        ...sealedAdmissionObservation(),
        contentDigest: undefined,
        vendorProvider: 'okta',
      }),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('a policy carrying a vendor FIELD is rejected', async () => {
    const { expectError } = await import('./fixtures');
    const error = expectError(
      sealSecurityPolicy({
        ...sealedPolicy(),
        contentDigest: undefined,
        vendorPlan: 'splunk',
      }),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });
});
