/**
 * The derived SECURITY-HEALTH projection: a PURE function over the
 * metrics fold + the active policy thresholds (+ the quarantined
 * subject count). Deterministic, total, zero wall-clock — the health
 * state is a projection over admitted facts, never an independent
 * authority (lock rule 16 applied to health).
 *
 * Status semantics (fail-closed ordering):
 *
 * 1. `critical` — any quarantined subject OR critical violations at
 *    or above the policy's `criticalAtCriticalViolations` threshold;
 * 2. `degraded` — critical violations at or above the policy's
 *    `degradedAtCriticalViolations` threshold;
 * 3. `healthy` — otherwise.
 *
 * No policy supplied -> `unknown-policy` is NOT a health state: the
 * projection requires thresholds (the host supplies the active
 * policy's thresholds; a thresholdless health claim is a typed
 * validation failure).
 */
import type { ObservabilityMetrics } from './metrics';
import type { SecurityThresholds } from './policy';
import { SECURITY_HEALTH_STATUSES } from './version';
import type { SecurityHealthStatus } from './version';

/** The derived security-health projection (deterministic). */
export interface SecurityHealth {
  readonly status: SecurityHealthStatus;
  readonly criticalViolations: number;
  readonly violationsTotal: number;
  readonly quarantinedSubjects: number;
  /** The threshold pair the projection applied (echoed for auditability). */
  readonly thresholds: SecurityThresholds;
}

/**
 * Project the security health from metrics + thresholds + the
 * quarantined-subject count. Total and deterministic.
 */
export function projectSecurityHealth(
  metrics: ObservabilityMetrics,
  thresholds: SecurityThresholds,
  quarantinedSubjects: number,
): SecurityHealth {
  let status: SecurityHealthStatus = 'healthy';
  if (
    quarantinedSubjects > 0 ||
    metrics.criticalViolations >= thresholds.criticalAtCriticalViolations
  ) {
    status = 'critical';
  } else if (metrics.criticalViolations >= thresholds.degradedAtCriticalViolations) {
    status = 'degraded';
  }
  return {
    status,
    criticalViolations: metrics.criticalViolations,
    violationsTotal: metrics.violationsTotal,
    quarantinedSubjects,
    thresholds,
  };
}

/** The closed health-status vocabulary re-export (schema-surface consumers). */
export { SECURITY_HEALTH_STATUSES };
