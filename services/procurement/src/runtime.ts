/**
 * The reference procurement runtime host (W037): the thin typed HOST
 * FACADE over the @epoch/procurement kernel.
 *
 * Owns (and only owns): tenant-scoped requirement intake (lineage +
 * package assembly over REAL W036 acquisition requests) with
 * IDEMPOTENT duplicate handling (content-addressed idempotency keys —
 * a replayed intake returns the SEALED PRIOR RECORD as the typed
 * `duplicate-intake-returned` admission with the state unchanged),
 * quoting through the SupplierPort adapter seam (ONE in-memory
 * reference adapter; the core never names a vendor), quote selection,
 * W036 commitment linkage, purchase-order issue/amendment
 * (version-chained), supplier-delivery tracking (append-only state
 * machine with accumulating partial receipts linked to W036
 * observation intake), substitution decisions behind the
 * constraint-evaluation gate, and the derived-only acquisition-status
 * projection. Every step emits one `procurement:*` event on the
 * package's stream (`stream:procurement-<suffix>`, one package = one
 * stream, digests sealed by the kernel and pinned by the REAL sealEvent
 * parity tests).
 *
 * Explicitly NOT (later Work Orders / out of scope): durable
 * persistence, real supplier integrations (adapters of SupplierPort),
 * the invoice/payment tail of the procurement model, external event
 * bridging (W042).
 *
 * Determinism: ZERO wall-clock reads and ZERO randomness — every
 * instant is caller-supplied; every listing/snapshot is sorted (no
 * insertion-order leaks); two runtimes fed the same operations hold
 * byte-identical state.
 *
 * Tenant isolation (R12): all state is tenant-scoped; cross-tenant
 * operations are typed `tenant-isolation-rejected`. The host may be
 * pinned to one tenant (`expectedTenantId`, the single-tenant guard
 * precedent).
 */
import {
  AUTHORIZATION_RECORD_VERSION,
  evaluate,
  parseAuthorizationContext,
} from '@epoch/authorization';
import type { AuthorizationDecision } from '@epoch/authorization';
import {
  canonicalDigest,
  deriveProcurementIntakeKey,
  foldSupplierDelivery,
  procurementStreamIdOf,
  sealProcurementEvent,
  type AcquisitionPackageStore,
  type ProcurementIntakeKey,
  type PurchaseOrderStore,
  type QuoteStore,
  type SealedAcquisitionStatus,
  type SealedDistinctionRecord,
  type SealedProcurementEvent,
  type SealedPurchaseOrder,
  type SealedQuote,
  type SealedQuoteSelection,
  type SealedSubstitutionDecision,
  type SealedSubstitutionRequest,
  type SealedSupplierDeliveryTransition,
  type SelectionStore,
  type SupplierDeliveryLog,
  type SupplierDeliveryProjection,
} from '@epoch/procurement';
import {
  admitSupplierSubmission,
  assembleRequirementPackage,
  issueOrderVersion,
  projectStatus,
  recordDeliveryTransition,
  recordQuoteSelection,
  requestAndDecideSubstitution,
  sealCommitmentForSelection,
} from './driver';
import { InMemorySupplierAdapter } from './supplier-port';
import { RUNTIME_RECORD_VERSION } from './version';
import type {
  AuthorizationInput,
  DecideSubstitutionOptions,
  IntakeOutcome,
  IntakeRequirementOptions,
  IssuePurchaseOrderOptions,
  LinkCommitmentOptions,
  OrderEntry,
  PackageEntry,
  ProcurementRuntimeOptions,
  ProcurementServiceError,
  ProcurementServiceResult,
  ProjectStatusOptions,
  RecordDeliveryTransitionOptions,
  RequestQuotesOptions,
  RuntimeHealth,
  RuntimeSnapshot,
  SelectQuoteOptions,
  StreamReadOptions,
  SupplierPort,
} from './types';

/** Event payload data (the JSON value space the kernel payload accepts). */
type EventData = Record<string, string | number | boolean | null>;

/** Deterministic composite key: `<tenantId>#<localId>`. */
function tenantKey(tenantId: string, localId: string): string {
  return `${tenantId}#${localId}`;
}

/** The default commitment uncertainty state. */
function commitmentUncertainty(
  principalId: string,
  at: string,
): import('@epoch/procurement').UncertaintyState {
  return {
    schemaVersion: 1,
    provenance: { kind: 'reported', sourceRef: 'source:procurement-contract', actor: principalId },
    freshness: { state: 'fresh', assessedAt: at },
    confidence: { method: 'stated', value: 0.9, rationale: 'supplier contract statement' },
  };
}

