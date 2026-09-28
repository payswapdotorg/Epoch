/**
 * The thin in-memory REFERENCE HOST (the W042 dispatch pin: "a thin
 * in-memory reference host lives INSIDE packages/external-event-bridge
 * as a `runtime` export"): registration, intake, dispatch, receipts,
 * and the derived bridge-state projection; `bridge:*` events
 * W010-shaped; the W009 authorization gate runs BEFORE kernel
 * admission (`authorization-bypass-rejected` / `tenant-isolation-rejected`).
 *
 * The host is deliberately minimal — it coordinates the PURE kernel
 * records; it owns no authority of its own:
 *
 * - registration admits provider ports as sealed, content-addressed
 *   typed records (duplicate registration = the sealed prior record;
 *   the same adapter id with different content = `replay-conflict`);
 * - intake verifies + admits normalized external events
 *   idempotently: a duplicate delivery (the same idempotency key, the
 *   same content) returns the SEALED PRIOR receipt — NEVER a second
 *   effect, never a second event; different content under the same key
 *   is `replay-conflict`; observation-report events produce W036-shaped
 *   observation INTAKE PROPOSALS (the authority path — the bridge
 *   never writes observations);
 * - dispatch verifies the least-privilege projection reference
 *   (defense in depth), resolves providers BY CLASS (canonicalized),
 *   executes the caller-supplied retry schedule (typed DATA — no
 *   timers) recording a content-addressed receipt PER ATTEMPT, and
 *   applies the typed fallback policy (fallback | manual-queue |
 *   alternative-provider) when the class resolution or the delivery
 *   fails; an unresolved request stays explicit (no project truth is
 *   fabricated).
 *
 * In-memory reference behavior only: NO persistence, NO network, NO
 * wall-clock (every instant is caller-supplied), NO randomness.
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  admitBridgeOperation,
  type BridgeAuthorizationAdmission,
} from './authorization';
import {
  buildObservationIntakeProposal,
  verifySealedExternalEvent,
  type ObservationIntakeContext,
  type SealedExternalEvent,
  type SealedObservationIntakeProposal,
} from './inbound';
import {
  LeastPrivilegeProjectionSchema,
  verifyLeastPrivilege,
  verifySealedOutboundRequest,
  type LeastPrivilegeProjection,
  type SealedOutboundRequest,
} from './outbound';
import {
  RetryPolicySchema,
  ProviderFallbackDirectiveSchema,
  sealDeliveryReceipt,
  sealIntakeReceipt,
  sealManualQueueRecord,
  sealProviderUnavailable,
  type ProviderFallbackDirective,
  type RetryPolicy,
  type SealedDeliveryReceipt,
  type SealedIntakeReceipt,
  type SealedManualQueueRecord,
  type SealedProviderUnavailable,
} from './delivery';
import {
  classifyUnavailability,
  deriveProviderRegistrationContent,
  resolveProvidersByClass,
  sameProviderRegistration,
  sealProviderRegistration,
  type ExternalEventProvider,
  type ProviderDispatchRequest,
  type ProviderRegistrationAdmission,
  type SealedProviderRegistration,
} from './provider';
import { sealBridgeEvent, type SealedBridgeEvent } from './events';
import { bridgeStreamIdOf } from './version';
import { classifiedParseError } from './issues';
import type { BridgeResult } from './errors';

// --------------------------------------------------------------------------------
// The runtime options + the authorization pair input.
// --------------------------------------------------------------------------------

/** Options of the {@link ExternalEventBridgeRuntime} constructor. */
export interface ExternalEventBridgeRuntimeOptions {
  /**
   * Tenant this runtime is scoped to. When provided, ANY operation
   * naming a different tenant is rejected with
   * `tenant-isolation-rejected` (R12).
   */
  readonly expectedTenantId?: string | undefined;
}

/** The W009 gate pair every host operation consumes (unparsed inputs). */
export interface BridgeAuthorizationPair {
  readonly request: unknown;
  readonly decision: unknown;
}

// --------------------------------------------------------------------------------
// Id derivation (deterministic, from validated kind-prefixed ids).
// --------------------------------------------------------------------------------

const DERIVED_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** Strip the kind prefix of one validated kind-prefixed id. */
function slugOf(kindPrefixedId: string): string {
  const slug = kindPrefixedId.slice(kindPrefixedId.indexOf(':') + 1);
  if (!DERIVED_SLUG_PATTERN.test(slug)) {
    throw new Error(`cannot derive a slug from "${kindPrefixedId}"`);
  }
  return slug;
}

// --------------------------------------------------------------------------------
// The intake + dispatch outcomes.
// --------------------------------------------------------------------------------

/** One intake admission outcome (a duplicate is a typed fact, never an error). */
export type IntakeOutcome =
  | {
      readonly kind: 'intake-admitted';
      readonly receipt: SealedIntakeReceipt;
      readonly proposal: SealedObservationIntakeProposal | undefined;
    }
  | {
      readonly kind: 'duplicate-intake-returned';
      readonly receipt: SealedIntakeReceipt;
      readonly proposal: SealedObservationIntakeProposal | undefined;
    };

