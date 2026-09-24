// Shared fixtures for the evidence tests. Builders return loose JSON
// objects so negative tests can freely corrupt single fields.
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';

export const T0 = '2025-06-01T08:00:00.000Z';
export const T1 = '2025-06-01T09:30:00.000Z';
export const T2 = '2025-06-01T11:00:00.000Z';

/** A small JSON artifact whose exact-revision digest tests can compute. */
export const ARTIFACT_R3: JsonValue = {
  report: 'structural-analysis',
  revision: 3,
  checks: [{ name: 'deflection', value: 4.2, unit: 'mm' }],
};

/** Digest of the exact artifact revision above. */
export const ARTIFACT_R3_DIGEST = canonicalDigest(ARTIFACT_R3);

/** A different revision of the same artifact (different content). */
export const ARTIFACT_R4: JsonValue = {
  report: 'structural-analysis',
  revision: 4,
  checks: [{ name: 'deflection', value: 3.9, unit: 'mm' }],
};

export const ARTIFACT_R4_DIGEST = canonicalDigest(ARTIFACT_R4);

/** Full valid evidence record as a loose JSON object. */
export function evidenceRecord(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: 'measurement',
    subject: {
      artifactId: 'artifact:structural-report',
      revision: 'r3',
      digest: ARTIFACT_R3_DIGEST,
    },
    producedBy: {
      runId: 'run:stress-check-1',
      actorId: 'actor:solver-01',
      methodId: 'method:deflection-check',
    },
    observedAt: T1,
    content: {
      mediaType: 'application/json',
      data: { deflectionMm: 4.2, withinLimit: true },
    },
    confidence: {
      distribution: { kind: 'interval', lower: 0.9, upper: 0.98, bias: 'none' },
      method: 'measured',
      rationale: 'sensor calibration ±0.02mm',
    },
    ...overrides,
  };
}

/** Point-confidence fixture for exact/deterministic evidence. */
export const CERTAIN: Record<string, unknown> = {
  distribution: { kind: 'point', value: 1 },
  method: 'stated',
  rationale: 'deterministic recomputation',
};
