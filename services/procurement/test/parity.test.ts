// EVENT PARITY with the REAL W010 machinery (devDependencies only — no
// runtime coupling; the W036/W022 pattern): every event the host emits
// is admitted by the REAL sealEvent and digests identically through
// the REAL computeEventDigest; the stream grammar is pattern-identical.
import { describe, expect, it } from 'vitest';
import { computeEventDigest, sealEvent, EVENT_STREAM_ID_PATTERN } from '@epoch/event-log';
import { ProcurementRuntime } from '../src/index';
import { procurementStreamIdOf } from '@epoch/procurement';
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

function fullFlow() {
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
    host.issuePurchaseOrder({ tenantId: TENANT, authorization: auth, packageId: PACKAGE_ID, poId: 'po:earthworks-001', issuedAt: T5 }),
  );
  unwrap(
    host.projectStatus({ tenantId: TENANT, authorization: auth, packageId: PACKAGE_ID, asOf: T5 }),
  );
  return host;
}

describe('W010 event parity (runtime)', () => {
  it('the derived package stream satisfies the W010 stream grammar (one package = one stream)', () => {
    const streamId = procurementStreamIdOf(PACKAGE_ID);
    expect(streamId).toBe('stream:procurement-earthworks-steel-a');
    expect(new RegExp(EVENT_STREAM_ID_PATTERN).test(streamId)).toBe(true);
  });

  it('every host event is admitted by the REAL W010 sealEvent and digests identically', () => {
    const host = fullFlow();
    const stream = unwrap(host.eventStream({ tenantId: TENANT, packageId: PACKAGE_ID }));
    expect(stream.length).toBeGreaterThanOrEqual(7);
    for (const event of stream) {
      const { contentDigest, ...content } = event;
      // The REAL W010 digest of the same content agrees with the sealed digest.
      expect(computeEventDigest(content as never)).toBe(contentDigest);
      // The REAL W010 seal path admits the same content with the same digest.
      const sealed = sealEvent(content);
      expect(sealed.ok, JSON.stringify(sealed)).toBe(true);
      if (!sealed.ok) continue;
      expect(sealed.value.digest).toBe(contentDigest);
    }
  });
});
