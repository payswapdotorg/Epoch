/**
 * Substitutions and changes with constraint evaluation (the W037 pin:
 * "acceptance REQUIRES a constraint-evaluation reference (W004 policy
 * shapes, opaque digest) — a substitution without an attached
 * evaluation is `unevaluated-substitution-rejected`").
 *
 * - A substitution REQUEST is a typed, sealed, content-addressed record
 *   against one exact purchase-order version: the original commercial
 *   lines and the proposed substitute lines (sorted, bounded).
 * - The DECISION is a SEPARATE sealed record (`substitution-decision`):
 *   an ACCEPTANCE carries the constraint-evaluation reference — an
 *   OPAQUE digest in the W004 policy-evaluation shape (plus an optional
 *   opaque policy-shape reference); a rejection records the refusal.
 *   Accepting WITHOUT an evaluation reference is the typed
 *   `unevaluated-substitution-rejected` (the acceptance gate).
 * - Procurement never interprets policy: the evaluation digest is
 *   opaque, produced by the constraint/policy authority (W004), and
 *   only REFERENCED here.
 */
import { z } from 'zod';
import type { JsonValue } from '@epoch/agent-protocol';
import { TenantIdSchema } from '@epoch/solution-delivery';
import {
  NonNegativeDecimalSchema,
  OpaqueReferenceSchema,
  PoIdSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
  SubstitutionIdSchema,
  TimestampSchema,
  UnitLabelSchema,
  canonicalDigest,
} from './primitives';
import {
  SUBSTITUTION_REQUEST_SCHEMA_NAME,
  SUBSTITUTION_DECISION_SCHEMA_NAME,
  PROCUREMENT_RECORD_VERSION,
} from './version';
import { authorityViolationError, hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { ProcurementResult } from './errors';
import type { PurchaseOrderStore } from './order';

/** One substituted quantity line (original or substitute side). */
export const SubstitutionLineSchema = z
  .strictObject({
    description: z.string().min(1).max(256),
    quantity: NonNegativeDecimalSchema,
    unit: UnitLabelSchema,
  })
  .readonly()
  .meta({
    id: 'SubstitutionLine',
    title: 'SubstitutionLine',
    description: 'One quantity line of a substitution request (original or substitute side): description, quantity+unit.',
  });

/** One substitution line. */
export type SubstitutionLine = z.infer<typeof SubstitutionLineSchema>;

/**
 * The constraint-evaluation reference (W004 policy shapes, opaque
 * digest): what the acceptance must carry. The digest is produced by
 * the constraint/policy authority; procurement only references it.
 */
export const ConstraintEvaluationReferenceSchema = z
  .strictObject({
    evaluationDigest: Sha256HexSchema,
    policyShapeRef: OpaqueReferenceSchema.optional(),
  })
  .readonly()
  .meta({
    id: 'ConstraintEvaluationReference',
    title: 'ConstraintEvaluationReference',
    description:
      'The constraint-evaluation reference a substitution acceptance must carry: an opaque digest in the W004 policy-evaluation shape plus an optional opaque policy-shape reference.',
  });

/** One constraint-evaluation reference. */
export type ConstraintEvaluationReference = z.infer<typeof ConstraintEvaluationReferenceSchema>;

/** The substitution decision kinds. */
export const SUBSTITUTION_DECISION_KINDS = ['accepted', 'rejected'] as const;

/** One substitution decision kind. */
export type SubstitutionDecisionKind = (typeof SUBSTITUTION_DECISION_KINDS)[number];

/** The substitution request record content. */
const substitutionRequestShape = z.strictObject({
  schema: z.literal(SUBSTITUTION_REQUEST_SCHEMA_NAME),
  schemaVersion: z.literal(PROCUREMENT_RECORD_VERSION),
  substitutionId: SubstitutionIdSchema,
  tenantId: TenantIdSchema,
  poId: PoIdSchema,
  poVersionDigest: Sha256HexSchema,
  originalLines: z.array(SubstitutionLineSchema).min(1).max(64),
  substituteLines: z.array(SubstitutionLineSchema).min(1).max(64),
  requestedAt: TimestampSchema,
  requestedBy: PrincipalIdSchema,
  note: z.string().max(2048).optional(),
});

export const SubstitutionRequestContentSchema = substitutionRequestShape
  .readonly()
  .superRefine((request, ctx) => {
    for (const [field, lines] of [
      ['originalLines', request.originalLines],
      ['substituteLines', request.substituteLines],
    ] as const) {
      for (let i = 1; i < lines.length; i += 1) {
        if (lines[i]!.description < lines[i - 1]!.description) {
          ctx.addIssue({
            code: 'custom',
            message: `${field} must be sorted by description ascending (deterministic serialization)`,
            path: [field],
          });
          break;
        }
      }
    }
  })
  .meta({
    id: 'SubstitutionRequestContent',
    title: 'SubstitutionRequestContent',
    description:
      'The immutable content of one substitution request: the purchase order (exact version digest), the original and proposed substitute quantity lines, and request provenance.',
  });

/** One substitution request content. */
export type SubstitutionRequestContent = z.infer<typeof SubstitutionRequestContentSchema>;

/** The SEALED substitution request record. */
export const SealedSubstitutionRequestSchema = z
  .strictObject({
    ...substitutionRequestShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedSubstitutionRequest',
    title: 'SealedSubstitutionRequest',
    description:
      'The sealed substitution request record: immutable substitution content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed substitution request. */
export type SealedSubstitutionRequest = z.infer<typeof SealedSubstitutionRequestSchema>;

/** The substitution decision record content. */
const substitutionDecisionShape = z.strictObject({
  schema: z.literal(SUBSTITUTION_DECISION_SCHEMA_NAME),
  schemaVersion: z.literal(PROCUREMENT_RECORD_VERSION),
  substitutionId: SubstitutionIdSchema,
  substitutionRequestDigest: Sha256HexSchema,
  tenantId: TenantIdSchema,
  poId: PoIdSchema,
  decision: z.enum(SUBSTITUTION_DECISION_KINDS),
  constraintEvaluation: ConstraintEvaluationReferenceSchema,
  decidedAt: TimestampSchema,
  decidedBy: PrincipalIdSchema,
  note: z.string().max(2048).optional(),
});

export const SubstitutionDecisionContentSchema = substitutionDecisionShape
  .readonly()
  .meta({
    id: 'SubstitutionDecisionContent',
    title: 'SubstitutionDecisionContent',
    description:
      'The immutable content of one substitution decision: the substitution request (exact digest), the decision kind, the MANDATORY constraint-evaluation reference, and decision provenance.',
  });

/** One substitution decision content. */
export type SubstitutionDecisionContent = z.infer<typeof SubstitutionDecisionContentSchema>;

/** The SEALED substitution decision record. */
export const SealedSubstitutionDecisionSchema = z
  .strictObject({
    ...substitutionDecisionShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedSubstitutionDecision',
    title: 'SealedSubstitutionDecision',
    description:
      'The sealed substitution decision record: immutable decision content (with the constraint-evaluation reference) plus its SHA-256 content digest.',
  });

/** One sealed substitution decision. */
export type SealedSubstitutionDecision = z.infer<typeof SealedSubstitutionDecisionSchema>;

/** Compute the content digest of substitution-request content (canonical JSON). */
export function computeSubstitutionRequestDigest(content: SubstitutionRequestContent): string {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid substitution-request content into its published record. */
export function sealSubstitutionRequest(
  content: unknown,
): ProcurementResult<SealedSubstitutionRequest> {
  const pre = authorityViolationError(content);
  if (pre !== null) {
    return { ok: false, error: pre };
  }
  const parsed = SubstitutionRequestContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/** Verify a sealed substitution request (schema + digest recomputation). */
export function verifySealedSubstitutionRequest(
  sealed: unknown,
): ProcurementResult<SealedSubstitutionRequest> {
  const pre = authorityViolationError(sealed);
  if (pre !== null) {
    return { ok: false, error: pre };
  }
  const parsed = SealedSubstitutionRequestSchema.safeParse(sealed);
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
          'sealed substitution request digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** The append-only substitution store (requests + decisions). */
export interface SubstitutionStore {
  readonly requests: readonly SealedSubstitutionRequest[];
  readonly decisions: readonly SealedSubstitutionDecision[];
}

/** An empty substitution store. */
export function emptySubstitutionStore(): SubstitutionStore {
  return { requests: [], decisions: [] };
}

/**
 * Admit a sealed substitution request:
 *
 * - the request verifies (tamper detection);
 * - the purchase order exists (`dangling-reference-rejected`, kind
 *   `purchase-order`), is tenant-consistent
 *   (`tenant-isolation-rejected`) and the request grounds the CURRENT
 *   order version digest (`digest-mismatch`);
 * - an exact re-admission is idempotent; the same substitution id with
 *   different content is a typed `version-conflict`.
 */
export function admitSubstitutionRequest(
  orders: PurchaseOrderStore,
  store: SubstitutionStore,
  request: unknown,
): ProcurementResult<SubstitutionStore> {
  const verified = verifySealedSubstitutionRequest(request);
  if (!verified.ok) {
    return verified;
  }
  const admitted = verified.value;
  const head = [...orders.orders]
    .filter((order) => order.poId === admitted.poId)
    .sort((a, b) => a.poVersion - b.poVersion)
    .pop();
  if (head === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `substitution request "${admitted.substitutionId}" references purchase order "${admitted.poId}", which does not resolve`,
        referenceKind: 'purchase-order',
        referenceId: admitted.poId,
      },
    };
  }
  if (admitted.tenantId !== head.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `substitution request "${admitted.substitutionId}" belongs to tenant "${admitted.tenantId}" but the purchase order is scoped to "${head.tenantId}" (R12)`,
        expectedTenantId: head.tenantId,
        encounteredTenantId: admitted.tenantId,
        subject: admitted.substitutionId,
      },
    };
  }
  if (admitted.poVersionDigest !== head.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `substitution request "${admitted.substitutionId}" grounds order version digest "${admitted.poVersionDigest}" but the order's head version digest is "${head.contentDigest}"`,
        expected: head.contentDigest,
        encountered: admitted.poVersionDigest,
      },
    };
  }
  const exact = store.requests.find(
    (existing) =>
      existing.substitutionId === admitted.substitutionId &&
      existing.contentDigest === admitted.contentDigest,
  );
  if (exact !== undefined) {
    return { ok: true, value: store };
  }
  const existing = store.requests.find(
    (record) => record.substitutionId === admitted.substitutionId,
  );
  if (existing !== undefined) {
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `substitution request "${admitted.substitutionId}" is already sealed with different content — a sealed request is immutable; changed content ships as a NEW substitution id`,
        subject: 'substitution-request',
        subjectId: admitted.substitutionId,
        publishedDigest: existing.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  return { ok: true, value: { ...store, requests: [...store.requests, admitted] } };
}

/** The input of the substitution-decision builders. */
export interface SubstitutionDecisionInput {
  readonly request: SealedSubstitutionRequest;
  readonly decision: 'accepted' | 'rejected';
  /** The constraint-evaluation reference — MANDATORY for any decision. */
  readonly constraintEvaluation?: ConstraintEvaluationReference | undefined;
  readonly decidedAt: string;
  readonly decidedBy: string;
  readonly note?: string | undefined;
}

/**
 * Decide one substitution request. THE ACCEPTANCE GATE: a decision
 * whose input carries NO constraint-evaluation reference is the typed
 * `unevaluated-substitution-rejected` (a substitution without an
 * attached evaluation cannot become accepted delivery state); a
 * malformed reference is a typed `validation` error. Decisions on
 * unknown requests are `dangling-reference-rejected`.
 */
export function decideSubstitutionRequest(
  requests: readonly SealedSubstitutionRequest[],
  input: SubstitutionDecisionInput,
): ProcurementResult<SealedSubstitutionDecision> {
  const request = requests.find((record) => record.substitutionId === input.request.substitutionId);
  if (request === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `substitution decision references request "${input.request.substitutionId}", which does not resolve`,
        referenceKind: 'substitution-request',
        referenceId: input.request.substitutionId,
      },
    };
  }
  if (input.request.contentDigest !== request.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `substitution decision grounds request digest "${input.request.contentDigest}" but the request's exact digest is "${request.contentDigest}"`,
        expected: request.contentDigest,
        encountered: input.request.contentDigest,
      },
    };
  }
  if (input.constraintEvaluation === undefined) {
    return {
      ok: false,
      error: {
        code: 'unevaluated-substitution-rejected',
        message: `substitution request "${request.substitutionId}" cannot be ${input.decision === 'accepted' ? 'accepted' : 'decided'} without an attached constraint-evaluation reference — substitutions are evaluated against constraints/specifications before becoming accepted delivery state (W004 policy shapes, opaque digest)`,
        substitutionId: request.substitutionId,
      },
    };
  }
  const parsedEvaluation = ConstraintEvaluationReferenceSchema.safeParse(input.constraintEvaluation);
  if (!parsedEvaluation.success) {
    return { ok: false, error: validationError(parsedEvaluation.error) };
  }
  const content = {
    schema: SUBSTITUTION_DECISION_SCHEMA_NAME,
    schemaVersion: PROCUREMENT_RECORD_VERSION,
    substitutionId: request.substitutionId,
    substitutionRequestDigest: request.contentDigest,
    tenantId: request.tenantId,
    poId: request.poId,
    decision: input.decision,
    constraintEvaluation: parsedEvaluation.data,
    decidedAt: input.decidedAt,
    decidedBy: input.decidedBy,
    ...(input.note !== undefined ? { note: input.note } : {}),
  };
  const contentDigest = canonicalDigest(content as unknown as JsonValue);
  return { ok: true, value: { ...content, contentDigest } };
}

/** Verify a sealed substitution decision (schema + digest recomputation). */
export function verifySealedSubstitutionDecision(
  sealed: unknown,
): ProcurementResult<SealedSubstitutionDecision> {
  const pre = authorityViolationError(sealed);
  if (pre !== null) {
    return { ok: false, error: pre };
  }
  const parsed = SealedSubstitutionDecisionSchema.safeParse(sealed);
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
          'sealed substitution decision digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}
