/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-to-kernel
 * devDep precedent of W002/W006/W007/W008/W009/W011/W013).
 *
 * This file pins structural compatibility between the agent-orchestration
 * kernel's mirrored tenant/principal id grammars and the W009 vocabularies
 * WITHOUT adding runtime dependencies:
 *
 * - `OrchestrationTenantId` / `OrchestrationPrincipalId` are TYPE-only
 *   `string` aliases, exactly like @epoch/tenancy's `TenantId` and
 *   @epoch/identity's `PrincipalId` (the value-level pattern equality is
 *   pinned by the runtime parity test `test/parity.test.ts`);
 * - the mirrored patterns `ORCHESTRATION_TENANT_ID_PATTERN` /
 *   `ORCHESTRATION_PRINCIPAL_ID_PATTERN` are the SAME regexes as tenancy's
 *   `TENANT_ID_PATTERN` / identity's `PRINCIPAL_ID_PATTERN` (their
 *   `.source` equality is asserted at runtime);
 * - the orchestration `cross-tenant-denied` rejection code is the same
 *   vocabulary @epoch/authorization denies with (W009), and the W010
 *   `RetryableActionPhase` subset compiles only against the event-log
 *   phase vocabulary.
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would drag
 * the devDependencies into every downstream consumer's compile graph. It
 * is compiled by this package's own `tsc --noEmit` (tsconfig.json includes
 * src/**) and mirrored by runtime parity tests (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { OrchestrationPrincipalId, OrchestrationTenantId } from './types';
import type { RetryableActionPhase } from './version';
import type { TenantId } from '@epoch/tenancy';
import type { PrincipalId } from '@epoch/identity';
import type { TenantId as AuthorizationTenantId, DenialCode } from '@epoch/authorization';
import type { ActionEventPhase } from '@epoch/event-log';

/** Orchestration tenant scopes are tenancy tenant ids, structurally (W009 parity). */
export type OrchestrationTenantIdParity = Expect<Equals<OrchestrationTenantId, TenantId>>;

/** Orchestration principal references are identity principal ids, structurally (W009 parity). */
export type OrchestrationPrincipalIdParity = Expect<
  Equals<OrchestrationPrincipalId, PrincipalId>
>;

/** The authorization kernel scopes tenants with the same structural grammar (W009 parity). */
export type AuthorizationTenantParity = Expect<
  Equals<OrchestrationTenantId, AuthorizationTenantId>
>;

/** Runtime import guard: parity imports must stay type-only. */
export type KernelParityImports = [
  Expect<Equals<TenantId, string>>,
  Expect<Equals<PrincipalId, string>>,
  Expect<Equals<AuthorizationTenantId, string>>,
];

/**
 * The typed cross-tenant rejection vocabulary mirrors @epoch/authorization's
 * denial codes (W009) — asserted as a value-level equality at runtime in
 * test/parity.test.ts.
 */
export type CrossTenantVocabularyParity = Expect<
  'cross-tenant-denied' extends DenialCode ? true : false
>;

/** Retry policies cover only real W010 action lifecycle phases. */
export type RetryPhaseParity = Expect<RetryableActionPhase extends ActionEventPhase ? true : false>;
