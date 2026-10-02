/**
 * @epoch/web — the server-side product runtime (W047, ACR-005).
 *
 * THE COMPOSITION POINT of the web product: this module binds the W046
 * `ApplicationGateway` in-process (docs/product-runtime/README.md: "W047+
 * bind their transports to this class in-process or behind a server") and
 * restores the committed deterministic fixture state into the REAL kernels
 * that own the semantics:
 *
 * - tenancy  <- qa/fixtures/<domain>/tenancy.json   (sealTenancyNode + createNode)
 * - world    <- qa/fixtures/<domain>/world.json     (WorldModel.fromSnapshot)
 * - identity <- qa/fixtures/<domain>/identity.json  (IdentityRegistry)
 * - evidence <- qa/fixtures/<domain>/evidence.json  (EvidenceStore.add)
 * - objects  <- the fixture field-capture bytes     (InMemoryObjectStore.put)
 *
 * BOOT VERIFICATION (fail-closed): after restore, the world digest, the
 * evidence digest and the object digest are compared against the committed
 * registry anchors — a mismatch throws before the server accepts traffic.
 *
 * Authority discipline: kernel imports here exist ONLY to restore fixture
 * state and construct the composed gateway (the documented W046 binding
 * seam). Every client-facing mutation flows through
 * `ApplicationGateway.call` envelopes (app/api/gateway/route.ts); the web
 * app performs NO direct kernel mutations on request paths.
 *
 * One gateway instance PER FIXTURE TENANT (tenant:nordstrand construction /
 * tenant:lightspeed software): sessions, actions, tracking and learning
 * stores are tenant-isolated by construction; cross-tenant requests are
 * routed to the tenant's own gateway where the session is unknown
 * (fail-closed, R12).
 *
 * The clock is the deployment wall clock (the product is the caller that
 * supplies instants to the deterministic kernels; the kernels themselves
 * remain wall-clock-free).
 */
import type { JsonValue, Timestamp } from '@epoch/agent-protocol';
import { TenancyHierarchy, sealTenancyNode } from '@epoch/tenancy';
import { IdentityRegistry, authenticationResultRecordFor, sealPrincipal } from '@epoch/identity';
import { WorldModel } from '@epoch/world-model';
import { EvidenceStore } from '@epoch/evidence';
import { EventLog } from '@epoch/event-log';
import { ActionGateway } from '@epoch/action-gateway';
import { SessionManager, type SessionRecord } from '@epoch/authentication';
import { ApplicationGateway } from '@epoch/application-gateway';
import type { AuthorizationContext } from '@epoch/authorization';
import { getProductionBindings, type ProductionBindings } from './production-binding';
import { compiledConstraintOf } from './product-config';
import {
  fixtureObjectBytes,
  loadFixtureBundles,
  PRODUCT_DOMAINS,
  registryAnchors,
  type FixtureBundle,
  type ProductDomain,
} from './fixture-bundle';

/** The deployment clock (canonical UTC, millisecond precision). */
export function productClock(): Timestamp {
  return new Date().toISOString() as Timestamp;
}

/** One restored tenant environment (the gateway + its fixture bundle). */
export interface TenantEnvironment {
  readonly domain: ProductDomain;
  readonly tenantId: string;
  readonly gateway: ApplicationGateway;
  readonly bundle: FixtureBundle;
  readonly identity: IdentityRegistry;
  /** The authoritative world content digest (boot-verified against the registry). */
  readonly worldDigest: string;
}

function asRecord(value: JsonValue): Record<string, JsonValue> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, JsonValue>;
  }
  throw new Error('expected a JSON object');
}

/** Restore the fixture tenancy hierarchy (parents first, REAL seals). */
function restoreTenancy(bundle: FixtureBundle): TenancyHierarchy {
  const hierarchy = new TenancyHierarchy();
  const order = ['platform', 'tenant', 'workspace', 'project'] as const;
  const records = (asRecord(bundle.files['tenancy.json']!)['records'] as readonly JsonValue[])
    .map((entry) => asRecord(asRecord(entry)['node']!))
    .sort((a, b) => order.indexOf(a['kind'] as never) - order.indexOf(b['kind'] as never));
  for (const node of records) {
    const sealed = sealTenancyNode(node as never);
    if (!sealed.ok) throw new Error(`tenancy seal failed: ${sealed.error.message}`);
    const created = hierarchy.createNode(sealed.value);
    if (!created.ok) throw new Error(`tenancy create failed: ${created.error.message}`);
  }
  return hierarchy;
}

