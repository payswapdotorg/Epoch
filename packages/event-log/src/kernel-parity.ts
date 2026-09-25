/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-to-kernel
 * devDep precedent of W002/W006/W007/W008/W009/W011).
 *
 * This file pins structural compatibility between the event-log's mirrored
 * tenant/principal id grammars and the W009 vocabularies WITHOUT adding
 * runtime dependencies:
 *
 * - `EventTenantId` / `EventActor` are TYPE-only `string` aliases, exactly
 *   like @epoch/tenancy's `TenantId` and @epoch/identity's `PrincipalId`
 *   (the value-level pattern equality is pinned by the runtime parity
 *   test `test/parity.test.ts`);
 * - the mirrored patterns `EVENT_TENANT_ID_PATTERN` /
 *   `EVENT_ACTOR_PATTERN` are the SAME regexes as tenancy's
 *   `TENANT_ID_PATTERN` / identity's `PRINCIPAL_ID_PATTERN` (their `.source`
 *   equality is asserted at runtime).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would drag
 * the devDependencies into every downstream consumer's compile graph. It
 * is compiled by this package's own `tsc --noEmit` (tsconfig.json includes
 * src/**) and mirrored by runtime parity tests (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { EventActor, EventTenantId } from './types';
import type { TenantId } from '@epoch/tenancy';
import type { PrincipalId } from '@epoch/identity';

/** Event tenant scopes are tenancy tenant ids, structurally (W009 parity). */
export type EventTenantIdParity = Expect<Equals<EventTenantId, TenantId>>;

/** Event actors are identity principal ids, structurally (W009 parity). */
export type EventActorParity = Expect<Equals<EventActor, PrincipalId>>;

/** Runtime import guard: parity imports must stay type-only. */
export type KernelParityImports = [
  Expect<Equals<TenantId, string>>,
  Expect<Equals<PrincipalId, string>>,
];
