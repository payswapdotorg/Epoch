/**
 * The universal Acquire contract (USL1.0, binding): obtain or allocate
 * the resources, rights, data, capabilities and prerequisites required
 * for realization.
 *
 * The acquisition-variant catalog is CLOSED and PROVIDER-NEUTRAL:
 * external procurement, internal allocation, subscription/license
 * acquisition, cloud/service provisioning, fabrication request,
 * specialist capability assignment, data/evidence acquisition.
 * PROCUREMENT IS A DOMAIN-SPECIFIC ACQUISITION PROJECTION — one entry in
 * the catalog, never the universal authority. No field names a supplier
 * brand, marketplace, ERP or API surface: external parties are opaque
 * references behind the provider-neutral external request/event seam
 * (src/external.ts — the seam W042 later bridges).
 *
 * `AcquisitionRequestRecord` is the typed request; fulfillment is a
 * separate typed record (`AcquisitionFulfillmentRecord`) referencing the
 * request — commitment and fulfillment stay distinguishable from the
 * actual distinction records.
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  AcquisitionIdSchema,
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  PrincipalIdSchema,
  SolutionIdSchema,
  UnitLabelSchema,
} from './primitives';
import { DeliveryIdSchema } from './primitives';
import {
  ACQUISITION_REQUEST_SCHEMA_NAME,
  ACQUISITION_VARIANTS,
  SOLUTION_DELIVERY_RECORD_VERSION,
  type AcquisitionVariant,
} from './version';
import { hasUnrecognizedKeys, vendorFieldsError, validationError } from './issues';
import type { DeliveryResult } from './errors';

/** One acquisition line: what is being acquired, in quantity+unit terms. */
export const AcquisitionLineSchema = z
  .strictObject({
    description: z.string().min(1).max(256),
    quantity: NonNegativeDecimalSchema,
    unit: UnitLabelSchema,
    solutionLineId: z.string().regex(/^line:[a-z0-9][a-z0-9-]{0,62}$/).optional(),
    externalPartyRef: OpaqueReferenceSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'AcquisitionLine',
    title: 'AcquisitionLine',
    description:
      'One acquisition line: description, quantity+unit, optional solution-line link, and an optional opaque external-party reference (never a vendor name).',
  });

/** One acquisition line. */
export type AcquisitionLine = z.infer<typeof AcquisitionLineSchema>;

/**
 * The variant-specific request detail (discriminated by `variant`):
 * provider-neutral data only — external systems are opaque references.
 */
export const AcquisitionRequestDetailSchema = z.discriminatedUnion('variant', [
  z
    .strictObject({
      variant: z.literal('external-procurement'),
      lines: z.array(AcquisitionLineSchema).min(1).max(64),
    })
    .readonly(),
  z
    .strictObject({
      variant: z.literal('internal-allocation'),
      resourceRef: OpaqueReferenceSchema,
      quantity: NonNegativeDecimalSchema,
      unit: UnitLabelSchema,
      fromScope: OpaqueReferenceSchema.optional(),
    })
    .readonly(),
  z
    .strictObject({
      variant: z.literal('subscription-license'),
      licenseRef: OpaqueReferenceSchema.optional(),
      seats: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
      termNote: z.string().max(256).optional(),
    })
    .readonly(),
  z
    .strictObject({
      variant: z.literal('cloud-service-provisioning'),
      serviceKind: z.string().min(1).max(64),
      capacityNote: z.string().max(256).optional(),
    })
    .readonly(),
  z
    .strictObject({
      variant: z.literal('fabrication-request'),
      designRef: OpaqueReferenceSchema.optional(),
      quantity: NonNegativeDecimalSchema,
      unit: UnitLabelSchema,
    })
    .readonly(),
  z
    .strictObject({
      variant: z.literal('specialist-capability-assignment'),
      capabilityRef: OpaqueReferenceSchema,
      assignee: z.string().regex(/^principal:[a-z0-9][a-z0-9-]{0,62}$/).optional(),
    })
    .readonly(),
  z
    .strictObject({
      variant: z.literal('data-evidence-acquisition'),
      subjectRef: OpaqueReferenceSchema,
    })
    .readonly(),
]);

/** One acquisition request detail. */
export type AcquisitionRequestDetail = z.infer<typeof AcquisitionRequestDetailSchema>;

/**
 * One acquisition request: the universal Acquire contract instance.
 * Tenant-scoped; optionally anchored to the solution, the delivery and/or
 * the program; fulfillment is a SEPARATE record.
 */
