/**
 * The DERIVED ACTUALIZATION-STATE PROJECTION: the deterministic read
 * model over one actualization store + the sealed W036 delivery state
 * it folds toward. Pure fold — never stored, never mutated; every list
 * is canonically ordered (input order never leaks).
 *
 * The projection layers:
 * - the delivery-state summary (status, digest, observation review
 *   counts, the W036 `foldDeliveryActuals` totals);
 * - the VALIDATION GROUPS: per (subject, measure, unit/currency) group,
 *   the effective typed validation state (insufficient / corroborated /
 *   conflicting / resolved), the folded measure, the deviation
 *   magnitude, and the bound resolution when resolved;
 * - the CALIBRATION groups: per subject comparison group, the
 *   deterministic calibration fold (bias counts, exact total absolute
 *   deviation, worst deviation, derived confidence).
 */
import {
  foldDeliveryActuals,
  verifySealedDeliveryRecord,
  type DeliveryActualsSummary,
  type SealedDeliveryRecord,
} from '@epoch/solution-delivery';
import {
  currentAssessments,
  foldComparisonFacts,
  type ActualizationStore,
} from './store';
import { effectiveGroupState, type ReconciliationPolicy } from './validation';
import { foldCalibration, type SealedCalibrationState } from './calibration';
import { adaptDeliveryResult } from './w036-adapter';
import type { ActualizationResult } from './errors';

/** One validation group row of the projection. */
export interface ValidationGroupRow {
  readonly subjectKind: string;
  readonly subjectId: string;
  readonly measureKind: 'quantity' | 'cost' | 'progress' | 'instant';
  readonly unit?: string | undefined;
  readonly currency?: string | undefined;
  readonly state: 'insufficient' | 'corroborated' | 'conflicting' | 'resolved';
  readonly observationCount: number;
  readonly deviationMagnitude: string;
  readonly assessmentId: string;
  readonly resolutionId?: string | undefined;
  readonly foldedMeasure: unknown;
}

/** The complete derived actualization-state projection. */
export interface ActualizationStateProjection {
  readonly tenantId: string;
  readonly solutionId: string;
  readonly deliveryId: string;
  readonly deliveryStatus: 'open' | 'closed';
  readonly deliveryDigest: string;
  readonly observationCounts: Readonly<{ total: number; accepted: number; rejected: number; proposed: number }>;
  readonly actualsSummary: DeliveryActualsSummary;
  readonly validationGroups: readonly ValidationGroupRow[];
  readonly calibrationStates: readonly SealedCalibrationState[];
}

/**
 * Project the derived actualization state: the delivery summary + the
 * validation groups (assessed under the supplied policy, resolved
 * through the admitted resolutions) + the calibration folds of every
 * comparison-fact subject group. Deterministic: identical store +
 * delivery + policy derive byte-identical projections.
 */
export function projectActualizationState(
  store: ActualizationStore,
  delivery: SealedDeliveryRecord,
  policy: ReconciliationPolicy,
): ActualizationResult<ActualizationStateProjection> {
  const verifiedDelivery = verifySealedDeliveryRecord(delivery);
  if (!verifiedDelivery.ok) {
    return adaptDeliveryResult(verifiedDelivery, delivery.deliveryId);
  }
  const state = verifiedDelivery.value;
  if (state.tenantId !== store.tenantId || state.deliveryId !== store.deliveryId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `the delivery (${state.tenantId}, ${state.deliveryId}) does not ground the actualization store (${store.tenantId}, ${store.deliveryId}) (R12)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: state.tenantId,
        subject: state.deliveryId,
      },
    };
  }
  if (state.solutionId !== store.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `the delivery subjects solution "${state.solutionId}" but the store is scoped to "${store.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'delivery/store solution mismatch' }],
      },
    };
  }
  const assessments = currentAssessments(store, policy);
  if (!assessments.ok) {
    return assessments;
  }
  const validationGroups: ValidationGroupRow[] = assessments.value.map((assessment) => {
    const effectiveState = effectiveGroupState(assessment, store.resolutions);
    const resolution =
      effectiveState === 'resolved'
        ? store.resolutions.find(
            (candidate) =>
              candidate.assessmentRef.assessmentId === assessment.assessmentId &&
              candidate.assessmentRef.contentDigest === assessment.contentDigest,
          )
        : undefined;
    return {
      subjectKind: assessment.subject.subjectKind,
      subjectId: assessment.subject.subjectId,
      measureKind: assessment.measureKind,
      ...(assessment.unit !== undefined ? { unit: assessment.unit } : {}),
      ...(assessment.currency !== undefined ? { currency: assessment.currency } : {}),
      state: effectiveState,
      observationCount: assessment.observationRefs.length,
      deviationMagnitude: assessment.deviationMagnitude,
      assessmentId: assessment.assessmentId,
      ...(resolution !== undefined ? { resolutionId: resolution.resolutionId } : {}),
      foldedMeasure: assessment.foldedMeasure,
    };
  });
  validationGroups.sort((a, b) => {
    if (a.subjectKind !== b.subjectKind) return a.subjectKind < b.subjectKind ? -1 : 1;
    if (a.subjectId !== b.subjectId) return a.subjectId < b.subjectId ? -1 : 1;
    if (a.measureKind !== b.measureKind) return a.measureKind < b.measureKind ? -1 : 1;
    return (a.unit ?? a.currency ?? '') < (b.unit ?? b.currency ?? '') ? -1 : 1;
  });

  // Calibration folds per comparison-fact subject group (deterministic
  // grouping; empty groups cannot exist — facts carry subjects).
  const subjectGroups = new Map<string, {
    readonly subjectKind: string;
    readonly subjectId: string;
    readonly facts: ReturnType<typeof foldComparisonFacts>;
  }>();
  for (const fact of foldComparisonFacts(store)) {
    const key = `${fact.subject.subjectKind}\u0000${fact.subject.subjectId}`;
    const existing = subjectGroups.get(key);
    if (existing === undefined) {
      subjectGroups.set(key, {
        subjectKind: fact.subject.subjectKind,
        subjectId: fact.subject.subjectId,
        facts: [fact],
      });
    } else {
      subjectGroups.set(key, { ...existing, facts: [...existing.facts, fact] });
    }
  }
  const calibrationStates: SealedCalibrationState[] = [];
  for (const group of [...subjectGroups.values()].sort((a, b) =>
    `${a.subjectKind}\u0000${a.subjectId}` < `${b.subjectKind}\u0000${b.subjectId}` ? -1 : 1,
  )) {
    const folded = foldCalibration(
      store,
      {
        solutionId: store.solutionId,
        subjectKind: group.subjectKind,
        subjectId: group.subjectId,
      },
      group.facts,
    );
    if (!folded.ok) {
      return folded;
    }
    calibrationStates.push(folded.value);
  }
  calibrationStates.sort((a, b) => (a.calibrationId < b.calibrationId ? -1 : 1));

  return {
    ok: true,
    value: {
      tenantId: store.tenantId,
      solutionId: store.solutionId,
      deliveryId: store.deliveryId,
      deliveryStatus: state.status,
      deliveryDigest: state.contentDigest,
      observationCounts: {
        total: state.observations.length,
        accepted: state.acceptedObservationIds.length,
        rejected: state.rejectedObservationIds.length,
        proposed:
          state.observations.length -
          state.acceptedObservationIds.length -
          state.rejectedObservationIds.length,
      },
      actualsSummary: foldDeliveryActuals(state),
      validationGroups,
      calibrationStates,
    },
  };
}
