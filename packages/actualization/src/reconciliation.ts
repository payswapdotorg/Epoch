/**
 * RECONCILIATION APPLICATION (the W039 pin): the deterministic FOLD of
 * validated observations into authoritative actuals, applied
 * EXCLUSIVELY through the W036 DeliveryRecord authority path
 * (recordObservation -> acceptObservation -> actualizeObservation).
 *
 * This module contains NO code that seals an `actual` distinction record
 * or appends to `delivery.actuals` directly: actuals are minted by the
 * W036 `actualizeObservation` authority alone. The typed guards:
 *
 * - a CONFLICTING group without a sealed resolution is a typed
 *   `conflict-unresolved-rejected`;
 * - an INSUFFICIENT group (below the policy quorum) is a typed
 *   `insufficient-observations-rejected`;
 * - every provided record must be a sealed W036 OBSERVATION record whose
 *   exact revision matches the assessment's observation references — an
 *   `actual` record (the bypass attempt) is a typed
 *   `actualization-bypass-rejected` (the W038 precedent);
 * - an observation already actualized is an idempotent
 *   `already-actualized` skip (replay never re-actualizes);
 * - a resolution binding a different assessment revision than the
 *   supplied one is a typed `dangling-reference-rejected`.
 */
import {
  acceptObservation,
  actualizeObservation,
  foldDeliveryActuals,
  recordObservation,
  verifySealedDeliveryRecord,
  type DeliveryActualsSummary,
  type ObservationRecord,
  type SealedDeliveryRecord,
  type SealedDistinctionRecord,
  verifySealedDistinctionRecord,
} from '@epoch/solution-delivery';
import {
  actualIdOfObservation,
} from './version';
import { adaptDeliveryResult } from './w036-adapter';
import type { ActualizationResult } from './errors';
import type { SealedValidationAssessment, SealedConflictResolution } from './validation';

/** The application provenance supplied by the authority operator. */
export interface ReconciliationApplication {
  readonly acceptedBy: string;
  readonly acceptedAt: string;
  readonly actualizedBy: string;
  readonly actualizedAt: string;
}

/** The outcome of one observation's actualization. */
export type ActualizationApplicationOutcome =
  | { readonly observationId: string; readonly actualId: string; readonly outcome: 'actualized' }
  | {
      readonly observationId: string;
      readonly actualId: string;
      readonly outcome: 'already-actualized';
    };

/** The result of applying one assessment: next delivery state + outcomes + the fold summary. */
export interface ActualizationApplicationResult {
  readonly delivery: SealedDeliveryRecord;
  readonly applications: readonly ActualizationApplicationOutcome[];
  readonly summary: DeliveryActualsSummary;
}

/**
 * Apply one validated (or resolved) observation group to a sealed
 * delivery record — the ONLY bridge from validated observations to
 * authoritative delivery state, and it flows exclusively through the
 * W036 authority path:
 *
 * 1. the delivery verifies (W036 digest recomputation — tamper
 *    detection);
 * 2. the assessment verifies (digest recomputation) and must target the
 *    same delivery/tenant;
 * 3. the resolution (when supplied) verifies and binds the EXACT
 *    assessment revision;
 * 4. the group state gates admission:
 *    `conflicting` without resolution -> `conflict-unresolved-rejected`;
 *    `insufficient` -> `insufficient-observations-rejected`;
 * 5. per observation (sorted by recordId — deterministic):
 *    a. the record verifies through the REAL W036 machinery and must be
 *       of kind `observation` with the EXACT digest the assessment
 *       references (bypass/tamper detection);
 *    b. `recordObservation` (W036) appends it when absent (an
 *       already-present observation with the same digest is a skip;
 *       different content under the same id is the W036
 *       `version-conflict`, never an overwrite);
 *    c. `acceptObservation` (W036) moves it into the accepted set;
 *    d. `actualizeObservation` (W036) mints the actual under the
 *       deterministically derived actual id — an observation already
 *       actualized is an idempotent `already-actualized` skip.
 */
export function applyActualization(
  delivery: SealedDeliveryRecord,
  assessment: SealedValidationAssessment,
  observations: readonly SealedDistinctionRecord[],
  application: ReconciliationApplication,
  resolution?: SealedConflictResolution | undefined,
): ActualizationResult<ActualizationApplicationResult> {
  return applyGroupActualization({
    delivery,
    assessment,
    resolution: resolution ?? null,
    observations,
    application,
  });
}

