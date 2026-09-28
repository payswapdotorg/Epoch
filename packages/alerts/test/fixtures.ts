// Shared fixtures for the alerts kernel tests. Builders return loose
// JSON objects so negative tests can corrupt single fields precisely.
// ZERO clock reads.
import {
  admitEscalationPolicy,
  raiseAlert,
  type AlertFindingSummary,
  type SealedAlertRecord,
} from '../src/index';
import type { SealedEscalationPolicy } from '../src/index';

export const T0 = '2026-03-02T09:00:00.000Z';
export const T1 = '2026-03-02T09:00:01.000Z';
export const T2 = '2026-03-02T09:00:02.000Z';
export const T3 = '2026-03-02T09:00:03.000Z';
export const T4 = '2026-03-02T09:00:04.000Z';
export const T5 = '2026-03-02T09:00:05.000Z';
export const T6 = '2026-03-02T09:00:06.000Z';
export const T7 = '2026-03-02T09:00:07.000Z';
export const T8 = '2026-03-02T09:00:08.000Z';

export const TENANT = 'tenant:globex';
export const OTHER_TENANT = 'tenant:initech';
export const PRINCIPAL = 'principal:delivery-lead';
export const PROPOSER = 'agent:supervision-runtime';
export const GATEWAY = 'gateway:action-gateway';
export const APPROVER = 'principal:night-manager';
export const FINDING_ID = 'finding:planned-vs-actual-activity-activity-excavate';
export const FINDING_DIGEST = 'a'.repeat(64);
export const FINDING_DIGEST_2 = 'b'.repeat(64);
export const POLICY_ID = 'alert-policy:standard-escalation';

/** Unwrap a total result or fail loudly (positive-path helper). */
export function unwrap<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown },
): T {
  if (!result.ok) {
    throw new Error(`fixture failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

/** Assert a typed error code (negative-path helper). */
export function expectError<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown },
): { readonly code: string; readonly message: string } {
  if (result.ok) {
    throw new Error(`expected a typed rejection, got ok: ${JSON.stringify(result.value)}`);
  }
  return result.error as { code: string; message: string };
}

/** One escalation-policy content fixture (loose JSON). */
export function policyContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema: 'epoch.alerts.escalation-policy',
    schemaVersion: 1,
    policyId: POLICY_ID,
    tenantId: TENANT,
    policyVersion: '1.0.0',
    title: 'Standard delivery-supervision escalation policy',
    defaultSeverity: 'warning',
    defaultEscalation: {
      notify: [{ targetKind: 'role', targetRef: 'role:delivery-supervisor' }],
      escalationDelaySeconds: '3600',
      reNotifyCadenceSeconds: '86400',
      escalateTo: [{ targetKind: 'role', targetRef: 'role:program-manager' }],
    },
    rules: [
      {
        ruleId: 'rule:lead-time-risk',
        findingClass: 'lead-time-risk',
        severity: 'major',
        escalation: {
          notify: [{ targetKind: 'role', targetRef: 'role:procurement-lead' }],
          escalationDelaySeconds: '2700',
          reNotifyCadenceSeconds: '21600',
          escalateTo: [{ targetKind: 'role', targetRef: 'role:procurement-manager' }],
        },
      },
      {
        ruleId: 'rule:late-activities',
        findingClass: 'planned-vs-actual',
        severity: 'major',
        escalation: {
          notify: [{ targetKind: 'role', targetRef: 'role:site-manager' }],
          escalationDelaySeconds: '1800',
          reNotifyCadenceSeconds: '43200',
          escalateTo: [
            { targetKind: 'principal', targetRef: 'principal:operations-director' },
            { targetKind: 'role', targetRef: 'role:program-manager' },
          ],
        },
      },
      {
        ruleId: 'rule:blocked-activities',
        findingClass: 'planned-vs-actual',
        findingStatus: 'blocked',
        severity: 'critical',
        escalation: {
          notify: [
            { targetKind: 'role', targetRef: 'role:program-manager' },
            { targetKind: 'role', targetRef: 'role:site-manager' },
          ],
          escalationDelaySeconds: '900',
          reNotifyCadenceSeconds: '14400',
          escalateTo: [{ targetKind: 'role', targetRef: 'role:operations-director' }],
        },
      },
    ],
    activatedAt: T1,
    activatedBy: PRINCIPAL,
    ...overrides,
  };
}

/** The sealed escalation policy over the standard fixture. */
export function sealedPolicy(overrides: Record<string, unknown> = {}): SealedEscalationPolicy {
  return unwrap(admitEscalationPolicy(policyContent(overrides)));
}

/** One finding summary fixture (the supervision projection). */
export function findingSummary(overrides: Partial<AlertFindingSummary> = {}): AlertFindingSummary {
  return {
    findingId: FINDING_ID,
    findingDigest: FINDING_DIGEST,
    findingClass: 'planned-vs-actual',
    findingStatus: 'due',
    subjectKind: 'activity',
    subjectId: 'activity:excavate',
    title: 'Activity activity:excavate is due',
    detectedAt: T2,
    ...overrides,
  };
}

/** One alert chain over the standard fixtures (raise + optional revisions). */
export function alertChain(
  summaries: readonly AlertFindingSummary[],
  policy: SealedEscalationPolicy = sealedPolicy(),
): readonly SealedAlertRecord[] {
  let chain: readonly SealedAlertRecord[] = [];
  for (const summary of summaries) {
    const outcome = unwrap(
      raiseAlert(chain, {
        alertId: 'alert:planned-vs-actual-activity-activity-excavate',
        tenantId: TENANT,
        summary,
        policy,
        raisedAt: T3,
        raisedBy: PRINCIPAL,
      }),
    );
    if (outcome.admission === 'raised') {
      chain = [...chain, outcome.alert];
    }
  }
  return chain;
}
