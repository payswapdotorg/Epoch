/**
 * The reference Capability Discovery HOST (service layer, W045): the thin
 * typed runtime facade composing the @epoch/capability-discovery kernel.
 *
 * - **The authorization gate** (fail-closed): every operation carries a
 *   caller-supplied {@link AuthorizationDecision}; everything except an
 *   explicit allow is the typed `authorization-rejected` failure. The
 *   service NEVER owns authorization (lock rule 12) and authorization
 *   NEVER travels through model prompts (acceptance 9).
 * - **Tenant validation**: every tenant scope is validated against a REAL
 *   @epoch/tenancy snapshot; unknown tenants are `unknown-tenant`;
 *   cross-tenant access is the typed `cross-tenant-denied` (R12,
 *   negative test e).
 * - **The workflows**: problem-driven discovery (lineage-verified before
 *   it is returned or stored), ecosystem scans (gap/scheduled/event
 *   triggered, over source adapters), external-candidate promotion (the
 *   kernel gate), ecosystem proposals and the deployment-neutral
 *   scheduler invocation (`tick` — the in-memory driver's due payloads
 *   handed to the same ecosystem-scan contract any authorized scheduler
 *   would invoke).
 * - **Canonical-state non-mutation** (negative test b): the service holds
 *   ONLY discovery-plane records; world/solution/delivery state is
 *   referenced OPAQUELY (content digests) and can never be written
 *   through this surface.
 *
 * In-memory reference behavior: NO persistence, NO network, NO registry
 * integration; zero wall-clock, zero randomness — instants are
 * caller-supplied.
 */
import {
  CapabilityDiscoveryStore,
  InMemoryDiscoveryScheduler,
  deriveEcosystemProposal,
  promoteCandidate,
  runEcosystemDiscovery,
  runProblemDrivenDiscovery,
  verifyDiscoveryRun,
} from '@epoch/capability-discovery';
import type {
  CandidateProfile,
  CapabilityGap,
  DiscoveryRunArtifact,
  DiscoverySchedule,
  DiscoverySourceAdapter,
  DueDiscoveryRun,
  EcosystemProposal,
  PromotionRecord,
  Timestamp,
} from '@epoch/capability-discovery';
import {
  parseTenancySnapshot,
  TenancyHierarchy,
} from '@epoch/tenancy';
import type { TenancySnapshot } from '@epoch/tenancy';
import type {
  AuthorizationDecision,
  EcosystemProposalRequest,
  EcosystemScanRequest,
  ProblemDiscoveryRequest,
  PromotionRequest,
  ScheduledScanOutcome,
  ServiceError,
  ServicePrincipal,
  ServiceResult,
} from './types';

function serviceOk<T>(value: T): ServiceResult<T> {
  return { ok: true, value };
}

function serviceFail<T>(error: ServiceError): ServiceResult<T> {
  return { ok: false, error };
}

/** Host options. */
export interface CapabilityDiscoveryServiceOptions {
  /** The REAL tenancy snapshot validating every tenant scope (W009). */
  readonly tenancySnapshot: TenancySnapshot;
}

/**
 * The capability-discovery service facade. One instance per deployment
 * scope; in-memory reference behavior.
 */
export class CapabilityDiscoveryService {
  private readonly store = new CapabilityDiscoveryStore();
  private readonly scheduler = new InMemoryDiscoveryScheduler();
  private readonly tenancy: TenancyHierarchy;

  constructor(options: CapabilityDiscoveryServiceOptions) {
    const parsed = parseTenancySnapshot(options.tenancySnapshot);
    if (!parsed.ok) {
      throw new Error(`invalid tenancy snapshot: ${parsed.error.message}`);
    }
    // Rebuild the REAL hierarchy from the snapshot (W009 admission).
    const hierarchy = new TenancyHierarchy();
    for (const record of parsed.value.records) {
      const admitted = hierarchy.createNode({
        node: record.node,
        digest: record.nodeDigest,
      });
      if (!admitted.ok) {
        throw new Error(`tenancy snapshot node rejected: ${admitted.error.message}`);
      }
    }
    this.tenancy = hierarchy;
  }

  // -------------------------------------------------------------------------
  // Gates.
  // -------------------------------------------------------------------------

  private authorize(authorization: AuthorizationDecision): ServiceError | null {
    if (authorization.allowed !== true) {
      return {
        code: 'authorization-rejected',
        message: `authorization denied${authorization.allowed === false && 'reason' in authorization ? `: ${authorization.reason}` : ' (no explicit allow)'}`,
      };
    }
    return null;
  }

