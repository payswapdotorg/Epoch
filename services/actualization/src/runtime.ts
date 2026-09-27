/**
 * The reference actualization runtime host (W039): the thin typed HOST
 * FACADE over the @epoch/actualization + @epoch/variance kernels.
 *
 * Owns (and only owns): tenant-scoped delivery-record registration
 * (idempotent by digest), the observation intake — direct or through
 * the ObservationSourcePort adapter seam (ONE in-memory reference
 * adapter; the core never names a vendor) — with IDEMPOTENT replay,
 * typed validation assessment + conflict-resolution admission,
 * actualization application EXCLUSIVELY through the W036 DeliveryRecord
 * authority path (recordObservation -> acceptObservation ->
 * actualizeObservation — never a direct actual write), variance
 * computation + evidence-grounded root-cause attribution, rolling
 * forecast revision emission (append-only W036 Forecast-distinction
 * records refining earlier forecasts only), immutable comparison-fact
 * admission with calibration folds, and the derived actualization-state
 * projection. Every step emits `actualization:*` events on the affected
 * delivery's stream (`stream:actualization-<suffix>`, one stream per
 * delivery, digests sealed by the kernel and pinned by REAL sealEvent
 * parity tests).
 *
 * Explicitly NOT (later Work Orders / out of scope): durable persistence,
 * real observation-source integrations (adapters of
 * ObservationSourcePort), the supervision/alerting layer (W043), the
 * external event bridge (W042).
 *
 * Determinism: ZERO wall-clock reads and ZERO randomness — every instant
 * is caller-supplied; every listing/snapshot is sorted (no
 * insertion-order leaks); two runtimes fed the same operations hold
 * byte-identical state.
 *
 * Tenant isolation (R12): all state is tenant-scoped; cross-tenant
 * operations are typed `tenant-isolation-rejected`. The host may be
 * pinned to one tenant (`expectedTenantId`, the single-tenant guard
 * precedent).
 */
import {
  AUTHORIZATION_RECORD_VERSION,
  evaluate,
  parseAuthorizationContext,
} from '@epoch/authorization';
import type { AuthorizationDecision } from '@epoch/authorization';
import {
  actualizationStreamIdOf,
  admitComparisonFact,
  admitConflictResolution,
  admitForecastRevision,
  applyActualization,
  currentAssessments,
  foldCalibration,
  intakeObservation,
  mapDeliveryError,
  openActualizationStore,
  projectActualizationState,
  rollForecast,
  sealActualizationEvent,
  verifySealedDeliveryRecord,
  type ActualizationStore,
  type DistinctionLedger,
  type ReconciliationApplication,
  type ReconciliationPolicy,
  type RollingForecastDetail,
  type SealedActualizationEvent,
} from '@epoch/actualization';
import type { ActualizationError, ObservationIntakeOutcome } from '@epoch/actualization';
import {
  admitAttributionRecord,
  admitVarianceRecord,
  computeVariance,
  foldVarianceRecords,
  foldVarianceSummary,
  openAttributionLedger,
  openVarianceLedger,
  requireAttributionEvidence,
  sealAttributionRecord,
  type AttributionLedger,
  type BandThresholds,
  type CauseRef,
  type VarianceLedger,
} from '@epoch/variance';
import type {
  SealedDeliveryRecord,
  SealedDistinctionRecord,
} from '@epoch/solution-delivery';
import { RUNTIME_RECORD_VERSION } from './version';
import { InMemoryObservationSourceAdapter } from './observation-port';
import type {
  ActualizationServiceResult,
  ActualizationRuntimeOptions,
  AuthorizationInput,
  ObservationPollOutcome,
  ObservationSourcePort,
  RuntimeHealth,
  VarianceComputationOutcome,
} from './types';

/** Event payload data (the JSON value space the kernel payload accepts). */
type EventData = Record<string, string | number | boolean | null | readonly string[]>;

/** Deterministic composite key: `<tenantId>#<deliveryId>`. */
function tenantKey(tenantId: string, deliveryId: string): string {
  return `${tenantId}#${deliveryId}`;
}

/** One hosted delivery: the registered W036 delivery state + the actualization store. */
interface DeliveryEntry {
  readonly tenantId: string;
  readonly solutionId: string;
  delivery: SealedDeliveryRecord;
  store: ActualizationStore;
}

