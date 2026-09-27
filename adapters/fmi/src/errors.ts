/**
 * @epoch/adapter-fmi — the typed error taxonomy (values, never thrown).
 *
 * Mirrors the W007 adapter-sdk error-code style: every entry point is
 * total; failures are typed records with precise paths and machine-
 * readable codes. The adapter-specific codes:
 *
 * - `tenant-isolation-rejected` (R12): cross-tenant references never
 *   cross this seam;
 * - `unknown-provider-payload`: a payload presented at the provider seam
 *   does not parse as a participant-model descriptor of the expected
 *   shape;
 * - `port-conformance-rejected`: step inputs/initial parameters do not
 *   conform to the participant's declared ports (missing ports, wrong
 *   value kinds, non-finite values);
 * - `digest-mismatch`: a descriptor or step whose claimed digest does
 *   not match its content (tamper detection);
 * - `replay-conflict`: a DIFFERENT payload under an already-used content
 *   key (identical content is the idempotent duplicate path);
 * - `binding-conflict`: a W007 envelope bound to a different
 *   adapter/revision;
 * - `validation`: malformed inputs with precise paths (strict objects
 *   reject unknown fields).
 */
import type { FMI_ADAPTER_RECORD_VERSION } from './version';

/** Issue codes reported by the adapter's total entry points. */
export type FmiAdapterErrorCode =
  | 'validation'
  | 'tenant-isolation-rejected'
  | 'unknown-provider-payload'
  | 'port-conformance-rejected'
  | 'digest-mismatch'
  | 'replay-conflict'
  | 'binding-conflict';

/** One flattened validation issue (dotted path + message). */
export interface FmiAdapterIssue {
  readonly path: string;
  readonly message: string;
}

/** The typed error taxonomy. Errors are values, not exceptions. */
export type FmiAdapterError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly FmiAdapterIssue[];
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
      readonly issues: readonly FmiAdapterIssue[];
    }
  | {
      readonly code: 'port-conformance-rejected';
      readonly message: string;
      readonly issues: readonly FmiAdapterIssue[];
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
      readonly code: 'binding-conflict';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    };

/** Result of an adapter operation: a value or a typed error. */
export type FmiAdapterResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: FmiAdapterError };

/** Record-version marker (self-referential type alias). */
export type FmiAdapterRecordVersion = typeof FMI_ADAPTER_RECORD_VERSION;
