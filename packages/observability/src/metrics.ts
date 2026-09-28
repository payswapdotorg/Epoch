/**
 * The deterministic METRICS FOLD over admitted observations: a pure
 * function producing a canonical, serialization-friendly counter
 * record. Two stores fed the same observations (in ANY order) fold
 * byte-identical metrics — no insertion-order leaks, no wall-clock,
 * no randomness.
 */
import { OBSERVATION_CLASSES, OBSERVATION_OUTCOMES, OBSERVATION_SEVERITIES } from './version';
import type { ObservationClass, ObservationOutcome, ObservationSeverity } from './version';
import type { SealedObservation } from './observation';

/** The counter vocabulary of the metrics fold. */
export const METRIC_COUNTERS = [
  'observationsTotal',
  'criticalViolations',
  'violationsTotal',
  'deniedTotal',
  'sandboxAdmissionsConforming',
  'sandboxAdmissionsViolating',
] as const;

/** One metric counter name. */
export type MetricCounter = (typeof METRIC_COUNTERS)[number];

/** The per-class counter record (every closed class key present; zero when absent). */
export type PerClassCounts = Readonly<Record<ObservationClass, number>>;

/** The per-outcome counter record (every closed outcome key present). */
export type PerOutcomeCounts = Readonly<Record<ObservationOutcome, number>>;

/** The per-severity counter record (every closed severity key present). */
export type PerSeverityCounts = Readonly<Record<ObservationSeverity, number>>;

/** The folded observability metrics (deterministic, serialization-friendly). */
export interface ObservabilityMetrics {
  readonly observationsTotal: number;
  readonly criticalViolations: number;
  readonly violationsTotal: number;
  readonly deniedTotal: number;
  readonly sandboxAdmissionsConforming: number;
  readonly sandboxAdmissionsViolating: number;
  readonly byClass: PerClassCounts;
  readonly byOutcome: PerOutcomeCounts;
  readonly bySeverity: PerSeverityCounts;
}

/** The zero metrics (the fold identity). */
export function zeroMetrics(): ObservabilityMetrics {
  const byClass = {} as Record<ObservationClass, number>;
  for (const cls of OBSERVATION_CLASSES) byClass[cls] = 0;
  const byOutcome = {} as Record<ObservationOutcome, number>;
  for (const outcome of OBSERVATION_OUTCOMES) byOutcome[outcome] = 0;
  const bySeverity = {} as Record<ObservationSeverity, number>;
  for (const severity of OBSERVATION_SEVERITIES) bySeverity[severity] = 0;
  return {
    observationsTotal: 0,
    criticalViolations: 0,
    violationsTotal: 0,
    deniedTotal: 0,
    sandboxAdmissionsConforming: 0,
    sandboxAdmissionsViolating: 0,
    byClass,
    byOutcome,
    bySeverity,
  };
}

/** The mutable accumulator shape of the fold (readonly only at the boundary). */
type MutableMetrics = {
  observationsTotal: number;
  criticalViolations: number;
  violationsTotal: number;
  deniedTotal: number;
  sandboxAdmissionsConforming: number;
  sandboxAdmissionsViolating: number;
  byClass: Record<ObservationClass, number>;
  byOutcome: Record<ObservationOutcome, number>;
  bySeverity: Record<ObservationSeverity, number>;
};

/**
 * Fold admitted observations into the metrics record. PURE and
 * DETERMINISTIC: observation order never matters (counters are
 * commutative); every closed vocabulary key is always present.
 */
export function foldObservations(observations: readonly SealedObservation[]): ObservabilityMetrics {
  const metrics: MutableMetrics = zeroMetrics();
  for (const observation of observations) {
    metrics.observationsTotal += 1;
    metrics.byClass[observation.observationClass] += 1;
    metrics.byOutcome[observation.outcome] += 1;
    metrics.bySeverity[observation.severity] += 1;
    if (observation.outcome === 'violated') {
      metrics.violationsTotal += 1;
      if (observation.severity === 'critical') {
        metrics.criticalViolations += 1;
      }
    }
    if (observation.outcome === 'denied') {
      metrics.deniedTotal += 1;
    }
    if (
      observation.observationClass === 'sandbox-violation' ||
      (observation.observationClass === 'sandbox-admission' &&
        (observation.outcome === 'violated' || observation.outcome === 'denied'))
    ) {
      // A sandbox VIOLATION observation (the host records failed
      // admissions as violations) or a denied/quarantined admission.
      metrics.sandboxAdmissionsViolating += 1;
    } else if (
      observation.observationClass === 'sandbox-admission' &&
      observation.outcome === 'allowed'
    ) {
      metrics.sandboxAdmissionsConforming += 1;
    }
  }
  return metrics;
}
