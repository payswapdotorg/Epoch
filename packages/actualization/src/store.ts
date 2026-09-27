/**
 * The reference in-memory ACTUALIZATION STORE (one tenant/solution/
 * delivery scope): the append-only admission surface for intaken
 * observations, conflict resolutions, and calibration comparison facts.
 *
 * - Every admission is TOTAL (typed errors, never exceptions) and
 *   IDEMPOTENT for exact re-admission (sealed prior records);
 * - conflict resolutions bind the EXACT assessment revision re-derived
 *   from the CURRENT store state — a stale assessment (new observations
 *   arrived) is a typed `dangling-reference-rejected`;
 * - comparison facts are immutable history: the same fact id with
 *   different content, or a different fact for the same (forecast,
 *   actual) pair, is a typed `history-immutable`;
 * - ZERO wall-clock, ZERO randomness: every instant is caller-supplied;
 *   every list is canonically ordered (input order never leaks).
 */
import type { ObservationRecord } from '@epoch/solution-delivery';
import {
  admitObservationRecord,
  assessValidation,
  effectiveGroupState,
  verifySealedConflictResolution,
  type ObservationIntakeOutcome,
  type ReconciliationPolicy,
  type SealedConflictResolution,
  type SealedValidationAssessment,
} from './validation';
import {
  verifySealedComparisonFact,
  type SealedComparisonFact,
} from './calibration';
import type { ActualizationResult } from './errors';

/** The state of one actualization store after admissions. */
export interface ActualizationStore {
  readonly tenantId: string;
  readonly solutionId: string;
  readonly deliveryId: string;
  readonly observations: readonly ObservationRecord[];
  readonly resolutions: readonly SealedConflictResolution[];
  readonly comparisonFacts: readonly SealedComparisonFact[];
}

/** Open (validate + create) one actualization store for a delivery scope. */
export function openActualizationStore(scope: {
  readonly tenantId: string;
  readonly solutionId: string;
  readonly deliveryId: string;
}): ActualizationStore {
  return {
    tenantId: scope.tenantId,
    solutionId: scope.solutionId,
    deliveryId: scope.deliveryId,
    observations: [],
    resolutions: [],
    comparisonFacts: [],
  };
}

/**
 * INTAKE one sealed W036 observation record (append-only, idempotent):
 * the typed admission engine of {@link admitObservationRecord} —
 * verification, tenant/delivery scope, duplicate handling, and the
 * `actualization-bypass-rejected` guard against non-observation kinds.
 */
export function intakeObservation(
  store: ActualizationStore,
  observation: unknown,
): ActualizationResult<{
  readonly store: ActualizationStore;
  readonly admission: ObservationIntakeOutcome;
}> {
  const admitted = admitObservationRecord(store, store.observations, observation);
  if (!admitted.ok) {
    return admitted;
  }
  return {
    ok: true,
    value: { store: { ...store, observations: admitted.value.observations }, admission: admitted.value.admission },
  };
}

/**
 * The derived validation assessments of the CURRENT store state (the
 * deterministic fold — assessments are never stored; identical store
 * states derive identical assessment ids and digests).
 */
export function currentAssessments(
  store: ActualizationStore,
  policy: ReconciliationPolicy,
): ActualizationResult<readonly SealedValidationAssessment[]> {
  return assessValidation(store, store.observations, policy);
}

/**
 * ADMIT one sealed conflict resolution (append-only). The resolution
 * must verify, match the store scope, bind an assessment revision that
 * the CURRENT store re-derives under the SUPPLIED policy (a stale
 * assessment revision or policy mismatch is a typed
 * `dangling-reference-rejected`), resolve a CONFLICTING group, and
 * partition its observation set exactly.
 */
