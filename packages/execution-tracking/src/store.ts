/**
 * The EXECUTION TRACKING STORE — the reference in-memory machinery (W038):
 * tenant- and solution-scoped append-only stores for the observation
 * records, tracking-state records, resource observations, field-evidence
 * links, issue records, resolutions, and reconciliation proposals, plus
 * the PROGRAM INDEX (the opaque work-package/activity/milestone identity
 * links extracted from the sealed W036 ProgramOfWork — used ONLY for
 * linkage inference and reference resolution, never as a schedule copy).
 *
 * OBSERVATION INTAKE (the W038 pins):
 * - actualization bypass: a W036 distinction record of kind `actual`
 *   presented to the observation intake is the typed
 *   `actualization-bypass-rejected` — this package produces observations
 *   and reconciles them; actualization flows ONLY through the W036
 *   DeliveryRecord acceptance/actualization path;
 * - uncertainty: every observation must carry the full uncertainty state
 *   — the pre-classifier fires `uncertainty-missing-rejected` BEFORE
 *   schema validation;
 * - replay/idempotency: same observation payload + idempotency key ->
 *   same sealed record, the TYPED `duplicate-observation` ADMISSION
 *   returning the prior digest (a duplicate is a fact, not an error);
 *   the same id with different content is `version-conflict`; the same
 *   idempotency key with different content is `version-conflict`;
 * - tenant isolation (R12): cross-tenant records are
 *   `tenant-isolation-rejected`.
 *
 * LOW-FRICTION FIELD INTAKE: `intakeFieldObservation` is the ONE-CALL
 * ingestion that infers the work-package linkage (work-package ref
 * direct; activity ref through the program index; milestone ref through
 * its activities), producing the W036 observation record, the resource
 * usage observations, and the field-evidence-link records with
 * DERIVED, deterministic record ids — never lossy: ambiguous linkage is
 * the typed `ambiguous-linkage-rejected` (multiple candidate work
 * packages), an unresolvable reference is `dangling-reference-rejected`.
 */
import {
  addNonNegativeDecimals,
  sealDistinctionRecord,
  verifySealedDistinctionRecord,
  verifySealedProgramOfWork,
  MeasureSchema,
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  TimestampSchema,
  UnitLabelSchema,
  UncertaintyStateSchema,
  type ObservationRecord,
} from '@epoch/solution-delivery';
import { TenantIdSchema, DeliveryIdSchema, PrincipalIdSchema } from '@epoch/solution-delivery';
import { SolutionIdSchema } from '@epoch/solution-delivery';
import {
  FieldCaptureKeySchema,
  StateIdSchema,
  DistinctionRecordIdSchema,
  ResourceObservationIdSchema,
  EvidenceLinkIdSchema,
  IssueRecordIdSchema,
  ReconciliationIdSchema,
} from './primitives';
import { z } from 'zod';
import {
  EXECUTION_TRACKING_RECORD_VERSION,
  TRACKING_TRANSITIONS,
  executionStreamIdOf,
  type ResourceKind,
  type TrackingState,
} from './version';
import { deriveObservationReplayKey } from './idempotency';
import {
  authorityViolationError,
  hasUnrecognizedKeys,
  scheduleAuthorityError,
  uncertaintyMissingError,
  validationError,
  vendorFieldsError,
} from './issues';
import { adaptDeliveryResult } from './w036-adapter';
import {
  currentTrackingState,
  deriveWorkPackageState,
  foldTrackingStates,
  verifySealedTrackingStateRecord,
  type SealedTrackingStateRecord,
} from './state';
import {
  sealResourceObservation,
  verifySealedResourceObservation,
  type SealedResourceObservation,
} from './resource';
import {
  sealFieldEvidenceLink,
  verifySealedFieldEvidenceLink,
  FieldEvidenceLinkSchema,
  type SealedFieldEvidenceLink,
} from './field-evidence';
import {
  verifySealedIssueRecord,
  verifySealedIssueResolution,
  foldIssues,
  type SealedIssueRecord,
  type SealedIssueResolution,
} from './execution-issues';
import {
  verifySealedReconciliationProposal,
  type SealedReconciliationProposal,
} from './reconciliation';
import type {
  ExecutionResult,
  ExecutionReferenceKind,
} from './errors';

// --------------------------------------------------------------------------------
// The program index (opaque identity links — never a schedule copy).
// --------------------------------------------------------------------------------

/** One indexed work package: its opaque id plus its sorted activity ids. */
export interface ProgramWorkPackageIndex {
  readonly workPackageId: string;
  readonly activityIds: readonly string[];
}

/** One indexed milestone: its opaque id plus its sorted activity ids. */
export interface ProgramMilestoneIndex {
  readonly milestoneId: string;
  readonly activityIds: readonly string[];
}

/** The program index: opaque work-package/activity/milestone identity links. */
export interface ProgramIndex {
  readonly workPackages: readonly ProgramWorkPackageIndex[];
  readonly milestones: readonly ProgramMilestoneIndex[];
}

/** An empty program index. */
export const EMPTY_PROGRAM_INDEX: ProgramIndex = { workPackages: [], milestones: [] };

/**
 * Build the program index from a SEALED W036 ProgramOfWork: verify the
 * program (digest recomputation — tamper detection), then extract the
 * opaque work-package/activity/milestone identity links. The index carries
 * NO schedule data (dates, quantities, dependencies, progress) — it is
 * the linkage map, never a schedule copy.
 */
export function buildProgramIndex(sealed: unknown): ExecutionResult<ProgramIndex> {
  const verified = verifySealedProgramOfWork(sealed);
  if (!verified.ok) {
    return adaptDeliveryResult(verified, 'program-of-work');
  }
  const program = verified.value;
  const workPackages: ProgramWorkPackageIndex[] = program.workPackages
    .map((workPackage) => ({
      workPackageId: workPackage.workPackageId,
      activityIds: [...workPackage.activities.map((activity) => activity.activityId)].sort(),
    }))
    .sort((a, b) => (a.workPackageId < b.workPackageId ? -1 : 1));
  const milestones: ProgramMilestoneIndex[] = program.milestones
    .map((milestone) => ({
      milestoneId: milestone.milestoneId,
      activityIds: [...milestone.activityIds].sort(),
    }))
    .sort((a, b) => (a.milestoneId < b.milestoneId ? -1 : 1));
  return { ok: true, value: { workPackages, milestones } };
}

/** The work packages of the index that contain one activity id. */
export function workPackagesOfActivity(
  index: ProgramIndex,
  activityId: string,
): readonly string[] {
  return index.workPackages
    .filter((workPackage) => workPackage.activityIds.includes(activityId))
    .map((workPackage) => workPackage.workPackageId)
    .sort();
}

/** The distinct work packages of one milestone's activities. */
export function workPackagesOfMilestone(
  index: ProgramIndex,
  milestoneId: string,
): readonly string[] {
  const milestone = index.milestones.find((candidate) => candidate.milestoneId === milestoneId);
  if (milestone === undefined) return [];
  const parents = new Set<string>();
  for (const activityId of milestone.activityIds) {
    for (const workPackageId of workPackagesOfActivity(index, activityId)) {
      parents.add(workPackageId);
    }
  }
  return [...parents].sort();
}

