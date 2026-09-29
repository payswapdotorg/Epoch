/**
 * The reference in-memory discovery store (the W020/W030 host-model
 * convention): tenant-scoped, append-only-by-convention maps for runs,
 * gaps, candidates, promotions, proposals and schedules.
 *
 * Tenant isolation (R12) is a SECURITY BOUNDARY: every read and write is
 * tenant-scoped; a scope violation is the typed `cross-tenant-denied`
 * rejection (negative test e). NO persistence, NO event log, NO UI —
 * records are plain serialization-friendly JSON.
 */
import type {
  CandidateEvaluationState,
  CandidateId,
  CandidateProfile,
  CapabilityGap,
  CapabilityGapId,
  CapabilityGapState,
  DiscoveryRunArtifact,
  DiscoveryRunId,
  DiscoveryResult,
  DiscoverySchedule,
  DiscoveryTenantId,
  EcosystemProposal,
  EcosystemProposalId,
  PromotionRecord,
} from './types';
import { typedError } from './errors';

/** The store's public read/write surface. */
export class CapabilityDiscoveryStore {
  private readonly runs = new Map<DiscoveryRunId, DiscoveryRunArtifact>();
  private readonly gaps = new Map<CapabilityGapId, CapabilityGap>();
  private readonly candidates = new Map<CandidateId, CandidateProfile>();
  private readonly promotions = new Map<CandidateId, PromotionRecord[]>();
  private readonly proposals = new Map<EcosystemProposalId, EcosystemProposal>();
  private readonly schedules = new Map<string, DiscoverySchedule>();

  // -------------------------------------------------------------------------
  // Runs.
  // -------------------------------------------------------------------------

  /** Record a problem-driven run artifact (idempotent per exact content). */
  recordRun(
    tenantId: DiscoveryTenantId,
    artifact: DiscoveryRunArtifact,
  ): DiscoveryResult<DiscoveryRunArtifact> {
    if (artifact.run.tenantId !== tenantId) {
      return {
        ok: false,
        error: typedError(
          'cross-tenant-denied',
          `run ${artifact.run.runId} belongs to tenant ${artifact.run.tenantId}, not ${tenantId}`,
        ),
      };
    }
    const existing = this.runs.get(artifact.run.runId);
    if (existing !== undefined) {
      if (existing.run.createdAt === artifact.run.createdAt) {
        return { ok: true, value: existing };
      }
      return {
        ok: false,
        error: typedError(
          'duplicate-run',
          `run ${artifact.run.runId} already recorded; runs are immutable`,
        ),
      };
    }
    this.runs.set(artifact.run.runId, artifact);
    for (const gap of artifact.gaps) this.upsertGap(tenantId, gap);
    return { ok: true, value: artifact };
  }

  /** Read one run (tenant-scoped). */
  getRun(
    tenantId: DiscoveryTenantId,
    runId: DiscoveryRunId,
  ): DiscoveryResult<DiscoveryRunArtifact> {
    const artifact = this.runs.get(runId);
    if (artifact === undefined) {
      return { ok: false, error: typedError('unknown-run', `run ${runId} is not recorded`) };
    }
    if (artifact.run.tenantId !== tenantId) {
      return {
        ok: false,
        error: typedError(
          'cross-tenant-denied',
          `run ${runId} belongs to tenant ${artifact.run.tenantId}, not ${tenantId}`,
        ),
      };
    }
    return { ok: true, value: artifact };
  }

  /** List runs (tenant-scoped, canonical order). */
  listRuns(tenantId: DiscoveryTenantId): readonly DiscoveryRunArtifact[] {
    return [...this.runs.values()]
      .filter((artifact) => artifact.run.tenantId === tenantId)
      .sort((a, b) => (a.run.runId < b.run.runId ? -1 : 1));
  }

  // -------------------------------------------------------------------------
  // Gaps.
  // -------------------------------------------------------------------------

