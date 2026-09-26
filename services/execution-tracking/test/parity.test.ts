// EVENT PARITY with the REAL W010 machinery (devDependencies only — no
// runtime coupling; the W036/W037 pattern): every event the host emits
// is admitted by the REAL sealEvent and digests identically through the
// REAL computeEventDigest; the stream grammar is pattern-identical; one
// stream per work package.
import { describe, expect, it } from 'vitest';
import { computeEventDigest, sealEvent, EVENT_STREAM_ID_PATTERN } from '@epoch/event-log';
import { executionStreamIdOf } from '@epoch/execution-tracking';
import { ExecutionTrackingRuntime } from '../src/index';
import {
  PRINCIPAL,
  T3,
  T4,
  T5,
  T6,
  TENANT,
  WORK_PACKAGE_ID,
  allowContext,
  captureSeed,
  openedDelivery,
  reconciliationProposal,
  sealedProgram,
  seededAdapter,
  unwrap,
} from './helpers';

function fullFlow(): ExecutionTrackingRuntime {
  const host = new ExecutionTrackingRuntime({ fieldCapturePort: seededAdapter() });
  const auth = { principalId: PRINCIPAL, context: allowContext() };
  unwrap(host.registerProgram({ tenantId: TENANT, authorization: auth, program: sealedProgram() }));
  unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: auth, delivery: openedDelivery() }));
  unwrap(host.pollFieldCaptures({ tenantId: TENANT, authorization: auth, requestedAt: T3 }));
  unwrap(
    host.intakeFieldCapture({
      tenantId: TENANT,
      authorization: auth,
      capture: captureSeed({
        captureKey: 'pit-progress-tuesday',
        measure: { kind: 'progress', fraction: 0.35 },
      }),
    }),
  );
  const proposal = reconciliationProposal([
    'observation:field-pit-progress-monday',
    'observation:field-pit-progress-tuesday',
  ]);
  unwrap(host.proposeReconciliation({ tenantId: TENANT, authorization: auth, proposal }));
  unwrap(
    host.applyReconciliation({
      tenantId: TENANT,
      authorization: auth,
      proposalId: proposal.recordId,
      application: { acceptedBy: PRINCIPAL, acceptedAt: T5, actualizedBy: PRINCIPAL, actualizedAt: T6 },
    }),
  );
  unwrap(
    host.projectState({ tenantId: TENANT, authorization: auth, solutionId: 'solution:tower-retrofit', asOf: T4 }),
  );
  return host;
}

describe('W010 event parity (runtime)', () => {
  it('the derived work-package stream satisfies the W010 stream grammar (one stream per work package)', () => {
    const streamId = executionStreamIdOf(WORK_PACKAGE_ID);
    expect(streamId).toBe('stream:execution-earthworks');
    expect(new RegExp(EVENT_STREAM_ID_PATTERN).test(streamId)).toBe(true);
  });

  it('every host event is admitted by the REAL W010 sealEvent and digests identically', () => {
    const host = fullFlow();
    const stream = unwrap(
      host.eventStream({ tenantId: TENANT, authorization: { principalId: PRINCIPAL, context: allowContext() }, workPackageId: WORK_PACKAGE_ID }),
    );
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

  it('the events cover the whole execution vocabulary over the flow', () => {
    const host = fullFlow();
    const stream = unwrap(
      host.eventStream({ tenantId: TENANT, authorization: { principalId: PRINCIPAL, context: allowContext() }, workPackageId: WORK_PACKAGE_ID }),
    );
    const discriminators = new Set(stream.map((event) => event.payload.discriminator));
    for (const expected of [
      'execution:observation-recorded',
      'execution:resource-observation-recorded',
      'execution:evidence-linked',
      'execution:reconciliation-proposed',
      'execution:reconciliation-applied',
      'execution:state-projected',
    ]) {
      expect(discriminators.has(expected), expected).toBe(true);
    }
  });

  it('each work package owns exactly one stream', () => {
    const host = fullFlow();
    const snapshot = host.snapshot();
    const streamIds = new Set(snapshot.events.map((event) => event.streamId));
    expect(streamIds.has('stream:execution-earthworks')).toBe(true);
    expect(streamIds.has('stream:execution-structure')).toBe(true);
    // Every event of one stream shares that stream's id and sequences are contiguous.
    for (const streamId of streamIds) {
      const events = snapshot.events.filter((event) => event.streamId === streamId);
      expect(events.map((event) => event.sequence)).toEqual(events.map((_, index) => index + 1));
    }
  });
});
