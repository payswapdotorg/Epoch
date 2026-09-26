// Determinism over the runner host: identical submissions and histories
// produce identical identities, digests, and snapshots — regardless of
// arrival order (the W020 pin: two runtimes fed the same history hold
// byte-identical state).
import { describe, expect, it } from 'vitest';
import { ReferenceSimulationExecutionPort } from '@epoch/simulation-fabric';
import { SimulationRunner } from '../src/index';
import {
  ACTOR,
  TENANT,
  T2,
  T3,
  fixtureRegistry,
  referenceRequestFixture,
  referenceSubmission,
  unwrap,
} from './helpers';

describe('SimulationRunner determinism', () => {
  it('two runners fed the same submission + execution history hold identical snapshots', () => {
    const drive = (): SimulationRunner => {
      const runner = new SimulationRunner({ registry: fixtureRegistry() });
      const run = unwrap(runner.submitJob(referenceSubmission() as never));
      unwrap(runner.planRun({ tenantId: TENANT, runId: run.runId, actor: ACTOR, at: T2 }));
      unwrap(
        runner.executeRun({
          tenantId: TENANT,
          runId: run.runId,
          port: new ReferenceSimulationExecutionPort(),
          actor: ACTOR,
          at: T3,
        }),
      );
      return runner;
    };
    const first = drive();
    const second = drive();
    expect(JSON.stringify(first.snapshot())).toBe(JSON.stringify(second.snapshot()));
    expect(first.health()).toEqual(second.health());
  });

  it('arrival order never leaks into snapshots or listings', () => {
    const submissionA = referenceSubmission();
    const submissionB = referenceSubmission({
      request: referenceRequestFixture({ requestId: 'simreq-reference-0002' }),
    });
    const one = new SimulationRunner({ registry: fixtureRegistry() });
    unwrap(one.submitJob(submissionA as never));
    unwrap(one.submitJob(submissionB as never));
    const two = new SimulationRunner({ registry: fixtureRegistry() });
    unwrap(two.submitJob(submissionB as never));
    unwrap(two.submitJob(submissionA as never));
    expect(JSON.stringify(one.snapshot())).toBe(JSON.stringify(two.snapshot()));
    const listedOne = unwrap(one.listRuns({ tenantId: TENANT })).map((r) => r.runId);
    const listedTwo = unwrap(two.listRuns({ tenantId: TENANT })).map((r) => r.runId);
    expect(listedOne).toEqual(listedTwo);
    expect(listedOne).toEqual([...listedOne].sort());
  });

  it('the run identity is independent of the hosting runner', () => {
    const one = new SimulationRunner({ registry: fixtureRegistry() });
    const two = new SimulationRunner();
    const runA = unwrap(one.submitJob(referenceSubmission() as never));
    const runB = unwrap(two.submitJob(referenceSubmission() as never));
    expect(runA.runId).toBe(runB.runId);
    expect(runA.runDigest).toBe(runB.runDigest);
  });

  it('health counting is order-independent', () => {
    const build = (order: 'a-first' | 'b-first'): SimulationRunner => {
      const runner = new SimulationRunner({ registry: fixtureRegistry() });
      const a = referenceSubmission();
      const b = referenceSubmission({
        request: referenceRequestFixture({ requestId: 'simreq-b' }),
      });
      const sequence = order === 'a-first' ? [a, b] : [b, a];
      for (const submission of sequence) {
        unwrap(runner.submitJob(submission as never));
      }
      return runner;
    };
    expect(build('a-first').health()).toEqual(build('b-first').health());
  });
});
