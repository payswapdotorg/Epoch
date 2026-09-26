// DETERMINISM: two runtimes fed the same operations hold byte-identical
// state (snapshot equality + event stream digests).
import { describe, expect, it } from 'vitest';
import { ProcurementRuntime } from '../src/index';
import {
  PACKAGE_ID,
  PRINCIPAL,
  QUOTE_ID,
  SELECTION_ID,
  TENANT,
  T2,
  T3,
  T4,
  T5,
  WORK_PACKAGE_ID,
  acquisitionRequest,
  allowContext,
  seededAdapter,
  unwrap,
} from './helpers';

function runFlow(host: ProcurementRuntime) {
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
    host.issuePurchaseOrder({ tenantId: TENANT, authorization: auth, packageId: PACKAGE_ID, poId: 'po:earthworks-001', issuedAt: T5 }),
  );
  unwrap(
    host.projectStatus({ tenantId: TENANT, authorization: auth, packageId: PACKAGE_ID, asOf: T5 }),
  );
  return host;
}

describe('determinism', () => {
  it('two runtimes fed the same operations hold byte-identical snapshots', () => {
    const a = runFlow(new ProcurementRuntime({ supplierPort: seededAdapter() }));
    const b = runFlow(new ProcurementRuntime({ supplierPort: seededAdapter() }));
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.health()).toEqual(b.health());
    const streamA = unwrap(a.eventStream({ tenantId: TENANT, packageId: PACKAGE_ID }));
    const streamB = unwrap(b.eventStream({ tenantId: TENANT, packageId: PACKAGE_ID }));
    expect(streamA.map((event) => event.contentDigest)).toEqual(
      streamB.map((event) => event.contentDigest),
    );
  });
});