/** The activity -> owning work package map (deterministic, sorted keys). */
export function activityOwnersOf(index: ProgramIndex): ReadonlyMap<string, string> {
  const owners = new Map<string, string>();
  for (const workPackage of index.workPackages) {
    for (const activityId of workPackage.activityIds) {
      if (!owners.has(activityId)) {
        owners.set(activityId, workPackage.workPackageId);
      }
    }
  }
  return owners;
}

// --------------------------------------------------------------------------------
// The store.
// --------------------------------------------------------------------------------

/** One consumed observation idempotency key (sorted by key). */
export interface ObservationKeyBinding {
  readonly key: string;
  readonly recordId: string;
}

/**
 * The tenant- and solution-scoped execution tracking store. All record
 * arrays are SORTED by recordId (append-only admission inserts in
 * canonical order); the observation key index is sorted by key. Input
 * order never leaks into any fold.
 */
export interface ExecutionTrackingStore {
  readonly tenantId: string;
  readonly solutionId: string;
  readonly programIndex: ProgramIndex;
  readonly observations: readonly ObservationRecord[];
  readonly observationKeys: readonly ObservationKeyBinding[];
  readonly tracking: readonly SealedTrackingStateRecord[];
  readonly resourceObservations: readonly SealedResourceObservation[];
  readonly evidenceLinks: readonly SealedFieldEvidenceLink[];
  readonly issues: readonly SealedIssueRecord[];
  readonly resolutions: readonly SealedIssueResolution[];
  readonly proposals: readonly SealedReconciliationProposal[];
}

/** Open an empty tracking store for one tenant + solution. */
export function openExecutionTrackingStore(input: {
  readonly tenantId: string;
  readonly solutionId: string;
  readonly programIndex?: ProgramIndex | undefined;
}): ExecutionResult<ExecutionTrackingStore> {
  const tenant = TenantIdSchema.safeParse(input.tenantId);
  if (!tenant.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'the tracking store tenant id failed the tenancy grammar',
        issues: [{ path: 'tenantId', message: tenant.error.issues[0]?.message ?? 'invalid tenant id' }],
      },
    };
  }
  const solution = SolutionIdSchema.safeParse(input.solutionId);
  if (!solution.success) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'the tracking store solution id failed the W036 grammar',
        issues: [{ path: 'solutionId', message: solution.error.issues[0]?.message ?? 'invalid solution id' }],
      },
    };
  }
  return {
    ok: true,
    value: {
      tenantId: tenant.data,
      solutionId: solution.data,
      programIndex: input.programIndex ?? EMPTY_PROGRAM_INDEX,
      observations: [],
      observationKeys: [],
      tracking: [],
      resourceObservations: [],
      evidenceLinks: [],
      issues: [],
      resolutions: [],
      proposals: [],
    },
  };
}

// --------------------------------------------------------------------------------
// Observation intake (idempotent, bypass-guarded, uncertainty-guarded).
// --------------------------------------------------------------------------------

/**
 * The typed observation ADMISSION outcome: a NEW record, or the REPLAYED
 * observation returning the SAME sealed record (same payload + same
 * idempotency key — the `duplicate-observation` typed admission carrying
 * the prior digest; a duplicate is a recorded fact, never an error).
 */
export type ObservationAdmissionOutcome =
  | { readonly kind: 'admitted'; readonly record: ObservationRecord }
  | {
      readonly kind: 'duplicate-observation';
      readonly record: ObservationRecord;
      readonly observationDigest: string;
      readonly idempotencyKey: string;
    };

/** The result of one observation admission: the next store + the typed outcome. */
export interface ObservationAdmission {
  readonly store: ExecutionTrackingStore;
  readonly outcome: ObservationAdmissionOutcome;
}

/**
 * Admit one W036 sealed observation record into the tracking store.
 * Total, fixed precedence:
 *
 * 1. authority/uncertainty pre-classifiers (forbidden authority fields,
 *    schedule fields, missing uncertainty state);
 * 2. kind gate — a distinction record of kind `actual` is the typed
 *    `actualization-bypass-rejected`; other non-observation kinds are a
 *    typed validation failure;
 * 3. W036 verification (schema + digest recomputation — tamper
 *    detection);
 * 4. tenant gate — the record's tenant must equal the store's
 *    (`tenant-isolation-rejected`, R12);
 * 5. solution gate — the record's subject solution must equal the
 *    store's;
 * 6. duplicate gate — same id + same digest (or same idempotency key +
 *    same digest) is the TYPED `duplicate-observation` admission with the
 *    prior digest; same id + different digest, or same key + different
 *    digest, is `version-conflict` (a sealed record is immutable).
 */
