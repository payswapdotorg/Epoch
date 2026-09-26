// DETERMINISM: two runtimes fed the same operations hold byte-identical
// snapshots; the snapshot sorts (no insertion-order leaks); the
// FieldCapturePort reference adapter replays deterministically.
import { describe, expect, it } from 'vitest';
import { ExecutionTrackingRuntime, InMemoryFieldCaptureAdapter } from '../src/index';
import {
  PRINCIPAL,
  SOLUTION_ID,
  T3,
  T4,
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

function operate(host: ExecutionTrackingRuntime): void {
  const auth = { principalId: PRINCIPAL, context: allowContext() };
  unwrap(host.registerProgram({ tenantId: TENANT, authorization: auth, program: sealedProgram() }));
  unwrap(host.registerDeliveryRecord({ tenantId: TENANT, authorization: auth, delivery: openedDelivery() }));
  unwrap(host.pollFieldCaptures({ tenantId: TENANT, authorization: auth, requestedAt: T3 }));
  unwrap(
    host.intakeFieldCapture({
      tenantId: TENANT,
      authorization: auth,
      capture: captureSeed({ captureKey: 'pit-progress-tuesday', measure: { kind: 'progress', fraction: 0.35 } }),
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
      application: { acceptedBy: PRINCIPAL, acceptedAt: T4, actualizedBy: PRINCIPAL, actualizedAt: T4 },
    }),
  );
  unwrap(host.projectState({ tenantId: TENANT, authorization: auth, solutionId: SOLUTION_ID, asOf: T4 }));
}

describe('determinism (same operations -> identical state)', () => {
  it('two runtimes fed the same operations hold byte-identical snapshots', () => {
    const hostA = new ExecutionTrackingRuntime({ fieldCapturePort: seededAdapter() });
    const hostB = new ExecutionTrackingRuntime({ fieldCapturePort: seededAdapter() });
    operate(hostA);
    operate(hostB);
    expect(JSON.stringify(hostB.snapshot())).toBe(JSON.stringify(hostA.snapshot()));
    expect(hostB.health()).toEqual(hostA.health());
  });

  it('the same runtime returns the same stream on repeated reads', () => {
    const host = new ExecutionTrackingRuntime({ fieldCapturePort: seededAdapter() });
    operate(host);
    const auth = { principalId: PRINCIPAL, context: allowContext() };
    const first = unwrap(host.eventStream({ tenantId: TENANT, authorization: auth, workPackageId: WORK_PACKAGE_ID }));
    const second = unwrap(host.eventStream({ tenantId: TENANT, authorization: auth, workPackageId: WORK_PACKAGE_ID }));
    expect(second).toEqual(first);
  });

  it('the reference capture adapter replays deterministically (sorted by captureKey)', () => {
    const seeds = [
      captureSeed({ captureKey: 'zzz-capture' }),
      captureSeed({ captureKey: 'aaa-capture' }),
    ];
    const adapter = new InMemoryFieldCaptureAdapter(seeds);
    const first = unwrap(
      adapter.pollCaptures({ tenantId: TENANT, solutionId: SOLUTION_ID, requestedAt: T3, requestedBy: PRINCIPAL }),
    );
    const second = unwrap(
      adapter.pollCaptures({ tenantId: TENANT, solutionId: SOLUTION_ID, requestedAt: T4, requestedBy: PRINCIPAL }),
    );
    expect(second).toEqual(first);
    expect(first.map((submission) => submission.captureKey)).toEqual(['aaa-capture', 'zzz-capture']);
  });
});
