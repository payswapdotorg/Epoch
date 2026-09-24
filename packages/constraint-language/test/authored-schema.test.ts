// Authored-form schema tests: every constraint class parses; malformed
// authored documents are rejected (positive + negative for the authored AST).
import { describe, expect, it } from 'vitest';
import { authoredConstraintSchema, inputDeclarationSchema } from '../src';
import {
  authorityConstraint,
  epistemicConstraint,
  hardConstraint,
  resourceConstraint,
  safetyConstraint,
  softConstraint,
} from './helpers';

describe('authored constraint schema (positive)', () => {
  it.each([
    ['hard', hardConstraint],
    ['soft', softConstraint],
    ['resource', resourceConstraint],
    ['safety', safetyConstraint],
    ['epistemic', epistemicConstraint],
    ['authority', authorityConstraint],
  ])('accepts a valid %s constraint', (_kind, authored) => {
    const parsed = authoredConstraintSchema.safeParse(authored);
    expect(parsed.success).toBe(true);
  });

  it('accepts a constraint without optional metadata', () => {
    const parsed = authoredConstraintSchema.safeParse({
      languageVersion: '1.0.0',
      id: 'bare-minimum',
      version: '0.1.0',
      inputs: [{ name: 'x', type: 'number' }],
      class: 'hard',
      predicate: { node: 'gt', left: { node: 'input', name: 'x' }, right: { node: 'lit', type: 'number', value: 0 } },
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts every operator node kind', () => {
    const expr = (nested: unknown) => nested;
    const parsed = authoredConstraintSchema.safeParse({
      languageVersion: '1.0.0',
      id: 'all-operators',
      version: '1.0.0',
      inputs: [
        { name: 'n', type: 'number' },
        { name: 's', type: 'string' },
        { name: 'b', type: 'boolean' },
        { name: 'e', type: 'enum', values: ['a', 'b'] },
        { name: 'r', type: 'record' },
        { name: 'l', type: 'list' },
      ],
      class: 'hard',
      predicate: expr({
        node: 'and',
        operands: [
          { node: 'or', operands: [
            { node: 'lt', left: { node: 'input', name: 'n' }, right: { node: 'lit', type: 'number', value: 1 } },
            { node: 'le', left: { node: 'input', name: 'n' }, right: { node: 'lit', type: 'number', value: 2 } },
          ] },
          { node: 'or', operands: [
            { node: 'gt', left: { node: 'input', name: 'n' }, right: { node: 'lit', type: 'number', value: 3 } },
            { node: 'ge', left: { node: 'input', name: 'n' }, right: { node: 'lit', type: 'number', value: 4 } },
          ] },
          { node: 'or', operands: [
            { node: 'eq', left: { node: 'input', name: 's' }, right: { node: 'lit', type: 'string', value: 'x' } },
            { node: 'ne', left: { node: 'input', name: 'b' }, right: { node: 'lit', type: 'boolean', value: true } },
          ] },
          { node: 'or', operands: [
            { node: 'eq', left: { node: 'input', name: 'e' }, right: { node: 'lit', type: 'string', value: 'a' } },
            { node: 'not', operand: { node: 'input', name: 'b' } },
          ] },
          { node: 'implies', antecedent: { node: 'input', name: 'b' }, consequent: { node: 'input', name: 'b' } },
          { node: 'or', operands: [
            { node: 'gt', left: { node: 'add', operands: [{ node: 'input', name: 'n' }, { node: 'lit', type: 'number', value: 1 }, { node: 'lit', type: 'number', value: 2 }] }, right: { node: 'lit', type: 'number', value: 0 } },
            { node: 'gt', left: { node: 'mul', operands: [{ node: 'input', name: 'n' }, { node: 'lit', type: 'number', value: 3 }] }, right: { node: 'lit', type: 'number', value: 0 } },
          ] },
          { node: 'or', operands: [
            { node: 'gt', left: { node: 'sub', left: { node: 'input', name: 'n' }, right: { node: 'lit', type: 'number', value: 1 } }, right: { node: 'lit', type: 'number', value: 0 } },
            { node: 'gt', left: { node: 'div', left: { node: 'input', name: 'n' }, right: { node: 'lit', type: 'number', value: 2 } }, right: { node: 'lit', type: 'number', value: 0 } },
          ] },
          { node: 'has', record: { node: 'input', name: 'r' }, key: 'k' },
          { node: 'gt', left: { node: 'get', record: { node: 'input', name: 'r' }, key: 'k', fallback: { node: 'lit', type: 'number', value: 0 } }, right: { node: 'lit', type: 'number', value: 0 } },
          { node: 'gt', left: { node: 'count', list: { node: 'input', name: 'l' } }, right: { node: 'lit', type: 'number', value: 0 } },
          { node: 'contains', list: { node: 'input', name: 'l' }, value: 'member' },
        ],
      }),
    });
    expect(parsed.success, JSON.stringify(parsed)).toBe(true);
  });
});

describe('authored constraint schema (negative: malformed documents rejected)', () => {
  const valid = JSON.parse(JSON.stringify(hardConstraint)) as Record<string, unknown>;

  it('rejects unknown top-level keys (strict shape)', () => {
    const doc = { ...valid, weigth: 3 };
    expect(authoredConstraintSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects an unknown constraint class', () => {
    const doc = { ...valid, class: 'suggestions' };
    expect(authoredConstraintSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects a wrong language version gate', () => {
    const doc = { ...valid, languageVersion: '0.9.0' };
    expect(authoredConstraintSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects malformed ids and versions', () => {
    expect(authoredConstraintSchema.safeParse({ ...valid, id: 'Bad_Id' }).success).toBe(false);
    expect(authoredConstraintSchema.safeParse({ ...valid, id: '' }).success).toBe(false);
    expect(authoredConstraintSchema.safeParse({ ...valid, version: '1.0' }).success).toBe(false);
    expect(authoredConstraintSchema.safeParse({ ...valid, version: 'v1.0.0' }).success).toBe(false);
  });

  it('rejects empty input declarations', () => {
    const doc = { ...valid, inputs: [] };
    expect(authoredConstraintSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects malformed input names', () => {
    expect(inputDeclarationSchema.safeParse({ name: '1bad', type: 'number' }).success).toBe(false);
    expect(inputDeclarationSchema.safeParse({ name: 'has space', type: 'number' }).success).toBe(false);
    expect(inputDeclarationSchema.safeParse({ type: 'number' }).success).toBe(false);
    expect(inputDeclarationSchema.safeParse({ name: 'ok', type: 'dataset' }).success).toBe(false);
  });

  it('rejects single-operand and/or nodes (arity >= 2)', () => {
    const doc = {
      ...valid,
      predicate: { node: 'and', operands: [{ node: 'input', name: 'b' }] },
      inputs: [{ name: 'b', type: 'boolean' }],
    };
    expect(authoredConstraintSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects a soft constraint without a positive weight', () => {
    const base = JSON.parse(JSON.stringify(softConstraint)) as Record<string, unknown>;
    const withoutWeight = { ...base } as Record<string, unknown>;
    delete withoutWeight.weight;
    expect(authoredConstraintSchema.safeParse(withoutWeight).success).toBe(false);
    expect(authoredConstraintSchema.safeParse({ ...base, weight: 0 }).success).toBe(false);
    expect(authoredConstraintSchema.safeParse({ ...base, weight: -1 }).success).toBe(false);
  });

  it('rejects a safety constraint without regulation references', () => {
    const base = JSON.parse(JSON.stringify(safetyConstraint)) as Record<string, unknown>;
    const withoutRegulations = { ...base } as Record<string, unknown>;
    delete withoutRegulations.regulations;
    expect(authoredConstraintSchema.safeParse(withoutRegulations).success).toBe(false);
    expect(authoredConstraintSchema.safeParse({ ...base, regulations: [] }).success).toBe(false);
  });

  it('rejects an evidence requirement with a non-positive minCount', () => {
    const base = JSON.parse(JSON.stringify(epistemicConstraint)) as {
      requiredEvidence: Array<{ kind: string; minCount: number }>;
    } & Record<string, unknown>;
    expect(
      authoredConstraintSchema.safeParse({
        ...base,
        requiredEvidence: [{ kind: 'measurement', minCount: 0 }],
      }).success,
    ).toBe(false);
  });

  it('rejects malformed permissions', () => {
    const base = JSON.parse(JSON.stringify(authorityConstraint)) as Record<string, unknown>;
    expect(
      authoredConstraintSchema.safeParse({ ...base, allOf: ['UPPER:CASE'] }).success,
    ).toBe(false);
  });
});
