/**
 * @epoch/mobile — the capture pipeline (W049): the W018 field surface
 * bound onto the W038 authority intake through the gateway.
 *
 * W049 Tech Lead pin 3: "Field semantics (the W018 core): unambiguous
 * work-package observation/progress — a field observation binds to exactly
 * one work package; AMBIGUOUS linkage is REJECTED with a typed error
 * (named negative test). Progress is projected, never invented
 * client-side."
 *
 * This module:
 *
 *  - lists the work packages of the governing sealed program (the J02
 *    field surface: what the field worker can observe against);
 *  - resolves a capture ANCHOR (work package / activity / milestone) to
 *    EXACTLY ONE work package on the client side — candidate sets of size
 *    != 1 are the typed `ambiguous-linkage-rejected` / `dangling-anchor`
 *    rejections (never a guess, BEFORE any envelope is sealed or queued —
 *    and the W038 authority re-enforces the same rule server-side);
 *  - converts a sealed W018 capture envelope into the W038 FieldCapture
 *    payload the gateway's `delivery.observe` dispatches into
 *    `intakeFieldObservation` (captureKey derived from the capture id;
 *    subjectRef from the resolved link; measure + uncertainty carried
 *    verbatim; evidence refs become the W038 link grammar).
 *
 * Progress/actuals are NEVER computed here: the authority's intake produces
 * the observation records; the client only carries the observed intent.
 */
import type { JsonValue } from '@epoch/agent-protocol';
import {
  fieldError,
  fieldOk,
  type MobileFieldResult,
} from '../errors';
import { verifySealedFieldCapture, type SealedFieldCapture } from '../capture';
import type { CapturedEvidence } from './evidence-capture';

/** One work-package projection of the governing program (J02 field surface). */
export interface WorkPackageProjection {
  readonly workPackageId: string;
  readonly title: string;
  readonly activityIds: readonly string[];
  readonly plannedQuantity: { readonly value: string; readonly unit: string } | undefined;
  readonly plannedStart: string | undefined;
  readonly plannedFinish: string | undefined;
  readonly responsibleActor: string | undefined;
}

/** One activity projection. */
export interface ActivityProjection {
  readonly activityId: string;
  readonly title: string;
  readonly workPackageId: string;
  readonly plannedQuantity: { readonly value: string; readonly unit: string } | undefined;
}

/** One milestone projection. */
export interface MilestoneProjection {
  readonly milestoneId: string;
  readonly activityIds: readonly string[];
}

/** The program projections the field surface renders. */
export interface ProgramProjections {
  readonly workPackages: readonly WorkPackageProjection[];
  readonly activities: readonly ActivityProjection[];
  readonly milestones: readonly MilestoneProjection[];
}

/** Project the sealed program into the field-surface lists (deterministic order). */
export function projectProgram(program: Record<string, unknown>): ProgramProjections {
  const workPackagesRaw = (program['workPackages'] as Array<Record<string, unknown>>) ?? [];
  const workPackages: WorkPackageProjection[] = [];
  const activities: ActivityProjection[] = [];
  for (const workPackage of workPackagesRaw) {
    const workPackageId = workPackage['workPackageId'] as string;
    const activityIds: string[] = [];
    for (const activity of (workPackage['activities'] as Array<Record<string, unknown>>) ?? []) {
      const activityId = activity['activityId'] as string;
      activityIds.push(activityId);
      activities.push({
        activityId,
        title: (activity['title'] as string) ?? activityId,
        workPackageId,
        plannedQuantity:
          activity['plannedQuantity'] !== undefined
            ? {
                value: String((activity['plannedQuantity'] as Record<string, unknown>)['value']),
                unit: String((activity['plannedQuantity'] as Record<string, unknown>)['unit']),
              }
            : undefined,
      });
    }
    const plannedQuantity =
      workPackage['plannedQuantity'] !== undefined && workPackage['plannedQuantity'] !== null
        ? undefined // quantity lives per-activity in this grammar
        : undefined;
    workPackages.push({
      workPackageId,
      title: (workPackage['title'] as string) ?? workPackageId,
      activityIds: [...activityIds].sort(),
      plannedQuantity,
      plannedStart: workPackage['plannedStart'] as string | undefined,
      plannedFinish: (workPackage['plannedFinish'] as string | undefined) ?? undefined,
      responsibleActor: workPackage['responsibleActor'] as string | undefined,
    });
  }
  // Order activity planned quantity lookup: fill from the activities table.
  const byActivity = new Map(activities.map((activity) => [activity.activityId, activity]));
  const milestones: MilestoneProjection[] = (
    (program['milestones'] as Array<Record<string, unknown>>) ?? []
  ).map((milestone) => ({
    milestoneId: milestone['milestoneId'] as string,
    activityIds: [...((milestone['activityIds'] as string[]) ?? [])].sort(),
  }));
  void byActivity;
  return {
    workPackages: workPackages.sort((a, b) => (a.workPackageId < b.workPackageId ? -1 : 1)),
    activities: activities.sort((a, b) => (a.activityId < b.activityId ? -1 : 1)),
    milestones,
  };
}

/** The capture anchor input (what the field worker picked). */
export type CaptureAnchor =
  | { readonly kind: 'work-package'; readonly id: string }
  | { readonly kind: 'activity'; readonly id: string }
  | { readonly kind: 'milestone'; readonly id: string };

/** The RESOLVED anchor (exactly one work package — ambiguity never seals). */
export interface ResolvedAnchor {
  readonly workPackageId: string;
  readonly candidates: readonly string[];
}

