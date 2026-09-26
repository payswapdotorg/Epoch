// THE execution:* EVENT VOCABULARY over the W010 shapes: sealing, typed
// payload parsing, stream derivation (one stream per work package),
// broken causal chains, and tamper detection.
import { describe, expect, it } from 'vitest';
import {
  executionStreamIdOf,
  parseExecutionEventData,
  sealExecutionEvent,
  verifySealedExecutionEvent,
  EXECUTION_EVENT_DISCRIMINATORS,
  TRACKING_TRANSITIONS,
} from '../src/index';
import { PRINCIPAL, TENANT, T1, T2, WORK_PACKAGE_ID } from './fixtures';
import { expectError, unwrap } from './helpers';

function eventContent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    streamId: executionStreamIdOf(WORK_PACKAGE_ID),
    sequence: 1,
    tenantId: TENANT,
    actor: PRINCIPAL,
    causalParent: null,
    payload: {
      discriminator: 'execution:tracking-recorded',
      data: {
        workPackageId: WORK_PACKAGE_ID,
        trackingRecordId: 'state:excavate-start',
        fromState: 'not-started',
        toState: 'in-progress',
        observedAt: T1,
      },
    },
    occurredAt: T1,
    ...overrides,
  };
}

describe('execution events (positive)', () => {
  it('seals and verifies an execution event (one stream per work package)', () => {
    const sealed = unwrap(sealExecutionEvent(eventContent()));
    expect(sealed.streamId).toBe('stream:execution-earthworks');
    expect(verifySealedExecutionEvent(sealed).ok).toBe(true);
  });

  it('the causal chain links strictly earlier events', () => {
    const second = unwrap(
      sealExecutionEvent(
        eventContent({
          sequence: 2,
          causalParent: { streamId: executionStreamIdOf(WORK_PACKAGE_ID), sequence: 1 },
          occurredAt: T2,
        }),
      ),
    );
    expect(second.causalParent?.sequence).toBe(1);
  });

  it('the typed payload data parses for every discriminator of the vocabulary', () => {
    expect(EXECUTION_EVENT_DISCRIMINATORS.length).toBeGreaterThanOrEqual(9);
    for (const discriminator of EXECUTION_EVENT_DISCRIMINATORS) {
      const payload = { discriminator, data: {} };
      const parsed = parseExecutionEventData(payload);
      // Every member selects a typed schema (empty data fails the typed
      // shape — the discriminator itself is a member of the vocabulary).
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) {
        expect(parsed.error.code).toBe('validation');
        expect(JSON.stringify(parsed.error)).not.toContain('does not select');
      }
    }
  });

  it('a tracking-recorded payload parses with its typed shape', () => {
    const parsed = unwrap(
      parseExecutionEventData({
        discriminator: 'execution:tracking-recorded',
        data: {
          workPackageId: WORK_PACKAGE_ID,
          trackingRecordId: 'state:excavate-start',
          fromState: 'not-started',
          toState: 'in-progress',
          observedAt: T1,
        },
      }),
    );
    expect(parsed.toState).toBe('in-progress');
  });

  it('the tracking transitions table pins the state vocabulary arcs', () => {
    expect(TRACKING_TRANSITIONS.completed).toEqual([]);
    expect(TRACKING_TRANSITIONS.blocked).toContain('in-progress');
    expect(TRACKING_TRANSITIONS['not-started']).toContain('completed');
  });
});

describe('execution events (negative)', () => {
  it('a same-stream causal parent at or after the event sequence is a broken chain (validation)', () => {
    const sealed = sealExecutionEvent(
      eventContent({
        sequence: 1,
        causalParent: { streamId: executionStreamIdOf(WORK_PACKAGE_ID), sequence: 1 },
      }),
    );
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(JSON.stringify(sealed.error)).toContain('strictly earlier');
    }
  });

  it('a tampered event digest is digest-mismatch', () => {
    const sealed = unwrap(sealExecutionEvent(eventContent()));
    const error = expectError(verifySealedExecutionEvent({ ...sealed, contentDigest: 'd'.repeat(64) }));
    expect(error.code).toBe('digest-mismatch');
  });

  it('a tampered event payload is digest-mismatch', () => {
    const sealed = unwrap(sealExecutionEvent(eventContent()));
    const tampered = {
      ...sealed,
      payload: { ...sealed.payload, data: { ...sealed.payload.data, toState: 'completed' } },
    };
    const error = expectError(verifySealedExecutionEvent(tampered));
    expect(error.code).toBe('digest-mismatch');
  });

  it('a payload discriminator outside the vocabulary is a validation failure', () => {
    const error = expectError(
      parseExecutionEventData({ discriminator: 'execution:not-a-member', data: {} }),
    );
    expect(error.code).toBe('validation');
    expect(error.message).toContain('does not select');
  });

  it('sequence zero is invalid (1-based)', () => {
    const sealed = sealExecutionEvent(eventContent({ sequence: 0 }));
    expect(sealed.ok).toBe(false);
  });

  it('a vendor field on the event is vendor-fields-rejected', () => {
    const sealed = sealExecutionEvent({ ...eventContent(), telemetryVendor: 'acme-iot' });
    expect(sealed.ok).toBe(false);
    if (!sealed.ok) {
      expect(sealed.error.code).toBe('vendor-fields-rejected');
    }
  });
});
