// Determinism + purity tests: identical inputs produce identical results and
// digests; evaluation does not mutate its inputs (works on frozen objects);
// digests are invariant under context key reordering; a golden digest pins the
// exact evaluation semantics of this revision (exact-revision evidence).
import { describe, expect, it } from 'vitest';
import { compileConstraint, evaluateConstraint } from '../src';
import type { CompiledConstraint } from '../src';
import { epistemicConstraint, hardConstraint, softConstraint } from './helpers';

function compiledOf(authored: unknown): CompiledConstraint {
  const outcome = compileConstraint(authored);
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors));
  return outcome.compiled;
}

describe('determinism', () => {
  it('repeated evaluation of the same compiled constraint + context is byte-identical', () => {
    const compiled = compiledOf(epistemicConstraint);
    const context = { inputs: { confidence: 0.77, evidence: { measurement: 1, certification: 3 } } };
    const first = evaluateConstraint(compiled, context);
    for (let i = 0; i < 100; i += 1) {
      expect(evaluateConstraint(compiled, context)).toStrictEqual(first);
    }
  });

  it('the digest is invariant under evaluation-context key reordering', () => {
    const compiled = compiledOf(hardConstraint);
    const ordered = evaluateConstraint(compiled, {
      inputs: { pressure: 11, region: 'eu' },
    });
    const reordered = evaluateConstraint(compiled, {
      inputs: { region: 'eu', pressure: 11 },
    });
    expect(ordered.ok && reordered.ok).toBe(true);
    if (!ordered.ok || !reordered.ok) return;
    expect(reordered.result.evaluationDigest).toBe(ordered.result.evaluationDigest);
  });

  it('the compiled digest is invariant under authored key reordering', () => {
    const authored = JSON.parse(JSON.stringify(hardConstraint));
    const reorderedInputs = {
      inputs: authored.inputs,
      class: authored.class,
      predicate: authored.predicate,
      version: authored.version,
      id: authored.id,
      languageVersion: authored.languageVersion,
      appliesWhen: authored.appliesWhen,
      severity: authored.severity,
      tags: authored.tags,
      title: authored.title,
    };
    const a = compiledOf(hardConstraint);
    const b = compiledOf(reorderedInputs);
    expect(b.compiledDigest).toBe(a.compiledDigest);
  });

  it('different contexts produce different result digests (same outcome shares a digest)', () => {
    const compiled = compiledOf(softConstraint);
    const a = evaluateConstraint(compiled, { inputs: { cost: 10 } });
    const b = evaluateConstraint(compiled, { inputs: { cost: 150 } });
    if (!a.ok || !b.ok) throw new Error('expected results');
    expect(a.result.outcome).toBe('satisfied');
    expect(b.result.outcome).toBe('violated');
    expect(a.result.evaluationDigest).not.toBe(b.result.evaluationDigest);
    // Result digests are result-addressable: identical results share a digest.
    const c = evaluateConstraint(compiled, { inputs: { cost: 20 } });
    if (!c.ok) throw new Error('expected result');
    expect(c.result.evaluationDigest).toBe(a.result.evaluationDigest);
  });
});

describe('purity (no side effects, no input mutation)', () => {
  it('evaluation does not mutate the compiled constraint or the context', () => {
    const compiled = compiledOf(epistemicConstraint);
    const context = { inputs: { confidence: 0.9, evidence: { measurement: 2, certification: 1 } } };
    const compiledSnapshot = JSON.parse(JSON.stringify(compiled));
    const contextSnapshot = JSON.parse(JSON.stringify(context));
    evaluateConstraint(compiled, context);
    expect(compiled).toStrictEqual(compiledSnapshot);
    expect(context).toStrictEqual(contextSnapshot);
  });

  it('evaluation works on deeply frozen inputs (freeze-safe)', () => {
    const compiled = compiledOf(hardConstraint);
    const frozenContext = Object.freeze({
      inputs: Object.freeze({ pressure: 11, region: Object.freeze('eu') }),
    });
    expect(() => evaluateConstraint(Object.freeze(compiled), frozenContext)).not.toThrow();
    const outcome = evaluateConstraint(Object.freeze(compiled), frozenContext);
    expect(outcome).toMatchObject({ ok: true, result: { outcome: 'violated' } });
  });
});

describe('golden digests (exact-revision evidence)', () => {
  it('pins the compiled digest of the reference hard-constraint fixture', () => {
    const compiled = compiledOf(hardConstraint);
    // If this digest changes, the compiled-form semantics changed on this
    // revision — update deliberately and record why.
    expect(compiled.compiledDigest).toBe('f5b57a8e');
  });

  it('pins the evaluation digest of a fixed violated evaluation', () => {
    const compiled = compiledOf(epistemicConstraint);
    const outcome = evaluateConstraint(compiled, {
      inputs: { confidence: 0.5, evidence: { measurement: 1, certification: 0 } },
    });
    if (!outcome.ok) throw new Error('expected result');
    expect(outcome.result.evaluationDigest).toBe('4f8efd3c');
  });

  it('pins the evaluation digest of a fixed satisfied evaluation', () => {
    const compiled = compiledOf(softConstraint);
    const outcome = evaluateConstraint(compiled, { inputs: { cost: 10 } });
    if (!outcome.ok) throw new Error('expected result');
    expect(outcome.result.evaluationDigest).toBe('073c5fee');
  });
});
