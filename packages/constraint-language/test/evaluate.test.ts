// Reference-evaluator positive tests: per-class violation semantics, result
// details, not-applicability, and serializability of results.
import { describe, expect, it } from 'vitest';
import { compileConstraint, evaluateConstraint, evaluationResultSchema } from '../src';
import type { CompiledConstraint } from '../src';
import {
  authorityConstraint,
  epistemicConstraint,
  hardConstraint,
  resourceConstraint,
  safetyConstraint,
  softConstraint,
} from './helpers';

function compiledOf(authored: unknown): CompiledConstraint {
  const outcome = compileConstraint(authored);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors));
  return outcome.compiled;
}

function resultOf(authored: unknown, inputs: Record<string, unknown>) {
  const outcome = evaluateConstraint(compiledOf(authored), { inputs });
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.issues));
  return outcome.result;
}

describe('evaluateConstraint (positive: per-class semantics)', () => {
  it('hard: violation blocks, satisfaction does not', () => {
    const violated = resultOf(hardConstraint, { pressure: 11, region: 'eu' });
    expect(violated.outcome).toBe('violated');
    expect(violated.effect).toBe('block');
    expect(violated.violated).toBe(true);
    expect(violated.details).toEqual({ class: 'hard', severity: 'critical' });

    const satisfied = resultOf(hardConstraint, { pressure: 9.9, region: 'eu' });
    expect(satisfied.outcome).toBe('satisfied');
    expect(satisfied.effect).toBe('none');
    expect(satisfied.violated).toBe(false);
    expect(satisfied.penalty).toBe(0);
  });

  it('safety: violation blocks with regulation references', () => {
    const violated = resultOf(safetyConstraint, { guardrailMounted: false });
    expect(violated.outcome).toBe('violated');
    expect(violated.effect).toBe('block');
    expect(violated.details).toEqual({
      class: 'safety',
      regulations: ['OSHA-1926.501', 'EN-ISO-14122'],
    });
    expect(violated.message).toContain('OSHA-1926.501');

    const satisfied = resultOf(safetyConstraint, { guardrailMounted: true });
    expect(satisfied.effect).toBe('none');
  });

  it('soft: violation penalizes with the authored weight, never blocks', () => {
    const violated = resultOf(softConstraint, { cost: 150 });
    expect(violated.outcome).toBe('violated');
    expect(violated.effect).toBe('penalize');
    expect(violated.penalty).toBe(5);
    expect(violated.details).toEqual({ class: 'soft', weight: 5 });

    const satisfied = resultOf(softConstraint, { cost: 42 });
    expect(satisfied.effect).toBe('none');
    expect(satisfied.penalty).toBe(0);
  });

  it('resource: usage over limit blocks and reports budget details', () => {
    const violated = resultOf(resourceConstraint, { spent: 12, cap: 10 });
    expect(violated.outcome).toBe('violated');
    expect(violated.effect).toBe('block');
    expect(violated.details).toEqual({
      class: 'resource',
      unit: 'hours',
      usage: 12,
      limit: 10,
      remaining: -2,
    });
    expect(violated.message).toContain('usage 12 exceeds limit 10 hours');

    const satisfied = resultOf(resourceConstraint, { spent: 3, cap: 10 });
    expect(satisfied.outcome).toBe('satisfied');
    expect(satisfied.details).toMatchObject({ remaining: 7 });
  });

  it('resource: runtime non-finite computations normalize to null details', () => {
    const authored = {
      ...resourceConstraint,
      usage: { node: 'div', left: { node: 'input', name: 'spent' }, right: { node: 'input', name: 'cap' } },
    };
    const outcome = evaluateConstraint(compiledOf(authored), { inputs: { spent: 8, cap: 0 } });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // usage = 8/0 = +Infinity > limit 0 -> violated (IEEE), usage is non-finite.
    expect(outcome.result.outcome).toBe('violated');
    expect(outcome.result.details).toEqual({
      class: 'resource',
      unit: 'hours',
      usage: null,
      limit: 0,
      remaining: null,
    });
  });

  it('epistemic: confidence shortfall blocks with threshold details', () => {
    const violated = resultOf(epistemicConstraint, {
      confidence: 0.4,
      evidence: { measurement: 5, certification: 2 },
    });
    expect(violated.outcome).toBe('violated');
    expect(violated.effect).toBe('block');
    expect(violated.details).toEqual({
      class: 'epistemic',
      confidence: 0.4,
      threshold: 0.8,
      evidence: [
        { kind: 'measurement', required: 2, actual: 5 },
        { kind: 'certification', required: 1, actual: 2 },
      ],
    });
    expect(violated.message).toContain('confidence 0.4 below threshold 0.8');
  });

  it('epistemic: missing evidence blocks with per-kind actual/required counts', () => {
    const violated = resultOf(epistemicConstraint, {
      confidence: 0.95,
      evidence: { measurement: 1 },
    });
    expect(violated.outcome).toBe('violated');
    expect(violated.details).toMatchObject({
      confidence: 0.95,
      threshold: 0.8,
      evidence: [
        { kind: 'measurement', required: 2, actual: 1 },
        { kind: 'certification', required: 1, actual: 0 },
      ],
    });
    expect(violated.message).toContain('measurement (1 of 2)');
    expect(violated.message).toContain('certification (0 of 1)');

    const satisfied = resultOf(epistemicConstraint, {
      confidence: 0.95,
      evidence: { measurement: 2, certification: 1 },
    });
    expect(satisfied.outcome).toBe('satisfied');
  });

  it('authority: missing allOf permission blocks and reports exactly what is missing', () => {
    const violated = resultOf(authorityConstraint, {
      permissions: ['approval:safety'],
    });
    expect(violated.outcome).toBe('violated');
    expect(violated.effect).toBe('block');
    expect(violated.details).toEqual({
      class: 'authority',
      allOf: ['deploy:prod'],
      anyOf: ['approval:safety', 'approval:exec'],
      missing: ['deploy:prod'],
      matchedAnyOf: 'approval:safety',
    });
    expect(violated.message).toContain('missing permissions: [deploy:prod]');
  });

  it('authority: anyOf satisfied by any single grant', () => {
    const satisfied = resultOf(authorityConstraint, {
      permissions: ['deploy:prod', 'approval:exec'],
    });
    expect(satisfied.outcome).toBe('satisfied');
    expect(satisfied.details).toMatchObject({ matchedAnyOf: 'approval:exec' });

    const denied = resultOf(authorityConstraint, {
      permissions: ['deploy:prod'],
    });
    expect(denied.outcome).toBe('violated');
    expect(denied.details).toMatchObject({ matchedAnyOf: null });
  });

  it('appliesWhen=false produces not-applicable with no computed details', () => {
    const notApplicable = resultOf(hardConstraint, { pressure: 99, region: 'us' });
    expect(notApplicable.outcome).toBe('not-applicable');
    expect(notApplicable.effect).toBe('none');
    expect(notApplicable.violated).toBe(false);
    expect(notApplicable.message).toContain('not applicable');

    const applicable = resultOf(hardConstraint, { pressure: 99, region: 'eu' });
    expect(applicable.outcome).toBe('violated');
  });

  it('enum inputs enforce their value set at the context boundary', () => {
    const outcome = evaluateConstraint(compiledOf(hardConstraint), {
      inputs: { pressure: 1, region: 'apac' },
    });
    expect(outcome).toMatchObject({ ok: false, kind: 'invalid-context' });
  });
});