export function admitObservation(
  store: ExecutionTrackingStore,
  observation: unknown,
  options: { readonly idempotencyKey?: string | undefined } = {},
): ExecutionResult<ObservationAdmission> {
  const authority = authorityViolationError(observation) ?? scheduleAuthorityError(observation);
  if (authority !== null) {
    return { ok: false, error: authority };
  }
  const missingUncertainty = uncertaintyMissingError(observation);
  if (missingUncertainty !== null) {
    return { ok: false, error: missingUncertainty };
  }
  const kind = (observation as { kind?: unknown } | null)?.kind;
  if (kind !== undefined && typeof kind === 'string' && kind !== 'observation') {
    const recordId =
      typeof (observation as { recordId?: unknown }).recordId === 'string'
        ? ((observation as { recordId: string }).recordId)
        : '';
    if (kind === 'actual') {
      return {
        ok: false,
        error: {
          code: 'actualization-bypass-rejected',
          message:
            'an ACTUAL record cannot enter the execution-tracking observation intake — execution-tracking produces observations and reconciles them; ' +
            'actualization flows ONLY through the W036 DeliveryRecord acceptance/actualization path (Observation is evidence capture; the authority converts accepted observations)',
          recordId,
          recordKind: kind,
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `a distinction record of kind "${kind}" is not an observation — the observation intake records kind "observation" records only`,
        issues: [{ path: 'kind', message: `encountered kind "${kind}"` }],
      },
    };
  }
  const verified = verifySealedDistinctionRecord(observation);
  if (!verified.ok) {
    return adaptDeliveryResult(verified, 'observation-record');
  }
  const record = verified.value;
  if (record.kind !== 'observation') {
    if (record.kind === 'actual') {
      return {
        ok: false,
        error: {
          code: 'actualization-bypass-rejected',
          message:
            'an ACTUAL record cannot enter the execution-tracking observation intake — actualization flows ONLY through the W036 DeliveryRecord acceptance/actualization path',
          recordId: record.recordId,
          recordKind: record.kind,
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `a distinction record of kind "${record.kind}" is not an observation — the observation intake records kind "observation" records only`,
        issues: [{ path: 'kind', message: `encountered kind "${record.kind}"` }],
      },
    };
  }
  if (record.tenantId !== store.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `observation "${record.recordId}" belongs to tenant "${record.tenantId}" but the tracking store is scoped to "${store.tenantId}" (R12 tenant isolation)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: record.tenantId,
        subject: record.recordId,
      },
    };
  }
  if (record.subject.solutionId !== store.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `observation "${record.recordId}" subjects solution "${record.subject.solutionId}" but the tracking store is scoped to "${store.solutionId}"`,
        issues: [{ path: 'subject.solutionId', message: 'store/observation solution mismatch' }],
      },
    };
  }
  const replayKey =
    options.idempotencyKey !== undefined
      ? deriveObservationReplayKey({
          tenantId: store.tenantId,
          idempotencyKey: options.idempotencyKey,
        })
      : null;
  if (replayKey !== null) {
    const priorBinding = store.observationKeys.find((binding) => binding.key === replayKey);
    if (priorBinding !== undefined) {
      const prior = store.observations.find(
        (candidate) => candidate.recordId === priorBinding.recordId,
      );
      if (prior !== undefined && prior.contentDigest === record.contentDigest) {
        return {
          ok: true,
          value: {
            store,
            outcome: {
              kind: 'duplicate-observation',
              record: prior,
              observationDigest: prior.contentDigest,
              idempotencyKey: replayKey,
            },
          },
        };
      }
      return {
        ok: false,
        error: {
          code: 'version-conflict',
          message: `idempotency key is already bound to a different observation content — the same key with different content is a conflict, never a silent replacement`,
          subject: 'observation-record',
          subjectId: record.recordId,
          publishedDigest: prior?.contentDigest,
          encounteredDigest: record.contentDigest,
        },
      };
    }
  }
  const priorById = store.observations.find((candidate) => candidate.recordId === record.recordId);
  if (priorById !== undefined) {
    if (priorById.contentDigest === record.contentDigest) {
      return {
        ok: true,
        value: {
          store,
          outcome: {
            kind: 'duplicate-observation',
            record: priorById,
            observationDigest: priorById.contentDigest,
            idempotencyKey: replayKey ?? '',
          },
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `observation "${record.recordId}" is already recorded with different content — observations are append-only and immutable`,
        subject: 'observation-record',
        subjectId: record.recordId,
        publishedDigest: priorById.contentDigest,
        encounteredDigest: record.contentDigest,
      },
    };
  }
  const observations = [...store.observations, record].sort((a, b) =>
    a.recordId < b.recordId ? -1 : 1,
  );
  const observationKeys =
    replayKey === null
      ? store.observationKeys
      : [...store.observationKeys, { key: replayKey, recordId: record.recordId }].sort((a, b) =>
          a.key < b.key ? -1 : 1,
        );
  return {
    ok: true,
    value: {
      store: { ...store, observations, observationKeys },
      outcome: { kind: 'admitted', record },
    },
  };
}

// --------------------------------------------------------------------------------
// Generic sealed-record admission (idempotent by exact digest).
// --------------------------------------------------------------------------------

/** The result of one record-family admission: the next store + duplicate flag. */
export interface RecordAdmission<T> {
  readonly store: ExecutionTrackingStore;
  readonly record: T;
  readonly duplicate: boolean;
}

/** Insert one record into its sorted store array (idempotent by digest). */
function insertSorted<T extends { readonly recordId: string; readonly contentDigest: string }>(
  records: readonly T[],
  record: T,
): { readonly records: readonly T[]; readonly duplicate: boolean; readonly publishedDigest?: string } {
  const existing = records.find((candidate) => candidate.recordId === record.recordId);
  if (existing !== undefined) {
    return { records, duplicate: true, publishedDigest: existing.contentDigest };
  }
  return { records: [...records, record].sort((a, b) => (a.recordId < b.recordId ? -1 : 1)), duplicate: false };
}

// --------------------------------------------------------------------------------
// Tracking-state admission (chain-validated, schedule-guarded).
// --------------------------------------------------------------------------------

/**
 * Admit one sealed tracking-state record. Precedence: authority/schedule
 * pre-classifiers -> uncertainty -> seal verification -> tenant/solution
 * gates -> subject resolution against the program index -> CHAIN check
 * (`fromState: null` exactly when no prior record for the subject;
 * `fromState` equal to the current state otherwise; `toState` a legal
 * arc) -> duplicate/idempotency.
 */
export function admitTrackingState(
  store: ExecutionTrackingStore,
  record: unknown,
): ExecutionResult<RecordAdmission<SealedTrackingStateRecord>> {
  const authority = authorityViolationError(record) ?? scheduleAuthorityError(record);
  if (authority !== null) {
    return { ok: false, error: authority };
  }
  const missingUncertainty = uncertaintyMissingError(record);
  if (missingUncertainty !== null) {
    return { ok: false, error: missingUncertainty };
  }
  const verified = verifySealedTrackingStateRecord(record);
  if (!verified.ok) {
    return verified;
  }
  const sealed = verified.value;
  return admitSealedTrackingState(store, sealed);
}

/** The sealed fast path: a verified record against the store gates. */
function admitSealedTrackingState(
  store: ExecutionTrackingStore,
  sealed: SealedTrackingStateRecord,
): ExecutionResult<RecordAdmission<SealedTrackingStateRecord>> {
  if (sealed.tenantId !== store.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `tracking record "${sealed.recordId}" belongs to tenant "${sealed.tenantId}" but the tracking store is scoped to "${store.tenantId}" (R12 tenant isolation)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: sealed.tenantId,
        subject: sealed.recordId,
      },
    };
  }
  if (sealed.solutionId !== store.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `tracking record "${sealed.recordId}" subjects solution "${sealed.solutionId}" but the tracking store is scoped to "${store.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'store/record solution mismatch' }],
      },
    };
  }
  const workPackage = store.programIndex.workPackages.find(
    (candidate) => candidate.workPackageId === sealed.subject.workPackageId,
  );
  if (workPackage === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `tracking record "${sealed.recordId}" references work package "${sealed.subject.workPackageId}" which is not in the program index`,
        referenceKind: 'work-package',
        referenceId: sealed.subject.workPackageId,
      },
    };
  }
  if (
    sealed.subject.activityId !== undefined &&
    !workPackage.activityIds.includes(sealed.subject.activityId)
  ) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `tracking record "${sealed.recordId}" references activity "${sealed.subject.activityId}" which is not in work package "${sealed.subject.workPackageId}" of the program index`,
        referenceKind: 'activity',
        referenceId: sealed.subject.activityId,
      },
    };
  }
  // Duplicate gate BEFORE the chain check (an exact re-admission is
  // idempotent; a different-content re-admission is a conflict).
  const existing = store.tracking.find((candidate) => candidate.recordId === sealed.recordId);
  if (existing !== undefined) {
    if (existing.contentDigest === sealed.contentDigest) {
      return { ok: true, value: { store, record: sealed, duplicate: true } };
    }
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `tracking record "${sealed.recordId}" is already recorded with different content — tracking records are append-only and immutable`,
        subject: 'tracking-state-record',
        subjectId: sealed.recordId,
        publishedDigest: existing.contentDigest,
        encounteredDigest: sealed.contentDigest,
      },
    };
  }
  // CHAIN check: fromState must equal the subject's current state
  // (the chain root is the implicit `not-started`), and toState must be
  // a legal arc from it.
  const current = currentTrackingState(store.tracking, sealed.subject);
  if (sealed.fromState !== current) {
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message: `tracking record "${sealed.recordId}" transitions from "${sealed.fromState}" but the subject's current tracked state is "${current}" — the tracking chain must stay continuous (broken chain)`,
        subjectId: sealed.recordId,
        from: sealed.fromState,
        to: sealed.toState,
      },
    };
  }
  if (!TRACKING_TRANSITIONS[current].includes(sealed.toState)) {
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message: `tracking record "${sealed.recordId}" proposes the illegal transition ${current} -> ${sealed.toState}`,
        subjectId: sealed.recordId,
        from: current,
        to: sealed.toState,
      },
    };
  }
  const tracking = [...store.tracking, sealed].sort((a, b) => (a.recordId < b.recordId ? -1 : 1));
  return {
    ok: true,
    value: { store: { ...store, tracking }, record: sealed, duplicate: false },
  };
}