  private validateTenant(tenantId: string): ServiceError | null {
    const exists = this.tenancy.listNodes().some(
      (record) => record.node.kind === 'tenant' && record.node.nodeId === tenantId,
    );
    if (!exists) {
      return { code: 'unknown-tenant', message: `tenant ${tenantId} is not in the tenancy snapshot` };
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // Problem-driven discovery (stream A).
  // -------------------------------------------------------------------------

  /** Run the full problem-driven pipeline; verify lineage; record + return. */
  runProblemDiscovery(request: ProblemDiscoveryRequest): ServiceResult<DiscoveryRunArtifact> {
    const denied = this.authorize(request.authorization);
    if (denied !== null) return serviceFail(denied);
    const unknownTenant = this.validateTenant(request.tenantId);
    if (unknownTenant !== null) return serviceFail(unknownTenant);
    if (request.input.tenantId !== request.tenantId) {
      return serviceFail({
        code: 'cross-tenant-denied',
        message: `discovery input is scoped to ${request.input.tenantId}, not ${request.tenantId}`,
      });
    }

    const outcome = runProblemDrivenDiscovery(request.input, {
      ...request.options,
      at: request.at,
    });
    if (!outcome.ok) {
      return serviceFail({ code: 'kernel-error', message: outcome.error.message });
    }
    // Lineage verification BEFORE the artifact is returned or stored: a
    // run whose lineage does not re-derive is never observable.
    const verified = verifyDiscoveryRun(outcome.value);
    if (!verified.ok) {
      return serviceFail({ code: 'lineage-mismatch', message: verified.error.message });
    }
    const recorded = this.store.recordRun(request.tenantId, outcome.value);
    if (!recorded.ok) {
      return serviceFail({ code: 'kernel-error', message: recorded.error.message });
    }
    // Record ingested candidates referenced by the pool (idempotent).
    for (const candidate of outcome.value.candidates) {
      if (candidate.provenance.sourceKind === 'external-source') {
        this.store.upsertCandidate(request.tenantId, candidate);
      }
    }
    return serviceOk(outcome.value);
  }

  // -------------------------------------------------------------------------
  // Ecosystem scans (stream B).
  // -------------------------------------------------------------------------

  /** Run one ecosystem scan over the tenant's open gaps. */
  runEcosystemScan(request: EcosystemScanRequest): ServiceResult<{
    readonly runId: string;
    readonly ingestedCandidates: readonly CandidateProfile[];
    readonly updatedGaps: readonly CapabilityGap[];
  }> {
    const denied = this.authorize(request.authorization);
    if (denied !== null) return serviceFail(denied);
    const unknownTenant = this.validateTenant(request.tenantId);
    if (unknownTenant !== null) return serviceFail(unknownTenant);

    const gaps = this.store.listGaps(request.tenantId, { state: 'UNSATISFIED' });
    const gapsIncludingHuman = [
      ...gaps,
      ...this.store.listGaps(request.tenantId, { state: 'REQUIRES_HUMAN' }),
    ].sort((a, b) => (a.gapId < b.gapId ? -1 : 1));
    const existingCandidates = this.store.listCandidates();
    const outcome = runEcosystemDiscovery({
      tenantId: request.tenantId,
      trigger: request.trigger,
      invokedBy: request.invokedBy,
      gaps: gapsIncludingHuman,
      adapters: request.adapters,
      existingCandidates,
      at: request.at,
      scanLimit: request.scanLimit,
    });
    if (!outcome.ok) {
      return serviceFail({ code: 'kernel-error', message: outcome.error.message });
    }
    for (const candidate of outcome.value.ingestedCandidates) {
      this.store.upsertCandidate(request.tenantId, candidate);
    }
    for (const gap of outcome.value.updatedGaps) {
      this.store.upsertGap(request.tenantId, gap);
    }
    return serviceOk({
      runId: outcome.value.run.runId,
      ingestedCandidates: outcome.value.ingestedCandidates,
      updatedGaps: outcome.value.updatedGaps,
    });
  }

  // -------------------------------------------------------------------------
  // Promotion workflow.
  // -------------------------------------------------------------------------

  /** Promote an external candidate through the kernel gate. */
  promoteExternalCandidate(request: PromotionRequest): ServiceResult<{
    readonly promotion: PromotionRecord;
    readonly candidate: CandidateProfile;
  }> {
    const denied = this.authorize(request.authorization);
    if (denied !== null) return serviceFail(denied);
    const unknownTenant = this.validateTenant(request.tenantId);
    if (unknownTenant !== null) return serviceFail(unknownTenant);

    const candidate = this.store.getCandidate(request.candidateId);
    if (!candidate.ok) {
      return serviceFail({ code: 'unknown-candidate', message: candidate.error.message });
    }
    const chain = this.store.promotionChain(request.candidateId);
    const previous = chain.length > 0 ? chain[chain.length - 1]!.recordDigest : null;
    const outcome = promoteCandidate({
      candidate: candidate.value,
      targetState: request.targetState,
      evidenceDigest: request.evidenceDigest,
      sandboxReport: request.sandboxReport,
      evaluationEvidence: request.evaluationEvidence,
      policyApproval: request.policyApproval,
      at: request.at,
      previousPromotionDigest: previous,
    });
    if (!outcome.ok) {
      const code =
        outcome.error.code === 'promotion-gate-rejected' ? 'promotion-gate-rejected' : 'kernel-error';
      return serviceFail({ code, message: outcome.error.message });
    }
    const recorded = this.store.recordPromotion(
      request.tenantId,
      outcome.value.record,
      outcome.value.promoted,
    );
    if (!recorded.ok) {
      return serviceFail({ code: 'kernel-error', message: recorded.error.message });
    }
    return serviceOk({
      promotion: outcome.value.record,
      candidate: outcome.value.promoted,
    });
  }

  // -------------------------------------------------------------------------
  // Ecosystem proposals.
  // -------------------------------------------------------------------------

  /** Propose an adapter/extension/domain-pack from gap evidence. */
  proposeEcosystemArtifact(request: EcosystemProposalRequest): ServiceResult<EcosystemProposal> {
    const denied = this.authorize(request.authorization);
    if (denied !== null) return serviceFail(denied);
    const unknownTenant = this.validateTenant(request.tenantId);
    if (unknownTenant !== null) return serviceFail(unknownTenant);

    const allGaps = this.store.listGaps(request.tenantId);
    const gaps =
      request.gapIds !== undefined
        ? allGaps.filter((gap) => request.gapIds!.includes(gap.gapId))
        : allGaps;
    const outcome = deriveEcosystemProposal({
      kind: request.kind,
      summary: request.summary,
      gaps,
      taskExamples: request.taskExamples,
      missingSemantics: request.missingSemantics,
      domainPackDetail: request.domainPackDetail,
      at: request.at,
    });
    if (!outcome.ok) {
      return serviceFail({ code: 'kernel-error', message: outcome.error.message });
    }
    this.store.recordProposal(request.tenantId, outcome.value);
    return serviceOk(outcome.value);
  }

  // -------------------------------------------------------------------------
  // Scheduler invocation (deployment-neutral).
  // -------------------------------------------------------------------------

  /** Register (or replace) a tenant schedule. */
  registerSchedule(
    principal: ServicePrincipal,
    authorization: AuthorizationDecision,
    schedule: DiscoverySchedule,
  ): ServiceResult<DiscoverySchedule> {
    const denied = this.authorize(authorization);
    if (denied !== null) return serviceFail(denied);
    const unknownTenant = this.validateTenant(schedule.tenantId);
    if (unknownTenant !== null) return serviceFail(unknownTenant);
    void principal;
    const registered = this.scheduler.register(schedule);
    if (!registered.ok) {
      return serviceFail({ code: 'kernel-error', message: registered.error.message });
    }
    const stored = this.store.upsertSchedule(schedule.tenantId, registered.value);
    if (!stored.ok) {
      return serviceFail({ code: 'kernel-error', message: stored.error.message });
    }
    return serviceOk(registered.value);
  }

  /**
   * Tick the scheduler at `now` and run the due ecosystem scans through
   * the SAME service contract any authorized external scheduler would
   * invoke. Per-schedule authorization is evaluated with
   * `authorizeSchedule` (fail-closed: a denial is recorded, the schedule
   * still advances).
   */
  tickScheduler(input: {
    readonly now: Timestamp;
    readonly adapters: readonly DiscoverySourceAdapter[];
    readonly authorizeSchedule: (due: DueDiscoveryRun) => AuthorizationDecision;
    readonly principal: ServicePrincipal;
  }): ServiceResult<readonly ScheduledScanOutcome[]> {
    const due = this.scheduler.tick(input.now);
    const outcomes: ScheduledScanOutcome[] = [];
    for (const run of due) {
      const authorization = input.authorizeSchedule(run);
      if (authorization.allowed !== true) {
        this.scheduler.register({
          scheduleId: run.scheduleId,
          tenantId: run.tenantId,
          cadence: { kind: 'weekly' },
          adapterIds: run.adapterIds,
          enabled: true,
          lastRunAt: input.now,
        });
        outcomes.push({
          scheduleId: run.scheduleId,
          tenantId: run.tenantId,
          status: 'authorization-rejected',
          message: 'scheduled scan denied by the authorization gate',
        });
        continue;
      }
      const scan = this.runEcosystemScan({
        principal: input.principal,
        authorization,
        tenantId: run.tenantId,
        trigger: 'scheduled',
        invokedBy: run.scheduleId,
        adapters: input.adapters.filter((adapter) => run.adapterIds.includes(adapter.adapterId)),
        at: input.now,
      });
      if (!scan.ok) {
        outcomes.push({
          scheduleId: run.scheduleId,
          tenantId: run.tenantId,
          status: 'failed',
          message: scan.error.message,
        });
        continue;
      }
      outcomes.push({
        scheduleId: run.scheduleId,
        tenantId: run.tenantId,
        status: scan.value.updatedGaps.length > 0 || scan.value.ingestedCandidates.length > 0 ? 'ran' : 'no-gaps',
        message: `scan ${scan.value.runId}: ${scan.value.ingestedCandidates.length} candidate(s) ingested, ${scan.value.updatedGaps.length} gap(s) updated`,
      });
    }
    return serviceOk(outcomes.sort((a, b) => (a.scheduleId < b.scheduleId ? -1 : 1)));
  }

  // -------------------------------------------------------------------------
  // Tenant-scoped reads.
  // -------------------------------------------------------------------------

  /** Read one run (tenant-scoped). */
  getRun(
    principal: ServicePrincipal,
    authorization: AuthorizationDecision,
    tenantId: string,
    runId: string,
  ): ServiceResult<DiscoveryRunArtifact> {
    const denied = this.authorize(authorization);
    if (denied !== null) return serviceFail(denied);
    void principal;
    const run = this.store.getRun(tenantId, runId);
    if (!run.ok) {
      const code = run.error.code === 'cross-tenant-denied' ? 'cross-tenant-denied' : 'kernel-error';
      return serviceFail({ code, message: run.error.message });
    }
    return serviceOk(run.value);
  }

  /** List runs (tenant-scoped). */
  listRuns(
    principal: ServicePrincipal,
    authorization: AuthorizationDecision,
    tenantId: string,
  ): ServiceResult<readonly DiscoveryRunArtifact[]> {
    const denied = this.authorize(authorization);
    if (denied !== null) return serviceFail(denied);
    const unknownTenant = this.validateTenant(tenantId);
    if (unknownTenant !== null) return serviceFail(unknownTenant);
    void principal;
    return serviceOk(this.store.listRuns(tenantId));
  }

  /** List gaps (tenant-scoped, optional state filter). */
  listGaps(
    principal: ServicePrincipal,
    authorization: AuthorizationDecision,
    tenantId: string,
    state?: CapabilityGap['state'],
  ): ServiceResult<readonly CapabilityGap[]> {
    const denied = this.authorize(authorization);
    if (denied !== null) return serviceFail(denied);
    const unknownTenant = this.validateTenant(tenantId);
    if (unknownTenant !== null) return serviceFail(unknownTenant);
    void principal;
    return serviceOk(this.store.listGaps(tenantId, state !== undefined ? { state } : undefined));
  }

  /** List candidates (optional state filter). */
  listCandidates(
    principal: ServicePrincipal,
    authorization: AuthorizationDecision,
    states?: readonly CandidateProfile['evaluationState'][],
  ): ServiceResult<readonly CandidateProfile[]> {
    const denied = this.authorize(authorization);
    if (denied !== null) return serviceFail(denied);
    void principal;
    return serviceOk(this.store.listCandidates(states !== undefined ? { states } : undefined));
  }

  /** List ecosystem proposals. */
  listProposals(
    principal: ServicePrincipal,
    authorization: AuthorizationDecision,
  ): ServiceResult<readonly EcosystemProposal[]> {
    const denied = this.authorize(authorization);
    if (denied !== null) return serviceFail(denied);
    void principal;
    return serviceOk(this.store.listProposals());
  }

  /** List schedules (tenant-scoped). */
  listSchedules(
    principal: ServicePrincipal,
    authorization: AuthorizationDecision,
    tenantId: string,
  ): ServiceResult<readonly DiscoverySchedule[]> {
    const denied = this.authorize(authorization);
    if (denied !== null) return serviceFail(denied);
    const unknownTenant = this.validateTenant(tenantId);
    if (unknownTenant !== null) return serviceFail(unknownTenant);
    void principal;
    return serviceOk(this.store.listSchedules(tenantId));
  }
}
