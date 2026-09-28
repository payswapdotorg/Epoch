// POLICY AS DATA (the W043 pin): severity + escalation policy is
// sealed, versioned DATA — swapping a policy record changes escalation
// with NO code change; rule lookup is deterministic precedence.
import { describe, expect, it } from 'vitest';
import {
  admitEscalationPolicy,
  resolvePolicyRule,
  raiseAlert,
  verifySealedEscalationPolicy,
} from '../src/index';
import {
  OTHER_TENANT,
  POLICY_ID,
  PRINCIPAL,
  TENANT,
  T2,
  T3,
  expectError,
  findingSummary,
  policyContent,
  sealedPolicy,
  unwrap,
} from './fixtures';

describe('escalation-policy admission (policy as data)', () => {
  it('admits and seals the standard policy with a content digest', () => {
    const policy = sealedPolicy();
    expect(policy.policyId).toBe(POLICY_ID);
    expect(policy.policyVersion).toBe('1.0.0');
    expect(policy.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(verifySealedEscalationPolicy(JSON.parse(JSON.stringify(policy))).ok).toBe(true);
  });

  it('a tampered policy digest is rejected (digest-mismatch)', () => {
    const policy = sealedPolicy();
    const error = expectError(verifySealedEscalationPolicy({ ...policy, contentDigest: '0'.repeat(64) }));
    expect(error.code).toBe('digest-mismatch');
  });

  it('duplicate (class, status) rules are rejected — precedence is deterministic', () => {
    const error = expectError(
      admitEscalationPolicy(
        policyContent({
          rules: [
            {
              ruleId: 'rule:a',
              findingClass: 'planned-vs-actual',
              findingStatus: 'blocked',
              severity: 'major',
              escalation: policyContent()['defaultEscalation'] as never,
            },
            {
              ruleId: 'rule:b',
              findingClass: 'planned-vs-actual',
              findingStatus: 'blocked',
              severity: 'critical',
              escalation: policyContent()['defaultEscalation'] as never,
            },
          ],
        }),
      ),
    );
    expect(error.code).toBe('validation');
  });

  it('a malformed policy is rejected (validation) and vendor fields are vendor-fields-rejected', () => {
    expect(expectError(admitEscalationPolicy(policyContent({ defaultSeverity: 'apocalyptic' }))).code).toBe(
      'validation',
    );
    expect(expectError(admitEscalationPolicy(policyContent({ vendorHook: 'x' }))).code).toBe(
      'vendor-fields-rejected',
    );
  });
});

describe('deterministic rule lookup (exact > class-only > default)', () => {
  it('an exact (class + status) match wins', () => {
    const policy = sealedPolicy();
    const decision = resolvePolicyRule(policy, 'planned-vs-actual', 'blocked');
    expect(decision.matched).toBe(true);
    expect(decision.ruleId).toBe('rule:blocked-activities');
    expect(decision.severity).toBe('critical');
  });

  it('a class-only match covers the remaining statuses', () => {
    const policy = sealedPolicy();
    const decision = resolvePolicyRule(policy, 'planned-vs-actual', 'late');
    expect(decision.ruleId).toBe('rule:late-activities');
    expect(decision.severity).toBe('major');
  });

  it('an unknown class falls back to the policy defaults', () => {
    const policy = sealedPolicy();
    const decision = resolvePolicyRule(policy, 'consumption-anomaly', 'drifted');
    expect(decision.matched).toBe(false);
    expect(decision.ruleId).toBeNull();
    expect(decision.severity).toBe('warning');
  });
});

describe('policy-controlled escalation (swapping the record changes escalation)', () => {
  it('the SAME finding raises at different severities under two policy records', () => {
    const standard = sealedPolicy();
    const strict = sealedPolicy({
      policyVersion: '2.0.0',
      defaultSeverity: 'critical',
      defaultEscalation: {
        notify: [{ targetKind: 'principal', targetRef: 'principal:operations-director' }],
        escalationDelaySeconds: '60',
        reNotifyCadenceSeconds: '600',
        escalateTo: [],
      },
      rules: [],
    });
    const summary = findingSummary({ findingClass: 'consumption-anomaly', findingStatus: 'drifted' });
    const standardAlert = unwrap(
      raiseAlert([], {
        alertId: 'alert:consumption-anomaly-activity-excavate',
        tenantId: TENANT,
        summary,
        policy: standard,
        raisedAt: T3,
        raisedBy: PRINCIPAL,
      }),
    );
    const strictAlert = unwrap(
      raiseAlert([], {
        alertId: 'alert:consumption-anomaly-activity-excavate',
        tenantId: TENANT,
        summary,
        policy: strict,
        raisedAt: T3,
        raisedBy: PRINCIPAL,
      }),
    );
    expect(standardAlert.alert.severity).toBe('warning');
    expect(strictAlert.alert.severity).toBe('critical');
    expect(strictAlert.alert.policyDigest).not.toBe(standardAlert.alert.policyDigest);
    expect(strictAlert.alert.policyId).toBe(POLICY_ID); // same id, new version — policy is data
  });

  it('raising the same finding under a NEW policy version appends a revision (not a duplicate)', () => {
    const first = unwrap(
      raiseAlert([], {
        alertId: 'alert:planned-vs-actual-activity-activity-excavate',
        tenantId: TENANT,
        summary: findingSummary(),
        policy: sealedPolicy(),
        raisedAt: T3,
        raisedBy: PRINCIPAL,
      }),
    );
    const strict = sealedPolicy({ policyVersion: '2.0.0', rules: [] });
    const second = unwrap(
      raiseAlert([first.alert], {
        alertId: 'alert:planned-vs-actual-activity-activity-excavate',
        tenantId: TENANT,
        summary: findingSummary(),
        policy: strict,
        raisedAt: T3,
        raisedBy: PRINCIPAL,
      }),
    );
    expect(second.admission).toBe('raised');
    expect(second.alert.revision).toBe(2);
    expect(second.alert.previousRevisionDigest).toBe(first.alert.contentDigest);
  });
});

describe('tenant isolation (R12)', () => {
  it('a cross-tenant policy/raise mismatch is rejected', () => {
    const policy = sealedPolicy({ tenantId: OTHER_TENANT });
    const error = expectError(
      raiseAlert(
        [
          {
            ...unwrap(
              raiseAlert([], {
                alertId: 'alert:planned-vs-actual-activity-activity-excavate',
                tenantId: OTHER_TENANT,
                summary: findingSummary(),
                policy,
                raisedAt: T2,
                raisedBy: PRINCIPAL,
              }),
            ).alert,
          },
        ],
        {
          alertId: 'alert:planned-vs-actual-activity-activity-excavate',
          tenantId: TENANT,
          summary: findingSummary({ findingDigest: 'c'.repeat(64) }),
          policy: sealedPolicy(),
          raisedAt: T3,
          raisedBy: PRINCIPAL,
        },
      ),
    );
    expect(error.code).toBe('tenant-isolation-rejected');
  });

  it('a chain watching a DIFFERENT finding is dangling-reference-rejected', () => {
    const chain = [
      unwrap(
        raiseAlert([], {
          alertId: 'alert:planned-vs-actual-activity-activity-excavate',
          tenantId: TENANT,
          summary: findingSummary(),
          policy: sealedPolicy(),
          raisedAt: T2,
          raisedBy: PRINCIPAL,
        }),
      ).alert,
    ];
    const error = expectError(
      raiseAlert(chain, {
        alertId: 'alert:planned-vs-actual-activity-activity-excavate',
        tenantId: TENANT,
        summary: findingSummary({ findingId: 'finding:lead-time-risk-acquisition-cement' }),
        policy: sealedPolicy(),
        raisedAt: T3,
        raisedBy: PRINCIPAL,
      }),
    );
    expect(error.code).toBe('dangling-reference-rejected');
  });
});
