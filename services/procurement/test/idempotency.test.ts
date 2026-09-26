// REPLAY / IDEMPOTENCY coverage: replayed intake (same
// content-addressed idempotency key) returns the SEALED PRIOR RECORD
// (the typed `duplicate-intake-returned` admission); the state is
// unchanged; a different record under the same id is version-conflict.
import { describe, expect, it } from 'vitest';
import { ProcurementRuntime } from '../src/index';
import {
  OBSERVATION_ID,
  PACKAGE_ID,
  PO_ID,
  PRINCIPAL,
  QUOTE_ID,
  SELECTION_ID,
  TENANT,
  T2,
  T3,
  T4,
  T5,
  T6,
  WORK_PACKAGE_ID,
  acquisitionRequest,
  allowContext,
  receiptObservation,
  seededAdapter,
  unwrap,
} from './helpers';

describe('replay / idempotency', () => {
  it('a replayed requirement intake returns the sealed prior package (duplicate-intake-returned)', () => {
    const host = new ProcurementRuntime({ supplierPort: seededAdapter() });
    const auth = { principalId: PRINCIPAL, context: allowContext() };
    const options = {
      tenantId: TENANT,
      authorization: auth,
      request: acquisitionRequest(),
      packageId: PACKAGE_ID,
      requirements: [WORK_PACKAGE_ID],
      requirementRef: { kind: 'work-package' as const, id: WORK_PACKAGE_ID },
      assembledAt: T2,
      lineageId: 'lineage:earthworks-steel-a',
    };
    const first = unwrap(host.intakeRequirement(options));
    expect(first.kind).toBe('admitted');
    const replay = unwrap(host.intakeRequirement(options));
    expect(replay.kind).toBe('duplicate-intake-returned');
    if (replay.kind === 'duplicate-intake-returned') {
      // The SEALED PRIOR RECORD is returned — byte-identical content.
      expect(replay.record.pkg.contentDigest).toBe(first.record.pkg.contentDigest);
      expect(replay.idempotencyKey).toHaveLength(64);
    }
    // State unchanged: one package, one event stream, one event.
    expect(host.health().packageCount).toBe(1);
    const stream = unwrap(host.eventStream({ tenantId: TENANT, packageId: PACKAGE_ID }));
    expect(stream).toHaveLength(1);
  });

  it('a replayed selection returns the sealed prior selection', () => {
    const host = new ProcurementRuntime({ supplierPort: seededAdapter() });
    const auth = { principalId: PRINCIPAL, context: allowContext() };
    unwrap(
      host.intakeRequirement({
        tenantId: TENANT,
        authorization: auth,
        request: acquisitionRequest(),
        packageId: PACKAGE_ID,
        requirements: [WORK_PACKAGE_ID],
        requirementRef: { kind: 'work-package', id: WORK_PACKAGE_ID },
        assembledAt: T2,
        lineageId: 'lineage:earthworks-steel-a',
      }),
    );
    unwrap(host.requestQuotes({ tenantId: TENANT, authorization: auth, packageId: PACKAGE_ID, requestedAt: T3 }));
    const options = {
      tenantId: TENANT,
      authorization: auth,
      packageId: PACKAGE_ID,
      selectionId: SELECTION_ID,
      selectedQuoteId: QUOTE_ID,
      rationale: 'Single round.',
      decidedAt: T4,
    };
    const first = unwrap(host.selectQuote(options));
    expect(first.kind).toBe('admitted');
    const replay = unwrap(host.selectQuote(options));
    expect(replay.kind).toBe('duplicate-intake-returned');
    if (replay.kind === 'duplicate-intake-returned') {
      expect(replay.record.contentDigest).toBe(first.record.contentDigest);
    }
  });

  it('a replayed delivery transition returns the sealed prior transition', () => {
    const host = new ProcurementRuntime({ supplierPort: seededAdapter() });
    const auth = { principalId: PRINCIPAL, context: allowContext() };
    unwrap(
      host.intakeRequirement({
        tenantId: TENANT,
        authorization: auth,
        request: acquisitionRequest(),
        packageId: PACKAGE_ID,
        requirements: [WORK_PACKAGE_ID],
        requirementRef: { kind: 'work-package', id: WORK_PACKAGE_ID },
        assembledAt: T2,
        lineageId: 'lineage:earthworks-steel-a',
      }),
    );
    unwrap(host.requestQuotes({ tenantId: TENANT, authorization: auth, packageId: PACKAGE_ID, requestedAt: T3 }));
    unwrap(
      host.selectQuote({
        tenantId: TENANT,
        authorization: auth,
        packageId: PACKAGE_ID,
        selectionId: SELECTION_ID,
        selectedQuoteId: QUOTE_ID,
        rationale: 'Single round.',
        decidedAt: T4,
      }),
    );
    unwrap(
      host.linkCommitment({
        tenantId: TENANT,
        authorization: auth,
        packageId: PACKAGE_ID,
        commitmentRecordId: 'commitment:earthworks-order-1',
        committedAt: T4,
      }),
    );
    unwrap(
      host.issuePurchaseOrder({ tenantId: TENANT, authorization: auth, packageId: PACKAGE_ID, poId: PO_ID, issuedAt: T5 }),
    );
    host.registerObservationRecords([receiptObservation(OBSERVATION_ID, '40')]);
    const options = {
      tenantId: TENANT,
      authorization: auth,
      poId: PO_ID,
      to: 'confirmed' as const,
      occurredAt: T6,
      transitionId: 'po-transition:confirm-1',
    };
    const first = unwrap(host.recordDeliveryTransition(options));
    expect(first.kind).toBe('admitted');
    const replay = unwrap(host.recordDeliveryTransition(options));
    expect(replay.kind).toBe('duplicate-intake-returned');
    if (replay.kind === 'duplicate-intake-returned') {
      expect(replay.record.contentDigest).toBe(first.record.contentDigest);
    }
    // State unchanged: one transition in the log, two events (transition only).
    const projection = unwrap(host.deliveryProjection({ tenantId: TENANT, poId: PO_ID }));
    expect(projection.transitionCount).toBe(1);
  });

  it('a DIFFERENT record under the same package id is version-conflict (never a rewrite)', () => {
    const host = new ProcurementRuntime({ supplierPort: seededAdapter() });
    const auth = { principalId: PRINCIPAL, context: allowContext() };
    unwrap(
      host.intakeRequirement({
        tenantId: TENANT,
        authorization: auth,
        request: acquisitionRequest(),
        packageId: PACKAGE_ID,
        requirements: [WORK_PACKAGE_ID],
        requirementRef: { kind: 'work-package', id: WORK_PACKAGE_ID },
        assembledAt: T2,
        lineageId: 'lineage:earthworks-steel-a',
      }),
    );
    // Same package id, DIFFERENT request content -> different key, conflict.
    const conflicting = host.intakeRequirement({
      tenantId: TENANT,
      authorization: auth,
      request: acquisitionRequest({ neededBy: T6 }),
      packageId: PACKAGE_ID,
      requirements: [WORK_PACKAGE_ID],
      requirementRef: { kind: 'work-package', id: WORK_PACKAGE_ID },
      assembledAt: T2,
      lineageId: 'lineage:earthworks-steel-a',
    });
    expect(conflicting.ok).toBe(false);
    if (conflicting.ok) return;
    expect(conflicting.error.code).toBe('version-conflict');
    void T5;
  });
});