/**
 * The reference procurement runtime host. Construct directly (the
 * in-memory SupplierPort reference adapter is the default). In-memory
 * only: no persistence, no network, no clocks.
 */
export class ProcurementRuntime {
  /** tenantId#packageId -> entry. Maps iterate in insertion order; every read path sorts. */
  private readonly packages = new Map<string, PackageEntry>();

  /** tenantId#quoteId -> latest revision. */
  private readonly quotes = new Map<string, SealedQuote>();

  private readonly selections = new Map<string, SealedQuoteSelection>();

  private readonly commitments = new Map<string, SealedDistinctionRecord>();

  /** tenantId#poId -> order entry (all versions + delivery log). */
  private readonly orders = new Map<string, OrderEntry>();

  private readonly substitutions = new Map<
    string,
    { request: SealedSubstitutionRequest; decision: SealedSubstitutionDecision | null }
  >();

  /** stream:procurement-<suffix> -> events (append-only). */
  private readonly streams = new Map<string, SealedProcurementEvent[]>();

  /** tenantId -> consumed intake keys (fast duplicate lookup). */
  private readonly processedKeys = new Map<string, Map<ProcurementIntakeKey, string>>();

  /** tenantId#transitionId -> the sealed transition (prior-record lookup for replays). */
  private readonly transitions = new Map<string, SealedSupplierDeliveryTransition>();

  /** The host-tracked W036 receipt observation records (sealed upstream). */
  private observations: readonly SealedDistinctionRecord[] = [];

  private readonly supplierPort: SupplierPort;

  private readonly expectedTenantId: string | undefined;

  constructor(options: ProcurementRuntimeOptions = {}) {
    this.expectedTenantId = options.expectedTenantId;
    this.supplierPort = options.supplierPort ?? new InMemorySupplierAdapter();
  }

  /** Register W036 receipt observation records (the delivery-receipt intake linkage). */
  registerObservationRecords(records: readonly SealedDistinctionRecord[]): void {
    this.observations = [...this.observations, ...records];
  }

  // --------------------------------------------------------------------------------
  // The authorization gate (W009 — the W022 pattern).
  // --------------------------------------------------------------------------------

  private authorizationGate(
    operation: string,
    tenantId: string,
    authorization: AuthorizationInput,
    resourceId: string,
    resourceType: string,
  ): ProcurementServiceResult<{ principalId: string }> {
    const context = parseAuthorizationContext(authorization.context);
    if (!context.ok) {
      return { ok: false, error: context.error };
    }
    const request = {
      schemaVersion: AUTHORIZATION_RECORD_VERSION,
      principalId: authorization.principalId,
      actionKind: `procurement.${operation}`,
      resource: { resourceType, resourceId, tenantId },
      ...(authorization.justification !== undefined
        ? { justification: authorization.justification }
        : {}),
    };
    const decision = evaluate(request, context.value);
    if (!decision.ok) {
      return { ok: false, error: decision.error };
    }
    const value: AuthorizationDecision = decision.value;
    if (value.outcome === 'deny') {
      return {
        ok: false,
        error: {
          code: 'authorization-rejected',
          message: `principal "${authorization.principalId}" is not authorized for procurement.${operation} (${value.denial.code}): ${value.denial.message}`,
          denialCode: value.denial.code,
          principalId: authorization.principalId,
          operation,
        },
      };
    }
    if (value.outcome === 'not-applicable') {
      return {
        ok: false,
        error: {
          code: 'authorization-rejected',
          message: `the authorization decision point is not applicable to this request (${value.reason}) — intake is tenant-scoped, so this is a fail-closed rejection`,
          denialCode: value.reason,
          principalId: authorization.principalId,
          operation,
        },
      };
    }
    return { ok: true, value: { principalId: authorization.principalId } };
  }

  private tenantGuard(tenantId: string): ProcurementServiceError | null {
    if (this.expectedTenantId !== undefined && tenantId !== this.expectedTenantId) {
      return {
        code: 'tenant-isolation-rejected',
        message: `this procurement-runtime host is scoped to tenant "${this.expectedTenantId}" — operations for tenant "${tenantId}" are rejected (R12 tenant isolation)`,
        expectedTenantId: this.expectedTenantId,
        encounteredTenantId: tenantId,
        subject: tenantId,
      };
    }
    return null;
  }