describe('evaluateConstraint (positive: expression semantics)', () => {
  const predicateOf = (predicate: unknown) => ({
    languageVersion: '1.0.0',
    id: 'expr-probe',
    version: '1.0.0',
    inputs: [
      { name: 'n', type: 'number' },
      { name: 's', type: 'string' },
      { name: 'b', type: 'boolean' },
      { name: 'r', type: 'record' },
      { name: 'l', type: 'list' },
    ],
    class: 'hard',
    predicate,
  });

  const baseInputs = { n: 1, s: 'x', b: true, r: {} as Record<string, number>, l: [] as string[] };

  const cases: Array<[string, unknown, Record<string, unknown>, boolean]> = [
    ['and', { node: 'and', operands: [{ node: 'input', name: 'b' }, { node: 'not', operand: { node: 'input', name: 'b' } }] }, { b: true }, false],
    ['or', { node: 'or', operands: [{ node: 'input', name: 'b' }, { node: 'not', operand: { node: 'input', name: 'b' } }] }, { b: true }, true],
    ['implies', { node: 'implies', antecedent: { node: 'input', name: 'b' }, consequent: { node: 'input', name: 'b' } }, { b: false }, true],
    ['has (present)', { node: 'has', record: { node: 'input', name: 'r' }, key: 'k' }, { r: { k: 1 } }, true],
    ['has (absent)', { node: 'has', record: { node: 'input', name: 'r' }, key: 'k' }, { r: {} }, false],
    ['get (present)', { node: 'gt', left: { node: 'get', record: { node: 'input', name: 'r' }, key: 'k', fallback: { node: 'lit', type: 'number', value: 0 } }, right: { node: 'lit', type: 'number', value: 0 } }, { r: { k: 5 } }, true],
    ['get (fallback)', { node: 'gt', left: { node: 'get', record: { node: 'input', name: 'r' }, key: 'k', fallback: { node: 'lit', type: 'number', value: 42 } }, right: { node: 'lit', type: 'number', value: 0 } }, { r: {} }, true],
    ['count', { node: 'gt', left: { node: 'count', list: { node: 'input', name: 'l' } }, right: { node: 'lit', type: 'number', value: 2 } }, { l: ['a', 'b', 'c'] }, true],
    ['contains', { node: 'contains', list: { node: 'input', name: 'l' }, value: 'b' }, { l: ['a', 'b'] }, true],
    ['eq strings', { node: 'eq', left: { node: 'input', name: 's' }, right: { node: 'lit', type: 'string', value: 'x' } }, { s: 'x' }, true],
  ];

  it.each(cases)('%s evaluates correctly', (_name, predicate, partialInputs, expectedSatisfied) => {
    const result = resultOf(predicateOf(predicate), { ...baseInputs, ...partialInputs });
    expect(result.outcome).toBe(expectedSatisfied ? 'satisfied' : 'violated');
  });

  it('NaN-producing division yields deterministic false comparisons (totality)', () => {
    // div(0, x) with x=0 -> NaN; NaN < 1 is false -> predicate holds -> satisfied.
    const result = resultOf(
      predicateOf({
        node: 'not',
        operand: {
          node: 'gt',
          left: { node: 'div', left: { node: 'lit', type: 'number', value: 0 }, right: { node: 'input', name: 'n' } },
          right: { node: 'lit', type: 'number', value: 1 },
        },
      }),
      { ...baseInputs, n: 0 },
    );
    expect(result.outcome).toBe('satisfied');
  });
});

describe('evaluateConstraint (positive: results are serializable)', () => {
  it('results round-trip through their schema and JSON', () => {
    const result = resultOf(epistemicConstraint, { confidence: 0.5, evidence: {} });
    expect(evaluationResultSchema.safeParse(result).success).toBe(true);
    const json = JSON.parse(JSON.stringify(result));
    expect(evaluationResultSchema.safeParse(json).success).toBe(true);
    expect(json.evaluationDigest).toBe(result.evaluationDigest);
  });
});