/** The terminal conclusion of one outbound dispatch. */
export type DispatchConclusion =
  | { readonly kind: 'delivered'; readonly receipts: readonly SealedDeliveryReceipt[] }
  | {
      readonly kind: 'fallback-dispatched';
      readonly unavailability: SealedProviderUnavailable | undefined;
      readonly receipts: readonly SealedDeliveryReceipt[];
    }
  | {
      readonly kind: 'manual-queued';
      readonly unavailability: SealedProviderUnavailable | undefined;
      readonly manual: SealedManualQueueRecord;
    }
  | { readonly kind: 'delivery-failed'; readonly receipts: readonly SealedDeliveryReceipt[] }
  | { readonly kind: 'provider-unavailable'; readonly unavailability: SealedProviderUnavailable };

/** The provider-unavailable conclusion variant (narrowed for internal use). */
type UnavailableConclusion = Extract<DispatchConclusion, { kind: 'provider-unavailable' }>;

/** One outbound dispatch outcome (idempotent replay returns the prior conclusion). */
export type OutboundDispatchOutcome =
  | DispatchConclusion
  | { readonly kind: 'duplicate-dispatch-returned'; readonly conclusion: DispatchConclusion };

/** The receipts one conclusion produced (empty for manual/unavailable). */
function receiptsOfConclusion(conclusion: DispatchConclusion): readonly SealedDeliveryReceipt[] {
  if (conclusion.kind === 'delivered' || conclusion.kind === 'delivery-failed') {
    return conclusion.receipts;
  }
  if (conclusion.kind === 'fallback-dispatched') return conclusion.receipts;
  return [];
}

// --------------------------------------------------------------------------------
// The derived bridge-state projection.
// --------------------------------------------------------------------------------

/** One provider view in the derived state projection. */
export interface BridgeProviderView {
  readonly adapterId: string;
  readonly adapterDescriptorDigest: string;
  readonly registrationDigest: string;
  readonly supportedInboundClasses: readonly string[];
  readonly supportedOutboundClasses: readonly string[];
}

/** The derived, deterministic bridge-state projection (sorted, no insertion-order leaks). */
export interface BridgeStateProjection {
  readonly expectedTenantId: string | undefined;
  readonly providerCount: number;
  readonly providers: readonly BridgeProviderView[];
  readonly intakeCount: number;
  readonly proposalCount: number;
  readonly dispatchCount: number;
  readonly receiptCount: number;
  readonly manualQueueCount: number;
  readonly unavailabilityCount: number;
  readonly eventCount: number;
  readonly receiptsByOutcome: readonly { readonly outcome: string; readonly count: number }[];
}

// --------------------------------------------------------------------------------
// The host inputs.
// --------------------------------------------------------------------------------

/** Input of {@link ExternalEventBridgeRuntime.registerProvider}. */
export interface RegisterProviderInput {
  readonly provider: ExternalEventProvider;
  readonly tenantId: string;
  readonly registeredAt: string;
  readonly registeredBy: string;
  readonly authorization: BridgeAuthorizationPair;
}

/** Input of {@link ExternalEventBridgeRuntime.intakeExternalEvent}. */
export interface IntakeExternalEventInput {
  /** The sealed external event (unparsed — verified before admission). */
  readonly event: unknown;
  /** The observation context (observation-report events only). */
  readonly observationContext?: ObservationIntakeContext | undefined;
  readonly receivedAt: string;
  readonly authorization: BridgeAuthorizationPair;
}

/** Input of {@link ExternalEventBridgeRuntime.dispatchOutboundRequest}. */
export interface DispatchOutboundRequestInput {
  /** The sealed outbound request (unparsed — verified before admission). */
  readonly request: unknown;
  /** The least-privilege projection reference (REQUIRED — a missing projection is a violation). */
  readonly projection: unknown;
  /** The retry policy (typed DATA: caller-supplied attempt instants). */
  readonly retryPolicy: unknown;
  /** The typed fallback directive applied when resolution or delivery fails. */
  readonly fallbackPolicy?: unknown | undefined;
  /** A preferred provider (deterministically first when it qualifies). */
  readonly preferredAdapterId?: string | undefined;
  readonly detectedAt: string;
  readonly authorization: BridgeAuthorizationPair;
}

// --------------------------------------------------------------------------------
// The runtime host.
// --------------------------------------------------------------------------------

/** One ledger entry of a completed dispatch (the idempotency index). */
interface DispatchLedgerEntry {
  readonly request: SealedOutboundRequest;
  readonly receipts: readonly SealedDeliveryReceipt[];
  readonly conclusion: DispatchConclusion;
}

