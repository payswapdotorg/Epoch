/**
 * RECONCILIATION PROPOSALS (W038 pin: the EXPLICIT Observation ≠ Actual
 * separation): the package NEVER converts an observation to an actual by
 * itself; reconciliation is a TYPED, RECORDED proposal that the W036
 * DeliveryRecord authority accepts/actualizes.
 *
 * - {@link SealedReconciliationProposal} — the typed, sealed, recorded
 *   proposal: a sorted set of observation references, each paired with
 *   the actual id the W036 authority will mint, plus proposal provenance;
 * - `applyReconciliationProposal` — the ONLY bridge from proposed
 *   observations to authoritative delivery state, and it flows
 *   exclusively through the W036 DeliveryRecord path:
 *   `recordObservation -> acceptObservation -> actualizeObservation`
 *   (W036). This package NEVER writes Actual records directly: there is
 *   no code path that seals an `actual` distinction record and appends
 *   it to a delivery — actuals are minted by the W036 authority, which
 *   refuses anything not in the ACCEPTED set (its typed
 *   `unaccepted-actualization-rejected` surfaces here as the execution
 *   `actualization-bypass-rejected`). PARTIAL observations record
 *   without destructive overwrites: every step is an append to the
 *   immutable delivery state; nothing is overwritten, and an
 *   already-actualized observation is an idempotent skip, never a
 *   re-actualization.
 */
import { z } from 'zod';
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  DeliveryIdSchema,
  PrincipalIdSchema,
  Sha256HexSchema,
  SolutionIdSchema,
  TimestampSchema,
  DistinctionRecordIdSchema,
  acceptObservation,
  actualizeObservation,
  recordObservation,
  verifySealedDeliveryRecord,
  type ObservationRecord,
  type SealedDeliveryRecord,
  type SealedDistinctionRecord,
} from '@epoch/solution-delivery';
import { TenantIdSchema } from '@epoch/solution-delivery';
import { ReconciliationIdSchema } from './primitives';
import {
  EXECUTION_TRACKING_RECORD_VERSION,
  RECONCILIATION_PROPOSAL_SCHEMA_NAME,
} from './version';
import { adaptDeliveryResult } from './w036-adapter';
import { hasUnrecognizedKeys, validationError, vendorFieldsError } from './issues';
import type { ExecutionResult } from './errors';

/** One proposed observation->actual pairing of a reconciliation proposal. */
export const ReconciliationEntrySchema = z
  .strictObject({
    observationId: DistinctionRecordIdSchema,
    proposedActualId: z.string().regex(/^actual:[a-z0-9][a-z0-9-]{0,62}$/),
  })
  .readonly()
  .meta({
    id: 'ReconciliationEntry',
    title: 'ReconciliationEntry',
    description:
      'One proposed observation-to-actual pairing: the W036 observation record id plus the actual id the W036 authority will mint for it.',
  });

/** One reconciliation entry. */
export type ReconciliationEntry = z.infer<typeof ReconciliationEntrySchema>;

/**
 * The immutable content of one reconciliation proposal: the delivery it
 * targets, the sorted proposed pairings (min 1), and proposal provenance.
 */
export const ReconciliationProposalContentSchema = z
  .strictObject({
    schema: z.literal(RECONCILIATION_PROPOSAL_SCHEMA_NAME),
    schemaVersion: z.literal(EXECUTION_TRACKING_RECORD_VERSION),
    recordId: ReconciliationIdSchema,
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    deliveryId: DeliveryIdSchema,
    entries: z.array(ReconciliationEntrySchema).min(1).max(4096),
    proposedAt: TimestampSchema,
    proposedBy: PrincipalIdSchema,
    rationale: z.string().max(2048).optional(),
  })
  .readonly()
  .superRefine((proposal, ctx) => {
    for (let i = 1; i < proposal.entries.length; i += 1) {
      if (proposal.entries[i]!.observationId < proposal.entries[i - 1]!.observationId) {
        ctx.addIssue({
          code: 'custom',
          message: 'entries must be sorted by observationId ascending (deterministic serialization)',
          path: ['entries'],
        });
        break;
      }
      if (proposal.entries[i]!.observationId === proposal.entries[i - 1]!.observationId) {
        ctx.addIssue({
          code: 'custom',
          message: 'entries must be duplicate-free by observationId (an observation converts exactly once)',
          path: ['entries'],
        });
        break;
      }
    }
    const actualIds = new Set(proposal.entries.map((entry) => entry.proposedActualId));
    if (actualIds.size !== proposal.entries.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'proposedActualIds must be duplicate-free',
        path: ['entries'],
      });
    }
  })
  .meta({
    id: 'ReconciliationProposalContent',
    title: 'ReconciliationProposalContent',
    description:
      'The immutable content of one reconciliation proposal: the targeted delivery, the sorted observation-to-actual pairings, and the proposal provenance. The proposal is DATA — acceptance and actualization are the W036 DeliveryRecord authority acts.',
  });

