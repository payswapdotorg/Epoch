/**
 * The reference learning-calibration runtime host (W040): the thin
 * typed HOST FACADE over the @epoch/learning-calibration kernel.
 *
 * Owns (and only owns): tenant-scoped learning stores (one per
 * solution scope), source-history registration (sealed W039-grammar
 * comparison facts + W036 Outcome records — read-only, idempotent by
 * digest), the learning-record intake — direct or through the
 * LearningRecordSourcePort adapter seam (ONE in-memory reference
 * adapter; the core never names a vendor) — with IDEMPOTENT replay,
 * deterministic dataset assembly (typed eligibility: only validated
 * actual/outcome records fold into rows; every exclusion a typed
 * record), replay idempotence + the history-immutable replay conflict,
 * calibration metric folds per (model revision, applicability scope),
 * model-registry updates EXCLUSIVELY through typed proposals (the
 * controlled update gate: lineage-required, stale-reference-rejected,
 * history-immutable), pack learning surfaces as PURE PROJECTIONS over
 * the universal dataset, and the derived learning-state projection.
 * Every step emits `learning:*` events on the scope's stream
 * (`stream:learning-<suffix>`, one stream per solution scope, digests
 * sealed by the kernel and pinned by REAL sealEvent parity tests).
 *
 * Explicitly NOT (later Work Orders / out of scope): durable
 * persistence, real learning-record-source integrations (adapters of
 * LearningRecordSourcePort), model training/ML runtimes, the
 * supervision/alerting layer (W043), the external event bridge (W042).
 *
 * Determinism: ZERO wall-clock reads and ZERO randomness — every
 * instant is caller-supplied; every listing/snapshot is sorted (no
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
  admitModelRevisionProposal,
  assembleDatasetFromStore,
  foldMetrics,
  intakeLearningRecord,
  learningStreamIdOf,
  openLearningStore,
  projectPackView,
  projectStoreLearningState,
  registerComparisonFact,
  registerOutcomeRecord,
  sealLearningEvent,
  verifySealedOutcomeLearningCandidate,
  type LearningStore,
  type SealedLearningEvent,
} from '@epoch/learning-calibration';
import type { LearningError } from '@epoch/learning-calibration';
import { RUNTIME_RECORD_VERSION } from './version';
import { InMemoryLearningRecordSourceAdapter } from './record-source-port';
import type {
  AuthorizationInput,
  DatasetAssemblyHostOutcome,
  LearningCalibrationRuntimeOptions,
  LearningCalibrationServiceResult,
  LearningRecordIntakeOutcome,
  LearningRecordSourcePort,
  LearningStateProjection,
  MetricFoldHostOutcome,
  PackLearningView,
  ProposalAdmissionHostOutcome,
  RuntimeHealth,
} from './types';

/** Event payload data (the JSON value space the kernel payload accepts). */
type EventData = Record<string, string | number | boolean | null | readonly string[]>;

/** Deterministic composite key: `<tenantId>#<solutionId>`. */
function tenantKey(tenantId: string, solutionId: string): string {
  return `${tenantId}#${solutionId}`;
}

/** One hosted solution scope: the learning store. */
interface ScopeEntry {
  readonly tenantId: string;
  readonly solutionId: string;
  store: LearningStore;
}

/**
 * The reference learning-calibration runtime host. Construct directly
 * (the in-memory LearningRecordSourcePort reference adapter is the
 * default). In-memory only: no persistence, no network, no clocks.
 */
export class LearningCalibrationRuntime {
  /** tenantId#solutionId -> scope entry. Maps iterate in insertion order; every read path sorts. */
  private readonly scopes = new Map<string, ScopeEntry>();

  /** tenantId#streamId -> events (append-only). */
  private readonly streams = new Map<string, SealedLearningEvent[]>();

  private readonly recordSourcePort: LearningRecordSourcePort;

  private readonly expectedTenantId: string | undefined;

