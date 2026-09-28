// W034 — the COUNTING harness driver: a ScenarioDriver over a synthetic
// hash-chained in-memory ledger (the W032 fixture-driver pattern,
// test-harness's own self-test driver) instrumented at the driver seam.
// Every `begin` / `runStep` / `stateDigest` invocation tallies ONE
// `harness-scenario` operation into the SHARED counter hub — the
// measured work the W032 runner does at the ONLY seam it exposes. The
// runner's built-in double-run replay therefore doubles the measured
// count BY DESIGN (documented in docs/performance/counter-methodology.md).
//
// The ledger state digest is O(1) per call (hash-chained head), so the
// driver itself contributes no hidden super-linear work: measured
// harness-scenario counts are a pure function of the step count.
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import { type CounterHub } from '@epoch/performance';
import type { CallStep, ScenarioDefinition, ScenarioDriver, StepResult } from '@epoch/test-harness';

/** The counting driver's ops (the workload grammar's step vocabulary). */
export const COUNTING_DRIVER_OPS = ['ledger.append', 'ledger.head'] as const;

/** One record of the synthetic hash-chained ledger. */
interface LedgerRecord {
  readonly recordId: string;
  readonly value: number;
  readonly contentDigest: string;
  readonly parentDigest: string | null;
}

/** The counting driver's world: the synthetic ledger (the hub is shared, per flow). */
export interface CountingLedgerWorld {
  readonly scenario: ScenarioDefinition;
  records: LedgerRecord[];
}

/**
 * Create the counting harness driver over one shared counter hub: every
 * driver-seam invocation (begin / runStep / stateDigest) tallies ONE
 * `harness-scenario` operation, so measured counts land in the SAME
 * measured-counts record as the kernel-class tallies of the flow.
 */
export function createCountingDriver(hub: CounterHub): ScenarioDriver<CountingLedgerWorld> {
  return {
    name: 'perf-counting-ledger',
    driverOps: COUNTING_DRIVER_OPS,
    begin(scenario: ScenarioDefinition): CountingLedgerWorld {
      hub.tally('harness-scenario'); // begin is a driver-seam invocation
      return { scenario, records: [] };
    },
    stateDigest(world: CountingLedgerWorld): string {
      hub.tally('harness-scenario'); // stateDigest is a driver-seam invocation
      const head = world.records[world.records.length - 1];
      return canonicalDigest({
        tenantId: world.scenario.tenantId,
        recordCount: world.records.length,
        headDigest: head?.contentDigest ?? null,
      } as unknown as JsonValue);
    },
    runStep(world: CountingLedgerWorld, step: CallStep): StepResult<CountingLedgerWorld> {
      hub.tally('harness-scenario'); // runStep is a driver-seam invocation
      const input = (step.input ?? {}) as { recordIndex?: number; value?: number };
      switch (step.driverOp) {
        case 'ledger.append': {
          const parent = world.records[world.records.length - 1] ?? null;
          const content = { recordIndex: input.recordIndex ?? world.records.length, value: input.value ?? 0 };
          const record: LedgerRecord = {
            recordId: `ledger-record:${String(world.records.length).padStart(6, '0')}`,
            value: content.value,
            contentDigest: canonicalDigest(content as unknown as JsonValue),
            parentDigest: parent?.contentDigest ?? null,
          };
          world.records.push(record);
          return {
            world,
            report: {
              stepId: step.stepId,
              ok: true,
              valueDigest: record.contentDigest,
              errorCode: null,
              errorMessage: null,
              denial: null,
              authorityRejection: null,
              events: [],
              provenance: [
                { content: content as unknown as JsonValue, claimedDigest: record.contentDigest, parentDigest: record.parentDigest },
              ],
              identities: [],
            },
          };
        }
        case 'ledger.head': {
          const head = world.records[world.records.length - 1];
          return {
            world,
            report: {
              stepId: step.stepId,
              ok: true,
              valueDigest: head?.contentDigest ?? canonicalDigest(null),
              errorCode: null,
              errorMessage: null,
              denial: null,
              authorityRejection: null,
              events: [],
              provenance: [],
              identities: [],
            },
          };
        }
        default:
          throw new Error(`counting driver: unknown driverOp "${step.driverOp}"`);
      }
    },
  };
}
