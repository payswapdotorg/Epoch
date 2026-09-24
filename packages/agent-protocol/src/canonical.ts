/**
 * Canonical JSON serialization for Epoch protocol messages.
 *
 * Protocol messages are exact-revision addressable evidence: every admitted
 * message serializes to exactly one byte sequence, so a SHA-256 digest of the
 * canonical form identifies the precise revision of a proposal, registration,
 * or authorization decision.
 *
 * Rules (deterministic output for equivalent JSON values):
 * 1. Object members are sorted by key in UTF-16 code-unit order
 *    (`Array.prototype.sort` default); there is no insignificant whitespace.
 *    Object members whose value is `undefined` are omitted — they denote the
 *    same JSON value as an absent key (matching `JSON.stringify`).
 *    `undefined` array elements are rejected: an array slot has no JSON
 *    representation and silently coercing it to `null` would corrupt
 *    evidence.
 * 2. Strings are escaped by the well-formed `JSON.stringify` (ES2019+):
 *    `"`/`\` escapes, control characters as `\u00XX`, lone surrogates escaped.
 * 3. Numbers use ECMAScript number-to-string serialization (`JSON.stringify`):
 *    `-0` serializes as `"0"`, integers without exponent, large magnitudes as
 *    exponent form (`1e+21`), matching RFC 8785 (JCS) number formatting for
 *    the JSON-safe subset. Non-finite numbers are rejected.
 * 4. `null`, `true`, `false` serialize as themselves.
 *
 * Known deviations from RFC 8785 (documented in contracts/agent/README.md):
 * - key ordering is UTF-16 code-unit based rather than UTF-8 code-point based
 *   (identical for the ASCII identifiers used by the protocol surface);
 * - lone surrogates are escaped rather than rejected.
 *
 * Runtime-neutral: no Node APIs, no dependencies.
 */

/** JSON-representable value space admitted by Epoch protocol messages. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Thrown when a value cannot be represented in canonical JSON. */
export class CanonicalizationError extends Error {
  constructor(reason: string) {
    super(`Cannot canonicalize value: ${reason}`);
    this.name = 'CanonicalizationError';
  }
}

/**
 * Serialize a JSON value to its canonical form (stable field order, no
 * insignificant whitespace). Equivalent values (e.g. objects whose members
 * were inserted in different orders) always produce identical output.
 */
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
      // ECMAScript number serialization; -0 becomes "0" (RFC 8785 behavior).
      return JSON.stringify(value);
    }
    case 'string':
      // Well-formed (ES2019+) JSON string escaping.
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        const elements = value.map((element, index) =>
          stringifyValue(element, `${path}[${index}]`),
        );
        return `[${elements.join(',')}]`;
      }
      const source = value as { [key: string]: JsonValue | undefined };
      // Default sort compares UTF-16 code units — deterministic.
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
      throw new CanonicalizationError(
        `unsupported value of type '${typeof value}' at ${path}`,
      );
  }
}
