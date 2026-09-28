// NEUTRALITY: no vendor/provider vocabulary in the host's records
// (lock rule 13 — SIEM/monitoring vendors are future adapters behind
// the capability fabric).
import { describe, expect, it } from 'vitest';
import { SecurityRuntime } from '../src/index';
import {
  TENANT,
  T1,
  allowAuth,
  conformingSubject,
  listingContent,
  policyContent,
  unwrap,
} from './helpers';

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
  'sysdig',
  'crowdstrike',
];

describe('provider neutrality (lock rule 13)', () => {
  it('the host records carry no vendor vocabulary', () => {
    const runtime = new SecurityRuntime();
    const auth = allowAuth();
    unwrap(runtime.registerPolicy({ tenantId: TENANT, authorization: auth, policy: policyContent() }));
    unwrap(runtime.registerListing({ tenantId: TENANT, authorization: auth, listing: listingContent() }));
    const admitted = unwrap(
      runtime.admitExtension({
        tenantId: TENANT,
        authorization: auth,
        subject: conformingSubject(),
        admittedAt: T1,
      }),
    );
    const state = unwrap(
      runtime.projectHealth({ tenantId: TENANT, authorization: auth, projectedAt: T1 }),
    );
    const serialized = [
      JSON.stringify(admitted),
      JSON.stringify(state.metrics),
      JSON.stringify(state.health),
      JSON.stringify(runtime.health()),
      JSON.stringify(runtime.snapshot()),
    ].join('\n').toLowerCase();
    for (const term of VENDOR_TERMS) {
      expect(serialized.includes(`"${term}`), term).toBe(false);
    }
  });

  it('the service surface vocabulary is neutral', () => {
    const runtime = new SecurityRuntime();
    expect(runtime.health().service).toBe('epoch.security-runtime');
    expect(JSON.stringify(runtime.health())).not.toMatch(/vendor|provider|siem/i);
  });
});
