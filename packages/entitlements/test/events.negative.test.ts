// Negative coverage of the entitlements/billing event vocabulary:
// malformed envelopes, unknown discriminators, broken causal chains,
// tamper detection, and vendor-field rejection.
import { describe, expect, it } from 'vitest';
import {
  parseEntitlementsEventData,
  sealEntitlementsEvent,
  verifySealedEntitlementsEvent,
} from '../src/index';
import { ACCOUNT, INVOICE, PRINCIPAL, TENANT, T1, expectError, unwrap } from './fixtures';

const STREAM = 'stream:billing-globex-eur';

function invoiceDraftedEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    streamId: STREAM,
    sequence: 1,
    tenantId: TENANT,
    actor: PRINCIPAL,
    causalParent: null,
    payload: {
      discriminator: 'billing:invoice-drafted',
      data: {
        invoiceId: INVOICE,
        invoiceDigest: 'a'.repeat(64),
        accountId: ACCOUNT,
        lineCount: 2,
        totalAmount: '162',
        currency: 'EUR',
        draftedAt: T1,
      },
    },
    occurredAt: T1,
    ...overrides,
  };
}

describe('event sealing (negative)', () => {
  it('a zero sequence number is rejected (1-based)', () => {
    const error = expectError(sealEntitlementsEvent(invoiceDraftedEvent({ sequence: 0 })));
    expect(error.code).toBe('validation');
  });

  it('a same-stream causal parent must be strictly earlier', () => {
    const error = expectError(
      sealEntitlementsEvent(
        invoiceDraftedEvent({ sequence: 1, causalParent: { streamId: STREAM, sequence: 1 } }),
      ),
    );
    expect(error.code).toBe('validation');
    expect(JSON.stringify(error)).toContain('strictly earlier');
  });

  it('an unknown payload discriminator is rejected by the payload-family discipline', () => {
    const error = expectError(
      parseEntitlementsEventData('billing:not-a-kind', { anything: true }),
    );
    expect(error.code).toBe('validation');
    expect(JSON.stringify(error)).toContain('payload discriminator');
  });

  it('payload data violating its typed contract is a validation rejection', () => {
    const error = expectError(
      parseEntitlementsEventData('billing:invoice-drafted', { invoiceId: 'nope' }),
    );
    expect(error.code).toBe('validation');
  });

  it('a malformed stream id is rejected', () => {
    const error = expectError(sealEntitlementsEvent(invoiceDraftedEvent({ streamId: 'stream:other-family-x' })));
    expect(error.code).toBe('validation');
  });

  it('an event with vendor fields inside the payload is the typed vendor-fields rejection', () => {
    const error = expectError(
      sealEntitlementsEvent(
        invoiceDraftedEvent({ payload: { discriminator: 'billing:invoice-drafted', data: {}, vendor: 'x' } }),
      ),
    );
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('a top-level vendor field is the typed vendor-fields rejection', () => {
    const error = expectError(sealEntitlementsEvent(invoiceDraftedEvent({ slackChannel: '#billing' })));
    expect(error.code).toBe('vendor-fields-rejected');
  });
});

describe('event verification (negative)', () => {
  it('a tampered digest never verifies', () => {
    const sealed = unwrap(sealEntitlementsEvent(invoiceDraftedEvent()));
    const error = expectError(
      verifySealedEntitlementsEvent({ ...sealed, contentDigest: 'f'.repeat(64) }),
    );
    expect(error.code).toBe('digest-mismatch');
  });

  it('tampered payload data never verifies', () => {
    const sealed = unwrap(sealEntitlementsEvent(invoiceDraftedEvent()));
    const tampered = {
      ...sealed,
      payload: {
        discriminator: 'billing:invoice-drafted',
        data: { ...(sealed.payload.data as Record<string, unknown>), totalAmount: '999' },
      },
    };
    const error = expectError(verifySealedEntitlementsEvent(tampered));
    expect(error.code).toBe('digest-mismatch');
  });

  it('a non-event document is the typed vendor-fields rejection (never an exception)', () => {
    const error = expectError(verifySealedEntitlementsEvent({ nope: true }));
    expect(error.code).toBe('vendor-fields-rejected');
  });
});
