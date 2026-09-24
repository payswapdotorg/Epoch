// Reference-evaluator negative tests: tampered compiled artifacts (digest
// mismatch), schema-invalid compiled forms, evaluation-context schema
// violations, and totality over arbitrary garbage. These are the
// authority/security boundary tests for the evaluation contract.
import { describe, expect, it } from 'vitest';
import { compileConstraint, evaluateConstraint } from '../src';
import type { CompiledConstraint } from '../src';
import {
  authorityConstraint,
  hardConstraint,
  softConstraint,
} from './helpers';

function compiledOf(authored: unknown): CompiledConstraint {
  const outcome = compileConstraint(authored);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors));
  return outcome.compiled;
}

describe('evaluateConstraint (negative: compiled artifact integrity)', () => {
  it('rejects a compiled constraint whose digest does not match its content (tamper detection)', () => {
    const compiled = compiledOf(hardConstraint);
    const tampered = JSON.parse(JSON.stringify(compiled)) as CompiledConstraint;
    // Schema-valid tamper: change a limit literal after compilation.
    if (tampered.root.node !== 'not') throw new Error('unexpected root');
    if (tampered.root.operand.node !== 'lt') throw new Error('unexpected predicate');
    if (tampered.root.operand.right.node !== 'lit') throw new Error('unexpected literal');
    (tampered.root.operand.right as { value: number }).value = 99;
    const outcome = evaluateConstraint(tampered, { inputs: { pressure: 11, region: 'eu' } });
    expect(outcome).toMatchObject({ ok: false, kind: 'invalid-compiled' });
    if (outcome.ok) return;
    expect(outcome.issues[0].code).toBe('digest-mismatch');
  });

  it('rejects a plainly wrong digest field', () => {
    const compiled = compiledOf(hardConstraint);
    const forged = { ...compiled, compiledDigest: 'deadbeef' };
    const outcome = evaluateConstraint(forged, { inputs: { pressure: 1, region: 'eu' } });
    expect(outcome).toMatchObject({ ok: false, kind: 'invalid-compiled' });
  });

  it('rejects compiled forms with unknown operators', () => {
    const compiled = compiledOf(hardConstraint);
    const mutated = JSON.parse(JSON.stringify(compiled)) as CompiledConstraint;
    if (mutated.root.node !== 'not') throw new Error('unexpected root');
    (mutated.root as { operand: { node: string } }).operand = { node: 'random' };
    const outcome = evaluateConstraint(mutated, { inputs: { pressure: 1, region: 'eu' } });
    expect(outcome).toMatchObject({ ok: false, kind: 'invalid-compiled' });
  });

  it('rejects compiled forms missing required structure', () => {
    const compiled = compiledOf(hardConstraint);
    const withoutRoot: Record<string, unknown> = { ...compiled };
    delete withoutRoot.root;
    expect(evaluateConstraint(withoutRoot, { inputs: { pressure: 1, region: 'eu' } })).toMatchObject({
      ok: false,
      kind: 'invalid-compiled',
    });
    expect(evaluateConstraint(null, { inputs: {} })).toMatchObject({ ok: false, kind: 'invalid-compiled' });
    expect(evaluateConstraint(42, { inputs: {} })).toMatchObject({ ok: false, kind: 'invalid-compiled' });
  });

  it('rejects a compiled form whose compiler stamp is unknown', () => {
    const compiled = compiledOf(hardConstraint);
    const mutated = JSON.parse(JSON.stringify(compiled)) as CompiledConstraint;
    // Simultaneously mutate stamp + digest so only the stamp check fails.
    const forged = {
      ...mutated,
      compiler: { name: 'evil-compiler', version: '9.9.9' },
      compiledDigest: '00000000',
    };
    expect(evaluateConstraint(forged, { inputs: { pressure: 1, region: 'eu' } })).toMatchObject({
      ok: false,
      kind: 'invalid-compiled',
    });
  });
});

