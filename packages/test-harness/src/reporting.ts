/**
 * The reporting surface: machine-readable renderings of a scenario run.
 *
 * Every rendering is a content-addressed JSON record (canonical-JSON
 * serializable, digest-stable) so results can be archived, diffed and
 * verified exactly like every other Epoch record — plus one compact
 * human-readable line summary for console output.
 */
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';
import type { StepReport } from './driver';
import type { ScenarioRun } from './runner';
import { serializeScenario, scenarioDigest } from './scenario';

/** The machine-readable run record (scenario + trace + result digests). */
export interface RunReportRecord {
  readonly schemaVersion: 1;
  readonly scenarioId: string;
  readonly scenarioDigest: string;
  readonly driverName: string;
  readonly traceDigest: string;
  readonly resultDigest: string;
  readonly passed: boolean;
  readonly stepCount: number;
  readonly invariantResults: readonly {
    readonly invariant: string;
    readonly satisfied: boolean;
    readonly detail: string;
  }[];
  readonly steps: readonly {
    readonly stepId: string;
    readonly kind: 'call' | 'assert';
    readonly outcome: string;
    readonly errorCode: string | null;
    readonly stateDelta: boolean;
    readonly eventCount: number;
    readonly provenanceCount: number;
  }[];
  readonly reportDigest: string;
}

/** Render the machine-readable run record (content-addressed). */
export function renderRunReport(run: ScenarioRun): RunReportRecord {
  const content = {
    schemaVersion: 1 as const,
    scenarioId: run.scenario.scenarioId,
    scenarioDigest: scenarioDigest(run.scenario),
    driverName: run.trace.driverName,
    traceDigest: run.trace.traceDigest,
    resultDigest: run.result.resultDigest,
    passed: run.result.passed,
    stepCount: run.trace.steps.length,
    invariantResults: run.result.invariantResults,
    steps: run.trace.steps.map((entry) => ({
      stepId: entry.stepId,
      kind: entry.kind,
      outcome: entry.outcome,
      errorCode: entry.errorCode,
      stateDelta: entry.stateDelta,
      eventCount: entry.events.length,
      provenanceCount: entry.provenance.length,
    })),
  };
  return { ...content, reportDigest: canonicalDigest(content as unknown as JsonValue) };
}

/** Canonical JSON serialization of a run report (byte-stable). */
export function serializeRunReport(report: RunReportRecord): string {
  const content: Omit<RunReportRecord, 'reportDigest'> = {
    schemaVersion: report.schemaVersion,
    scenarioId: report.scenarioId,
    scenarioDigest: report.scenarioDigest,
    driverName: report.driverName,
    traceDigest: report.traceDigest,
    resultDigest: report.resultDigest,
    passed: report.passed,
    stepCount: report.stepCount,
    invariantResults: report.invariantResults,
    steps: report.steps,
  };
  return JSON.stringify(content);
}

/** One compact human-readable summary line per run. */
export function formatRunSummary(run: ScenarioRun): string {
  const failures = run.result.invariantResults.filter((finding) => !finding.satisfied);
  const verdict = run.result.passed ? 'PASS' : 'FAIL';
  const replay =
    run.result.replay === null
      ? 'no-replay'
      : run.result.replay.deterministic
        ? 'deterministic'
        : 'NON-DETERMINISTIC';
  const failedDetail =
    failures.length === 0 ? '' : ` — failing: ${failures.map((finding) => finding.invariant).join(', ')}`;
  return (
    `[${verdict}] ${run.scenario.scenarioId} (${run.trace.steps.length} steps, ${replay})` +
    ` trace=${run.trace.traceDigest.slice(0, 12)}… result=${run.result.resultDigest.slice(0, 12)}…${failedDetail}`
  );
}

/** Digest of one step report's full evidence (for cross-referencing). */
export function stepReportDigest(report: StepReport): string {
  return canonicalDigest({
    stepId: report.stepId,
    ok: report.ok,
    valueDigest: report.valueDigest,
    errorCode: report.errorCode,
    denial: report.denial,
    authorityRejection: report.authorityRejection,
    events: report.events,
    provenance: report.provenance,
    identities: report.identities,
  } as unknown as JsonValue);
}

/** The canonical serialization of the scenario (for archival). */
export function serializedScenarioOf(run: ScenarioRun): string {
  return serializeScenario(run.scenario);
}