/** Restore the fixture identity registry. */
function restoreIdentity(bundle: FixtureBundle): IdentityRegistry {
  const registry = new IdentityRegistry();
  const identity = asRecord(bundle.files['identity.json']!);
  for (const entry of identity['principals'] as readonly JsonValue[]) {
    const node = asRecord(asRecord(entry)['principal']!);
    const sealed = sealPrincipal(node as never);
    if (!sealed.ok) throw new Error(`principal seal failed: ${sealed.error.message}`);
    const registered = registry.registerPrincipal(sealed.value);
    if (!registered.ok) throw new Error(`principal register failed: ${registered.error.message}`);
  }
  return registry;
}

/** Build one tenant environment from its verified fixture bundle. */
async function buildEnvironment(
  bundle: FixtureBundle,
  anchors: {
    readonly worldDigest: string;
    readonly evidenceDigest: string;
    readonly objectBytesDigest: string;
  },
  bindings: ProductionBindings,
): Promise<TenantEnvironment> {
  // World: restore the exact snapshot (integrity-checked by the kernel).
  const world = WorldModel.fromSnapshot(
    bundle.files['world.json'] as never,
    { clock: () => '2026-03-02T18:00:00.000Z' },
  );
  if (world.digest() !== anchors.worldDigest) {
    throw new Error(
      `world digest mismatch for ${bundle.domain}: registry ${anchors.worldDigest}, restored ${world.digest()}`,
    );
  }

  // Evidence + object bytes (digests recomputed by the authorities).
  const evidence = EvidenceStore.create();
  const evidenceFile = asRecord(bundle.files['evidence.json']!);
  const receipt = evidence.add(evidenceFile['record']);
  if (!receipt.ok) throw new Error(`fixture evidence rejected: ${receipt.issues.map((i) => i.message).join('; ')}`);
  if (receipt.receipt.digest !== anchors.evidenceDigest) {
    throw new Error(
      `evidence digest mismatch for ${bundle.domain}: registry ${anchors.evidenceDigest}, actual ${receipt.receipt.digest}`,
    );
  }
  // The bound object store (W051: S3-compatible/R2 when configured,
  // in-memory reference otherwise). The fixture restore flows through
  // the SAME store as production uploads — one digest-addressed truth.
  const objects = bindings.objectStore;
  const bytes = fixtureObjectBytes(bundle.domain);
  const stored = await objects.put(bytes, {
    schemaVersion: 1,
    kind: 'evidence-artifact',
    tenantId: bundle.tenantId,
    label: `${bundle.domain} fixture field capture`,
    storedAt: '2026-03-02T13:00:00.000Z',
  });
  if (!stored.ok) throw new Error(`fixture object store failed: ${stored.error.message}`);
  if (stored.value.digest !== anchors.objectBytesDigest) {
    throw new Error(
      `object bytes digest mismatch for ${bundle.domain}: registry ${anchors.objectBytesDigest}, actual ${stored.value.digest}`,
    );
  }

  // The fixture deployment's W009 authorization facts (deployment-provided;
  // the @epoch/authorization decision point decides, fail-closed).
  const principals = bundle.principals.map((principal) => ({
    principalId: principal.principalId,
    status: 'active' as const,
    authenticated: true,
  }));
  const authorizationFacts = {
    contextFor(request: {
      readonly principalId: string;
      readonly tenantId: string;
    }): AuthorizationContext {
      return {
        schemaVersion: 1,
        principals,
        memberships: principals.map((principal) => ({
          principalId: principal.principalId,
          tenantId: request.tenantId,
        })),
        knownTenants: [bundle.tenantId],
      };
    },
  };

  const identity = restoreIdentity(bundle);
  const gateway = new ApplicationGateway({
    clock: productClock,
    authorities: {
      // W055 (F-1 closure): the tenant-scoped session authority — a
      // session may only be issued from an authentication result minted
      // by THIS tenant environment's identity boundary (the committed
      // fixture result for the domain lead, or this environment's
      // `fixture-auth-<domain>-…` derivation). A verified result from
      // another tenant's boundary no longer issues a session here (the
      // W052 P18 finding: the frozen SessionManager validates
      // principal↔result and tenant↔manager scope, but not
      // result↔tenant-identity-registry; the mutation path already failed
      // closed through the W009 gate — this closes the read path too).
      sessions: tenantScopedSessionManager(new SessionManager({ expectedTenantId: bundle.tenantId }), bundle),
      tenancy: restoreTenancy(bundle),
      worlds: world,
      evidence,
      objects,
      eventLog: new EventLog(),
      actionGateway: new ActionGateway(),
      // The deployment's constraint binding: the compiled fixture
      // constraint resolves for its id; anything else resolves to nothing
      // (fail-closed — unresolvable bindings block, they never pass).
      actionConstraintResolver: (binding: { readonly constraintId: string }) =>
        binding.constraintId === (bundle.domain === 'construction' ? 'max-building-height' : 'p95-latency-budget')
          ? compiledConstraintOf(bundle.domain)
          : undefined,
      authorizationFacts,
    },
    persistence: bindings.persistence,
    guards: bindings.guards,
  });
  const prepared = await gateway.prepare();
  if (!prepared.ok) throw new Error(`gateway migrations failed: ${prepared.error.message}`);

  return {
    domain: bundle.domain,
    tenantId: bundle.tenantId,
    gateway,
    bundle,
    identity,
    worldDigest: world.digest(),
  };
}

