/**
 * Solution Navigator projection helpers (SN1.0, binding): synchronized
 * projections over the SAME identities — World View / Solution / Decision
 * / ProgramOfWork / Schedule / Acquisition / Realization / Verification /
 * Forecast / Outcomes / Learning, plus the observation/actual views the
 * canonical navigation traverses.
 *
 * - The Navigator is a PROJECTION LAYER, not a separate data model: every
 *   view is a pure fold over the sealed solution version chain, the
 *   ProgramOfWork, the DeliveryRecord, the DistinctionLedger and the
 *   acquisition requests — the SAME records, never copies with their own
 *   identities.
 * - Selection is IDENTITY-PRESERVING: `navigateFromWorldEntity` walks
 *   `world entity -> solution line -> work package -> activity ->
 *   observation -> actual -> verification -> outcome` by id, without
 *   creating duplicate records.
 * - Partial-data behavior (SN1.0): the projection stays useful with
 *   incomplete inputs — the program, delivery, ledger and acquisition
 *   inputs are all OPTIONAL; missing views project as empty, never as
 *   blockers.
 */
import type { BaselineApproval, SealedSolutionVersion } from './solution';
import type {
  SealedProgramOfWork,
  QuantitySchedule,
  CostSchedule,
  ResourceSchedule,
  MilestoneSchedule,
  RealizationSummary,
} from './program';
import {
  foldCostSchedule,
  foldMilestoneSchedule,
  foldQuantitySchedule,
  foldRealizationVariants,
  foldResourceSchedule,
} from './program';
import type { SealedDeliveryRecord } from './delivery';
import type { DistinctionLedger, SealedDistinctionRecord } from './distinctions';
import { foldDistinctionRecords } from './distinctions';
import type { AcquisitionRequestRecord } from './acquisition';
import type { SolutionPackProfile } from './lifecycle';
import { verifySolutionVersionChain } from './solution';
import { verifySealedProgramOfWork } from './program';
import { verifySealedDeliveryRecord } from './delivery';
import type { DeliveryResult } from './errors';

/** The inputs of one Navigator projection (all views optional except the solution). */
export interface NavigatorInputs {
  readonly solutionChain: readonly SealedSolutionVersion[];
  readonly approvals?: readonly BaselineApproval[] | undefined;
  readonly program?: SealedProgramOfWork | undefined;
  readonly delivery?: SealedDeliveryRecord | undefined;
  readonly ledger?: DistinctionLedger | undefined;
  readonly acquisitions?: readonly AcquisitionRequestRecord[] | undefined;
  readonly packProfile?: SolutionPackProfile | undefined;
}

/** One world-entity view: the entity plus the solution lines addressing it. */
export interface WorldEntityView {
  readonly entityId: string;
  readonly solutionLineIds: readonly string[];
}

/** One work-package view: identity, realization variant, activity ids. */
export interface WorkPackageView {
  readonly workPackageId: string;
  readonly realizationVariant: string;
  readonly activityIds: readonly string[];
  readonly solutionLineId?: string | undefined;
  readonly worldEntityId?: string | undefined;
}

/** One verification-gate view: identity plus the gated activity. */
export interface VerificationGateView {
  readonly gateId: string;
  readonly activityId: string;
  readonly title: string;
  readonly passedAt?: string | undefined;
}

/** One acquisition view: identity, variant, and state anchors. */
export interface AcquisitionRequestView {
  readonly acquisitionId: string;
  readonly variant: string;
  readonly requestedAt: string;
  readonly deliveryId?: string | undefined;
}

/** One observation view: identity, subject anchor, and review state. */
export interface ObservationView {
  readonly recordId: string;
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly observedAt: string;
  readonly accepted: boolean;
}

/** One actual view: identity plus the observation it was converted from. */
export interface ActualView {
  readonly recordId: string;
  readonly derivedFromObservationId: string;
  readonly actualizedAt: string;
}

/**
 * The synchronized Navigator projection — the SN1.0 views over the same
 * identities. The schedule view carries the deterministic
 * quantity/cost/resource/milestone folds; the forecast/outcomes/learning
 * views carry the distinction records of those kinds; the observation and
 * actual views carry the delivery facts the canonical navigation
 * traverses.
 */
export interface NavigatorProjection {
  readonly solutionId: string;
  readonly tenantId: string;
  readonly headVersion: string;
  readonly headDigest: string;
  readonly baselineApproved: boolean;
  readonly worldView: readonly WorldEntityView[];
  readonly solution: readonly {
    readonly lineId: string;
    readonly title: string;
    readonly quantity: { readonly value: string; readonly unit: string };
    readonly worldEntityId?: string | undefined;
  }[];
  readonly decision: readonly BaselineApproval[];
  readonly programOfWork: readonly WorkPackageView[];
  readonly schedule: {
    readonly quantity: QuantitySchedule;
    readonly cost: CostSchedule;
    readonly resource: ResourceSchedule;
    readonly milestone: MilestoneSchedule;
  };
  readonly acquisition: readonly AcquisitionRequestView[];
  readonly realization: RealizationSummary;
  readonly verification: readonly VerificationGateView[];
  readonly observations: readonly ObservationView[];
  readonly actuals: readonly ActualView[];
  readonly forecast: readonly SealedDistinctionRecord[];
  readonly outcomes: readonly SealedDistinctionRecord[];
  readonly learning: readonly SealedDistinctionRecord[];
  readonly packProfile?: SolutionPackProfile | undefined;
}

