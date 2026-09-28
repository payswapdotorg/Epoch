// METRICS + HEALTH + AUDIT FAMILIES: the deterministic fold, the
// derived health projection, and the two audit families.
import { describe, expect, it } from 'vitest';
import {
  auditProjectionSummary,
  auditTenantBoundary,
  foldObservations,
  zeroMetrics,
  projectSecurityHealth,
} from '../src/index';
import {
  OBSERVATION_ID,
  OTHER_TENANT,
  TENANT,
  sealedAdmissionObservation,
  sealedBoundaryObservation,
  sealedViolationObservation,
} from './fixtures';

const THRESHOLDS = { degradedAtCriticalViolations: 1, criticalAtCriticalViolations: 2 };

describe('the metrics fold', () => {
  it('folds the zero metrics over no observations', () => {
    expect(foldObservations([])).toEqual(zeroMetrics());
  });

  it('counts classes, outcomes, and severities commutatively (order irrelevant)', () => {
    const observations = [
      sealedAdmissionObservation(),
      sealedViolationObservation('observation:viol-001'),
      sealedBoundaryObservation('observation:boundary-001'),
    ];
    const forward = foldObservations(observations);
    const backward = foldObservations([...observations].reverse());
    expect(JSON.stringify(forward)).toBe(JSON.stringify(backward));
    expect(forward.observationsTotal).toBe(3);
    expect(forward.criticalViolations).toBe(1);
    expect(forward.violationsTotal).toBe(1);
    expect(forward.deniedTotal).toBe(1);
    expect(forward.byClass['sandbox-admission']).toBe(1);
    expect(forward.byClass['sandbox-violation']).toBe(1);
    expect(forward.byClass['tenant-boundary-check']).toBe(1);
    expect(forward.sandboxAdmissionsConforming).toBe(1);
    // The violation observation (class sandbox-violation) counts as a
    // violating sandbox admission.
    expect(forward.sandboxAdmissionsViolating).toBe(1);
  });

  it('every closed vocabulary key is always present (zero when absent)', () => {
    const metrics = foldObservations([sealedAdmissionObservation()]);
    expect(Object.keys(metrics.byClass).sort()).toEqual(
      [
        'action-dispatch',
        'agent-session',
        'authorization-decision',
        'sandbox-admission',
        'sandbox-invocation',
        'sandbox-violation',
        'security-audit',
        'simulation-run',
        'tenant-boundary-check',
      ].sort(),
    );
    expect(Object.keys(metrics.byOutcome).sort()).toEqual(['allowed', 'denied', 'observed', 'violated']);
    expect(Object.keys(metrics.bySeverity).sort()).toEqual(['critical', 'info', 'notice', 'warning']);
  });
});

describe('the security-health projection', () => {
  it('healthy with zero violations', () => {
    const health = projectSecurityHealth(zeroMetrics(), THRESHOLDS, 0);
    expect(health.status).toBe('healthy');
  });

  it('degraded at the degraded threshold', () => {
    const metrics = { ...zeroMetrics(), criticalViolations: 1 };
    expect(projectSecurityHealth(metrics, THRESHOLDS, 0).status).toBe('degraded');
  });

  it('critical at the critical threshold', () => {
    const metrics = { ...zeroMetrics(), criticalViolations: 2 };
    expect(projectSecurityHealth(metrics, THRESHOLDS, 0).status).toBe('critical');
  });

  it('any quarantined subject flips health to critical (deny-by-default)', () => {
    expect(projectSecurityHealth(zeroMetrics(), THRESHOLDS, 1).status).toBe('critical');
  });

  it('echoes the thresholds + counts it applied (auditability)', () => {
    const health = projectSecurityHealth(zeroMetrics(), THRESHOLDS, 0);
    expect(health.thresholds).toEqual(THRESHOLDS);
    expect(health.criticalViolations).toBe(0);
    expect(health.quarantinedSubjects).toBe(0);
  });
});

