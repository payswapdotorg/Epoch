import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../src/canonical';

describe('canonicalJson', () => {
  it('sorts object keys recursively', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it('preserves array order (order is semantic)', () => {
    expect(canonicalJson({ list: [3, 1, 2] })).toBe('{"list":[3,1,2]}');
  });

  it('drops undefined-valued members', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('escapes strings exactly like JSON.stringify (keys still sorted)', () => {
    // canonical form sorts keys: nl < quote < uni
    expect(canonicalJson({ quote: '"', nl: '\n', uni: 'é' })).toBe(
      '{"nl":"\\n","quote":"\\"","uni":"é"}',
    );
  });

  it('is deterministic across insertion orders and repeated calls', () => {
    const a = { x: 1, y: { b: [1, { z: 2, a: 3 }], a: 's' }, z: null };
    const b = { z: null, y: { a: 's', b: [1, { a: 3, z: 2 }] }, x: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(canonicalJson(a)).toBe(canonicalJson(JSON.parse(canonicalJson(a))));
  });

  it('serializes primitives and empty containers', () => {
    expect(canonicalJson(null)).toBe('null');
    expect(canonicalJson(true)).toBe('true');
    expect(canonicalJson(false)).toBe('false');
    expect(canonicalJson(42)).toBe('42');
    expect(canonicalJson(-0.5)).toBe('-0.5');
    expect(canonicalJson('x')).toBe('"x"');
    expect(canonicalJson([])).toBe('[]');
    expect(canonicalJson({})).toBe('{}');
  });

  it('sorts keys by UTF-16 code units (deterministic across engines)', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson({ é: 1, z: 2, A: 3 })).toBe('{"A":3,"z":2,"é":1}');
  });

  it('rejects non-finite numbers', () => {
    expect(() => canonicalJson({ bad: Number.POSITIVE_INFINITY })).toThrow(/non-finite/);
    expect(() => canonicalJson(Number.NaN)).toThrow(/non-finite/);
  });

  it('rejects non-JSON values', () => {
    expect(() => canonicalJson(() => 1)).toThrow(/cannot canonicalize/);
    expect(() => canonicalJson(Symbol('x'))).toThrow(/cannot canonicalize/);
  });
});
