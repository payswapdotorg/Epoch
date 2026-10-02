/**
 * @epoch/application-gateway — the gateway facade (W046, ACR-005).
 *
 * THE COMPOSITION POINT: Client -> Application Gateway -> existing
 * authoritative Epoch services/contracts -> authoritative state ->
 * projection. It ORCHESTRATES and decides NOTHING semantic: every
 * operation delegates to the authority named in the authority map
 * (src/authority-map.ts; the walk test fails on any unmapped operation).
 *
 * The call pipeline (every call, in order):
 *  1. envelope validation (the frozen @epoch/client-runtime contract);
 *  2. session gate (the @epoch/authentication seam) — except
 *     `session.issue` (bootstrap);
 *  3. tenant gate (the request scope MUST equal the session scope);
 *  4. idempotency-key rule (every mutating operation);
 *  5. the W009 authorization gate on every mutating operation (the REAL
 *     @epoch/authorization decision point, fail-closed; UI/native code
 *     never grants authorization);
 *  6. dispatch: mutating operations run inside the typed IdempotentReplay
 *     (durable records through the persistence SPI — PostgreSQL when
 *     bound); reads delegate directly;
 *  7. the correlation ledger records the gateway -> authority call;
 *  8. every kernel failure is mapped to the typed error taxonomy as
 *     `authority-rejected` carrying the authority's own typed error
 *     verbatim (never a gateway-invented semantic error).
 *
 * Deterministic: the clock is caller-supplied (zero wall-clock, zero
 * randomness). In-memory reference authorities by default; every
 * authority is injectable (snapshot-restored, durable-bound).
 */
import {
  canonicalDigest,
  type JsonValue,
  type Timestamp,
} from '@epoch/agent-protocol';
import { TenancyHierarchy } from '@epoch/tenancy';
import { EvidenceStore } from '@epoch/evidence';
import { EventLog } from '@epoch/event-log';
import { WorldModel } from '@epoch/world-model';
import { ActionGateway, type SubmitActionOptions } from '@epoch/action-gateway';
import { runProblemDrivenDiscovery } from '@epoch/capability-discovery';
import { evaluateConstraint } from '@epoch/constraint-language';
import { validateChain } from '@epoch/verification';
import {
  buildProgramOfWork,
  foldCostSchedule,
  foldMilestoneSchedule,
  foldQuantitySchedule,
  foldResourceSchedule,
  approveSolutionBaseline,
  closeDeliveryRecord,
  openDeliveryRecord,
  sealSolutionVersion,
} from '@epoch/solution-delivery';
import {
  admitPurchaseOrder,
  admitQuote,
  sealPurchaseOrder,
  sealQuote,
} from '@epoch/procurement';
import {
  buildProgramIndex,
  intakeFieldObservation,
  openExecutionTrackingStore,
  type ExecutionTrackingStore,
  type ProgramIndex,
} from '@epoch/execution-tracking';
import { rollForecast } from '@epoch/actualization';
import { openLearningStore, registerOutcomeRecord, type LearningStore } from '@epoch/learning-calibration';
import { evaluateProjection, selectVisiblePaths } from '@epoch/access-projection';
import { evaluateSupervisionPass } from '@epoch/supervision';
import { raiseAlert } from '@epoch/alerts';
import { checkEntitlement } from '@epoch/marketplace';
import type { ConstraintResolver } from '@epoch/policy-contracts';
import {
  evaluate,
  type AuthorizationContext,
  type AuthorizationDecision,
  type AuthorizationRequest,
  type AuthorizationResult,
} from '@epoch/authorization';
import { SessionManager, type SessionRecord } from '@epoch/authentication';
import { type ObjectMetadata, type ObjectStore } from '@epoch/object-storage';
import { InMemoryPersistence, type PersistenceSession } from '@epoch/persistence';
import {
  applyIdempotent,
  computeRequestFingerprint,
  gatewayError,
  isMutatingOperation,
  ok as okResult,
  fail as failResult,
  parseGatewayRequestEnvelope,
  requireIdempotencyKey,
  type GatewayCallResult,
  type GatewayError,
  type GatewayOperationName,
  type GatewayOutcome,
  type GatewayRequestEnvelope,
  type GatewayResult,
  type IdempotencyStore,
} from '@epoch/client-runtime';
import {
  CorrelationLedger,
  PersistedIdempotencyStore,
  SessionMirror,
  migrateGatewayTables,
} from './persistence-binding';
import {
  guardFailureDecision,
  type GuardRequestContext,
  type RateLimitDecision,
  type RequestGuard,
} from './rate-limit';
import { AUTHORITY_BY_OPERATION } from './authority-map';

/** The caller-supplied deterministic clock (zero wall-clock in src). */
export type GatewayClock = () => Timestamp;

/** The composed authority bundle (every entry an EXISTING Epoch authority). */
export interface GatewayAuthorities {
  /** The W046 session seam (over @epoch/identity + @epoch/tenancy). */
  readonly sessions: SessionManager;
  /** The W009 tenancy hierarchy. */
  readonly tenancy: TenancyHierarchy;
  /** The W002 world model (semantic truth). */
  readonly worlds: WorldModel;
  /** The W006 evidence store. */
  readonly evidence: EvidenceStore;
  /** The W046 object store (bytes by digest). */
  readonly objects: ObjectStore;
  /** The W010 event log (READ only through the gateway). */
  readonly eventLog: EventLog;
  /** The W022 Action Gateway (EXECUTION AUTHORITY). */
  readonly actionGateway: ActionGateway;
  /**
   * The W004 constraint resolver for action submissions (a FUNCTION —
   * deployment-provided; never wire-serializable).
   */
  readonly actionConstraintResolver: ConstraintResolver;
  /** The W009 decision-context facts (memberships/known tenants) — deployment-provided. */
  readonly authorizationFacts: AuthorizationFacts;
}

