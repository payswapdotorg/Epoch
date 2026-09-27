/**
 * @epoch/adapter-github — the typed error taxonomy (values, never thrown).
 *
 * Mirrors the W007 adapter-sdk error-code style: every entry point is
 * total; failures are typed records with precise paths and machine-
 * readable codes. The adapter-specific codes extend the W007 vocabulary:
 *
 * - `tenant-isolation-rejected` (R12): a record, ingestion, or invocation
 *   naming a tenant other than the adapter's pinned tenant is rejected —
 *   cross-tenant references never cross this seam;
 * - `unknown-provider-payload`: a payload presented at the provider seam
 *   does not parse as a provider snapshot of the expected shape;
 * - `digest-mismatch`: a fixture/snapshot whose claimed digest does not
 *   match its content (tamper detection);
 * - `replay-conflict`: a DIFFERENT payload arrived under an already-used
 *   content key (duplicate ingestion with equal content is idempotent and
 *   returns the sealed prior record — never this error);
 * - `ingestion-rejected`: the provider snapshot is structurally admitted
 *   but semantically incomplete for projection (e.g. no revisions);
 * - `gateway-bypass-rejected`: an invocation requested DIRECT execution,
 *   bypassing the W022 action-authority seam — the adapter never executes
 *   and never bypasses (architecture lock rule 3);
 * - `binding-conflict`: a W007 invocation envelope is bound to a
 *   different adapter/revision than this one;
 * - `validation`: malformed inputs with precise paths (strict objects
 *   reject unknown fields).
 */
import type { GITHUB_ADAPTER_RECORD_VERSION } from './version';

/** Issue codes reported by the adapter's total entry points. */
export type GithubAdapterErrorCode =
  | 'validation'
  | 'tenant-isolation-rejected'
  | 'unknown-provider-payload'
  | 'digest-mismatch'
  | 'replay-conflict'
  | 'ingestion-rejected'
  | 'gateway-bypass-rejected'
  | 'binding-conflict'
  | 'authority-unavailable';

/** One flattened validation issue (dotted path + message). */
export interface GithubAdapterIssue {
  readonly path: string;
  readonly message: string;
}

/** The typed error taxonomy. Errors are values, not exceptions. */
export type GithubAdapterError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly GithubAdapterIssue[];
    }
  | {
      readonly code: 'tenant-isolation-rejected';
      readonly message: string;
      readonly expectedTenantId: string;
      readonly encounteredTenantId: string;
    }
  | {
      readonly code: 'unknown-provider-payload';
      readonly message: string;
      readonly issues: readonly GithubAdapterIssue[];
    }
  | {
      readonly code: 'digest-mismatch';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'replay-conflict';
      readonly message: string;
      readonly key: string;
      readonly expectedDigest: string;
      readonly encounteredDigest: string;
    }
  | {
      readonly code: 'ingestion-rejected';
      readonly message: string;
      readonly reason: string;
    }
  | {
      readonly code: 'gateway-bypass-rejected';
      readonly message: string;
      readonly attemptedMode: string;
    }
  | {
      readonly code: 'binding-conflict';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    }
  | {
      readonly code: 'authority-unavailable';
      readonly message: string;
    };

/** Result of an adapter operation: a value or a typed error. */
export type GithubAdapterResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: GithubAdapterError };

/** Discard helper (record-version marker keeps the type self-referential). */
export type GithubAdapterRecordVersion = typeof GITHUB_ADAPTER_RECORD_VERSION;
