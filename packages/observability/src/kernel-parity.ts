/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-to-
 * kernel devDep precedent of W002/W006/W007/W008/W009/W011/W013/
 * W023/W028/W036/W037/W038/W041/W043).
 *
 * This file pins structural compatibility between the observability
 * shapes and the sibling kernel vocabularies WITHOUT adding runtime
 * dependencies (the W030 runtime-dependency policy:
 * @epoch/agent-protocol and zod only):
 *
 * - `SecurityEventContent` is TYPE-EQUAL to @epoch/event-log's
 *   `EventContent` (security lifecycle events are append-only typed
 *   events over the W010 event shapes — the `security:*` payload
 *   namespace);
 * - The tenant id grammar MIRRORS @epoch/tenancy's TENANT_ID_PATTERN
 *   (member-equal regex sources);
 * - The principal id grammar MIRRORS @epoch/identity's
 *   PRINCIPAL_ID_PATTERN;
 * - The sandbox grant-ceiling table MIRRORS @epoch/extension-runtime's
 *   TRUST_CLASS_GRANT_CEILINGS (member-for-member, order included);
 * - The extension trust-class/flavor/data-handling vocabularies
 *   MIRROR W008's closed sets;
 * - The W041 `ProjectionSummary` is FIELD-COMPATIBLE with the REAL
 *   `SealedAuthorizedProjection` (identity + linkage fields);
 * - The W009 `AuthorizationDecision` request-digest grammar is the
 *   Sha256Hex grammar observations reference.
 *
 * IMPORTANT: this module is type-only and is deliberately NOT
 * re-exported from the package index — importing it into the public
 * surface would drag the devDependencies into every downstream
 * consumer's compile graph. It is compiled by this package's own
 * `tsc --noEmit` (tsconfig.json includes src/**) and mirrored by
 * runtime parity tests (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { SecurityEventContent } from './events';
import type {
  SandboxDataHandling,
  SandboxFlavor,
} from './version';
import type { ProjectionSummary } from './audit';
import {
  OBSERVABILITY_PRINCIPAL_ID_PATTERN,
  OBSERVABILITY_TENANT_ID_PATTERN,
  SANDBOX_GRANT_CEILINGS,
} from './version';
import type { EventContent, EventActor } from '@epoch/event-log';
import { TENANT_ID_PATTERN } from '@epoch/tenancy';
import { PRINCIPAL_ID_PATTERN } from '@epoch/identity';
import type { AuthorizationDecision } from '@epoch/authorization';
import type {
  ResourceScopeMirror,
  TrustCeilingMirror,
} from '@epoch/extension-runtime';
import type { DATA_HANDLING_CLASSIFICATIONS, EXTENSION_FLAVORS } from '@epoch/extension-runtime';
import type { SealedAuthorizedProjection } from '@epoch/access-projection';

/** Security events are W010 event shapes, structurally (W010 parity). */
export type SecurityEventParity = Expect<Equals<SecurityEventContent, EventContent>>;

/** The W010 event actor grammar is the plain principal alias (W009 parity). */
export type EventActorParity = Expect<Equals<string, EventActor>>;

/** The tenant id grammar mirrors @epoch/tenancy (W009 parity). */
export type TenantPatternParity = Expect<Equals<typeof OBSERVABILITY_TENANT_ID_PATTERN, typeof TENANT_ID_PATTERN>>;

/** The principal id grammar mirrors @epoch/identity (W009 parity). */
export type PrincipalPatternParity = Expect<
  Equals<typeof OBSERVABILITY_PRINCIPAL_ID_PATTERN, typeof PRINCIPAL_ID_PATTERN>
>;

/** The sandbox data-handling vocabulary mirrors W008 (member-for-member). */
export type DataHandlingParity = Expect<Equals<SandboxDataHandling, (typeof DATA_HANDLING_CLASSIFICATIONS)[number]>>;

/** The sandbox flavor vocabulary mirrors W008 (member-for-member). */
export type FlavorParity = Expect<Equals<SandboxFlavor, (typeof EXTENSION_FLAVORS)[number]>>;

/** The mirrored grant-ceiling host-function lists carry the W008 union. */
export type CeilingHostFunctionsParity = Expect<
  Equals<typeof SANDBOX_GRANT_CEILINGS[number]['hostFunctions'], TrustCeilingMirror['hostFunctions']>
>;

/** The mirrored grant-ceiling resource-scope lists carry the W008 shape. */
export type CeilingScopesParity = Expect<
  Equals<typeof SANDBOX_GRANT_CEILINGS[number]['resourceScopes'], TrustCeilingMirror['resourceScopes']>
>;

/** One mirrored resource scope is structurally the W008 mirror shape. */
export type ResourceScopeParity = Expect<
  Equals<typeof SANDBOX_GRANT_CEILINGS[number]['resourceScopes'][number], ResourceScopeMirror>
>;

/** The W041 projection summary identity fields mirror the real projection's. */
export type ProjectionIdentityParity = Expect<
  Equals<ProjectionSummary['objectId'], SealedAuthorizedProjection['objectId']>
>;

/** The W041 projection summary digest field mirrors the real projection's. */
export type ProjectionDigestParity = Expect<
  Equals<ProjectionSummary['objectDigest'], SealedAuthorizedProjection['objectDigest']>
>;

/** The W009 decision request-digest grammar is the Sha256Hex grammar observations reference. */
export type DecisionDigestParity = Expect<
  Equals<ProjectionSummary['decisionDigest'], AuthorizationDecision['requestDigest'] | null>
>;