// --------------------------------------------------------------------------------
// Resource-observation admission.
// --------------------------------------------------------------------------------

/** Admit one sealed resource-usage observation record (idempotent by digest). */
export function admitResourceObservation(
  store: ExecutionTrackingStore,
  record: unknown,
): ExecutionResult<RecordAdmission<SealedResourceObservation>> {
  const authority = authorityViolationError(record) ?? scheduleAuthorityError(record);
  if (authority !== null) {
    return { ok: false, error: authority };
  }
  const missingUncertainty = uncertaintyMissingError(record);
  if (missingUncertainty !== null) {
    return { ok: false, error: missingUncertainty };
  }
  const verified = verifySealedResourceObservation(record);
  if (!verified.ok) {
    return verified;
  }
  const sealed = verified.value;
  if (sealed.tenantId !== store.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `resource observation "${sealed.recordId}" belongs to tenant "${sealed.tenantId}" but the tracking store is scoped to "${store.tenantId}" (R12 tenant isolation)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: sealed.tenantId,
        subject: sealed.recordId,
      },
    };
  }
  if (sealed.solutionId !== store.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `resource observation "${sealed.recordId}" subjects solution "${sealed.solutionId}" but the tracking store is scoped to "${store.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'store/record solution mismatch' }],
      },
    };
  }
  const workPackage = store.programIndex.workPackages.find(
    (candidate) => candidate.workPackageId === sealed.workPackageId,
  );
  if (workPackage === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `resource observation "${sealed.recordId}" references work package "${sealed.workPackageId}" which is not in the program index`,
        referenceKind: 'work-package',
        referenceId: sealed.workPackageId,
      },
    };
  }
  if (sealed.activityId !== undefined && !workPackage.activityIds.includes(sealed.activityId)) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `resource observation "${sealed.recordId}" references activity "${sealed.activityId}" which is not in work package "${sealed.workPackageId}" of the program index`,
        referenceKind: 'activity',
        referenceId: sealed.activityId,
      },
    };
  }
  const insertion = insertSorted(store.resourceObservations, sealed);
  if (insertion.duplicate && insertion.publishedDigest !== sealed.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `resource observation "${sealed.recordId}" is already recorded with different content — resource observations are append-only and immutable`,
        subject: 'resource-observation-record',
        subjectId: sealed.recordId,
        publishedDigest: insertion.publishedDigest,
        encounteredDigest: sealed.contentDigest,
      },
    };
  }
  if (insertion.duplicate) {
    return { ok: true, value: { store, record: sealed, duplicate: true } };
  }
  return {
    ok: true,
    value: {
      store: { ...store, resourceObservations: insertion.records },
      record: sealed,
      duplicate: false,
    },
  };
}

// --------------------------------------------------------------------------------
// Field-evidence-link admission.
// --------------------------------------------------------------------------------

/** Admit one sealed field-evidence-link record (idempotent by digest). */
export function admitFieldEvidenceLink(
  store: ExecutionTrackingStore,
  record: unknown,
): ExecutionResult<RecordAdmission<SealedFieldEvidenceLink>> {
  const authority = authorityViolationError(record) ?? scheduleAuthorityError(record);
  if (authority !== null) {
    return { ok: false, error: authority };
  }
  const verified = verifySealedFieldEvidenceLink(record);
  if (!verified.ok) {
    return verified;
  }
  const sealed = verified.value;
  if (sealed.tenantId !== store.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `evidence link "${sealed.recordId}" belongs to tenant "${sealed.tenantId}" but the tracking store is scoped to "${store.tenantId}" (R12 tenant isolation)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: sealed.tenantId,
        subject: sealed.recordId,
      },
    };
  }
  if (sealed.solutionId !== store.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `evidence link "${sealed.recordId}" subjects solution "${sealed.solutionId}" but the tracking store is scoped to "${store.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'store/record solution mismatch' }],
      },
    };
  }
  const workPackage = store.programIndex.workPackages.find(
    (candidate) => candidate.workPackageId === sealed.workPackageId,
  );
  if (workPackage === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `evidence link "${sealed.recordId}" references work package "${sealed.workPackageId}" which is not in the program index`,
        referenceKind: 'work-package',
        referenceId: sealed.workPackageId,
      },
    };
  }
  if (sealed.activityId !== undefined && !workPackage.activityIds.includes(sealed.activityId)) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `evidence link "${sealed.recordId}" references activity "${sealed.activityId}" which is not in work package "${sealed.workPackageId}" of the program index`,
        referenceKind: 'activity',
        referenceId: sealed.activityId,
      },
    };
  }
  if (
    sealed.linkedObservationId !== undefined &&
    !store.observations.some((candidate) => candidate.recordId === sealed.linkedObservationId)
  ) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `evidence link "${sealed.recordId}" references observation "${sealed.linkedObservationId}" which is not recorded in the tracking store`,
        referenceKind: 'observation-record',
        referenceId: sealed.linkedObservationId,
      },
    };
  }
  const insertion = insertSorted(store.evidenceLinks, sealed);
  if (insertion.duplicate && insertion.publishedDigest !== sealed.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `evidence link "${sealed.recordId}" is already recorded with different content — evidence links are append-only and immutable`,
        subject: 'evidence-link-record',
        subjectId: sealed.recordId,
        publishedDigest: insertion.publishedDigest,
        encounteredDigest: sealed.contentDigest,
      },
    };
  }
  if (insertion.duplicate) {
    return { ok: true, value: { store, record: sealed, duplicate: true } };
  }
  return {
    ok: true,
    value: {
      store: { ...store, evidenceLinks: insertion.records },
      record: sealed,
      duplicate: false,
    },
  };
}

// --------------------------------------------------------------------------------
// Issue + resolution admission.
// --------------------------------------------------------------------------------

