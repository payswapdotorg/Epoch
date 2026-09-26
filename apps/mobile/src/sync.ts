/**
 * @epoch/mobile — the reference sync host (Work Order W018 Tech Lead pin:
 * "sync admission replays through the kernel seams with provenance — the
 * queue is never a second semantic store (lock rules 8/16)").
 *
 * The in-memory reference host (the W020/W022 reference-host precedent)
 * that owns the offline capture channel and replays it through the kernel
 * seams:
 *
 * - CAPTURE intents replay through the W036 observation-intake seam
 *   (`recordObservation` from @epoch/solution-delivery — the field client
 *   is an observation PRODUCER; intake is open to producers, actualization
 *   is not). The envelope converts via `toObservationRecord` and the
 *   kernel's own sealing machinery.
 * - APPROVAL intents replay through the W022 action-gateway seam
 *   (`FieldApprovalGatewayPort`): the review projects to its W003 typed
 *   proposal, the submission leaves through the port, and the client
 *   RECEIVES the decision record. The client holds no credentials and
 *   executes NOTHING: an `allow` decision never mutates the local delivery
 *   state here — acceptance/actualization are applied by the gateway's
 *   execution side against the W036 authority (lock rules 2/3/16).
 * - `gateway-bypass-rejected` is the named negative outcome: settling an
 *   approval intent WITHOUT the gateway seam is a typed rejection, never a
 *   silent direct execution. There is no code path from this host to
 *   `acceptObservation` / `actualizeObservation` — by construction.
 *
 * Determinism: zero wall-clock, zero randomness — every instant is
 * caller-supplied; replay order is the deterministic enqueue order; replay
 * outcomes are recorded as immutable queue-record updates (the prior
 * sealed record chains by digest). Replaying an already-replayed record
 * is IDEMPOTENT (the sealed prior record is the answer).
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  openDeliveryRecord,
  recordObservation,
  verifySealedDeliveryRecord,
  type ObservationRecord,
  type SealedDeliveryRecord,
} from '@epoch/solution-delivery';
import { fieldError, fieldOk, type MobileFieldError, type MobileFieldResult } from './errors';
import {
  verifySealedFieldSession,
  type SealedFieldSession,
} from './session';
import { toObservationRecord, verifySealedFieldCapture, type SealedFieldCapture } from './capture';
import {
  buildFieldReviewSubmission,
  buildReviewActionProposal,
  verifySealedFieldReviewProposal,
  type FieldApprovalGatewayPort,
  type GatewayDecisionRecord,
  type SealedFieldReviewProposal,
} from './approval';
import {
  OfflineQueue,
  type EnqueueCaptureOptions,
  type EnqueueResult,
  type FieldQueueReplay,
  type SealedFieldQueueRecord,
} from './queue';

/** The sync host's W003 proposal identity options. */
export interface SyncProposalIdentity {
  /** The W003 proposals-are-agent-authored grammar: the field sync host agent. */
  readonly proposedByAgent: string;
  /** Whether the projected review proposals escalate to a human quorum. */
  readonly requiresHumanApproval: boolean;
}

/** The default proposal identity (deterministic). */
export const DEFAULT_SYNC_PROPOSAL_IDENTITY: SyncProposalIdentity = {
  proposedByAgent: 'agent:field-sync-host',
  requiresHumanApproval: false,
} as const;

/** Options of {@link FieldSyncHost}. */
export interface FieldSyncHostOptions {
  /** The tenant this host is scoped to (R12; every record must match). */
  readonly tenantId: string;
  /**
   * The initial W036 delivery record state, in sealed or content form —
   * admitted through the kernel's own admission machinery only.
   */
  readonly delivery: unknown;
  /** The field session the host captures under (sealed). */
  readonly session: SealedFieldSession | unknown;
  /**
   * The W022 action-gateway seam binding. OPTIONAL BY DESIGN: approval
   * intents replayed without it are the typed `gateway-bypass-rejected`
   * outcome (there is no direct-execution path).
   */
  readonly gateway?: FieldApprovalGatewayPort | undefined;
  /** The W003 proposal identity (deterministic defaults). */
  readonly proposalIdentity?: SyncProposalIdentity | undefined;
}

