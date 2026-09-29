/**
 * @epoch/client-runtime — offline admission (PENDING PROJECTIONS ONLY).
 *
 * ACR-005: "Local caches/queues are session/projection/replay state only."
 * A local queue may hold PENDING PROJECTIONS of user intent, never
 * semantic state. Admission enforces the five NAMED NEGATIVES:
 *  (a) no local approval ever counts as authority;
 *  (b) no local mutation of World/Solution/Delivery/ProgramOfWork truth;
 *  (c) no local tenant/identity minting;
 *  (d) no local digest/verification forgery;
 *  (e) queue replay must go through the Action Gateway with idempotency
 *      keys or be rejected.
 * Each negative has a dedicated rejection code AND a named test that fails
 * if the prohibition is violated (test/offline.test.ts).
 *
 * Outcomes are NEVER produced locally: `drain` is the only path to a
 * non-pending state, and it forwards every intent to the
 * `OfflineReplayPort` (the Application Gateway call seam) carrying the
 * intent's idempotency key.
 */
import { z } from 'zod';
import { JsonValueSchema, TimestampSchema, type JsonValue } from '@epoch/agent-protocol';
import { PrincipalIdSchema } from '@epoch/identity';
import { TenantIdSchema, WorkspaceIdSchema } from '@epoch/tenancy';
import {
  CLIENT_RUNTIME_RECORD_VERSION,
  OFFLINE_INTENT_STATES,
  QUEUE_ID_PATTERN,
  QUEUEABLE_OPERATIONS,
  OPERATION_BY_NAME,
  isGatewayOperationName,
  isQueueableOperation,
  type GatewayOperationName,
  type OfflineAdmissionCode,
  type OfflineIntentState,
} from './version';
import { SessionIdSchema } from './session';
import { RequestCorrelationSchema, type RequestCorrelation } from './correlation';
import { gatewayError, type GatewayError, type GatewayResult } from './errors';
import { IdempotencyKeySchema } from './idempotency';

/**
 * Fields that a queued intent payload must NEVER carry — each list is one
 * named negative's detector (admission scans the payload's TOP-LEVEL and
 * `intent`/`data`/`content` sub-objects):
 *  - FORGED_OUTCOME_FIELDS: a local outcome/approval/decision claim (a);
 *  - FORGED_IDENTITY_FIELDS: locally minted tenant/identity assertions (c);
 *  - FORGED_VERIFICATION_FIELDS: local digest/verification claims (d).
 */
export const FORGED_OUTCOME_FIELDS = [
  'outcome',
  'approved',
  'approvalResult',
  'decision',
  'decisionResult',
  'result',
] as const;

export const FORGED_IDENTITY_FIELDS = [
  'newTenantId',
  'newPrincipalId',
  'mintTenantId',
  'mintPrincipalId',
] as const;

export const FORGED_VERIFICATION_FIELDS = [
  'verified',
  'verification',
  'verificationResult',
  'proof',
  'proofOf',
  'attestation',
  'attestedDigest',
] as const;

/** The session scope an offline queue is bound to (no scope minting). */
export interface OfflineQueueScope {
  readonly schemaVersion: typeof CLIENT_RUNTIME_RECORD_VERSION;
  readonly sessionId: string;
  readonly principalId: string;
  readonly tenantId: string;
  readonly workspaceId?: string | undefined;
}

export const OfflineQueueScopeSchema = z
  .strictObject({
    schemaVersion: z.literal(CLIENT_RUNTIME_RECORD_VERSION),
    sessionId: SessionIdSchema,
    principalId: PrincipalIdSchema,
    tenantId: TenantIdSchema,
    workspaceId: WorkspaceIdSchema.optional(),
  })
  .readonly()
  .meta({ id: 'OfflineQueueScope', title: 'OfflineQueueScope' });