/** Admit one sealed execution-issue record (impact refs must resolve). */
export function admitIssue(
  store: ExecutionTrackingStore,
  record: unknown,
): ExecutionResult<RecordAdmission<SealedIssueRecord>> {
  const authority = authorityViolationError(record) ?? scheduleAuthorityError(record);
  if (authority !== null) {
    return { ok: false, error: authority };
  }
  const missingUncertainty = uncertaintyMissingError(record);
  if (missingUncertainty !== null) {
    return { ok: false, error: missingUncertainty };
  }
  const verified = verifySealedIssueRecord(record);
  if (!verified.ok) {
    return verified;
  }
  const sealed = verified.value;
  if (sealed.tenantId !== store.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `issue record "${sealed.recordId}" belongs to tenant "${sealed.tenantId}" but the tracking store is scoped to "${store.tenantId}" (R12 tenant isolation)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: sealed.tenantId,
        subject: sealed.recordId,
      },
    };
  }
  if (sealed.solutionId !== store.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `issue record "${sealed.recordId}" subjects solution "${sealed.solutionId}" but the tracking store is scoped to "${store.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'store/record solution mismatch' }],
      },
    };
  }
  for (const reference of [
    ...sealed.impact.workPackageIds.map((id) => ({ kind: 'work-package' as const, id })),
    ...sealed.impact.activityIds.map((id) => ({ kind: 'activity' as const, id })),
    ...sealed.impact.milestoneIds.map((id) => ({ kind: 'milestone' as const, id })),
  ]) {
    const resolved =
      reference.kind === 'work-package'
        ? store.programIndex.workPackages.some((wp) => wp.workPackageId === reference.id)
        : reference.kind === 'activity'
          ? store.programIndex.workPackages.some((wp) => wp.activityIds.includes(reference.id))
          : store.programIndex.milestones.some((m) => m.milestoneId === reference.id);
    if (!resolved) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `issue record "${sealed.recordId}" references ${reference.kind} "${reference.id}" which is not in the program index`,
          referenceKind: reference.kind as ExecutionReferenceKind,
          referenceId: reference.id,
        },
      };
    }
  }
  if (sealed.reworkOf !== undefined) {
    const workPackage = store.programIndex.workPackages.find(
      (candidate) => candidate.workPackageId === sealed.reworkOf!.workPackageId,
    );
    if (workPackage === undefined) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `rework record "${sealed.recordId}" references original work package "${sealed.reworkOf.workPackageId}" which is not in the program index`,
          referenceKind: 'work-package',
          referenceId: sealed.reworkOf.workPackageId,
        },
      };
    }
    if (
      sealed.reworkOf.activityId !== undefined &&
      !workPackage.activityIds.includes(sealed.reworkOf.activityId)
    ) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `rework record "${sealed.recordId}" references original activity "${sealed.reworkOf.activityId}" which is not in work package "${sealed.reworkOf.workPackageId}"`,
          referenceKind: 'activity',
          referenceId: sealed.reworkOf.activityId,
        },
      };
    }
    if (
      sealed.reworkOf.originalTrackingRecordId !== undefined &&
      !store.tracking.some(
        (candidate) => candidate.recordId === sealed.reworkOf!.originalTrackingRecordId,
      )
    ) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `rework record "${sealed.recordId}" references original tracking record "${sealed.reworkOf.originalTrackingRecordId}" which is not recorded in the tracking store`,
          referenceKind: 'tracking-state-record',
          referenceId: sealed.reworkOf.originalTrackingRecordId,
        },
      };
    }
  }
  if (sealed.blocked !== undefined) {
    const workPackage = store.programIndex.workPackages.find(
      (candidate) => candidate.workPackageId === sealed.blocked!.workPackageId,
    );
    if (workPackage === undefined) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `blocker record "${sealed.recordId}" blocks work package "${sealed.blocked.workPackageId}" which is not in the program index`,
          referenceKind: 'work-package',
          referenceId: sealed.blocked.workPackageId,
        },
      };
    }
    if (
      sealed.blocked.activityId !== undefined &&
      !workPackage.activityIds.includes(sealed.blocked.activityId)
    ) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `blocker record "${sealed.recordId}" blocks activity "${sealed.blocked.activityId}" which is not in work package "${sealed.blocked.workPackageId}"`,
          referenceKind: 'activity',
          referenceId: sealed.blocked.activityId,
        },
      };
    }
  }
  const insertion = insertSorted(store.issues, sealed);
  if (insertion.duplicate && insertion.publishedDigest !== sealed.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `issue record "${sealed.recordId}" is already recorded with different content — issue records are append-only and immutable`,
        subject: 'issue-record',
        subjectId: sealed.recordId,
        publishedDigest: insertion.publishedDigest,
        encounteredDigest: sealed.contentDigest,
      },
    };
  }
  if (insertion.duplicate) {
    return { ok: true, value: { store, record: sealed, duplicate: true } };
  }
  return {
    ok: true,
    value: {
      store: { ...store, issues: insertion.records },
      record: sealed,
      duplicate: false,
    },
  };
}

/** Admit one sealed issue-resolution record (exactly one resolution per issue). */
export function admitIssueResolution(
  store: ExecutionTrackingStore,
  record: unknown,
): ExecutionResult<RecordAdmission<SealedIssueResolution>> {
  const authority = authorityViolationError(record) ?? scheduleAuthorityError(record);
  if (authority !== null) {
    return { ok: false, error: authority };
  }
  const verified = verifySealedIssueResolution(record);
  if (!verified.ok) {
    return verified;
  }
  const sealed = verified.value;
  if (sealed.tenantId !== store.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `issue resolution "${sealed.recordId}" belongs to tenant "${sealed.tenantId}" but the tracking store is scoped to "${store.tenantId}" (R12 tenant isolation)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: sealed.tenantId,
        subject: sealed.recordId,
      },
    };
  }
  if (sealed.solutionId !== store.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `issue resolution "${sealed.recordId}" subjects solution "${sealed.solutionId}" but the tracking store is scoped to "${store.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'store/record solution mismatch' }],
      },
    };
  }
  const issue = store.issues.find((candidate) => candidate.recordId === sealed.issueRecordId);
  if (issue === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `issue resolution "${sealed.recordId}" references issue "${sealed.issueRecordId}" which is not recorded in the tracking store`,
        referenceKind: 'issue-record',
        referenceId: sealed.issueRecordId,
      },
    };
  }
  if (sealed.resolvedAt < issue.raisedAt) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'resolution instant precedes the issue raised instant',
        issues: [{ path: 'resolvedAt', message: 'resolvedAt must not precede raisedAt' }],
      },
    };
  }
  const existing = store.resolutions.find((candidate) => candidate.issueRecordId === sealed.issueRecordId);
  if (existing !== undefined) {
    if (existing.contentDigest === sealed.contentDigest) {
      return { ok: true, value: { store, record: sealed, duplicate: true } };
    }
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message: `issue "${sealed.issueRecordId}" is already settled by resolution "${existing.recordId}" — an issue accepts exactly one resolution`,
        subjectId: sealed.issueRecordId,
        from: 'open',
        to: sealed.resolution,
      },
    };
  }
  const insertion = insertSorted(store.resolutions, sealed);
  if (insertion.duplicate && insertion.publishedDigest !== sealed.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `issue resolution "${sealed.recordId}" is already recorded with different content`,
        subject: 'issue-record',
        subjectId: sealed.recordId,
        publishedDigest: insertion.publishedDigest,
        encounteredDigest: sealed.contentDigest,
      },
    };
  }
  if (insertion.duplicate) {
    return { ok: true, value: { store, record: sealed, duplicate: true } };
  }
  return {
    ok: true,
    value: {
      store: { ...store, resolutions: insertion.records },
      record: sealed,
      duplicate: false,
    },
  };
}

// --------------------------------------------------------------------------------
// Reconciliation-proposal admission.
// --------------------------------------------------------------------------------