/** One replay outcome of a sync sweep. */
export interface SyncReplayOutcome {
  readonly record: SealedFieldQueueRecord;
  /** Admitted through the kernel seam, or rejected with the typed error. */
  readonly state: 'admitted' | 'rejected';
  /** The digest the kernel seam produced (new delivery digest or received decision digest). */
  readonly producedDigest?: Sha256Hex | undefined;
  /** The typed error a rejected replay recorded. */
  readonly error?: MobileFieldError | undefined;
}

/** The result of one sync sweep. */
export interface SyncResult {
  readonly replayed: readonly SyncReplayOutcome[];
  /** The delivery state after the sweep (mutated ONLY through the intake seam). */
  readonly delivery: SealedDeliveryRecord;
  /** The decision records RECEIVED through the gateway seam this sweep. */
  readonly receivedDecisions: readonly GatewayDecisionRecord[];
}

/** Options of {@link FieldSyncHost.syncQueue}. */
export interface SyncQueueOptions {
  /** Caller-supplied sync instant (zero wall-clock). */
  readonly at: string;
  /** The principal performing the sync admission (W036 recordedBy). */
  readonly performedBy: string;
}

/** Admit the delivery state through the kernel's own machinery (sealed or content form). */
function admitDelivery(input: unknown): MobileFieldResult<SealedDeliveryRecord> {
  const sealed = verifySealedDeliveryRecord(input);
  if (sealed.ok) {
    return sealed;
  }
  const content = openDeliveryRecord(input);
  if (content.ok) {
    return content;
  }
  return fieldError({
    code: 'validation',
    message: `not a valid W036 delivery record (sealed or content form): ${content.error.message}`,
  });
}

/**
 * The in-memory reference sync host: the offline capture channel + the
 * kernel-seam replay. The host NEVER writes semantic state directly:
 * - the delivery state changes ONLY through `recordObservation` (W036);
 * - approvals leave ONLY through the gateway port and arrive as decision
 *   records (receipts, never effects).
 */
export class FieldSyncHost {
  private readonly tenantId: string;
  private readonly queue: OfflineQueue;
  private readonly session: SealedFieldSession;
  private readonly gateway: FieldApprovalGatewayPort | undefined;
  private readonly identity: SyncProposalIdentity;
  private readonly capturePayloads: Map<Sha256Hex, SealedFieldCapture> = new Map();
  private readonly reviewPayloads: Map<Sha256Hex, SealedFieldReviewProposal> = new Map();
  private delivery: SealedDeliveryRecord;
  private readonly receivedDecisions: GatewayDecisionRecord[] = [];

  constructor(options: FieldSyncHostOptions) {
    this.tenantId = options.tenantId;
    const session = verifySealedFieldSession(options.session);
    if (!session.ok) {
      throw new TypeError(
        `FieldSyncHost requires a valid sealed field session: ${session.error.message}`,
      );
    }
    if (session.value.tenantId !== options.tenantId) {
      throw new TypeError('FieldSyncHost session must match the host tenant (R12)');
    }
    this.session = session.value;
    const delivery = admitDelivery(options.delivery);
    if (!delivery.ok) {
      throw new TypeError(`FieldSyncHost requires a valid W036 delivery record: ${delivery.error.message}`);
    }
    this.delivery = delivery.value;
    this.gateway = options.gateway;
    this.identity = options.proposalIdentity ?? DEFAULT_SYNC_PROPOSAL_IDENTITY;
    this.queue = new OfflineQueue({ expectedTenantId: options.tenantId });
  }

  /** The current delivery state (read-only projection; intake seam only). */
  currentDelivery(): SealedDeliveryRecord {
    return this.delivery;
  }

  /** The field session the host captures under. */
  currentSession(): SealedFieldSession {
    return this.session;
  }

  /** The decision records received so far (receipts, in arrival order). */
  decisions(): readonly GatewayDecisionRecord[] {
    return [...this.receivedDecisions];
  }

  /** The offline queue snapshot (deterministic enqueue order). */
  queueSnapshot(): readonly SealedFieldQueueRecord[] {
    return this.queue.snapshot();
  }