/** One hosted solution scope: the variance + attribution + forecast ledgers. */
interface VarianceEntry {
  readonly tenantId: string;
  readonly solutionId: string;
  varianceLedger: VarianceLedger;
  attributionLedger: AttributionLedger;
  /** The admitted rolling-forecast revisions (a growing W036 DistinctionLedger). */
  forecastLedger: DistinctionLedger;
}

/**
 * The reference actualization runtime host. Construct directly (the
 * in-memory ObservationSourcePort reference adapter is the default).
 * In-memory only: no persistence, no network, no clocks.
 */
export class ActualizationRuntime {
  /** tenantId#deliveryId -> delivery entry. Maps iterate in insertion order; every read path sorts. */
  private readonly deliveries = new Map<string, DeliveryEntry>();

  /** tenantId#solutionId -> variance entry. */
  private readonly variances = new Map<string, VarianceEntry>();

  /** stream:actualization-<suffix> -> events (append-only). */
  private readonly streams = new Map<string, SealedActualizationEvent[]>();

  private readonly observationSourcePort: ObservationSourcePort;

  private readonly expectedTenantId: string | undefined;

  constructor(options: ActualizationRuntimeOptions = {}) {
    this.expectedTenantId = options.expectedTenantId;
    this.observationSourcePort = options.observationSourcePort ?? new InMemoryObservationSourceAdapter();
  }

  // --------------------------------------------------------------------------------
  // The authorization gate (W009 — the W022/W037/W038 pattern).
  // --------------------------------------------------------------------------------

  private authorizationGate(
    operation: string,
    tenantId: string,
    authorization: AuthorizationInput,
    resourceId: string,
    resourceType: string,
  ): ActualizationServiceResult<{ principalId: string }> {
    const context = parseAuthorizationContext(authorization.context);
    if (!context.ok) {
      return { ok: false, error: context.error as ActualizationError };
    }
    const request = {
      schemaVersion: AUTHORIZATION_RECORD_VERSION,
      principalId: authorization.principalId,
      actionKind: `actualization.${operation}`,
      resource: { resourceType, resourceId, tenantId },
      ...(authorization.justification !== undefined
        ? { justification: authorization.justification }
        : {}),
    };
    const decision = evaluate(request, context.value);
    if (!decision.ok) {
      return { ok: false, error: decision.error as ActualizationError };
    }
    const value: AuthorizationDecision = decision.value;
    if (value.outcome === 'deny') {
      return {
        ok: false,
        error: {
          code: 'authorization-rejected',
          message: `principal "${authorization.principalId}" is not authorized for actualization.${operation} (${value.denial.code}): ${value.denial.message}`,
          denialCode: value.denial.code,
          principalId: authorization.principalId,
          operation,
        },
      };
    }
    if (value.outcome === 'not-applicable') {
      return {
        ok: false,
        error: {
          code: 'authorization-rejected',
          message: `the authorization decision point is not applicable to this request (${value.reason}) — intake is tenant-scoped, so this is a fail-closed rejection`,
          denialCode: value.reason,
          principalId: authorization.principalId,
          operation,
        },
      };
    }
    return { ok: true, value: { principalId: authorization.principalId } };
  }

