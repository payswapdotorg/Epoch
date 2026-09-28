/**
 * The typed error taxonomy of the chat reference adapter (values, never
 * thrown — the W029 adapter convention).
 */
/** One flattened validation issue (dotted path + message; "$" = root). */
export interface ChatAdapterIssue {
  readonly path: string;
  readonly message: string;
}

/** The closed error-code vocabulary. */
export type ChatAdapterErrorCode =
  | 'unknown-provider-payload'
  | 'validation'
  | 'digest-mismatch'
  | 'tenant-isolation-rejected';

/** The typed error union. */
export type ChatAdapterError =
  | {
      readonly code: 'unknown-provider-payload';
      readonly message: string;
      readonly issues: readonly ChatAdapterIssue[];
    }
  | { readonly code: 'validation'; readonly message: string; readonly issues: readonly ChatAdapterIssue[] }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
      readonly subject: string;
    }
  | {
      readonly code: 'tenant-isolation-rejected';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
    };

/** The total result type. */
export type ChatAdapterResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ChatAdapterError };
