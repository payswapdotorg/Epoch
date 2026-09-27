/**
 * The delivery-integration projection (W026, the Work Order's
 * delivery-integration clause): BOQ <-> procurement <-> execution
 * presented as PROJECTIONS of the universal Plan / Acquire / Realize
 * concepts.
 *
 * `foldDeliveryLinks` builds a PURE DERIVED INDEX over the canonical ids:
 * each solution plan line (`SolutionLine.lineId`, the BOQ line identity)
 * links to the work packages/activities realizing it (Plan -> Realize),
 * the acquisition requests procuring it (Acquire — external-procurement
 * lines reference plan lines by typed id) and the observations/actuals
 * recorded against its realization (Observe/Actualize — distinction-record
 * subjects anchored to solution lines, work packages or activities). The
 * pack NEVER mints ids: every referenced id is the canonical one, and the
 * index stores nothing (recomputed on every call).
 */
import { z } from 'zod';
import {
  admitAcquisitionRequest,
  Sha256HexSchema,
  verifySealedDeliveryRecord,
  verifySealedProgramOfWork,
  verifySealedSolutionVersion,
  type AcquisitionRequestRecord,
  type SealedDeliveryRecord,
  type SealedProgramOfWork,
  type SealedSolutionVersion,
} from '@epoch/solution-delivery';
import {
  CONSTRUCTION_PACK_ID,
  CONSTRUCTION_PACK_RECORD_VERSION,
  CONSTRUCTION_PACK_VERSION,
  DELIVERY_LINKS_SCHEMA_NAME,
} from './version';
import { digestOf } from './util';
import type { PackResult } from './errors';

// --------------------------------------------------------------------------------
// The link index record.
// --------------------------------------------------------------------------------

/** One derived link row: everything linked to one solution plan line, by canonical id. */
export const DeliveryLinkRowSchema = z
  .strictObject({
    solutionLineId: z.string().regex(/^line:[a-z0-9][a-z0-9-]{0,62}$/),
    workPackageIds: z.array(z.string().regex(/^work-package:[a-z0-9][a-z0-9-]{0,62}$/)).max(256),
    activityIds: z.array(z.string().regex(/^activity:[a-z0-9][a-z0-9-]{0,62}$/)).max(1024),
    acquisitionRequestIds: z
      .array(z.string().regex(/^acquisition:[a-z0-9][a-z0-9-]{0,62}$/))
      .max(256),
    observationIds: z
      .array(z.string().regex(/^observation:[a-z0-9][a-z0-9-]{0,62}$/))
      .max(1024),
    actualIds: z.array(z.string().regex(/^actual:[a-z0-9][a-z0-9-]{0,62}$/)).max(1024),
  })
  .readonly()
  .meta({
    id: 'DeliveryLinkRow',
    title: 'DeliveryLinkRow',
    description:
      'One derived delivery-link row: the work packages, activities, acquisition requests, observations and actuals linked to one solution plan line — every id canonical, never minted.',
  });

/** One delivery-link row. */
export type DeliveryLinkRow = z.infer<typeof DeliveryLinkRowSchema>;

/** The derived delivery-link index over the universal Plan/Acquire/Realize state. */
export interface DeliveryLinkIndex {
  readonly schema: typeof DELIVERY_LINKS_SCHEMA_NAME;
  readonly schemaVersion: typeof CONSTRUCTION_PACK_RECORD_VERSION;
  readonly packId: string;
  readonly packVersion: string;
  readonly tenantId: string;
  readonly solutionId: string;
  readonly deliveryId: string | undefined;
  readonly rows: readonly DeliveryLinkRow[];
  readonly contentDigest: string;
}

/** The inputs of the delivery-link fold (all optional except the solution). */
export interface DeliveryLinkInputs {
  readonly solution: SealedSolutionVersion;
  readonly program?: SealedProgramOfWork | undefined;
  readonly acquisitions?: readonly AcquisitionRequestRecord[] | undefined;
  readonly delivery?: SealedDeliveryRecord | undefined;
}

