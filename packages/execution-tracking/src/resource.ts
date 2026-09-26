/**
 * RESOURCE OBSERVATIONS (W038 pin): labor/equipment/material/resource
 * usage records — typed, content-addressed, carrying quantity + unit +
 * time + provenance + the MANDATORY uncertainty state (the W036
 * distinction conventions), each linked to a work-package reference.
 *
 * These are OBSERVATIONS of usage (what was consumed/used when, by
 * whom), never commitments or forecasts (the W036 semantic
 * distinctions). Totals fold deterministically per
 * (workPackageId, resourceKind, unit) with exact decimal arithmetic —
 * input order never leaks.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  TimestampSchema,
  UnitLabelSchema,
  WorkPackageIdSchema,
} from '@epoch/solution-delivery';
import { TenantIdSchema } from '@epoch/solution-delivery';
import { UncertaintyStateSchema } from '@epoch/solution-delivery';
import { addNonNegativeDecimals } from '@epoch/solution-delivery';
import { ActivityIdSchema, ResourceObservationIdSchema } from './primitives';
import {
  EXECUTION_TRACKING_RECORD_VERSION,
  RESOURCE_KINDS,
  RESOURCE_OBSERVATION_SCHEMA_NAME,
  type ResourceKind,
} from './version';
import {
  FieldEvidenceLinkArraySchema,
  refineSortedEvidenceLinks,
} from './field-evidence';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { ExecutionResult } from './errors';

/** The resource-usage observation kinds grammar. */
export const ResourceKindSchema = z.enum(RESOURCE_KINDS).meta({
  id: 'ResourceKind',
  title: 'ResourceKind',
  description:
    'One resource-usage observation kind: labor, equipment, material, or resource (the generic catch-all).',
});

/**
 * The immutable content of one resource-usage observation: the opaque
 * resource id, quantity + unit, usage instant, the linked work package
 * (optionally narrowed to an activity), provenance, sorted field-evidence
 * references, and the mandatory uncertainty state.
 */
export const ResourceObservationContentSchema = z
  .strictObject({
    schema: z.literal(RESOURCE_OBSERVATION_SCHEMA_NAME),
    schemaVersion: z.literal(EXECUTION_TRACKING_RECORD_VERSION),
    recordId: ResourceObservationIdSchema,
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    workPackageId: WorkPackageIdSchema,
    activityId: ActivityIdSchema.optional(),
    resourceKind: ResourceKindSchema,
    resourceId: OpaqueReferenceSchema,
    quantity: NonNegativeDecimalSchema,
    unit: UnitLabelSchema,
    usageAt: TimestampSchema,
    observedBy: PrincipalIdSchema,
    recordedAt: TimestampSchema,
    recordedBy: PrincipalIdSchema,
    evidenceLinks: FieldEvidenceLinkArraySchema,
    uncertainty: UncertaintyStateSchema,
  })
  .readonly()
  .superRefine((record, ctx) => {
    refineSortedEvidenceLinks(record.evidenceLinks, ctx, 'evidenceLinks');
    if (record.recordedAt < record.usageAt) {
      ctx.addIssue({
        code: 'custom',
        message: 'recordedAt must not precede usageAt',
        path: ['recordedAt'],
      });
    }
  })
  .meta({
    id: 'ResourceObservationContent',
    title: 'ResourceObservationContent',
    description:
      'The immutable content of one resource-usage observation: labor/equipment/material usage (quantity, unit, usage instant), opaque resource identity, the linked work package/activity, provenance, sorted field-evidence references, and the mandatory uncertainty state.',
  });

/** One resource-observation content. */
export type ResourceObservationContent = z.infer<typeof ResourceObservationContentSchema>;

/** The SEALED resource-observation record: content plus its SHA-256 content digest. */
export const SealedResourceObservationSchema = z
  .strictObject({
    schema: z.literal(RESOURCE_OBSERVATION_SCHEMA_NAME),
    schemaVersion: z.literal(EXECUTION_TRACKING_RECORD_VERSION),
    recordId: ResourceObservationIdSchema,
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    workPackageId: WorkPackageIdSchema,
    activityId: ActivityIdSchema.optional(),
    resourceKind: ResourceKindSchema,
    resourceId: OpaqueReferenceSchema,
    quantity: NonNegativeDecimalSchema,
    unit: UnitLabelSchema,
    usageAt: TimestampSchema,
    observedBy: PrincipalIdSchema,
    recordedAt: TimestampSchema,
    recordedBy: PrincipalIdSchema,
    evidenceLinks: FieldEvidenceLinkArraySchema,
    uncertainty: UncertaintyStateSchema,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedResourceObservation',
    title: 'SealedResourceObservation',
    description:
      'The sealed resource-usage observation record: immutable content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed resource-observation record. */
export type SealedResourceObservation = z.infer<typeof SealedResourceObservationSchema>;

/** Compute the content digest of a resource-observation content. */
export function computeResourceObservationDigest(
  content: ResourceObservationContent,
): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid resource-observation content into its published record. */
export function sealResourceObservation(
  content: unknown,
): ExecutionResult<SealedResourceObservation> {
  const parsed = ResourceObservationContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/**
 * Verify a sealed resource-observation record: schema validation + digest
 * recomputation (tamper detection — `digest-mismatch`).
 */
export function verifySealedResourceObservation(
  sealed: unknown,
): ExecutionResult<SealedResourceObservation> {
  const parsed = SealedResourceObservationSchema.safeParse(sealed);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'sealed resource-observation record digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// Deterministic resource-usage folds.
// --------------------------------------------------------------------------------

/** One resource-usage total row (per work package, kind, and unit). */
export interface ResourceUsageTotal {
  readonly workPackageId: string;
  readonly resourceKind: ResourceKind;
  readonly unit: string;
  readonly total: string;
  readonly observationCount: number;
}

/**
 * Fold resource-usage observations into exact per-(workPackageId,
 * resourceKind, unit) totals. Rows sort by (workPackageId,
 * resourceKind, unit); input order never leaks.
 */
export function foldResourceUsage(
  observations: readonly SealedResourceObservation[],
): readonly ResourceUsageTotal[] {
  const totals = new Map<string, string>();
  const meta = new Map<string, ResourceUsageTotal>();
  for (const observation of observations) {
    const key = [observation.workPackageId, observation.resourceKind, observation.unit].join('\u0000');
    if (!meta.has(key)) {
      meta.set(key, {
        workPackageId: observation.workPackageId,
        resourceKind: observation.resourceKind,
        unit: observation.unit,
        total: '0',
        observationCount: 0,
      });
    }
    const row = meta.get(key)!;
    meta.set(key, { ...row, observationCount: row.observationCount + 1 });
    totals.set(key, addNonNegativeDecimals(totals.get(key) ?? '0', observation.quantity));
  }
  return [...meta.entries()]
    .map(([key, row]) => ({ ...row, total: totals.get(key) ?? '0' }))
    .sort((a, b) => {
      if (a.workPackageId !== b.workPackageId) return a.workPackageId < b.workPackageId ? -1 : 1;
      if (a.resourceKind !== b.resourceKind) return a.resourceKind < b.resourceKind ? -1 : 1;
      return a.unit < b.unit ? -1 : 1;
    });
}