/**
 * The caller-supplied W009 facts for the authorization gate: given the
 * session principal + tenant, the facts provider returns the decision
 * context the @epoch/authorization evaluator consumes. Fail-closed: a
 * provider returning no facts yields DENY.
 */
export interface AuthorizationFacts {
  contextFor(request: {
    readonly principalId: string;
    readonly tenantId: string;
    readonly operation: GatewayOperationName;
  }): AuthorizationContext;
}

/** The per-tenant kernel store caches (execution tracking + learning). */
interface KernelStoreCache {
  readonly tracking: Map<string, ExecutionTrackingStore>;
  readonly learning: Map<string, LearningStore>;
}

export interface ApplicationGatewayOptions {
  readonly clock: GatewayClock;
  readonly authorities: GatewayAuthorities;
  /** The persistence session for the gateway's durable records (default: in-memory). */
  readonly persistence?: PersistenceSession | undefined;
  /** The idempotency store (default: the persisted store over `persistence`). */
  readonly idempotency?: IdempotencyStore | undefined;
  /**
   * Request guards applied at the boundary (W051, ACR-006): after
   * envelope validation, BEFORE the session gate. Guards are abuse
   * control — they never bypass or weaken the session/tenant/
   * authorization gates. Denials map to `transient`/`gateway-overloaded`.
   */
  readonly guards?: readonly RequestGuard[] | undefined;
}

/** The dispatch context handed to every operation handler. */
export interface OperationContext {
  readonly session: SessionRecord | null;
  readonly correlation: { readonly correlationId: string; readonly origin: string };
  readonly tenantId: string;
  readonly at: Timestamp;
  readonly payload: JsonValue;
}

/** One operation handler: thin delegation to the mapped authority. */
type OperationHandler = (context: OperationContext) => Promise<GatewayResult<JsonValue>>;

/**
 * The Application Gateway facade. Implements the client-runtime
 * `ApplicationGatewayPort` contract structurally (`call`), so W047+ bind
 * their transports to this class in-process or behind a server.
 */
export class ApplicationGateway {
  private readonly clock: GatewayClock;
  private readonly authorities: GatewayAuthorities;
  private readonly persistence: PersistenceSession;
  private readonly idempotency: IdempotencyStore;
  private readonly correlationLedger: CorrelationLedger;
  private readonly sessionMirror: SessionMirror;
  private readonly guards: readonly RequestGuard[];
  private readonly storeCache: KernelStoreCache = { tracking: new Map(), learning: new Map() };
  private migrated = false;

  constructor(options: ApplicationGatewayOptions) {
    this.clock = options.clock;
    this.authorities = options.authorities;
    this.persistence = options.persistence ?? new InMemoryPersistence();
    this.idempotency = options.idempotency ?? new PersistedIdempotencyStore(this.persistence);
    this.correlationLedger = new CorrelationLedger(this.persistence);
    this.sessionMirror = new SessionMirror(this.persistence);
    this.guards = options.guards ?? [];
  }

