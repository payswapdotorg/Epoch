/**
 * Shared host test helpers: typed-failure assertions for the host error
 * taxonomy (kernel codes pass through; service codes are host-specific).
 */
import type { DocumentAdapterHostError } from '../src/index';
import type { HostResult } from '../src/index';

/** The typed shape of one host-error variant. */
export type TypedHostError<C extends DocumentAdapterHostError['code']> = Extract<
  DocumentAdapterHostError,
  { code: C }
>;

/**
 * Assert a host result is a typed failure of exactly `code` and return
 * the narrowed error.
 */
export function expectHostFailure<C extends DocumentAdapterHostError['code']>(
  result: HostResult<unknown> | { readonly ok: false; readonly error: DocumentAdapterHostError },
  code: C,
): TypedHostError<C> {
  if (result.ok) {
    throw new Error(`expected a typed "${code}" failure, got a success`);
  }
  if (result.error.code !== code) {
    throw new Error(
      `expected a typed "${code}" failure, got "${result.error.code}": ${result.error.message}`,
    );
  }
  return result.error as TypedHostError<C>;
}
