// FAILURE COVERAGE: the kernel's typed rejections surfaced through the
// host — dangling quotes, illegal delivery transitions, unevaluated
// substitutions, unknown packages/POs.
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

function setup() {
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
  return { host, auth };
}

describe('failure coverage (typed kernel rejections surfaced)', () => {
  it('an unknown package is unknown-package', () => {
    const { host, auth } = setup();
    const result = host.requestQuotes({
      tenantId: TENANT,
      authorization: auth,
      packageId: 'package:does-not-exist',
      requestedAt: T3,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unknown-package');
  });

  it('a selection of a missing quote is dangling-quote-rejected', () => {
    const { host, auth } = setup();
    const result = host.selectQuote({
      tenantId: TENANT,
      authorization: auth,
      packageId: PACKAGE_ID,
      selectionId: 'selection:bad-quote',
      selectedQuoteId: 'quote:not-admitted',
      rationale: 'Nope.',
      decidedAt: T4,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('dangling-quote-rejected');
  });

  it('an illegal delivery transition is lifecycle-conflict', () => {
    const { host, auth } = setup();
    const result = host.recordDeliveryTransition({
      tenantId: TENANT,
      authorization: auth,
      poId: PO_ID,
      to: 'accepted',
      occurredAt: T6,
      transitionId: 'po-transition:illegal',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('lifecycle-conflict');
  });

  it('a receipt-bearing transition with a drifted observation digest is rejected', () => {
    const { host, auth } = setup();
    unwrap(
      host.recordDeliveryTransition({
        tenantId: TENANT,
        authorization: auth,
        poId: PO_ID,
        to: 'confirmed',
        occurredAt: T6,
        transitionId: 'po-transition:setup-confirm',
      }),
    );
    unwrap(
      host.recordDeliveryTransition({
        tenantId: TENANT,
        authorization: auth,
        poId: PO_ID,
        to: 'shipped',
        occurredAt: T6,
        transitionId: 'po-transition:setup-ship',
      }),
    );
    const result = host.recordDeliveryTransition({
      tenantId: TENANT,
      authorization: auth,
      poId: PO_ID,
      to: 'partial',
      occurredAt: T6,
      transitionId: 'po-transition:drifted',
      receipt: {
        observationRef: { recordId: OBSERVATION_ID, contentDigest: '0'.repeat(64) },
        lines: [{ description: 'Anchor bolts M24', quantity: '40', unit: 'piece' }],
        receivedAt: T6,
        receivedBy: 'principal:site-buyer',
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('dangling-reference-rejected');
  });

  it('a substitution decision WITHOUT the constraint evaluation is unevaluated-substitution-rejected', () => {
    const { host, auth } = setup();
    host.registerObservationRecords([receiptObservation(OBSERVATION_ID, '40')]);
    const result = host.decideSubstitution({
      tenantId: TENANT,
      authorization: auth,
      poId: PO_ID,
      substitutionId: 'substitution:anchor-bolts',
      originalLines: [{ description: 'Anchor bolts M24', quantity: '80', unit: 'piece' }],
      substituteLines: [{ description: 'Anchor bolts M27', quantity: '80', unit: 'piece' }],
      requestedAt: T6,
      decision: 'accepted',
      decidedAt: T6,
      // NO constraintEvaluation — the gate must fire.
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unevaluated-substitution-rejected');
  });

  it('a substitution decision WITH the evaluation seals the decision record', () => {
    const { host, auth } = setup();
    const result = host.decideSubstitution({
      tenantId: TENANT,
      authorization: auth,
      poId: PO_ID,
      substitutionId: 'substitution:anchor-bolts',
      originalLines: [{ description: 'Anchor bolts M24', quantity: '80', unit: 'piece' }],
      substituteLines: [{ description: 'Anchor bolts M27', quantity: '80', unit: 'piece' }],
      requestedAt: T6,
      decision: 'accepted',
      decidedAt: T6,
      constraintEvaluation: { evaluationDigest: 'c'.repeat(64), policyShapeRef: 'policy:material-spec' },
    });
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.value.decision.decision).toBe('accepted');
    expect(result.value.decision.constraintEvaluation.evaluationDigest).toBe('c'.repeat(64));
  });

  it('an unknown purchase order is unknown-purchase-order', () => {
    const { host, auth } = setup();
    const result = host.recordDeliveryTransition({
      tenantId: TENANT,
      authorization: auth,
      poId: 'po:does-not-exist',
      to: 'confirmed',
      occurredAt: T6,
      transitionId: 'po-transition:missing-po',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unknown-purchase-order');
  });

  it('a status projection of an unknown package is unknown-package', () => {
    const { host, auth } = setup();
    const result = host.projectStatus({
      tenantId: TENANT,
      authorization: auth,
      packageId: 'package:does-not-exist',
      asOf: T6,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unknown-package');
  });
});
