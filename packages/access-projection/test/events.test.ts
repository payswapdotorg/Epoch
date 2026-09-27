// The access-projection:* event family over the W010 shapes: typed
// payloads for every discriminator, the closed vocabulary, the
// payload-family parse discipline, and the causal-parent rule.
import { describe, expect, it } from 'vitest';
import {
  ACCESS_PROJECTION_EVENT_DISCRIMINATORS,
  accessStateStreamIdOf,
  accessStreamIdOf,
  parseAccessProjectionEventData,
  sealAccessProjectionEvent,
  type SealedAccessProjectionEvent,
} from '../src/index';
import { unwrap, expectError } from './helpers';
import { HOST, PROGRAM_ID, TENANT, T3 } from './fixtures';

function event(partial: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    streamId: accessStreamIdOf(PROGRAM_ID),
    sequence: 1,
    tenantId: TENANT,
    actor: HOST,
    causalParent: null,
    payload: {
      discriminator: 'access-projection:policy-registered',
      data: {
        policyId: 'policy:tower-retrofit-access',
        revision: 1,
        policyDigest: 'a'.repeat(64),
        status: 'active',
        bindingCount: 4,
      },
    },
    occurredAt: T3,
    ...partial,
  };
}

describe('the event vocabulary (open namespace, closed set)', () => {
  it('every discriminator is namespaced access-projection:*', () => {
    expect(ACCESS_PROJECTION_EVENT_DISCRIMINATORS).toHaveLength(6);
    for (const discriminator of ACCESS_PROJECTION_EVENT_DISCRIMINATORS) {
      expect(discriminator).toMatch(/^access-projection:[a-z][a-z0-9-]*$/);
    }
  });

  it('stream ids derive deterministically from object/policy/tenant ids', () => {
    expect(accessStreamIdOf(PROGRAM_ID)).toBe('stream:access-program-tower-retrofit');
    expect(accessStreamIdOf('policy:tower-retrofit-access')).toBe(
      'stream:access-policy-tower-retrofit-access',
    );
    expect(accessStateStreamIdOf(TENANT)).toBe('stream:access-state-tenant-globex');
  });
});

describe('typed payload data (the W010 payload-family discipline)', () => {
  it('every discriminator parses its own valid data', () => {
    const samples: Record<string, Record<string, unknown>> = {
      'access-projection:policy-registered': {
        policyId: 'policy:p',
        revision: 1,
        policyDigest: 'a'.repeat(64),
        status: 'active',
        bindingCount: 2,
      },
      'access-projection:record-admitted': {
        objectClass: 'program-of-work',
        objectId: PROGRAM_ID,
        objectDigest: 'b'.repeat(64),
      },
      'access-projection:projection-released': {
        objectClass: 'program-of-work',
        objectId: PROGRAM_ID,
        objectDigest: 'b'.repeat(64),
        principalId: HOST,
        action: 'view',
        policyDigest: 'a'.repeat(64),
        projectionDigest: 'c'.repeat(64),
        auditDigest: 'd'.repeat(64),
        releasedFieldCount: 10,
        redactedFieldCount: 5,
      },
      'access-projection:projection-denied': {
        objectClass: 'program-of-work',
        objectId: PROGRAM_ID,
        objectDigest: 'b'.repeat(64),
        principalId: HOST,
        action: 'export',
        policyDigest: 'a'.repeat(64),
        auditDigest: 'd'.repeat(64),
        denialCode: 'export-without-grant-rejected',
      },
      'access-projection:audit-recorded': {
        auditId: 'audit:0123456789abcdef',
        evaluationKey: 'e'.repeat(64),
        auditDigest: 'd'.repeat(64),
        outcome: 'released',
      },
      'access-projection:state-projected': {
        policyCount: 1,
        recordCount: 1,
        projectionCount: 0,
        auditCount: 0,
      },
    };
    for (const [discriminator, data] of Object.entries(samples)) {
      const parsed = unwrap(parseAccessProjectionEventData(discriminator, data));
      expect(parsed).toEqual(data);
    }
  });

  it('an unknown discriminator is a typed validation error', () => {
    expectError(
      parseAccessProjectionEventData('access-projection:unknown-kind', {}),
      'validation',
    );
    expectError(parseAccessProjectionEventData('procurement:po-issued', {}), 'validation');
  });

  it('malformed payload data is a typed validation error', () => {
    expectError(
      parseAccessProjectionEventData('access-projection:policy-registered', {
        policyId: 'policy:p',
        revision: 0,
        policyDigest: 'a'.repeat(64),
        status: 'active',
        bindingCount: 2,
      }),
      'validation',
    );
    expectError(
      parseAccessProjectionEventData('access-projection:state-projected', {
        policyCount: -1,
        recordCount: 0,
        projectionCount: 0,
        auditCount: 0,
      }),
      'validation',
    );
  });
});

describe('event sealing (the W010 envelope rules)', () => {
  it('a same-stream causal parent must be strictly earlier', () => {
    expectError(
      sealAccessProjectionEvent(
        event({
          sequence: 2,
          causalParent: { streamId: accessStreamIdOf(PROGRAM_ID), sequence: 2 },
        }),
      ),
      'validation',
    );
  });

  it('a cross-stream causal parent is allowed (the W010 rule)', () => {
    const sealed = unwrap(
      sealAccessProjectionEvent(
        event({
          causalParent: { streamId: 'stream:access-other', sequence: 7 },
        }),
      ),
    );
    expect(sealed.causalParent).toEqual({ streamId: 'stream:access-other', sequence: 7 });
  });

  it('a vendor field on an event is vendor-fields-rejected', () => {
    expectError(
      sealAccessProjectionEvent(event({ webhookUrl: 'https://vendor.example' })),
      'vendor-fields-rejected',
    );
  });

  it('sealed events carry their canonical digest', () => {
    const sealed: SealedAccessProjectionEvent = unwrap(sealAccessProjectionEvent(event()));
    expect(sealed.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(sealed.payload.discriminator).toBe('access-projection:policy-registered');
  });
});
