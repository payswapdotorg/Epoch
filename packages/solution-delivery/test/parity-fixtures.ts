// Shared fixtures for the runtime parity tests — a W006-shaped evidence
// record (the same grammar the marketplace trust-evidence mirror uses),
// built as loose JSON so it validates through the REAL @epoch/evidence
// validator.
export const T1 = '2026-02-10T09:00:01.000Z';
export const TENANT = 'tenant:globex';

const ZERO_DIGEST = '0'.repeat(64);

/** One W006-shaped evidence record as loose JSON. */
export function trustEvidenceLike(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: 'measurement',
    subject: {
      artifactId: 'engineering.stress-analysis',
      revision: '1.2.3',
      digest: ZERO_DIGEST,
    },
    producedBy: {
      runId: 'run:nightly-2026-02-09',
      actorId: 'principal:verifier-bot',
      methodId: 'method:suite-regression',
    },
    observedAt: T1,
    content: {
      mediaType: 'application/json',
      data: { passed: true, checks: 42 },
    },
    confidence: {
      distribution: { kind: 'point', value: 1 },
      method: 'stated',
      rationale: 'deterministic regression suite',
    },
  };
}

/** One valid uncertainty state (loose JSON). */
export function uncertainty(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    provenance: { kind: 'observed', sourceRef: 'source:field-report' },
    freshness: { state: 'fresh', assessedAt: T1 },
    confidence: { method: 'stated', value: 0.9 },
  };
}