  private tenantGuard(tenantId: string): ActualizationServiceResult<null> {
    if (this.expectedTenantId !== undefined && tenantId !== this.expectedTenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `this actualization host is scoped to tenant "${this.expectedTenantId}" — operations for tenant "${tenantId}" are rejected (R12 tenant isolation)`,
          expectedTenantId: this.expectedTenantId,
          encounteredTenantId: tenantId,
          subject: tenantId,
        },
      };
    }
    return { ok: true, value: null };
  }

  // --------------------------------------------------------------------------------
  // The event emission (W010-shaped, kernel-sealed; one stream per delivery).
  // --------------------------------------------------------------------------------

  private emitEvent(
    tenantId: string,
    deliveryId: string,
    actor: string,
    occurredAt: string,
    payload: { readonly discriminator: string; readonly data: EventData },
  ): ActualizationServiceResult<SealedActualizationEvent> {
    const streamId = actualizationStreamIdOf(deliveryId);
    const events = this.streams.get(streamId) ?? [];
    const event = sealActualizationEvent({
      schemaVersion: 1,
      streamId,
      sequence: events.length + 1,
      tenantId,
      actor,
      causalParent:
        events.length > 0 ? { streamId, sequence: events[events.length - 1]!.sequence } : null,
      payload,
      occurredAt,
    });
    if (!event.ok) {
      return event;
    }
    this.streams.set(streamId, [...events, event.value]);
    return { ok: true, value: event.value };
  }

  /** The sealed event stream of one delivery (sorted by sequence — append-only). */
  eventStream(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly deliveryId: string;
  }): ActualizationServiceResult<readonly SealedActualizationEvent[]> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'read',
      options.tenantId,
      options.authorization,
      options.deliveryId,
      'actualization-delivery',
    );
    if (!gate.ok) return gate;
    const entry = this.deliveries.get(tenantKey(options.tenantId, options.deliveryId));
    if (entry === undefined) {
      return {
        ok: false,
        error: {
          code: 'unknown-delivery',
          message: `delivery "${options.deliveryId}" is not registered with this host`,
          deliveryId: options.deliveryId,
        },
      };
    }
    const streamId = actualizationStreamIdOf(options.deliveryId);
    return { ok: true, value: [...(this.streams.get(streamId) ?? [])] };
  }

  // --------------------------------------------------------------------------------
  // Delivery registration (the authority state input; idempotent by digest).
  // --------------------------------------------------------------------------------

  /**
   * Register the sealed W036 DeliveryRecord (the authority state the
   * actualization store folds toward): verifies the record (digest
   * recomputation), opens the tenant's actualization store, and emits
   * the derived state-projection event. Idempotent by digest.
   */
  registerDeliveryRecord(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly delivery: SealedDeliveryRecord;
  }): ActualizationServiceResult<SealedDeliveryRecord> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'register',
      options.tenantId,
      options.authorization,
      options.delivery.deliveryId,
      'actualization-delivery',
    );
    if (!gate.ok) return gate;
    const verified = verifySealedDeliveryRecord(options.delivery);
    if (!verified.ok) {
      return { ok: false, error: mapDeliveryError(verified.error, options.delivery.deliveryId) };
    }
    const delivery = verified.value;
    if (delivery.tenantId !== options.tenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `delivery "${delivery.deliveryId}" belongs to tenant "${delivery.tenantId}" — it cannot be hosted for tenant "${options.tenantId}" (R12 tenant isolation)`,
          expectedTenantId: options.tenantId,
          encounteredTenantId: delivery.tenantId,
          subject: delivery.deliveryId,
        },
      };
    }
    const key = tenantKey(options.tenantId, delivery.deliveryId);
    const existing = this.deliveries.get(key);
    if (existing !== undefined) {
      // The hosted delivery state advances ONLY through the W036
      // authority path applied by this host — a different externally
      // registered state is a typed conflict.
      if (existing.delivery.contentDigest === delivery.contentDigest) {
        return { ok: true, value: existing.delivery };
      }
      return {
        ok: false,
        error: {
          code: 'version-conflict',
          message: `delivery "${delivery.deliveryId}" is already hosted with different state — deliveries advance through the W036 authority path applied by this host only`,
          subject: 'delivery-record',
          subjectId: delivery.deliveryId,
          publishedDigest: existing.delivery.contentDigest,
          encounteredDigest: delivery.contentDigest,
        },
      };
    }
    const store = openActualizationStore({
      tenantId: options.tenantId,
      solutionId: delivery.solutionId,
      deliveryId: delivery.deliveryId,
    });
    const entry: DeliveryEntry = {
      tenantId: options.tenantId,
      solutionId: delivery.solutionId,
      delivery,
      store,
    };
    this.deliveries.set(key, entry);
    const event = this.emitEvent(
      options.tenantId,
      delivery.deliveryId,
      gate.value.principalId,
      delivery.openedAt,
      {
        discriminator: 'actualization:state-projected',
        data: {
          deliveryId: delivery.deliveryId,
          deliveryDigest: delivery.contentDigest,
          observationCount: 0,
          actualCount: 0,
          groupCount: 0,
          projectedAt: delivery.openedAt,
        },
      },
    );
    if (!event.ok) return event;
    return { ok: true, value: delivery };
  }

  /** The hosted delivery entry (typed unknown-delivery guard). */
  private deliveryEntry(tenantId: string, deliveryId: string): ActualizationServiceResult<DeliveryEntry> {
    const entry = this.deliveries.get(tenantKey(tenantId, deliveryId));
    if (entry === undefined) {
      return {
        ok: false,
        error: {
          code: 'unknown-delivery',
          message: `delivery "${deliveryId}" is not registered with this host`,
          deliveryId,
        },
      };
    }
    return { ok: true, value: entry };
  }

  /** The hosted variance entry of one (tenant, solution) scope (lazily opened). */
  private varianceEntry(tenantId: string, solutionId: string): VarianceEntry {
    const key = tenantKey(tenantId, solutionId);
    const existing = this.variances.get(key);
    if (existing !== undefined) {
      return existing;
    }
    const entry: VarianceEntry = {
      tenantId,
      solutionId,
      varianceLedger: openVarianceLedger({ tenantId, solutionId }),
      attributionLedger: openAttributionLedger({ tenantId, solutionId }),
      forecastLedger: { tenantId, solutionId, records: [] },
    };
    this.variances.set(key, entry);
    return entry;
  }

  // --------------------------------------------------------------------------------
  // The observation intake (direct + through the port).
  // --------------------------------------------------------------------------------

  /**
   * The DIRECT observation intake: admit one sealed W036 observation
   * record into the delivery's actualization store (idempotent — the
   * duplicate-observation admission returns the prior record) and emit
   * the observation-intaken event. Replays emit nothing (events are
   * FACTS: an unchanged state is not a new fact).
   */
  intakeObservation(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly deliveryId: string;
    readonly observation: SealedDistinctionRecord;
  }): ActualizationServiceResult<ObservationIntakeOutcome> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'intake',
      options.tenantId,
      options.authorization,
      options.deliveryId,
      'actualization-observation',
    );
    if (!gate.ok) return gate;
    const entryResult = this.deliveryEntry(options.tenantId, options.deliveryId);
    if (!entryResult.ok) return entryResult;
    const entry = entryResult.value;
    const intake = intakeObservation(entry.store, options.observation);
    if (!intake.ok) {
      return intake;
    }
    this.deliveries.set(tenantKey(options.tenantId, options.deliveryId), {
      ...entry,
      store: intake.value.store,
    });
    if (intake.value.admission.kind === 'recorded') {
      const observedAt: string = intake.value.admission.record.payload.observedAt;
      const event = this.emitEvent(
        options.tenantId,
        options.deliveryId,
        gate.value.principalId,
        observedAt,
        {
          discriminator: 'actualization:observation-intaken',
          data: {
            deliveryId: options.deliveryId,
            observationId: intake.value.admission.record.recordId,
            subjectKind: intake.value.admission.record.subject.subjectKind,
            measureKind: intake.value.admission.record.measure.kind,
            admission: 'recorded',
            intakenAt: observedAt,
          },
        },
      );
      if (!event.ok) return event;
    }
    return { ok: true, value: intake.value.admission };
  }

  /**
   * Poll the ObservationSourcePort and run the intake over every pending
   * submission of one delivery (deterministic order — the port sorts).
   */
  pollObservationSources(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly deliveryId: string;
    readonly requestedAt: string;
  }): ActualizationServiceResult<readonly ObservationPollOutcome[]> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'intake',
      options.tenantId,
      options.authorization,
      options.deliveryId,
      'actualization-observation',
    );
    if (!gate.ok) return gate;
    const entryResult = this.deliveryEntry(options.tenantId, options.deliveryId);
    if (!entryResult.ok) return entryResult;
    const submissions = this.observationSourcePort.pollObservations({
      tenantId: options.tenantId,
      deliveryId: options.deliveryId,
      requestedAt: options.requestedAt,
      requestedBy: gate.value.principalId,
    });
    if (!submissions.ok) {
      return submissions;
    }
    const outcomes: ObservationPollOutcome[] = [];
    for (const observation of submissions.value) {
      const intake = this.intakeObservation({
        tenantId: options.tenantId,
        authorization: options.authorization,
        deliveryId: options.deliveryId,
        observation,
      });
      if (!intake.ok) {
        return intake;
      }
      outcomes.push({
        observationId: intake.value.record.recordId,
        admission: intake.value.kind,
      });
    }
    return { ok: true, value: outcomes };
  }

  // --------------------------------------------------------------------------------
  // Validation assessment + conflict resolution.
  // --------------------------------------------------------------------------------

  /**
   * Assess the validation state of every observation group of one
   * delivery's store (the deterministic fold) and emit the
   * validation-assessed events per group.
   */
  assessValidation(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly deliveryId: string;
    readonly policy: ReconciliationPolicy;
    readonly assessedAt: string;
  }): ActualizationServiceResult<readonly import('@epoch/actualization').SealedValidationAssessment[]> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'assess',
      options.tenantId,
      options.authorization,
      options.deliveryId,
      'actualization-assessment',
    );
    if (!gate.ok) return gate;
    const entryResult = this.deliveryEntry(options.tenantId, options.deliveryId);
    if (!entryResult.ok) return entryResult;
    const entry = entryResult.value;
    const assessments = currentAssessments(entry.store, options.policy);
    if (!assessments.ok) {
      return assessments;
    }
    for (const assessment of assessments.value) {
      const event = this.emitEvent(
        options.tenantId,
        options.deliveryId,
        gate.value.principalId,
        options.assessedAt,
        {
          discriminator: 'actualization:validation-assessed',
          data: {
            deliveryId: options.deliveryId,
            assessmentId: assessment.assessmentId,
            state: assessment.state,
            observationCount: assessment.observationRefs.length,
            measureKind: assessment.measureKind,
            deviationMagnitude: assessment.deviationMagnitude,
            assessedAt: options.assessedAt,
          },
        },
      );
      if (!event.ok) return event;
    }
    return assessments;
  }

  /**
   * Admit one sealed conflict resolution into the delivery's store (the
   * typed partition binding) and emit the conflict-resolved event.
   */
  admitResolution(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly deliveryId: string;
    readonly resolution: import('@epoch/actualization').SealedConflictResolution;
    readonly policy: ReconciliationPolicy;
    readonly resolvedAt: string;
  }): ActualizationServiceResult<null> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'resolve',
      options.tenantId,
      options.authorization,
      options.deliveryId,
      'actualization-resolution',
    );
    if (!gate.ok) return gate;
    const entryResult = this.deliveryEntry(options.tenantId, options.deliveryId);
    if (!entryResult.ok) return entryResult;
    const entry = entryResult.value;
    const admitted = admitConflictResolution(entry.store, options.resolution, options.policy);
    if (!admitted.ok) {
      return admitted;
    }
    this.deliveries.set(tenantKey(options.tenantId, options.deliveryId), {
      ...entry,
      store: admitted.value,
    });
    const event = this.emitEvent(
      options.tenantId,
      options.deliveryId,
      gate.value.principalId,
      options.resolvedAt,
      {
        discriminator: 'actualization:conflict-resolved',
        data: {
          deliveryId: options.deliveryId,
          resolutionId: options.resolution.resolutionId,
          assessmentId: options.resolution.assessmentRef.assessmentId,
          selectedCount: options.resolution.selectedObservationRefs.length,
          excludedCount: options.resolution.excludedObservationRefs.length,
          resolvedAt: options.resolvedAt,
        },
      },
    );
    if (!event.ok) return event;
    return { ok: true, value: null };
  }

  // --------------------------------------------------------------------------------
  // Actualization application (the W036 authority path ONLY).
  // --------------------------------------------------------------------------------

  /**
   * Apply one validated (or resolved) observation group to the hosted
   * delivery — EXCLUSIVELY through the W036 authority path — and emit
   * the actuals-minted event. The observations are read from the store
   * (the exact revisions the assessment references).
   */
  applyActualization(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly deliveryId: string;
    readonly assessment: import('@epoch/actualization').SealedValidationAssessment;
    readonly application: ReconciliationApplication;
    readonly resolution?: import('@epoch/actualization').SealedConflictResolution | undefined;
  }): ActualizationServiceResult<import('@epoch/actualization').ActualizationApplicationResult> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'actualize',
      options.tenantId,
      options.authorization,
      options.deliveryId,
      'actualization-delivery',
    );
    if (!gate.ok) return gate;
    const entryResult = this.deliveryEntry(options.tenantId, options.deliveryId);
    if (!entryResult.ok) return entryResult;
    const entry = entryResult.value;
    const applied = applyActualization(
      entry.delivery,
      options.assessment,
      entry.store.observations,
      options.application,
      options.resolution,
    );
    if (!applied.ok) {
      return applied;
    }
    this.deliveries.set(tenantKey(options.tenantId, options.deliveryId), {
      ...entry,
      delivery: applied.value.delivery,
    });
    const event = this.emitEvent(
      options.tenantId,
      options.deliveryId,
      gate.value.principalId,
      options.application.actualizedAt,
      {
        discriminator: 'actualization:actuals-minted',
        data: {
          deliveryId: options.deliveryId,
          assessmentId: options.assessment.assessmentId,
          mintedCount: applied.value.applications.filter((a) => a.outcome === 'actualized').length,
          alreadyMintedCount: applied.value.applications.filter((a) => a.outcome === 'already-actualized')
            .length,
          deliveryDigest: applied.value.delivery.contentDigest,
          actualizedAt: options.application.actualizedAt,
        },
      },
    );
    if (!event.ok) return event;
    return { ok: true, value: applied.value };
  }

  // --------------------------------------------------------------------------------
  // Variance computation + attribution (the variance kernel host surface).
  // --------------------------------------------------------------------------------

  /**
   * Compute + admit one variance record over the hosted delivery's
   * folded actuals and emit nothing (variance records are not delivery
   * lifecycle events — they are the analysis layer; the state projection
   * surfaces them).
   */
  computeVariance(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly solutionId: string;
    readonly input: {
      readonly varianceId: string;
      readonly subjectKind: string;
      readonly subjectId: string;
      readonly varianceClass: import('@epoch/variance').VarianceClass;
      readonly baselineRef: {
        readonly kind: 'prediction' | 'baseline' | 'commitment' | 'forecast';
        readonly recordId: string;
        readonly contentDigest: string;
      };
      readonly actualRef: { readonly kind: 'actual'; readonly recordId: string; readonly contentDigest: string };
      readonly baselineMeasure: unknown;
      readonly actualMeasure: unknown;
      readonly evidence: readonly string[];
      readonly confidence: unknown;
      readonly thresholds: BandThresholds;
    };
    readonly computedAt: string;
    readonly computedBy: string;
  }): ActualizationServiceResult<VarianceComputationOutcome> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'analyze',
      options.tenantId,
      options.authorization,
      options.solutionId,
      'actualization-variance',
    );
    if (!gate.ok) return gate;
    const entry = this.varianceEntry(options.tenantId, options.solutionId);
    const computed = computeVariance({
      ...options.input,
      tenantId: options.tenantId,
      solutionId: options.solutionId,
      computedAt: options.computedAt,
      computedBy: options.computedBy,
    } as never);
    if (!computed.ok) {
      return computed;
    }
    const admitted = admitVarianceRecord(entry.varianceLedger, computed.value);
    if (!admitted.ok) {
      return admitted;
    }
    this.variances.set(tenantKey(options.tenantId, options.solutionId), {
      ...entry,
      varianceLedger: admitted.value,
    });
    return {
      ok: true,
      value: { record: computed.value, summary: foldVarianceSummary(admitted.value) },
    };
  }

  /**
   * Admit one evidence-grounded root-cause attribution linking a hosted
   * variance to its cause. Attribution without evidence is the typed
   * `attribution-evidence-required` rejection BEFORE any admission.
   */
  admitAttribution(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly solutionId: string;
    readonly attributionId: string;
    readonly varianceRef: { readonly recordId: string; readonly contentDigest: string };
    readonly cause: CauseRef;
    readonly evidence: readonly string[];
    readonly note?: string | undefined;
    readonly attributedAt: string;
    readonly attributedBy: string;
  }): ActualizationServiceResult<import('@epoch/variance').SealedAttributionRecord> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'attribute',
      options.tenantId,
      options.authorization,
      options.solutionId,
      'actualization-attribution',
    );
    if (!gate.ok) return gate;
    const entry = this.varianceEntry(options.tenantId, options.solutionId);
    const content = {
      schema: 'epoch.variance.attribution-record',
      schemaVersion: 1,
      attributionId: options.attributionId,
      tenantId: options.tenantId,
      solutionId: options.solutionId,
      varianceRef: options.varianceRef,
      cause: options.cause,
      evidence: [...options.evidence].sort(),
      ...(options.note !== undefined ? { note: options.note } : {}),
      attributedAt: options.attributedAt,
      attributedBy: options.attributedBy,
    };
    // The typed evidence-required guard fires BEFORE any admission.
    const guarded = requireAttributionEvidence(content);
    if (!guarded.ok) {
      return guarded;
    }
    const sealed = sealAttributionRecord(content);
    if (!sealed.ok) {
      return sealed;
    }
    const admitted = admitAttributionRecord(
      entry.attributionLedger,
      foldVarianceRecords(entry.varianceLedger),
      sealed.value,
    );
    if (!admitted.ok) {
      return admitted;
    }
    this.variances.set(tenantKey(options.tenantId, options.solutionId), {
      ...entry,
      attributionLedger: admitted.value,
    });
    return { ok: true, value: sealed.value };
  }

  // --------------------------------------------------------------------------------
  // Rolling forecast revision emission.
  // --------------------------------------------------------------------------------

  /**
   * Emit the NEXT rolling forecast revision from current actuals +
   * remaining plan — a NEW sealed W036 Forecast-distinction record
   * refining an EARLIER FORECAST only (append-only; the exact-revision
   * chain is tracked per solution scope). Emits the forecast-revised
   * event on the delivery's stream.
   */
  reviseForecast(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly deliveryId: string;
    readonly solutionId: string;
    readonly input: {
      readonly recordId: string;
      readonly subject: import('@epoch/actualization').DistinctionSubject;
      readonly planned: import('@epoch/actualization').PlannedMeasure;
      readonly actualsToDate: import('@epoch/actualization').ActualsToDate;
      readonly performanceFactor?: string | undefined;
      readonly asOf: string;
      readonly recordedAt: string;
      readonly recordedBy: string;
      readonly uncertainty: unknown;
    };
    readonly revisedAt: string;
  }): ActualizationServiceResult<RollingForecastDetail> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'forecast',
      options.tenantId,
      options.authorization,
      options.deliveryId,
      'actualization-forecast',
    );
    if (!gate.ok) return gate;
    const entryResult = this.deliveryEntry(options.tenantId, options.deliveryId);
    if (!entryResult.ok) return entryResult;
    const varianceEntry = this.varianceEntry(options.tenantId, options.solutionId);
    // The refinement chain: the LATEST admitted forecast revision, or null
    // for the first (the ledger enforces forecasts-refine-forecasts only).
    const forecastRecords = varianceEntry.forecastLedger.records.filter(
      (record) => record.kind === 'forecast',
    );
    const latestRecord = forecastRecords[forecastRecords.length - 1] ?? null;
    const latest =
      latestRecord === null
        ? null
        : { recordId: latestRecord.recordId, contentDigest: latestRecord.contentDigest };
    const rolled = rollForecast({
      ...options.input,
      tenantId: options.tenantId,
      refines: latest,
    } as never);
    if (!rolled.ok) {
      return rolled;
    }
    const admitted = admitForecastRevision(varianceEntry.forecastLedger, rolled.value.record);
    if (!admitted.ok) {
      return admitted;
    }
    this.variances.set(tenantKey(options.tenantId, options.solutionId), {
      ...varianceEntry,
      forecastLedger: admitted.value,
    });
    const event = this.emitEvent(
      options.tenantId,
      options.deliveryId,
      options.input.recordedBy,
      options.revisedAt,
      {
        discriminator: 'actualization:forecast-revised',
        data: {
          forecastRecordId: rolled.value.record.recordId,
          subjectKind: options.input.subject.subjectKind,
          measureKind:
            rolled.value.record.kind === 'forecast' ? rolled.value.record.measure.kind : 'quantity',
          atCompletion: rolled.value.atCompletion,
          remaining: rolled.value.remaining,
          asOf: options.input.asOf,
          refines: latest === null ? null : latest.recordId,
        },
      },
    );
    if (!event.ok) return event;
    return { ok: true, value: rolled.value };
  }

  // --------------------------------------------------------------------------------
  // Comparison facts + calibration folds.
  // --------------------------------------------------------------------------------

  /**
   * Admit one sealed comparison fact (immutable history) into the
   * delivery's store.
   */
  admitComparisonFact(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly deliveryId: string;
    readonly fact: import('@epoch/actualization').SealedComparisonFact;
  }): ActualizationServiceResult<null> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'calibrate',
      options.tenantId,
      options.authorization,
      options.deliveryId,
      'actualization-calibration',
    );
    if (!gate.ok) return gate;
    const entryResult = this.deliveryEntry(options.tenantId, options.deliveryId);
    if (!entryResult.ok) return entryResult;
    const entry = entryResult.value;
    const admitted = admitComparisonFact(entry.store, options.fact);
    if (!admitted.ok) {
      return admitted;
    }
    this.deliveries.set(tenantKey(options.tenantId, options.deliveryId), {
      ...entry,
      store: admitted.value,
    });
    return { ok: true, value: null };
  }

  /**
   * Fold the calibration state of one subject comparison group of the
   * delivery's store and emit the calibration-folded event.
   */
  foldCalibration(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly deliveryId: string;
    readonly subjectKind: string;
    readonly subjectId: string;
    readonly foldedAt: string;
  }): ActualizationServiceResult<import('@epoch/actualization').SealedCalibrationState> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'calibrate',
      options.tenantId,
      options.authorization,
      options.deliveryId,
      'actualization-calibration',
    );
    if (!gate.ok) return gate;
    const entryResult = this.deliveryEntry(options.tenantId, options.deliveryId);
    if (!entryResult.ok) return entryResult;
    const entry = entryResult.value;
    const facts = entry.store.comparisonFacts.filter(
      (fact) =>
        fact.subject.subjectKind === options.subjectKind && fact.subject.subjectId === options.subjectId,
    );
    const folded = foldCalibration(
      entry.store,
      { solutionId: entry.solutionId, subjectKind: options.subjectKind, subjectId: options.subjectId },
      facts,
    );
    if (!folded.ok) {
      return folded;
    }
    const event = this.emitEvent(
      options.tenantId,
      options.deliveryId,
      gate.value.principalId,
      options.foldedAt,
      {
        discriminator: 'actualization:calibration-folded',
        data: {
          calibrationId: folded.value.calibrationId,
          comparisonCount: folded.value.comparisonCount,
          overCount: folded.value.overCount,
          underCount: folded.value.underCount,
          exactCount: folded.value.exactCount,
          totalAbsoluteDeviation: folded.value.totalAbsoluteDeviation,
          foldedAt: options.foldedAt,
        },
      },
    );
    if (!event.ok) return event;
    return folded;
  }

  // --------------------------------------------------------------------------------
  // The derived state projection + health.
  // --------------------------------------------------------------------------------

  /**
   * Project the derived actualization state of one hosted delivery: the
   * delivery summary + the validation groups + the calibration folds +
   * the solution-scope variance summary. Emits the state-projected event.
   */
  projectState(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly deliveryId: string;
    readonly policy: ReconciliationPolicy;
    readonly projectedAt: string;
  }): ActualizationServiceResult<
    import('@epoch/actualization').ActualizationStateProjection & {
      readonly varianceSummary: readonly import('@epoch/variance').VarianceClassSummary[];
    }
  > {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'read',
      options.tenantId,
      options.authorization,
      options.deliveryId,
      'actualization-delivery',
    );
    if (!gate.ok) return gate;
    const entryResult = this.deliveryEntry(options.tenantId, options.deliveryId);
    if (!entryResult.ok) return entryResult;
    const entry = entryResult.value;
    const projected = projectActualizationState(entry.store, entry.delivery, options.policy);
    if (!projected.ok) {
      return projected;
    }
    const varianceEntry = this.varianceEntry(options.tenantId, entry.solutionId);
    const event = this.emitEvent(
      options.tenantId,
      options.deliveryId,
      gate.value.principalId,
      options.projectedAt,
      {
        discriminator: 'actualization:state-projected',
        data: {
          deliveryId: options.deliveryId,
          deliveryDigest: entry.delivery.contentDigest,
          observationCount: entry.store.observations.length,
          actualCount: entry.delivery.actuals.length,
          groupCount: projected.value.validationGroups.length,
          projectedAt: options.projectedAt,
        },
      },
    );
    if (!event.ok) return event;
    return {
      ok: true,
      value: { ...projected.value, varianceSummary: foldVarianceSummary(varianceEntry.varianceLedger) },
    };
  }

  /** The derived runtime health snapshot (counts only — no order leaks). */
  health(): RuntimeHealth {
    let observationCount = 0;
    let resolutionCount = 0;
    let comparisonFactCount = 0;
    let actualCount = 0;
    for (const entry of this.deliveries.values()) {
      observationCount += entry.store.observations.length;
      resolutionCount += entry.store.resolutions.length;
      comparisonFactCount += entry.store.comparisonFacts.length;
      actualCount += entry.delivery.actuals.length;
    }
    let varianceCount = 0;
    let attributionCount = 0;
    let forecastRevisionCount = 0;
    for (const entry of this.variances.values()) {
      varianceCount += entry.varianceLedger.records.length;
      attributionCount += entry.attributionLedger.records.length;
      forecastRevisionCount += entry.forecastLedger.records.length;
    }
    let eventCount = 0;
    for (const stream of this.streams.values()) {
      eventCount += stream.length;
    }
    return {
      deliveryCount: this.deliveries.size,
      observationCount,
      resolutionCount,
      actualCount,
      varianceCount,
      attributionCount,
      comparisonFactCount,
      forecastRevisionCount,
      eventCount,
    };
  }

  /** The service record version (the snapshot discriminator). */
  readonly recordVersion = RUNTIME_RECORD_VERSION;
}

/** Re-export the in-memory reference adapter for host construction. */
export { InMemoryObservationSourceAdapter };
