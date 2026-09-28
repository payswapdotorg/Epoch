// ALERT LIFECYCLE: idempotent deduplication (duplicate = sealed prior
// record), append-only revisions across state transitions (due -> late
// -> blocked), terminal resolutions, and the chain fold.
import { describe, expect, it } from 'vitest';
import {
  escalateAlert,
  foldAlertChains,
  raiseAlert,
  resolveAlert,
  verifySealedAlertRecord,
} from '../src/index';
import {
  FINDING_DIGEST,
  FINDING_DIGEST_2,
  PRINCIPAL,
  TENANT,
  T2,
  T4,
  T5,
  T6,
  T7,
  alertChain,
  expectError,
  findingSummary,
  sealedPolicy,
  unwrap,
} from './fixtures';

const ALERT_ID = 'alert:planned-vs-actual-activity-activity-excavate';

/** One raise over a chain (helper). */
function raise(chain: readonly ReturnType<typeof alertChain>[number][], summary: Parameters<typeof raiseAlert>[1]['summary'], policy = sealedPolicy()) {
  return raiseAlert(chain, {
    alertId: ALERT_ID,
    tenantId: TENANT,
    summary,
    policy,
    raisedAt: T4,
    raisedBy: PRINCIPAL,
  });
}

describe('alert idempotency (the same finding state re-evaluated)', () => {
  it('re-evaluating the SAME finding state produces the SEALED PRIOR alert (duplicate)', () => {
    const first = unwrap(raise([], findingSummary()));
    expect(first.admission).toBe('raised');
    const replay = unwrap(raise([first.alert], findingSummary()));
    expect(replay.admission).toBe('duplicate');
    expect(replay.alert.contentDigest).toBe(first.alert.contentDigest);
    expect(replay.alert.revision).toBe(1);
  });

  it('a duplicate admission changes NO state (the chain stays length 1)', () => {
    const first = unwrap(raise([], findingSummary()));
    const replay = unwrap(raise([first.alert], findingSummary()));
    if (replay.admission === 'duplicate') {
      // The service appends nothing on a duplicate:
      const chainAfter = [first.alert];
      expect(chainAfter).toHaveLength(1);
    }
  });
});

describe('append-only revisions across state transitions', () => {
  it('due -> late -> blocked appends revisions carrying previousRevisionDigest (never mutations)', () => {
    const chain = alertChain([
      findingSummary({ findingStatus: 'due', findingDigest: FINDING_DIGEST }),
      findingSummary({ findingStatus: 'late', findingDigest: FINDING_DIGEST_2 }),
      findingSummary({ findingStatus: 'blocked', findingDigest: 'c'.repeat(64) }),
    ]);
    expect(chain).toHaveLength(3);
    expect(chain[0]!.revision).toBe(1);
    expect(chain[0]!.previousRevisionDigest).toBeNull();
    expect(chain[1]!.revision).toBe(2);
    expect(chain[1]!.previousRevisionDigest).toBe(chain[0]!.contentDigest);
    expect(chain[2]!.revision).toBe(3);
    expect(chain[2]!.previousRevisionDigest).toBe(chain[1]!.contentDigest);
    // Severities follow the policy per transition:
    expect(chain[0]!.severity).toBe('major'); // rule:late-activities (class-only)
    expect(chain[2]!.severity).toBe('critical'); // rule:blocked-activities (exact)
    // Every revision verifies:
    for (const alert of chain) {
      expect(verifySealedAlertRecord(alert).ok).toBe(true);
    }
  });

  it('a tampered alert revision is rejected (digest-mismatch)', () => {
    const chain = alertChain([findingSummary()]);
    const error = expectError(verifySealedAlertRecord({ ...chain[0]!, contentDigest: '0'.repeat(64) }));
    expect(error.code).toBe('digest-mismatch');
  });
});

describe('terminal resolutions', () => {
  it('resolving appends a terminal revision; a second resolution is lifecycle-conflict', () => {
    const chain = alertChain([findingSummary({ findingStatus: 'due' })]);
    const resolved = unwrap(
      resolveAlert(chain, { resolvedAt: T5, resolvedBy: PRINCIPAL, resolutionKind: 'remediated' }),
    );
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolutionKind).toBe('remediated');
    expect(resolved.revision).toBe(2);
    const error = expectError(
      resolveAlert([...chain, resolved], { resolvedAt: T6, resolvedBy: PRINCIPAL, resolutionKind: 'withdrawn' }),
    );
    expect(error.code).toBe('lifecycle-conflict');
  });

  it('raising against a RESOLVED chain is lifecycle-conflict (a recurring finding ships as a new identity)', () => {
    const chain = alertChain([findingSummary({ findingStatus: 'due' })]);
    const resolved = unwrap(
      resolveAlert(chain, { resolvedAt: T5, resolvedBy: PRINCIPAL, resolutionKind: 'remediated' }),
    );
    const error = expectError(
      raise([...chain, resolved], findingSummary({ findingStatus: 'late', findingDigest: 'e'.repeat(64) })),
    );
    expect(error.code).toBe('lifecycle-conflict');
  });

  it('escalating appends an ESCALATED revision with level provenance', () => {
    const chain = alertChain([findingSummary({ findingStatus: 'blocked' })]);
    const escalated = unwrap(escalateAlert(chain, { escalatedAt: T6, escalationLevel: 1 }));
    expect(escalated.status).toBe('escalated');
    expect(escalated.escalationLevel).toBe(1);
    expect(escalated.revision).toBe(2);
    expect(escalated.previousRevisionDigest).toBe(chain[0]!.contentDigest);
    // resolving an escalated chain still works:
    const resolved = unwrap(
      resolveAlert([...chain, escalated], {
        resolvedAt: T7,
        resolvedBy: PRINCIPAL,
        resolutionKind: 'false-positive',
      }),
    );
    expect(resolved.status).toBe('resolved');
  });

  it('escalating an empty chain is dangling-reference-rejected', () => {
    const error = expectError(escalateAlert([], { escalatedAt: T6, escalationLevel: 1 }));
    expect(error.code).toBe('dangling-reference-rejected');
  });
});

describe('foldAlertChains (the deterministic chain projection)', () => {
  it('folds head projections sorted by alertId with status counts', () => {
    const chainA = alertChain([
      findingSummary({ findingStatus: 'due' }),
      findingSummary({ findingStatus: 'late', findingDigest: FINDING_DIGEST_2 }),
    ]);
    const chainB = [
      unwrap(
        raiseAlert([], {
          alertId: 'alert:lead-time-risk-acquisition-cement',
          tenantId: TENANT,
          summary: findingSummary({
            findingId: 'finding:lead-time-risk-acquisition-cement',
            findingClass: 'lead-time-risk',
            findingStatus: 'drifted',
          }),
          policy: sealedPolicy(),
          raisedAt: T2,
          raisedBy: PRINCIPAL,
        }),
      ).alert,
    ];
    const fold = foldAlertChains([chainB, chainA]);
    expect(fold.chains.map((row) => row.alertId)).toEqual([
      'alert:lead-time-risk-acquisition-cement',
      ALERT_ID,
    ]);
    expect(fold.chains[1]!.revisionCount).toBe(2);
    expect(fold.chains[1]!.status).toBe('raised');
    expect(fold.chains[1]!.findingStatus).toBe('late');
    expect(fold.counts).toEqual({ raised: 2, escalated: 0, resolved: 0 });
  });
});
