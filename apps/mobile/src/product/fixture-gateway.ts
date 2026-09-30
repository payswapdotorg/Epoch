/**
 * @epoch/mobile — the fixture-seeded gateway bootstrap (W049).
 *
 * The mobile product embeds the REAL W046 Application Gateway (the typed
 * library surface) seeded from the deterministic product fixtures committed
 * by W046 under qa/fixtures/ (the construction domain — the field
 * scenario). This module:
 *
 *  - types the fixture record set the host consumes (`FieldFixtureRecords`);
 *  - rebuilds the REAL authorities from the committed records: the W009
 *    tenancy hierarchy (node-by-node through `sealTenancyNode` +
 *    `createNode`, parents first — the W046 composition-test discipline),
 *    the W002 world (`WorldModel.fromSnapshot` — the kernel verifies the
 *    snapshot digest), the W006 evidence store, the W046 object store, the
 *    W010 event log, the W022 Action Gateway, the W046 session seam with
 *    the tenant pin, and the W009 authorization facts over the fixture
 *    principals (the REAL `@epoch/authorization` decision point);
 *  - binds everything into an `ApplicationGateway` whose `call` IS the
 *    mobile transport (`bindInProcessGateway`).
 *
 * NOTHING here invents semantic state: every record comes from the frozen
 * fixtures, every authority is the real kernel, and the fixture bytes are
 * digest-pinned by test/product/fixtures.test.ts against
 * qa/fixtures/registry.json (drift = test failure).
 *
 * The native bundle carries the same records under native/fixtures/ (the
 * Metro-reachable copies, digest-pinned to the registry by the same test).
 */
import { ActionGateway } from '@epoch/action-gateway';
import { SessionManager } from '@epoch/authentication';
import { EvidenceStore } from '@epoch/evidence';
import { EventLog } from '@epoch/event-log';
import { InMemoryObjectStore } from '@epoch/object-storage';
import { TenancyHierarchy, sealTenancyNode } from '@epoch/tenancy';
import { WorldModel } from '@epoch/world-model';
import { ApplicationGateway, type AuthorizationFacts, type GatewayAuthorities, type GatewayClock } from '@epoch/application-gateway';
import type { JsonValue } from '@epoch/agent-protocol';
import { canonicalDigest } from '@epoch/agent-protocol';
import { bindInProcessGateway, type MobileGatewayTransport } from './gateway-client';
import { buildFieldDeviceDescriptor } from '../device';
import type { DeviceDescriptor } from '@epoch/experience-protocol';
import { FIELD_REVIEW_COMPILED_CONSTRAINT, FIELD_REVIEW_CONSTRAINT_ID } from './approval-pipeline';

/** One fixture domain record set (the committed W046 fixture files, parsed). */
export interface FieldFixtureRecords {
  readonly fixtureId: string;
  readonly domain: 'construction' | 'software';
  readonly tenantId: string;
  readonly tenancy: Record<string, unknown>;
  readonly identity: Record<string, unknown>;
  readonly world: Record<string, unknown>;
  readonly solution: Record<string, unknown>;
  readonly program: Record<string, unknown>;
  readonly delivery: Record<string, unknown>;
  readonly evidence: Record<string, unknown>;
}

/** The seeded gateway + the records it was built from. */
export interface SeededGateway {
  readonly gateway: ApplicationGateway;
  readonly transport: MobileGatewayTransport;
  readonly records: FieldFixtureRecords;
}

/** The tenancy node kind ordering (parents first: platform -> tenant -> workspace -> project). */
const TENANCY_KIND_ORDER = ['platform', 'tenant', 'workspace', 'project'] as const;

/** Rebuild the W009 tenancy hierarchy from the fixture snapshot (parents first). */
export function restoreTenancyHierarchy(tenancy: Record<string, unknown>): TenancyHierarchy {
  const hierarchy = new TenancyHierarchy();
  const records = (tenancy['records'] as Array<Record<string, unknown>> | undefined) ?? [];
  const sorted = [...records].sort((a, b) => {
    const kindOf = (record: Record<string, unknown>) =>
      TENANCY_KIND_ORDER.indexOf((record['node'] as Record<string, unknown> | undefined)?.['kind'] as never);
    return kindOf(a) - kindOf(b);
  });
  for (const record of sorted) {
    const sealed = sealTenancyNode(record['node'] as Record<string, unknown>);
    if (!sealed.ok) {
      throw new TypeError(`fixture tenancy node rejected by the kernel: ${sealed.error.message}`);
    }
    const created = hierarchy.createNode(sealed.value);
    if (!created.ok) {
      throw new TypeError(`fixture tenancy node not admitted by the hierarchy: ${created.error.message}`);
    }
  }
  return hierarchy;
}

/**
 * The W009 authorization facts over the fixture principals (the REAL
 * decision-point context: active authenticated principals, their tenant
 * memberships, the known tenant). Deployment-provided in production; the
 * fixtures are the deterministic source here.
 */
