/**
 * The supplier-delivery state machine over one purchase order:
 * `ordered -> confirmed -> shipped/partial -> received -> accepted |
 * rejected | disputed`, with APPEND-ONLY transitions and accumulating
 * partial receipts (never overwritten).
 *
 * - Each transition is a TYPED, sealed, content-addressed record
 *   (`po-transition:<slug>`) grounding the EXACT purchase-order version
 *   digest; transitions into `partial` or `received` MUST carry a
 *   receipt payload whose observation reference links to the W036
 *   DeliveryRecord observation intake (verified through the REAL W036
 *   `verifySealedDistinctionRecord` at admission — kind
 *   `observation`, else typed `distinction-collapse-rejected`).
 * - The state is DERIVED by folding the transition log
 *   (`foldSupplierDelivery`) — it is never stored, never mutated in
 *   place; partial receipts ACCUMULATE by exact decimal addition
 *   (canonical, order-invariant).
 * - Illegal transitions are typed `lifecycle-conflict`; tenant
 *   violations `tenant-isolation-rejected`; broken order-version links
 *   `digest-mismatch`; replays `version-conflict`.
 */
import { z } from 'zod';
import type { JsonValue } from '@epoch/agent-protocol';
import { addNonNegativeDecimals } from '@epoch/solution-delivery';
import type { SealedDistinctionRecord, Measure } from '@epoch/solution-delivery';
import { TenantIdSchema } from '@epoch/solution-delivery';
import {
  NonNegativeDecimalSchema,
  PoIdSchema,
  PoTransitionIdSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
  TimestampSchema,
  UnitLabelSchema,
  canonicalDigest,
} from './primitives';
import {
  SUPPLIER_DELIVERY_STATES,
  SUPPLIER_DELIVERY_TRANSITIONS,
  RECEIPT_BEARING_STATES,
  SUPPLIER_DELIVERY_TRANSITION_SCHEMA_NAME,
  PROCUREMENT_RECORD_VERSION,
  type SupplierDeliveryState,
} from './version';
import { authorityViolationError, hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { ProcurementResult } from './errors';
import type { PurchaseOrderStore } from './order';

/** One observation reference into the W036 DeliveryRecord intake (exact revision). */
export const ObservationReferenceSchema = z
  .strictObject({
    recordId: z.string().regex(/^observation:[a-z0-9][a-z0-9-]{0,62}$/),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'ObservationReference',
    title: 'ObservationReference',
    description:
      'One W036 Observation-distinction record reference: the kind-prefixed record id plus its exact content digest (the DeliveryRecord observation intake linkage).',
  });

/** One observation reference. */
export type ObservationReference = z.infer<typeof ObservationReferenceSchema>;

/** One received-quantity line of a receipt payload. */
export const ReceiptLineSchema = z
  .strictObject({
    description: z.string().min(1).max(256),
    quantity: NonNegativeDecimalSchema,
    unit: UnitLabelSchema,
  })
  .readonly()
  .meta({
    id: 'ReceiptLine',
    title: 'ReceiptLine',
    description:
      'One received-quantity line of a supplier-delivery receipt: description, quantity+unit (partial deliveries accumulate by exact decimal addition).',
  });

/** One receipt line. */
export type ReceiptLine = z.infer<typeof ReceiptLineSchema>;

/** The receipt payload of a partial/received transition. */
export const ReceiptPayloadSchema = z
  .strictObject({
    observationRef: ObservationReferenceSchema,
    lines: z.array(ReceiptLineSchema).min(1).max(64),
    receivedAt: TimestampSchema,
    receivedBy: PrincipalIdSchema,
    note: z.string().max(2048).optional(),
  })
  .readonly()
  .superRefine((receipt, ctx) => {
    for (let i = 1; i < receipt.lines.length; i += 1) {
      if (receipt.lines[i]!.description < receipt.lines[i - 1]!.description) {
        ctx.addIssue({
          code: 'custom',
          message: 'receipt lines must be sorted by description ascending (deterministic serialization)',
          path: ['lines'],
        });
        break;
      }
    }
  })
  .meta({
    id: 'ReceiptPayload',
    title: 'ReceiptPayload',
    description:
      'The receipt payload of a supplier-delivery transition into partial/received: the W036 observation reference (the delivery-receipt observation), sorted received-quantity lines, and receipt provenance.',
  });

/** One receipt payload. */
export type ReceiptPayload = z.infer<typeof ReceiptPayloadSchema>;

/**
 * The immutable content of one supplier-delivery transition record.
 */
const supplierDeliveryTransitionShape = z.strictObject({
  schema: z.literal(SUPPLIER_DELIVERY_TRANSITION_SCHEMA_NAME),
  schemaVersion: z.literal(PROCUREMENT_RECORD_VERSION),
  transitionId: PoTransitionIdSchema,
  tenantId: TenantIdSchema,
  poId: PoIdSchema,
  poVersionDigest: Sha256HexSchema,
  from: z.enum(SUPPLIER_DELIVERY_STATES),
  to: z.enum(SUPPLIER_DELIVERY_STATES),
  receipt: ReceiptPayloadSchema.optional(),
  occurredAt: TimestampSchema,
  recordedBy: PrincipalIdSchema,
  note: z.string().max(2048).optional(),
});

export const SupplierDeliveryTransitionContentSchema = supplierDeliveryTransitionShape
  .readonly()
  .superRefine((transition, ctx) => {
    if (RECEIPT_BEARING_STATES.includes(transition.to) && transition.receipt === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: `transitions into "${transition.to}" must carry a receipt payload linked to the W036 observation intake`,
        path: ['receipt'],
      });
    }
    if (transition.receipt !== undefined && !RECEIPT_BEARING_STATES.includes(transition.to)) {
      ctx.addIssue({
        code: 'custom',
        message: `only transitions into "partial" or "received" carry a receipt payload (encountered "${transition.to}")`,
        path: ['receipt'],
      });
    }
  })
  .meta({
    id: 'SupplierDeliveryTransitionContent',
    title: 'SupplierDeliveryTransitionContent',
    description:
      'The immutable content of one supplier-delivery transition: the purchase order (exact version digest), the from/to states, the mandatory receipt payload for partial/received transitions (W036 observation linkage), and provenance.',
  });