describe('the tenant-boundary audit family', () => {
  it('a DENIED cross-tenant attempt is compliant (no finding)', () => {
    const findings = auditTenantBoundary([sealedBoundaryObservation('observation:boundary-001')]);
    expect(findings).toEqual([]);
  });

  it('an ALLOWED cross-tenant attempt is a cross-tenant-breach finding', () => {
    const breach = sealedBoundaryObservation('observation:boundary-002', { outcome: 'allowed' });
    const findings = auditTenantBoundary([breach]);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.code).toBe('cross-tenant-breach');
    expect(findings[0]!.subject).toBe('observation:boundary-002');
  });

  it('an OBSERVED cross-tenant record is a breach (only denied is compliant)', () => {
    const breach = sealedBoundaryObservation('observation:boundary-003', { outcome: 'observed' });
    expect(auditTenantBoundary([breach])[0]!.code).toBe('cross-tenant-breach');
  });

  it('a same-tenant boundary check is compliant', () => {
    const ok = sealedBoundaryObservation('observation:boundary-004', {
      detail: { subjectTenantId: TENANT, actorTenantId: TENANT },
    });
    expect(auditTenantBoundary([ok])).toEqual([]);
  });

  it('a boundary observation WITHOUT tenant detail is a finding (fail-closed)', () => {
    const unverifiable = sealedBoundaryObservation('observation:boundary-005', { detail: {} });
    expect(auditTenantBoundary([unverifiable])[0]!.code).toBe('cross-tenant-breach');
  });

  it('non-boundary observations are ignored by the family', () => {
    expect(auditTenantBoundary([sealedAdmissionObservation()])).toEqual([]);
    expect(OTHER_TENANT).toMatch(/^tenant:/);
  });

  it('findings are listed in observation-id order (deterministic)', () => {
    const findings = auditTenantBoundary([
      sealedBoundaryObservation('observation:boundary-009', { outcome: 'allowed' }),
      sealedBoundaryObservation('observation:boundary-008', { outcome: 'allowed' }),
    ]);
    expect(findings.map((f) => f.subject)).toEqual([
      'observation:boundary-008',
      'observation:boundary-009',
    ]);
  });
});

describe('the access-projection audit family (W041 invariants)', () => {
  const canonical = { objectId: 'delivery:tower-retrofit-v1', objectDigest: 'c'.repeat(64) };

  it('a conforming projection summary produces no findings', () => {
    const summary = {
      objectId: canonical.objectId,
      objectDigest: canonical.objectDigest,
      releasedPaths: ['title'],
      redactedPaths: ['commercial.unitCost'],
      decisionDigest: 'd'.repeat(64),
      policyId: 'security-policy:projection-baseline',
    };
    expect(auditProjectionSummary(summary, canonical)).toEqual([]);
  });

  it('projection-identity-fork: id or digest mismatch', () => {
    const forked = {
      objectId: 'delivery:other-delivery',
      objectDigest: canonical.objectDigest,
      releasedPaths: [],
      redactedPaths: [],
      decisionDigest: null,
      policyId: null,
    };
    const findings = auditProjectionSummary(forked, canonical);
    expect(findings.map((f) => f.code)).toContain('projection-identity-fork');
  });

  it('projection-path-overlap: a path both released and redacted', () => {
    const overlapping = {
      objectId: canonical.objectId,
      objectDigest: canonical.objectDigest,
      releasedPaths: ['title', 'commercial.unitCost'],
      redactedPaths: ['commercial.unitCost'],
      decisionDigest: 'd'.repeat(64),
      policyId: 'security-policy:projection-baseline',
    };
    expect(
      auditProjectionSummary(overlapping, canonical).map((f) => f.code),
    ).toContain('projection-path-overlap');
  });

  it('projection-decision-missing: a released projection with no decision digest', () => {
    const missing = {
      objectId: canonical.objectId,
      objectDigest: canonical.objectDigest,
      releasedPaths: ['title'],
      redactedPaths: [],
      decisionDigest: null,
      policyId: 'security-policy:projection-baseline',
    };
    expect(auditProjectionSummary(missing, canonical).map((f) => f.code)).toContain(
      'projection-decision-missing',
    );
  });

  it('projection-policy-missing: no policy revision reference', () => {
    const missing = {
      objectId: canonical.objectId,
      objectDigest: canonical.objectDigest,
      releasedPaths: [],
      redactedPaths: ['title'],
      decisionDigest: 'd'.repeat(64),
      policyId: null,
    };
    expect(auditProjectionSummary(missing, canonical).map((f) => f.code)).toContain(
      'projection-policy-missing',
    );
  });

  it('an empty projection (no released fields) needs no decision (nothing was shown)', () => {
    const empty = {
      objectId: canonical.objectId,
      objectDigest: canonical.objectDigest,
      releasedPaths: [],
      redactedPaths: ['title'],
      decisionDigest: null,
      policyId: 'security-policy:projection-baseline',
    };
    expect(auditProjectionSummary(empty, canonical).map((f) => f.code)).not.toContain(
      'projection-decision-missing',
    );
  });

  it('OBSERVATION_ID fixture sanity (import pin)', () => {
    expect(OBSERVATION_ID).toBe('observation:ext-admission-001');
  });
});