/** The keyword form of {@link applyActualization}. */
export function applyGroupActualization(input: {
  readonly delivery: SealedDeliveryRecord;
  readonly assessment: SealedValidationAssessment;
  readonly resolution: SealedConflictResolution | null;
  readonly observations: readonly SealedDistinctionRecord[];
  readonly application: ReconciliationApplication;
}): ActualizationResult<ActualizationApplicationResult> {
  const verifiedDelivery = verifySealedDeliveryRecord(input.delivery);
  if (!verifiedDelivery.ok) {
    return adaptDeliveryResult(verifiedDelivery, input.delivery.deliveryId);
  }
  let current = verifiedDelivery.value;
  const assessment = input.assessment;

  if (assessment.tenantId !== current.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `assessment "${assessment.assessmentId}" belongs to tenant "${assessment.tenantId}" but the delivery is scoped to "${current.tenantId}" (R12)`,
        expectedTenantId: current.tenantId,
        encounteredTenantId: assessment.tenantId,
        subject: assessment.assessmentId,
      },
    };
  }
  if (assessment.deliveryId !== current.deliveryId) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `assessment "${assessment.assessmentId}" targets delivery "${assessment.deliveryId}" but the applied delivery is "${current.deliveryId}"`,
        referenceKind: 'delivery-record',
        referenceId: assessment.deliveryId,
      },
    };
  }

  // The resolution gate: a conflicting group REQUIRES an exact-revision
  // resolution; a resolution must bind THIS assessment revision.
  if (input.resolution !== null) {
    const resolution = input.resolution;
    if (
      resolution.assessmentRef.assessmentId !== assessment.assessmentId ||
      resolution.assessmentRef.contentDigest !== assessment.contentDigest
    ) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `resolution "${resolution.resolutionId}" binds assessment revision (${resolution.assessmentRef.assessmentId} @ ${resolution.assessmentRef.contentDigest.slice(0, 8)}) but the applied assessment is (${assessment.assessmentId} @ ${assessment.contentDigest.slice(0, 8)}) — resolutions bind EXACT assessment revisions`,
          referenceKind: 'validation-assessment',
          referenceId: resolution.assessmentRef.assessmentId,
        },
      };
    }
    if (resolution.tenantId !== current.tenantId || resolution.deliveryId !== current.deliveryId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `resolution "${resolution.resolutionId}" is scoped to (${resolution.tenantId}, ${resolution.deliveryId}) but the applied delivery is (${current.tenantId}, ${current.deliveryId}) (R12)`,
          expectedTenantId: current.tenantId,
          encounteredTenantId: resolution.tenantId,
          subject: resolution.resolutionId,
        },
      };
    }
    if (assessment.state !== 'conflicting') {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `resolution "${resolution.resolutionId}" binds assessment "${assessment.assessmentId}" whose observation group is ${assessment.state.toUpperCase()} — a conflict resolution resolves CONFLICTING groups only`,
          issues: [
            {
              path: 'assessmentRef',
              message: 'resolutions bind conflicting assessments only',
            },
          ],
        },
      };
    }
  }
  if (assessment.state === 'conflicting' && input.resolution === null) {
    return {
      ok: false,
      error: {
        code: 'conflict-unresolved-rejected',
        message: `assessment "${assessment.assessmentId}" folds a CONFLICTING observation group (${assessment.observationRefs.length} observations, max deviation ${assessment.deviationMagnitude}) — a sealed conflict resolution must select the authoritative subset before actualization`,
        assessmentId: assessment.assessmentId,
        observationCount: assessment.observationRefs.length,
      },
    };
  }
  if (assessment.state === 'insufficient') {
    return {
      ok: false,
      error: {
        code: 'insufficient-observations-rejected',
        message: `assessment "${assessment.assessmentId}" folds an INSUFFICIENT observation group (${assessment.observationRefs.length} observations; the policy quorum is ${assessment.policy.quorum ?? 1}) — more accepted evidence is required before actualization`,
        assessmentId: assessment.assessmentId,
        observationCount: assessment.observationRefs.length,
        quorum: assessment.policy.quorum ?? 1,
      },
    };
  }

  // The fold set: the resolution's SELECTED subset when resolved; the
  // assessment's full reference set when corroborated.
  const foldRefs =
    input.resolution !== null
      ? input.resolution.selectedObservationRefs
      : assessment.observationRefs;

  // Index the provided records by id (exact-revision verification below).
  const provided = new Map<string, ObservationRecord>();
  for (const record of input.observations) {
    if (record.kind !== 'observation') {
      return {
        ok: false,
        error: {
          code: 'actualization-bypass-rejected',
          message:
            `record "${record.recordId}" is of kind "${record.kind}" — reconciliation carries OBSERVATION records only; ` +
            'actualization flows through the W036 DeliveryRecord acceptance/actualization path and this package never writes Actual records directly',
          recordId: record.recordId,
          recordKind: record.kind,
        },
      };
    }
    if (record.tenantId !== current.tenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `observation "${record.recordId}" belongs to tenant "${record.tenantId}" but the delivery is scoped to "${current.tenantId}" (R12)`,
          expectedTenantId: current.tenantId,
          encounteredTenantId: record.tenantId,
          subject: record.recordId,
        },
      };
    }
    provided.set(record.recordId, record);
  }

  const applications: ActualizationApplicationOutcome[] = [];
  for (const ref of [...foldRefs].sort((a, b) => (a.recordId < b.recordId ? -1 : 1))) {
    const observation = provided.get(ref.recordId);
    if (observation === undefined) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `observation "${ref.recordId}" of the fold set was not provided — every folded observation flows through the W036 authority path as a sealed record`,
          referenceKind: 'observation',
          referenceId: ref.recordId,
        },
      };
    }
    const verifiedObservation = verifySealedDistinctionRecord(observation);
    if (!verifiedObservation.ok) {
      return adaptDeliveryResult(verifiedObservation, observation.recordId);
    }
    if (verifiedObservation.value.contentDigest !== ref.contentDigest) {
      return {
        ok: false,
        error: {
          code: 'digest-mismatch',
          message: `observation "${ref.recordId}" content digest ${verifiedObservation.value.contentDigest.slice(0, 8)}… does not match the assessment reference digest ${ref.contentDigest.slice(0, 8)}… (tampered or stale record)`,
          expected: ref.contentDigest,
          encountered: verifiedObservation.value.contentDigest,
        },
      };
    }

    // (b) recordObservation — append when absent; skip + digest-check when present.
    const existing = current.observations.find((candidate) => candidate.recordId === observation.recordId);
    if (existing === undefined) {
      const recorded = recordObservation(current, observation);
      if (!recorded.ok) {
        return adaptDeliveryResult(recorded, current.deliveryId);
      }
      current = recorded.value;
    } else if (existing.contentDigest !== observation.contentDigest) {
      return {
        ok: false,
        error: {
          code: 'digest-mismatch',
          message: `observation "${observation.recordId}" is already recorded in the delivery with different content — a different observation under the same id is a tamper signal`,
          expected: existing.contentDigest,
          encountered: observation.contentDigest,
        },
      };
    }

    // (c) acceptObservation — the verification boundary.
    const accepted = acceptObservation(current, observation.recordId, {
      acceptedBy: input.application.acceptedBy,
      acceptedAt: input.application.acceptedAt,
    });
    if (!accepted.ok) {
      return adaptDeliveryResult(accepted, current.deliveryId);
    }
    current = accepted.value;

    // (d) actualizeObservation — the authority mints the actual under the
    // deterministic actual id; an already-actualized observation is an
    // idempotent skip.
    const actualId = actualIdOfObservation(observation.recordId);
    if (current.actuals.some((actual) => actual.payload.derivedFromObservationId === observation.recordId)) {
      applications.push({ observationId: observation.recordId, actualId, outcome: 'already-actualized' });
      continue;
    }
    const actualized = actualizeObservation(current, observation.recordId, {
      actualId,
      actualizedBy: input.application.actualizedBy,
      actualizedAt: input.application.actualizedAt,
    });
    if (!actualized.ok) {
      return adaptDeliveryResult(actualized, current.deliveryId);
    }
    current = actualized.value;
    applications.push({ observationId: observation.recordId, actualId, outcome: 'actualized' });
  }

  return {
    ok: true,
    value: {
      delivery: current,
      applications: applications.sort((a, b) => (a.observationId < b.observationId ? -1 : 1)),
      summary: foldDeliveryActuals(current),
    },
  };
}