/**
 * The product runtime: the per-tenant gateway environments, built once per
 * process from the verified fixture bundles. Cached on globalThis so dev
 * server module reloads do not fork authoritative state.
 */
export interface ProductRuntime {
  readonly environments: ReadonlyMap<string, TenantEnvironment>;
  readonly domains: readonly ProductDomain[];
  gatewayForTenant(tenantId: string): TenantEnvironment | undefined;
  environmentForDomain(domain: ProductDomain): TenantEnvironment | undefined;
  tenantOfDomain(domain: ProductDomain): string;
}

async function buildRuntime(): Promise<ProductRuntime> {
  // The production bindings (W051, ACR-006): fail-closed on production
  // critical issues BEFORE any tenant environment is built; degraded
  // states (in-memory fallbacks) surface through readiness.
  const bindings = await getProductionBindings();
  const bundles = loadFixtureBundles();
  const anchors = registryAnchors(bundles);
  const environments = new Map<string, TenantEnvironment>();
  for (const domain of PRODUCT_DOMAINS) {
    const bundle = bundles.get(domain);
    const anchor = anchors.get(domain);
    if (bundle === undefined || anchor === undefined) throw new Error(`missing fixture bundle for ${domain}`);
    const environment = await buildEnvironment(bundle, anchor, bindings);
    environments.set(environment.tenantId, environment);
  }
  return {
    environments,
    domains: PRODUCT_DOMAINS,
    gatewayForTenant(tenantId: string): TenantEnvironment | undefined {
      return environments.get(tenantId);
    },
    environmentForDomain(domain: ProductDomain): TenantEnvironment | undefined {
      return [...environments.values()].find((environment) => environment.domain === domain);
    },
    tenantOfDomain(domain: ProductDomain): string {
      const environment = [...environments.values()].find((entry) => entry.domain === domain);
      if (environment === undefined) throw new Error(`unknown product domain: ${domain}`);
      return environment.tenantId;
    },
  };
}

const GLOBAL_KEY = '__epoch_web_product_runtime__' as const;

declare global {
  var __epoch_web_product_runtime__: ProductRuntime | undefined;
}

/**
 * The tenant-scoped session authority (W055, F-1): wraps the W046
 * SessionManager seam so `session.issue` additionally REJECTS any
 * authentication result this environment did not mint. The frozen
 * SessionManager/api contracts are untouched — this is a deployment
 * composition decision (which results this deployment's identity
 * boundary produced), exactly the seam the authority bundle provides.
 */
class TenantScopedSessionManager extends SessionManager {
  private readonly ownResultIds: ReadonlySet<string>;

  constructor(
    inner: SessionManager,
    own: {
      readonly committedResultId: string;
      readonly fixtureAuthPrefix: string;
      readonly registeredPrincipalIds: ReadonlySet<string>;
    },
  ) {
    // The inner manager's options (the tenant scope) carry over because
    // this wrapper delegates every call; only issueSession gains the
    // result-provenance gate.
    super();
    this.inner = inner;
    this.ownResultIds = new Set([own.committedResultId]);
    this.fixtureAuthPrefix = own.fixtureAuthPrefix;
    this.registeredPrincipalIds = own.registeredPrincipalIds;
  }

  private readonly inner: SessionManager;
  private readonly fixtureAuthPrefix: string;
  private readonly registeredPrincipalIds: ReadonlySet<string>;