export const AcquisitionRequestRecordSchema = z
  .strictObject({
    schema: z.literal(ACQUISITION_REQUEST_SCHEMA_NAME),
    schemaVersion: z.literal(SOLUTION_DELIVERY_RECORD_VERSION),
    acquisitionId: AcquisitionIdSchema,
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    deliveryId: DeliveryIdSchema.optional(),
    detail: AcquisitionRequestDetailSchema,
    requestedAt: TimestampSchema,
    requestedBy: PrincipalIdSchema,
    neededBy: TimestampSchema.optional(),
    note: z.string().max(2048).optional(),
  })
  .readonly()
  .superRefine((request, ctx) => {
    if (request.detail.variant === 'external-procurement') {
      for (let i = 1; i < request.detail.lines.length; i += 1) {
        const a = request.detail.lines[i]!;
        const b = request.detail.lines[i - 1]!;
        if (a.description < b.description) {
          ctx.addIssue({
            code: 'custom',
            message: 'lines must be sorted by description ascending (deterministic serialization)',
            path: ['detail', 'lines'],
          });
          break;
        }
      }
    }
  })
  .meta({
    id: 'AcquisitionRequestRecord',
    title: 'AcquisitionRequestRecord',
    description:
      'One acquisition request over the universal Acquire contract: tenant scope, solution/delivery anchors, a variant-discriminated provider-neutral detail, and request provenance.',
  });

/** One acquisition request record. */
export type AcquisitionRequestRecord = z.infer<typeof AcquisitionRequestRecordSchema>;

/** The full acquisition-variant catalog (USL1.0, binding). */
export const ACQUISITION_VARIANT_CATALOG: readonly AcquisitionVariant[] = ACQUISITION_VARIANTS;

/**
 * Admit an acquisition request: schema validation with the vendor-field
 * classifier (strict objects — no provider fields can enter).
 */
export function admitAcquisitionRequest(request: unknown): DeliveryResult<AcquisitionRequestRecord> {
  const parsed = AcquisitionRequestRecordSchema.safeParse(request);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/** One acquisition fulfillment: the answer to one request (a distinct record). */
export const AcquisitionFulfillmentRecordSchema = z
  .strictObject({
    schema: z.literal('epoch.solution-delivery.acquisition-fulfillment'),
    schemaVersion: z.literal(SOLUTION_DELIVERY_RECORD_VERSION),
    fulfillmentId: z.string().regex(/^fulfillment:[a-z0-9][a-z0-9-]{0,62}$/),
    tenantId: TenantIdSchema,
    acquisitionId: AcquisitionIdSchema,
    fulfilledAt: TimestampSchema,
    fulfilledBy: PrincipalIdSchema,
    externalReference: OpaqueReferenceSchema.optional(),
    note: z.string().max(2048).optional(),
  })
  .readonly()
  .meta({
    id: 'AcquisitionFulfillmentRecord',
    title: 'AcquisitionFulfillmentRecord',
    description:
      'One acquisition fulfillment: the answer to one acquisition request, with an optional opaque external-system reference (the provider stays behind the seam).',
  });

/** One acquisition fulfillment record. */
export type AcquisitionFulfillmentRecord = z.infer<typeof AcquisitionFulfillmentRecordSchema>;

/**
 * Admit an acquisition fulfillment referencing a known request: a
 * DANGLING request reference is a typed `dangling-reference-rejected`;
 * cross-tenant fulfillment is `cross-tenant-denied`; a request fulfilled
 * twice is `version-conflict`.
 */
export function admitAcquisitionFulfillment(
  requests: readonly AcquisitionRequestRecord[],
  fulfillments: readonly AcquisitionFulfillmentRecord[],
  fulfillment: unknown,
): DeliveryResult<readonly AcquisitionFulfillmentRecord[]> {
  const parsed = AcquisitionFulfillmentRecordSchema.safeParse(fulfillment);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const admitted = parsed.data;
  const request = requests.find((candidate) => candidate.acquisitionId === admitted.acquisitionId);
  if (request === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `fulfillment references acquisition request "${admitted.acquisitionId}", which does not resolve`,
        referenceKind: 'acquisition-request',
        referenceId: admitted.acquisitionId,
      },
    };
  }
  if (admitted.tenantId !== request.tenantId) {
    return {
      ok: false,
      error: {
        code: 'cross-tenant-denied',
        message: `fulfillment "${admitted.fulfillmentId}" belongs to tenant "${admitted.tenantId}" but the request is scoped to "${request.tenantId}" (R12)`,
        expectedTenantId: request.tenantId,
        encounteredTenantId: admitted.tenantId,
      },
    };
  }
  if (fulfillments.some((existing) => existing.acquisitionId === admitted.acquisitionId)) {
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `acquisition request "${admitted.acquisitionId}" is already fulfilled — a request fulfills exactly once`,
        solutionId: request.solutionId,
        version: admitted.acquisitionId,
      },
    };
  }
  if (admitted.fulfilledAt < request.requestedAt) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: 'fulfillment instant precedes the request instant',
        issues: [{ path: 'fulfilledAt', message: 'fulfilledAt must not precede requestedAt' }],
      },
    };
  }
  return { ok: true, value: [...fulfillments, admitted] };
}
