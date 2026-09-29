// The recoverable client error taxonomy: every class must round-trip
// losslessly through the serialization boundary, map to exactly one
// client recovery action, and never throw.
import { describe, expect, it } from 'vitest';
import {
  GATEWAY_ERROR_CLASSES,
  clientRecoveryAction,
  gatewayError,
  parseGatewayError,
  serializeGatewayError,
  type GatewayError,
  type GatewayErrorClass,
} from '../src';
import { CLIENT_RUNTIME_RECORD_VERSION } from '../src/version';

const CORR = 'corr:errors-test';

function errorOfClass(errorClass: GatewayErrorClass): GatewayError {
  switch (errorClass) {
    case 'transient':
      return gatewayError({
        class: 'transient',
        code: 'network-unavailable',
        message: 'the network is unavailable',
        operation: 'world.snapshot',
        correlationId: CORR,
        details: { retryAfterMs: 500 },
      });
    case 'auth-session-expired':
      return gatewayError({
        class: 'auth-session-expired',
        code: 'session-expired',
        message: 'the session has expired',
        operation: 'action.submit',
        correlationId: CORR,
        details: { sessionId: 'session:errors-test', reauthRequired: true },
      });
    case 'conflict':
      return gatewayError({
        class: 'conflict',
        code: 'idempotency-fingerprint-mismatch',
        message: 'the idempotency key was reused for a different request',
        operation: 'action.execute',
        correlationId: CORR,
        details: {
          idempotencyKey: 'idem:errors-test',
          requestFingerprint: 'a'.repeat(64),
          recordedFingerprint: 'b'.repeat(64),
        },
      });
    case 'validation':
      return gatewayError({
        class: 'validation',
        code: 'request-validation',
        message: 'the payload failed validation',
        operation: 'evidence.intake',
        correlationId: CORR,
        details: { issues: [{ path: '/payload', message: 'required' }] },
      });
    case 'authority-rejected':
      return gatewayError({
        class: 'authority-rejected',
        code: 'authority-denied',
        message: 'the authority rejected the request',
        operation: 'solution.approveBaseline',
        correlationId: CORR,
        details: {
          authority: '@epoch/solution-delivery',
          authorityCode: 'baseline-mutation-rejected',
          authorityError: { code: 'baseline-mutation-rejected' },
        },
      });
    case 'unrecoverable':
      return gatewayError({
        class: 'unrecoverable',
        code: 'internal-invariant-violated',
        message: 'an internal invariant was violated',
        operation: 'gateway',
        correlationId: CORR,
      });
  }
}

describe('the error taxonomy (W046 acceptance 7)', () => {
  it('the six classes are exactly the declared vocabulary', () => {
    expect([...GATEWAY_ERROR_CLASSES]).toEqual([
      'transient',
      'auth-session-expired',
      'conflict',
      'validation',
      'authority-rejected',
      'unrecoverable',
    ]);
  });

  it.each(GATEWAY_ERROR_CLASSES)('class %s round-trips through the serialization boundary', (errorClass) => {
    const error = errorOfClass(errorClass);
    const wire = serializeGatewayError(error);
    const parsed = parseGatewayError(wire);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value).toEqual(error);
      expect(parsed.value.class).toBe(errorClass);
      expect(parsed.value.schemaVersion).toBe(CLIENT_RUNTIME_RECORD_VERSION);
    }
  });

  it.each(GATEWAY_ERROR_CLASSES)('class %s maps to exactly one client recovery action', (errorClass) => {
    const action = clientRecoveryAction(errorOfClass(errorClass));
    expect(action).toBeTruthy();
  });

  it('the class -> recovery-action mapping is the documented UI-state mapping', () => {
    expect(clientRecoveryAction(errorOfClass('transient'))).toBe('retry-with-backoff');
    expect(clientRecoveryAction(errorOfClass('auth-session-expired'))).toBe('re-authenticate');
    expect(clientRecoveryAction(errorOfClass('conflict'))).toBe('surface-conflict');
    expect(clientRecoveryAction(errorOfClass('validation'))).toBe('surface-input');
    expect(clientRecoveryAction(errorOfClass('authority-rejected'))).toBe('surface-authority-rejection');
    expect(clientRecoveryAction(errorOfClass('unrecoverable'))).toBe('surface-failure');
  });

  it('only transient errors are retryable by default', () => {
    for (const errorClass of GATEWAY_ERROR_CLASSES) {
      expect(clientRecoveryAction(errorOfClass(errorClass))).toBeTruthy();
      const retryable = errorOfClass(errorClass).retryable;
      expect(retryable).toBe(errorClass === 'transient');
    }
  });

  it('a malformed serialized error becomes a typed response-malformed error (never throws)', () => {
    const parsed = parseGatewayError({ class: 'transient', nonsense: true });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.class).toBe('unrecoverable');
      expect(parsed.error.code).toBe('response-malformed');
    }
  });

  it('authority rejections carry the authority error verbatim (no client-local semantic errors)', () => {
    const error = errorOfClass('authority-rejected');
    expect(error.details?.authority).toBe('@epoch/solution-delivery');
    expect(error.details?.authorityCode).toBe('baseline-mutation-rejected');
  });
});
