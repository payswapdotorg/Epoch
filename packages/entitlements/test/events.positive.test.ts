// Positive coverage of the entitlements/billing event vocabulary (W010
// shapes): sealing, payload-family validation, verification, and the
// deterministic stream-id derivation.
import { describe, expect, it } from 'vitest';
import {
  billingStreamIdOf,
  entitlementsStreamIdOf,
  parseEntitlementsEventData,
  sealEntitlementsEvent,
  verifySealedEntitlementsEvent,
} from '../src/index';
import {
  ACCOUNT,
  ENTITLEMENT,
  INVOICE,
  PRINCIPAL,
  TENANT,
  T1,
  T2,
  sealedSeatAssignment,
  unwrap,
} from './fixtures';

const STREAM = 'stream:billing-globex-eur';
const CHECK = '2026-04-01T08:00:00.000Z';

/** One billing:invoice-drafted event content as loose JSON. */
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

describe('event sealing (positive)', () => {
  it('seals a billing:invoice-drafted event', () => {
    const sealed = unwrap(sealEntitlementsEvent(invoiceDraftedEvent()));
    expect(sealed.streamId).toBe(STREAM);
    expect(sealed.sequence).toBe(1);
    expect(sealed.contentDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verification round-trips (schema + payload family + digest)', () => {
    const sealed = unwrap(sealEntitlementsEvent(invoiceDraftedEvent()));
    const verified = unwrap(verifySealedEntitlementsEvent(sealed));
    expect(verified).toEqual(sealed);
  });

  it('the causal parent chains to the earlier event in-stream', () => {
    const first = unwrap(sealEntitlementsEvent(invoiceDraftedEvent()));
    expect(first.sequence).toBe(1);
    const second = unwrap(
      sealEntitlementsEvent(
        invoiceDraftedEvent({
          sequence: 2,
          causalParent: { streamId: STREAM, sequence: 1 },
          payload: {
            discriminator: 'billing:invoice-issued',
            data: {
              invoiceId: INVOICE,
              invoiceDigest: 'a'.repeat(64),
              accountId: ACCOUNT,
              totalAmount: '162',
              currency: 'EUR',
              issuedAt: T2,
            },
          },
          occurredAt: T2,
        }),
      ),
    );
    expect(second.causalParent).toEqual({ streamId: STREAM, sequence: 1 });
  });

  it('seat-assigned events seal on the entitlements stream', () => {
    const assignment = sealedSeatAssignment();
    const sealed = unwrap(
      sealEntitlementsEvent({
        schemaVersion: 1,
        streamId: entitlementsStreamIdOf(ENTITLEMENT),
        sequence: 1,
        tenantId: TENANT,
        actor: PRINCIPAL,
        causalParent: null,
        payload: {
          discriminator: 'entitlements:seat-assigned',
          data: {
            seatAssignmentId: assignment.seatAssignmentId,
            seatAssignmentDigest: assignment.contentDigest,
            entitlementId: ENTITLEMENT,
            principalId: assignment.principalId,
            assignedAt: assignment.assignedAt,
          },
        },
        occurredAt: T1,
      }),
    );
    expect(sealed.payload.discriminator).toBe('entitlements:seat-assigned');
  });

  it('payload data parses through the payload-family discipline', () => {
    const data = unwrap(
      parseEntitlementsEventData('billing:invoice-drafted', {
        invoiceId: INVOICE,
        invoiceDigest: 'a'.repeat(64),
        accountId: ACCOUNT,
        lineCount: 2,
        totalAmount: '162',
        currency: 'EUR',
        draftedAt: T1,
      }),
    );
    expect(data.invoiceId).toBe(INVOICE);
  });

  it('stream ids derive deterministically', () => {
    expect(entitlementsStreamIdOf(ENTITLEMENT)).toBe('stream:entitlements-globex-stress');
    expect(billingStreamIdOf(ACCOUNT)).toBe('stream:billing-globex-eur');
    expect(STREAM).toBe(billingStreamIdOf(ACCOUNT));
  });

  it('every discriminator of the closed vocabulary seals (coverage sweep)', () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      [
        'entitlements:seat-assigned',
        {
          seatAssignmentId: 'seat:globex-stress-1',
          seatAssignmentDigest: 'a'.repeat(64),
          entitlementId: ENTITLEMENT,
          principalId: PRINCIPAL,
          assignedAt: T1,
        },
      ],
      [
        'entitlements:seat-released',
        {
          releaseId: 'seat-release:globex-stress-1',
          releaseDigest: 'a'.repeat(64),
          seatAssignmentId: 'seat:globex-stress-1',
          entitlementId: ENTITLEMENT,
          releasedAt: T2,
        },
      ],
      [
        'billing:account-opened',
        {
          accountId: ACCOUNT,
          accountDigest: 'a'.repeat(64),
          currency: 'EUR',
          openedAt: T1,
        },
      ],
      [
        'billing:invoice-drafted',
        {
          invoiceId: INVOICE,
          invoiceDigest: 'a'.repeat(64),
          accountId: ACCOUNT,
          lineCount: 1,
          totalAmount: '10',
          currency: 'EUR',
          draftedAt: T1,
        },
      ],
      [
        'billing:invoice-issued',
        {
          invoiceId: INVOICE,
          invoiceDigest: 'a'.repeat(64),
          accountId: ACCOUNT,
          totalAmount: '10',
          currency: 'EUR',
          issuedAt: T2,
        },
      ],
      [
        'billing:invoice-settled',
        {
          invoiceId: INVOICE,
          invoiceDigest: 'a'.repeat(64),
          accountId: ACCOUNT,
          settlementId: 'settlement:globex-2026-04-001',
          settlementPortId: 'port:reference-settlement',
          totalAmount: '10',
          currency: 'EUR',
          settledAt: T2,
        },
      ],
      [
        'billing:invoice-voided',
        {
          invoiceId: INVOICE,
          invoiceDigest: 'a'.repeat(64),
          accountId: ACCOUNT,
          voidedAt: T2,
        },
      ],
    ];
    for (const [discriminator, data] of cases) {
      const sealed = unwrap(
        sealEntitlementsEvent({
          schemaVersion: 1,
          streamId: discriminator.startsWith('entitlements:')
            ? entitlementsStreamIdOf(ENTITLEMENT)
            : billingStreamIdOf(ACCOUNT),
          sequence: 1,
          tenantId: TENANT,
          actor: PRINCIPAL,
          causalParent: null,
          payload: { discriminator, data },
          occurredAt: T1,
        }),
      );
      expect(sealed.payload.discriminator).toBe(discriminator);
    }
  });
});

describe('event timestamps discipline (positive)', () => {
  it('the event instant is the producer-supplied occurredAt', () => {
    const sealed = unwrap(sealEntitlementsEvent(invoiceDraftedEvent({ occurredAt: CHECK })));
    expect(sealed.occurredAt).toBe(CHECK);
  });
});
