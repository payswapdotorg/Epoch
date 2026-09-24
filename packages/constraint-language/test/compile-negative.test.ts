// Compiler negative battery: malformed authored constraints, undeclared
// inputs, type errors, impure/nondeterministic operator attempts, class
// payload violations, and structural abuse (deep/large ASTs, arbitrary
// garbage) are all rejected WITHOUT throwing — compileConstraint is total.
import { describe, expect, it } from 'vitest';
import { compileConstraint } from '../src';
import {
  authorityConstraint,
  epistemicConstraint,
  hardConstraint,
  resourceConstraint,
  softConstraint,
} from './helpers';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function clone<T>(value: T): Mutable<T> {
  return JSON.parse(JSON.stringify(value)) as Mutable<T>;
}

function expectRejected(authored: unknown, code: string, pathHint?: string): void {
  const outcome = compileConstraint(authored);
  expect(outcome.ok, JSON.stringify(authored)).toBe(false);
  if (outcome.ok) return;
  const codes = outcome.errors.map((error) => error.code);
  expect(codes, JSON.stringify(outcome.errors)).toContain(code);
  if (pathHint !== undefined) {
    const paths = outcome.errors.map((error) => error.path);
    expect(paths, JSON.stringify(outcome.errors)).toContain(pathHint);
  }
}

const num = (value: number) => ({ node: 'lit', type: 'number', value }) as const;
const input = (name: string) => ({ node: 'input', name }) as const;

describe('compileConstraint (negative: semantic rejections)', () => {
  it('rejects references to undeclared inputs', () => {
    const doc = clone(hardConstraint);
    doc.inputs = [{ name: 'region', type: 'enum', values: ['eu', 'us'] }];
    expectRejected(doc, 'undeclared-input', 'predicate.left');
  });

  it('rejects duplicate input declarations', () => {
    const doc = clone(hardConstraint);
    doc.inputs = [
      { name: 'pressure', type: 'number' },
      { name: 'pressure', type: 'number' },
      { name: 'region', type: 'enum', values: ['eu', 'us'] },
    ];
    expectRejected(doc, 'duplicate-input', 'inputs[1].name');
  });

  it('rejects enum inputs without values and non-enum inputs with values', () => {
    const noValues = clone(hardConstraint);
    noValues.inputs = [
      { name: 'pressure', type: 'number' },
      { name: 'region', type: 'enum' },
    ];
    expectRejected(noValues, 'enum-values-required', 'inputs[1].values');

    const wrongValues = clone(hardConstraint);
    wrongValues.inputs = [
      { name: 'pressure', type: 'number', values: ['a'] },
      { name: 'region', type: 'enum', values: ['eu', 'us'] },
    ];
    expectRejected(wrongValues, 'enum-values-forbidden', 'inputs[0].values');
  });

  it('rejects literal type/value mismatches', () => {
    const doc = clone(hardConstraint);
    doc.predicate = { node: 'lt', left: input('pressure'), right: { node: 'lit', type: 'number', value: 'ten' } };
    expectRejected(doc, 'invalid-literal', 'predicate.right');
  });

  it('rejects ordered comparisons between non-numbers', () => {
    const doc = clone(hardConstraint);
    doc.inputs = [{ name: 'region', type: 'enum', values: ['eu', 'us'] }];
    doc.predicate = { node: 'lt', left: input('region'), right: { node: 'lit', type: 'string', value: 'eu' } };
    expectRejected(doc, 'type-mismatch', 'predicate');
  });

  it('rejects equality between different primitive types', () => {
    const doc = clone(hardConstraint);
    doc.predicate = { node: 'eq', left: input('pressure'), right: { node: 'lit', type: 'boolean', value: true } };
    expectRejected(doc, 'type-mismatch', 'predicate');
  });

  it('rejects equality over records and lists (no deep equality in v1)', () => {
    const doc = clone(hardConstraint);
    doc.inputs = [
      { name: 'a', type: 'record' },
      { name: 'b', type: 'record' },
    ];
    doc.predicate = { node: 'eq', left: input('a'), right: input('b') };
    expectRejected(doc, 'type-mismatch', 'predicate');
  });

  it('rejects logical operators over non-boolean operands', () => {
    const doc = clone(hardConstraint);
    doc.predicate = { node: 'and', operands: [input('pressure'), num(1)] };
    expectRejected(doc, 'type-mismatch', 'predicate.operands[0]');
  });

  it('rejects arithmetic over non-number operands', () => {
    const doc = clone(hardConstraint);
    doc.predicate = {
      node: 'lt',
      left: { node: 'add', operands: [input('pressure'), { node: 'lit', type: 'string', value: 'x' }] },
      right: num(10),
    };
    expectRejected(doc, 'type-mismatch', 'predicate.left.operands[1]');
  });

  it('rejects non-boolean predicate roots', () => {
    const doc = clone(hardConstraint);
    doc.predicate = { node: 'add', operands: [input('pressure'), num(1)] };
    expectRejected(doc, 'predicate-type', 'predicate');
  });

  it('rejects non-boolean appliesWhen guards', () => {
    const doc = clone(hardConstraint);
    doc.appliesWhen = input('pressure');
    expectRejected(doc, 'applies-when-type', 'appliesWhen');
  });

  it('rejects non-number resource usage/limit expressions', () => {
    const doc = clone(resourceConstraint);
    doc.usage = { node: 'not', operand: input('spent') };
    doc.inputs = [
      { name: 'spent', type: 'boolean' },
      { name: 'cap', type: 'number' },
    ];
    expectRejected(doc, 'payload-type', 'usage');
  });

  it('rejects non-number epistemic confidence/threshold expressions', () => {
    const doc = clone(epistemicConstraint);
    // A well-typed boolean expression in a number slot: payload-type error.
    doc.confidence = {
      node: 'not',
      operand: { node: 'has', record: { node: 'input', name: 'evidence' }, key: 'k' },
    };
    expectRejected(doc, 'payload-type', 'confidence');
  });

  it('rejects requiredEvidence without an evidenceInput', () => {
    const doc = clone(epistemicConstraint);
    delete doc.evidenceInput;
    expectRejected(doc, 'evidence-input-required', 'evidenceInput');
  });

  it('rejects evidenceInput that is not a declared record input', () => {
    const doc = clone(epistemicConstraint);
    doc.evidenceInput = 'confidence';
    expectRejected(doc, 'evidence-input-type', 'evidenceInput');

    const undeclared = clone(epistemicConstraint);
    undeclared.evidenceInput = 'mystery';
    expectRejected(undeclared, 'undeclared-input', 'evidenceInput');
  });

  it('rejects duplicate required evidence kinds', () => {
    const doc = clone(epistemicConstraint);
    doc.requiredEvidence = [
      { kind: 'measurement', minCount: 1 },
      { kind: 'measurement', minCount: 2 },
    ];
    expectRejected(doc, 'duplicate-evidence-kind', 'requiredEvidence[1].kind');
  });

  it('rejects authority constraints with an undeclared permissions input', () => {
    const doc = clone(authorityConstraint);
    doc.permissionsInput = 'grants';
    expectRejected(doc, 'undeclared-input', 'permissionsInput');
  });

  it('rejects authority constraints whose permissions input is not a list', () => {
    const doc = clone(authorityConstraint);
    doc.inputs = [{ name: 'permissions', type: 'record' }];
    expectRejected(doc, 'permissions-input-type', 'permissionsInput');
  });

  it('rejects authority constraints that require no permissions at all', () => {
    const doc = clone(authorityConstraint);
    doc.allOf = [];
    doc.anyOf = [];
    expectRejected(doc, 'empty-permission-set', '$');
  });

  it('rejects division by a constant zero (literal and folded)', () => {
    const literalZero = clone(hardConstraint);
    literalZero.predicate = {
      node: 'gt',
      left: { node: 'div', left: input('pressure'), right: num(0) },
      right: num(1),
    };
    expectRejected(literalZero, 'division-by-zero-constant', 'predicate.left.right');

    const foldedZero = clone(hardConstraint);
    foldedZero.predicate = {
      node: 'gt',
      left: { node: 'div', left: input('pressure'), right: { node: 'sub', left: num(2), right: num(2) } },
      right: num(1),
    };
    expectRejected(foldedZero, 'division-by-zero-constant', 'predicate.left.right');
  });

  it('rejects division by constant zero inside resource payloads', () => {
    const doc = clone(resourceConstraint);
    doc.usage = { node: 'div', left: input('spent'), right: num(0) };
    expectRejected(doc, 'division-by-zero-constant', 'usage.right');
  });

  it('rejects too many input declarations', () => {
    const doc = clone(softConstraint);
    doc.inputs = Array.from({ length: 65 }, (_, i) => ({ name: `x${i}`, type: 'number' }));
    doc.predicate = { node: 'lt', left: input('x0'), right: num(1) };
    expectRejected(doc, 'too-many-inputs', 'inputs');
  });
});