/** One reconciliation-proposal content. */
export type ReconciliationProposalContent = z.infer<typeof ReconciliationProposalContentSchema>;

/** The SEALED reconciliation proposal: content plus its SHA-256 content digest. */
export const SealedReconciliationProposalSchema = z
  .strictObject({
    schema: z.literal(RECONCILIATION_PROPOSAL_SCHEMA_NAME),
    schemaVersion: z.literal(EXECUTION_TRACKING_RECORD_VERSION),
    recordId: ReconciliationIdSchema,
    tenantId: TenantIdSchema,
    solutionId: SolutionIdSchema,
    deliveryId: DeliveryIdSchema,
    entries: z.array(ReconciliationEntrySchema).min(1).max(4096),
    proposedAt: TimestampSchema,
    proposedBy: PrincipalIdSchema,
    rationale: z.string().max(2048).optional(),
    contentDigest: Sha256HexSchema,
  })
  .readonly()
  .meta({
    id: 'SealedReconciliationProposal',
    title: 'SealedReconciliationProposal',
    description:
      'The sealed reconciliation proposal: immutable content plus its SHA-256 content digest (exact-revision addressing).',
  });

/** One sealed reconciliation proposal. */
export type SealedReconciliationProposal = z.infer<typeof SealedReconciliationProposalSchema>;

/** Compute the content digest of a reconciliation-proposal content. */
export function computeReconciliationProposalDigest(
  content: ReconciliationProposalContent,
): Sha256Hex {
  return canonicalDigest(content as unknown as JsonValue);
}

