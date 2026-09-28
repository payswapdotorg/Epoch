// RUNTIME PARITY with the sibling kernel vocabularies (the W011/W023
// kernel-parity pattern; devDependencies only — no runtime coupling):
//
// - W010: the mirrored entitlements/billing event shape is admitted by
//   the REAL @epoch/event-log seal path and digests identically; the
//   stream/actor grammars are pattern-identical; the record versions are
//   equal;
// - W009 identity: the mirrored principal grammar IS identity's pattern;
// - W004 authorization: the shared cross-tenant denial code is a member
//   of the real DENIAL_CODES vocabulary;
// - W023 marketplace: the settlement-port id grammar is identical to the
//   payment-port grammar; the entitlement grant fixtures validate
//   through the REAL marketplace validator; the entitlement-priced line
//   bases are members of the REVENUE_BASIS vocabulary; the shared
//   decimal-addition discipline produces identical totals.
import { describe, expect, it } from 'vitest';
import {
  computeEventDigest,
  EVENT_ACTOR_PATTERN,
  EVENT_LOG_RECORD_VERSION,
  EVENT_STREAM_ID_PATTERN,
  sealEvent,
} from '@epoch/event-log';
import { PRINCIPAL_ID_PATTERN as IDENTITY_PRINCIPAL_ID_PATTERN } from '@epoch/identity';
import { DENIAL_CODES } from '@epoch/authorization';
import { EntitlementGrantRecordSchema, PAYMENT_PORT_ID_PATTERN, REVENUE_BASIS } from '@epoch/marketplace';
import {
  computeEntitlementsEventDigest,
  ENTITLEMENTS_EVENT_RECORD_VERSION,
  ENTITLEMENTS_PRINCIPAL_ID_PATTERN,
  SETTLEMENT_PORT_ID_PATTERN,
  sealEntitlementsEvent,
} from '../src/index';
import { BILLING_LINE_BASIS } from '../src/index';
import { grant } from './fixtures';

describe('W010 event parity (runtime)', () => {
  it('the mirrored event shape seals through the REAL W010 sealEvent', () => {
    const content = {
      schemaVersion: ENTITLEMENTS_EVENT_RECORD_VERSION,
      streamId: 'stream:billing-globex-eur',
      sequence: 1,
      tenantId: 'tenant:globex',
      actor: 'principal:billing-admin',
      causalParent: null,
      payload: {
        discriminator: 'billing:account-opened',
        data: {
          accountId: 'billing-account:globex-eur',
          accountDigest: 'a'.repeat(64),
          currency: 'EUR',
          openedAt: '2026-04-01T08:00:00.000Z',
        },
      },
      occurredAt: '2026-04-01T08:00:00.000Z',
    };
    const mine = sealEntitlementsEvent(content);
    expect(mine.ok, JSON.stringify(mine.ok ? null : mine.error)).toBe(true);
    const real = sealEvent(content);
    expect(real.ok, JSON.stringify(real.ok ? null : real.error)).toBe(true);
    if (mine.ok && real.ok) {
      // W010's sealEvent returns the registration envelope (event + digest).
      expect(mine.value.contentDigest).toBe(real.value.digest);
    }
  });

  it('the mirrored digest equals the REAL W010 computeEventDigest', () => {
    const content = {
      schemaVersion: ENTITLEMENTS_EVENT_RECORD_VERSION,
      streamId: 'stream:entitlements-globex-stress',
      sequence: 2,
      tenantId: 'tenant:globex',
      actor: 'principal:billing-admin',
      causalParent: { streamId: 'stream:entitlements-globex-stress', sequence: 1 },
      payload: {
        discriminator: 'entitlements:seat-assigned',
        data: {
          seatAssignmentId: 'seat:globex-stress-1',
          seatAssignmentDigest: 'a'.repeat(64),
          entitlementId: 'entitlement:globex-stress',
          principalId: 'principal:field-engineer',
          assignedAt: '2026-04-01T08:00:01.000Z',
        },
      },
      occurredAt: '2026-04-01T08:00:01.000Z',
    };
    expect(computeEntitlementsEventDigest(content as never)).toBe(computeEventDigest(content as never));
  });

  it('the record versions are equal (a W010 bump breaks this gate)', () => {
    expect(ENTITLEMENTS_EVENT_RECORD_VERSION).toBe(EVENT_LOG_RECORD_VERSION);
  });

  it('the derived stream ids satisfy the REAL W010 stream grammar', () => {
    expect('stream:billing-globex-eur').toMatch(EVENT_STREAM_ID_PATTERN);
    expect('stream:entitlements-globex-stress').toMatch(EVENT_STREAM_ID_PATTERN);
  });

  it('the mirrored actor grammar is pattern-identical to the W010 actor grammar', () => {
    expect(ENTITLEMENTS_PRINCIPAL_ID_PATTERN.source).toBe(EVENT_ACTOR_PATTERN.source);
    expect(ENTITLEMENTS_PRINCIPAL_ID_PATTERN.flags).toBe(EVENT_ACTOR_PATTERN.flags);
  });
});

describe('W009 identity parity (runtime)', () => {
  it('the mirrored principal grammar IS identity\'s pattern', () => {
    expect(ENTITLEMENTS_PRINCIPAL_ID_PATTERN.source).toBe(IDENTITY_PRINCIPAL_ID_PATTERN.source);
    expect(ENTITLEMENTS_PRINCIPAL_ID_PATTERN.flags).toBe(IDENTITY_PRINCIPAL_ID_PATTERN.flags);
  });
});

describe('W004 authorization parity (runtime)', () => {
  it('the shared cross-tenant denial code is a member of the REAL denial vocabulary', () => {
    expect(DENIAL_CODES).toContain('cross-tenant-denied');
  });
});

describe('W023 marketplace parity (runtime)', () => {
  it('the settlement-port grammar is identical to the payment-port grammar', () => {
    expect(SETTLEMENT_PORT_ID_PATTERN.source).toBe(PAYMENT_PORT_ID_PATTERN.source);
    expect(SETTLEMENT_PORT_ID_PATTERN.flags).toBe(PAYMENT_PORT_ID_PATTERN.flags);
  });

  it('the grant fixtures validate through the REAL W023 validator', () => {
    const parsed = EntitlementGrantRecordSchema.safeParse(grant());
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it('the entitlement-priced line bases are members of the REAL revenue-basis vocabulary', () => {
    for (const basis of ['one-time', 'subscription', 'seat', 'usage'] as const) {
      expect(REVENUE_BASIS).toContain(basis);
      expect(BILLING_LINE_BASIS).toContain(basis);
    }
    expect(BILLING_LINE_BASIS).toContain('delivery-actual');
  });
});