describe('compileConstraint (negative: impure/nondeterministic constructs rejected)', () => {
  const impureNodes: Array<[string, unknown]> = [
    ['random', { node: 'random' }],
    ['now', { node: 'now' }],
    ['wallclock read', { node: 'now', unit: 'ms' }],
    ['external call', { node: 'call', fn: 'fetch', args: [] }],
    ['eval', { node: 'eval', source: 'Math.random()' }],
    ['side effect', { node: 'effect', kind: 'log', value: 'x' }],
    ['unknown operator', { node: 'frobnicate' }],
  ];

  it.each(impureNodes)('rejects the "%s" construct', (_name, badNode) => {
    const doc = clone(hardConstraint);
    doc.predicate = { node: 'and', operands: [badNode as never, badNode as never] };
    const outcome = compileConstraint(doc);
    expect(outcome.ok).toBe(false);
  });

  it('rejects impure constructs inside class payloads', () => {
    const doc = clone(resourceConstraint);
    doc.usage = { node: 'call', fn: 'readMeter' } as never;
    expect(compileConstraint(doc).ok).toBe(false);
  });
});

describe('compileConstraint (negative: structural abuse rejected without throwing)', () => {
  it('rejects pathologically deep ASTs (stack-overflow protection)', () => {
    let deep: unknown = num(1);
    for (let i = 0; i < 300; i += 1) {
      deep = { node: 'not', operand: deep };
    }
    const doc = clone(hardConstraint);
    doc.predicate = deep as never;
    expectRejected(doc, 'ast-too-deep');
  });

  it('rejects pathologically large ASTs', () => {
    const operands = Array.from({ length: 12_000 }, () => num(1));
    const doc = clone(hardConstraint);
    doc.predicate = { node: 'add', operands };
    expectRejected(doc, 'ast-too-large');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['number', 42],
    ['string', 'constraint'],
    ['empty object', {}],
    ['array', [1, 2, 3]],
    ['wrong discriminator', { languageVersion: '1.0.0', class: 'hard' }],
    ['deeply nested garbage', { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: 1 } } } } } } } } } }],
    ['circular-ish object', { ...hardConstraint, predicate: { node: 'and', operands: null } }],
  ])('never throws on garbage input (%s)', (_name, garbage) => {
    expect(() => compileConstraint(garbage)).not.toThrow();
    const outcome = compileConstraint(garbage);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.errors.length).toBeGreaterThan(0);
      expect(outcome.errors[0].message.length).toBeGreaterThan(0);
    }
  });
});