  /** The typed client->gateway call seam (the ApplicationGatewayPort contract). */
  async call(request: GatewayRequestEnvelope): Promise<GatewayCallResult> {
    const correlationId = request.correlation.correlationId;
    const at = this.clock();

    // 1. Envelope validation.
    const parsed = parseGatewayRequestEnvelope(request);
    if (!parsed.ok) {
      return { ok: false, error: withCorrelation(parsed.error, correlationId) };
    }

    // 1.5 Request guards (W051, ACR-006): abuse control after envelope
    // validation, before the session gate. Guards never weaken the
    // security gates below; a denial is typed `transient`/
    // `gateway-overloaded` (retryable with backoff). A thrown guard
    // error resolves per the guard's declared failure policy.
    if (this.guards.length > 0) {
      const nowEpochMs = Date.parse(at);
      const guardContext: GuardRequestContext = {
        operation: request.operation,
        tenantId: request.tenant.tenantId,
        sessionId: request.session.sessionId,
        correlationId,
        nowEpochMs,
      };
      for (const guard of this.guards) {
        let decision: RateLimitDecision;
        try {
          decision = await guard.check(guardContext);
        } catch {
          decision = guardFailureDecision(guard, 0);
        }
        if (!decision.allowed) {
          return {
            ok: false,
            error: gatewayError({
              class: 'transient',
              code: 'gateway-overloaded',
              message: `rate limit exceeded for guard ${guard.guardId}: retry after ${decision.retryAfterMs}ms`,
              operation: request.operation,
              correlationId,
              details: {
                rateLimit: {
                  guardId: guard.guardId,
                  limit: decision.limit,
                  remaining: decision.remaining,
                  retryAfterMs: decision.retryAfterMs,
                  degraded: decision.degraded,
                },
              },
            }),
          };
        }
      }
    }

    // 2. Session gate (bootstrap exception: session.issue).
    let session: SessionRecord | null = null;
    if (request.operation !== 'session.issue') {
      const validated = this.authorities.sessions.validateSession(request.session.sessionId, at);
      if (!validated.ok) {
        return {
          ok: false,
          error: gatewayError({
            class: 'auth-session-expired',
            code: sessionErrorCode(validated.error.code),
            message: validated.error.message,
            operation: request.operation,
            correlationId,
            details: { sessionId: request.session.sessionId, reauthRequired: true },
          }),
        };
      }
      session = validated.value;
      if (!this.authorities.sessions.isUsable(session, at)) {
        return {
          ok: false,
          error: gatewayError({
            class: 'auth-session-expired',
            code: session.lifecycle === 'revoked' ? 'session-revoked' : 'session-expired',
            message: `session ${session.lifecycle}`,
            operation: request.operation,
            correlationId,
            details: { sessionId: request.session.sessionId, reauthRequired: true },
          }),
        };
      }
    }

    // 3. Tenant gate: the request scope must equal the session scope.
    if (session !== null && request.tenant.tenantId !== session.session.tenantId) {
      return {
        ok: false,
        error: gatewayError({
          class: 'validation',
          code: 'tenant-scope-mismatch',
          message: `the request tenant "${request.tenant.tenantId}" does not match the session tenant "${session.session.tenantId}" (R12 tenant isolation)`,
          operation: request.operation,
          correlationId,
          details: { sessionId: session.session.sessionId },
        }),
      };
    }

    // 4. Idempotency-key rule for mutating operations.
    const keyError = requireIdempotencyKey(request);
    if (keyError !== null) {
      return { ok: false, error: withCorrelation(keyError, correlationId) };
    }

    // 5. The W009 authorization gate on every mutating operation except
    //    session lifecycle (authentication IS the gate there).
    if (session !== null && isMutatingOperation(request.operation) && !request.operation.startsWith('session.')) {
      const gate = this.evaluateAuthorizationGate(session, request.operation);
      if (!gate.ok) {
        return { ok: false, error: withCorrelation(gate.error, correlationId) };
      }
      if (gate.value.outcome !== 'allow') {
        return {
          ok: false,
          error: gatewayError({
            class: 'authority-rejected',
            code: 'authority-denied',
            message: `the W009 authorization decision point denied "${request.operation}" for principal "${session.session.principalId}"`,
            operation: request.operation,
            correlationId,
            details: {
              authority: '@epoch/authorization',
              authorityCode: gate.value.outcome === 'deny' ? 'denied' : 'not-applicable',
              authorityError: { outcome: gate.value.outcome },
            },
          }),
        };
      }
    }

    // 6. Dispatch (idempotency wrap for mutating operations).
    const handler = this.handlerFor(request.operation);
    if (handler === null) {
      return {
        ok: false,
        error: gatewayError({
          class: 'unrecoverable',
          code: 'operation-unknown',
          message: `no handler registered for "${request.operation}"`,
          operation: request.operation,
          correlationId,
        }),
      };
    }
    const context: OperationContext = {
      session,
      correlation: { correlationId, origin: request.correlation.origin },
      tenantId: request.tenant.tenantId,
      at,
      payload: request.payload,
    };
    let result: GatewayResult<JsonValue>;
    let replayed = false;
    const executeHandler = async (): Promise<GatewayResult<JsonValue>> => {
      try {
        return await handler(context);
      } catch (cause) {
        if (cause instanceof GatewayPayloadError) {
          return failResult(
            gatewayError({
              class: 'validation',
              code: 'request-validation',
              message: cause.message,
              operation: request.operation,
              correlationId,
            }),
          );
        }
        // A kernel/authority throw IS an authority rejection (the
        // authority's failure mode rides verbatim — the gateway never
        // invents its own semantic errors and never masks the source).
        return failResult(
          gatewayError({
            class: 'authority-rejected',
            code: 'authority-denied',
            message: `the authority rejected the request: ${String(cause)}`,
            operation: request.operation,
            correlationId,
            details: {
              authority: AUTHORITY_BY_OPERATION[request.operation]?.authority ?? 'unmapped',
              authorityCode: 'authority-threw',
              authorityError: toJson(String(cause)),
            },
          }),
        );
      }
    };
    if (isMutatingOperation(request.operation) && request.idempotencyKey !== undefined) {
      const replay = await applyIdempotent(
        this.idempotency,
        {
          operationKey: request.operation,
          idempotencyKey: request.idempotencyKey,
          requestFingerprint: computeRequestFingerprint(request.payload),
        },
        executeHandler,
        at,
      );
      if (!replay.ok) {
        return { ok: false, error: withCorrelation(replay.error, correlationId, request.operation) };
      }
      result = okResult(replay.value.outcome);
      replayed = replay.value.status === 'replayed';
    } else {
      result = await executeHandler();
    }
    // 7. Correlation ledger (every call that reached the authority —
    //    success OR authority failure — is traced gateway -> kernel).
    const outcomeDigest = result.ok ? canonicalDigest(result.value) : null;
    await this.correlationLedger
      .record({
        schemaVersion: 1,
        correlationId,
        operation: request.operation,
        authority: AUTHORITY_BY_OPERATION[request.operation]?.authority ?? 'unmapped',
        at,
        outcomeDigest,
        replayed,
      })
      .catch(() => undefined);
    if (!result.ok) {
      return { ok: false, error: withCorrelation(result.error, correlationId, request.operation) };
    }

    // 8. The outcome envelope.
    const outcome: GatewayOutcome = {
      schemaVersion: 1,
      correlationId,
      outcomeDigest: outcomeDigest ?? '',
      result: result.value,
      replayed,
    };
    return okResult(outcome);
  }

