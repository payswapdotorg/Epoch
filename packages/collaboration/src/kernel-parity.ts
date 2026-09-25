/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-to-kernel
 * devDep precedent of W002/W006/W007/W008/W009/W010-event-log).
 *
 * This file pins structural compatibility between the collaboration
 * package's mirrored tenant/principal id grammars and the W009
 * vocabularies WITHOUT adding runtime dependencies:
 *
 * - `CollaborationTenantId` / `ParticipantPrincipalId` are TYPE-only
 *   `string` aliases, exactly like @epoch/tenancy's `TenantId` and
 *   @epoch/identity's `PrincipalId` (value-level pattern equality is
 *   pinned by the runtime parity test test/parity.test.ts);
 * - the mirrored patterns (tenant/principal/workspace/project) are the
 *   SAME regexes as tenancy's and identity's (their `.source` equality
 *   is asserted at runtime).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would
 * drag the devDependencies into every downstream consumer's compile
 * graph. It is compiled by this package's own `tsc --noEmit` and mirrored
 * by runtime parity tests.
 */
import type { Equals, Expect } from './type-utils';
import type { ParticipantPrincipalId, CollaborationTenantId } from './types';
import type { TenantId, WorkspaceId, ProjectId } from '@epoch/tenancy';
import type { PrincipalId } from '@epoch/identity';

/** Session tenant scopes are tenancy tenant ids, structurally (W009 parity). */
export type CollaborationTenantIdParity = Expect<
  Equals<CollaborationTenantId, TenantId>
>;

/** Participants are identity principal ids, structurally (W009 parity). */
export type ParticipantPrincipalIdParity = Expect<
  Equals<ParticipantPrincipalId, PrincipalId>
>;

/** Runtime import guard: parity imports must stay type-only. */
export type KernelParityImports = [
  Expect<Equals<TenantId, string>>,
  Expect<Equals<WorkspaceId, string>>,
  Expect<Equals<ProjectId, string>>,
  Expect<Equals<PrincipalId, string>>,
];
