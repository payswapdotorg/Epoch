/**
 * Permission enforcement at the boundary (lock rule 10): every host
 * call is checked against the session's FROZEN grant allow-list —
 * pure functions, total, typed denials with precise paths and the
 * exact offending field.
 *
 * Denial semantics (the allow-list model — anything not explicitly
 * granted is denied):
 * - envelope names a capability the extension never bound →
 *   `sandbox-violation` (reaching outside everything declared);
 * - no grant for the bound capability, or the function is not in the
 *   grant's allow-list → `permission-denied`
 *   (`undeclared-host-function`);
 * - the function IS granted but under a different capability →
 *   `permission-denied` (`cross-capability-access`);
 * - the function's required resource scope is not in the grant →
 *   `permission-denied` (`undeclared-resource-scope`).
 */
import { HOST_FUNCTION_REQUIRED_SCOPES, scopeKey } from './mirror';
import type {
  AdmittedExtensionRecord,
  ExtensionRuntimeError,
  HostInvocationEnvelope,
} from './types';

/** The permission check outcome: permitted, or a typed boundary error. */
export type EnforcementResult =
  | { readonly permitted: true }
  | { readonly permitted: false; readonly error: ExtensionRuntimeError };

const pathOf = (segments: readonly (string | number)[]): readonly (string | number)[] => segments;

/** Is `capabilityId` among the manifest's declared bindings? */
export function isBoundCapability(
  record: Pick<AdmittedExtensionRecord, 'manifest' | 'bindings'>,
  capabilityId: string,
): boolean {
  return record.manifest.capabilityBindings.some((binding) => binding.capabilityId === capabilityId);
}

/**
 * Check one envelope against the session's frozen grant allow-list.
 * Pure: no state, no clock, no side effects.
 */
export function enforceInvocation(
  record: Pick<AdmittedExtensionRecord, 'manifest' | 'bindings' | 'lifecycle' | 'manifestDigest'>,
  envelope: HostInvocationEnvelope,
): EnforcementResult {
  // 1. Session identity: a session only ever serves ITS extension.
  if (envelope.extensionId !== record.manifest.extensionId) {
    return {
      permitted: false,
      error: {
        code: 'sandbox-violation',
        message: `invocation envelope claims extension "${envelope.extensionId}" inside the session of "${record.manifest.extensionId}" — a session serves exactly one extension identity`,
        path: pathOf(['extensionId']),
        extensionId: record.manifest.extensionId,
        detail: 'session-identity-mismatch',
      },
    };
  }

  // 2. Capability scope must be a DECLARED binding (reaching outside
  //    everything the extension declared is a boundary violation, not a
  //    mere missing grant).
  if (!isBoundCapability(record, envelope.capabilityId)) {
    return {
      permitted: false,
      error: {
        code: 'sandbox-violation',
        message: `invocation names capability "${envelope.capabilityId}" which extension "${envelope.extensionId}" never bound — the call reaches outside the declared capability scope`,
        path: pathOf(['capabilityId']),
        extensionId: record.manifest.extensionId,
        detail: 'unbound-capability',
      },
    };
  }

  // 3. The grant allow-list for the invoked capability scope.
  const grant = record.manifest.grants.find((entry) => entry.capabilityId === envelope.capabilityId);
  if (grant === undefined || !grant.hostFunctions.includes(envelope.hostFunction)) {
    // Cross-capability access: granted elsewhere, invoked here.
    const grantedElsewhere = record.manifest.grants.find((entry) =>
      entry.hostFunctions.includes(envelope.hostFunction),
    );
    const reason = grantedElsewhere !== undefined ? 'cross-capability-access' : 'undeclared-host-function';
    return {
      permitted: false,
      error: {
        code: 'permission-denied',
        message:
          reason === 'cross-capability-access'
            ? `host function "${envelope.hostFunction}" is granted to extension "${envelope.extensionId}" only under capability "${grantedElsewhere!.capabilityId}", not under "${envelope.capabilityId}" — grants are capability-scoped`
            : `host function "${envelope.hostFunction}" is not granted to extension "${envelope.extensionId}" under capability "${envelope.capabilityId}" — anything not explicitly granted is denied`,
        path: pathOf(['hostFunction']),
        extensionId: record.manifest.extensionId,
        capabilityId: envelope.capabilityId,
        hostFunction: envelope.hostFunction,
        reason,
      },
    };
  }

  // 4. Required resource scope (ambient functions need none).
  const requiredScope = HOST_FUNCTION_REQUIRED_SCOPES[envelope.hostFunction];
  if (requiredScope !== null && requiredScope !== undefined) {
    const carried = grant.resourceScopes.some((scope) => scopeKey(scope) === scopeKey(requiredScope));
    if (!carried) {
      return {
        permitted: false,
        error: {
          code: 'permission-denied',
          message: `host function "${envelope.hostFunction}" requires the resource scope "${scopeKey(requiredScope)}" which the grant for capability "${envelope.capabilityId}" does not carry — anything not explicitly granted is denied`,
          path: pathOf(['hostFunction']),
          extensionId: record.manifest.extensionId,
          capabilityId: envelope.capabilityId,
          hostFunction: envelope.hostFunction,
          reason: 'undeclared-resource-scope',
        },
      };
    }
  }

  return { permitted: true };
}
