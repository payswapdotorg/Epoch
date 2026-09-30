/**
 * @epoch/desktop — the embedded Application Gateway binding (W048).
 *
 * The W046 single-process composition bound inside the desktop product:
 * a REAL `ApplicationGateway` (services/application-gateway) over REAL
 * authorities — the tenancy hierarchy and the world restored VERBATIM
 * from the deterministic product fixtures (the same fixtures the web
 * product uses), the session seam, the evidence/object stores, the event
 * log, and the W022 Action Gateway (THE execution authority — every
 * action path routes through it in this mode too). The desktop never
 * mutates semantic state around this gateway; its OWN durable records
 * (sessions/idempotency/correlation) flow through the desktop
 * persistence seam so they survive relaunch (J12).
 *
 * This is NOT a second semantic store: it IS the sanctioned single-process
 * Application Gateway deployment (docs/product-runtime/limitations.md §5),
 * with authority state projected from the fixture snapshots.
 */
import { ActionGateway } from '@epoch/action-gateway';
import { SessionManager } from '@epoch/authentication';
import { EvidenceStore } from '@epoch/evidence';
import { EventLog } from '@epoch/event-log';
import { InMemoryObjectStore } from '@epoch/object-storage';
import { TenancyHierarchy, sealTenancyNode } from '@epoch/tenancy';
import { WorldModel } from '@epoch/world-model';
import { ApplicationGateway } from '@epoch/application-gateway';
import type { AuthorizationContext } from '@epoch/authorization';
import type { PersistenceSession } from '@epoch/persistence';
import type { Clock } from '@epoch/world-model';
import type { JsonValue } from '@epoch/agent-protocol';
import type { FixtureBundle } from './fixture-source';

/** The fixture-backed gateway construction options. */
export interface EmbeddedGatewayOptions {
  readonly bundle: FixtureBundle;
  /** The deterministic clock (frozen instants in journeys/tests). */
  readonly clock: Clock;
  /** The desktop persistence session (durable gateway records; default in-memory). */
  readonly persistence?: PersistenceSession | undefined;
  /**
   * The W004 constraint resolver for action submissions (deployment-provided
   * reference data — the compiled constraints earlier product stages
   * produced). Default: unresolved (every bound constraint denies).
   */
  readonly actionConstraintResolver?: ((binding: { readonly constraintId: string; readonly constraintVersion?: string | undefined }) => unknown) | undefined;
}

/** The embedded gateway construction result. */
export interface EmbeddedGatewayBinding {
  readonly gateway: ApplicationGateway;
  /** The fixture's authentication result (the session-issuance input). */
  readonly authentication: {
    readonly resultId: string;
    readonly resultDigest: string;
    readonly principalId: string;
    readonly outcome: 'verified' | 'failed';
  };
  readonly tenantId: string;
  readonly principalId: string;
  readonly projectId: string;
}

/** The tenancy kind order (parents first — platform -> tenant -> workspace -> project). */
const TENANCY_KIND_ORDER = ['platform', 'tenant', 'workspace', 'project'] as const;

/** Build the embedded fixture-backed Application Gateway. */
export function buildEmbeddedGateway(options: EmbeddedGatewayOptions): EmbeddedGatewayBinding {
  const bundle = options.bundle;
  const tenancyJson = bundle.files['tenancy.json'] as { records?: unknown } | undefined;
  if (tenancyJson === undefined || !Array.isArray(tenancyJson.records)) {
    throw new Error('the fixture bundle carries no tenancy records');
  }

  // The tenancy hierarchy: the REAL authority, restored from the fixture snapshot.
  const hierarchy = new TenancyHierarchy();
  const records = [...(tenancyJson.records as Record<string, unknown>[])].sort((a, b) => {
    const kindOf = (record: Record<string, unknown>) =>
      TENANCY_KIND_ORDER.indexOf((record['node'] as Record<string, unknown>)['kind'] as never);
    return kindOf(a) - kindOf(b);
  });
  for (const record of records) {
    const sealed = sealTenancyNode(record['node'] as Record<string, unknown>);
    if (!sealed.ok) throw new Error(`fixture tenancy node rejected: ${sealed.error.message}`);
    const created = hierarchy.createNode(sealed.value);
    if (!created.ok) throw new Error(`fixture tenancy node rejected: ${created.error.message}`);
  }

  // The world: the REAL semantic truth, restored verbatim (digest-protected).
  const worldSnapshot = bundle.files['world.json'] as JsonValue;
  if (worldSnapshot === undefined) {
    throw new Error('the fixture bundle carries no world snapshot');
  }
  const world = WorldModel.fromSnapshot(worldSnapshot as never, { clock: options.clock });
  if (world.digest() !== bundle.worldDigest) {
    throw new Error(
      `the restored world digest ${world.digest()} does not match the registry digest ${bundle.worldDigest}`,
    );
  }

  // The identity fixture: the VERIFIED authentication result (session-issuance input).
  const identityJson = bundle.files['identity.json'] as
    | {
        tenantId?: string;
        authenticationResults?: {
          result?: { resultId?: string; principalId?: string; outcome?: string };
          resultDigest?: string;
        }[];
      }
    | undefined;
  if (identityJson === undefined || !Array.isArray(identityJson.authenticationResults)) {
    throw new Error('the fixture bundle carries no authentication results');
  }
  const authenticationRecord = identityJson.authenticationResults[0];
  if (
    authenticationRecord === undefined ||
    authenticationRecord.result === undefined ||
    typeof authenticationRecord.result.resultId !== 'string' ||
    typeof authenticationRecord.result.principalId !== 'string' ||
    authenticationRecord.result.outcome !== 'verified' ||
    typeof authenticationRecord.resultDigest !== 'string'
  ) {
    throw new Error('the fixture authentication result is malformed');
  }

  const tenantId = identityJson.tenantId ?? '';
  const principalId = authenticationRecord.result.principalId;

  // Find the fixture project node (the J01 entry point).
  const projectNode = (tenancyJson.records as Record<string, unknown>[]).find(
    (record) => (record['node'] as Record<string, unknown>)['kind'] === 'project',
  );
  const projectId =
    projectNode !== undefined
      ? String((projectNode['node'] as Record<string, unknown>)['nodeId'] ?? '')
      : '';

  const gateway = new ApplicationGateway({
    clock: () => options.clock() as string,
    authorities: {
      sessions: new SessionManager(),
      tenancy: hierarchy,
      worlds: world,
      evidence: EvidenceStore.create(),
      objects: new InMemoryObjectStore(),
      eventLog: new EventLog(),
      actionGateway: new ActionGateway(),
      actionConstraintResolver:
        options.actionConstraintResolver !== undefined
          ? (options.actionConstraintResolver as never)
          : () => undefined,
      authorizationFacts: {
        contextFor(request: {
          readonly principalId: string;
          readonly tenantId: string;
        }): AuthorizationContext {
          return {
            schemaVersion: 1,
            principals: [{ principalId: request.principalId, status: 'active', authenticated: true }],
            memberships: [{ principalId: request.principalId, tenantId: request.tenantId }],
            knownTenants: [tenantId],
          } as unknown as AuthorizationContext;
        },
      },
    },
    ...(options.persistence !== undefined ? { persistence: options.persistence } : {}),
  });

  return {
    gateway,
    authentication: {
      resultId: authenticationRecord.result.resultId,
      resultDigest: authenticationRecord.resultDigest,
      principalId,
      outcome: 'verified',
    },
    tenantId,
    principalId,
    projectId,
  };
}
