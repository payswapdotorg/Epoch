// RUNTIME PARITY with the sibling upstream authorities from the SERVICE
// layer (devDependencies + real runtime deps — never a runtime edge to
// the devDep): the portal's emitted events seal through the REAL W010
// sealEvent and digest identically; adopted grants validate through the
// REAL marketplace validator; the adopted billing account verifies
// through the REAL W024 verifier; the portal's version envelopes verify
// through the REAL W023 kernel verifier.
import { describe, expect, it } from 'vitest';
import { computeEventDigest, EVENT_LOG_RECORD_VERSION, EVENT_STREAM_ID_PATTERN, sealEvent } from '@epoch/event-log';
import { EntitlementGrantRecordSchema } from '@epoch/marketplace';
import { verifySealedListingVersion } from '@epoch/marketplace';
import { verifySealedBillingAccount } from '@epoch/entitlements';
import { CapabilityRegistry } from '@epoch/capability-registry';
import {
  DeveloperPortalHost,
  PORTAL_EVENT_RECORD_VERSION,
  PORTAL_STREAM_ID_PATTERN,
  portalListingStreamIdOf,
} from '../src/index';
import type { CapabilityBrowseSurface } from '../src/index';
import {
  AUTH,
  DEVELOPER,
  T0,
  T1,
  T2,
  billingAccount,
  draft,
  fixtureRegistry,
  grant,
  unwrap,
} from './helpers';

function portal(): DeveloperPortalHost {
  return new DeveloperPortalHost({ registry: fixtureRegistry() });
}

describe('service-layer parity with the sibling authorities (runtime)', () => {
  it('the portal\'s emitted events seal through the REAL W010 sealEvent', () => {
    const host = portal();
    const created = unwrap(
      host.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'key-a',
        draft: draft(),
        createdAt: T0,
      }),
    );
    const events = unwrap(
      host.readStream({
        asTenant: DEVELOPER,
        authorization: AUTH,
        streamId: portalListingStreamIdOf(created.listingId),
      }),
    );
    expect(events).toHaveLength(1);
    const event = events[0]!;
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

  it('the mirrored W010 constants are byte-identical to the real ones', () => {
    expect(PORTAL_EVENT_RECORD_VERSION).toBe(EVENT_LOG_RECORD_VERSION);
    expect(String(PORTAL_STREAM_ID_PATTERN)).toBe(String(EVENT_STREAM_ID_PATTERN));
  });

  it('adopted grants validate through the REAL marketplace validator', () => {
    const host = portal();
    const created = unwrap(
      host.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'key-a',
        draft: draft(),
        createdAt: T0,
      }),
    );
    const grantRecord = grant({ listingId: created.listingId });
    unwrap(host.adoptEntitlementGrant({ asTenant: DEVELOPER, authorization: AUTH, grant: grantRecord }));
    expect(EntitlementGrantRecordSchema.safeParse(grantRecord).success).toBe(true);
  });

  it('published versions verify through the REAL W023 kernel verifier', () => {
    const host = portal();
    const created = unwrap(
      host.createListingDraft({
        asTenant: DEVELOPER,
        authorization: AUTH,
        idempotencyKey: 'key-a',
        draft: draft(),
        createdAt: T0,
      }),
    );
    unwrap(
      host.submitListing({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        submittedAt: T1,
      }),
    );
    unwrap(
      host.publishListingVersion({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        version: '1.0.0',
        publishedAt: T2,
      }),
    );
    const sealed = unwrap(
      host.getListingVersion({
        asTenant: DEVELOPER,
        authorization: AUTH,
        listingId: created.listingId,
        version: '1.0.0',
      }),
    );
    const verified = verifySealedListingVersion(sealed);
    expect(verified.ok, JSON.stringify(verified.ok ? null : verified.error)).toBe(true);
  });

  it('the adopted billing account verifies through the REAL W024 verifier', () => {
    const host = portal();
    const account = billingAccount();
    unwrap(host.adoptBillingAccount({ asTenant: DEVELOPER, authorization: AUTH, account }));
    expect(verifySealedBillingAccount(account).ok).toBe(true);
  });

  it('the REAL CapabilityRegistry satisfies the browse seam structurally', () => {
    const registry: CapabilityBrowseSurface = new CapabilityRegistry();
    const host = new DeveloperPortalHost({ registry });
    // The default constructor also wires a REAL registry.
    expect(new DeveloperPortalHost().describe().service).toBe('epoch.developer-portal-host');
    expect(host.browseCapabilities({ asTenant: DEVELOPER, authorization: AUTH }).ok).toBe(true);
  });
});