describe('evaluateConstraint (negative: evaluation context schema violations)', () => {
  const compiled = compiledOf(hardConstraint);
  const validInputs = { pressure: 5, region: 'eu' };

  it('rejects a missing declared input', () => {
    const outcome = evaluateConstraint(compiled, { inputs: { region: 'eu' } });
    expect(outcome).toMatchObject({ ok: false, kind: 'invalid-context' });
    if (outcome.ok) return;
    expect(outcome.issues.some((issue) => issue.path.includes('pressure'))).toBe(true);
  });

  it('rejects a wrongly-typed input', () => {
    const outcome = evaluateConstraint(compiled, { inputs: { pressure: 'five', region: 'eu' } });
    expect(outcome).toMatchObject({ ok: false, kind: 'invalid-context' });
  });

  it('rejects unknown input keys (typo protection, strict context)', () => {
    const outcome = evaluateConstraint(compiled, { inputs: { pressure: 5, region: 'eu', presure: 5 } });
    expect(outcome).toMatchObject({ ok: false, kind: 'invalid-context' });
  });

  it('rejects NaN and Infinity input values (finite numbers only)', () => {
    expect(evaluateConstraint(compiled, { inputs: { pressure: Number.NaN, region: 'eu' } })).toMatchObject({
      ok: false,
      kind: 'invalid-context',
    });
    expect(
      evaluateConstraint(compiled, { inputs: { pressure: Number.POSITIVE_INFINITY, region: 'eu' } }),
    ).toMatchObject({ ok: false, kind: 'invalid-context' });
  });

  it('rejects a malformed context envelope', () => {
    expect(evaluateConstraint(compiled, null)).toMatchObject({ ok: false, kind: 'invalid-context' });
    expect(evaluateConstraint(compiled, { inputs: 'nope' })).toMatchObject({ ok: false, kind: 'invalid-context' });
    expect(evaluateConstraint(compiled, { inputs: validInputs, extra: true })).toMatchObject({
      ok: false,
      kind: 'invalid-context',
    });
  });

  it('rejects record inputs with non-number values', () => {
    const epistemicish = compiledOf({
      ...hardConstraint,
      id: 'record-check',
      inputs: [
        { name: 'evidence', type: 'record' },
        { name: 'region', type: 'enum', values: ['eu', 'us'] },
      ],
      appliesWhen: { node: 'eq', left: { node: 'input', name: 'region' }, right: { node: 'lit', type: 'string', value: 'eu' } },
      predicate: { node: 'has', record: { node: 'input', name: 'evidence' }, key: 'k' },
    });
    expect(
      evaluateConstraint(epistemicish, { inputs: { evidence: { k: 'not-a-number' }, region: 'eu' } }),
    ).toMatchObject({ ok: false, kind: 'invalid-context' });
  });

  it('rejects list inputs with non-string members', () => {
    const authorityCompiled = compiledOf(authorityConstraint);
    expect(
      evaluateConstraint(authorityCompiled, { inputs: { permissions: ['ok', 7] } }),
    ).toMatchObject({ ok: false, kind: 'invalid-context' });
  });
});

describe('evaluateConstraint (negative: totality over arbitrary garbage)', () => {
  const compiled = compiledOf(softConstraint);

  const garbageContexts: unknown[] = [
    null,
    undefined,
    42,
    'context',
    [],
    {},
    { inputs: null },
    { inputs: [] },
    { inputs: { cost: { deep: { deeper: { deepest: null } } } } },
  ];

  it.each(garbageContexts.map((value, index) => [`garbage context #${index}`, value] as const))(
    'never throws for %s',
    (_name, garbage) => {
      expect(() => evaluateConstraint(compiled, garbage)).not.toThrow();
      const outcome = evaluateConstraint(compiled, garbage);
      expect(outcome.ok).toBe(false);
    },
  );

  const garbageCompiled: unknown[] = [
    null,
    undefined,
    42,
    'compiled',
    [],
    { ok: true },
    { languageVersion: '1.0.0', id: 'x' },
  ];

  it.each(garbageCompiled.map((value, index) => [`garbage compiled #${index}`, value] as const))(
    'never throws for %s',
    (_name, garbage) => {
      expect(() => evaluateConstraint(garbage, { inputs: { cost: 1 } })).not.toThrow();
      const outcome = evaluateConstraint(garbage, { inputs: { cost: 1 } });
      expect(outcome.ok).toBe(false);
    },
  );

  it('never throws for a deep nested context (stack-overflow protection)', () => {
    let deep: unknown = 1;
    for (let i = 0; i < 300; i += 1) {
      deep = { nested: deep };
    }
    expect(() => evaluateConstraint(compiled, { inputs: { cost: deep } })).not.toThrow();
    expect(evaluateConstraint(compiled, { inputs: { cost: deep } }).ok).toBe(false);
  });
});
