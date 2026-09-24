// Composition tests: deny-overrides, penalty sums, fail-closed rejections,
// and totality over malformed entries.
import { describe, expect, it } from 'vitest';
import { compileConstraint, composeConstraintEvaluations, evaluateConstraint } from '../src';
import type { CompiledConstraint } from '../src';

function compiledFixture(options?: { class?: 'hard' | 'soft'; id?: string; weight?: number }): CompiledConstraint {
  const authored = {
    languageVersion: '1.0.0',
    id: options?.id ?? 'compose-fixture',
    version: '1.0.0',
    inputs: [{ name: 'x', type: 'number' }],
    ...(options?.class === 'soft'
      ? {
          class: 'soft',
          predicate: { node: 'lt', left: { node: 'input', name: 'x' }, right: { node: 'lit', type: 'number', value: 10 } },
          weight: options?.weight ?? 3,
        }
      : {
          class: 'hard',
          predicate: { node: 'lt', left: { node: 'input', name: 'x' }, right: { node: 'lit', type: 'number', value: 10 } },
        }),
  };
  const outcome = compileConstraint(authored);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors));
  return outcome.compiled;
}

const ctx = (x: number) => ({ inputs: { x } });

describe('composeConstraintEvaluations (positive)', () => {
  it('an empty composition is not-applicable', () => {
    const outcome = composeConstraintEvaluations([]);
    expect(outcome).toMatchObject({ ok: true, decision: { decision: 'not-applicable' } });
  });

  it('all satisfied yields allow', () => {
    const outcomes = [
      evaluateConstraint(compiledFixture({ id: 'a' }), ctx(1)),
      evaluateConstraint(compiledFixture({ id: 'b' }), ctx(2)),
    ];
    const outcome = composeConstraintEvaluations(outcomes);
    expect(outcome).toMatchObject({
      ok: true,
      decision: { decision: 'allow', totalPenalty: 0, counts: { satisfied: 2, violated: 0 } },
    });
  });

  it('soft violations sum penalties without blocking (allow-with-penalties)', () => {
    const outcomes = [
      evaluateConstraint(compiledFixture({ class: 'soft', id: 's1', weight: 2 }), ctx(50)),
      evaluateConstraint(compiledFixture({ class: 'soft', id: 's2', weight: 5 }), ctx(99)),
      evaluateConstraint(compiledFixture({ id: 'h1' }), ctx(1)),
    ];
    const outcome = composeConstraintEvaluations(outcomes);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.issues));
    expect(outcome.decision.decision).toBe('allow-with-penalties');
    expect(outcome.decision.totalPenalty).toBe(7);
    expect(outcome.decision.blocking).toEqual([]);
    expect(outcome.decision.violated.map((v) => v.constraintId).sort()).toEqual(['s1', 's2']);
  });

  it('hard violations block (deny-overrides beats penalties)', () => {
    const outcomes = [
      evaluateConstraint(compiledFixture({ class: 'soft', id: 's1', weight: 9 }), ctx(50)),
      evaluateConstraint(compiledFixture({ id: 'h1' }), ctx(50)),
    ];
    const outcome = composeConstraintEvaluations(outcomes);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.issues));
    expect(outcome.decision.decision).toBe('block');
    expect(outcome.decision.totalPenalty).toBe(9);
    expect(outcome.decision.blocking.map((b) => b.constraintId)).toEqual(['h1']);
  });

  it('not-applicable results are counted but contribute nothing', () => {
    const authored = {
      languageVersion: '1.0.0',
      id: 'guarded',
      version: '1.0.0',
      inputs: [
        { name: 'x', type: 'number' },
        { name: 'region', type: 'enum', values: ['eu', 'us'] },
      ],
      class: 'hard',
      predicate: { node: 'lt', left: { node: 'input', name: 'x' }, right: { node: 'lit', type: 'number', value: 10 } },
      appliesWhen: { node: 'eq', left: { node: 'input', name: 'region' }, right: { node: 'lit', type: 'string', value: 'eu' } },
    };
    const compiled = compileConstraint(authored);
    if (!compiled.ok) throw new Error('fixture');
    const outcomes = [
      evaluateConstraint(compiled.compiled, { inputs: { x: 99, region: 'us' } }),
    ];
    const outcome = composeConstraintEvaluations(outcomes);
    expect(outcome).toMatchObject({
      ok: true,
      decision: { decision: 'allow', counts: { notApplicable: 1, satisfied: 0, violated: 0 } },
    });
  });

  it('evaluation rejections block (fail-closed composition)', () => {
    const rejected = evaluateConstraint(compiledFixture({ id: 'r1' }), { inputs: { wrong: true } });
    const outcome = composeConstraintEvaluations([rejected]);
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.issues));
    expect(outcome.decision.decision).toBe('block');
    expect(outcome.decision.reasons).toEqual(['evaluation-rejected:invalid-context']);
  });
});

describe('composeConstraintEvaluations (negative: malformed input rejected)', () => {
  it('rejects non-array input', () => {
    const outcome = composeConstraintEvaluations({ nope: true });
    expect(outcome.ok).toBe(false);
  });

  it('rejects malformed evaluation entries with typed issues', () => {
    const outcome = composeConstraintEvaluations([{ ok: true, result: null }, 42, 'nope']);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.issues.length).toBe(3);
    expect(outcome.issues[0].path.startsWith('$.evaluations[0]')).toBe(true);
  });

  it('never throws on garbage', () => {
    const garbage: unknown[] = [null, undefined, 42, [[]], [{ ok: 'yes' }]];
    for (const value of garbage) {
      expect(() => composeConstraintEvaluations(value)).not.toThrow();
    }
  });
});