/** Seal valid reconciliation-proposal content into its published record. */
export function sealReconciliationProposal(
  content: unknown,
): ExecutionResult<SealedReconciliationProposal> {
  const parsed = ReconciliationProposalContentSchema.safeParse(content);
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
 * Verify a sealed reconciliation proposal: schema validation + digest
 * recomputation (tamper detection — `digest-mismatch`).
 */
export function verifySealedReconciliationProposal(
  sealed: unknown,
): ExecutionResult<SealedReconciliationProposal> {
  const parsed = SealedReconciliationProposalSchema.safeParse(sealed);
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
          'sealed reconciliation proposal digest does not match its content (tampered or mismatched envelope)',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

// --------------------------------------------------------------------------------
// The application bridge: the W036 DeliveryRecord authority path ONLY.
// --------------------------------------------------------------------------------

/** The application provenance supplied by the authority operator. */
export interface ReconciliationApplication {
  readonly acceptedBy: string;
  readonly acceptedAt: string;
  readonly actualizedBy: string;
  readonly actualizedAt: string;
}

/** The outcome of one observation's reconciliation. */
export type ReconciliationApplicationOutcome =
  | { readonly observationId: string; readonly actualId: string; readonly outcome: 'actualized' }
  | {
      readonly observationId: string;
      readonly actualId: string;
      readonly outcome: 'already-actualized';
    };

/** The result of applying one proposal: the next delivery state + per-observation outcomes. */
export interface ReconciliationApplicationResult {
  readonly delivery: SealedDeliveryRecord;
  readonly applications: readonly ReconciliationApplicationOutcome[];
}

/**
 * Apply a reconciliation proposal to a sealed delivery record — the ONLY
 * bridge from proposed observations to authoritative delivery state:
 *
 * 1. the delivery verifies (W036 digest recomputation — tamper
 *    detection);
 * 2. the proposal verifies (digest recomputation);
 * 3. tenant/tenancy and delivery scope checks (the proposal's tenant and
 *    delivery must match the delivery record's);
 * 4. per entry (sorted by observationId — deterministic):
 *    a. the observation record is provided, sealed, of kind
 *       `observation`, tenant- and delivery-scoped, and VERIFIES through
 *       the W036 machinery (digest mismatch -> typed
 *       `digest-mismatch`);
 *    b. `recordObservation` (W036) appends it to the delivery state if
 *       absent — PARTIAL observations record WITHOUT destructive
 *       overwrites (a same-id different-digest record is a typed
 *       `version-conflict`, never an overwrite);
 *    c. `acceptObservation` (W036) moves it into the accepted set (the
 *       verification boundary: a REJECTED observation is a typed
 *       `lifecycle-conflict` and never actualizes);
 *    d. `actualizeObservation` (W036) mints the actual — the authority
 *       path; an observation already actualized is an idempotent
 *       `already-actualized` skip (never a re-actualization).
 *
 * This function contains NO code that seals an `actual` distinction
 * record or appends to `delivery.actuals` directly: actuals are minted
 * by the W036 `actualizeObservation` authority alone.
 */
export function applyReconciliationProposal(
  delivery: SealedDeliveryRecord,
  proposal: SealedReconciliationProposal,
  observations: readonly SealedDistinctionRecord[],
  application: ReconciliationApplication,
): ExecutionResult<ReconciliationApplicationResult> {
  const verifiedDelivery = verifySealedDeliveryRecord(delivery);
  if (!verifiedDelivery.ok) {
    return adaptDeliveryResult(verifiedDelivery, delivery.deliveryId);
  }
  let current = verifiedDelivery.value;
  const verifiedProposal = verifySealedReconciliationProposal(proposal);
  if (!verifiedProposal.ok) {
    return verifiedProposal;
  }
  if (proposal.tenantId !== current.tenantId) {
    return {
      ok: false,
      error: {
        code: 'tenant-isolation-rejected',
        message: `reconciliation proposal "${proposal.recordId}" belongs to tenant "${proposal.tenantId}" but the delivery is scoped to "${current.tenantId}" (R12)`,
        expectedTenantId: current.tenantId,
        encounteredTenantId: proposal.tenantId,
        subject: proposal.recordId,
      },
    };
  }
  if (proposal.deliveryId !== current.deliveryId) {
    return {
      ok: false,
      error: {
        code: 'dangling-reference-rejected',
        message: `reconciliation proposal "${proposal.recordId}" targets delivery "${proposal.deliveryId}" but the applied delivery is "${current.deliveryId}"`,
        referenceKind: 'delivery-record',
        referenceId: proposal.deliveryId,
      },
    };
  }
  if (proposal.solutionId !== current.solutionId) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `reconciliation proposal "${proposal.recordId}" subjects solution "${proposal.solutionId}" but the delivery is for "${current.solutionId}"`,
        issues: [{ path: 'solutionId', message: 'proposal/delivery solution mismatch' }],
      },
    };
  }

  const provided = new Map<string, ObservationRecord>();
  for (const record of observations) {
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

  const applications: ReconciliationApplicationOutcome[] = [];
  for (const entry of [...proposal.entries].sort((a, b) =>
    a.observationId < b.observationId ? -1 : 1,
  )) {
    const observation = provided.get(entry.observationId);
    if (observation === undefined) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `reconciliation proposal "${proposal.recordId}" references observation "${entry.observationId}" which is not among the provided records`,
          referenceKind: 'observation-record',
          referenceId: entry.observationId,
        },
      };
    }
    if (observation.payload.deliveryId !== current.deliveryId) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `observation "${observation.recordId}" belongs to delivery "${observation.payload.deliveryId}" but the reconciliation targets "${current.deliveryId}"`,
          referenceKind: 'delivery-record',
          referenceId: observation.payload.deliveryId,
        },
      };
    }

    // (b) Record the observation if absent — append-only, never an overwrite.
    const existing = current.observations.find(
      (candidate) => candidate.recordId === observation.recordId,
    );
    if (existing === undefined) {
      const recorded = recordObservation(current, observation);
      if (!recorded.ok) {
        return adaptDeliveryResult(recorded, observation.recordId);
      }
      current = recorded.value;
    } else if (existing.contentDigest !== observation.contentDigest) {
      return {
        ok: false,
        error: {
          code: 'version-conflict',
          message: `observation "${observation.recordId}" is already recorded with different content — observations are append-only and immutable (never a destructive overwrite)`,
          subject: 'observation-record',
          subjectId: observation.recordId,
          publishedDigest: existing.contentDigest,
          encounteredDigest: observation.contentDigest,
        },
      };
    }

    // (c) The verification boundary: acceptance (a rejected observation
    // never passes; W036 rejects it with lifecycle-conflict).
    const accepted = acceptObservation(current, observation.recordId, {
      acceptedBy: application.acceptedBy,
      acceptedAt: application.acceptedAt,
    });
    if (!accepted.ok) {
      return adaptDeliveryResult(accepted, observation.recordId);
    }
    current = accepted.value;

    // (d) Actualize through the W036 authority (idempotent skip when
    // the observation already converted).
    const alreadyActualized = current.actuals.some(
      (actual) => actual.payload.derivedFromObservationId === observation.recordId,
    );
    if (alreadyActualized) {
      applications.push({
        observationId: observation.recordId,
        actualId: entry.proposedActualId,
        outcome: 'already-actualized',
      });
      continue;
    }
    const actualized = actualizeObservation(current, observation.recordId, {
      actualId: entry.proposedActualId,
      actualizedBy: application.actualizedBy,
      actualizedAt: application.actualizedAt,
    });
    if (!actualized.ok) {
      return adaptDeliveryResult(actualized, observation.recordId);
    }
    current = actualized.value;
    applications.push({
      observationId: observation.recordId,
      actualId: entry.proposedActualId,
      outcome: 'actualized',
    });
  }

  return { ok: true, value: { delivery: current, applications } };
}