/** Admit one sealed reconciliation proposal (observations must be recorded). */
export function admitReconciliationProposal(
  store: ExecutionTrackingStore,
  proposal: unknown,
): ExecutionResult<RecordAdmission<SealedReconciliationProposal>> {
  const authority = authorityViolationError(proposal) ?? scheduleAuthorityError(proposal);
  if (authority !== null) {
    return { ok: false, error: authority };
  }
  const verified = verifySealedReconciliationProposal(proposal);
  if (!verified.ok) {
    return verified;
  }
  const sealed = verified.value;
  if (sealed.tenantId !== store.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `reconciliation proposal "${sealed.recordId}" belongs to tenant "${sealed.tenantId}" but the tracking store is scoped to "${store.tenantId}" (R12 tenant isolation)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: sealed.tenantId,
        subject: sealed.recordId,
      },
    };
  }
  if (sealed.solutionId !== store.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `reconciliation proposal "${sealed.recordId}" subjects solution "${sealed.solutionId}" but the tracking store is scoped to "${store.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'store/record solution mismatch' }],
      },
    };
  }
  for (const entry of sealed.entries) {
    if (!store.observations.some((candidate) => candidate.recordId === entry.observationId)) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `reconciliation proposal "${sealed.recordId}" references observation "${entry.observationId}" which is not recorded in the tracking store`,
          referenceKind: 'observation-record',
          referenceId: entry.observationId,
        },
      };
    }
    const observation = store.observations.find(
      (candidate) => candidate.recordId === entry.observationId,
    )!;
    if (observation.payload.deliveryId !== sealed.deliveryId) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `reconciliation proposal "${sealed.recordId}" targets delivery "${sealed.deliveryId}" but observation "${entry.observationId}" belongs to delivery "${observation.payload.deliveryId}"`,
          issues: [{ path: 'deliveryId', message: 'proposal/observation delivery mismatch' }],
        },
      };
    }
  }
  const insertion = insertSorted(store.proposals, sealed);
  if (insertion.duplicate && insertion.publishedDigest !== sealed.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `reconciliation proposal "${sealed.recordId}" is already recorded with different content — proposals are append-only and immutable`,
        subject: 'reconciliation-proposal',
        subjectId: sealed.recordId,
        publishedDigest: insertion.publishedDigest,
        encounteredDigest: sealed.contentDigest,
      },
    };
  }
  if (insertion.duplicate) {
    return { ok: true, value: { store, record: sealed, duplicate: true } };
  }
  return {
    ok: true,
    value: {
      store: { ...store, proposals: insertion.records },
      record: sealed,
      duplicate: false,
    },
  };
}

// --------------------------------------------------------------------------------
// The LOW-FRICTION single-call field observation intake.
// --------------------------------------------------------------------------------

/** The subject reference of one field capture (the linkage anchor). */
export const CaptureSubjectSchema = z
  .discriminatedUnion('kind', [
    z
      .strictObject({ kind: z.literal('work-package'), id: z.string().regex(/^work-package:[a-z0-9][a-z0-9-]{0,62}$/) })
      .readonly(),
    z
      .strictObject({ kind: z.literal('activity'), id: z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/) })
      .readonly(),
    z
      .strictObject({ kind: z.literal('milestone'), id: z.string().regex(/^milestone:[a-z0-9][a-z0-9-]{0,62}$/) })
      .readonly(),
  ])
  .meta({
    id: 'CaptureSubject',
    title: 'CaptureSubject',
    description:
      'The linkage anchor of one field capture: an opaque work-package, activity, or milestone reference (the intake infers the work package from it).',
  });

/** One capture subject. */
export type CaptureSubject = z.infer<typeof CaptureSubjectSchema>;

/** One resource usage reported by a field capture. */
export const CaptureResourceUsageSchema = z
  .strictObject({
    resourceKind: z.enum(['labor', 'equipment', 'material', 'resource']),
    resourceId: OpaqueReferenceSchema,
    quantity: NonNegativeDecimalSchema,
    unit: UnitLabelSchema,
    usageAt: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'CaptureResourceUsage',
    title: 'CaptureResourceUsage',
    description:
      'One resource usage reported by a field capture: kind (labor/equipment/material/resource), opaque resource id, quantity, unit, and usage instant.',
  });

/** One capture resource usage. */
export type CaptureResourceUsage = z.infer<typeof CaptureResourceUsageSchema>;

/** The LOW-FRICTION field capture: ONE call carries everything the field observed. */
export const FieldCaptureSchema = z
  .strictObject({
    captureKey: FieldCaptureKeySchema,
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    deliveryId: DeliveryIdSchema,
    observedAt: TimestampSchema,
    observedBy: PrincipalIdSchema,
    recordedAt: TimestampSchema.optional(),
    subjectRef: CaptureSubjectSchema,
    measure: MeasureSchema,
    resourceUsages: z.array(CaptureResourceUsageSchema).max(64).optional(),
    evidenceLinks: z.array(FieldEvidenceLinkSchema).max(64).optional(),
    uncertainty: UncertaintyStateSchema,
  })
  .readonly()
  .meta({
    id: 'FieldCapture',
    title: 'FieldCapture',
    description:
      'The low-friction field capture: one call carrying the subject anchor, the observed measure, resource usages, field-evidence references, and the mandatory uncertainty state. The intake infers the work-package linkage; ambiguous linkage is a typed rejection, never a guess.',
  });

/** One field capture. */
export type FieldCapture = z.infer<typeof FieldCaptureSchema>;

/** The result of the low-friction intake. */
export interface FieldIntakeOutcome {
  readonly store: ExecutionTrackingStore;
  readonly linkedWorkPackageId: string;
  readonly observation: ObservationAdmissionOutcome;
  readonly resourceObservations: readonly { readonly record: SealedResourceObservation; readonly duplicate: boolean }[];
  readonly evidenceLinks: readonly { readonly record: SealedFieldEvidenceLink; readonly duplicate: boolean }[];
}

/**
 * The LOW-FRICTION single-call field observation intake: ONE call that
 *
 * 1. runs the authority/schedule/uncertainty pre-classifiers;
 * 2. checks tenant + solution scope;
 * 3. INFERS the work-package linkage from the subject anchor (direct for
 *    a work package; through the program index for an activity or a
 *    milestone) — MULTIPLE candidate work packages is the typed
 *    `ambiguous-linkage-rejected` (ingestion is low-friction but never
 *    lossy and never a guess), an unresolvable anchor is
 *    `dangling-reference-rejected`;
 * 4. seals the W036 observation record (kind `observation`, evidence
 *    digests carried on the W036 payload) with the DERIVED deterministic
 *    id `observation:field-<captureKey>`;
 * 5. seals the resource-usage observations
 *    (`resource-observation:field-<captureKey>-<n>`, sorted) and the
 *    field-evidence-link records (`evidence-link:field-<captureKey>-<n>`,
 *    digest-sorted) with the inferred linkage;
 * 6. admits everything with idempotency — a replayed capture (same key,
 *    same content) returns the SAME sealed records as typed
 *    `duplicate-observation`/duplicate admissions; the same key with
 *    different content is `version-conflict`.
 *
 * On any typed failure the caller's store is unchanged (immutable
 * updates only).
 */