/** One queued PENDING PROJECTION of a user intent. */
export interface QueuedIntent {
  readonly schemaVersion: typeof CLIENT_RUNTIME_RECORD_VERSION;
  readonly queueId: string;
  readonly sessionId: string;
  readonly correlation: RequestCorrelation;
  readonly idempotencyKey: string;
  readonly operation: GatewayOperationName;
  readonly payload: JsonValue;
  readonly enqueuedAt: string;
  readonly state: OfflineIntentState;
  readonly attempts: number;
  readonly lastAttemptAt?: string | undefined;
  readonly lastErrorCode?: string | undefined;
}

export const QueuedIntentSchema = z
  .strictObject({
    schemaVersion: z.literal(CLIENT_RUNTIME_RECORD_VERSION),
    queueId: z.string().regex(QUEUE_ID_PATTERN),
    sessionId: SessionIdSchema,
    correlation: RequestCorrelationSchema,
    idempotencyKey: IdempotencyKeySchema,
    operation: z.string().refine(isGatewayOperationName, 'must be a registered gateway operation'),
    payload: JsonValueSchema,
    enqueuedAt: TimestampSchema,
    state: z.enum(OFFLINE_INTENT_STATES),
    attempts: z.number().int().min(0),
    lastAttemptAt: TimestampSchema.optional(),
    lastErrorCode: z.string().min(1).max(128).optional(),
  })
  .readonly()
  .meta({ id: 'QueuedIntent', title: 'QueuedIntent' });

/** One admission rejection (a named negative, typed). */
export interface OfflineAdmissionRejection {
  readonly code: OfflineAdmissionCode;
  readonly message: string;
  readonly field?: string | undefined;
}

/** The result of `admitIntent`: accepted (the pending projection) or a named-negative rejection. */
export type OfflineAdmission =
  | { readonly ok: true; readonly intent: QueuedIntent }
  | { readonly ok: false; readonly rejection: OfflineAdmissionRejection };

/** The input of `admitIntent` (the user-intent projection to queue). */
export interface OfflineIntentInput {
  readonly queueId: string;
  readonly correlation: RequestCorrelation;
  readonly idempotencyKey?: string | undefined;
  readonly operation: string;
  readonly payload: JsonValue;
  readonly enqueuedAt: string;
}

/**
 * The replay port: the ONLY path a queued intent can take towards an
 * outcome. The real Application Gateway implements it (every call routed
 * through the Action Gateway path with the intent's idempotency key);
 * tests spy on it to prove no local outcome production.
 */
export interface OfflineReplayPort {
  submitIntent(input: {
    readonly operation: GatewayOperationName;
    readonly payload: JsonValue;
    readonly idempotencyKey: string;
    readonly correlation: RequestCorrelation;
    readonly sessionId: string;
  }): Promise<GatewayResult<JsonValue>>;
}

/** The outcome of draining the queue. */
export interface DrainOutcome {
  readonly drainedAt: string;
  readonly drained: readonly QueuedIntent[];
  readonly rejected: readonly QueuedIntent[];
  readonly stillPending: readonly QueuedIntent[];
}

/**
 * The offline projection queue. Constructed per session scope; admits only
 * queueable user intents as PENDING PROJECTIONS; produces outcomes only
 * by forwarding to the replay port.
 */
export class OfflineProjectionQueue {
  private readonly intents = new Map<string, QueuedIntent>();

  constructor(private readonly scope: OfflineQueueScope) {}

  /** The bound session scope (identity/tenant come from the session — never minted locally). */
  get boundScope(): OfflineQueueScope {
    return this.scope;
  }

  /** Number of queued intents (all states). */
  get size(): number {
    return this.intents.size;
  }

  /** All intents, deterministic order (by queueId). */
  snapshot(): readonly QueuedIntent[] {
    return [...this.intents.values()].sort((a, b) => (a.queueId < b.queueId ? -1 : 1));
  }

  /** Pending intents only, deterministic order. */
  pendingIntents(): readonly QueuedIntent[] {
    return this.snapshot().filter((intent) => intent.state === 'pending');
  }

