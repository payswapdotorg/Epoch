/**
 * The runner: executes a scenario against a driver, recording the typed
 * execution trace and evaluating the invariant library.
 *
 * One `runScenario` call:
 *   1. parses + validates the scenario (typed failure on malformed input);
 *   2. `driver.begin` — a fresh composed world of REAL kernels;
 *   3. executes the step sequence: call steps dispatch through the driver
 *      (never through kernel internals); assert steps evaluate the
 *      invariant library over the accumulated prefix;
 *   4. seals the trace (content-addressed);
 *   5. evaluates every scenario-declared invariant + the built-in
 *      expectation-conformance and trace-integrity over the full run;
 *   6. when `replayCheck` (default), re-runs the whole scenario through a
 *      SECOND fresh world and compares trace digests (replay determinism);
 *   7. emits the typed, content-addressed RESULT record.
 *
 * The runner is deterministic: no clock, no randomness, no network. The
 * only exceptions that escape are DriverContractError (a driver/contract
 * violation) — kernel outcomes always travel as typed report data.
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import {
  DriverContractError,
  type ScenarioDriver,
  type StepContext,
  type StepReport,
} from './driver';
import {
  checkReplayDeterminism,
  checkScenarioRoundTrip,
  evaluateInvariant,
  INVARIANT_CHECKS,
  isRunLevelInvariant,
  type InvariantFinding,
} from './invariants';
import { parseScenario, scenarioDigest, type ScenarioDefinition } from './scenario';
import {
  outcomeOf,
  sealTrace,
  stepDigest,
  type AssertFinding,
  type ExecutionTrace,
  type TraceStepEntry,
} from './trace';

/** Options for one scenario run. */
export interface RunScenarioOptions {
  /**
   * Double-run the scenario and compare trace digests (default true —
   * every run carries replay-determinism evidence). Disable only for
   * diagnostics; the replay-determinism invariant then fails closed.
   */
  readonly replayCheck?: boolean;
}

/** The typed, content-addressed RESULT record of one scenario run. */
export interface ScenarioResult {
  readonly schemaVersion: 1;
  readonly scenarioId: string;
  readonly scenarioDigest: string;
  readonly driverName: string;
  readonly traceDigest: string;
  readonly stepCount: number;
  /** Pass/fail per invariant (scenario-declared + built-in checks). */
  readonly invariantResults: readonly InvariantFinding[];
  /** The second run's trace digest + the determinism verdict (when doubled). */
  readonly replay: { readonly secondTraceDigest: string; readonly deterministic: boolean } | null;
  /** True iff every invariant finding is satisfied. */
  readonly passed: boolean;
  /** Canonical SHA-256 over the result content (everything but this field). */
  readonly resultDigest: string;
}

/** One complete scenario run: the trace, the full reports, the result. */
export interface ScenarioRun {
  readonly scenario: ScenarioDefinition;
  readonly trace: ExecutionTrace;
  /** The full typed per-step reports (the trace carries their digests). */
  readonly reports: readonly StepReport[];
  readonly result: ScenarioResult;
}

export type RunOutcome =
  | { ok: true; value: ScenarioRun }
  | {
      ok: false;
      error: {
        code: 'scenario-parse-failed';
        message: string;
        issues: readonly { readonly path: string; readonly message: string }[];
      };
    };

/** Execute one scenario against one driver (the engine entry point). */
export function runScenario(
  scenarioInput: unknown,
  driver: ScenarioDriver,
  options: RunScenarioOptions = {},
): RunOutcome {
  const parsed = parseScenario(scenarioInput);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }
  const scenario = parsed.value;
  const replayCheck = options.replayCheck ?? true;

  const first = executeOnce(scenario, driver);
  let secondTraceDigest: string | null = null;
  if (replayCheck) {
    const second = executeOnce(scenario, driver);
    secondTraceDigest = second.trace.traceDigest;
  }

  const findings = evaluateRunInvariants(scenario, first, secondTraceDigest);
  const deterministic = secondTraceDigest === null || secondTraceDigest === first.trace.traceDigest;
  const passed = findings.every((finding) => finding.satisfied) && deterministic;

  const resultContent = {
    schemaVersion: 1 as const,
    scenarioId: scenario.scenarioId,
    scenarioDigest: scenarioDigest(scenario),
    driverName: driver.name,
    traceDigest: first.trace.traceDigest,
    stepCount: first.trace.steps.length,
    invariantResults: findings,
    replay:
      secondTraceDigest === null
        ? null
        : { secondTraceDigest, deterministic },
    passed,
  };
  const result: ScenarioResult = {
    ...resultContent,
    resultDigest: canonicalDigest(resultContent as unknown as JsonValue),
  };

  return {
    ok: true,
    value: { scenario, trace: first.trace, reports: first.reports, result },
  };
}

// --------------------------------------------------------------------------------
// Internals.
// --------------------------------------------------------------------------------

interface SingleExecution {
  readonly trace: ExecutionTrace;
  readonly reports: readonly StepReport[];
}