/** The mutable accumulator of one link row during the fold. */
interface LinkAccumulator {
  workPackages: Set<string>;
  activities: Set<string>;
  acquisitions: Set<string>;
  observations: Set<string>;
  actuals: Set<string>;
}

/** Canonicalize the accumulated rows (sorted keys, sorted+deduped id lists). */
function renderRows(index: Map<string, LinkAccumulator>): readonly DeliveryLinkRow[] {
  return [...index.entries()]
    .map(([solutionLineId, entry]) => ({
      solutionLineId,
      workPackageIds: [...entry.workPackages].sort(),
      activityIds: [...entry.activities].sort(),
      acquisitionRequestIds: [...entry.acquisitions].sort(),
      observationIds: [...entry.observations].sort(),
      actualIds: [...entry.actuals].sort(),
    }))
    .sort((a, b) => (a.solutionLineId < b.solutionLineId ? -1 : 1));
}

/**
 * Fold the derived delivery-link index: solution plan lines link to their
 * realizing work packages/activities (Plan -> Realize), their procurement
 * requests (Acquire) and their observations/actuals (Observe/Actualize).
 *
 * Total:
 * - the solution must verify (`digest-mismatch` on a tampered seal);
 * - the program/delivery must verify and belong to the same solution and
 *   tenant (`cross-tenant-denied` — tenant isolation on every record the
 *   pack produces);
 * - the acquisition requests must admit through the W036 schema path
 *   (`validation` / `vendor-fields-rejected`) and belong to the same
 *   solution and tenant.
 *
 * Missing inputs fold as EMPTY links for the lines they do not cover
 * (SN1.0 partial-data behavior — never a blocker). Deterministic: input
 * order never leaks; every row and id list is canonically ordered.
 */