  /**
   * Admit a user intent as a PENDING PROJECTION. Enforces the five named
   * negatives; on any violation the intent is NOT stored and the typed
   * rejection names the negative.
   */
  admitIntent(input: OfflineIntentInput): OfflineAdmission {
    // Negative (e): replay must carry idempotency keys or be rejected.
    if (input.idempotencyKey === undefined || input.idempotencyKey === '') {
      return {
        ok: false,
        rejection: {
          code: 'idempotency-key-required',
          message: 'an offline intent must carry an idempotency key (replay goes through the Action Gateway)',
        },
      };
    }
    const keyCheck = IdempotencyKeySchema.safeParse(input.idempotencyKey);
    if (!keyCheck.success) {
      return {
        ok: false,
        rejection: {
          code: 'idempotency-key-required',
          message: 'the idempotency key is malformed (expected "idem:<slug>")',
        },
      };
    }
    // Operation must be registered.
    if (!isGatewayOperationName(input.operation)) {
      return {
        ok: false,
        rejection: {
          code: 'local-semantic-mutation-rejected',
          message: `"${input.operation}" is not a registered gateway operation`,
        },
      };
    }
    // Negative (b): no local mutation of World/Solution/Delivery/
    // ProgramOfWork truth — only queueable user intents (replayed through
    // the Action Gateway path) may be queued.
    if (!isQueueableOperation(input.operation)) {
      return {
        ok: false,
        rejection: {
          code: 'local-semantic-mutation-rejected',
          message:
            `"${input.operation}" mutates authoritative semantic truth (World/Solution/Delivery/ProgramOfWork); ` +
            'a local queue may hold only pending projections of user intent replayed through the Action Gateway',
        },
      };
    }
    // Payload discipline: scan the top level + common nested carriers.
    const payload =
      typeof input.payload === 'object' && input.payload !== null && !Array.isArray(input.payload)
        ? (input.payload as Record<string, unknown>)
        : {};
    const nested = ['intent', 'data', 'content', 'request']
      .flatMap((key) =>
        typeof payload[key] === 'object' && payload[key] !== null && !Array.isArray(payload[key])
          ? Object.keys(payload[key] as Record<string, unknown>)
          : [],
      )
      .map((field) => `${field} (nested)`);
    const payloadFields = [...Object.keys(payload).map((field) => `${field}`), ...nested];
    for (const field of payloadFields) {
      const bare = field.replace(' (nested)', '');
      if ((FORGED_OUTCOME_FIELDS as readonly string[]).includes(bare)) {
        // Negative (a): no local approval ever counts as authority.
        return {
          ok: false,
          rejection: {
            code: 'local-approval-not-authority',
            message: `the intent payload carries a local "${field}" claim — outcomes/approvals are produced only by the Action Gateway, never locally`,
            field,
          },
        };
      }
      if ((FORGED_IDENTITY_FIELDS as readonly string[]).includes(bare)) {
        // Negative (c): no local tenant/identity minting.
        return {
          ok: false,
          rejection: {
            code: 'local-identity-minting-rejected',
            message: `the intent payload carries a local "${field}" claim — tenant/identity minting is the identity/tenancy authority's, never local`,
            field,
          },
        };
      }
      if ((FORGED_VERIFICATION_FIELDS as readonly string[]).includes(bare)) {
        // Negative (d): no local digest/verification forgery.
        return {
          ok: false,
          rejection: {
            code: 'local-digest-forgery-rejected',
            message: `the intent payload carries a local "${field}" claim — verification/digest decisions are the verification authority's, never local`,
            field,
          },
        };
      }
    }
    // Negative (c), continued: identity/tenant assertions must match the
    // session scope exactly (no cross-scope acting).
    for (const field of ['principalId', 'tenantId', 'workspaceId']) {
      const claimed = payload[field];
      if (typeof claimed === 'string') {
        const bound =
          field === 'principalId'
            ? this.scope.principalId
            : field === 'tenantId'
              ? this.scope.tenantId
              : this.scope.workspaceId;
        if (claimed !== bound) {
          return {
            ok: false,
            rejection: {
              code: 'local-identity-minting-rejected',
              message: `the intent payload asserts "${field}" different from the session scope — identity/tenant scope is never re-minted locally`,
              field,
            },
          };
        }
      }
    }
    if (this.intents.has(input.queueId)) {
      return {
        ok: false,
        rejection: {
          code: 'idempotency-key-required',
          message: `queue id "${input.queueId}" is already used (queue ids are unique)`,
        },
      };
    }
    const intent: QueuedIntent = {
      schemaVersion: CLIENT_RUNTIME_RECORD_VERSION,
      queueId: input.queueId,
      sessionId: this.scope.sessionId,
      correlation: input.correlation,
      idempotencyKey: input.idempotencyKey,
      operation: input.operation,
      payload: input.payload,
      enqueuedAt: input.enqueuedAt,
      state: 'pending',
      attempts: 0,
    };
    this.intents.set(input.queueId, intent);
    return { ok: true, intent };
  }