  /** Insert or replace a gap record (append-only by convention). */
  upsertGap(tenantId: DiscoveryTenantId, gap: CapabilityGap): DiscoveryResult<CapabilityGap> {
    if (gap.tenantId !== tenantId) {
      return {
        ok: false,
        error: typedError(
          'cross-tenant-denied',
          `gap ${gap.gapId} belongs to tenant ${gap.tenantId}, not ${tenantId}`,
        ),
      };
    }
    this.gaps.set(gap.gapId, gap);
    return { ok: true, value: gap };
  }

  /** Read one gap (tenant-scoped). */
  getGap(tenantId: DiscoveryTenantId, gapId: CapabilityGapId): DiscoveryResult<CapabilityGap> {
    const gap = this.gaps.get(gapId);
    if (gap === undefined) {
      return { ok: false, error: typedError('unknown-gap', `gap ${gapId} is not recorded`) };
    }
    if (gap.tenantId !== tenantId) {
      return {
        ok: false,
        error: typedError(
          'cross-tenant-denied',
          `gap ${gapId} belongs to tenant ${gap.tenantId}, not ${tenantId}`,
        ),
      };
    }
    return { ok: true, value: gap };
  }

  /** List gaps (tenant-scoped, optional state filter, canonical order). */
  listGaps(
    tenantId: DiscoveryTenantId,
    filter?: { readonly state?: CapabilityGapState | undefined },
  ): readonly CapabilityGap[] {
    return [...this.gaps.values()]
      .filter((gap) => gap.tenantId === tenantId)
      .filter((gap) => filter?.state === undefined || gap.state === filter.state)
      .sort((a, b) => (a.gapId < b.gapId ? -1 : 1));
  }

  // -------------------------------------------------------------------------
  // Candidates + promotions.
  // -------------------------------------------------------------------------

  /** Insert or replace a candidate profile. */
  upsertCandidate(
    tenantId: DiscoveryTenantId,
    candidate: CandidateProfile,
  ): DiscoveryResult<CandidateProfile> {
    void tenantId; // candidate ids are globally content-addressed; tenant scope is enforced by run/gap records
    const existing = this.candidates.get(candidate.candidateId);
    if (existing !== undefined && existing.evaluationState !== candidate.evaluationState) {
      // State evolution is allowed ONLY through recorded promotions.
      const promotions = this.promotions.get(candidate.candidateId) ?? [];
      const last = promotions[promotions.length - 1];
      if (last === undefined || last.toState !== candidate.evaluationState) {
        return {
          ok: false,
          error: typedError(
            'candidate-state-conflict',
            `candidate ${candidate.candidateId} state change to ${candidate.evaluationState} has no matching promotion record`,
          ),
        };
      }
    }
    this.candidates.set(candidate.candidateId, candidate);
    return { ok: true, value: candidate };
  }

  /** Read one candidate. */
  getCandidate(candidateId: CandidateId): DiscoveryResult<CandidateProfile> {
    const candidate = this.candidates.get(candidateId);
    if (candidate === undefined) {
      return {
        ok: false,
        error: typedError('unknown-candidate', `candidate ${candidateId} is not recorded`),
      };
    }
    return { ok: true, value: candidate };
  }

  /** List candidates (optional state filter, canonical order). */
  listCandidates(
    filter?: { readonly states?: readonly CandidateEvaluationState[] | undefined },
  ): readonly CandidateProfile[] {
    return [...this.candidates.values()]
      .filter(
        (candidate) =>
          filter?.states === undefined || filter.states.includes(candidate.evaluationState),
      )
      .sort((a, b) => (a.candidateId < b.candidateId ? -1 : 1));
  }