  /** Enqueue a capture intent (idempotent by payload digest). */
  enqueueCapture(capture: SealedFieldCapture, options: EnqueueCaptureOptions): EnqueueResult {
    const verified = verifySealedFieldCapture(capture);
    if (!verified.ok) {
      return verified;
    }
    if (verified.value.tenantId !== this.tenantId) {
      return fieldError({
        code: 'cross-tenant-denied',
        message: `capture "${verified.value.captureId}" belongs to tenant "${verified.value.tenantId}" but this host is scoped to "${this.tenantId}" (R12)`,
        expectedTenantId: this.tenantId,
        encounteredTenantId: verified.value.tenantId,
      });
    }
    if (verified.value.sessionId !== this.session.sessionId) {
      return fieldError({
        code: 'validation',
        message: `capture "${verified.value.captureId}" belongs to session "${verified.value.sessionId}" but the host session is "${this.session.sessionId}"`,
      });
    }
    this.capturePayloads.set(verified.value.contentDigest, verified.value);
    return this.queue.enqueueCapture(verified.value, options);
  }

  /** Enqueue an approval intent (idempotent by payload digest). */
  enqueueApproval(
    proposal: SealedFieldReviewProposal,
    options: EnqueueCaptureOptions,
  ): EnqueueResult {
    const verified = verifySealedFieldReviewProposal(proposal);
    if (!verified.ok) {
      return verified;
    }
    if (verified.value.tenantId !== this.tenantId) {
      return fieldError({
        code: 'cross-tenant-denied',
        message: `review proposal "${verified.value.proposalId}" belongs to tenant "${verified.value.tenantId}" but this host is scoped to "${this.tenantId}" (R12)`,
        expectedTenantId: this.tenantId,
        encounteredTenantId: verified.value.tenantId,
      });
    }
    this.reviewPayloads.set(verified.value.contentDigest, verified.value);
    return this.queue.enqueueApproval(verified.value, options);
  }

  /**
   * One sync sweep: replay every PENDING queue record through its kernel
   * seam, in deterministic enqueue order. Replays are idempotent — an
   * already-replayed record is skipped (its sealed prior state stands).
   */
  syncQueue(options: SyncQueueOptions): MobileFieldResult<SyncResult> {
    const replayed: SyncReplayOutcome[] = [];
    const received: GatewayDecisionRecord[] = [];
    for (const record of this.queue.pending()) {
      if (record.tenantId !== this.tenantId) {
        replayed.push(
          this.reject(record, options.at, {
            code: 'cross-tenant-denied',
            message: `queue record "${record.recordId}" belongs to tenant "${record.tenantId}" but this host is scoped to "${this.tenantId}" (R12)`,
            expectedTenantId: this.tenantId,
            encounteredTenantId: record.tenantId,
          }),
        );
        continue;
      }
      if (record.intent === 'capture-intent') {
        replayed.push(this.replayCapture(record, options));
      } else {
        replayed.push(this.replayApproval(record, options, received));
      }
    }
    return fieldOk({ replayed, delivery: this.delivery, receivedDecisions: received });
  }

  /** Replay one capture intent through the W036 observation-intake seam. */
  private replayCapture(
    record: SealedFieldQueueRecord,
    options: SyncQueueOptions,
  ): SyncReplayOutcome {
    const envelope = this.capturePayloads.get(record.payloadDigest);
    if (envelope === undefined) {
      return this.reject(record, options.at, {
        code: 'validation',
        message: `queue record "${record.recordId}" references capture payload digest ${record.payloadDigest} which this host does not hold`,
      });
    }
    const observation = toObservationRecord(envelope, {
      recordId: envelope.observationId,
      recordedAt: options.at,
      recordedBy: options.performedBy,
    });
    if (!observation.ok) {
      return this.reject(record, options.at, observation.error);
    }
    return this.admitObservation(observation.value, record, options);
  }