  /**
   * Drain the queue through the replay port. Transient failures keep the
   * intent pending (retry later); every other failure rejects it; success
   * marks it drained. NO local outcome production — the recorded payload
   * of a drained intent is still the ORIGINAL pending projection; the
   * outcome lives in the port response (the authority side).
   */
  async drain(
    port: OfflineReplayPort,
    options: { readonly at: string; readonly maxIntents?: number },
  ): Promise<DrainOutcome> {
    const max = options.maxIntents ?? Number.MAX_SAFE_INTEGER;
    const drained: QueuedIntent[] = [];
    const rejected: QueuedIntent[] = [];
    const stillPending: QueuedIntent[] = [];
    let processed = 0;
    for (const intent of this.pendingIntents()) {
      if (processed >= max) {
        stillPending.push(intent);
        continue;
      }
      processed += 1;
      const marked: QueuedIntent = { ...intent, state: 'draining', attempts: intent.attempts + 1, lastAttemptAt: options.at };
      this.intents.set(intent.queueId, marked);
      const submitted = await port.submitIntent({
        operation: intent.operation,
        payload: intent.payload,
        idempotencyKey: intent.idempotencyKey,
        correlation: intent.correlation,
        sessionId: intent.sessionId,
      });
      if (submitted.ok) {
        const done: QueuedIntent = { ...marked, state: 'drained' };
        this.intents.set(intent.queueId, done);
        drained.push(done);
      } else if (submitted.error.class === 'transient') {
        const retried: QueuedIntent = {
          ...marked,
          state: 'pending',
          lastErrorCode: submitted.error.code,
        };
        this.intents.set(intent.queueId, retried);
        stillPending.push(retried);
      } else {
        const failed: QueuedIntent = {
          ...marked,
          state: 'rejected',
          lastErrorCode: submitted.error.code,
        };
        this.intents.set(intent.queueId, failed);
        rejected.push(failed);
      }
    }
    return { drainedAt: options.at, drained, rejected, stillPending };
  }
}

/** The queueable-operation allowlist (exported for tests + docs). */
export const OFFLINE_QUEUEABLE_OPERATIONS: readonly GatewayOperationName[] = QUEUEABLE_OPERATIONS;

/** Operation descriptors for the queueable allowlist (docs/tests). */
export const QUEUEABLE_OPERATION_TABLE: readonly {
  readonly name: GatewayOperationName;
  readonly description: string;
}[] = QUEUEABLE_OPERATIONS.map((name) => ({
  name,
  description: OPERATION_BY_NAME[name].description,
}));

/** Map an offline admission rejection to the typed gateway error form. */
export function offlineAdmissionToGatewayError(
  rejection: OfflineAdmissionRejection,
  operation: string,
): GatewayError {
  const classByCode: Record<OfflineAdmissionCode, 'validation' | 'authority-rejected'> = {
    'local-approval-not-authority': 'authority-rejected',
    'local-semantic-mutation-rejected': 'authority-rejected',
    'local-identity-minting-rejected': 'authority-rejected',
    'local-digest-forgery-rejected': 'authority-rejected',
    'idempotency-key-required': 'validation',
  };
  return gatewayError({
    class: classByCode[rejection.code],
    code:
      rejection.code === 'idempotency-key-required'
        ? 'idempotency-key-required'
        : 'authority-denied',
    message: rejection.message,
    operation,
    correlationId: 'corr:unattributed',
    details: { admissionCode: rejection.code, field: rejection.field ?? null },
  });
}
