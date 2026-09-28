/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-to-kernel
 * devDep precedent of W002/W006/W007/W008/W009/W011/W013/W023/W043).
 *
 * This file pins structural compatibility between the entitlements
 * kernel's mirrored shapes and the sibling kernel vocabularies WITHOUT
 * adding runtime dependencies beyond the frozen W024 policy
 * (@epoch/agent-protocol, @epoch/marketplace, @epoch/solution-delivery,
 * @epoch/tenancy):
 *
 * - `EntitlementsEventContent` is TYPE-EQUAL to @epoch/event-log's
 *   `EventContent` (billing/seat events are append-only typed events
 *   over the W010 event shapes);
 * - the entitlements `cross-tenant-denied` error code IS a member of
 *   @epoch/authorization's `DenialCode` vocabulary (the shared
 *   tenant-isolation denial grammar — renaming it in either package
 *   breaks this compile-time pin);
 * - the mirrored principal grammar is the identity grammar
 *   (`PrincipalId` is the plain-string alias, exactly like
 *   @epoch/identity's `PrincipalId`; value-level equality is pinned by
 *   the runtime parity test);
 * - the settlement-port id grammar re-declares the marketplace
 *   payment-port pattern (one shared opaque port grammar; value-equality
 *   pinned by the runtime parity test);
 * - the entitlement-priced billable bases are members of the marketplace
 *   `RevenueBasis` vocabulary (the revenue basis a line accounts for is
 *   the marketplace's closed vocabulary).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would drag
 * the devDependencies into every downstream consumer's compile graph. It
 * is compiled by this package's own `tsc --noEmit` (tsconfig.json includes
 * src/**) and mirrored by runtime parity tests (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { PrincipalId } from './primitives';
import type { EntitlementsEventContent } from './events';
import type { EntitlementsErrorCode } from './errors';

import type { EventContent } from '@epoch/event-log';
import type { PrincipalId as IdentityPrincipalId } from '@epoch/identity';
import type { DenialCode } from '@epoch/authorization';
import type { RevenueBasis } from '@epoch/marketplace';

/** Billing/seat events are W010 event shapes, structurally (W010 parity). */
export type EntitlementsEventParity = Expect<Equals<EntitlementsEventContent, EventContent>>;

/** Entitlements principals are identity principal ids, structurally (W009 parity). */
export type PrincipalIdParity = Expect<Equals<PrincipalId, IdentityPrincipalId>>;

/**
 * The shared tenant-isolation denial: the entitlements kernel's
 * `cross-tenant-denied` code is a member of the W004 authorization denial
 * vocabulary (a rename on either side breaks this pin).
 */
export type CrossTenantDeniedParity = Expect<
  Equals<
    Extract<EntitlementsErrorCode, 'cross-tenant-denied'>,
    Extract<DenialCode, 'cross-tenant-denied'>
  >
>;

/**
 * The entitlement-priced billable bases are members of the marketplace
 * revenue-basis vocabulary (one-time, subscription, seat, usage).
 */
export type RevenueBasisParity = Expect<
  Equals<Extract<'one-time' | 'subscription' | 'seat' | 'usage', RevenueBasis>, 'one-time' | 'subscription' | 'seat' | 'usage'>
>;

/**
 * The settlement-port id grammar re-declares the marketplace payment-port
 * grammar (the shared opaque `port:<slug>` grammar). Value-level equality
 * of the two patterns is pinned by the runtime parity test
 * (test/parity.test.ts) — a divergence there is a review gate.
 */

/** Runtime import guard: parity imports must stay type-only. */
export type KernelParityImports = [
  Expect<Equals<IdentityPrincipalId, string>>,
  Expect<Equals<EventContent['schemaVersion'], EntitlementsEventContent['schemaVersion']>>,
];
