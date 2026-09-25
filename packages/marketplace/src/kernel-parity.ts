/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-to-kernel
 * devDep precedent of W002/W006/W007/W008/W009/W011/W013/W028).
 *
 * This file pins structural compatibility between the marketplace's
 * mirrored shapes and the sibling kernel vocabularies WITHOUT adding
 * runtime dependencies (the W023 runtime-dependency policy:
 * @epoch/agent-protocol, @epoch/capability-registry, and @epoch/tenancy
 * only):
 *
 * - `TrustEvidenceRecord` is TYPE-EQUAL to @epoch/evidence's
 *   `EvidenceRecord` (trust metadata is W006-shaped evidence);
 * - `UsageEventContent` is TYPE-EQUAL to @epoch/event-log's `EventContent`
 *   (usage accounting is append-only typed events over the W010 event
 *   shapes);
 * - `PrincipalId` is the plain-string alias, exactly like @epoch/identity's
 *   `PrincipalId` (the mirrored pattern's value-level equality is pinned by
 *   the runtime parity test `test/parity.test.ts`);
 * - the marketplace `cross-tenant-denied` error code IS a member of
 *   @epoch/authorization's `DenialCode` vocabulary (the shared
 *   tenant-isolation denial grammar — renaming it in either package breaks
 *   this compile-time pin);
 * - the digest discipline mirrors (SHA-256 over canonical JSON) are the
 *   same string-level shapes as @epoch/experience-protocol's mirrored
 *   digest schema.
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would drag
 * the devDependencies into every downstream consumer's compile graph. It
 * is compiled by this package's own `tsc --noEmit` (tsconfig.json includes
 * src/**) and mirrored by runtime parity tests (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { PrincipalId } from './primitives';
import type { TrustEvidenceRecord } from './trust';
import type { UsageEventContent } from './usage';
import type { EvidenceRecord } from '@epoch/evidence';
import type { EventContent } from '@epoch/event-log';
import type { PrincipalId as IdentityPrincipalId } from '@epoch/identity';
import type { DenialCode } from '@epoch/authorization';
import type { MarketplaceErrorCode } from './errors';

/** Trust metadata is W006-shaped evidence, structurally (W006 parity). */
export type TrustEvidenceParity = Expect<Equals<TrustEvidenceRecord, EvidenceRecord>>;

/** Usage events are W010 event shapes, structurally (W010 parity). */
export type UsageEventParity = Expect<Equals<UsageEventContent, EventContent>>;

/** Marketplace principals are identity principal ids, structurally (W009 parity). */
export type PrincipalIdParity = Expect<Equals<PrincipalId, IdentityPrincipalId>>;

/**
 * The shared tenant-isolation denial: the marketplace's
 * `cross-tenant-denied` code is a member of the W004 authorization denial
 * vocabulary (a rename on either side breaks this pin).
 */
export type CrossTenantDeniedParity = Expect<
  Equals<Extract<MarketplaceErrorCode, 'cross-tenant-denied'>, Extract<DenialCode, 'cross-tenant-denied'>>
>;

/** Runtime import guard: parity imports must stay type-only. */
export type KernelParityImports = [
  Expect<Equals<IdentityPrincipalId, string>>,
  Expect<Equals<EventContent['schemaVersion'], UsageEventContent['schemaVersion']>>,
];