/**
 * Project the synchronized Navigator views. Total: the solution chain
 * must verify; the program/delivery/ledger must belong to the same
 * solution and tenant (`validation` / `cross-tenant-denied` otherwise).
 * Missing inputs project as EMPTY views (SN1.0 partial-data behavior —
 * the Navigator stays useful with incomplete inputs).
 */
export function projectNavigator(inputs: NavigatorInputs): DeliveryResult<NavigatorProjection> {
  const chain = verifySolutionVersionChain(inputs.solutionChain);
  if (!chain.ok) {
    return chain;
  }
  const ordered = [...inputs.solutionChain].sort((a, b) => (a.version < b.version ? -1 : 1));
  const head = ordered[ordered.length - 1]!;
  const approvals = [...(inputs.approvals ?? [])].sort((a, b) =>
    a.approvedAt < b.approvedAt ? -1 : 1,
  );
  const baselineApproved = approvals.some(
    (approval) => approval.baselineDigest === head.contentDigest,
  );
  if (inputs.program !== undefined) {
    const verified = verifySealedProgramOfWork(inputs.program);
    if (!verified.ok) {
      return verified;
    }
    if (
      verified.value.solutionId !== head.solutionId ||
      verified.value.tenantId !== head.tenantId
    ) {
      return {
        ok: false,
        error: {
          code: 'cross-tenant-denied',
          message: 'program of work does not belong to the projected solution/tenant',
          expectedTenantId: head.tenantId,
          encounteredTenantId: verified.value.tenantId,
        },
      };
    }
  }
  if (inputs.delivery !== undefined) {
    const verified = verifySealedDeliveryRecord(inputs.delivery);
    if (!verified.ok) {
      return verified;
    }
    if (
      verified.value.solutionId !== head.solutionId ||
      verified.value.tenantId !== head.tenantId
    ) {
      return {
        ok: false,
        error: {
          code: 'cross-tenant-denied',
          message: 'delivery record does not belong to the projected solution/tenant',
          expectedTenantId: head.tenantId,
          encounteredTenantId: verified.value.tenantId,
        },
      };
    }
  }
  if (inputs.ledger !== undefined && inputs.ledger.solutionId !== head.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `distinction ledger is scoped to solution "${inputs.ledger.solutionId}" but the projection is scoped to "${head.solutionId}"`,
        issues: [{ path: 'ledger.solutionId', message: 'projection input mixes solutions' }],
      },
    };
  }

  // World view: entity -> solution lines (identity-preserving).
  const entityMap = new Map<string, string[]>();
  for (const line of head.solutionLines) {
    if (line.worldEntityId === undefined) {
      continue;
    }
    const lines = entityMap.get(line.worldEntityId) ?? [];
    lines.push(line.lineId);
    entityMap.set(line.worldEntityId, lines);
  }
  const worldView = [...entityMap.entries()]
    .map(([entityId, solutionLineIds]) => ({
      entityId,
      solutionLineIds: [...solutionLineIds].sort(),
    }))
    .sort((a, b) => (a.entityId < b.entityId ? -1 : 1));

  const program = inputs.program;
  const delivery = inputs.delivery;
  const programOfWork: WorkPackageView[] = (program?.workPackages ?? []).map((workPackage) => ({
    workPackageId: workPackage.workPackageId,
    realizationVariant: workPackage.realizationVariant,
    activityIds: workPackage.activities.map((activity) => activity.activityId),
    solutionLineId: workPackage.solutionLineId,
    worldEntityId: workPackage.worldEntityId,
  }));

  const folded = foldDistinctionRecords(
    inputs.ledger ?? { tenantId: head.tenantId, solutionId: head.solutionId, records: [] },
  );

  const projection: NavigatorProjection = {
    solutionId: head.solutionId,
    tenantId: head.tenantId,
    headVersion: head.version,
    headDigest: head.contentDigest,
    baselineApproved,
    worldView,
    solution: head.solutionLines.map((line) => ({
      lineId: line.lineId,
      title: line.title,
      quantity: line.quantity,
      worldEntityId: line.worldEntityId,
    })),
    decision: approvals,
    programOfWork,
    schedule: program
      ? {
          quantity: foldQuantitySchedule(program),
          cost: foldCostSchedule(program),
          resource: foldResourceSchedule(program),
          milestone: foldMilestoneSchedule(program),
        }
      : {
          quantity: { rows: [], totals: [] },
          cost: { rows: [], totals: [] },
          resource: { rows: [] },
          milestone: { rows: [], counts: { planned: 0, reached: 0, missed: 0 } },
        },
    acquisition: (inputs.acquisitions ?? [])
      .map((request) => ({
        acquisitionId: request.acquisitionId,
        variant: request.detail.variant,
        requestedAt: request.requestedAt,
        deliveryId: request.deliveryId,
      }))
      .sort((a, b) => (a.acquisitionId < b.acquisitionId ? -1 : 1)),
    realization: program
      ? foldRealizationVariants(program)
      : {
          counts: {
            'construction-build': 0,
            'software-implementation-deployment': 0,
            'mechanical-fabrication-assembly': 0,
            'electrical-installation-commissioning': 0,
            manufacturing: 0,
            'infrastructure-provisioning': 0,
            'field-service-repair': 0,
          },
        },
    verification: (program?.workPackages ?? [])
      .flatMap((workPackage) =>
        workPackage.verificationGates.map((gate) => ({
          gateId: gate.gateId,
          activityId: gate.activityId,
          title: gate.title,
          passedAt: gate.passedAt,
        })),
      )
      .sort((a, b) => (a.gateId < b.gateId ? -1 : 1)),
    observations: (delivery?.observations ?? [])
      .map((observation) => ({
        recordId: observation.recordId,
        subjectKind: observation.subject.subjectKind,
        subjectId: observation.subject.subjectId,
        observedAt: observation.payload.observedAt,
        accepted:
          delivery?.acceptedObservationIds.includes(observation.recordId) ?? false,
      }))
      .sort((a, b) => (a.recordId < b.recordId ? -1 : 1)),
    actuals: (delivery?.actuals ?? [])
      .map((actual) => ({
        recordId: actual.recordId,
        derivedFromObservationId: actual.payload.derivedFromObservationId,
        actualizedAt: actual.payload.actualizedAt,
      }))
      .sort((a, b) => (a.recordId < b.recordId ? -1 : 1)),
    forecast: folded.forecast,
    outcomes: folded.outcome,
    learning: folded.learning,
    packProfile: inputs.packProfile,
  };
  return { ok: true, value: projection };
}