export function admitConflictResolution(
  store: ActualizationStore,
  resolution: unknown,
  policy: ReconciliationPolicy,
): ActualizationResult<ActualizationStore> {
  const verified = verifySealedConflictResolution(resolution);
  if (!verified.ok) {
    return verified;
  }
  const admitted = verified.value;
  if (admitted.tenantId !== store.tenantId || admitted.deliveryId !== store.deliveryId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `resolution "${admitted.resolutionId}" is scoped to (${admitted.tenantId}, ${admitted.deliveryId}) but the store is scoped to (${store.tenantId}, ${store.deliveryId}) (R12)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: admitted.tenantId,
        subject: admitted.resolutionId,
      },
    };
  }
  if (admitted.solutionId !== store.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `resolution "${admitted.resolutionId}" subjects solution "${admitted.solutionId}" but the store is scoped to "${store.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'resolution/store solution mismatch' }],
      },
    };
  }
  const existing = store.resolutions.find((candidate) => candidate.resolutionId === admitted.resolutionId);
  if (existing !== undefined) {
    if (existing.contentDigest === admitted.contentDigest) {
      return { ok: true, value: store };
    }
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `resolution "${admitted.resolutionId}" is already admitted with different content — a sealed resolution is immutable; changed content ships as a NEW resolution id`,
        subject: 'conflict-resolution',
        subjectId: admitted.resolutionId,
        publishedDigest: existing.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  // The bound assessment revision must be re-derivable from the CURRENT
  // store state under the supplied policy (the W037 exact-revision
  // admission discipline).
  const assessments = assessValidation(store, store.observations, policy);
  if (!assessments.ok) {
    return assessments;
  }
  const bound = assessments.value.find(
    (candidate) =>
      candidate.assessmentId === admitted.assessmentRef.assessmentId &&
      candidate.contentDigest === admitted.assessmentRef.contentDigest,
  );
  if (bound === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `resolution "${admitted.resolutionId}" binds assessment revision (${admitted.assessmentRef.assessmentId} @ ${admitted.assessmentRef.contentDigest.slice(0, 8)}…) which the CURRENT store state does not derive — new observations arrived; re-assess and re-resolve`,
        referenceKind: 'validation-assessment',
        referenceId: admitted.assessmentRef.assessmentId,
      },
    };
  }
  if (bound.state !== 'conflicting') {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `resolution "${admitted.resolutionId}" binds assessment "${bound.assessmentId}" whose observation group is ${bound.state.toUpperCase()} — a conflict resolution resolves CONFLICTING groups only`,
        issues: [
          { path: 'assessmentRef', message: 'resolutions bind conflicting assessments only' },
        ],
      },
    };
  }
  // The selected + excluded sets must partition the assessment's
  // observation set exactly.
  const assessmentIds = new Set(bound.observationRefs.map((ref) => ref.recordId));
  const selectedIds = new Set(admitted.selectedObservationRefs.map((ref) => ref.recordId));
  const excludedIds = new Set(admitted.excludedObservationRefs.map((ref) => ref.recordId));
  for (const ref of admitted.selectedObservationRefs) {
    if (!assessmentIds.has(ref.recordId)) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `resolution "${admitted.resolutionId}" selects observation "${ref.recordId}" which is not part of assessment "${bound.assessmentId}"`,
          referenceKind: 'observation',
          referenceId: ref.recordId,
        },
      };
    }
  }
  for (const ref of admitted.excludedObservationRefs) {
    if (!assessmentIds.has(ref.recordId) || selectedIds.has(ref.recordId)) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `resolution "${admitted.resolutionId}" excludes observation "${ref.recordId}" which is not part of assessment "${bound.assessmentId}" (or is also selected)`,
          referenceKind: 'observation',
          referenceId: ref.recordId,
        },
      };
    }
  }
  for (const id of assessmentIds) {
    if (!selectedIds.has(id) && !excludedIds.has(id)) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `resolution "${admitted.resolutionId}" does not partition assessment "${bound.assessmentId}": observation "${id}" is neither selected nor excluded`,
          issues: [{ path: 'excludedObservationRefs', message: 'the resolution must partition the assessment observation set' }],
        },
      };
    }
  }
  return { ok: true, value: { ...store, resolutions: [...store.resolutions, admitted] } };
}