  constructor(options: LearningCalibrationRuntimeOptions = {}) {
    this.expectedTenantId = options.expectedTenantId;
    this.recordSourcePort =
      options.recordSourcePort ?? new InMemoryLearningRecordSourceAdapter();
  }

  // --------------------------------------------------------------------------------
  // The authorization gate (W009 — the W022/W037/W038/W039 pattern).
  // --------------------------------------------------------------------------------

  private authorizationGate(
    operation: string,
    tenantId: string,
    authorization: AuthorizationInput,
    resourceId: string,
    resourceType: string,
  ): LearningCalibrationServiceResult<{ principalId: string }> {
    const context = parseAuthorizationContext(authorization.context);
    if (!context.ok) {
      return { ok: false, error: context.error as LearningError };
    }
    const request = {
      schemaVersion: AUTHORIZATION_RECORD_VERSION,
      principalId: authorization.principalId,
      actionKind: `learning.${operation}`,
      resource: { resourceType, resourceId, tenantId },
      ...(authorization.justification !== undefined
        ? { justification: authorization.justification }
        : {}),
    };
    const decision = evaluate(request, context.value);
    if (!decision.ok) {
      return { ok: false, error: decision.error as LearningError };
    }
    const value: AuthorizationDecision = decision.value;
    if (value.outcome === 'deny') {
      return {
        ok: false,
        error: {
          code: 'authorization-rejected',
          message: `principal "${authorization.principalId}" is not authorized for learning.${operation} (${value.denial.code}): ${value.denial.message}`,
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

  private tenantGuard(tenantId: string): LearningCalibrationServiceResult<null> {
    if (this.expectedTenantId !== undefined && tenantId !== this.expectedTenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `this learning-calibration host is scoped to tenant "${this.expectedTenantId}" — operations for tenant "${tenantId}" are rejected (R12 tenant isolation)`,
          expectedTenantId: this.expectedTenantId,
          encounteredTenantId: tenantId,
          subject: tenantId,
        },
      };
    }
    return { ok: true, value: null };
  }

  // --------------------------------------------------------------------------------
  // The event emission (W010-shaped, kernel-sealed; one stream per scope).
  // --------------------------------------------------------------------------------

  private emitEvent(
    tenantId: string,
    solutionId: string,
    actor: string,
    occurredAt: string,
    payload: { readonly discriminator: string; readonly data: EventData },
  ): LearningCalibrationServiceResult<SealedLearningEvent> {
    const streamId = learningStreamIdOf(solutionId);
    const key = tenantKey(tenantId, streamId);
    const events = this.streams.get(key) ?? [];
    const event = sealLearningEvent({
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
    this.streams.set(key, [...events, event.value]);
    return { ok: true, value: event.value };
  }

  private scopeOf(
    tenantId: string,
    solutionId: string,
  ): LearningCalibrationServiceResult<ScopeEntry> {
    const key = tenantKey(tenantId, solutionId);
    const entry = this.scopes.get(key);
    if (entry === undefined) {
      return {
        ok: false,
        error: {
          code: 'unknown-scope',
          message: `solution scope "${solutionId}" is not hosted — register source history or intake a learning record first`,
          solutionId,
        },
      };
    }
    return { ok: true, value: entry };
  }

  // --------------------------------------------------------------------------------
  // The learning-record intake (direct + through the port).
  // --------------------------------------------------------------------------------

  /**
   * INTAKE one sealed outcome-learning candidate (idempotent replay):
   * the host registers the EMBEDDED source history first (the W039
   * comparison fact + the W036 Outcome record — read-only, idempotent
   * by digest), then admits the candidate through the kernel intake.
   * Emits `learning:record-intaken` (admission `intaken` or
   * `duplicate-candidate`).
   */
  intakeLearningRecord(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly candidate: unknown;
    readonly intakenAt: string;
  }): LearningCalibrationServiceResult<LearningRecordIntakeOutcome> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'intake',
      options.tenantId,
      options.authorization,
      'learning-scope',
      'learning-record',
    );
    if (!gate.ok) return gate;

    // Verify the candidate FIRST (the embedded source records ride it).
    const verified = verifySealedOutcomeLearningCandidate(options.candidate);
    if (!verified.ok) {
      return verified;
    }
    const candidate = verified.value;

    let entry =
      this.scopes.get(tenantKey(options.tenantId, candidate.solutionId)) ?? null;
    if (entry === null) {
      entry = {
        tenantId: options.tenantId,
        solutionId: candidate.solutionId,
        store: openLearningStore({
          tenantId: options.tenantId,
          solutionId: candidate.solutionId,
        }),
      };
      this.scopes.set(tenantKey(options.tenantId, candidate.solutionId), entry);
    }
    if (candidate.tenantId !== entry.tenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `candidate "${candidate.candidateId}" belongs to tenant "${candidate.tenantId}" but the host scope is "${entry.tenantId}" (R12)`,
          expectedTenantId: entry.tenantId,
          encounteredTenantId: candidate.tenantId,
          subject: candidate.candidateId,
        },
      };
    }

