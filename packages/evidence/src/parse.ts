/**
 * Total parse surface for evidence records.
 *
 * `parseEvidenceRecord` never throws: it reports a distinct
 * `version-mismatch` issue when the serialized form carries a
 * `schemaVersion` discriminator other than the current one (checked before
 * schema validation, mirroring the agent-protocol message admission
 * pipeline), and typed `schema` issues for every zod violation.
 */
import { EVIDENCE_RECORD_VERSION } from './version';
import { EvidenceRecordSchema } from './schema';
import type { EvidenceIssue, EvidenceRecord } from './types';

/** Outcome of parsing a serialized evidence record. */
export type EvidenceParse =
  | { ok: true; record: EvidenceRecord }
  | { ok: false; issues: readonly EvidenceIssue[] };

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

/** Parse and validate a serialized evidence record (total, never throws). */
export function parseEvidenceRecord(input: unknown): EvidenceParse {
  if (
    isPlainObject(input) &&
    'schemaVersion' in input &&
    input.schemaVersion !== EVIDENCE_RECORD_VERSION
  ) {
    return {
      ok: false,
      issues: [
        {
          code: 'version-mismatch',
          message: `evidence record schemaVersion ${JSON.stringify(
            input.schemaVersion,
          )} is not supported (expected ${EVIDENCE_RECORD_VERSION})`,
          path: ['schemaVersion'],
        },
      ],
    };
  }
  const parsed = EvidenceRecordSchema.safeParse(input);
  if (!parsed.success) {
    const issues: EvidenceIssue[] = parsed.error.issues.map((issue) => {
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
  return { ok: true, record: parsed.data };
}
