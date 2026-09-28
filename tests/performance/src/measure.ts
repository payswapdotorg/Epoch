// W034 — the measurement helper: run one subject flow at one ladder rung,
// seal the measured counts, and evaluate the subject's budget. Pure
// plumbing over the flows + catalog; results are memoized per
// (subject, rung, salt, mode) so every test file shares one computed
// measurement (identical inputs -> identical cached outputs).
import {
  createCounterHub,
  evaluateBudget,
  sealMeasuredCounts,
  type SealedBudgetVerdictRecord,
  type SealedMeasuredCounts,
  type SealedWorkloadRecord,
} from '@epoch/performance';
import {
  runDeliveryStackCompositionFlow,
  runHarnessScenarioFlow,
  runObservationStackFlow,
  runPackProjectionFlow,
  runProgramFoldFlow,
  runRefoldFlow,
  runSolutionAdmissionFlow,
  runVarianceStackFlow,
  type RefoldMode,
  type FlowSummary,
} from './flows';
import { budgetOf, workloadAtRung } from './budget-catalog';

/** One complete measurement: the workload, the sealed counts, the verdict. */
export interface Measurement {
  readonly workload: SealedWorkloadRecord;
  readonly counts: SealedMeasuredCounts;
  readonly verdict: SealedBudgetVerdictRecord;
  readonly summary: FlowSummary;
}

export interface MeasureOptions {
  readonly salt?: string;
  readonly mode?: RefoldMode;
}

const cache = new Map<string, Measurement>();

/** Measure one subject at one ladder rung (memoized; deterministic). */
export function measureSubject(subject: string, rungLabel: string, options: MeasureOptions = {}): Measurement {
  const salt = options.salt ?? '';
  const mode = options.mode ?? 'batched';
  const key = `${subject}|${rungLabel}|${salt}|${mode}`;
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const workload = workloadAtRung(subject, rungLabel, salt);
  const hub = createCounterHub();
  let summary: FlowSummary;
  switch (subject) {
    case 'solution-admission':
      summary = runSolutionAdmissionFlow(hub, workload);
      break;
    case 'program-fold':
      summary = runProgramFoldFlow(hub, workload);
      break;
    case 'pack-projection':
      summary = runPackProjectionFlow(hub, workload);
      break;
    case 'observation-stack':
      summary = runObservationStackFlow(hub, workload);
      break;
    case 'variance-stack':
      summary = runVarianceStackFlow(hub, workload);
      break;
    case 'harness-scenario':
      summary = runHarnessScenarioFlow(hub, workload);
      break;
    case 'delivery-stack-composition':
      summary = runDeliveryStackCompositionFlow(hub, workload);
      break;
    case 'distinction-refold':
      summary = runRefoldFlow(hub, workload, mode);
      break;
    default:
      throw new Error(`measure: unknown subject "${subject}"`);
  }
  const counts = sealMeasuredCounts({
    schema: 'epoch.performance.counts',
    schemaVersion: 1,
    tenantId: workload.tenantId,
    countsId: `counts:${subject}-${rungLabel}${salt === '' ? '' : `-${salt}`}`,
    subject,
    workloadId: workload.workloadId,
    workloadDigest: workload.contentDigest,
    counts: hub.snapshot(),
    measuredBy: 'principal:platform-engineer',
    provenance: { kind: 'observed', sourceRef: 'tests/performance/src/flows.ts' },
  });
  if (!counts.ok) {
    throw new Error(`measure: counts seal failed: ${JSON.stringify(counts.error)}`);
  }
  const verdict = evaluateBudget({ workload, counts: counts.value, budget: budgetOf(subject) });
  if (!verdict.ok) {
    throw new Error(`measure: budget evaluation failed: ${JSON.stringify(verdict.error)}`);
  }
  const measurement: Measurement = { workload, counts: counts.value, verdict: verdict.value, summary };
  cache.set(key, measurement);
  return measurement;
}