  /** The gateway's durable stores (migration is idempotent; run once at boot). */
  async prepare(): Promise<GatewayResult<{ applied: readonly string[] }>> {
    if (this.migrated) return okResult({ applied: [] });
    const migrated = await migrateGatewayTables(this.persistence);
    if (migrated.ok) this.migrated = true;
    return migrated;
  }

  /** The session mirror (durable session records; restore on boot). */
  get sessions(): SessionMirror {
    return this.sessionMirror;
  }

  /** The correlation ledger (gateway -> authority call trace). */
  get correlations(): CorrelationLedger {
    return this.correlationLedger;
  }

  /** The persistence session the gateway is bound to. */
  get persistenceSession(): PersistenceSession {
    return this.persistence;
  }

  /** The W009 authorization gate (fail-closed; the REAL decision point). */
  private evaluateAuthorizationGate(
    session: SessionRecord,
    operation: GatewayOperationName,
  ): { ok: true; value: AuthorizationDecision } | { ok: false; error: GatewayError } {
    const facts = this.authorities.authorizationFacts.contextFor({
      principalId: session.session.principalId,
      tenantId: session.session.tenantId,
      operation,
    });
    const request: AuthorizationRequest = {
      schemaVersion: 1,
      principalId: session.session.principalId,
      actionKind: `gateway.${operation}`,
      resource: {
        resourceType: 'application-gateway',
        resourceId: operation,
        tenantId: session.session.tenantId,
        ...(session.session.workspaceId !== undefined ? { workspaceId: session.session.workspaceId } : {}),
      },
    };
    const decision: AuthorizationResult<AuthorizationDecision> = evaluate(request, facts);
    if (!decision.ok) {
      return {
        ok: false,
        error: gatewayError({
          class: 'validation',
          code: 'request-validation',
          message: decision.error.message,
          operation,
          correlationId: 'corr:unattributed',
          details: { authority: '@epoch/authorization', authorityError: toJson(decision.error) },
        }),
      };
    }
    return { ok: true, value: decision.value };
  }

  // -------------------------------------------------------------------------
  // The operation handler registry (thin delegation to the mapped
  // authorities; every failure surfaces as authority-rejected with the
  // authority's typed error verbatim).
  // -------------------------------------------------------------------------