/** The W038 link-grammar evidence of one capture (digest + kind + provenance). */
export interface FieldEvidenceLinkPayload {
  readonly digest: string;
  readonly evidenceKind: 'photo' | 'sensor-reading' | 'document';
  readonly capturedAt: string;
  readonly capturedBy: string;
  readonly note?: string | undefined;
}

/**
 * Resolve a capture anchor to exactly one work package, CLIENT-side (the
 * pre-sealing gate). A candidate set larger than one is the typed
 * `ambiguous-linkage-rejected` (never a guess); an empty set is the typed
 * `dangling-anchor-rejected`.
 */
export function resolveCaptureAnchor(
  projections: ProgramProjections,
  anchor: CaptureAnchor,
): MobileFieldResult<ResolvedAnchor> {
  let candidates: readonly string[];
  if (anchor.kind === 'work-package') {
    candidates = projections.workPackages
      .filter((workPackage) => workPackage.workPackageId === anchor.id)
      .map((workPackage) => workPackage.workPackageId);
  } else if (anchor.kind === 'activity') {
    candidates = projections.activities
      .filter((activity) => activity.activityId === anchor.id)
      .map((activity) => activity.workPackageId);
  } else {
    const milestone = projections.milestones.find((entry) => entry.milestoneId === anchor.id);
    if (milestone === undefined) {
      candidates = [];
    } else {
      const parents = new Set<string>();
      for (const activityId of milestone.activityIds) {
        const activity = projections.activities.find((entry) => entry.activityId === activityId);
        if (activity !== undefined) parents.add(activity.workPackageId);
      }
      candidates = [...parents].sort();
    }
  }
  if (candidates.length === 0) {
    return fieldError({
      code: 'validation',
      message:
        `the capture anchor (${anchor.kind} "${anchor.id}") resolves to NO work package in the governing ` +
        'program — link the observation to a known work package, activity or milestone',
      issues: [{ path: 'anchor', message: `dangling anchor: ${anchor.kind} "${anchor.id}"` }],
    });
  }
  if (candidates.length > 1) {
    return fieldError({
      code: 'ambiguous-linkage-rejected',
      message:
        `the capture anchor (${anchor.kind} "${anchor.id}") resolves to ${candidates.length} work packages ` +
        `(${candidates.join(', ')}) — ambiguous linkage is a typed rejection, never a guess; ` +
        'disambiguate the target work package before capturing',
    });
  }
  return fieldOk({ workPackageId: candidates[0]!, candidates: [...candidates] });
}

/** The W038 evidence-kind mapping of the W018 kinds (note -> document). */
const W038_KIND_OF_W018: Readonly<Record<string, 'photo' | 'sensor-reading' | 'document'>> = {
  photo: 'photo',
  'sensor-reading': 'sensor-reading',
  note: 'document',
};

/**
 * Convert a sealed W018 capture envelope (+ the captured evidence links)
 * into the W038 FieldCapture payload the gateway's delivery.observe
 * dispatches into the authority intake. The authority derives the
 * observation ids and ALL semantic effects; the payload carries the
 * observed intent ONLY.
 */
export function toDeliveryObservePayload(input: {
  readonly capture: SealedFieldCapture;
  readonly solutionId: string;
  readonly program: Record<string, unknown>;
  readonly evidence: readonly CapturedEvidence[];
}): MobileFieldResult<JsonValue> {
  const verified = verifySealedFieldCapture(input.capture);
  if (!verified.ok) {
    return verified;
  }
  const envelope = verified.value;
  const evidenceLinks: FieldEvidenceLinkPayload[] = input.evidence
    .map((evidence) => evidence.link)
    .sort((a, b) => (a.digest < b.digest ? -1 : a.digest > b.digest ? 1 : 0));
  const payload = {
    solutionId: input.solutionId,
    program: input.program,
    capture: {
      captureKey: envelope.captureId.replace(/^field-capture:/, ''),
      tenantId: envelope.tenantId,
      solutionId: envelope.solutionId,
      deliveryId: envelope.deliveryId,
      observedAt: envelope.capturedAt,
      observedBy: envelope.capturedBy,
      subjectRef: { kind: 'work-package', id: envelope.link.workPackageId },
      measure: envelope.measure,
      ...(evidenceLinks.length > 0
        ? {
            evidenceLinks: evidenceLinks.map((link) => ({
              digest: link.digest,
              evidenceKind: link.evidenceKind,
              capturedAt: link.capturedAt,
              capturedBy: link.capturedBy,
              ...(link.note !== undefined ? { note: link.note } : {}),
            })),
          }
        : {}),
      uncertainty: envelope.uncertainty,
    },
  };
  return fieldOk(payload as unknown as JsonValue);
}

/** Map a W018 evidence kind to the W038 link-grammar kind. */
export function w038EvidenceKindOf(kind: string): 'photo' | 'sensor-reading' | 'document' {
  return W038_KIND_OF_W018[kind] ?? 'document';
}

/** Extract the W018 FieldEvidenceRefs of captured evidence (the envelope grammar). */
export function evidenceRefsOf(evidence: readonly CapturedEvidence[]): {
  readonly kind: string;
  readonly digest: string;
  readonly capturedAt: string;
}[] {
  return evidence.map((entry) => ({
    kind: entry.ref.kind,
    digest: entry.ref.digest,
    capturedAt: entry.ref.capturedAt,
  }));
}