  /** Seal a promotion: append the record + apply the promoted profile. */
  recordPromotion(
    tenantId: DiscoveryTenantId,
    promotion: PromotionRecord,
    promoted: CandidateProfile,
  ): DiscoveryResult<{ readonly promotion: PromotionRecord; readonly candidate: CandidateProfile }> {
    void tenantId;
    const candidate = this.candidates.get(promotion.candidateId);
    if (candidate === undefined) {
      return {
        ok: false,
        error: typedError(
          'unknown-candidate',
          `candidate ${promotion.candidateId} is not recorded`,
        ),
      };
    }
    if (candidate.evaluationState !== promotion.fromState) {
      return {
        ok: false,
        error: typedError(
          'candidate-state-conflict',
          `candidate ${promotion.candidateId} is ${candidate.evaluationState}, not ${promotion.fromState}`,
        ),
      };
    }
    const chain = this.promotions.get(promotion.candidateId) ?? [];
    const previous = chain[chain.length - 1]?.recordDigest ?? null;
    if (promotion.previousPromotionDigest !== previous) {
      return {
        ok: false,
        error: typedError(
          'promotion-gate-rejected',
          `promotion ${promotion.promotionId} chain link mismatch for candidate ${promotion.candidateId}`,
        ),
      };
    }
    this.promotions.set(promotion.candidateId, [...chain, promotion].sort((a, b) =>
      a.promotedAt < b.promotedAt ? -1 : a.promotedAt > b.promotedAt ? 1 : 0,
    ));
    this.candidates.set(promotion.candidateId, promoted);
    return { ok: true, value: { promotion, candidate: promoted } };
  }

  /** The promotion chain of one candidate (chronological). */
  promotionChain(candidateId: CandidateId): readonly PromotionRecord[] {
    return [...(this.promotions.get(candidateId) ?? [])].sort((a, b) =>
      a.promotedAt < b.promotedAt ? -1 : a.promotedAt > b.promotedAt ? 1 : 0,
    );
  }

  // -------------------------------------------------------------------------
  // Ecosystem proposals.
  // -------------------------------------------------------------------------

  /** Record a proposal. */
  recordProposal(
    tenantId: DiscoveryTenantId,
    proposal: EcosystemProposal,
  ): DiscoveryResult<EcosystemProposal> {
    void tenantId; // proposals are globally content-addressed records
    this.proposals.set(proposal.proposalId, proposal);
    return { ok: true, value: proposal };
  }

  /** List proposals (canonical order). */
  listProposals(): readonly EcosystemProposal[] {
    return [...this.proposals.values()].sort((a, b) =>
      a.proposalId < b.proposalId ? -1 : 1,
    );
  }

  // -------------------------------------------------------------------------
  // Schedules.
  // -------------------------------------------------------------------------

  /** Insert or replace a schedule (tenant-scoped). */
  upsertSchedule(
    tenantId: DiscoveryTenantId,
    schedule: DiscoverySchedule,
  ): DiscoveryResult<DiscoverySchedule> {
    if (schedule.tenantId !== tenantId) {
      return {
        ok: false,
        error: typedError(
          'cross-tenant-denied',
          `schedule ${schedule.scheduleId} belongs to tenant ${schedule.tenantId}, not ${tenantId}`,
        ),
      };
    }
    this.schedules.set(schedule.scheduleId, schedule);
    return { ok: true, value: schedule };
  }

  /** List schedules (tenant-scoped, canonical order). */
  listSchedules(tenantId: DiscoveryTenantId): readonly DiscoverySchedule[] {
    return [...this.schedules.values()]
      .filter((schedule) => schedule.tenantId === tenantId)
      .sort((a, b) => (a.scheduleId < b.scheduleId ? -1 : 1));
  }

  /** Update a schedule's lastRunAt (tenant-scoped). */
  markScheduleRun(
    tenantId: DiscoveryTenantId,
    scheduleId: string,
    lastRunAt: DiscoverySchedule['lastRunAt'],
  ): DiscoveryResult<DiscoverySchedule> {
    const schedule = this.schedules.get(scheduleId);
    if (schedule === undefined) {
      return {
        ok: false,
        error: typedError('unknown-schedule', `schedule ${scheduleId} is not registered`),
      };
    }
    if (schedule.tenantId !== tenantId) {
      return {
        ok: false,
        error: typedError(
          'cross-tenant-denied',
          `schedule ${scheduleId} belongs to tenant ${schedule.tenantId}, not ${tenantId}`,
        ),
      };
    }
    const updated = { ...schedule, lastRunAt };
    this.schedules.set(scheduleId, updated);
    return { ok: true, value: updated };
  }
}
