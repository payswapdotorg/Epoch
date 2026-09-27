/**
 * @epoch/adapter-mcp — the typed error taxonomy (values, never thrown).
 *
 * Mirrors the W007 adapter-sdk error-code style: every entry point is
 * total; failures are typed records with precise paths and machine-
 * readable codes. The adapter-specific codes:
 *
 * - `tenant-isolation-rejected` (R12): cross-tenant references never
 *   cross this seam;
 * - `unknown-provider-payload`: a payload presented at the provider seam
 *   does not parse as a tool catalog of the expected shape;
 * - `credential-rejected`: invocation parameters carry credential-shaped
 *   keys — the adapter holds NO credentials (tool credentials belong to
 *   the authority-side execution port, never here);
 * - `tool-argument-rejected`: invocation parameters do not conform to
 *   the discovered tool's declared input surface;
 * - `gateway-bypass-rejected`: an invocation requested DIRECT execution,
 *   bypassing the W022 action-authority seam — the adapter executes
 *   NOTHING itself and never bypasses (architecture lock rule 3);
 * - `digest-mismatch`: a record whose claimed digest does not match its
 *   content (tamper detection), or an evaluation subject whose digest
 *   does not match the recorded invocation;
 * - `replay-conflict`: a DIFFERENT payload under an already-used content
 *   key (identical content is the idempotent duplicate path);
 * - `binding-conflict`: a W007 envelope bound to a different
 *   adapter/revision;
 * - `validation`: malformed inputs with precise paths (strict objects
 *   reject unknown fields).
 */
import type { MCP_ADAPTER_RECORD_VERSION } from './version';

/** Issue codes reported by the adapter's total entry points. */
export type McpAdapterErrorCode =
  | 'validation'
  | 'tenant-isolation-rejected'
  | 'unknown-provider-payload'
  | 'credential-rejected'
  | 'tool-argument-rejected'
  | 'gateway-bypass-rejected'
  | 'digest-mismatch'
  | 'replay-conflict'
  | 'binding-conflict'
  | 'authority-unavailable';

/** One flattened validation issue (dotted path + message). */
export interface McpAdapterIssue {
  readonly path: string;
  readonly message: string;
}

/** The typed error taxonomy. Errors are values, not exceptions. */
export type McpAdapterError =
  | {
      readonly code: 'validation';
      readonly message: string;
      readonly issues: readonly McpAdapterIssue[];
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
      readonly issues: readonly McpAdapterIssue[];
    }
  | {
      readonly code: 'credential-rejected';
      readonly message: string;
      readonly offendingKeys: readonly string[];
    }
  | {
      readonly code: 'tool-argument-rejected';
      readonly message: string;
      readonly issues: readonly McpAdapterIssue[];
    }
  | {
      readonly code: 'gateway-bypass-rejected';
      readonly message: string;
      readonly attemptedMode: string;
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
    }
  | {
      readonly code: 'authority-unavailable';
      readonly message: string;
    };

/** Result of an adapter operation: a value or a typed error. */
export type McpAdapterResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: McpAdapterError };

/** Record-version marker (self-referential type alias). */
export type McpAdapterRecordVersion = typeof MCP_ADAPTER_RECORD_VERSION;
