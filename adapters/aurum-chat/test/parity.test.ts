// RUNTIME PARITY with the REAL sibling kernels (devDependencies — the
// frozen runtime dependency policy). The compile-time pins live in
// src/parity.ts; this file proves the same compatibility with real
// objects at runtime:
//
// - W036: the adapted event's observation intake proposal parses
//   through the REAL W036 DistinctionRecordContent validator and seals
//   through the REAL W036 sealDistinctionRecord (the authority path —
//   the adapter never writes observations);
// - W010: the bridge events the runtime host records seal through the
//   REAL W010 sealEvent and digest identically;
// - W006: the provenance payload digest grammar accepts a REAL
//   content-addressed evidence digest.
import { describe, expect, it } from 'vitest';
import { DistinctionRecordContentSchema, sealDistinctionRecord } from '@epoch/solution-delivery';
import { computeEventDigest, sealEvent } from '@epoch/event-log';
import { ExternalEventBridgeRuntime } from '@epoch/external-event-bridge';
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  adaptInboundMessage,
  referenceProviderMessage,
  ChatReferenceProvider,
  providerPayloadDigestOf,
  PROVIDER_T0,
  PROVIDER_T1,
  PROVIDER_T2,
  PROVIDER_OPERATOR,
  PROVIDER_TENANT_A,
} from '../src/index';

function gatePair(input: { actionKind: string; resourceId: string }) {
  const request = {
    schemaVersion: 1,
    principalId: PROVIDER_OPERATOR,
    actionKind: input.actionKind,
    resource: {
      resourceType: 'external-event-bridge',
      resourceId: input.resourceId,
      tenantId: PROVIDER_TENANT_A,
    },
  };
  return { request, decision: { requestDigest: canonicalDigest(request), outcome: 'allow' as const } };
}

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('W036 observation parity (the REAL authority path)', () => {
  it('the adapted observation-report event proposes observation intake the REAL W036 admits', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: PROVIDER_TENANT_A });
    const event = unwrap(
      adaptInboundMessage(referenceProviderMessage(), {
        eventId: 'bridge-event:chat-msg-1',
        tenantId: PROVIDER_TENANT_A,
        correlationId: 'corr:parity-1',
        causationId: null,
        occurredAt: PROVIDER_T1,
        idempotencyKey: 'idem:parity-1',
        confidence: { method: 'stated', value: 0.8 },
        reportedBy: PROVIDER_OPERATOR,
      }),
    );
    const outcome = unwrap(
      runtime.intakeExternalEvent({
        event,
        observationContext: {
          proposalId: 'intake:chat-msg-1',
          recordId: 'observation:site-b4-depth',
          subject: {
            solutionId: 'solution:site-works',
            subjectKind: 'delivery',
            subjectId: 'delivery:site-b4',
          },
          measure: { kind: 'quantity', value: '1250', unit: 'mm' },
          payload: {
            deliveryId: 'delivery:site-b4',
            observedAt: PROVIDER_T1,
            observedBy: 'principal:field-lead',
            evidence: [{ digest: event.source.providerPayloadDigest }],
          },
          recordedAt: PROVIDER_T1,
          recordedBy: 'principal:field-lead',
          uncertainty: {
            schemaVersion: 1,
            provenance: { kind: 'reported' },
            freshness: { state: 'fresh', assessedAt: PROVIDER_T1 },
            confidence: { method: 'stated', value: 0.8 },
          },
          proposedAt: PROVIDER_T2,
          proposedBy: PROVIDER_OPERATOR,
        },
        receivedAt: PROVIDER_T2,
        authorization: gatePair({ actionKind: 'bridge.event-intake', resourceId: 'bridge-event:chat-msg-1' }),
      }),
    );
    if (outcome.kind !== 'intake-admitted' || outcome.proposal === undefined) {
      throw new Error('the observation-report event must propose observation intake');
    }
    // The REAL W036 validator admits the proposal's observation slot:
    const w036Parsed = DistinctionRecordContentSchema.safeParse(outcome.proposal.observation);
    expect(w036Parsed.success).toBe(true);
    if (w036Parsed.success) {
      // ...and the REAL W036 authority seals it (the adapter NEVER writes observations):
      const sealed = sealDistinctionRecord(w036Parsed.data);
      expect(sealed.ok).toBe(true);
      if (sealed.ok) {
        expect(sealed.value.kind).toBe('observation');
        expect(sealed.value.contentDigest).toMatch(/^[0-9a-f]{64}$/);
      }
    }
  });
});

describe('W010 event parity (the REAL sealEvent admits bridge events)', () => {
  it('the recorded bridge events seal through the REAL W010 sealEvent and digest identically', () => {
    const runtime = new ExternalEventBridgeRuntime({ expectedTenantId: PROVIDER_TENANT_A });
    unwrap(
      runtime.registerProvider({
        provider: new ChatReferenceProvider(),
        tenantId: PROVIDER_TENANT_A,
        registeredAt: PROVIDER_T0,
        registeredBy: PROVIDER_OPERATOR,
        authorization: gatePair({
          actionKind: 'bridge.provider-registration',
          resourceId: 'registration:external-chat-reference',
        }),
      }),
    );
    const [recorded] = runtime.recordedEvents();
    if (recorded === undefined) throw new Error('the registration must emit a bridge event');
    const { contentDigest, ...content } = recorded;
    const theirs = unwrap(sealEvent(content));
    expect(contentDigest).toBe(theirs.digest);
    expect(computeEventDigest(content)).toBe(contentDigest);
  });
});

describe('W006 provenance parity (the exact-revision digest grammar)', () => {
  it('the provider payload digest is the canonical digest over the provider payload', () => {
    const message = referenceProviderMessage();
    expect(providerPayloadDigestOf(message)).toBe(canonicalDigest(message));
    expect(providerPayloadDigestOf(message)).toMatch(/^[0-9a-f]{64}$/);
  });
});