  private handlerFor(operation: GatewayOperationName): OperationHandler | null {
    const handlers: Record<GatewayOperationName, OperationHandler> = {
      'session.issue': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const issued = this.authorities.sessions.issueSession({
          authentication: requireField(payload, 'authentication'),
          principalId: requireString(payload, 'principalId'),
          tenantId: requireString(payload, 'tenantId'),
          workspaceId: optionalString(payload, 'workspaceId'),
          projectId: optionalString(payload, 'projectId'),
          issuedAt: optionalString(payload, 'issuedAt') ?? ctx.at,
          ttlMs: requireNumber(payload, 'ttlMs'),
          nonce: requireString(payload, 'nonce'),
        });
        return mapSessionResult(issued, 'session.issue', ctx, async (value) => {
          await this.sessionMirror.mirrorSession(value.record).catch(() => undefined);
          return toClientSession(value.record);
        });
      },
      'session.validate': async (ctx) => {
        const sessionId = ctx.session?.session.sessionId ?? '';
        const validated = this.authorities.sessions.validateSession(sessionId, ctx.at);
        return mapSessionResult(validated, 'session.validate', ctx, async (record) => toClientSession(record));
      },
      'session.revoke': async (ctx) => {
        const sessionId = ctx.session?.session.sessionId ?? '';
        const revoked = this.authorities.sessions.revokeSession(sessionId, ctx.at);
        return mapSessionResult(revoked, 'session.revoke', ctx, async (record) => {
          await this.sessionMirror.mirrorSession(record).catch(() => undefined);
          return toClientSession(record);
        });
      },
      'context.resolve': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const nodeId = requireString(payload, 'nodeId');
        const node = this.authorities.tenancy.getNode(nodeId as never);
        return mapAuthorityResult(node, '@epoch/tenancy', 'context.resolve', ctx, (value) => value as unknown as JsonValue);
      },
      'world.snapshot': async () => {
        const snapshot = this.authorities.worlds.serialize();
        const digest = this.authorities.worlds.digest();
        return okResult({ snapshot: snapshot as unknown as JsonValue, digest } as unknown as JsonValue);
      },
      'world.entities': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const filter = optionalString(payload, 'entityType');
        const entities = this.authorities.worlds.listEntities(filter !== undefined ? { entityType: filter } as never : undefined);
        return okResult(entities as unknown as JsonValue);
      },
      'evidence.intake': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const response: Record<string, JsonValue> = {};
        const bytesBase64 = optionalString(payload, 'bytesBase64');
        if (bytesBase64 !== undefined) {
          const bytes = decodeBase64(bytesBase64);
          const metadataInput = (payload['metadata'] ?? {}) as Record<string, unknown>;
          const metadata: ObjectMetadata = {
            schemaVersion: 1,
            kind: (metadataInput['kind'] as ObjectMetadata['kind']) ?? 'evidence-artifact',
            tenantId: ctx.tenantId,
            ...(typeof metadataInput['label'] === 'string' ? { label: metadataInput['label'] } : {}),
            ...(typeof metadataInput['evidenceLink'] === 'object' && metadataInput['evidenceLink'] !== null
              ? { evidenceLink: metadataInput['evidenceLink'] as { evidenceDigest: string } }
              : {}),
            storedAt: ctx.at,
          };
          const stored = await this.authorities.objects.put(bytes, metadata);
          if (!stored.ok) {
            return failResult(
              gatewayError({
                class: 'authority-rejected',
                code: 'authority-rejected-input',
                message: stored.error.message,
                operation: 'evidence.intake',
                correlationId: ctx.correlation.correlationId,
                details: { authority: '@epoch/object-storage', authorityCode: stored.error.code, authorityError: toJson(stored.error) },
              }),
            );
          }
          // The digest is RECOMPUTED by the authority (a claimed digest is never trusted).
          response['objectRef'] = stored.value as unknown as JsonValue;
        }
        const record = payload['record'];
        if (record !== undefined) {
          const receipt = this.authorities.evidence.add(record);
          if (!receipt.ok) {
            return failResult(
              gatewayError({
                class: 'authority-rejected',
                code: 'authority-rejected-input',
                message: receipt.issues.map((issue) => issue.message).join('; ') || 'the evidence record was rejected',
                operation: 'evidence.intake',
                correlationId: ctx.correlation.correlationId,
                details: { authority: '@epoch/evidence', authorityCode: 'validation', authorityError: toJson({ issues: receipt.issues }) },
              }),
            );
          }
          response['receipt'] = { digest: receipt.receipt.digest, record: receipt.receipt.record as unknown as JsonValue };
        }
        if (Object.keys(response).length === 0) {
          return failResult(
            gatewayError({
              class: 'validation',
              code: 'request-validation',
              message: 'evidence.intake requires "record" and/or "bytesBase64"',
              operation: 'evidence.intake',
              correlationId: ctx.correlation.correlationId,
            }),
          );
        }
        return okResult(response as unknown as JsonValue);
      },
      'evidence.get': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const digest = optionalString(payload, 'digest');
        if (digest !== undefined) {
          const record = this.authorities.evidence.byDigest(digest);
          return okResult((record ?? null) as unknown as JsonValue);
        }
        const artifactId = requireString(payload, 'artifactId');
        const records = this.authorities.evidence.byArtifact(artifactId);
        return okResult(records.map((receipt) => receipt.record) as unknown as JsonValue);
      },
      'discovery.run': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const options = asRecord(payload['options'] ?? {});
        const run = runProblemDrivenDiscovery(payload['input'] as never, {
          at: optionalString(options, 'at') ?? ctx.at,
          candidates: (options['candidates'] ?? []) as never,
          ...(optionalString(options, 'invokedBy') !== undefined ? { invokedBy: optionalString(options, 'invokedBy') } : {}),
          ...(optionalString(options, 'trigger') !== undefined ? { trigger: optionalString(options, 'trigger') as never } : {}),
        });
        return mapAuthorityResult(run, '@epoch/capability-discovery', 'discovery.run', ctx, (value) => value as unknown as JsonValue);
      },
      'action.submit': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const options: SubmitActionOptions = {
          tenantId: ctx.tenantId,
          actionId: requireString(payload, 'actionId'),
          proposal: payload['proposal'],
          policies: (payload['policies'] ?? []) as readonly unknown[],
          resolveConstraint: this.authorities.actionConstraintResolver,
          ...(payload['evaluationContext'] !== undefined ? { evaluationContext: payload['evaluationContext'] } : {}),
          ...(isRecord(payload['scope']) ? { scope: payload['scope'] as never } : {}),
          authorization: {
            principalId: ctx.session?.session.principalId ?? '',
            context: this.authorities.authorizationFacts.contextFor({
              principalId: ctx.session?.session.principalId ?? '',
              tenantId: ctx.tenantId,
              operation: 'action.submit',
            }),
            ...(optionalString(payload, 'justification') !== undefined ? { justification: optionalString(payload, 'justification') } : {}),
          },
          decidedAt: optionalString(payload, 'decidedAt') ?? ctx.at,
          ...(isRecord(payload['approval']) ? { approval: payload['approval'] as never } : {}),
        } as SubmitActionOptions;
        const submitted = this.authorities.actionGateway.submitAction(options);
        return mapAuthorityResult(submitted, '@epoch/action-gateway', 'action.submit', ctx, (value) => value as unknown as JsonValue);
      },
      'action.approve': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const approved = this.authorities.actionGateway.approveAction({
          tenantId: ctx.tenantId,
          actionId: requireString(payload, 'actionId'),
          decidedBy: requireField(payload, 'decidedBy'),
          asRole: requireString(payload, 'asRole'),
          ...(Array.isArray(payload['delegationPath']) ? { delegationPath: payload['delegationPath'] as readonly string[] } : {}),
          ...(optionalString(payload, 'note') !== undefined ? { note: optionalString(payload, 'note') } : {}),
          at: optionalString(payload, 'at') ?? ctx.at,
        } as never);
        return mapAuthorityResult(approved, '@epoch/action-gateway', 'action.approve', ctx, (value) => value as unknown as JsonValue);
      },
      'action.execute': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const executed = this.authorities.actionGateway.executeAction({
          tenantId: ctx.tenantId,
          actionId: requireString(payload, 'actionId'),
          ...(optionalString(payload, 'expectedProposalDigest') !== undefined
            ? { expectedProposalDigest: optionalString(payload, 'expectedProposalDigest') }
            : {}),
          authorization: {
            principalId: ctx.session?.session.principalId ?? '',
            context: this.authorities.authorizationFacts.contextFor({
              principalId: ctx.session?.session.principalId ?? '',
              tenantId: ctx.tenantId,
              operation: 'action.execute',
            }),
          },
          ...(Array.isArray(payload['evidenceRefs']) ? { evidenceRefs: payload['evidenceRefs'] as readonly string[] } : {}),
          at: optionalString(payload, 'at') ?? ctx.at,
        } as never);
        return mapAuthorityResult(executed, '@epoch/action-gateway', 'action.execute', ctx, (value) => value as unknown as JsonValue);
      },
      'action.status': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const actionId = optionalString(payload, 'actionId');
        if (actionId !== undefined) {
          const action = this.authorities.actionGateway.getAction({ tenantId: ctx.tenantId, actionId });
          return mapAuthorityResult(action, '@epoch/action-gateway', 'action.status', ctx, (value) => value as unknown as JsonValue);
        }
        const actions = this.authorities.actionGateway.listActions({ tenantId: ctx.tenantId });
        return mapAuthorityResult(actions, '@epoch/action-gateway', 'action.status', ctx, (value) => value as unknown as JsonValue);
      },
      'constraints.evaluate': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const outcome = evaluateConstraint(payload['compiledConstraint'], payload['context']);
        // evaluateConstraint returns an EvaluationOutcome (not a result):
        // surface it verbatim (the authority's own typed shape).
        return okResult(outcome as unknown as JsonValue);
      },
      'verification.validateChain': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const validation = validateChain(payload['chain'] as never);
        return okResult(validation as unknown as JsonValue);
      },
      'solution.sealVersion': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const sealed = sealSolutionVersion(payload['content']);
        return mapAuthorityResult(sealed, '@epoch/solution-delivery', 'solution.sealVersion', ctx, (value) => value as unknown as JsonValue);
      },
      'solution.approveBaseline': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const approved = approveSolutionBaseline(payload['solution'], requireField(payload, 'approval'));
        return mapAuthorityResult(approved, '@epoch/solution-delivery', 'solution.approveBaseline', ctx, (value) => value as unknown as JsonValue);
      },
      'program.build': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const program = buildProgramOfWork(payload['content']);
        return mapAuthorityResult(program, '@epoch/solution-delivery', 'program.build', ctx, (value) => value as unknown as JsonValue);
      },
      'program.schedule': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const program = payload['program'] as never;
        return okResult({
          quantity: foldQuantitySchedule(program) as unknown as JsonValue,
          cost: foldCostSchedule(program) as unknown as JsonValue,
          resources: foldResourceSchedule(program) as unknown as JsonValue,
          milestones: foldMilestoneSchedule(program) as unknown as JsonValue,
        } as unknown as JsonValue);
      },
      'delivery.open': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const delivery = openDeliveryRecord(payload['content']);
        return mapAuthorityResult(delivery, '@epoch/solution-delivery', 'delivery.open', ctx, (value) => value as unknown as JsonValue);
      },
      'delivery.observe': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const solutionId = requireString(payload, 'solutionId');
        // The capture anchors on program activities: when the caller
        // supplies the governing sealed program, the handler builds the
        // REAL program index (the execution-tracking authority's own
        // index builder) so anchor validation is the kernel's.
        let programDigest = 'no-program';
        let programIndex: ProgramIndex | undefined;
        if (payload['program'] !== undefined) {
          const index = buildProgramIndex(payload['program']);
          if (!index.ok) {
            return mapAuthorityResult(index, '@epoch/execution-tracking', 'delivery.observe', ctx, (value) => value as unknown as JsonValue);
          }
          programIndex = index.value;
          programDigest = (payload['program'] as { contentDigest?: string }).contentDigest ?? 'program';
        }
        const store = this.trackingStoreFor(ctx.tenantId, solutionId, programDigest, programIndex);
        const intake = intakeFieldObservation(store, payload['capture']);
        return mapAuthorityResult(intake, '@epoch/execution-tracking', 'delivery.observe', ctx, (value) => value as unknown as JsonValue);
      },
      'delivery.close': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const closed = closeDeliveryRecord(requireField(payload, 'delivery'), requireField(payload, 'closing'));
        return mapAuthorityResult(closed, '@epoch/solution-delivery', 'delivery.close', ctx, (value) => value as unknown as JsonValue);
      },
      'procurement.quote': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const sealed = sealQuote(payload['content']);
        if (!sealed.ok) {
          return mapAuthorityResult(sealed, '@epoch/procurement', 'procurement.quote', ctx, (value) => value as unknown as JsonValue);
        }
        const admitted = admitQuote(
          (payload['packages'] ?? []) as never,
          (payload['store'] ?? []) as never,
          sealed.value,
        );
        return mapAuthorityResult(admitted, '@epoch/procurement', 'procurement.quote', ctx, (value) => ({ quote: sealed.value as unknown as JsonValue, store: value as unknown as JsonValue }) as unknown as JsonValue);
      },
      'procurement.order': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const sealed = sealPurchaseOrder(payload['content']);
        if (!sealed.ok) {
          return mapAuthorityResult(sealed, '@epoch/procurement', 'procurement.order', ctx, (value) => value as unknown as JsonValue);
        }
        const admitted = admitPurchaseOrder(
          (payload['packages'] ?? []) as never,
          (payload['quotes'] ?? []) as never,
          (payload['selections'] ?? []) as never,
          (payload['commitments'] ?? []) as never,
          (payload['store'] ?? []) as never,
          sealed.value,
        );
        return mapAuthorityResult(admitted, '@epoch/procurement', 'procurement.order', ctx, (value) => ({ order: sealed.value as unknown as JsonValue, store: value as unknown as JsonValue }) as unknown as JsonValue);
      },
      'actualization.forecast': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const forecast = rollForecast(payload['input'] as never);
        return mapAuthorityResult(forecast, '@epoch/actualization', 'actualization.forecast', ctx, (value) => value as unknown as JsonValue);
      },
      'outcome.learn': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const solutionId = requireString(payload, 'solutionId');
        const store = this.learningStoreFor(ctx.tenantId, solutionId);
        const registered = registerOutcomeRecord(store, payload['record']);
        return mapAuthorityResult(registered, '@epoch/learning-calibration', 'outcome.learn', ctx, (value) => value as unknown as JsonValue);
      },
      'access.project': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const evaluation = evaluateProjection({
          policy: payload['policy'],
          record: payload['record'],
          binding: requireField(payload, 'binding'),
          ...(payload['taskContext'] !== undefined ? { taskContext: payload['taskContext'] as never } : {}),
        } as never);
        return mapAuthorityResult(evaluation, '@epoch/access-projection', 'access.project', ctx, (value) => {
          const selection = selectVisiblePaths(requireField(payload, 'binding') as never, payload['record'] as never, undefined);
          return { evaluation: value as unknown as JsonValue, visiblePaths: selection as unknown as JsonValue } as unknown as JsonValue;
        });
      },
      'supervision.check': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const pass = evaluateSupervisionPass(payload['input']);
        return mapAuthorityResult(pass, '@epoch/supervision', 'supervision.check', ctx, (value) => value as unknown as JsonValue);
      },
      'alerts.raise': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const raised = raiseAlert(
          (payload['chain'] ?? []) as never,
          requireField(payload, 'options'),
        );
        return mapAuthorityResult(raised, '@epoch/alerts', 'alerts.raise', ctx, (value) => value as unknown as JsonValue);
      },
      'marketplace.entitlement': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const checked = checkEntitlement({
          grants: (payload['grants'] ?? []) as never,
          revocations: (payload['revocations'] ?? []) as never,
          query: requireField(payload, 'query'),
        });
        return mapAuthorityResult(checked, '@epoch/marketplace', 'marketplace.entitlement', ctx, (value) => value as unknown as JsonValue);
      },
      'events.read': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const streamId = requireString(payload, 'streamId');
        const stream = this.authorities.eventLog.readStream(streamId as never, {
          ...(optionalString(payload, 'after') !== undefined ? { after: optionalString(payload, 'after') } : {}),
          ...(payload['limit'] !== undefined ? { limit: requireNumber(payload, 'limit') } : {}),
        } as never);
        return mapAuthorityResult(stream, '@epoch/event-log', 'events.read', ctx, (value) => value as unknown as JsonValue);
      },
      'recovery.replay': async (ctx) => {
        const payload = asRecord(ctx.payload);
        const intents = (payload['intents'] ?? []) as readonly {
          readonly queueId?: string;
          readonly idempotencyKey?: string;
          readonly operation?: string;
          readonly payload?: JsonValue;
        }[];
        const outcomes: Array<Record<string, JsonValue>> = [];
        for (const [index, intent] of intents.entries()) {
          const queueId = intent.queueId ?? `intent-${index}`;
          if (intent.operation === undefined || intent.idempotencyKey === undefined) {
            outcomes.push({ queueId, status: 'rejected', errorCode: 'idempotency-key-required' });
            continue;
          }
          // Every replay routes THROUGH the gateway (the Action Gateway
          // path for action.* operations) with the intent's idempotency key.
          const replayed = await this.call({
            schemaVersion: 1,
            contractVersion: '1.0.0',
            operation: intent.operation as GatewayOperationName,
            session: { schemaVersion: 1, sessionId: ctx.session?.session.sessionId ?? '' },
            correlation: {
              schemaVersion: 1,
              correlationId: ctx.correlation.correlationId,
              causationId: ctx.correlation.correlationId,
              origin: 'server' as const,
              issuedAt: ctx.at,
            },
            tenant: { tenantId: ctx.tenantId },
            idempotencyKey: intent.idempotencyKey,
            payload: intent.payload ?? {},
          });
          if (replayed.ok) {
            outcomes.push({ queueId, status: 'drained', outcomeDigest: replayed.value.outcomeDigest, replayed: replayed.value.replayed });
          } else {
            const keepPending = replayed.error.class === 'transient';
            outcomes.push({
              queueId,
              status: keepPending ? 'still-pending' : 'rejected',
              errorCode: replayed.error.code,
              errorClass: replayed.error.class,
            });
          }
        }
        return okResult({ drainedAt: ctx.at, outcomes } as unknown as JsonValue);
      },
    };
    return handlers[operation] ?? null;
  }

  private trackingStoreFor(
    tenantId: string,
    solutionId: string,
    programDigest: string,
    programIndex: ProgramIndex | undefined,
  ): ExecutionTrackingStore {
    const key = `${tenantId}::${solutionId}::${programDigest}`;
    let store = this.storeCache.tracking.get(key);
    if (store === undefined) {
      const opened = openExecutionTrackingStore({ tenantId, solutionId, ...(programIndex !== undefined ? { programIndex } : {}) });
      if (!opened.ok) throw new Error(`execution-tracking store could not open: ${opened.error.message}`);
      store = opened.value;
      this.storeCache.tracking.set(key, store);
    }
    return store;
  }

  private learningStoreFor(tenantId: string, solutionId: string): LearningStore {
    const key = `${tenantId}::${solutionId}`;
    let store = this.storeCache.learning.get(key);
    if (store === undefined) {
      store = openLearningStore({ tenantId, solutionId });
      this.storeCache.learning.set(key, store);
    }
    return store;
  }
}

