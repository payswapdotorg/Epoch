// Compiler positive tests: every class compiles to the deterministic form with
// the correct violation root, constant folding applies, and compilation is
// digest-stable.
import { describe, expect, it } from 'vitest';
import { compileConstraint, compiledConstraintSchema } from '../src';
import type { AuthoredConstraint, CompiledConstraint } from '../src';
import {
  authorityConstraint,
  epistemicConstraint,
  hardConstraint,
  resourceConstraint,
  safetyConstraint,
  softConstraint,
} from './helpers';

function compileOk(authored: unknown): CompiledConstraint {
  const outcome = compileConstraint(authored);
  expect(outcome.ok, JSON.stringify(outcome)).toBe(true);
  if (outcome.ok) return outcome.compiled;
  throw new Error('unreachable');
}

describe('compileConstraint (positive)', () => {
  it.each([
    ['hard', hardConstraint],
    ['soft', softConstraint],
    ['resource', resourceConstraint],
    ['safety', safetyConstraint],
    ['epistemic', epistemicConstraint],
    ['authority', authorityConstraint],
  ])('compiles a %s constraint', (_kind, authored) => {
    const compiled = compileOk(authored);
    expect(compiled.root.resultType).toBe('boolean');
    expect(compiled.compiler).toEqual({ name: 'epoch-ecl-compiler', version: '1.0.0' });
    expect(compiled.compiledDigest).toMatch(/^[0-9a-f]{8}$/);
    // The compiled artifact itself validates against the published schema.
    expect(compiledConstraintSchema.safeParse(compiled).success).toBe(true);
    // Input declarations are echoed.
    expect(compiled.inputs).toEqual((authored as AuthoredConstraint).inputs);
  });

  it('wraps predicates in a negated violation root for predicate classes', () => {
    const compiled = compileOk(hardConstraint);
    expect(compiled.root.node).toBe('not');
    if (compiled.root.node !== 'not') return;
    expect(compiled.root.operand.node).toBe('lt');
  });

  it('builds a gt(usage, limit) violation root for resource constraints', () => {
    const compiled = compileOk(resourceConstraint);
    expect(compiled.root.node).toBe('gt');
  });

  it('compiles appliesWhen alongside the root', () => {
    const compiled = compileOk(hardConstraint);
    expect(compiled.appliesWhen).toBeDefined();
    expect(compiled.appliesWhen?.resultType).toBe('boolean');
  });

  it('echoes severity, tags and safety regulations into the compiled form', () => {
    expect(compileOk(hardConstraint).severity).toBe('critical');
    expect(compileOk(hardConstraint).tags).toEqual(['physics']);
    expect(compileOk(safetyConstraint).payload).toMatchObject({
      class: 'safety',
      regulations: ['OSHA-1926.501', 'EN-ISO-14122'],
    });
  });

  it('constant-folds fully-literal subtrees', () => {
    const authored: AuthoredConstraint = {
      languageVersion: '1.0.0',
      id: 'folding-check',
      version: '1.0.0',
      inputs: [{ name: 'x', type: 'number' }],
      class: 'hard',
      predicate: {
        node: 'lt',
        left: { node: 'input', name: 'x' },
        right: { node: 'add', operands: [
          { node: 'lit', type: 'number', value: 1 },
          { node: 'mul', operands: [
            { node: 'lit', type: 'number', value: 2 },
            { node: 'lit', type: 'number', value: 3 },
          ] },
        ] },
      },
    };
    const compiled = compileOk(authored);
    // not(lt(x, add(1, mul(2,3)))) -> not(lt(x, 7))
    expect(compiled.root.node).toBe('not');
    if (compiled.root.node !== 'not') return;
    const comparison = compiled.root.operand;
    expect(comparison.node).toBe('lt');
    if (comparison.node !== 'lt') return;
    expect(comparison.right).toMatchObject({ node: 'lit', type: 'number', value: 7, resultType: 'number' });
  });

  it('folds boolean and comparison literals', () => {
    const authored: AuthoredConstraint = {
      languageVersion: '1.0.0',
      id: 'bool-folding',
      version: '1.0.0',
      inputs: [{ name: 'x', type: 'number' }],
      class: 'hard',
      predicate: {
        node: 'and',
        operands: [
          { node: 'implies', antecedent: { node: 'lit', type: 'boolean', value: false }, consequent: { node: 'lit', type: 'boolean', value: true } },
          { node: 'lt', left: { node: 'input', name: 'x' }, right: { node: 'lit', type: 'number', value: 1 } },
        ],
      },
    };
    const compiled = compileOk(authored);
    // implies(false, true) folds to the literal true; the and() node keeps the
    // non-literal comparison operand, so the fold stops there.
    expect(compiled.root.node).toBe('not');
    if (compiled.root.node !== 'not') return;
    expect(compiled.root.operand.node).toBe('and');
    if (compiled.root.operand.node !== 'and') return;
    expect(compiled.root.operand.operands[0]).toMatchObject({
      node: 'lit',
      type: 'boolean',
      value: true,
    });
    expect(compiled.root.operand.operands[1].node).toBe('lt');
  });

  it('produces identical artifacts and digests for identical authored forms', () => {
    const first = compileOk(hardConstraint);
    const second = compileOk(JSON.parse(JSON.stringify(hardConstraint)));
    expect(first).toEqual(second);
    expect(first.compiledDigest).toBe(second.compiledDigest);
  });

  it('produces different digests for different authored forms', () => {
    const a = compileOk(hardConstraint);
    const modified = { ...(hardConstraint as Record<string, unknown>) } as Record<string, unknown>;
    modified.severity = 'minor';
    const b = compileOk(modified);
    expect(a.compiledDigest).not.toBe(b.compiledDigest);
  });

  it('stamps annotations on every compiled node', () => {
    const compiled = compileOk(resourceConstraint);
    expect(compiled.root.resultType).toBe('boolean');
    if (compiled.root.node !== 'gt') return;
    expect(compiled.root.left.resultType).toBe('number');
    expect(compiled.payload.class).toBe('resource');
    if (compiled.payload.class !== 'resource') return;
    expect(compiled.payload.usage.resultType).toBe('number');
    expect(compiled.payload.limit.resultType).toBe('number');
  });
});
