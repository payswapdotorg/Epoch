/**
 * Canonical JSON serialization — the deterministic form underlying
 * exact-revision evidence.
 *
 * Rules:
 * - object keys are sorted by UTF-16 code-unit order, recursively;
 * - array order is preserved (order is semantic);
 * - `undefined` object members are dropped (JSON semantics);
 * - strings use JSON escaping; numbers use `JSON.stringify` form;
 * - non-finite numbers and non-JSON values are rejected.
 *
 * Equal values always serialize to identical bytes.
 */

export function canonicalJson(value: unknown): string {
  return canonical(value, []);
}

function canonical(value: unknown, path: readonly string[]): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number': {
      if (!Number.isFinite(value)) {
        throw new Error(`non-finite number at ${describePath(path)}`);
      }
      return JSON.stringify(value);
    }
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) {
        return `[${value.map((item, i) => canonical(item, [...path, String(i)])).join(',')}]`;
      }
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const body = keys.map((key) => {
        const nextPath = [...path, key];
        return `${JSON.stringify(key)}:${canonical(record[key], nextPath)}`;
      });
      return `{${body.join(',')}}`;
    }
    default:
      throw new Error(`cannot canonicalize ${typeof value} at ${describePath(path)}`);
  }
}

function describePath(path: readonly string[]): string {
  return path.length > 0 ? path.join('.') : '<root>';
}
