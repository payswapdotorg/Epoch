/**
 * Total admission surface for serialized replay documents.
 *
 * `parseReplayCheckpoint` and `parseReconstructionSnapshot` never throw:
 * every failure is a typed {@link ReplayError}.
 *
 * Admission precedence (fixed): root shape (`validation`) -> version
 * gate (`version-unsupported`) -> schema gate (`validation` with dotted
 * paths; strict objects reject unknown fields) -> structural refinement
 * (`validation`: unique streams, cursors within the folded set).
 */
import { ReplayCheckpointSchema, ReconstructionSnapshotSchema } from './schema';
import { flattenZodIssues, validationError } from './issues';
import type {
  ReconstructionSnapshot,
  ReplayCheckpoint,
  ReplayError,
  ReplayResult,
} from './types';

function rootShapeError(): ReplayError {
  return {
    code: 'validation',
    message: 'replay document root must be a JSON object',
    issues: [{ path: '$', message: 'expected a JSON object at the document root' }],
  };
}

function versionGate(input: unknown): ReplayError | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return rootShapeError();
  }
  const source = (input as Record<string, unknown>).schemaVersion;
  if (typeof source === 'number' && source !== 1) {
    return {
      code: 'version-unsupported',
      message: `replay record version mismatch: expected 1, encountered ${source}`,
      expected: '1',
      encountered: String(source),
    };
  }
  return null;
}

/** Parse, validate, and admit one serialized replay checkpoint. Total. */
export function parseReplayCheckpoint(input: unknown): ReplayResult<ReplayCheckpoint> {
  const versionFailure = versionGate(input);
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }
  const parsed = ReplayCheckpointSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/** Parse, validate, and admit one serialized reconstruction snapshot. Total. */
export function parseReconstructionSnapshot(
  input: unknown,
): ReplayResult<ReconstructionSnapshot> {
  const versionFailure = versionGate(input);
  if (versionFailure !== null) {
    return { ok: false, error: versionFailure };
  }
  const parsed = ReconstructionSnapshotSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return { ok: true, value: parsed.data };
}

/** Flatten a zod failure for external consumers (the issue style). */
export { flattenZodIssues };
