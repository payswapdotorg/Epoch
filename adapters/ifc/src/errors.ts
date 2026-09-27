/**
 * @epoch/adapter-ifc — the typed error taxonomy (values, never thrown).
 *
 * Mirrors the W007 adapter-sdk error-code style: every entry point is
 * total; failures are typed records with precise paths and machine-
 * readable codes. The adapter-specific codes:
 *
 * - `tenant-isolation-rejected` (R12): cross-tenant references never
 *   cross this seam;
 * - `unknown-provider-payload`: a payload presented at the provider seam
 *   does not parse as a building-model fixture of the expected shape;
 * - `ingestion-rejected`: structurally admitted but semantically
 *   incomplete or inconsistent fixture content (with a reason — never a
 *   partial silent load);
 * - `digest-mismatch`: a fixture whose claimed digest does not match its
 *   content (tamper detection);
 * - `replay-conflict`: a DIFFERENT payload under an already-used content
 *   key (identical content is the idempotent duplicate path);
 * - `external-semantics-not-authority`: an invocation requested an
 *   authoritative/direct semantic write — external-standard semantics
 *   are ADAPTED into world-model inputs, never authoritative;
 * - `binding-conflict`: a W007 envelope bound to a different
 *   adapter/revision;
 * - `validation`: malformed inputs with precise paths (strict objects
 *   reject unknown fields).
 */
import type { IFC_ADAPTER_RECORD_VERSION } from './version';

/** Issue codes reported by the adapter's total entry points. */
export type IfcAdapterErrorCode =
  | 'validation'
  | 'tenant-isolation-rejected'
  | 'unknown-provider-payload'
  | 'ingestion-rejected'
  | 'digest-mismatch'
  | 'replay-conflict'
  | 'external-semantics-not-authority'
  | 'binding-conflict';

/** One flattened validation issue (dotted path + message). */
export interface IfcAdapterIssue {
  readonly path: string;
  readonly message: string;
}

/** The typed error taxonomy. Errors are values, not exceptions. */
export type IfcAdapterError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly IfcAdapterIssue[];
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
      readonly issues: readonly IfcAdapterIssue[];
    }
  | {
      readonly code: 'ingestion-rejected';
      readonly message: string;
      readonly reason: string;
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
      readonly code: 'external-semantics-not-authority';
      readonly message: string;
      readonly attemptedMode: string;
    }
  | {
      readonly code: 'binding-conflict';
      readonly message: string;
      readonly expected: string;
      readonly encountered: string;
    };

/** Result of an adapter operation: a value or a typed error. */
export type IfcAdapterResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: IfcAdapterError };

/** Record-version marker (self-referential type alias). */
export type IfcAdapterRecordVersion = typeof IFC_ADAPTER_RECORD_VERSION;