export function intakeFieldObservation(
  store: ExecutionTrackingStore,
  capture: unknown,
): ExecutionResult<FieldIntakeOutcome> {
  const authority = authorityViolationError(capture) ?? scheduleAuthorityError(capture);
  if (authority !== null) {
    return { ok: false, error: authority };
  }
  const missingUncertainty = uncertaintyMissingError(capture);
  if (missingUncertainty !== null) {
    return { ok: false, error: missingUncertainty };
  }
  const captureKind = (capture as { kind?: unknown } | null)?.kind;
  if (captureKind === 'actual' || captureKind === 'observation') {
    return {
      ok: false,
      error: {
        code: 'actualization-bypass-rejected',
        message: 'the field intake ingests CAPTURES, not distinction records — pass the capture payload; the intake produces the observation records',
        recordId: '',
        recordKind: String(captureKind),
      },
    };
  }
  const parsed = FieldCaptureSchema.safeParse(capture);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const field = parsed.data;
  if (field.tenantId !== store.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `field capture "${field.captureKey}" belongs to tenant "${field.tenantId}" but the tracking store is scoped to "${store.tenantId}" (R12 tenant isolation)`,
        expectedTenantId: store.tenantId,
        encounteredTenantId: field.tenantId,
        subject: field.captureKey,
      },
    };
  }
  if (field.solutionId !== store.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `field capture "${field.captureKey}" subjects solution "${field.solutionId}" but the tracking store is scoped to "${store.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'store/capture solution mismatch' }],
      },
    };
  }

  // (3) linkage inference — ambiguous linkage is a typed rejection, never a guess.
  let linkedWorkPackageId: string;
  if (field.subjectRef.kind === 'work-package') {
    const known = store.programIndex.workPackages.some(
      (workPackage) => workPackage.workPackageId === field.subjectRef!.id,
    );
    if (!known) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `field capture "${field.captureKey}" anchors on work package "${field.subjectRef.id}" which is not in the program index`,
          referenceKind: 'work-package',
          referenceId: field.subjectRef.id,
        },
      };
    }
    linkedWorkPackageId = field.subjectRef.id;
  } else if (field.subjectRef.kind === 'activity') {
    const candidates = workPackagesOfActivity(store.programIndex, field.subjectRef.id);
    if (candidates.length === 0) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `field capture "${field.captureKey}" anchors on activity "${field.subjectRef.id}" which is not in the program index`,
          referenceKind: 'activity',
          referenceId: field.subjectRef.id,
        },
      };
    }
    if (candidates.length > 1) {
      return {
        ok: false,
        error: {
          code: 'ambiguous-linkage-rejected',
          message: `field capture "${field.captureKey}" anchors on activity "${field.subjectRef.id}" which maps to ${candidates.length} candidate work packages (${candidates.join(', ')}) — linkage is ambiguous and ingestion never guesses`,
          subject: field.subjectRef.id,
          candidateWorkPackageIds: candidates,
        },
      };
    }
    linkedWorkPackageId = candidates[0]!;
  } else {
    const milestone = store.programIndex.milestones.find(
      (candidate) => candidate.milestoneId === field.subjectRef!.id,
    );
    if (milestone === undefined) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `field capture "${field.captureKey}" anchors on milestone "${field.subjectRef.id}" which is not in the program index`,
          referenceKind: 'milestone',
          referenceId: field.subjectRef.id,
        },
      };
    }
    const candidates = workPackagesOfMilestone(store.programIndex, field.subjectRef.id);
    if (candidates.length !== 1) {
      if (candidates.length === 0) {
        return {
          ok: false,
          error: {
            code: 'dangling-reference-rejected',
            message: `field capture "${field.captureKey}" anchors on milestone "${field.subjectRef.id}" whose activities do not resolve to any work package`,
            referenceKind: 'work-package',
            referenceId: field.subjectRef.id,
          },
        };
      }
      return {
        ok: false,
        error: {
          code: 'ambiguous-linkage-rejected',
          message: `field capture "${field.captureKey}" anchors on milestone "${field.subjectRef.id}" which spans ${candidates.length} work packages (${candidates.join(', ')}) — linkage is ambiguous and ingestion never guesses`,
          subject: field.subjectRef.id,
          candidateWorkPackageIds: candidates,
        },
      };
    }
    linkedWorkPackageId = candidates[0]!;
  }

  const recordedAt = field.recordedAt ?? field.observedAt;
  const evidenceLinks = [...(field.evidenceLinks ?? [])].sort((a, b) =>
    a.digest < b.digest ? -1 : a.digest > b.digest ? 1 : 0,
  );
  const resourceUsages = [...(field.resourceUsages ?? [])].sort((a, b) => {
    if (a.resourceKind !== b.resourceKind) return a.resourceKind < b.resourceKind ? -1 : 1;
    if (a.resourceId !== b.resourceId) return a.resourceId < b.resourceId ? -1 : 1;
    if (a.quantity !== b.quantity) return a.quantity < b.quantity ? -1 : 1;
    return a.unit < b.unit ? -1 : 1;
  });

  // (4) the W036 observation record (sealed through the REAL W036 kernel).
  const observationContent = {
    schema: 'epoch.solution-delivery.distinction-record',
    schemaVersion: 1,
    kind: 'observation',
    recordId: `observation:field-${field.captureKey}`,
    tenantId: store.tenantId,
    subject: {
      solutionId: store.solutionId,
      subjectKind: field.subjectRef.kind,
      subjectId: field.subjectRef.id,
    },
    measure: field.measure,
    payload: {
      deliveryId: field.deliveryId,
      observedAt: field.observedAt,
      observedBy: field.observedBy,
      evidence: evidenceLinks.map((link) => ({ digest: link.digest })),
    },
    recordedAt,
    recordedBy: field.observedBy,
    uncertainty: field.uncertainty,
  };
  const sealed = sealDistinctionRecord(observationContent);
  if (!sealed.ok) {
    return adaptDeliveryResult(sealed, `observation:field-${field.captureKey}`);
  }

  // (5)-(6) admit the observation (idempotent — the captureKey IS the
  // idempotency key; the W036 verification runs inside the admission).
  const admitted = admitObservation(store, sealed.value, { idempotencyKey: field.captureKey });
  if (!admitted.ok) {
    return admitted;
  }
  let next = admitted.value.store;
  const observationOutcome = admitted.value.outcome;

  const resourceResults: { record: SealedResourceObservation; duplicate: boolean }[] = [];
  for (const [index, usage] of resourceUsages.entries()) {
    const recordId = `resource-observation:field-${field.captureKey}-${index + 1}`;
    const sealedUsage = sealResourceObservation({
      schema: 'epoch.execution-tracking.resource-observation',
      schemaVersion: EXECUTION_TRACKING_RECORD_VERSION,
      recordId,
      tenantId: store.tenantId,
      solutionId: store.solutionId,
      workPackageId: linkedWorkPackageId,
      ...(field.subjectRef.kind === 'activity' ? { activityId: field.subjectRef.id } : {}),
      resourceKind: usage.resourceKind,
      resourceId: usage.resourceId,
      quantity: usage.quantity,
      unit: usage.unit,
      usageAt: usage.usageAt,
      observedBy: field.observedBy,
      recordedAt,
      recordedBy: field.observedBy,
      evidenceLinks,
      uncertainty: field.uncertainty,
    });
    if (!sealedUsage.ok) {
      return sealedUsage;
    }
    const admittedUsage = admitResourceObservation(next, sealedUsage.value);
    if (!admittedUsage.ok) {
      return admittedUsage;
    }
    next = admittedUsage.value.store;
    resourceResults.push({
      record: admittedUsage.value.record,
      duplicate: admittedUsage.value.duplicate,
    });
  }

  const linkResults: { record: SealedFieldEvidenceLink; duplicate: boolean }[] = [];
  for (const [index, link] of evidenceLinks.entries()) {
    const recordId = `evidence-link:field-${field.captureKey}-${index + 1}`;
    const sealedLink = sealFieldEvidenceLink({
      schema: 'epoch.execution-tracking.field-evidence-link',
      schemaVersion: EXECUTION_TRACKING_RECORD_VERSION,
      recordId,
      tenantId: store.tenantId,
      solutionId: store.solutionId,
      digest: link.digest,
      evidenceKind: link.evidenceKind,
      capturedAt: link.capturedAt,
      capturedBy: link.capturedBy,
      ...(link.captureMethod !== undefined ? { captureMethod: link.captureMethod } : {}),
      ...(link.note !== undefined ? { note: link.note } : {}),
      workPackageId: linkedWorkPackageId,
      ...(field.subjectRef.kind === 'activity' ? { activityId: field.subjectRef.id } : {}),
      linkedObservationId: `observation:field-${field.captureKey}`,
      captureKey: field.captureKey,
      recordedAt,
    });
    if (!sealedLink.ok) {
      return sealedLink;
    }
    const admittedLink = admitFieldEvidenceLink(next, sealedLink.value);
    if (!admittedLink.ok) {
      return admittedLink;
    }
    next = admittedLink.value.store;
    linkResults.push({ record: admittedLink.value.record, duplicate: admittedLink.value.duplicate });
  }

  return {
    ok: true,
    value: {
      store: next,
      linkedWorkPackageId,
      observation: observationOutcome,
      resourceObservations: resourceResults,
      evidenceLinks: linkResults,
    },
  };
}

// --------------------------------------------------------------------------------
// The deterministic execution state projection.
// --------------------------------------------------------------------------------

/** One folded issue row of the per-work-package projection. */
export interface ProjectedIssue {
  readonly issueRecordId: string;
  readonly issueKind: string;
  readonly severity: string;
  readonly resolutionState: string;
}

/** One work-package row of the execution state projection. */
export interface WorkPackageExecutionProjection {
  readonly workPackageId: string;
  readonly workPackageState: TrackingState;
  readonly activityStates: readonly {
    readonly activityId: string;
    readonly state: TrackingState;
    readonly recordCount: number;
    readonly lastObservedAt: string;
  }[];
  readonly observationCount: number;
  readonly resourceUsageTotals: readonly {
    readonly resourceKind: ResourceKind;
    readonly unit: string;
    readonly total: string;
    readonly observationCount: number;
  }[];
  readonly issues: readonly ProjectedIssue[];
  readonly streamId: string;
}

/** The whole execution state projection (deterministic; sorted by workPackageId). */
export interface ExecutionStateProjection {
  readonly solutionId: string;
  readonly workPackages: readonly WorkPackageExecutionProjection[];
  readonly totalObservationCount: number;
  readonly unresolvedIssueCount: number;
}

/**
 * The work package a W036 observation record links to (via the program
 * index and the observation's subject). Deterministic; a subject that
 * does not resolve links to nothing.
 */
export function linkedWorkPackageOfObservation(
  index: ProgramIndex,
  observation: ObservationRecord,
): string | null {
  const { subjectKind, subjectId } = observation.subject;
  if (subjectKind === 'work-package') {
    return index.workPackages.some((workPackage) => workPackage.workPackageId === subjectId)
      ? subjectId
      : null;
  }
  if (subjectKind === 'activity') {
    const candidates = workPackagesOfActivity(index, subjectId);
    return candidates.length === 1 ? candidates[0]! : null;
  }
  if (subjectKind === 'milestone') {
    const candidates = workPackagesOfMilestone(index, subjectId);
    return candidates.length === 1 ? candidates[0]! : null;
  }
  return null;
}

/**
 * Project the deterministic execution state of every indexed work
 * package: the current tracking states (work-package level, or derived
 * from activity states), observation counts, resource-usage totals, and
 * the folded issue rows. Optional `asOf` filters every record family by
 * its natural instant (observedAt / observedAt / usageAt / raisedAt /
 * resolvedAt — the producer-supplied facts, never a clock). Sorted by
 * workPackageId; input order never leaks.
 */
export function projectExecutionState(
  store: ExecutionTrackingStore,
  options: { readonly asOf?: string | undefined } = {},
): ExecutionStateProjection {
  const asOf = options.asOf;
  const tracking = asOf === undefined ? store.tracking : store.tracking.filter((r) => r.observedAt <= asOf);
  const observations =
    asOf === undefined ? store.observations : store.observations.filter((r) => r.payload.observedAt <= asOf);
  const resourceObservations =
    asOf === undefined
      ? store.resourceObservations
      : store.resourceObservations.filter((r) => r.usageAt <= asOf);
  const issues = asOf === undefined ? store.issues : store.issues.filter((r) => r.raisedAt <= asOf);
  const resolutions =
    asOf === undefined ? store.resolutions : store.resolutions.filter((r) => r.resolvedAt <= asOf);

  const trackingFold = foldTrackingStates(tracking);
  const issueFold = foldIssues(issues, resolutions);

  const workPackages: WorkPackageExecutionProjection[] = [];
  for (const indexed of store.programIndex.workPackages) {
    const id = indexed.workPackageId;
    const activityStates = trackingFold
      .filter((projection) => projection.workPackageId === id && projection.activityId !== undefined)
      .map((projection) => ({
        activityId: projection.activityId!,
        state: projection.state,
        recordCount: projection.recordCount,
        lastObservedAt: projection.lastObservedAt,
      }))
      .sort((a, b) => (a.activityId < b.activityId ? -1 : 1));
    const workPackageLevel = trackingFold.find(
      (projection) => projection.workPackageId === id && projection.activityId === undefined,
    );
    let workPackageState: TrackingState;
    if (workPackageLevel !== undefined) {
      workPackageState = workPackageLevel.state;
    } else {
      // Derive from the KNOWN activities of the program index (deterministic).
      workPackageState = deriveWorkPackageState(
        indexed.activityIds.map(
          (activityId) =>
            activityStates.find((state) => state.activityId === activityId)?.state ?? 'not-started',
        ),
      );
    }
    const observationCount = observations.filter(
      (observation) => linkedWorkPackageOfObservation(store.programIndex, observation) === id,
    ).length;
    const usageTotals: {
      resourceKind: ResourceKind;
      unit: string;
      total: string;
      observationCount: number;
    }[] = [];
    for (const observation of resourceObservations.filter((candidate) => candidate.workPackageId === id)) {
      const row = usageTotals.find(
        (candidate) =>
          candidate.resourceKind === observation.resourceKind && candidate.unit === observation.unit,
      );
      if (row === undefined) {
        usageTotals.push({
          resourceKind: observation.resourceKind,
          unit: observation.unit,
          total: observation.quantity,
          observationCount: 1,
        });
      } else {
        row.total = addNonNegativeDecimals(row.total, observation.quantity);
        row.observationCount += 1;
      }
    }
    usageTotals.sort((a, b) => {
      if (a.resourceKind !== b.resourceKind) return a.resourceKind < b.resourceKind ? -1 : 1;
      return a.unit < b.unit ? -1 : 1;
    });
    const projectedIssues: ProjectedIssue[] = issueFold
      .filter((folded) => folded.issue.impact.workPackageIds.includes(id))
      .map((folded) => ({
        issueRecordId: folded.issue.recordId,
        issueKind: folded.issue.issueKind,
        severity: folded.issue.severity,
        resolutionState: folded.resolutionState,
      }));
    workPackages.push({
      workPackageId: id,
      workPackageState,
      activityStates,
      observationCount,
      resourceUsageTotals: usageTotals,
      issues: projectedIssues,
      streamId: executionStreamIdOf(id),
    });
  }
  return {
    solutionId: store.solutionId,
    workPackages,
    totalObservationCount: observations.length,
    unresolvedIssueCount: issueFold.filter((folded) => folded.resolutionState === 'open').length,
  };
}

// Re-exported for the typed surface (the id grammars the service layer needs).
export {
  StateIdSchema,
  DistinctionRecordIdSchema,
  ResourceObservationIdSchema,
  EvidenceLinkIdSchema,
  IssueRecordIdSchema,
  ReconciliationIdSchema,
};
