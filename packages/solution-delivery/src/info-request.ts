/**
 * Information-acquisition requests (USL1.0 decision-sufficiency rule,
 * binding): a missing field is NOT automatically a blocker.
 *
 * Epoch should:
 * 1. determine whether the unknown can change the decision, safety /
 *    authority boundary or verification result (the `decisionImpact`
 *    field: material or immaterial);
 * 2. acquire it when the expected decision impact is material;
 * 3. otherwise preserve the uncertainty with provenance, freshness and
 *    confidence (src/uncertainty.ts).
 *
 * `isMaterialDecisionImpact` is the typed helper for rule (2): a request
 * is issued when the expected decision impact is material. Fulfillment
 * references the request — requested and acquired information stay
 * distinguishable, and the fulfilled evidence is referenced opaquely.
 */
import { z } from 'zod';
import { TimestampSchema } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/tenancy';
import {
  InfoRequestIdSchema,
  OpaqueReferenceSchema,
  PrincipalIdSchema,
  SolutionIdSchema,
} from './primitives';
import { EvidenceReferenceSchema } from './solution';
import { UncertaintyStateSchema } from './uncertainty';
import {
  INFO_REQUEST_SCHEMA_NAME,
  SOLUTION_DELIVERY_RECORD_VERSION,
  UNIVERSAL_LIFECYCLE_STAGES,
} from './version';
import { hasUnrecognizedKeys, vendorFieldsError, validationError } from './issues';
import type { DeliveryResult } from './errors';

/** The materiality of an unknown's expected decision impact. */
export const DECISION_IMPACT_MATERIALITIES = ['material', 'immaterial'] as const;

/** One decision-impact materiality. */
export type DecisionImpactMateriality = (typeof DECISION_IMPACT_MATERIALITIES)[number];

/** Which decision the requested information can change. */
export const DECISION_IMPACT_KINDS = [
  'solution-selection',
  'constraint-compliance',
  'safety-boundary',
  'authority-boundary',
  'verification-result',
  'cost-basis',
  'schedule-basis',
  'resource-allocation',
] as const;

/** One decision-impact kind. */
export type DecisionImpactKind = (typeof DECISION_IMPACT_KINDS)[number];

/** The decision impact of the requested information (USL1.0 rule 1). */
export const DecisionImpactSchema = z
  .strictObject({
    stage: z.enum(UNIVERSAL_LIFECYCLE_STAGES),
    decisionKind: z.enum(DECISION_IMPACT_KINDS),
    materiality: z.enum(DECISION_IMPACT_MATERIALITIES),
    rationale: z.string().min(1).max(2048),
  })
  .readonly()
  .meta({
    id: 'DecisionImpact',
    title: 'DecisionImpact',
    description:
      'The decision impact of one requested unknown: the lifecycle stage, the decision kind it can change, the materiality, and the rationale.',
  });

/** One decision impact. */
export type DecisionImpact = z.infer<typeof DecisionImpactSchema>;

/**
 * The freshness requirement of one request: how stale the answer may be
 * (a state plus the instant the requirement was assessed).
 */
export const FreshnessRequirementSchema = z
  .strictObject({
    state: z.enum(['fresh', 'aging', 'stale']),
    assessedAt: TimestampSchema,
  })
  .readonly()
  .meta({
    id: 'FreshnessRequirement',
    title: 'FreshnessRequirement',
    description: 'The freshness requirement of one information request: a state plus the assessment instant.',
  });

/** One freshness requirement. */
export type FreshnessRequirement = z.infer<typeof FreshnessRequirementSchema>;

/** One information-acquisition request. */
export const InformationAcquisitionRequestSchema = z
  .strictObject({
    schema: z.literal(INFO_REQUEST_SCHEMA_NAME),
    schemaVersion: z.literal(SOLUTION_DELIVERY_RECORD_VERSION),
    requestId: InfoRequestIdSchema,
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    requestedInformation: z.string().min(1).max(2048),
    decisionImpact: DecisionImpactSchema,
    freshnessRequirement: FreshnessRequirementSchema.optional(),
    requestedFrom: OpaqueReferenceSchema.optional(),
    issuedAt: TimestampSchema,
    issuedBy: PrincipalIdSchema,
    status: z.enum(['open', 'fulfilled', 'abandoned']),
    fulfillment: z
      .strictObject({
        evidence: z.array(EvidenceReferenceSchema).max(64),
        fulfilledAt: TimestampSchema,
        fulfilledBy: PrincipalIdSchema,
        uncertainty: UncertaintyStateSchema,
      })
      .readonly()
      .optional(),
  })
  .readonly()
  .superRefine((request, ctx) => {
    if (request.status === 'fulfilled' && request.fulfillment === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'a fulfilled request must carry its fulfillment',
        path: ['fulfillment'],
      });
    }
    if (request.status !== 'fulfilled' && request.fulfillment !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'only a fulfilled request carries a fulfillment',
        path: ['status'],
      });
    }
    if (request.fulfillment !== undefined) {
      for (let i = 1; i < request.fulfillment.evidence.length; i += 1) {
        if (request.fulfillment.evidence[i]!.digest < request.fulfillment.evidence[i - 1]!.digest) {
          ctx.addIssue({
            code: 'custom',
            message: 'fulfillment evidence must be sorted by digest ascending (deterministic serialization)',
            path: ['fulfillment', 'evidence'],
          });
          break;
        }
      }
    }
  })
  .meta({
    id: 'InformationAcquisitionRequest',
    title: 'InformationAcquisitionRequest',
    description:
      'One information-acquisition request: what is missing, the decision it can change, the freshness requirement, an optional opaque source, and the open/fulfilled/abandoned status.',
  });

/** One information-acquisition request. */
export type InformationAcquisitionRequest = z.infer<typeof InformationAcquisitionRequestSchema>;

/**
 * The typed decision-sufficiency helper (USL1.0 rule 2): a request is
 * issued when the expected decision impact is material. An IMMATERIAL
 * unknown is preserved with uncertainty — it does not spawn a request.
 */
export function isMaterialDecisionImpact(
  decisionImpact: DecisionImpact,
): boolean {
  return decisionImpact.materiality === 'material';
}

/**
 * Admit an information-acquisition request: schema validation with the
 * vendor-field classifier.
 */
export function admitInformationAcquisitionRequest(
  request: unknown,
): DeliveryResult<InformationAcquisitionRequest> {
  const parsed = InformationAcquisitionRequestSchema.safeParse(request);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}