// ---------------------------------------------------------------------------
// Error mapping helpers (authority errors ride verbatim; the gateway
// never invents semantic errors).
// ---------------------------------------------------------------------------

function mapAuthorityResult<T>(
  result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } & Record<string, unknown> },
  authority: string,
  operation: GatewayOperationName,
  ctx: OperationContext,
  project: (value: T) => Promise<JsonValue> | JsonValue,
): Promise<GatewayResult<JsonValue>> {
  if (!result.ok) {
    return Promise.resolve(
      failResult(
        gatewayError({
          class: 'authority-rejected',
          code: 'authority-denied',
          message: result.error.message,
          operation,
          correlationId: ctx.correlation.correlationId,
          details: {
            authority,
            authorityCode: result.error.code,
            authorityError: toJson(result.error),
          },
        }),
      ),
    );
  }
  return Promise.resolve(Promise.resolve(project(result.value)).then((value) => okResult(value)));
}

function mapSessionResult<T>(
  result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } },
  operation: GatewayOperationName,
  ctx: OperationContext,
  project: (value: T) => Promise<JsonValue> | JsonValue,
): Promise<GatewayResult<JsonValue>> {
  if (!result.ok) {
    return Promise.resolve(
      failResult(
        gatewayError({
          class: 'authority-rejected',
          code: 'authority-rejected-input',
          message: result.error.message,
          operation,
          correlationId: ctx.correlation.correlationId,
          details: {
            authority: '@epoch/authentication',
            authorityCode: result.error.code,
            authorityError: toJson(result.error),
          },
        }),
      ),
    );
  }
  return Promise.resolve(Promise.resolve(project(result.value)).then((value) => okResult(value)));
}