    // Register the embedded source history (idempotent, read-only).
    const withFact = registerComparisonFact(entry.store, candidate.comparisonFact);
    if (!withFact.ok) return withFact;
    const withOutcome = registerOutcomeRecord(withFact.value, candidate.outcome);
    if (!withOutcome.ok) return withOutcome;

    // Admit the candidate through the kernel intake.
    const intaken = intakeLearningRecord(withOutcome.value, candidate);
    if (!intaken.ok) return intaken;
    entry.store = intaken.value.store;

    const event = this.emitEvent(
      options.tenantId,
      entry.solutionId,
      gate.value.principalId,
      options.intakenAt,
      {
        discriminator: 'learning:record-intaken',
        data: {
          solutionId: entry.solutionId,
          candidateId: candidate.candidateId,
          subjectKind: candidate.comparisonFact.subject.subjectKind,
          admission: intaken.value.admission,
          intakenAt: options.intakenAt,
        },
      },
    );
    if (!event.ok) return event;
    return {
      ok: true,
      value: { candidateId: candidate.candidateId, admission: intaken.value.admission },
    };
  }

  /**
   * POLL the LearningRecordSourcePort (the adapter seam) and intake the
   * pending learning records of one scope (each through the idempotent
   * {@link intakeLearningRecord} path). Emits one
   * `learning:record-intaken` per record.
   */
  pollLearningRecords(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly solutionId: string;
    readonly requestedAt: string;
  }): LearningCalibrationServiceResult<readonly LearningRecordIntakeOutcome[]> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'intake',
      options.tenantId,
      options.authorization,
      options.solutionId,
      'learning-scope',
    );
    if (!gate.ok) return gate;
    const polled = this.recordSourcePort.pollLearningRecords({
      tenantId: options.tenantId,
      solutionId: options.solutionId,
      requestedAt: options.requestedAt,
      requestedBy: gate.value.principalId,
    });
    if (!polled.ok) return polled;
    const admissions: LearningRecordIntakeOutcome[] = [];
    for (const candidate of polled.value) {
      const intaken = this.intakeLearningRecord({
        tenantId: options.tenantId,
        authorization: options.authorization,
        candidate,
        intakenAt: options.requestedAt,
      });
      if (!intaken.ok) return intaken;
      admissions.push(intaken.value);
    }
    return { ok: true, value: admissions };
  }

  // --------------------------------------------------------------------------------
  // Dataset assembly + replay.
  // --------------------------------------------------------------------------------

  /**
   * ASSEMBLE the learning dataset of one hosted scope (the
   * deterministic fold over the admitted candidates). Emits
   * `learning:dataset-assembled` (or `learning:dataset-replayed` on
   * exact re-derivation — idempotent replay).
   */
  assembleDataset(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly solutionId: string;
    readonly bandThresholds: { readonly minor: string; readonly material: string; readonly severe: string };
    readonly assembledAt: string;
  }): LearningCalibrationServiceResult<DatasetAssemblyHostOutcome> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'assemble',
      options.tenantId,
      options.authorization,
      options.solutionId,
      'learning-scope',
    );
    if (!gate.ok) return gate;
    const entry = this.scopeOf(options.tenantId, options.solutionId);
    if (!entry.ok) return entry;
    const assembled = assembleDatasetFromStore(entry.value.store, {
      bandThresholds: options.bandThresholds,
    });
    if (!assembled.ok) return assembled;
    entry.value.store = assembled.value.store;
    const event = this.emitEvent(
      options.tenantId,
      options.solutionId,
      gate.value.principalId,
      options.assembledAt,
      assembled.value.admission === 'assembled'
        ? {
            discriminator: 'learning:dataset-assembled',
            data: {
              solutionId: options.solutionId,
              datasetId: assembled.value.dataset.datasetId,
              datasetDigest: assembled.value.dataset.contentDigest,
              eligibleCount: assembled.value.dataset.eligibleCount,
              excludedCount: assembled.value.dataset.excludedCount,
              assembledAt: options.assembledAt,
            },
          }
        : {
            discriminator: 'learning:dataset-replayed',
            data: {
              solutionId: options.solutionId,
              datasetId: assembled.value.dataset.datasetId,
              datasetDigest: assembled.value.dataset.contentDigest,
              replayedAt: options.assembledAt,
            },
          },
    );
    if (!event.ok) return event;
    return {
      ok: true,
      value: { admission: assembled.value.admission, dataset: assembled.value.dataset },
    };
  }

  // --------------------------------------------------------------------------------
  // The calibration metric folds.
  // --------------------------------------------------------------------------------

  /**
   * FOLD the calibration metric set of one model revision over one
   * admitted dataset (the latest when omitted). Emits
   * `learning:metrics-folded`.
   */
  foldMetrics(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly solutionId: string;
    readonly revisionId: string;
    readonly toleranceBands: readonly string[];
    readonly datasetId?: string | undefined;
    readonly foldedAt: string;
  }): LearningCalibrationServiceResult<MetricFoldHostOutcome> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'fold',
      options.tenantId,
      options.authorization,
      options.solutionId,
      'learning-scope',
    );
    if (!gate.ok) return gate;
    const entry = this.scopeOf(options.tenantId, options.solutionId);
    if (!entry.ok) return entry;
    const folded = foldMetrics(entry.value.store, {
      revisionId: options.revisionId,
      toleranceBands: options.toleranceBands,
      ...(options.datasetId !== undefined ? { datasetId: options.datasetId } : {}),
    });
    if (!folded.ok) return folded;
    entry.value.store = folded.value.store;
    const event = this.emitEvent(
      options.tenantId,
      options.solutionId,
      gate.value.principalId,
      options.foldedAt,
      {
        discriminator: 'learning:metrics-folded',
        data: {
          solutionId: options.solutionId,
          metricId: folded.value.metricSet.metricId,
          modelId: folded.value.metricSet.modelRef.modelId,
          revisionId: folded.value.metricSet.modelRef.revisionId,
          datasetId: folded.value.metricSet.foldDefinition.datasetRef.datasetId,
          selectedRowCount: folded.value.metricSet.selectedRowCount,
          foldedAt: options.foldedAt,
        },
      },
    );
    if (!event.ok) return event;
    return {
      ok: true,
      value: { admission: folded.value.admission, metricSet: folded.value.metricSet },
    };
  }

  // --------------------------------------------------------------------------------
  // The model registry (controlled updates through proposals only).
  // --------------------------------------------------------------------------------

  /**
   * ADMIT one model-revision proposal (the ONLY registry update path —
   * draft revision + justification + mandatory lineage, gated by the
   * kernel: model-revision-lineage-required, stale-reference-rejected,
   * history-immutable). Emits `learning:revision-proposed` and
   * `learning:revision-admitted` (one event on idempotent replay).
   */
  admitModelRevision(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly solutionId: string;
    readonly proposal: unknown;
    readonly proposedAt: string;
    readonly admittedAt: string;
  }): LearningCalibrationServiceResult<ProposalAdmissionHostOutcome> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'revise',
      options.tenantId,
      options.authorization,
      options.solutionId,
      'learning-scope',
    );
    if (!gate.ok) return gate;
    const entry = this.scopeOf(options.tenantId, options.solutionId);
    if (!entry.ok) return entry;
    const admitted = admitModelRevisionProposal(entry.value.store, options.proposal);
    if (!admitted.ok) return admitted;
    entry.value.store = admitted.value.store;
    const draft = admitted.value.revision;
    if (admitted.value.admission === 'admitted') {
      const proposed = this.emitEvent(
        options.tenantId,
        options.solutionId,
        gate.value.principalId,
        options.proposedAt,
        {
          discriminator: 'learning:revision-proposed',
          data: {
            solutionId: options.solutionId,
            proposalId: this.proposalIdOf(options.proposal),
            modelId: draft.modelId,
            revisionId: draft.revisionId,
            sequence: draft.sequence,
            proposedAt: options.proposedAt,
          },
        },
      );
      if (!proposed.ok) return proposed;
    }
    const event = this.emitEvent(
      options.tenantId,
      options.solutionId,
      gate.value.principalId,
      options.admittedAt,
      {
        discriminator: 'learning:revision-admitted',
        data: {
          solutionId: options.solutionId,
          proposalId: this.proposalIdOf(options.proposal),
          modelId: draft.modelId,
          revisionId: draft.revisionId,
          sequence: draft.sequence,
          admittedAt: options.admittedAt,
        },
      },
    );
    if (!event.ok) return event;
    return {
      ok: true,
      value: { admission: admitted.value.admission, revision: admitted.value.revision },
    };
  }

  /** Read the proposal id of an admitted proposal payload (loose view). */
  private proposalIdOf(proposal: unknown): string {
    const candidate = proposal as { readonly proposalId?: unknown };
    return typeof candidate.proposalId === 'string' ? candidate.proposalId : 'proposal:unknown';
  }

  // --------------------------------------------------------------------------------
  // The pure projections (pack views — never pack-keyed stores).
  // --------------------------------------------------------------------------------

  /**
   * PROJECT the learning view of one domain pack over one admitted
   * dataset (the latest when omitted) — the PURE projection (a
   * pack-keyed history store is REJECTED by the kernel: the
   * `parallel-history-store-rejected` guard). Emits
   * `learning:pack-view-projected`.
   */
  packView(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly solutionId: string;
    readonly packId: string;
    readonly datasetId?: string | undefined;
    readonly projectedAt: string;
  }): LearningCalibrationServiceResult<PackLearningView> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'read',
      options.tenantId,
      options.authorization,
      options.solutionId,
      'learning-scope',
    );
    if (!gate.ok) return gate;
    const entry = this.scopeOf(options.tenantId, options.solutionId);
    if (!entry.ok) return entry;
    const dataset =
      options.datasetId !== undefined
        ? entry.value.store.datasets.find((dataset) => dataset.datasetId === options.datasetId)
        : entry.value.store.datasets[entry.value.store.datasets.length - 1];
    if (dataset === undefined) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message:
            options.datasetId !== undefined
              ? `dataset "${options.datasetId}" is not admitted with this host`
              : 'no dataset is admitted with this host — assemble one before projecting pack views',
          referenceKind: 'dataset',
          referenceId: options.datasetId ?? '(none)',
        } as LearningError,
      };
    }
    const view = projectPackView(dataset, {
      solutionId: options.solutionId,
      packId: options.packId,
    });
    if (!view.ok) return view;
    const event = this.emitEvent(
      options.tenantId,
      options.solutionId,
      gate.value.principalId,
      options.projectedAt,
      {
        discriminator: 'learning:pack-view-projected',
        data: {
          solutionId: options.solutionId,
          packId: options.packId,
          rowCount: view.value.rowCount,
          projectedAt: options.projectedAt,
        },
      },
    );
    if (!event.ok) return event;
    return view;
  }

  /**
   * PROJECT the derived learning state of one hosted scope (the pure
   * deterministic fold). Emits `learning:state-projected`.
   */
  stateProjection(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly solutionId: string;
    readonly projectedAt: string;
  }): LearningCalibrationServiceResult<LearningStateProjection> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'read',
      options.tenantId,
      options.authorization,
      options.solutionId,
      'learning-scope',
    );
    if (!gate.ok) return gate;
    const entry = this.scopeOf(options.tenantId, options.solutionId);
    if (!entry.ok) return entry;
    const projection = projectStoreLearningState(entry.value.store, options.projectedAt);
    const event = this.emitEvent(
      options.tenantId,
      options.solutionId,
      gate.value.principalId,
      options.projectedAt,
      {
        discriminator: 'learning:state-projected',
        data: {
          solutionId: options.solutionId,
          candidateCount: projection.candidateCount,
          datasetCount: projection.datasetCount,
          metricCount: projection.metricSetCount,
          modelCount: projection.modelCount,
          revisionCount: projection.revisionCount,
          projectedAt: options.projectedAt,
        },
      },
    );
    if (!event.ok) return event;
    return { ok: true, value: projection };
  }

  // --------------------------------------------------------------------------------
  // The event stream + health.
  // --------------------------------------------------------------------------------

  /** The sealed event stream of one scope (sorted by sequence — append-only). */
  eventStream(options: {
    readonly tenantId: string;
    readonly authorization: AuthorizationInput;
    readonly solutionId: string;
  }): LearningCalibrationServiceResult<readonly SealedLearningEvent[]> {
    const guard = this.tenantGuard(options.tenantId);
    if (!guard.ok) return guard;
    const gate = this.authorizationGate(
      'read',
      options.tenantId,
      options.authorization,
      options.solutionId,
      'learning-scope',
    );
    if (!gate.ok) return gate;
    const key = tenantKey(options.tenantId, learningStreamIdOf(options.solutionId));
    return { ok: true, value: [...(this.streams.get(key) ?? [])] };
  }

  /** The derived runtime health snapshot (sorted scope listing). */
  health(): RuntimeHealth {
    let comparisonFactCount = 0;
    let outcomeRecordCount = 0;
    let candidateCount = 0;
    let datasetCount = 0;
    let metricSetCount = 0;
    let revisionCount = 0;
    for (const entry of [...this.scopes.values()].sort((a, b) =>
      tenantKey(a.tenantId, a.solutionId) < tenantKey(b.tenantId, b.solutionId) ? -1 : 1,
    )) {
      comparisonFactCount += entry.store.comparisonFacts.length;
      outcomeRecordCount += entry.store.outcomeRecords.length;
      candidateCount += entry.store.candidates.length;
      datasetCount += entry.store.datasets.length;
      metricSetCount += entry.store.metricSets.length;
      revisionCount += entry.store.revisions.length;
    }
    let eventCount = 0;
    for (const events of this.streams.values()) {
      eventCount += events.length;
    }
    return {
      scopeCount: this.scopes.size,
      comparisonFactCount,
      outcomeRecordCount,
      candidateCount,
      datasetCount,
      metricSetCount,
      revisionCount,
      eventCount,
    };
  }

  /** The runtime record version (the snapshot discriminator). */
  readonly recordVersion = RUNTIME_RECORD_VERSION;
}