export function fixtureAuthorizationFacts(records: FieldFixtureRecords): AuthorizationFacts {
  const principals = ((records.identity['principals'] as Array<Record<string, unknown>>) ?? []).map(
    (entry) => {
      const principal = entry['principal'] as Record<string, unknown>;
      return {
        principalId: principal['principalId'] as string,
      };
    },
  );
  return {
    contextFor: () => ({
      schemaVersion: 1,
      principals: principals.map((principal) => ({
        principalId: principal.principalId,
        status: 'active',
        authenticated: true,
      })),
      memberships: principals.map((principal) => ({
        principalId: principal.principalId,
        tenantId: records.tenantId,
      })),
      knownTenants: [records.tenantId],
    }),
  };
}

/** The fixture field principals (sign-in choices on the onboarding surface). */
export interface FixturePrincipal {
  readonly principalId: string;
  readonly displayName: string;
  readonly kind: string;
}

/** The verified authentication result of one fixture principal (the session-issuance input). */
export function fixtureAuthenticationResult(
  records: FieldFixtureRecords,
  principalId: string,
): { readonly authentication: Record<string, unknown>; readonly resultDigest: string } | undefined {
  const results = (records.identity['authenticationResults'] as Array<Record<string, unknown>>) ?? [];
  for (const entry of results) {
    const result = entry['result'] as Record<string, unknown> | undefined;
    if (result?.['principalId'] === principalId && result?.['outcome'] === 'verified') {
      const resultDigest = (entry['resultDigest'] as string) ?? '';
      // The session-issuance input: the result record + its digest (the
      // content-addressed authentication outcome, exactly as committed).
      return {
        authentication: { ...result, resultDigest },
        resultDigest,
      };
    }
  }
  return undefined;
}

/** Options of {@link buildFixtureGateway}. */
export interface BuildFixtureGatewayOptions {
  readonly records: FieldFixtureRecords;
  readonly clock: GatewayClock;
  /** The field device descriptor digest carried on capture contexts (provenance). */
  readonly deviceDescriptorDigest?: string | undefined;
}

/**
 * Build the REAL Application Gateway seeded from the fixture records and
 * bind it as the mobile transport. Every authority is the real kernel; the
 * world snapshot digest is verified by the kernel itself.
 */
export function buildFixtureGateway(options: BuildFixtureGatewayOptions): SeededGateway {
  const { records, clock } = options;
  const authorities: GatewayAuthorities = {
    sessions: new SessionManager({ expectedTenantId: records.tenantId }),
    tenancy: restoreTenancyHierarchy(records.tenancy),
    worlds: WorldModel.fromSnapshot(records.world as never, { clock }),
    evidence: EvidenceStore.create(),
    objects: new InMemoryObjectStore(),
    eventLog: new EventLog(),
    actionGateway: new ActionGateway(),
    // The W004 constraint resolver: the fixture deployment resolves the
    // deterministic field-review constraint (the real resolver would fetch
    // the tenant's compiled constraint store — deployment-provided, the
    // W046 gateway-actions composition pattern).
    actionConstraintResolver: (binding: { readonly constraintId: string }) =>
      binding.constraintId === FIELD_REVIEW_CONSTRAINT_ID ? FIELD_REVIEW_COMPILED_CONSTRAINT : undefined,
    authorizationFacts: fixtureAuthorizationFacts(records),
  };
  const gateway = new ApplicationGateway({ clock, authorities });
  return { gateway, transport: bindInProcessGateway(gateway), records };
}

/** The fixture world digest (the J08 cross-device comparison anchor). */
export function fixtureWorldDigest(records: FieldFixtureRecords): string {
  return (records.world['digest'] as string) ?? '';
}

/** The fixture delivery record id (the field delivery the app opens). */
export function fixtureDeliveryId(records: FieldFixtureRecords): string {
  return (records.delivery['deliveryId'] as string) ?? '';
}

/** The fixture solution id. */
export function fixtureSolutionId(records: FieldFixtureRecords): string {
  return (records.solution['solutionId'] as string) ?? '';
}

/** The fixture program (the work-package index source, passed on delivery.observe). */
export function fixtureProgram(records: FieldFixtureRecords): JsonValue {
  return records.program as unknown as JsonValue;
}

/** The device-descriptor digest for capture provenance (the W011 descriptor, canonical-digested). */
export function deviceDescriptorDigestOf(device: DeviceDescriptor): string {
  return canonicalDigest(device as unknown as JsonValue);
}

/**
 * The default field device descriptor of the mobile product (phone class,
 * the field-fidelity interaction set) — deterministic, identical on every
 * build, so capture contexts carry a stable provenance digest.
 */
export function defaultFieldDeviceDescriptor(): DeviceDescriptor {
  const built = buildFieldDeviceDescriptor();
  if (!built.ok) {
    throw new TypeError(`the default field device descriptor failed admission: ${built.error.message}`);
  }
  return built.value;
}

export type { GatewayClock };
