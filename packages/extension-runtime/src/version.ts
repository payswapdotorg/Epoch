/**
 * @epoch/extension-runtime — contract versions and closed vocabularies.
 *
 * The runtime is the sandboxed HOST machinery model (W008): admission,
 * enforcement, envelopes, in-memory reference host state, deterministic
 * execution-surface descriptions. The extension AUTHORING vocabulary
 * (manifest, flavors, trust classes, host-function contract) is owned by
 * @epoch/extension-sdk; this package MIRRORS the boundary-relevant
 * vocabulary in src/mirror.ts (structurally identical, parity-pinned by
 * devDependency tests — the W002/W006/W007 kernel-to-kernel precedent,
 * NO runtime coupling) and re-uses the shared kernel machinery it is
 * permitted to runtime-depend on: @epoch/agent-protocol (canonical
 * digests, message ids, timestamps) and @epoch/capability-registry
 * (capability binding resolution + lifecycle transitions).
 */

/** Version of the published extension-runtime contract surface (schemas/ + types). */
export const EXTENSION_RUNTIME_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every invocation envelope (v1). */
export const EXTENSION_INVOCATION_ENVELOPE_VERSION = 1 as const;

/** Version discriminator carried by every sandbox surface description (v1). */
export const SANDBOX_SURFACE_DESCRIPTION_VERSION = 1 as const;

/**
 * Typed denial reasons for `permission-denied` (the allow-list
 * semantics: enforcement denies anything not explicitly granted):
 * - `undeclared-host-function` — the function is not in the grant's
 *   allow-list for the invoked capability scope;
 * - `undeclared-resource-scope` — the function requires a resource
 *   scope the grant does not carry;
 * - `cross-capability-access` — the function IS granted, but under a
 *   different bound capability (grants are capability-scoped).
 */
export const PERMISSION_DENIED_REASONS = [
  'cross-capability-access',
  'undeclared-host-function',
  'undeclared-resource-scope',
] as const;

/** One typed permission-denial reason. */
export type PermissionDeniedReason = (typeof PERMISSION_DENIED_REASONS)[number];

/**
 * Typed sandbox-violation details (attempts to step OUTSIDE the
 * sandbox boundary, beyond a mere missing grant):
 * - `unbound-capability` — the envelope names a capability the
 *   extension never bound (reaching outside everything it declared);
 * - `session-identity-mismatch` — the envelope claims another
 *   extension's identity inside this session.
 */
export const SANDBOX_VIOLATION_DETAILS = [
  'session-identity-mismatch',
  'unbound-capability',
] as const;

/** One typed sandbox-violation detail. */
export type SandboxViolationDetail = (typeof SANDBOX_VIOLATION_DETAILS)[number];

/**
 * Neutral host-execution failure codes (the W007 failure-code style):
 * the call was PERMITTED by the boundary but the host implementation
 * failed. These are invocation outcomes, never boundary errors.
 */
export const HOST_EXECUTION_FAILURE_CODES = ['handler-error', 'handler-unavailable'] as const;

/** One host-execution failure code. */
export type HostExecutionFailureCode = (typeof HOST_EXECUTION_FAILURE_CODES)[number];
