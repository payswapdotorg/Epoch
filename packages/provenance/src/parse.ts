/**
 * Total parse surface for provenance graphs.
 *
 * `parseProvenanceGraph` never throws: it reports a distinct
 * `version-mismatch` issue when the serialized form carries a
 * `schemaVersion` other than the current one (before schema validation),
 * and typed `schema` issues for every zod violation.
 * `admitProvenanceGraph` additionally runs the semantic reference
 * validation (`validateProvenanceGraph`).
 */
import { PROVENANCE_RECORD_VERSION } from './version';
import { ProvenanceGraphSchema } from './schema';
import type { ProvenanceGraph, ProvenanceIssue } from './types';
import { validateProvenanceGraph, type ProvenanceValidation } from './validate';

/** Outcome of parsing a serialized provenance graph. */
export type ProvenanceParse =
  | { ok: true; graph: ProvenanceGraph }
  | { ok: false; issues: readonly ProvenanceIssue[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Walk a path back into the original input (to distinguish missing vs wrong). */
function valueAt(input: unknown, path: readonly PropertyKey[]): unknown {
  let current: unknown = input;
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[String(key)];
  }
  return current;
}

/** Parse and validate a serialized provenance graph (total, never throws). */
export function parseProvenanceGraph(input: unknown): ProvenanceParse {
  if (
    isPlainObject(input) &&
    'schemaVersion' in input &&
    input.schemaVersion !== PROVENANCE_RECORD_VERSION
  ) {
    return {
      ok: false,
      issues: [
        {
          code: 'version-mismatch',
          message: `provenance graph schemaVersion ${JSON.stringify(
            input.schemaVersion,
          )} is not supported (expected ${PROVENANCE_RECORD_VERSION})`,
          path: ['schemaVersion'],
        },
      ],
    };
  }
  const parsed = ProvenanceGraphSchema.safeParse(input);
  if (!parsed.success) {
    const issues: ProvenanceIssue[] = parsed.error.issues.map((issue) => {
      const path = issue.path.map((key) => String(key));
      const isVersionLiteral =
        issue.code === 'invalid_value' &&
        path[path.length - 1] === 'schemaVersion' &&
        valueAt(input, issue.path) !== undefined;
      return {
        code: isVersionLiteral ? ('version-mismatch' as const) : ('schema' as const),
        message: issue.message,
        path,
      };
    });
    return { ok: false, issues };
  }
  return { ok: true, graph: parsed.data };
}

/**
 * Full admission pipeline (total, never throws): schema parse plus semantic
 * reference validation — duplicate node ids, unknown agents/activities, and
 * dangling entities are all rejected with typed issues.
 */
export function admitProvenanceGraph(input: unknown): ProvenanceValidation {
  const parsed = parseProvenanceGraph(input);
  if (!parsed.ok) return { ok: false, issues: parsed.issues };
  return validateProvenanceGraph(parsed.graph);
}
