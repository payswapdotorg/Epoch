// W002 alignment: the evidence confidence model must be structurally
// identical to the W002 world-model confidence model so uncertainty travels
// losslessly between evidence records and world-model assertions where they
// meet. The compile-time half lives in test/w002-parity.types.ts; this file
// proves the runtime half: both validators accept the same fixtures and
// reject the same corruptions.
import { describe, expect, it } from 'vitest';
import { ConfidenceSchema as WorldConfidenceSchema } from '@epoch/world-model';
import { ConfidenceSchema as EvidenceConfidenceSchema, EVIDENCE_KINDS } from '../src/index';

const SHARED_FIXTURES: Record<string, unknown>[] = [
  { distribution: { kind: 'point', value: 1 }, method: 'stated', rationale: 'deterministic' },
  { distribution: { kind: 'point', value: 0.25 } },
  { distribution: { kind: 'interval', lower: 0.4, upper: 0.9, bias: 'low' }, method: 'estimated' },
  { distribution: { kind: 'interval', lower: 0.1, upper: 0.2 } },
  { distribution: { kind: 'set', values: [0.2, 0.5, 0.3] } },
  { distribution: { kind: 'set', values: [0.2, 0.8], weights: [1, 3] }, method: 'derived' },
];

const SHARED_CORRUPTIONS: Record<string, unknown>[] = [
  { distribution: { kind: 'point', value: 1.5 } },
  { distribution: { kind: 'interval', lower: 0.9, upper: 0.4 } },
  { distribution: { kind: 'set', values: [0.2, 0.8], weights: [1] } },
  { distribution: { kind: 'bell-curve' } },
  { distribution: { kind: 'point', value: 0.5 }, method: 'guessed' },
  { distribution: { kind: 'point', value: 0.5 }, vendor: 'acme' },
];

describe('W002 world-model confidence alignment', () => {
  it('the world-model validator accepts every evidence confidence fixture', () => {
    for (const [index, fixture] of SHARED_FIXTURES.entries()) {
      expect(WorldConfidenceSchema.safeParse(fixture).success, `fixture ${index}`).toBe(true);
    }
  });

  it('the evidence validator accepts every W002-shaped confidence fixture', () => {
    for (const [index, fixture] of SHARED_FIXTURES.entries()) {
      expect(EvidenceConfidenceSchema.safeParse(fixture).success, `fixture ${index}`).toBe(true);
    }
  });

  it('both validators reject the same corruptions (boundary discipline)', () => {
    for (const [index, corruption] of SHARED_CORRUPTIONS.entries()) {
      expect(EvidenceConfidenceSchema.safeParse(corruption).success, `evidence ${index}`).toBe(false);
      expect(WorldConfidenceSchema.safeParse(corruption).success, `world ${index}`).toBe(false);
    }
  });

  it('the evidence kind vocabulary equals the W002 world-model EvidenceKind set', () => {
    // The world-model EvidenceRef kind enum (schema/provenance.ts, W002) is:
    // document | measurement | observation | computation | assertion | external | other
    expect([...EVIDENCE_KINDS].sort()).toEqual(
      [...EVIDENCE_KINDS].sort(),
    );
    expect(EVIDENCE_KINDS).toContain('document');
    expect(EVIDENCE_KINDS).toContain('measurement');
    expect(EVIDENCE_KINDS).toContain('observation');
    expect(EVIDENCE_KINDS).toContain('computation');
    expect(EVIDENCE_KINDS).toContain('assertion');
    expect(EVIDENCE_KINDS).toContain('external');
    expect(EVIDENCE_KINDS).toContain('other');
    expect(EVIDENCE_KINDS).toHaveLength(7);
  });
});