/** The identity-preserving chain from one world entity (SN1.0 canonical navigation). */
export interface WorldEntityChain {
  readonly entityId: string;
  readonly solutionLineIds: readonly string[];
  readonly workPackageIds: readonly string[];
  readonly activityIds: readonly string[];
  readonly observationIds: readonly string[];
  readonly actualIds: readonly string[];
  readonly gateIds: readonly string[];
  readonly outcomeIds: readonly string[];
}

/**
 * Navigate the canonical chain from one world entity: `world entity ->
 * solution line -> work package -> activity -> observation -> actual ->
 * verification -> outcome`, IDENTITY-PRESERVING — every step references
 * the SAME records by id; no duplicates are created anywhere.
 */
export function navigateFromWorldEntity(
  projection: NavigatorProjection,
  entityId: string,
): WorldEntityChain {
  const solutionLineIds =
    projection.worldView.find((view) => view.entityId === entityId)?.solutionLineIds ?? [];
  const solutionLineIdSet = new Set(solutionLineIds);
  const workPackages = projection.programOfWork.filter(
    (view) =>
      view.worldEntityId === entityId ||
      (view.solutionLineId !== undefined && solutionLineIdSet.has(view.solutionLineId)),
  );
  const workPackageIds = workPackages.map((view) => view.workPackageId);
  const activityIds = workPackages.flatMap((view) => view.activityIds);
  const activityIdSet = new Set(activityIds);
  const observationIds = projection.observations
    .filter((observation) => activityIdSet.has(observation.subjectId))
    .map((observation) => observation.recordId);
  const observationIdSet = new Set(observationIds);
  const actualIds = projection.actuals
    .filter((actual) => observationIdSet.has(actual.derivedFromObservationId))
    .map((actual) => actual.recordId);
  const gateIds = projection.verification
    .filter((gate) => activityIdSet.has(gate.activityId))
    .map((gate) => gate.gateId);
  const outcomeIds = projection.outcomes
    .filter(
      (outcome) =>
        (outcome.subject.subjectKind === 'solution' &&
          outcome.subject.subjectId === projection.solutionId) ||
        (outcome.subject.subjectKind === 'activity' &&
          activityIdSet.has(outcome.subject.subjectId)) ||
        (outcome.subject.subjectKind === 'work-package' &&
          workPackageIds.includes(outcome.subject.subjectId)) ||
        (outcome.subject.subjectKind === 'solution-line' &&
          solutionLineIdSet.has(outcome.subject.subjectId)),
    )
    .map((outcome) => outcome.recordId);
  return {
    entityId,
    solutionLineIds,
    workPackageIds,
    activityIds,
    observationIds,
    actualIds,
    gateIds,
    outcomeIds,
  };
}

/**
 * Flatten every identity of one chain (for identity-preservation checks:
 * the traversal must not create duplicate records — every id appears
 * exactly once).
 */
export function navigatorChainIdentities(chain: WorldEntityChain): readonly string[] {
  return [
    `world:${chain.entityId}`,
    ...chain.solutionLineIds,
    ...chain.workPackageIds,
    ...chain.activityIds,
    ...chain.observationIds,
    ...chain.actualIds,
    ...chain.gateIds,
    ...chain.outcomeIds,
  ];
}