  override issueSession(input: Parameters<SessionManager['issueSession']>[0]): ReturnType<SessionManager['issueSession']> {
    const resultId = input.authentication.resultId;
    const isOwn =
      this.ownResultIds.has(resultId) ||
      (typeof resultId === 'string' && resultId.startsWith(this.fixtureAuthPrefix));
    if (!isOwn) {
      return {
        ok: false,
        error: {
          code: 'authentication-tenant-mismatch',
          message: `the authentication result "${resultId}" was not issued by this tenant's identity boundary (R12 tenant isolation)`,
        },
      };
    }
    // Registered-principal guard: the authenticated principal must be
    // registered in THIS environment's identity registry.
    if (!this.registeredPrincipalIds.has(input.principalId)) {
      return {
        ok: false,
        error: {
          code: 'authentication-tenant-mismatch',
          message: `the principal "${input.principalId}" is not registered in this tenant's identity registry (R12 tenant isolation)`,
        },
      };
    }
    return this.inner.issueSession(input);
  }

  // Every other gateway-used method delegates to the inner manager (its
  // sessions map is the live state; this wrapper adds ONLY the issuance
  // provenance gate).
  override validateSession(sessionId: string, at: Timestamp): ReturnType<SessionManager['validateSession']> {
    return this.inner.validateSession(sessionId, at);
  }

  override isUsable(record: SessionRecord, at: Timestamp): boolean {
    return this.inner.isUsable(record, at);
  }

  override revokeSession(sessionId: string, at: Timestamp): ReturnType<SessionManager['revokeSession']> {
    return this.inner.revokeSession(sessionId, at);
  }
}

/** Build the tenant-scoped session authority for one fixture bundle. */
function tenantScopedSessionManager(
  inner: SessionManager,
  bundle: FixtureBundle,
): SessionManager {
  const identity = asRecord(bundle.files['identity.json']!);
  const registered = new Set<string>(
    (identity['principals'] as readonly JsonValue[]).map(
      (entry) => asRecord(asRecord(entry)['principal']!)['principalId'] as string,
    ),
  );
  return new TenantScopedSessionManager(inner, {
    committedResultId: bundle.committedAuthentication.resultId,
    fixtureAuthPrefix: `fixture-auth-${bundle.domain}-`,
    registeredPrincipalIds: registered,
  });
}

/** The process-wide product runtime singleton (async, cached). */
export async function getProductRuntime(): Promise<ProductRuntime> {
  if (globalThis[GLOBAL_KEY] !== undefined) {
    return globalThis[GLOBAL_KEY]!;
  }
  const runtime = await buildRuntime();
  globalThis[GLOBAL_KEY] = runtime;
  return runtime;
}

/**
 * Sign in one registered fixture principal: the identity authority's
 * verified authentication result for the principal (the fixture-committed
 * result for the domain lead; a kernel-sealed runtime result for the other
 * registered principals). This is the identity-provider boundary of the
 * fixture deployment — it mints nothing the identity kernel has not
 * already admitted.
 */
export function authenticatePrincipal(
  environment: TenantEnvironment,
  principalId: string,
): { readonly resultId: string; readonly resultDigest: string; readonly principalId: string; readonly outcome: 'verified' | 'failed' } {
  const registered = environment.identity
    .listPrincipals({})
    .find((entry) => entry.principal.principalId === principalId);
  if (registered === undefined) {
    throw new Error(`principal "${principalId}" is not registered in the ${environment.domain} fixture identity registry`);
  }
  const committed = environment.bundle.committedAuthentication;
  if (committed.principalId === principalId) {
    return {
      resultId: committed.resultId,
      resultDigest: committed.resultDigest,
      principalId,
      outcome: 'verified',
    };
  }
  // Kernel-sealed runtime result for the other registered principals.
  const record = authenticationResultRecordFor({
    schemaVersion: 1,
    resultId: `fixture-auth-${environment.domain}-${principalId.replace(/[^a-z0-9-]+/g, '-')}`,
    assertionId: `fixture-auth-assertion-${principalId.replace(/[^a-z0-9-]+/g, '-')}`,
    principalId,
    outcome: 'verified',
    decidedAt: '2026-03-02T10:00:00.000Z',
  } as never);
  return {
    resultId: record.result.resultId,
    resultDigest: record.resultDigest,
    principalId,
    outcome: 'verified',
  };
}