/** One transition content. */
export type SupplierDeliveryTransitionContent = z.infer<
  typeof SupplierDeliveryTransitionContentSchema
>;

/** The SEALED supplier-delivery transition record. */
export const SealedSupplierDeliveryTransitionSchema = z
  .strictObject({
    ...supplierDeliveryTransitionShape.shape,
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedSupplierDeliveryTransition',
    title: 'SealedSupplierDeliveryTransition',
    description:
      'The sealed supplier-delivery transition record: immutable append-only transition content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed transition. */
export type SealedSupplierDeliveryTransition = z.infer<
  typeof SealedSupplierDeliveryTransitionSchema
>;

/** Compute the content digest of transition content (canonical JSON). */
export function computeSupplierDeliveryTransitionDigest(
  content: SupplierDeliveryTransitionContent,
): string {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid transition content into its published record. */
export function sealSupplierDeliveryTransition(
  content: unknown,
): ProcurementResult<SealedSupplierDeliveryTransition> {
  const pre = authorityViolationError(content);
  if (pre !== null) {
    return { ok: false, error: pre };
  }
  const parsed = SupplierDeliveryTransitionContentSchema.safeParse(content);
  if (!parsed.success) {
    if (hasUnrecognizedKeys(parsed.error)) {
      return { ok: false, error: vendorFieldsError(parsed.error) };
    }
    return { ok: false, error: validationError(parsed.error) };
  }
  const contentDigest = canonicalDigest(parsed.data as unknown as JsonValue);
  return { ok: true, value: { ...parsed.data, contentDigest } };
}

/** Verify a sealed transition record (schema + digest recomputation). */
export function verifySealedSupplierDeliveryTransition(
  sealed: unknown,
): ProcurementResult<SealedSupplierDeliveryTransition> {
  const pre = authorityViolationError(sealed);
  if (pre !== null) {
    return { ok: false, error: pre };
  }
  const parsed = SealedSupplierDeliveryTransitionSchema.safeParse(sealed);
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
          'sealed supplier-delivery transition digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/** The append-only delivery log of one purchase order (reference in-memory). */
export interface SupplierDeliveryLog {
  readonly poId: string;
  readonly tenantId: string;
  readonly transitions: readonly SealedSupplierDeliveryTransition[];
}

/** An empty delivery log for one purchase order. */
export function emptyDeliveryLog(poId: string, tenantId: string): SupplierDeliveryLog {
  return { poId, tenantId, transitions: [] };
}

/** Whether a transition is legal per the closed transition table. */
export function isLegalTransition(from: SupplierDeliveryState, to: SupplierDeliveryState): boolean {
  return (SUPPLIER_DELIVERY_TRANSITIONS[from] as readonly string[]).includes(to);
}

/**
 * The derived delivery state: the fold of the transition log (the
 * initial state of a purchase order is `ordered`; each transition moves
 * the derived state; `partial -> partial` accumulates). Derivation
 * only — the state is NEVER stored on the log.
 */
export interface SupplierDeliveryProjection {
  readonly poId: string;
  readonly state: SupplierDeliveryState;
  readonly transitionCount: number;
  readonly receivedLines: readonly ReceiptLine[];
  readonly receiptCount: number;
}

/**
 * Fold the delivery log into its projection:
 *
 * - the state derives from the transition sequence (`ordered` when
 *   empty);
 * - partial/received receipt lines ACCUMULATE by exact decimal addition
 *   per (description, unit) — partial deliveries never overwrite;
 * - receipt lines are sorted by description (deterministic; the fold is
 *   invariant under input-order permutation of same-state receipts).
 */
export function foldSupplierDelivery(log: SupplierDeliveryLog): SupplierDeliveryProjection {
  let state: SupplierDeliveryState = 'ordered';
  const accumulated = new Map<string, { description: string; quantity: string; unit: string }>();
  let receiptCount = 0;
  // The log is append-only: the array order IS the causal order (the
  // monotonic-instant admission guards causality); the fold never
  // re-sorts history.
  for (const transition of log.transitions) {
    state = transition.to;
    if (transition.receipt !== undefined) {
      receiptCount += 1;
      for (const line of transition.receipt.lines) {
        const key = `${line.unit} ${line.description}`;
        const existing = accumulated.get(key);
        accumulated.set(key, {
          description: line.description,
          quantity:
            existing === undefined
              ? line.quantity
              : addNonNegativeDecimals(existing.quantity, line.quantity),
          unit: line.unit,
        });
      }
    }
  }
  const receivedLines = [...accumulated.values()]
    .map((line) => ({ description: line.description, quantity: line.quantity, unit: line.unit }))
    .sort((a, b) => (a.description < b.description ? -1 : 1));
  return {
    poId: log.poId,
    state,
    transitionCount: log.transitions.length,
    receivedLines,
    receiptCount,
  };
}

/**
 * Append one sealed transition to the delivery log (append-only):
 *
 * - the record verifies (tamper detection);
 * - the log's po id and tenant match the record (`validation` /
 *   `tenant-isolation-rejected` — the tenant guard is a typed
 *   rejection naming the po);
 * - the transition grounds the CURRENT purchase-order version digest
 *   (`digest-mismatch` when the order was amended after the transition
 *   was sealed);
 * - the `from` state must equal the CURRENT derived state and the
 *   transition must be legal per the closed table — otherwise typed
 *   `lifecycle-conflict`;
 * - receipt-bearing transitions verify their observation reference
 *   against the supplied W036 sealed distinction records: the record
 *   must exist, its digest must match, and its kind must be
 *   `observation` (any other distinction kind is a typed
 *   `distinction-collapse-rejected`) with a matching tenant;
 * - transition instants are monotonic (non-decreasing) along the log;
 * - an exact re-admission is idempotent; the same transition id with
 *   different content is a typed `version-conflict`.
 */
export function appendSupplierDeliveryTransition(
  orders: PurchaseOrderStore,
  observations: readonly SealedDistinctionRecord[],
  log: SupplierDeliveryLog,
  transition: unknown,
): ProcurementResult<SupplierDeliveryLog> {
  const verified = verifySealedSupplierDeliveryTransition(transition);
  if (!verified.ok) {
    return verified;
  }
  const admitted = verified.value;
  if (admitted.poId !== log.poId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `transition "${admitted.transitionId}" belongs to purchase order "${admitted.poId}" but the log tracks "${log.poId}"`,
        issues: [{ path: 'poId', message: 'the transition must belong to the tracked purchase order' }],
      },
    };
  }
  if (admitted.tenantId !== log.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `transition "${admitted.transitionId}" belongs to tenant "${admitted.tenantId}" but the delivery log is scoped to "${log.tenantId}" (R12)`,
        expectedTenantId: log.tenantId,
        encounteredTenantId: admitted.tenantId,
        subject: admitted.poId,
      },
    };
  }
  const head = orders.orders.find((order) => order.poId === admitted.poId);
  if (head === undefined) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `transition "${admitted.transitionId}" references purchase order "${admitted.poId}", which does not resolve`,
        referenceKind: 'purchase-order',
        referenceId: admitted.poId,
      },
    };
  }
  const headVersion = [...orders.orders]
    .filter((order) => order.poId === admitted.poId)
    .sort((a, b) => a.poVersion - b.poVersion)
    .pop()!;
  if (admitted.poVersionDigest !== headVersion.contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: `transition "${admitted.transitionId}" grounds order version digest "${admitted.poVersionDigest}" but the order's head version digest is "${headVersion.contentDigest}" — transitions ground the current order revision`,
        expected: headVersion.contentDigest,
        encountered: admitted.poVersionDigest,
      },
    };
  }
  const exact = log.transitions.find(
    (existing) => existing.transitionId === admitted.transitionId,
  );
  if (exact !== undefined) {
    if (exact.contentDigest === admitted.contentDigest) {
      return { ok: true, value: log };
    }
    return {
      ok: false,
      error: {
        code: 'version-conflict',
        message: `transition "${admitted.transitionId}" is already appended with different content — a sealed transition is immutable`,
        subject: 'supplier-delivery-transition',
        subjectId: admitted.transitionId,
        publishedDigest: exact.contentDigest,
        encounteredDigest: admitted.contentDigest,
      },
    };
  }
  const projection = foldSupplierDelivery(log);
  if (admitted.from !== projection.state) {
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message: `transition "${admitted.transitionId}" moves from "${admitted.from}" but the derived delivery state of order "${admitted.poId}" is "${projection.state}" (append-only fold)`,
        subjectId: admitted.poId,
        from: admitted.from,
        to: admitted.to,
      },
    };
  }
  if (!isLegalTransition(admitted.from, admitted.to)) {
    return {
      ok: false,
      error: {
        code: 'lifecycle-conflict',
        message: `transition "${admitted.transitionId}" ("${admitted.from}" -> "${admitted.to}") is not legal for the supplier-delivery state machine (closed transition table)`,
        subjectId: admitted.poId,
        from: admitted.from,
        to: admitted.to,
      },
    };
  }
  const last = log.transitions.length === 0 ? undefined : log.transitions[log.transitions.length - 1]!;
  if (last !== undefined && admitted.occurredAt < last.occurredAt) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `transition "${admitted.transitionId}" occurs before the last appended transition ("${last.transitionId}") — the log's instants are monotonic`,
        issues: [{ path: 'occurredAt', message: 'occurredAt must not precede the last transition instant' }],
      },
    };
  }
  if (admitted.receipt !== undefined) {
    const observation = observations.find(
      (record) => record.recordId === admitted.receipt!.observationRef.recordId,
    );
    if (observation === undefined) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `transition "${admitted.transitionId}" references observation record "${admitted.receipt.observationRef.recordId}", which does not resolve in the W036 observation intake`,
          referenceKind: 'observation-record',
          referenceId: admitted.receipt.observationRef.recordId,
        },
      };
    }
    if (observation.contentDigest !== admitted.receipt.observationRef.contentDigest) {
      return {
        ok: false,
        error: {
          code: 'digest-mismatch',
          message: `transition "${admitted.transitionId}" references observation digest "${admitted.receipt.observationRef.contentDigest}" but the record's exact digest is "${observation.contentDigest}"`,
          expected: observation.contentDigest,
          encountered: admitted.receipt.observationRef.contentDigest,
        },
      };
    }
    if (observation.kind !== 'observation') {
      return {
        ok: false,
        error: {
          code: 'distinction-collapse-rejected',
          message: `transition "${admitted.transitionId}" links a "${observation.kind}" distinction record as its receipt observation — receipts link W036 OBSERVATION records only (the distinctions are separate immutable records)`,
          recordId: observation.recordId,
          expectedKind: 'observation',
          encounteredKind: observation.kind,
        },
      };
    }
    if (observation.tenantId !== admitted.tenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `observation record "${observation.recordId}" belongs to tenant "${observation.tenantId}" but the transition is scoped to "${admitted.tenantId}" (R12)`,
          expectedTenantId: admitted.tenantId,
          encounteredTenantId: observation.tenantId,
          subject: observation.recordId,
        },
      };
    }
  }
  return {
    ok: true,
    value: { ...log, transitions: [...log.transitions, admitted] },
  };
}

/** Re-exported for consumers of the observation linkage. */
export type { Measure };