/** The reference in-memory bridge host. */
export class ExternalEventBridgeRuntime {
  private readonly expectedTenantId: string | undefined;
  private readonly providers = new Map<
    string,
    { readonly registration: SealedProviderRegistration; readonly port: ExternalEventProvider }
  >();
  private readonly intakes = new Map<
    string,
    {
      readonly receipt: SealedIntakeReceipt;
      readonly proposal: SealedObservationIntakeProposal | undefined;
      readonly event: SealedExternalEvent;
    }
  >();
  private readonly dispatches = new Map<string, DispatchLedgerEntry>();
  private readonly manualQueue: SealedManualQueueRecord[] = [];
  private readonly unavailabilities: SealedProviderUnavailable[] = [];
  private readonly bridgeEvents: SealedBridgeEvent[] = [];
  private readonly streamSequences = new Map<string, number>();

  constructor(options?: ExternalEventBridgeRuntimeOptions) {
    this.expectedTenantId = options?.expectedTenantId;
  }

  // ---- Cross-cutting gates ---------------------------------------------------

  private tenantGate(tenantId: string): BridgeResult<string> {
    if (this.expectedTenantId !== undefined && tenantId !== this.expectedTenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `this bridge runtime is pinned to tenant "${this.expectedTenantId}" — the operation named tenant "${tenantId}"`,
          expectedTenantId: this.expectedTenantId,
          encounteredTenantId: tenantId,
        },
      };
    }
    return { ok: true, value: tenantId };
  }

  private authorizationGate(
    authorization: BridgeAuthorizationPair,
    tenantId: string,
  ): BridgeResult<BridgeAuthorizationAdmission> {
    return admitBridgeOperation({
      request: authorization.request,
      decision: authorization.decision,
      expectedTenantId: tenantId,
    });
  }

  private emitEvent(input: {
    readonly tenantId: string;
    readonly actor: string;
    readonly discriminator: string;
    readonly data: Readonly<Record<string, JsonValue>>;
    readonly occurredAt: string;
  }): void {
    const streamId = bridgeStreamIdOf(input.tenantId);
    const sequence = (this.streamSequences.get(streamId) ?? 0) + 1;
    this.streamSequences.set(streamId, sequence);
    const sealed = sealBridgeEvent({
      schemaVersion: 1,
      streamId,
      sequence,
      tenantId: input.tenantId,
      actor: input.actor,
      causalParent: sequence === 1 ? null : { streamId, sequence: sequence - 1 },
      payload: { discriminator: input.discriminator, data: input.data },
      occurredAt: input.occurredAt,
    });
    if (!sealed.ok) {
      throw new Error(`bridge event emission failed its own admission: ${sealed.error.message}`);
    }
    this.bridgeEvents.push(sealed.value);
  }

  // ---- Provider registration ---------------------------------------------------

  /** Register one provider port as a sealed, content-addressed record. */
  registerProvider(input: RegisterProviderInput): BridgeResult<ProviderRegistrationAdmission> {
    const tenantGate = this.tenantGate(input.tenantId);
    if (!tenantGate.ok) return tenantGate;

    const registrationId = `registration:${slugOf(input.provider.descriptor.adapterId)}`;
    const admission = this.authorizationGate(input.authorization, input.tenantId);
    if (!admission.ok) return admission;

    const content = deriveProviderRegistrationContent(input.provider, {
      registrationId,
      tenantId: input.tenantId,
      registeredAt: input.registeredAt,
      registeredBy: input.registeredBy,
    });
    const sealed = sealProviderRegistration(content);
    if (!sealed.ok) return sealed;

    const adapterId = input.provider.descriptor.adapterId;
    const prior = this.providers.get(adapterId);
    if (prior !== undefined) {
      if (sameProviderRegistration(prior.registration, sealed.value)) {
        return {
          ok: true,
          value: { kind: 'duplicate-registration-returned', registration: prior.registration },
        };
      }
      return {
        ok: false,
        error: {
          code: 'replay-conflict',
          message: `adapter "${adapterId}" is already registered with different content — changed provider surface ships as a NEW registration revision, never a silent rewrite`,
          idempotencyKey: adapterId,
          subject: adapterId,
        },
      };
    }

    this.providers.set(adapterId, { registration: sealed.value, port: input.provider });
    this.emitEvent({
      tenantId: input.tenantId,
      actor: admission.value.request.principalId,
      discriminator: 'bridge:provider-registered',
      data: {
        registrationId,
        adapterId,
        adapterDescriptorDigest: sealed.value.adapterDescriptorDigest,
        capabilityId: sealed.value.capabilityBinding.capabilityId,
        inboundClassCount: sealed.value.supportedInboundClasses.length,
        outboundClassCount: sealed.value.supportedOutboundClasses.length,
      },
      occurredAt: input.registeredAt,
    });
    return { ok: true, value: { kind: 'registration-admitted', registration: sealed.value } };
  }

  // ---- Inbound intake -------------------------------------------------------------

  /** Intake one normalized external event (idempotent; see module docs). */
  intakeExternalEvent(input: IntakeExternalEventInput): BridgeResult<IntakeOutcome> {
    const verified = verifySealedExternalEvent(input.event);
    if (!verified.ok) return verified;
    const event = verified.value;

    const tenantGate = this.tenantGate(event.tenantId);
    if (!tenantGate.ok) return tenantGate;

    const admission = this.authorizationGate(input.authorization, event.tenantId);
    if (!admission.ok) return admission;

    const prior = this.intakes.get(event.idempotencyKey);
    if (prior !== undefined) {
      if (prior.event.contentDigest === event.contentDigest) {
        return {
          ok: true,
          value: {
            kind: 'duplicate-intake-returned',
            receipt: prior.receipt,
            proposal: prior.proposal,
          },
        };
      }
      return {
        ok: false,
        error: {
          code: 'replay-conflict',
          message: `idempotency key "${event.idempotencyKey}" already admitted a DIFFERENT external event — duplicate delivery replays the prior receipt; conflicting content is rejected`,
          idempotencyKey: event.idempotencyKey,
          subject: event.eventId,
        },
      };
    }

    let proposal: SealedObservationIntakeProposal | undefined;
    if (input.observationContext !== undefined) {
      const proposalId = `intake:${slugOf(event.eventId)}`;
      const built = buildObservationIntakeProposal(event, {
        ...input.observationContext,
        proposalId,
      });
      if (!built.ok) return built;
      proposal = built.value;
    }

    const receiptId = `intake-receipt:${slugOf(event.eventId)}`;
    const receipt = sealIntakeReceipt({
      schema: 'epoch.external-event-bridge.intake-receipt',
      schemaVersion: 1,
      receiptId,
      tenantId: event.tenantId,
      eventId: event.eventId,
      eventDigest: event.contentDigest,
      idempotencyKey: event.idempotencyKey,
      disposition: 'admitted',
      proposalDigest: proposal?.contentDigest,
      correlationId: event.correlationId,
      causationId: event.causationId,
      receivedAt: input.receivedAt,
    });
    if (!receipt.ok) return receipt;

    this.intakes.set(event.idempotencyKey, { receipt: receipt.value, proposal, event });
    this.emitEvent({
      tenantId: event.tenantId,
      actor: admission.value.request.principalId,
      discriminator: 'bridge:event-received',
      data: {
        eventId: event.eventId,
        eventClass: event.eventClass,
        eventDigest: event.contentDigest,
        idempotencyKey: event.idempotencyKey,
        sourceAdapterId: event.source.adapterId,
      },
      occurredAt: input.receivedAt,
    });
    if (proposal !== undefined) {
      this.emitEvent({
        tenantId: event.tenantId,
        actor: admission.value.request.principalId,
        discriminator: 'bridge:intake-proposed',
        data: {
          proposalId: proposal.proposalId,
          sourceEventId: proposal.sourceEventId,
          proposalDigest: proposal.contentDigest,
          correlationId: proposal.correlationId,
        },
        occurredAt: proposal.proposedAt,
      });
    }
    return { ok: true, value: { kind: 'intake-admitted', receipt: receipt.value, proposal } };
  }

  // ---- Outbound dispatch ------------------------------------------------------------

  /** Dispatch one outbound request (idempotent; see module docs). */
  dispatchOutboundRequest(
    input: DispatchOutboundRequestInput,
  ): BridgeResult<OutboundDispatchOutcome> {
    const verifiedRequest = verifySealedOutboundRequest(input.request);
    if (!verifiedRequest.ok) return verifiedRequest;
    const request = verifiedRequest.value;

    const tenantGate = this.tenantGate(request.tenantId);
    if (!tenantGate.ok) return tenantGate;

    const admission = this.authorizationGate(input.authorization, request.tenantId);
    if (!admission.ok) return admission;

    // ---- The least-privilege gate (projection REQUIRED; defense in depth).
    const parsedProjection = LeastPrivilegeProjectionSchema.safeParse(input.projection);
    if (!parsedProjection.success) {
      return {
        ok: false,
        error: {
          code: 'least-privilege-violation-rejected',
          message:
            'the dispatch carries no verifiable least-privilege projection reference — an unfiltered send is rejected (the W041 projection-policy reference decides what a recipient may see)',
          reason: 'projection-missing',
        },
      };
    }
    const projection: LeastPrivilegeProjection = parsedProjection.data;
    if (request.projectionDigest !== projection.policyDigest) {
      return {
        ok: false,
        error: {
          code: 'least-privilege-violation-rejected',
          message: `the request cites projection-policy digest "${request.projectionDigest}" but the dispatch supplies "${projection.policyDigest}" — a request is dispatched only under the policy it was filtered by`,
          reason: 'policy-digest-mismatch',
        },
      };
    }
    const privilegeCheck = verifyLeastPrivilege(request.payload, projection);
    if (!privilegeCheck.ok) return privilegeCheck;

    // ---- Idempotency (duplicate delivery = the prior conclusion, no second effect).
    const prior = this.dispatches.get(request.idempotencyKey);
    if (prior !== undefined) {
      if (prior.request.contentDigest === request.contentDigest) {
        return {
          ok: true,
          value: { kind: 'duplicate-dispatch-returned', conclusion: prior.conclusion },
        };
      }
      return {
        ok: false,
        error: {
          code: 'replay-conflict',
          message: `idempotency key "${request.idempotencyKey}" already dispatched a DIFFERENT request — duplicate delivery replays the prior receipts; conflicting content is rejected`,
          idempotencyKey: request.idempotencyKey,
          subject: request.requestId,
        },
      };
    }

    const parsedRetry = RetryPolicySchema.safeParse(input.retryPolicy);
    if (!parsedRetry.success) {
      return { ok: false, error: classifiedParseError(parsedRetry.error) };
    }
    const retryPolicy: RetryPolicy = parsedRetry.data;
    let fallbackPolicy: ProviderFallbackDirective | undefined;
    if (input.fallbackPolicy !== undefined) {
      const parsedFallback = ProviderFallbackDirectiveSchema.safeParse(input.fallbackPolicy);
      if (!parsedFallback.success) {
        return { ok: false, error: classifiedParseError(parsedFallback.error) };
      }
      fallbackPolicy = parsedFallback.data;
    }

    const registrations = [...this.providers.values()].map((entry) => entry.registration);
    const candidates = resolveProvidersByClass({
      registrations,
      requestClass: request.requestClass,
      preferredAdapterId: input.preferredAdapterId,
    });

    // ---- Resolution failure: the typed provider-unavailable record + fallback.
    if (candidates.length === 0) {
      const reason = classifyUnavailability(
        registrations,
        request.requestClass,
        input.preferredAdapterId,
      );
      return this.handleResolutionFailure(request, reason, fallbackPolicy, input, admission.value, retryPolicy);
    }

    // ---- Delivery through the first candidate (the retry schedule as DATA).
    const primary = candidates[0]!;
    const primaryReceipts = this.executeAttempts(request, primary, retryPolicy, input, admission.value);
    this.emitDispatched(request, primary, retryPolicy, input, admission.value);
    const primaryDelivered =
      primaryReceipts.length > 0 && primaryReceipts[primaryReceipts.length - 1]!.outcome === 'success';
    if (primaryDelivered) {
      const conclusion: DispatchConclusion = { kind: 'delivered', receipts: primaryReceipts };
      this.dispatches.set(request.idempotencyKey, {
        request,
        receipts: primaryReceipts,
        conclusion,
      });
      return { ok: true, value: conclusion };
    }

    // ---- Delivery failure: the fallback policy (or the explicit failure).
    if (fallbackPolicy === undefined) {
      const conclusion: DispatchConclusion = { kind: 'delivery-failed', receipts: primaryReceipts };
      this.dispatches.set(request.idempotencyKey, { request, receipts: primaryReceipts, conclusion });
      return { ok: true, value: conclusion };
    }
    const conclusion = this.applyFallback(
      request,
      primary,
      fallbackPolicy,
      retryPolicy,
      input,
      admission.value,
    );
    this.dispatches.set(request.idempotencyKey, {
      request,
      receipts: receiptsOfConclusion(conclusion),
      conclusion,
    });
    return { ok: true, value: conclusion };
  }

  // ---- Internals: delivery, fallback, unavailability ------------------------------

  private dispatchViewOf(request: SealedOutboundRequest): ProviderDispatchRequest {
    return {
      requestId: request.requestId,
      tenantId: request.tenantId,
      requestClass: request.requestClass,
      recipientRef: request.recipientRef,
      correlationId: request.correlationId,
      causationId: request.causationId,
      payload: request.payload,
      projectionDigest: request.projectionDigest,
    };
  }

  private executeAttempts(
    request: SealedOutboundRequest,
    registration: SealedProviderRegistration,
    retryPolicy: RetryPolicy,
    input: DispatchOutboundRequestInput,
    admission: BridgeAuthorizationAdmission,
  ): readonly SealedDeliveryReceipt[] {
    const port = this.providers.get(registration.adapterDescriptor.adapterId)!.port;
    const dispatchView = this.dispatchViewOf(request);
    const receipts: SealedDeliveryReceipt[] = [];
    const requestSlug = slugOf(request.requestId);
    for (let index = 0; index < retryPolicy.attemptInstants.length; index += 1) {
      const attemptNo = index + 1;
      const scheduledAt = retryPolicy.attemptInstants[index]!;
      const outcome = port.deliver(dispatchView, { attemptNo, scheduledAt });
      const receipt = sealDeliveryReceipt({
        schema: 'epoch.external-event-bridge.delivery-receipt',
        schemaVersion: 1,
        receiptId: `receipt:${requestSlug}-attempt-${attemptNo}`,
        tenantId: request.tenantId,
        requestId: request.requestId,
        requestClass: request.requestClass,
        attemptNo,
        scheduledAt,
        outcome: outcome.outcome,
        providerAdapterId: registration.adapterDescriptor.adapterId,
        providerDeliveryRef: outcome.outcome === 'success' ? outcome.providerDeliveryRef : undefined,
        correlationId: request.correlationId,
        causationId: request.causationId,
        detail: outcome.outcome === 'success' ? undefined : outcome.detail,
      });
      if (!receipt.ok) {
        throw new Error(`delivery receipt failed its own admission: ${receipt.error.message}`);
      }
      receipts.push(receipt.value);
      this.emitEvent({
        tenantId: request.tenantId,
        actor: admission.request.principalId,
        discriminator: 'bridge:receipt-recorded',
        data: {
          receiptId: receipt.value.receiptId,
          requestId: receipt.value.requestId,
          attemptNo: receipt.value.attemptNo,
          outcome: receipt.value.outcome,
          providerAdapterId: receipt.value.providerAdapterId,
          receiptDigest: receipt.value.contentDigest,
        },
        occurredAt: scheduledAt,
      });
      if (outcome.outcome !== 'retryable') break;
    }
    return receipts;
  }

  private emitDispatched(
    request: SealedOutboundRequest,
    registration: SealedProviderRegistration,
    retryPolicy: RetryPolicy,
    input: DispatchOutboundRequestInput,
    admission: BridgeAuthorizationAdmission,
  ): void {
    this.emitEvent({
      tenantId: request.tenantId,
      actor: admission.request.principalId,
      discriminator: 'bridge:request-dispatched',
      data: {
        requestId: request.requestId,
        requestClass: request.requestClass,
        recipientRef: request.recipientRef,
        providerAdapterId: registration.adapterDescriptor.adapterId,
        projectionDigest: request.projectionDigest,
        idempotencyKey: request.idempotencyKey,
        attemptCount: retryPolicy.attemptInstants.length,
      },
      occurredAt: input.detectedAt,
    });
  }

  private buildUnavailability(
    request: SealedOutboundRequest,
    reason: string,
    candidateAdapterIds: readonly string[],
    preferredAdapterId: string | undefined,
    fallbackMode: string | undefined,
    detectedAt: string,
  ): BridgeResult<SealedProviderUnavailable> {
    return sealProviderUnavailable({
      schema: 'epoch.external-event-bridge.provider-unavailable',
      schemaVersion: 1,
      tenantId: request.tenantId,
      requestId: request.requestId,
      requestClass: request.requestClass,
      reason,
      candidateAdapterIds: [...candidateAdapterIds].sort(),
      preferredAdapterId,
      fallbackMode,
      detectedAt,
    });
  }

  private providerUnavailableConclusion(
    request: SealedOutboundRequest,
    reason: string,
    candidateAdapterIds: readonly string[],
    preferredAdapterId: string | undefined,
    fallbackMode: string | undefined,
    input: DispatchOutboundRequestInput,
    admission: BridgeAuthorizationAdmission,
  ): BridgeResult<UnavailableConclusion> {
    const unavailability = this.buildUnavailability(
      request,
      reason,
      candidateAdapterIds,
      preferredAdapterId,
      fallbackMode,
      input.detectedAt,
    );
    if (!unavailability.ok) return unavailability;
    this.unavailabilities.push(unavailability.value);
    this.emitEvent({
      tenantId: request.tenantId,
      actor: admission.request.principalId,
      discriminator: 'bridge:provider-unavailable',
      data: {
        requestId: request.requestId,
        requestClass: request.requestClass,
        reason,
        candidateAdapterIds: [...candidateAdapterIds].sort(),
        fallbackMode: fallbackMode ?? 'none',
      },
      occurredAt: input.detectedAt,
    });
    return { ok: true, value: { kind: 'provider-unavailable', unavailability: unavailability.value } };
  }

  private handleResolutionFailure(
    request: SealedOutboundRequest,
    reason: 'no-provider-registered' | 'provider-lacks-class' | 'preferred-provider-unregistered',
    fallbackPolicy: ProviderFallbackDirective | undefined,
    input: DispatchOutboundRequestInput,
    admission: BridgeAuthorizationAdmission,
    retryPolicy: RetryPolicy,
  ): BridgeResult<OutboundDispatchOutcome> {
    const registrations = [...this.providers.values()].map((entry) => entry.registration);
    const candidateIds = resolveProvidersByClass({
      registrations,
      requestClass: request.requestClass,
    }).map((candidate) => candidate.adapterDescriptor.adapterId);

    const initial = this.providerUnavailableConclusion(
      request,
      reason,
      candidateIds,
      input.preferredAdapterId,
      fallbackPolicy?.mode,
      input,
      admission,
    );
    if (!initial.ok) return initial;

    if (fallbackPolicy === undefined) {
      const conclusion = initial.value;
      this.dispatches.set(request.idempotencyKey, { request, receipts: [], conclusion });
      return { ok: true, value: conclusion };
    }

    if (fallbackPolicy.mode === 'manual-queue') {
      return this.enqueueManual(request, initial.value.unavailability, 'provider-unavailable', input, admission);
    }

    if (fallbackPolicy.mode === 'fallback') {
      const target = this.providers.get(fallbackPolicy.fallbackAdapterId);
      const failureReason =
        target === undefined
          ? 'fallback-provider-unregistered'
          : target.registration.supportedOutboundClasses.includes(request.requestClass)
            ? undefined
            : 'fallback-provider-lacks-class';
      if (target === undefined || failureReason !== undefined) {
        const refined = this.providerUnavailableConclusion(
          request,
          failureReason!,
          candidateIds,
          input.preferredAdapterId,
          fallbackPolicy.mode,
          input,
          admission,
        );
        if (!refined.ok) return refined;
        const conclusion = refined.value;
        this.dispatches.set(request.idempotencyKey, { request, receipts: [], conclusion });
        return { ok: true, value: conclusion };
      }
      // The designated fallback provider satisfies the SAME class contract.
      const receipts = this.executeAttempts(request, target.registration, retryPolicy, input, admission);
      this.emitEvent({
        tenantId: request.tenantId,
        actor: admission.request.principalId,
        discriminator: 'bridge:fallback-applied',
        data: {
          requestId: request.requestId,
          requestClass: request.requestClass,
          mode: 'fallback',
          fromAdapterId: 'none',
          toAdapterId: target.registration.adapterDescriptor.adapterId,
        },
        occurredAt: input.detectedAt,
      });
      const conclusion: DispatchConclusion = {
        kind: 'fallback-dispatched',
        unavailability: initial.value.unavailability,
        receipts,
      };
      this.dispatches.set(request.idempotencyKey, {
        request,
        receipts: receiptsOfConclusion(conclusion),
        conclusion,
      });
      return { ok: true, value: conclusion };
    }

    // alternative-provider with an empty candidate set cannot resolve.
    const refined = this.providerUnavailableConclusion(
      request,
      'no-alternative-provider',
      candidateIds,
      input.preferredAdapterId,
      fallbackPolicy.mode,
      input,
      admission,
    );
    if (!refined.ok) return refined;
    const conclusion = refined.value;
    this.dispatches.set(request.idempotencyKey, { request, receipts: [], conclusion });
    return { ok: true, value: conclusion };
  }

  private applyFallback(
    request: SealedOutboundRequest,
    failed: SealedProviderRegistration,
    fallbackPolicy: ProviderFallbackDirective,
    retryPolicy: RetryPolicy,
    input: DispatchOutboundRequestInput,
    admission: BridgeAuthorizationAdmission,
  ): DispatchConclusion {
    const failedId = failed.adapterDescriptor.adapterId;

    if (fallbackPolicy.mode === 'manual-queue') {
      // The manual record itself carries the terminal-failure reason; no
      // class-resolution unavailability record is minted on this path.
      const queued = this.enqueueManual(request, undefined, 'delivery-terminal', input, admission);
      if (queued.ok) return queued.value as DispatchConclusion;
      return { kind: 'delivery-failed', receipts: [] };
    }

    if (fallbackPolicy.mode === 'fallback') {
      const target = this.providers.get(fallbackPolicy.fallbackAdapterId);
      if (
        target === undefined ||
        !target.registration.supportedOutboundClasses.includes(request.requestClass)
      ) {
        return { kind: 'delivery-failed', receipts: [] };
      }
      const receipts = this.executeAttempts(request, target.registration, retryPolicy, input, admission);
      this.emitEvent({
        tenantId: request.tenantId,
        actor: admission.request.principalId,
        discriminator: 'bridge:fallback-applied',
        data: {
          requestId: request.requestId,
          requestClass: request.requestClass,
          mode: 'fallback',
          fromAdapterId: failedId,
          toAdapterId: target.registration.adapterDescriptor.adapterId,
        },
        occurredAt: input.detectedAt,
      });
      return { kind: 'fallback-dispatched', unavailability: undefined, receipts };
    }

    // alternative-provider: the next provider of the same class.
    const registrations = [...this.providers.values()].map((entry) => entry.registration);
    const alternatives = resolveProvidersByClass({
      registrations,
      requestClass: request.requestClass,
      excludeAdapterIds: [failedId, ...fallbackPolicy.excludeAdapterIds],
    });
    if (alternatives.length === 0) {
      const unavailability = this.buildUnavailability(
        request,
        'no-alternative-provider',
        [failedId],
        input.preferredAdapterId,
        fallbackPolicy.mode,
        input.detectedAt,
      );
      if (unavailability.ok) {
        this.unavailabilities.push(unavailability.value);
        this.emitEvent({
          tenantId: request.tenantId,
          actor: admission.request.principalId,
          discriminator: 'bridge:provider-unavailable',
          data: {
            requestId: request.requestId,
            requestClass: request.requestClass,
            reason: 'no-alternative-provider',
            candidateAdapterIds: [failedId],
            fallbackMode: fallbackPolicy.mode,
          },
          occurredAt: input.detectedAt,
        });
        return { kind: 'provider-unavailable', unavailability: unavailability.value };
      }
      return { kind: 'delivery-failed', receipts: [] };
    }
    const alternative = alternatives[0]!;
    const receipts = this.executeAttempts(request, alternative, retryPolicy, input, admission);
    this.emitEvent({
      tenantId: request.tenantId,
      actor: admission.request.principalId,
      discriminator: 'bridge:fallback-applied',
      data: {
        requestId: request.requestId,
        requestClass: request.requestClass,
        mode: 'alternative-provider',
        fromAdapterId: failedId,
        toAdapterId: alternative.adapterDescriptor.adapterId,
      },
      occurredAt: input.detectedAt,
    });
    return { kind: 'fallback-dispatched', unavailability: undefined, receipts };
  }

  private enqueueManual(
    request: SealedOutboundRequest,
    unavailability: SealedProviderUnavailable | undefined,
    reason: 'provider-unavailable' | 'delivery-terminal',
    input: DispatchOutboundRequestInput,
    admission: BridgeAuthorizationAdmission,
  ): BridgeResult<OutboundDispatchOutcome> {
    const recordId = `manual:${slugOf(request.requestId)}`;
    const sealed = sealManualQueueRecord({
      schema: 'epoch.external-event-bridge.manual-queue',
      schemaVersion: 1,
      recordId,
      tenantId: request.tenantId,
      requestId: request.requestId,
      requestClass: request.requestClass,
      recipientRef: request.recipientRef,
      correlationId: request.correlationId,
      causationId: request.causationId,
      requestDigest: request.contentDigest,
      reason,
      unavailabilityDigest: unavailability?.contentDigest,
      resolution: 'pending',
      queuedAt: input.detectedAt,
      queuedBy: admission.request.principalId,
    });
    if (!sealed.ok) return sealed;
    this.manualQueue.push(sealed.value);
    this.emitEvent({
      tenantId: request.tenantId,
      actor: admission.request.principalId,
      discriminator: 'bridge:manual-queued',
      data: {
        recordId,
        requestId: request.requestId,
        requestClass: request.requestClass,
        recordDigest: sealed.value.contentDigest,
        reason,
      },
      occurredAt: input.detectedAt,
    });
    const conclusion: DispatchConclusion = { kind: 'manual-queued', unavailability, manual: sealed.value };
    this.dispatches.set(request.idempotencyKey, { request, receipts: [], conclusion });
    return { ok: true, value: conclusion };
  }

  // ---- The derived state projection ------------------------------------------------

  /** The derived bridge-state projection (deterministic, sorted). */
  state(): BridgeStateProjection {
    const providers: BridgeProviderView[] = [...this.providers.values()]
      .map((entry) => ({
        adapterId: entry.registration.adapterDescriptor.adapterId,
        adapterDescriptorDigest: entry.registration.adapterDescriptorDigest,
        registrationDigest: entry.registration.contentDigest,
        supportedInboundClasses: entry.registration.supportedInboundClasses,
        supportedOutboundClasses: entry.registration.supportedOutboundClasses,
      }))
      .sort((a, b) => (a.adapterId < b.adapterId ? -1 : a.adapterId > b.adapterId ? 1 : 0));

    let proposalCount = 0;
    for (const entry of this.intakes.values()) {
      if (entry.proposal !== undefined) proposalCount += 1;
    }
    const outcomeCounts = new Map<string, number>();
    for (const entry of this.dispatches.values()) {
      for (const receipt of entry.receipts) {
        outcomeCounts.set(receipt.outcome, (outcomeCounts.get(receipt.outcome) ?? 0) + 1);
      }
    }
    const receiptsByOutcome = [...outcomeCounts.entries()]
      .map(([outcome, count]) => ({ outcome, count }))
      .sort((a, b) => (a.outcome < b.outcome ? -1 : a.outcome > b.outcome ? 1 : 0));
    const receiptCount = [...outcomeCounts.values()].reduce((sum, count) => sum + count, 0);

    return {
      expectedTenantId: this.expectedTenantId,
      providerCount: providers.length,
      providers,
      intakeCount: this.intakes.size,
      proposalCount,
      dispatchCount: this.dispatches.size,
      receiptCount,
      manualQueueCount: this.manualQueue.length,
      unavailabilityCount: this.unavailabilities.length,
      eventCount: this.bridgeEvents.length,
      receiptsByOutcome,
    };
  }

  /** The recorded bridge:* events (append order; W010-shaped facts). */
  recordedEvents(): readonly SealedBridgeEvent[] {
    return [...this.bridgeEvents];
  }

  /** The recorded manual-queue records (append order). */
  manualQueueRecords(): readonly SealedManualQueueRecord[] {
    return [...this.manualQueue];
  }

  /** The recorded provider-unavailability records (append order). */
  unavailabilityRecords(): readonly SealedProviderUnavailable[] {
    return [...this.unavailabilities];
  }
}

/** The content digest of one bridge-state projection (content addressing). */
export function bridgeStateDigestOf(state: BridgeStateProjection): Sha256Hex {
  return canonicalDigest(state as unknown as JsonValue);
}
