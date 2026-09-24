/**
 * Message admission core shared by the agent and action protocols.
 *
 * `admitMessage` runs the deterministic admission pipeline every protocol
 * message passes through:
 *
 * 1. the input must be a JSON object at the root;
 * 2. version gate — a string `protocolVersion` that differs from the expected
 *    version fails fast with a `version-mismatch` error (precedence 1);
 * 3. kind gate — a string `messageKind` that differs from the expected kind
 *    fails with a `kind-mismatch` error (precedence 2);
 * 4. schema validation against the message's zod schema (failures surface as
 *    `schema-violation` with flattened issue paths);
 * 5. canonical serialization and SHA-256 digest, making admitted messages
 *    exact-revision addressable evidence.
 *
 * Error precedence is fixed (version-mismatch > kind-mismatch >
 * schema-violation) so consumers can branch deterministically.
 */
import type { ZodType } from 'zod';
import { canonicalJsonStringify, type JsonValue } from './canonical';
import { sha256Hex, type Sha256Hex } from './digest';

/** One flattened schema-validation issue (dotted path + message). */
export interface ProtocolIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * Discriminated admission failure. `version-mismatch` and `kind-mismatch`
 * carry the expected and encountered values; `schema-violation` carries the
 * flattened zod issues.
 */
export type ProtocolError =
  | {
      readonly kind: 'version-mismatch';
      readonly expected: string;
      readonly encountered: string;
      readonly message: string;
    }
  | {
      readonly kind: 'kind-mismatch';
      readonly expected: string;
      readonly encountered: string;
      readonly message: string;
    }
  | {
      readonly kind: 'schema-violation';
      readonly issues: readonly ProtocolIssue[];
      readonly message: string;
    };

/** Successful admission: the parsed value plus its canonical evidence form. */
export interface ParseSuccess<T> {
  readonly ok: true;
  readonly value: T;
  readonly canonicalJson: string;
  readonly digest: Sha256Hex;
}

/** Failed admission. */
export interface ParseFailure {
  readonly ok: false;
  readonly error: ProtocolError;
}

/** Result of admitting a protocol message: success or a typed failure. */
export type ParseOutcome<T> = ParseSuccess<T> | ParseFailure;

/** Error thrown by the throwing (`validate*`) admission helpers. */
export class ProtocolValidationError extends Error {
  readonly error: ProtocolError;

  constructor(error: ProtocolError) {
    super(error.message);
    this.name = 'ProtocolValidationError';
    this.error = error;
  }
}

/** Unwrap an admission outcome or throw {@link ProtocolValidationError}. */
export function unwrapOrThrow<T>(outcome: ParseOutcome<T>): T {
  if (outcome.ok) return outcome.value;
  throw new ProtocolValidationError(outcome.error);
}

/** Options for the shared admission pipeline. */
export interface AdmitMessageOptions<T> {
  readonly input: unknown;
  readonly expectedVersion: string;
  /** When given, a string `messageKind` differing from it fails fast. */
  readonly expectedKind?: string;
  readonly schema: ZodType<T>;
}

/**
 * Run the deterministic admission pipeline (see module docs). Generic over
 * the message type `T` inferred from the zod schema.
 */
export function admitMessage<T>(options: AdmitMessageOptions<T>): ParseOutcome<T> {
  const { input, expectedVersion, expectedKind, schema } = options;

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return failure({
      kind: 'schema-violation',
      issues: [{ path: '', message: 'expected a JSON object at the message root' }],
      message: 'message root must be a JSON object',
    });
  }
  const record = input as Record<string, unknown>;

  // Precedence 1: version gate (only fires on string values; absent or
  // non-string versions are schema violations reported by zod below).
  const encounteredVersion = record.protocolVersion;
  if (typeof encounteredVersion === 'string' && encounteredVersion !== expectedVersion) {
    return failure({
      kind: 'version-mismatch',
      expected: expectedVersion,
      encountered: encounteredVersion,
      message: `protocol version mismatch: expected ${expectedVersion}, encountered ${encounteredVersion}`,
    });
  }

  // Precedence 2: kind gate.
  if (expectedKind !== undefined) {
    const encounteredKind = record.messageKind;
    if (typeof encounteredKind === 'string' && encounteredKind !== expectedKind) {
      return failure({
        kind: 'kind-mismatch',
        expected: expectedKind,
        encountered: encounteredKind,
        message: `message kind mismatch: expected ${expectedKind}, encountered ${encounteredKind}`,
      });
    }
  }

  // Precedence 3: full schema validation.
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issues: ProtocolIssue[] = parsed.error.issues.map((issue) => ({
      path: issue.path.map((segment) => String(segment)).join('.'),
      message: issue.message,
    }));
    return failure({
      kind: 'schema-violation',
      issues,
      message: `message failed schema validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    });
  }

  // Canonical evidence form. The schemas admit only JSON-representable
  // values, so the cast is safe by construction.
  try {
    const canonicalJson = canonicalJsonStringify(parsed.data as JsonValue);
    return {
      ok: true,
      value: parsed.data,
      canonicalJson,
      digest: sha256Hex(canonicalJson),
    };
  } catch (err) {
    return failure({
      kind: 'schema-violation',
      issues: [{ path: '', message: `canonicalization failed: ${String(err)}` }],
      message: 'admitted value is not canonically serializable',
    });
  }
}

function failure<T>(error: ProtocolError): ParseOutcome<T> {
  return { ok: false, error };
}
