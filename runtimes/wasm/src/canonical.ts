/**
 * Canonical JSON serialization — a DELIBERATE MIRROR of
 * @epoch/agent-protocol's src/canonical.ts (self-containment policy,
 * see src/version.ts header). Rules (deterministic output for
 * equivalent JSON values):
 *
 * 1. Object members are sorted by key in UTF-16 code-unit order; there
 *    is no insignificant whitespace. `undefined` object members are
 *    omitted; `undefined` array elements are rejected.
 * 2. Strings are escaped by well-formed `JSON.stringify` (ES2019+).
 * 3. Numbers use ECMAScript number-to-string serialization (`-0`
 *    serializes as `"0"`); non-finite numbers are rejected.
 * 4. `null`, `true`, `false` serialize as themselves.
 *
 * Parity evidence (test/digest.parity.test.ts): fixture corpus over
 * tricky values (key permutations, control characters, unicode,
 * nesting, numbers), asserting the exact expected canonical strings.
 */
import { CanonicalizationError } from './errors';

/** JSON-representable value space admitted by the layout machinery. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Serialize a JSON value to its canonical form. */
export function canonicalJsonStringify(value: JsonValue): string {
  return stringifyValue(value, '$');
}

function stringifyValue(value: JsonValue, path: string): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number': {
      if (!Number.isFinite(value)) {
        throw new CanonicalizationError(`non-finite number at ${path}`);
      }
      return JSON.stringify(value);
    }
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        const elements = value.map((element, index) =>
          stringifyElement(element, `${path}[${index}]`),
        );
        return `[${elements.join(',')}]`;
      }
      const source = value as { [key: string]: JsonValue | undefined };
      const keys = Object.keys(source)
        .filter((key) => source[key] !== undefined)
        .sort();
      const members: string[] = [];
      for (const key of keys) {
        const member = source[key] as JsonValue;
        members.push(`${JSON.stringify(key)}:${stringifyValue(member, `${path}.${key}`)}`);
      }
      return `{${members.join(',')}}`;
    }
    default:
      throw new CanonicalizationError(`unsupported value of type '${typeof value}' at ${path}`);
  }
}

function stringifyElement(element: JsonValue | undefined, path: string): string {
  if (element === undefined) {
    throw new CanonicalizationError(`undefined array element at ${path}`);
  }
  return stringifyValue(element, path);
}
