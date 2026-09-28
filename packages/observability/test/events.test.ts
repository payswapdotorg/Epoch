// THE security:* EVENT VOCABULARY: payload-family discipline, sealing
// tamper detection, and the W010 open-namespace behavior.
import { describe, expect, it } from 'vitest';
import {
  parseSecurityEventData,
  sealSecurityEvent,
  verifySealedSecurityEvent,
  isSecurityEventDiscriminator,
  SECURITY_EVENT_DISCRIMINATORS,
} from '../src/index';
import {
  EXTENSION_ID,
  OBSERVATION_ID,
  PRINCIPAL,
  SOURCE_DIGEST,
  T1,
  TENANT,
  expectError,
  unwrap,
} from './fixtures';

function observationEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    streamId: 'stream:security-terrain-viewer',
    sequence: 1,
    tenantId: TENANT,
    actor: PRINCIPAL,
    causalParent: null,
    payload: {
      discriminator: 'security:observation-recorded',
      data: {
        observationId: OBSERVATION_ID,
        observationDigest: SOURCE_DIGEST,
        observationClass: 'sandbox-admission',
        subjectId: EXTENSION_ID,
        outcome: 'allowed',
        observedAt: T1,
      },
    },
    occurredAt: T1,
    ...overrides,
  };
}

describe('security events (positive)', () => {
  it('seals a well-formed event with the payload-family contract', () => {
    const sealed = unwrap(sealSecurityEvent(observationEvent()));
    expect(sealed.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(unwrap(verifySealedSecurityEvent(sealed)).contentDigest).toBe(sealed.contentDigest);
  });

  it('the discriminator vocabulary is closed and recognized', () => {
    expect(SECURITY_EVENT_DISCRIMINATORS).toContain('security:quarantine-imposed');
    expect(isSecurityEventDiscriminator('security:quarantine-imposed')).toBe(true);
    expect(isSecurityEventDiscriminator('security:unknown')).toBe(false);
  });

  it('parseSecurityEventData round-trips the payload data of a known kind', () => {
    const data = unwrap(
      parseSecurityEventData('security:observation-recorded', {
        observationId: OBSERVATION_ID,
        observationDigest: SOURCE_DIGEST,
        observationClass: 'sandbox-admission',
        subjectId: EXTENSION_ID,
        outcome: 'allowed',
        observedAt: T1,
      }),
    );
    expect(data['observationId']).toBe(OBSERVATION_ID);
  });
});

describe('security events (negative)', () => {
  it('a KNOWN discriminator with malformed payload data is a typed validation failure', () => {
    const error = expectError(
      sealSecurityEvent(
        observationEvent({
          payload: { discriminator: 'security:observation-recorded', data: { junk: true } },
        }),
      ),
    );
    expect(error.code).toBe('validation');
  });

  it('an UNKNOWN discriminator name is rejected by the payload parser', () => {
    const error = expectError(parseSecurityEventData('security:not-a-kind', {}));
    expect(error.code).toBe('validation');
  });

  it('a tampered digest is detected at verification', () => {
    const sealed = unwrap(sealSecurityEvent(observationEvent()));
    const error = expectError(
      verifySealedSecurityEvent({ ...sealed, contentDigest: '0'.repeat(64) }),
    );
    expect(error.code).toBe('digest-mismatch');
  });

  it('a sequence below 1 is rejected', () => {
    const error = expectError(sealSecurityEvent(observationEvent({ sequence: 0 })));
    expect(error.code).toBe('validation');
  });

  it('vendor fields on the event are rejected (lock rule 13)', () => {
    const error = expectError(sealSecurityEvent({ ...observationEvent(), vendorBus: 'kafka' }));
    expect(error.code).toBe('vendor-fields-rejected');
  });
});