/**
 * ADMIT one sealed comparison fact (append-only, immutable history):
 *
 * - the fact verifies (tamper detection) and matches the store scope;
 * - the same fact id with different content is a typed
 *   `history-immutable` (history is never modified);
 * - a different fact for the SAME (forecast, actual) record pair is a
 *   typed `history-immutable` (the historical verdict of a pair is
 *   fixed; re-comparison after new actuals ships as a comparison against
 *   the NEW revision);
 * - exact re-admission is idempotent.
 */
export function admitComparisonFact(
  store: ActualizationStore,
  fact: unknown,
): ActualizationResult<ActualizationStore> {
  const verified = verifySealedComparisonFact(fact);
  if (!verified.ok) {
    return verified;
  }
  const admitted = verified.value;
  if (admitted.tenantId !== store.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `comparison fact "${admitted.factId}" belongs to tenant "${admitted.tenantId}" but the store is scoped to "${store.tenantId}" (R12)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: admitted.tenantId,
        subject: admitted.factId,
      },
    };
  }
  if (admitted.solutionId !== store.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `comparison fact "${admitted.factId}" subjects solution "${admitted.solutionId}" but the store is scoped to "${store.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'fact/store solution mismatch' }],
      },
    };
  }
  const existingById = store.comparisonFacts.find((candidate) => candidate.factId === admitted.factId);
  if (existingById !== undefined) {
    if (existingById.contentDigest === admitted.contentDigest) {
      return { ok: true, value: store };
    }
    return {
      ok: false,
      error: {
        code: 'history-immutable',
        message: `comparison fact "${admitted.factId}" is already admitted with different content — the historical comparison record is immutable; changed content ships as a NEW fact id`,
        subject: 'comparison-fact',
        subjectId: admitted.factId,
        publishedDigest: existingById.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  const existingPair = store.comparisonFacts.find(
    (candidate) =>
      candidate.forecastRef.recordId === admitted.forecastRef.recordId &&
      candidate.actualRef.recordId === admitted.actualRef.recordId,
  );
  if (existingPair !== undefined) {
    return {
      ok: false,
      error: {
        code: 'history-immutable',
        message: `the (${admitted.forecastRef.recordId}, ${admitted.actualRef.recordId}) pair is already judged by fact "${existingPair.factId}" — the historical verdict of a forecast/actual pair is immutable; comparison against new actuals ships as a NEW pair`,
        subject: 'comparison-fact-pair',
        subjectId: `${admitted.forecastRef.recordId}->${admitted.actualRef.recordId}`,
        publishedDigest: existingPair.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  return { ok: true, value: { ...store, comparisonFacts: [...store.comparisonFacts, admitted] } };
}

/** The store fold: observations sorted by recordId (deterministic). */
export function foldObservations(store: ActualizationStore): readonly ObservationRecord[] {
  return [...store.observations].sort((a, b) => (a.recordId < b.recordId ? -1 : 1));
}

/** The store fold: resolutions sorted by resolutionId (deterministic). */
export function foldResolutions(store: ActualizationStore): readonly SealedConflictResolution[] {
  return [...store.resolutions].sort((a, b) => (a.resolutionId < b.resolutionId ? -1 : 1));
}

/** The store fold: comparison facts sorted by factId (deterministic). */
export function foldComparisonFacts(store: ActualizationStore): readonly SealedComparisonFact[] {
  return [...store.comparisonFacts].sort((a, b) => (a.factId < b.factId ? -1 : 1));
}

/** The effective typed validation state of every group (assessment + resolutions). */
export function effectiveValidationStates(
  store: ActualizationStore,
  policy: ReconciliationPolicy,
): ActualizationResult<readonly (readonly [SealedValidationAssessment, string])[]> {
  const assessments = currentAssessments(store, policy);
  if (!assessments.ok) {
    return assessments;
  }
  return {
    ok: true,
    value: assessments.value.map(
      (assessment) => [assessment, effectiveGroupState(assessment, store.resolutions)] as const,
    ),
  };
}
