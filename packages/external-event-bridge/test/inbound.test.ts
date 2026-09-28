// INBOUND positive flows: normalized external events admit as W036-shaped
// observation intake proposals through the authority path; duplicate
// delivery returns the SEALED PRIOR receipt (never a second effect);
// bridge:* events are recorded W010-shaped.
import { describe, expect, it } from 'vitest';
import {
  ExternalEventBridgeRuntime,
  buildObservationIntakeProposal,
  sealExternalEvent,
} from '../src/index';
import {
  IDEMPOTENCY_1,
  IDEMPOTENCY_2,
  TENANT_A,
  T1,
  T2,
  referenceExternalEvent,
  referenceObservationContext,
} from './fixtures';
import { gatePair, unwrap } from './helpers';

describe('inbound: intake + observation proposals (the authority path)', () => {
  it('an observation-report event admits and proposes W036-shaped observation intake', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    const event = referenceExternalEvent();
    const outcome = unwrap(
      runtime.intakeExternalEvent({
        event,
        observationContext: referenceObservationContext(),
        receivedAt: T2,
        authorization: gatePair({
          actionKind: 'bridge.event-intake',
          resourceId: 'bridge-event:msg-1',
        }),
      }),
    );
    expect(outcome.kind).toBe('intake-admitted');
    if (outcome.kind === 'intake-admitted') {
      expect(outcome.receipt.disposition).toBe('admitted');
      expect(outcome.proposal).toBeDefined();
      if (outcome.proposal !== undefined) {
        // The proposal is W036-SHAPED: the observation slot carries the
        // W036 distinction-record discriminator + kind + kind-prefixed id.
        expect(outcome.proposal.observation.schema).toBe('epoch.solution-delivery.distinction-record');
        expect(outcome.proposal.observation.kind).toBe('observation');
        expect(outcome.proposal.observation.recordId).toBe('observation:site-a-depth');
        // The proposal cites the exact external-event revision.
        expect(outcome.proposal.sourceEventDigest).toBe(event.contentDigest);
        expect(outcome.receipt.proposalDigest).toBe(outcome.proposal.contentDigest);
      }
    }
    const events = runtime.recordedEvents();
    expect(events.map((e) => e.payload.discriminator)).toEqual([
      'bridge:event-received',
      'bridge:intake-proposed',
    ]);
  });

  it('duplicate delivery (same key, same content) returns the SEALED PRIOR receipt — never a second effect', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    const event = referenceExternalEvent();
    const first = unwrap(
      runtime.intakeExternalEvent({
        event,
        observationContext: referenceObservationContext(),
        receivedAt: T2,
        authorization: gatePair({ actionKind: 'bridge.event-intake', resourceId: 'bridge-event:msg-1' }),
      }),
    );
    const second = unwrap(
      runtime.intakeExternalEvent({
        event,
        observationContext: referenceObservationContext(),
        receivedAt: T1, // a different caller-supplied instant — irrelevant: prior receipt
        authorization: gatePair({ actionKind: 'bridge.event-intake', resourceId: 'bridge-event:msg-1' }),
      }),
    );
    expect(second.kind).toBe('duplicate-intake-returned');
    if (first.kind === 'intake-admitted' && second.kind === 'duplicate-intake-returned') {
      expect(second.receipt.contentDigest).toBe(first.receipt.contentDigest);
      expect(second.proposal?.contentDigest).toBe(first.proposal?.contentDigest);
    }
    // NO second effect: one intake, one proposal, the two first events only.
    const state = runtime.state();
    expect(state.intakeCount).toBe(1);
    expect(state.proposalCount).toBe(1);
    expect(state.eventCount).toBe(2);
  });

  it('a non-observation event admits without a proposal (report intake only)', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    const outcome = unwrap(
      runtime.intakeExternalEvent({
        event: referenceExternalEvent({ eventClass: 'status-report', idempotencyKey: IDEMPOTENCY_2 }),
        receivedAt: T2,
        authorization: gatePair({ actionKind: 'bridge.event-intake', resourceId: 'bridge-event:msg-1' }),
      }),
    );
    expect(outcome.kind).toBe('intake-admitted');
    if (outcome.kind === 'intake-admitted') {
      expect(outcome.proposal).toBeUndefined();
      expect(outcome.receipt.proposalDigest).toBeUndefined();
    }
  });

  it('the pure adapter step builds a sealed proposal citing the exact event revision', () => {
    const event = referenceExternalEvent();
    const proposal = unwrap(
      buildObservationIntakeProposal(event, referenceObservationContext()),
    );
    expect(proposal.sourceEventId).toBe(event.eventId);
    expect(proposal.sourceEventDigest).toBe(event.contentDigest);
    expect(proposal.correlationId).toBe(event.correlationId);
    expect(proposal.causationId).toBe(event.causationId);
    expect(proposal.contentDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('an observation context on a non-observation event is a typed validation error', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: TENANT_A });
    const result = runtime.intakeExternalEvent({
      event: referenceExternalEvent({ eventClass: 'status-report', idempotencyKey: IDEMPOTENCY_1 }),
      observationContext: referenceObservationContext(),
      receivedAt: T2,
      authorization: gatePair({ actionKind: 'bridge.event-intake', resourceId: 'bridge-event:msg-1' }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('validation');
      expect(result.error.message).toContain('observation-report');
    }
  });

  it('sealing is deterministic: the same event content seals to the same digest', () => {
    const content = {
      schema: 'epoch.external-event-bridge.external-event',
      schemaVersion: 1,
      eventId: 'bridge-event:msg-9',
      tenantId: TENANT_A,
      eventClass: 'acknowledgement',
      source: {
        kind: 'reported',
        adapterId: 'adapter:generic-alpha',
        adapterDescriptorDigest: '1f'.repeat(32),
        providerEventRef: 'provider-msg-9',
        providerPayloadDigest: '9b'.repeat(32),
      },
      correlationId: 'corr:exchange-9',
      causationId: null,
      occurredAt: T1,
      payload: { acknowledged: true },
      confidence: { method: 'stated', value: 1 },
      idempotencyKey: 'idem:exchange-9',
    } as const;
    const a = unwrap(sealExternalEvent(content));
    const b = unwrap(sealExternalEvent({ ...content }));
    expect(a.contentDigest).toBe(b.contentDigest);
  });
});