function sessionErrorCode(code: string): GatewayError['code'] {
  switch (code) {
    case 'session-expired':
      return 'session-expired';
    case 'session-revoked':
      return 'session-revoked';
    default:
      return 'session-unknown';
  }
}

function withCorrelation(error: GatewayError, correlationId: string, operation?: string): GatewayError {
  return {
    ...error,
    correlationId: error.correlationId === 'corr:unattributed' ? correlationId : error.correlationId,
    ...(operation !== undefined && error.operation === 'gateway' ? { operation } : {}),
  };
}

/** Project a session record into the CLIENT-FACING session shape (flattened). */
function toClientSession(record: SessionRecord): JsonValue {
  return {
    schemaVersion: 1,
    sessionId: record.session.sessionId,
    principalId: record.session.principalId,
    tenantId: record.session.tenantId,
    ...(record.session.workspaceId !== undefined ? { workspaceId: record.session.workspaceId } : {}),
    ...(record.session.projectId !== undefined ? { projectId: record.session.projectId } : {}),
    issuedAt: record.session.issuedAt,
    expiresAt: record.session.expiresAt,
    state: record.lifecycle,
  } as unknown as JsonValue;
}

/** Coerce an authority error value into a plain JsonValue (deep JSON clone). */
function toJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as JsonValue;
}

// Payload accessors (total: typed validation errors, never throw).
function asRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Require a field's presence (throws the typed payload error the dispatch maps). */
function requireField<T = unknown>(payload: Record<string, unknown>, field: string): T {
  if (!(field in payload)) throw new GatewayPayloadError(field);
  return payload[field] as T;
}

function requireString(payload: Record<string, unknown>, field: string): string {
  const value = payload[field];
  if (typeof value !== 'string') {
    throw new GatewayPayloadError(`payload field "${field}" must be a string (got ${typeof value})`);
  }
  return value;
}

function optionalString(payload: Record<string, unknown>, field: string): string | undefined {
  const value = payload[field];
  return typeof value === 'string' ? value : undefined;
}

function requireNumber(payload: Record<string, unknown>, field: string): number {
  const value = payload[field];
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new GatewayPayloadError(`payload field "${field}" must be a safe integer (got ${typeof value})`);
  }
  return value;
}

class GatewayPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GatewayPayloadError';
  }
}

/** Decode base64 bytes (Node stdlib; the server recomputes every digest). */
function decodeBase64(encoded: string): Uint8Array {
  return new Uint8Array(Buffer.from(encoded, 'base64'));
}
