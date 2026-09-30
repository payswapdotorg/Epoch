/**
 * @epoch/persistence — versions, grammars and the typed error vocabulary.
 */

/** Version of the published persistence SPI contract. */
export const PERSISTENCE_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator on serialized SPI records (v1). */
export const PERSISTENCE_RECORD_VERSION = 1 as const;

/**
 * Table-name grammar: lowercase dot-namespaced slug segments (a safe,
 * quoted SQL identifier; validated before any SQL emission — the
 * injection guard).
 */
export const TABLE_NAME_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*(?:\.[a-z][a-z0-9_-]{0,48})?$/;

/** Record-key grammar: a non-empty bounded slug (parametrized, never interpolated). */
export const RECORD_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;

/** One typed persistence error code. */
export const PERSISTENCE_ERROR_CODES = [
  'validation',
  'duplicate-key',
  'transaction-rolled-back',
  'adapter-error',
  'transient',
] as const;

/** One typed persistence error code. */
export type PersistenceErrorCode = (typeof PERSISTENCE_ERROR_CODES)[number];

/** One typed persistence error (a value, never thrown across the seam). */
export interface PersistenceError {
  readonly code: PersistenceErrorCode;
  readonly message: string;
  readonly table?: string | undefined;
  readonly key?: string | undefined;
  readonly cause?: string | undefined;
}

/** The total result type of every SPI operation. */
export type PersistenceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: PersistenceError };