  // --------------------------------------------------------------------------------
  // Step 1: requirement intake (idempotent — replays return the prior record).
  // --------------------------------------------------------------------------------

  intakeRequirement(
    options: IntakeRequirementOptions,
  ): ProcurementServiceResult<IntakeOutcome<PackageEntry>> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) return { ok: false, error: guard };
    const gate = this.authorizationGate(
      'intake',
      options.tenantId,
      options.authorization,
      options.packageId,
      'procurement-package',
    );
    if (!gate.ok) return gate;
    if (options.request.tenantId !== options.tenantId) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `the acquisition request is scoped to tenant "${options.request.tenantId}" but the intake is for tenant "${options.tenantId}" (R12)`,
          expectedTenantId: options.tenantId,
          encounteredTenantId: options.request.tenantId,
          subject: options.request.acquisitionId,
        },
      };
    }
    const idempotencyKey = deriveProcurementIntakeKey({
      tenantId: options.tenantId,
      subject: `package-intake:${options.packageId}`,
      contentDigest: canonicalDigest(options.request as never),
    });
    const existing = this.packages.get(tenantKey(options.tenantId, options.packageId));
    if (existing !== undefined) {
      const priorKey = this.processedKeys.get(options.tenantId)?.get(idempotencyKey);
      if (priorKey !== undefined) {
        return {
          ok: true,
          value: { kind: 'duplicate-intake-returned', record: existing, idempotencyKey },
        };
      }
      return {
        ok: false,
        error: {
          code: 'version-conflict',
          message: `package "${options.packageId}" already exists for tenant "${options.tenantId}" — a package id grounds exactly one intake (create a new package id for a new acquisition attempt)`,
          subject: 'acquisition-package',
          subjectId: options.packageId,
        },
      };
    }
    const assembled = assembleRequirementPackage(options);
    if (!assembled.ok) {
      return { ok: false, error: assembled.error };
    }
    const entry: PackageEntry = {
      pkg: assembled.value.pkg,
      request: options.request,
      requirements: options.requirements,
    };
    this.packages.set(tenantKey(options.tenantId, options.packageId), entry);
    this.rememberKey(options.tenantId, idempotencyKey, options.packageId);
    const event = this.emitEvent(
      options.tenantId,
      options.packageId,
      gate.value.principalId,
      options.assembledAt,
      {
        discriminator: 'procurement:package-assembled',
        data: {
          packageId: options.packageId,
          acquisitionId: options.request.acquisitionId,
          variant: options.request.detail.variant,
          assembledAt: options.assembledAt,
        },
      },
    );
    if (!event.ok) return event;
    return { ok: true, value: { kind: 'admitted', record: entry } };
  }

  // --------------------------------------------------------------------------------
  // Step 2: quoting through the SupplierPort seam.
  // --------------------------------------------------------------------------------

  requestQuotes(
    options: RequestQuotesOptions,
  ): ProcurementServiceResult<readonly SealedQuote[]> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) return { ok: false, error: guard };
    const entry = this.packageEntry(options.tenantId, options.packageId);
    if (!entry.ok) return entry;
    const gate = this.authorizationGate(
      'quote',
      options.tenantId,
      options.authorization,
      options.packageId,
      'procurement-package',
    );
    if (!gate.ok) return gate;
    const submissions = this.supplierPort.requestQuotes({
      tenantId: options.tenantId,
      packageId: options.packageId,
      packageDigest: entry.value.pkg.contentDigest,
      lines: entry.value.pkg.lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        ...(line.solutionLineId !== undefined ? { solutionLineId: line.solutionLineId } : {}),
      })),
      requestedAt: options.requestedAt,
      requestedBy: gate.value.principalId,
    });
    if (!submissions.ok) {
      return { ok: false, error: submissions.error };
    }
    const admitted: SealedQuote[] = [];
    for (const submission of submissions.value) {
      const store = admitSupplierSubmission(
        submission,
        options.packageId,
        this.packageStoreOf(options.tenantId),
        this.quoteStoreOf(options.tenantId),
      );
      if (!store.ok) {
        return { ok: false, error: store.error };
      }
      const sealedQuote = store.value.quotes[store.value.quotes.length - 1]!;
      this.quotes.set(tenantKey(options.tenantId, sealedQuote.quoteId), sealedQuote);
      admitted.push(sealedQuote);
      const event = this.emitEvent(
        options.tenantId,
        options.packageId,
        gate.value.principalId,
        sealedQuote.submittedAt,
        {
          discriminator: 'procurement:quote-received',
          data: {
            packageId: options.packageId,
            quoteId: sealedQuote.quoteId,
            supplierId: sealedQuote.supplierId,
            revision: sealedQuote.revision,
            submittedAt: sealedQuote.submittedAt,
          },
        },
      );
      if (!event.ok) return event;
    }
    return { ok: true, value: admitted.sort((a, b) => (a.quoteId < b.quoteId ? -1 : 1)) };
  }

  // --------------------------------------------------------------------------------
  // Step 3: selection (idempotent).
  // --------------------------------------------------------------------------------

  selectQuote(
    options: SelectQuoteOptions,
  ): ProcurementServiceResult<IntakeOutcome<SealedQuoteSelection>> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) return { ok: false, error: guard };
    const entry = this.packageEntry(options.tenantId, options.packageId);
    if (!entry.ok) return entry;
    const gate = this.authorizationGate(
      'select',
      options.tenantId,
      options.authorization,
      options.packageId,
      'procurement-package',
    );
    if (!gate.ok) return gate;
    const idempotencyKey = deriveProcurementIntakeKey({
      tenantId: options.tenantId,
      subject: `selection:${options.selectionId}`,
      contentDigest: canonicalDigest({
        packageId: options.packageId,
        selectionId: options.selectionId,
        selectedQuoteId: options.selectedQuoteId,
        rationale: options.rationale,
        decidedAt: options.decidedAt,
      } as never),
    });
    const existing = this.selections.get(tenantKey(options.tenantId, options.selectionId));
    if (existing !== undefined) {
      const priorKey = this.processedKeys.get(options.tenantId)?.get(idempotencyKey);
      if (priorKey !== undefined) {
        return {
          ok: true,
          value: { kind: 'duplicate-intake-returned', record: existing, idempotencyKey },
        };
      }
      return {
        ok: false,
        error: {
          code: 'version-conflict',
          message: `selection "${options.selectionId}" already exists for tenant "${options.tenantId}" — a selection id grounds exactly one decision`,
          subject: 'quote-selection',
          subjectId: options.selectionId,
        },
      };
    }
    const recorded = recordQuoteSelection(
      options,
      this.packageStoreOf(options.tenantId),
      this.quoteStoreOf(options.tenantId),
      this.selectionStoreOf(options.tenantId),
    );
    if (!recorded.ok) {
      return { ok: false, error: recorded.error };
    }
    for (const selection of recorded.value.store.selections) {
      this.selections.set(tenantKey(options.tenantId, selection.selectionId), selection);
    }
    this.rememberKey(options.tenantId, idempotencyKey, options.selectionId);
    const event = this.emitEvent(
      options.tenantId,
      options.packageId,
      gate.value.principalId,
      options.decidedAt,
      {
        discriminator: 'procurement:quote-selected',
        data: {
          packageId: options.packageId,
          selectionId: options.selectionId,
          selectedQuoteId: options.selectedQuoteId,
          decidedAt: options.decidedAt,
        },
      },
    );
    if (!event.ok) return event;
    return { ok: true, value: { kind: 'admitted', record: recorded.value.selection } };
  }

  // --------------------------------------------------------------------------------
  // Step 4: commitment (W036 records, linked).
  // --------------------------------------------------------------------------------

  linkCommitment(
    options: LinkCommitmentOptions,
  ): ProcurementServiceResult<SealedDistinctionRecord> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) return { ok: false, error: guard };
    const entry = this.packageEntry(options.tenantId, options.packageId);
    if (!entry.ok) return entry;
    const gate = this.authorizationGate(
      'commit',
      options.tenantId,
      options.authorization,
      options.packageId,
      'procurement-package',
    );
    if (!gate.ok) return gate;
    const selections = [...this.selections.values()]
      .filter(
        (selection) =>
          selection.tenantId === options.tenantId && selection.packageId === options.packageId,
      )
      .sort((a, b) =>
        a.decidedAt === b.decidedAt
          ? a.selectionId < b.selectionId
            ? -1
            : 1
          : a.decidedAt < b.decidedAt
            ? -1
            : 1,
      );
    const head = selections[selections.length - 1];
    if (head === undefined) {
      return {
        ok: false,
        error: {
          code: 'dangling-reference-rejected',
          message: `no recorded selection of package "${options.packageId}" — a commitment grounds a selection`,
          referenceKind: 'selection',
          referenceId: options.packageId,
        },
      };
    }
    const quote = [...this.quotes.values()]
      .filter(
        (candidate) =>
          candidate.tenantId === options.tenantId && candidate.quoteId === head.selectedQuoteId,
      )
      .sort((a, b) => a.revision - b.revision)
      .pop();
    if (quote === undefined) {
      return {
        ok: false,
        error: {
          code: 'dangling-quote-rejected',
          message: `the selection's quote "${head.selectedQuoteId}" does not resolve`,
          selectionId: head.selectionId,
          quoteId: head.selectedQuoteId,
          reason: 'missing',
        },
      };
    }
    const commitment = sealCommitmentForSelection(
      options,
      entry.value.pkg,
      quote,
      commitmentUncertainty(gate.value.principalId, options.committedAt),
    );
    if (!commitment.ok) {
      return { ok: false, error: commitment.error };
    }
    this.commitments.set(tenantKey(options.tenantId, options.commitmentRecordId), commitment.value);
    const event = this.emitEvent(
      options.tenantId,
      options.packageId,
      gate.value.principalId,
      options.committedAt,
      {
        discriminator: 'procurement:commitment-linked',
        data: {
          packageId: options.packageId,
          commitmentRecordId: options.commitmentRecordId,
          committedAt: options.committedAt,
        },
      },
    );
    if (!event.ok) return event;
    return { ok: true, value: commitment.value };
  }

  // --------------------------------------------------------------------------------
  // Step 5: purchase-order issue / amendment.
  // --------------------------------------------------------------------------------

  issuePurchaseOrder(
    options: IssuePurchaseOrderOptions,
  ): ProcurementServiceResult<SealedPurchaseOrder> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) return { ok: false, error: guard };
    const entry = this.packageEntry(options.tenantId, options.packageId);
    if (!entry.ok) return entry;
    const gate = this.authorizationGate(
      'order',
      options.tenantId,
      options.authorization,
      options.packageId,
      'procurement-package',
    );
    if (!gate.ok) return gate;
    const issued = issueOrderVersion(
      options,
      this.packageStoreOf(options.tenantId),
      this.quoteStoreOf(options.tenantId),
      this.selectionStoreOf(options.tenantId),
      [...this.commitments.values()].filter((record) => record.tenantId === options.tenantId),
      this.orderStoreOf(options.tenantId),
    );
    if (!issued.ok) {
      return { ok: false, error: issued.error };
    }
    const key = tenantKey(options.tenantId, options.poId);
    const existing = this.orders.get(key);
    this.orders.set(key, {
      orders: issued.value.store.orders.filter((order) => order.tenantId === options.tenantId),
      log: existing === undefined ? [] : existing.log,
      packageId: options.packageId,
    });
    const event = this.emitEvent(
      options.tenantId,
      options.packageId,
      gate.value.principalId,
      options.issuedAt,
      {
        discriminator:
          issued.value.order.poVersion === 1 ? 'procurement:po-issued' : 'procurement:po-amended',
        data: {
          packageId: options.packageId,
          poId: options.poId,
          poVersion: issued.value.order.poVersion,
          issuedAt: options.issuedAt,
        },
      },
    );
    if (!event.ok) return event;
    return { ok: true, value: issued.value.order };
  }

  // --------------------------------------------------------------------------------
  // Step 6: supplier-delivery transitions (idempotent).
  // --------------------------------------------------------------------------------

  recordDeliveryTransition(
    options: RecordDeliveryTransitionOptions,
  ): ProcurementServiceResult<IntakeOutcome<SealedSupplierDeliveryTransition>> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) return { ok: false, error: guard };
    const gate = this.authorizationGate(
      'delivery',
      options.tenantId,
      options.authorization,
      options.poId,
      'procurement-po',
    );
    if (!gate.ok) return gate;
    const key = tenantKey(options.tenantId, options.poId);
    // Idempotency pre-check (BEFORE any kernel admission): the key is
    // derived from the operation's identity — the derived `from` state
    // of a replay differs, so the key must not depend on it.
    const idempotencyKey = deriveProcurementIntakeKey({
      tenantId: options.tenantId,
      subject: `transition:${options.transitionId}`,
      contentDigest: canonicalDigest({
        poId: options.poId,
        to: options.to,
        occurredAt: options.occurredAt,
        transitionId: options.transitionId,
        receipt: options.receipt ?? null,
      } as never),
    });
    if (this.processedKeys.get(options.tenantId)?.get(idempotencyKey) !== undefined) {
      const prior = this.transitions.get(tenantKey(options.tenantId, options.transitionId));
      if (prior !== undefined) {
        return {
          ok: true,
          value: { kind: 'duplicate-intake-returned', record: prior, idempotencyKey },
        };
      }
    }
    const orderEntry = this.orders.get(key);
    if (orderEntry === undefined) {
      return {
        ok: false,
        error: {
          code: 'unknown-purchase-order',
          message: `no purchase order "${options.poId}" hosted for tenant "${options.tenantId}"`,
          poId: options.poId,
        },
      };
    }
    const log: SupplierDeliveryLog = {
      poId: options.poId,
      tenantId: options.tenantId,
      transitions: orderEntry.log,
    };
    const recorded = recordDeliveryTransition(
      options,
      this.orderStoreOf(options.tenantId),
      this.observations,
      log,
    );
    if (!recorded.ok) {
      return { ok: false, error: recorded.error };
    }
    this.orders.set(key, { ...orderEntry, log: recorded.value.log.transitions });
    this.transitions.set(
      tenantKey(options.tenantId, options.transitionId),
      recorded.value.transition,
    );
    this.rememberKey(options.tenantId, idempotencyKey, options.transitionId);
    const event = this.emitEvent(
      options.tenantId,
      orderEntry.packageId,
      gate.value.principalId,
      options.occurredAt,
      {
        discriminator: 'procurement:delivery-transition-recorded',
        data: {
          poId: options.poId,
          from: recorded.value.transition.from,
          to: recorded.value.transition.to,
          occurredAt: options.occurredAt,
        },
      },
    );
    if (!event.ok) return event;
    if (options.receipt !== undefined) {
      const receiptEvent = this.emitEvent(
        options.tenantId,
        orderEntry.packageId,
        gate.value.principalId,
        options.occurredAt,
        {
          discriminator: 'procurement:receipt-recorded',
          data: {
            poId: options.poId,
            transitionId: options.transitionId,
            observationRecordId: options.receipt.observationRef.recordId,
            lineCount: options.receipt.lines.length,
            occurredAt: options.occurredAt,
          },
        },
      );
      if (!receiptEvent.ok) return receiptEvent;
    }
    return { ok: true, value: { kind: 'admitted', record: recorded.value.transition } };
  }

  // --------------------------------------------------------------------------------
  // Step 7: substitution decisions (the constraint-evaluation gate).
  // --------------------------------------------------------------------------------

  decideSubstitution(
    options: DecideSubstitutionOptions,
  ): ProcurementServiceResult<{
    request: SealedSubstitutionRequest;
    decision: SealedSubstitutionDecision;
  }> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) return { ok: false, error: guard };
    const gate = this.authorizationGate(
      'substitute',
      options.tenantId,
      options.authorization,
      options.poId,
      'procurement-po',
    );
    if (!gate.ok) return gate;
    const key = tenantKey(options.tenantId, options.poId);
    const orderEntry = this.orders.get(key);
    if (orderEntry === undefined) {
      return {
        ok: false,
        error: {
          code: 'unknown-purchase-order',
          message: `no purchase order "${options.poId}" hosted for tenant "${options.tenantId}"`,
          poId: options.poId,
        },
      };
    }
    const decided = requestAndDecideSubstitution(options, this.orderStoreOf(options.tenantId));
    if (!decided.ok) {
      return { ok: false, error: decided.error };
    }
    this.substitutions.set(tenantKey(options.tenantId, options.substitutionId), {
      request: decided.value.request,
      decision: decided.value.decision,
    });
    const requestedEvent = this.emitEvent(
      options.tenantId,
      orderEntry.packageId,
      gate.value.principalId,
      options.requestedAt,
      {
        discriminator: 'procurement:substitution-requested',
        data: {
          poId: options.poId,
          substitutionId: options.substitutionId,
          requestedAt: options.requestedAt,
        },
      },
    );
    if (!requestedEvent.ok) return requestedEvent;
    const decidedEvent = this.emitEvent(
      options.tenantId,
      orderEntry.packageId,
      gate.value.principalId,
      options.decidedAt,
      {
        discriminator: 'procurement:substitution-decided',
        data: {
          poId: options.poId,
          substitutionId: options.substitutionId,
          decision: options.decision,
          decidedAt: options.decidedAt,
        },
      },
    );
    if (!decidedEvent.ok) return decidedEvent;
    return { ok: true, value: decided.value };
  }

  // --------------------------------------------------------------------------------
  // Step 8: the derived-only status projection.
  // --------------------------------------------------------------------------------

  projectStatus(
    options: ProjectStatusOptions,
  ): ProcurementServiceResult<SealedAcquisitionStatus> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) return { ok: false, error: guard };
    const entry = this.packageEntry(options.tenantId, options.packageId);
    if (!entry.ok) return entry;
    const gate = this.authorizationGate(
      'status',
      options.tenantId,
      options.authorization,
      options.packageId,
      'procurement-package',
    );
    if (!gate.ok) return gate;
    const orderEntry = [...this.orders.values()].find(
      (candidate) => candidate.packageId === options.packageId && this.orderIsTenant(candidate, options.tenantId),
    );
    const log: SupplierDeliveryLog = {
      poId: orderEntry === undefined ? '' : orderEntry.orders[orderEntry.orders.length - 1]!.poId,
      tenantId: options.tenantId,
      transitions: orderEntry === undefined ? [] : orderEntry.log,
    };
    const projection = projectStatus(
      { tenantId: options.tenantId, packageId: options.packageId, asOf: options.asOf },
      this.packageStoreOf(options.tenantId),
      this.quoteStoreOf(options.tenantId),
      this.selectionStoreOf(options.tenantId),
      [...this.commitments.values()].filter((record) => record.tenantId === options.tenantId),
      this.orderStoreOf(options.tenantId),
      log,
    );
    if (!projection.ok) {
      return { ok: false, error: projection.error };
    }
    const event = this.emitEvent(
      options.tenantId,
      options.packageId,
      gate.value.principalId,
      options.asOf,
      {
        discriminator: 'procurement:status-projected',
        data: {
          packageId: options.packageId,
          state: projection.value.state,
          asOf: options.asOf,
        },
      },
    );
    if (!event.ok) return event;
    return { ok: true, value: projection.value };
  }

  // --------------------------------------------------------------------------------
  // Reads, streams, health, snapshot.
  // --------------------------------------------------------------------------------

  /** One package's full procurement event stream (tenant-scoped read). */
  eventStream(
    options: StreamReadOptions,
  ): ProcurementServiceResult<readonly SealedProcurementEvent[]> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) return { ok: false, error: guard };
    const entry = this.packageEntry(options.tenantId, options.packageId);
    if (!entry.ok) return entry;
    const streamId = procurementStreamIdOf(options.packageId);
    return { ok: true, value: this.streams.get(streamId) ?? [] };
  }

  /** The derived supplier-delivery projection of one purchase order. */
  deliveryProjection(options: {
    readonly tenantId: string;
    readonly poId: string;
  }): ProcurementServiceResult<SupplierDeliveryProjection> {
    const guard = this.tenantGuard(options.tenantId);
    if (guard !== null) return { ok: false, error: guard };
    const key = tenantKey(options.tenantId, options.poId);
    const orderEntry = this.orders.get(key);
    if (orderEntry === undefined) {
      return {
        ok: false,
        error: {
          code: 'unknown-purchase-order',
          message: `no purchase order "${options.poId}" hosted for tenant "${options.tenantId}"`,
          poId: options.poId,
        },
      };
    }
    return {
      ok: true,
      value: foldSupplierDelivery({
        poId: options.poId,
        tenantId: options.tenantId,
        transitions: orderEntry.log,
      }),
    };
  }

  /** Health/liveness as typed data (deterministic derivation, no clocks). */
  health(): RuntimeHealth {
    const events = [...this.streams.values()].reduce((sum, stream) => sum + stream.length, 0);
    return {
      schemaVersion: RUNTIME_RECORD_VERSION,
      status: 'healthy',
      packageCount: this.packages.size,
      quoteCount: this.quotes.size,
      selectionCount: this.selections.size,
      purchaseOrderCount: this.orders.size,
      deliveryLogCount: [...this.orders.values()].reduce((sum, entry) => sum + entry.log.length, 0),
      eventStreamCount: this.streams.size,
      eventCount: events,
    };
  }

  /** A deterministic whole-host snapshot (sorted; no insertion-order leaks). */
  snapshot(): RuntimeSnapshot {
    const sortedPackages = [...this.packages.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([, entry]) => entry);
    const quotes = [...this.quotes.values()].sort((a, b) =>
      a.quoteId === b.quoteId ? a.revision - b.revision : a.quoteId < b.quoteId ? -1 : 1,
    );
    const selections = [...this.selections.values()].sort((a, b) =>
      a.selectionId < b.selectionId ? -1 : 1,
    );
    const commitments = [...this.commitments.values()].sort((a, b) =>
      a.recordId < b.recordId ? -1 : 1,
    );
    const orders = [...this.orders.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([, entry]) => entry);
    const substitutions = [...this.substitutions.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([, entry]) => entry);
    const events = [...this.streams.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .flatMap(([, stream]) => stream);
    return {
      schemaVersion: RUNTIME_RECORD_VERSION,
      packages: sortedPackages,
      quotes,
      selections,
      commitments,
      orders,
      substitutions,
      events,
    };
  }

  // --------------------------------------------------------------------------------
  // Internals.
  // --------------------------------------------------------------------------------

  private orderIsTenant(entry: OrderEntry, tenantId: string): boolean {
    return entry.orders.length > 0 && entry.orders[0]!.tenantId === tenantId;
  }

  private packageEntry(tenantId: string, packageId: string): ProcurementServiceResult<PackageEntry> {
    const entry = this.packages.get(tenantKey(tenantId, packageId));
    if (entry !== undefined) {
      return { ok: true, value: entry };
    }
    const foreign = [...this.packages.values()].find(
      (candidate) => candidate.pkg.packageId === packageId,
    );
    if (foreign !== undefined) {
      return {
        ok: false,
        error: {
          code: 'tenant-isolation-rejected',
          message: `package "${packageId}" belongs to another tenant — tenant "${tenantId}" cannot access it (R12 tenant isolation)`,
          expectedTenantId: tenantId,
          encounteredTenantId: foreign.pkg.tenantId,
          subject: packageId,
        },
      };
    }
    return {
      ok: false,
      error: {
        code: 'unknown-package',
        message: `no package "${packageId}" hosted for tenant "${tenantId}"`,
        packageId,
      },
    };
  }

  private packageStoreOf(tenantId: string): AcquisitionPackageStore {
    return {
      packages: [...this.packages.values()]
        .filter((entry) => entry.pkg.tenantId === tenantId)
        .map((entry) => entry.pkg),
    };
  }

  private quoteStoreOf(tenantId: string): QuoteStore {
    return {
      quotes: [...this.quotes.values()].filter((quote) => quote.tenantId === tenantId),
    };
  }

  private selectionStoreOf(tenantId: string): SelectionStore {
    return {
      selections: [...this.selections.values()].filter(
        (selection) => selection.tenantId === tenantId,
      ),
    };
  }

  private orderStoreOf(tenantId: string): PurchaseOrderStore {
    return {
      orders: [...this.orders.values()]
        .filter((entry) => this.orderIsTenant(entry, tenantId))
        .flatMap((entry) => entry.orders),
    };
  }

  private rememberKey(tenantId: string, key: ProcurementIntakeKey, subject: string): void {
    const set = this.processedKeys.get(tenantId) ?? new Map<ProcurementIntakeKey, string>();
    set.set(key, subject);
    this.processedKeys.set(tenantId, set);
  }

  /** Emit one sealed event onto the package stream (sequence + causal link derived). */
  private emitEvent(
    tenantId: string,
    packageId: string,
    actor: string,
    occurredAt: string,
    payload: { readonly discriminator: string; readonly data: EventData },
  ): ProcurementServiceResult<SealedProcurementEvent> {
    const streamId = procurementStreamIdOf(packageId);
    const stream = this.streams.get(streamId) ?? [];
    const sequence = stream.length + 1;
    const causalParent =
      stream.length === 0 ? null : { streamId, sequence: stream[stream.length - 1]!.sequence };
    const sealed = sealProcurementEvent({
      schemaVersion: 1,
      streamId,
      sequence,
      tenantId,
      actor,
      causalParent,
      payload: { discriminator: payload.discriminator, data: payload.data },
      occurredAt,
    });
    if (!sealed.ok) {
      return { ok: false, error: sealed.error };
    }
    this.streams.set(streamId, [...stream, sealed.value]);
    return { ok: true, value: sealed.value };
  }
}