export function foldDeliveryLinks(inputs: DeliveryLinkInputs): PackResult<DeliveryLinkIndex> {
  const solution = verifySealedSolutionVersion(inputs.solution);
  if (!solution.ok) {
    return solution;
  }
  const head = solution.value;

  let program: SealedProgramOfWork | undefined;
  if (inputs.program !== undefined) {
    const verified = verifySealedProgramOfWork(inputs.program);
    if (!verified.ok) {
      return verified;
    }
    if (verified.value.tenantId !== head.tenantId || verified.value.solutionId !== head.solutionId) {
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
    program = verified.value;
  }

  let delivery: SealedDeliveryRecord | undefined;
  if (inputs.delivery !== undefined) {
    const verified = verifySealedDeliveryRecord(inputs.delivery);
    if (!verified.ok) {
      return verified;
    }
    if (verified.value.tenantId !== head.tenantId || verified.value.solutionId !== head.solutionId) {
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
    delivery = verified.value;
  }

  const admittedAcquisitions: AcquisitionRequestRecord[] = [];
  for (const request of inputs.acquisitions ?? []) {
    const admitted = admitAcquisitionRequest(request);
    if (!admitted.ok) {
      return admitted;
    }
    if (admitted.value.tenantId !== head.tenantId || admitted.value.solutionId !== head.solutionId) {
      return {
        ok: false,
        error: {
          code: 'cross-tenant-denied',
          message: `acquisition request "${admitted.value.acquisitionId}" does not belong to the projected solution/tenant`,
          expectedTenantId: head.tenantId,
          encounteredTenantId: admitted.value.tenantId,
        },
      };
    }
    admittedAcquisitions.push(admitted.value);
  }

  const index = new Map<string, LinkAccumulator>();
  const rowOf = (solutionLineId: string): LinkAccumulator => {
    const existing = index.get(solutionLineId);
    if (existing !== undefined) {
      return existing;
    }
    const created: LinkAccumulator = {
      workPackages: new Set<string>(),
      activities: new Set<string>(),
      acquisitions: new Set<string>(),
      observations: new Set<string>(),
      actuals: new Set<string>(),
    };
    index.set(solutionLineId, created);
    return created;
  };

  // Plan -> Realize: work packages (and their activities) linked by plan line.
  const activityToLine = new Map<string, string>();
  const workPackageToLine = new Map<string, string>();
  if (program !== undefined) {
    for (const workPackage of program.workPackages) {
      if (workPackage.solutionLineId === undefined) {
        continue;
      }
      rowOf(workPackage.solutionLineId).workPackages.add(workPackage.workPackageId);
      workPackageToLine.set(workPackage.workPackageId, workPackage.solutionLineId);
      for (const activity of workPackage.activities) {
        rowOf(workPackage.solutionLineId).activities.add(activity.activityId);
        activityToLine.set(activity.activityId, workPackage.solutionLineId);
      }
    }
  }

  // Acquire: external-procurement lines referencing plan lines by typed id.
  for (const request of [...admittedAcquisitions].sort((a, b) =>
    a.acquisitionId < b.acquisitionId ? -1 : 1,
  )) {
    if (request.detail.variant !== 'external-procurement') {
      continue;
    }
    for (const line of request.detail.lines) {
      if (line.solutionLineId === undefined) {
        continue;
      }
      rowOf(line.solutionLineId).acquisitions.add(request.acquisitionId);
    }
  }

  // Observe / Actualize: distinction-record subjects anchored to lines,
  // work packages or activities (resolved through the program index).
  if (delivery !== undefined) {
    const lineOfSubject = (subjectKind: string, subjectId: string): string | undefined => {
      if (subjectKind === 'solution-line') {
        return subjectId;
      }
      if (subjectKind === 'work-package') {
        return workPackageToLine.get(subjectId);
      }
      if (subjectKind === 'activity') {
        return activityToLine.get(subjectId);
      }
      return undefined;
    };
    for (const observation of delivery.observations) {
      const lineId = lineOfSubject(observation.subject.subjectKind, observation.subject.subjectId);
      if (lineId !== undefined) {
        rowOf(lineId).observations.add(observation.recordId);
      }
    }
    for (const actual of delivery.actuals) {
      const lineId = lineOfSubject(actual.subject.subjectKind, actual.subject.subjectId);
      if (lineId !== undefined) {
        rowOf(lineId).actuals.add(actual.recordId);
      }
    }
  }

  const rows = renderRows(index);
  const content = {
    schema: DELIVERY_LINKS_SCHEMA_NAME,
    schemaVersion: CONSTRUCTION_PACK_RECORD_VERSION,
    packId: CONSTRUCTION_PACK_ID,
    packVersion: CONSTRUCTION_PACK_VERSION,
    tenantId: head.tenantId,
    solutionId: head.solutionId,
    deliveryId: delivery?.deliveryId,
    rows,
  };
  return { ok: true, value: { ...content, contentDigest: digestOf(content) } };
}

/** The zod validator of the rendered index (round-trip serialization evidence). */
export const DeliveryLinkIndexSchema = z
  .strictObject({
    schema: z.literal(DELIVERY_LINKS_SCHEMA_NAME),
    schemaVersion: z.literal(CONSTRUCTION_PACK_RECORD_VERSION),
    packId: z.literal(CONSTRUCTION_PACK_ID),
    packVersion: z.literal(CONSTRUCTION_PACK_VERSION),
    tenantId: z.string().regex(/^tenant:[a-z0-9][a-z0-9-]{0,62}$/),
    solutionId: z.string().regex(/^solution:[a-z0-9][a-z0-9-]{0,62}$/),
    deliveryId: z.string().regex(/^delivery:[a-z0-9][a-z0-9-]{0,62}$/).optional(),
    rows: z.array(DeliveryLinkRowSchema).max(512),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .superRefine((record, ctx) => {
    for (let i = 1; i < record.rows.length; i += 1) {
      if (record.rows[i]!.solutionLineId < record.rows[i - 1]!.solutionLineId) {
        ctx.addIssue({
          code: 'custom',
          message: 'rows must be sorted by solutionLineId ascending (deterministic serialization)',
          path: ['rows'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'DeliveryLinkIndex',
    title: 'DeliveryLinkIndex',
    description:
      'The derived delivery-link index: plan lines linked to realizing work packages/activities, acquisition requests, observations and actuals — canonical ids only, recomputed per call.',
  });
