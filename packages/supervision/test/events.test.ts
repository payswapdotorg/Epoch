// The supervision:* event vocabulary over the W010 shapes: sealing,
// payload-family discipline, causal chains, tamper detection, stream
// derivation, and round-trip serialization.
import { describe, expect, it } from 'vitest';
import {
  computeSupervisionEventDigest,
  parseSupervisionEventData,
  sealSupervisionEvent,
  supervisionHostStreamIdOf,
  supervisionStreamIdOf,
  verifySealedSupervisionEvent,
} from '../src/index';
import {
  EVAL_IN_WINDOW,
  PROGRAM_ID,
  PRINCIPAL,
  TENANT,
  T3,
  T4,
  expectError,
} from './fixtures';

function eventContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    streamId: supervisionStreamIdOf(PROGRAM_ID),
    sequence: 1,
    tenantId: TENANT,
    actor: PRINCIPAL,
    causalParent: null,
    payload: {
      discriminator: 'supervision:program-registered',
      data: {
        programId: PROGRAM_ID,
        programDigest: 'a'.repeat(64),
        registeredAt: T3,
      },
    },
    occurredAt: T3,
    ...overrides,
  };
}

describe('supervision:* events (W010 shapes)', () => {
  it('seals a program-registered event and derives the stream deterministically', () => {
    expect(supervisionStreamIdOf(PROGRAM_ID)).toBe('stream:supervision-tower-retrofit-v1');
    expect(supervisionHostStreamIdOf(TENANT)).toBe('stream:supervision-host-globex');
    const sealed = unwrap2(sealSupervisionEvent(eventContent()));
    expect(sealed.contentDigest).toBe(computeSupervisionEventDigest(eventContent() as never));
    expect(sealed.payload.discriminator).toBe('supervision:program-registered');
  });

  it('a same-stream causal parent must be strictly earlier (broken chain)', () => {
    const error = expectError(
      sealSupervisionEvent(
        eventContent({
          sequence: 1,
          causalParent: { streamId: supervisionStreamIdOf(PROGRAM_ID), sequence: 1 },
        }),
      ),
    );
    expect(error.code).toBe('validation');
  });

  it('payload data must satisfy the discriminator contract (payload-family discipline)', () => {
    const error = expectError(
      sealSupervisionEvent(
        eventContent({
          payload: {
            discriminator: 'supervision:finding-produced',
            data: { findingId: 'not-a-finding-id' },
          },
        }),
      ),
    );
    expect(error.code).toBe('validation');
    expect(error.message).toContain('supervision:finding-produced');
  });

  it('parseSupervisionEventData validates every discriminator of the vocabulary', () => {
    const parsed = parseSupervisionEventData('supervision:pass-evaluated', {
      passId: 'pass:week-1',
      passDigest: 'a'.repeat(64),
      programId: PROGRAM_ID,
      deliveryId: 'delivery:tower-retrofit-v1',
      findingCount: 2,
      evaluatedAt: EVAL_IN_WINDOW,
    });
    expect(parsed.ok).toBe(true);
    const unknown = parseSupervisionEventData('supervision:not-a-real-kind', {});
    expect(unknown.ok).toBe(false);
  });

  it('a TAMPERED sealed event is rejected (digest-mismatch)', () => {
    const sealed = unwrap2(sealSupervisionEvent(eventContent()));
    const tampered = { ...sealed, contentDigest: '0'.repeat(64) };
    const error = expectError(verifySealedSupervisionEvent(tampered));
    expect(error.code).toBe('digest-mismatch');
  });

  it('an event with an unrecognized key is VENDOR-FIELDS-REJECTED', () => {
    const error = expectError(sealSupervisionEvent(eventContent({ vendorField: 'x' })));
    expect(error.code).toBe('vendor-fields-rejected');
  });

  it('a contiguous causal chain seals in order (sequence + parent)', () => {
    const first = unwrap2(sealSupervisionEvent(eventContent()));
    const second = unwrap2(
      sealSupervisionEvent(
        eventContent({
          sequence: 2,
          causalParent: { streamId: supervisionStreamIdOf(PROGRAM_ID), sequence: 1 },
          payload: {
            discriminator: 'supervision:pass-evaluated',
            data: {
              passId: 'pass:week-1',
              passDigest: 'b'.repeat(64),
              programId: PROGRAM_ID,
              deliveryId: 'delivery:tower-retrofit-v1',
              findingCount: 0,
              evaluatedAt: T4,
            },
          },
          occurredAt: T4,
        }),
      ),
    );
    expect(second.sequence).toBe(2);
    expect(second.causalParent).toEqual({ streamId: supervisionStreamIdOf(PROGRAM_ID), sequence: 1 });
    expect(first.contentDigest).not.toBe(second.contentDigest);
  });

  it('round-trip serialization preserves the digest (JSON stability)', () => {
    const sealed = unwrap2(sealSupervisionEvent(eventContent()));
    const roundTripped = JSON.parse(JSON.stringify(sealed));
    const verified = unwrap2(verifySealedSupervisionEvent(roundTripped));
    expect(verified.contentDigest).toBe(sealed.contentDigest);
  });
});

function unwrap2<T>(
  result: { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: unknown },
): T {
  if (!result.ok) {
    throw new Error(`event fixture failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}
