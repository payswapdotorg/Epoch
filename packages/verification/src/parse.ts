/**
 * Total parse surface for verification chains.
 *
 * `parseVerificationChain` never throws: it reports a distinct
 * `version-mismatch` issue when the serialized form (or any nested record)
 * carries a `schemaVersion` other than the current one, and typed `schema`
 * issues for every zod violation — with paths into the chain
 * (e.g. ["runs", 2, "producedEvidence", 0]) so malformed records are
 * precisely locatable.
 */
import { VERIFICATION_RECORD_VERSION } from './version';
import { VerificationChainSchema } from './schema';
import type { ChainIssue, VerificationChain } from './types';

/** Outcome of parsing a serialized verification chain. */
export type ChainParse =
  | { ok: true; chain: VerificationChain }
  | { ok: false; issues: readonly ChainIssue[] };

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

/** Parse and validate a serialized verification chain (total, never throws). */
export function parseVerificationChain(input: unknown): ChainParse {
  if (
    isPlainObject(input) &&
    'schemaVersion' in input &&
    input.schemaVersion !== VERIFICATION_RECORD_VERSION
  ) {
    return {
      ok: false,
      issues: [
        {
          code: 'version-mismatch',
          message: `verification chain schemaVersion ${JSON.stringify(
            input.schemaVersion,
          )} is not supported (expected ${VERIFICATION_RECORD_VERSION})`,
          path: ['schemaVersion'],
        },
      ],
    };
  }
  const parsed = VerificationChainSchema.safeParse(input);
  if (!parsed.success) {
    const issues: ChainIssue[] = parsed.error.issues.map((issue) => {
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
  return { ok: true, chain: parsed.data };
}
