// RUNTIME PARITY with the sibling kernel vocabularies from the SERVICE
// layer (devDependencies only — no runtime coupling): the host's emitted
// events seal through the REAL W010 sealEvent and digest identically;
// the adopted grants validate through the REAL marketplace validator;
// the delivery registrations verify through the REAL W036 verifier.
import { describe, expect, it } from 'vitest';
import { billingStreamIdOf } from '@epoch/entitlements';
import { computeEventDigest, sealEvent } from '@epoch/event-log';
import { EntitlementGrantRecordSchema } from '@epoch/marketplace';
import { verifySealedDeliveryRecord } from '@epoch/solution-delivery';
import { BillingHost } from '../src/index';
import {
  AUTH,
  TENANT,
  T0,
  T1,
  PRINCIPAL,
  deliveredActual,
  grant,
  unwrap,
} from './helpers';

describe('service-layer parity with the sibling kernels (runtime)', () => {
  it('the host\'s emitted events seal through the REAL W010 sealEvent', () => {
    const host = new BillingHost();
    const account = unwrap(
      host.openAccount({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'account-key-1',
        currency: 'EUR',
        displayName: 'Globex EUR billing account',
        openedAt: T0,
        openedBy: PRINCIPAL,
      }),
    );
    const stream = unwrap(
      host.readStream({
        asTenant: TENANT,
        authorization: AUTH,
        streamId: billingStreamIdOf(account.account.accountId),
      }),
    );
    expect(stream).toHaveLength(1);
    const event = stream[0]!;
    // The mirrored content (digest excluded) reseals through the REAL
    // W010 pipeline to the identical digest.
    const { contentDigest, ...content } = event;
    const real = sealEvent(content);
    expect(real.ok, JSON.stringify(real.ok ? null : real.error)).toBe(true);
    if (real.ok) {
      expect(contentDigest).toBe(real.value.digest);
      expect(contentDigest).toBe(computeEventDigest(content as never));
    }
  });

  it('the seat events seal through the REAL W010 sealEvent too', () => {
    const host = new BillingHost();
    unwrap(host.registerGrant({ asTenant: TENANT, authorization: AUTH, grant: grant() }));
    unwrap(
      host.assignSeat({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'seat-1',
        entitlementId: 'entitlement:globex-stress',
        principalId: 'principal:field-engineer',
        assignedAt: T1,
        assignedBy: PRINCIPAL,
      }),
    );
    const stream = unwrap(
      host.readStream({
        asTenant: TENANT,
        authorization: AUTH,
        streamId: 'stream:entitlements-globex-stress',
      }),
    );
    expect(stream).toHaveLength(1);
    const { contentDigest, ...content } = stream[0]!;
    const real = sealEvent(content);
    expect(real.ok, JSON.stringify(real.ok ? null : real.error)).toBe(true);
    if (real.ok) {
      expect(contentDigest).toBe(real.value.digest);
    }
  });

  it('the adopted grant validates through the REAL W023 marketplace validator', () => {
    expect(EntitlementGrantRecordSchema.safeParse(grant()).success).toBe(true);
  });

  it('the registered delivery verifies through the REAL W036 verifier', () => {
    const verified = verifySealedDeliveryRecord(deliveredActual());
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value.actuals).toHaveLength(1);
      expect(verified.value.actuals[0]!.payload.derivedFromObservationId).toBe(
        'observation:excavation-done',
      );
    }
  });

  it('the emitted events reference only streams the W010 grammar admits', () => {
    const host = new BillingHost();
    const account = unwrap(
      host.openAccount({
        asTenant: TENANT,
        authorization: AUTH,
        idempotencyKey: 'account-key-1',
        currency: 'EUR',
        displayName: 'Globex EUR',
        openedAt: T0,
        openedBy: PRINCIPAL,
      }),
    );
    const stream = unwrap(
      host.readStream({
        asTenant: TENANT,
        authorization: AUTH,
        streamId: billingStreamIdOf(account.account.accountId),
      }),
    );
    expect(stream[0]!.streamId).toMatch(/^stream:[a-z0-9][a-z0-9-]{0,62}$/);
  });
});