function executeOnce(scenario: ScenarioDefinition, driver: ScenarioDriver): SingleExecution {
  const knownOps = new Set(driver.driverOps);
  let world = driver.begin(scenario);
  const reports: StepReport[] = [];
  const entries: TraceStepEntry[] = [];
  let stateDigest = driver.stateDigest(world);

  for (const [index, step] of scenario.steps.entries()) {
    if (step.kind === 'call') {
      if (!knownOps.has(step.driverOp)) {
        throw new DriverContractError(
          `driver "${driver.name}" does not implement driverOp "${step.driverOp}" (step "${step.stepId}")`,
        );
      }
      const context: StepContext = { scenario, stepIndex: index, priorReports: [...reports] };
      const result = driver.runStep(world, step, context);
      if (result.report.stepId !== step.stepId) {
        throw new DriverContractError(
          `driver "${driver.name}" reported stepId "${result.report.stepId}" for step "${step.stepId}"`,
        );
      }
      const before = stateDigest;
      world = result.world;
      const after = driver.stateDigest(world);
      const report = result.report;
      reports.push(report);
      entries.push({
        stepId: step.stepId,
        kind: 'call',
        stepDigest: stepDigest(step),
        inputDigest: canonicalDigest(step.input),
        outputDigest: report.ok
          ? report.valueDigest
          : canonicalDigest({
              code: report.errorCode,
              message: report.errorMessage,
              denial: report.denial,
              authorityRejection: report.authorityRejection,
            } as unknown as JsonValue),
        outcome: outcomeOf(report),
        errorCode: report.errorCode,
        events: report.events,
        provenance: report.provenance,
        identities: report.identities,
        stateDigestBefore: before,
        stateDigestAfter: after,
        stateDelta: before !== after,
        assertFindings: null,
      });
      stateDigest = after;
    } else {
      // Assert step: evaluate the invariant library over the accumulated prefix.
      const prefixTrace = prefixTraceOf(scenario, driver, entries, stateDigest);
      const context = { scenario, reports: [...reports], trace: prefixTrace };
      const findings = evaluateInvariant(step.invariant, context, step.argument);
      const assertFindings: AssertFinding[] = findings.map((finding) => ({
        invariant: finding.invariant,
        satisfied: finding.satisfied,
        detail: finding.detail,
      }));
      entries.push({
        stepId: step.stepId,
        kind: 'assert',
        stepDigest: stepDigest(step),
        inputDigest: null,
        outputDigest: canonicalDigest(step.argument),
        outcome: 'asserted',
        errorCode: null,
        events: [],
        provenance: [],
        identities: [],
        stateDigestBefore: stateDigest,
        stateDigestAfter: stateDigest,
        stateDelta: false,
        assertFindings,
      });
    }
  }

  const trace = sealTrace({
    schemaVersion: 1 as const,
    traceId: `${scenario.scenarioId}#trace`,
    scenarioId: scenario.scenarioId,
    scenarioDigest: scenarioDigest(scenario),
    driverName: driver.name,
    steps: entries,
    finalStateDigest: stateDigest,
  });
  return { trace, reports };
}

/** Build a sealed trace over the entries accumulated so far (assert-step view). */
function prefixTraceOf(
  scenario: ScenarioDefinition,
  driver: ScenarioDriver,
  entries: readonly TraceStepEntry[],
  stateDigest: string,
): ExecutionTrace {
  return sealTrace({
    schemaVersion: 1 as const,
    traceId: `${scenario.scenarioId}#trace`,
    scenarioId: scenario.scenarioId,
    scenarioDigest: scenarioDigest(scenario),
    driverName: driver.name,
    steps: [...entries],
    finalStateDigest: stateDigest,
  });
}

/** Evaluate the scenario-declared invariants + built-ins over a full run. */
function evaluateRunInvariants(
  scenario: ScenarioDefinition,
  execution: SingleExecution,
  secondTraceDigest: string | null,
): InvariantFinding[] {
  const context = { scenario, reports: execution.reports, trace: execution.trace };
  const findings: InvariantFinding[] = [];

  // Built-in: every run checks expectation conformance + trace integrity.
  findings.push(...INVARIANT_CHECKS['expectation-conformance'](context, undefined));
  findings.push(...INVARIANT_CHECKS['trace-integrity'](context, undefined));

  // Scenario-declared invariants.
  for (const expectation of scenario.invariants) {
    if (expectation.invariant === 'scenario-round-trip') {
      findings.push(...checkScenarioRoundTrip(scenario));
      continue;
    }
    if (expectation.invariant === 'replay-determinism') {
      findings.push(
        ...checkReplayDeterminism({ scenario, trace: execution.trace, secondTraceDigest }),
      );
      continue;
    }
    if (isRunLevelInvariant(expectation.invariant)) {
      findings.push({
        invariant: expectation.invariant,
        satisfied: false,
        detail: `run-level invariant "${expectation.invariant}" is reserved (evaluated only by the runner)`,
      });
      continue;
    }
    findings.push(...evaluateInvariant(expectation.invariant, context, expectation.argument));
  }
  return findings;
}