  /** The W036 recordObservation seam + the idempotent-prior reconciliation. */
  private admitObservation(
    observation: ObservationRecord,
    record: SealedFieldQueueRecord,
    options: SyncQueueOptions,
  ): SyncReplayOutcome {
    const next = recordObservation(this.delivery, observation);
    if (next.ok) {
      this.delivery = next.value;
      return this.accept(record, options.at, next.value.contentDigest);
    }
    if (next.error.code === 'version-conflict') {
      // Idempotent prior admission: the SAME observation record id with the
      // SAME content digest is already recorded — the sealed prior stands.
      const prior = this.delivery.observations.find(
        (candidate) => candidate.recordId === observation.recordId,
      );
      if (prior !== undefined && prior.contentDigest === observation.contentDigest) {
        return this.accept(record, options.at, this.delivery.contentDigest);
      }
    }
    return this.reject(record, options.at, {
      code: 'gateway-rejected',
      message: `the W036 observation-intake seam rejected the replay of "${record.recordId}": ${next.error.message}`,
    });
  }

  /** Replay one approval intent through the W022 gateway seam. */
  private replayApproval(
    record: SealedFieldQueueRecord,
    options: SyncQueueOptions,
    received: GatewayDecisionRecord[],
  ): SyncReplayOutcome {
    const review = this.reviewPayloads.get(record.payloadDigest);
    if (review === undefined) {
      return this.reject(record, options.at, {
        code: 'validation',
        message: `queue record "${record.recordId}" references review payload digest ${record.payloadDigest} which this host does not hold`,
      });
    }
    if (this.gateway === undefined) {
      // The named negative outcome: there is NO direct-execution path.
      return this.reject(record, options.at, {
        code: 'gateway-bypass-rejected',
        message:
          `approval intent "${record.recordId}" cannot settle without the W022 action-gateway seam — ` +
          'the mobile client holds no credentials and executes nothing (lock rule 3); bind the gateway port',
      });
    }
    // Deterministic W003 message identity from the payload digest.
    const digestPrefix = record.payloadDigest.slice(0, 16);
    const proposal = buildReviewActionProposal(review, {
      proposedBy: this.identity.proposedByAgent,
      messageId: `field-review-${digestPrefix}`,
      proposalId: `field-review-${digestPrefix}`,
      createdAt: options.at,
      requiresHumanApproval: this.identity.requiresHumanApproval,
    });
    if (!proposal.ok) {
      return this.reject(record, options.at, proposal.error);
    }
    const submission = buildFieldReviewSubmission(proposal.value, {
      submissionId: `field-approval:sync-${digestPrefix}`,
      tenantId: record.tenantId,
      sessionId: record.sessionId,
      submittedBy: review.reviewer,
      submittedAt: options.at,
    });
    if (!submission.ok) {
      return this.reject(record, options.at, submission.error);
    }
    const decision = this.gateway.submitFieldReview(submission.value);
    if (!decision.ok) {
      return this.reject(record, options.at, {
        code: 'gateway-rejected',
        message: `the action-gateway seam rejected the review "${record.recordId}" (${decision.error.code}): ${decision.error.message}`,
      });
    }
    this.receivedDecisions.push(decision.value);
    received.push(decision.value);
    return this.accept(record, options.at, decision.value.contentDigest);
  }

  /** Record an admitted replay (immutable queue-record update). */
  private accept(
    record: SealedFieldQueueRecord,
    at: string,
    producedDigest: Sha256Hex,
  ): SyncReplayOutcome {
    const replay: FieldQueueReplay = {
      state: 'admitted',
      replayedAt: at,
      replayDigest: producedDigest,
    };
    const updated = this.queue.replayed(record, replay);
    const next = updated.ok ? updated.value.record : record;
    return { record: next, state: 'admitted', producedDigest };
  }

  /** Record a rejected replay (typed error identity = the error's digest). */
  private reject(
    record: SealedFieldQueueRecord,
    at: string,
    error: MobileFieldError,
  ): SyncReplayOutcome {
    const errorDigest = canonicalDigest(error as unknown as JsonValue);
    const replay: FieldQueueReplay = {
      state: 'rejected',
      replayedAt: at,
      replayDigest: errorDigest,
    };
    const updated = this.queue.replayed(record, replay);
    const next = updated.ok ? updated.value.record : record;
    return { record: next, state: 'rejected', error };
  }
}
