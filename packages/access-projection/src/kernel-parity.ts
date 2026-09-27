/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-to-kernel
 * devDep precedent of W002/W006/W007/W008/W009/W011/W013/W023/W028/W036).
 *
 * This file pins structural compatibility between the access-projection
 * shapes and the sibling kernel vocabularies WITHOUT adding runtime
 * dependencies (the W041 runtime-dependency policy:
 * @epoch/authorization, @epoch/solution-delivery, @epoch/agent-protocol,
 * @epoch/tenancy, and zod only):
 *
 * - `AccessProjectionEventContent` is TYPE-EQUAL to @epoch/event-log's
 *   `EventContent` (access-projection lifecycle events are append-only
 *   typed events over the W010 event shapes — the open
 *   `access-projection:` payload namespace);
 * - the projection principal-kind vocabulary is TYPE-EQUAL to
 *   @epoch/identity's `PrincipalKind` (humans, agents, and SERVICE
 *   principals — service-to-service projections follow the same
 *   two-stage path);
 * - the audit provenance block is TYPE-EQUAL to the W036 uncertainty
 *   provenance (the W006-convention provenance carried by every audit
 *   record);
 * - the evidence-scope digest grammar is TYPE-EQUAL to @epoch/evidence's
 *   exact-revision digest (evidence scopes reference W006 records by
 *   content address);
 * - the W011 experience-protocol projected-reference CONVENTION (kind
 *   + tenant scope + exact-revision digest, never embedded objects) is
 *   the declaration-compatibility reference for how projections cite
 *   kernel state. ARCHITECTURE NOTE: @epoch/experience-protocol is
 *   layer `experience`, and the boundary rules forbid kernel->experience
 *   edges even as devDependencies — so the convention is MIRORED here
 *   (documented on CanonicalObjectIdentity / the audit object
 *   references) instead of imported. If the Tech Lead wants a live
 *   compile-time pin, that requires an ACR re-layering decision; the
 *   mirror keeps `pnpm check` green (the authoritative gate).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT
 * re-exported from the package index — importing it into the public
 * surface would drag the devDependencies into every downstream
 * consumer's compile graph. It is compiled by this package's own
 * `tsc --noEmit` (tsconfig.json includes src/**) and mirrored by
 * runtime parity tests (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { AccessProjectionEventContent } from './events';
import type { AuditProvenance } from './audit';
import type { EvidenceScope } from './policy';
import type { ProjectionPrincipalKind } from './version';
import type { EventContent } from '@epoch/event-log';
import type { PrincipalKind } from '@epoch/identity';
import type { ExactRevisionRef } from '@epoch/evidence';
import type { UncertaintyState } from '@epoch/solution-delivery';

/** Access-projection events are W010 event shapes, structurally (W010 parity). */
export type AccessProjectionEventParity = Expect<
  Equals<AccessProjectionEventContent, EventContent>
>;

/** The principal-kind vocabulary is @epoch/identity's (service principals included). */
export type PrincipalKindParity = Expect<Equals<ProjectionPrincipalKind, PrincipalKind>>;

/** Audit provenance is the W006/W036 provenance convention. */
export type AuditProvenanceParity = Expect<Equals<AuditProvenance, UncertaintyState['provenance']>>;

/** The evidence-scope digest is the W006 exact-revision digest grammar. */
export type EvidenceScopeDigestParity = Expect<
  Equals<Extract<EvidenceScope, { mode: 'listed' }>['allowedDigests'][number], ExactRevisionRef['digest']>
>;
