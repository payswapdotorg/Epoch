/**
 * Deterministic bridge fixtures (zero wall-clock, zero randomness):
 * caller-supplied instants, tenants, principals, a scripted GENERIC
 * provider (no provider vocabulary — the concrete reference adapter
 * lives in adapters/aurum-chat), external events, observation contexts,
 * least-privilege projections and retry schedules.
 */
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  computeAdapterDescriptorDigest,
  type AdapterDescriptor,
  type CapabilityBinding,
} from '@epoch/adapter-sdk';
import {
  sealExternalEvent,
  type ExternalEventProvider,
  type ProviderDeliveryOutcome,
  type ProviderDispatchRequest,
  type DeliveryAttemptContext,
  type ObservationIntakeContext,
  type LeastPrivilegeProjection,
} from '../src/index';
import type { SealedExternalEvent } from '../src/index';

/** Caller-supplied instants (ascending). */
export const T0 = '2026-01-05T09:00:00.000Z';
export const T1 = '2026-01-05T09:05:00.000Z';
export const T2 = '2026-01-05T09:10:00.000Z';
export const T3 = '2026-01-05T09:20:00.000Z';
export const T4 = '2026-01-05T09:35:00.000Z';
export const T5 = '2026-01-05T09:50:00.000Z';

/** Tenants (the W009 grammar). */
export const TENANT_A = 'tenant:globex';
export const TENANT_B = 'tenant:acme';

/** The operating principal (the W009 grammar). */
export const PRINCIPAL = 'principal:bridge-ops';
export const FIELD_LEAD = 'principal:field-lead';

/** Recipient references (opaque). */
export const RECIPIENT_A = 'role:site-supervisor';
export const RECIPIENT_B = 'role:program-manager';

/** A sealed W041-shaped projection-policy digest (content address). */
export const POLICY_DIGEST_A = 'ab'.repeat(32);
export const POLICY_DIGEST_B = 'cd'.repeat(32);

/** Correlation / causation / idempotency keys. */
export const CORRELATION_1 = 'corr:exchange-1';
export const CORRELATION_2 = 'corr:exchange-2';
export const IDEMPOTENCY_1 = 'idem:exchange-1';
export const IDEMPOTENCY_2 = 'idem:exchange-2';
export const CAUSATION_1 = 'cause:detector-1';

/** The provider capability this reference set pins (W007 opaque ids). */
export const PROVIDER_CAPABILITY_ID = 'external.event-exchange';
export const PROVIDER_CAPABILITY_VERSION = '1.0.0';
export const PROVIDER_CAPABILITY_BINDING: CapabilityBinding = {
  capabilityId: PROVIDER_CAPABILITY_ID,
  versionRange: { kind: 'exact', version: PROVIDER_CAPABILITY_VERSION },
};

/** The first generic provider descriptor (alphabetically first). */
export const GENERIC_DESCRIPTOR_A: AdapterDescriptor = {
  schemaVersion: 1,
  adapterId: 'adapter:generic-alpha',
  category: 'source',
  displayName: 'Generic External-Event Provider Alpha (fixture)',
  description:
    'Deterministic test-double provider: implements the bridge provider contract with a scripted delivery outcome sequence.',
  binding: PROVIDER_CAPABILITY_BINDING,
};

/** The second generic provider descriptor (alphabetically second). */
export const GENERIC_DESCRIPTOR_B: AdapterDescriptor = {
  schemaVersion: 1,
  adapterId: 'adapter:generic-beta',
  category: 'source',
  displayName: 'Generic External-Event Provider Beta (fixture)',
  description:
    'Deterministic test-double provider: implements the same bridge provider contract with a different scripted sequence.',
  binding: PROVIDER_CAPABILITY_BINDING,
};

export const DESCRIPTOR_DIGEST_A = computeAdapterDescriptorDigest(GENERIC_DESCRIPTOR_A);
export const DESCRIPTOR_DIGEST_B = computeAdapterDescriptorDigest(GENERIC_DESCRIPTOR_B);

/**
 * The scripted GENERIC provider: a test double implementing the bridge
 * provider contract. The delivery script maps attempt numbers to typed
 * outcomes; the recorded dispatch requests are kept for assertions.
 */
export class ScriptedProvider implements ExternalEventProvider {
  public readonly delivered: ProviderDispatchRequest[] = [];

  constructor(
    public readonly descriptor: AdapterDescriptor,
    public readonly capabilityBinding: CapabilityBinding,
    public readonly supportedInboundClasses: readonly ExternalEventProvider['supportedInboundClasses'][number][],
    public readonly supportedOutboundClasses: readonly ExternalEventProvider['supportedOutboundClasses'][number][],
    private readonly script: Readonly<Record<number, ProviderDeliveryOutcome>>,
  ) {}

  deliver(request: ProviderDispatchRequest, attempt: DeliveryAttemptContext): ProviderDeliveryOutcome {
    this.delivered.push(request);
    return (
      this.script[attempt.attemptNo] ?? {
        outcome: 'success',
        providerDeliveryRef: `${this.descriptor.adapterId}:delivery-${attempt.attemptNo}`,
      }
    );
  }
}

/** A provider delivering successfully on the first attempt. */
export function deliveringProvider(
  descriptor: AdapterDescriptor = GENERIC_DESCRIPTOR_A,
): ScriptedProvider {
  return new ScriptedProvider(
    descriptor,
    PROVIDER_CAPABILITY_BINDING,
    ['observation-report', 'status-report', 'acknowledgement'],
    ['information', 'status', 'alert', 'acknowledgement-request'],
    {},
  );
}

/** A provider failing terminally on the first attempt. */
export function terminalProvider(
  descriptor: AdapterDescriptor = GENERIC_DESCRIPTOR_A,
): ScriptedProvider {
  return new ScriptedProvider(
    descriptor,
    PROVIDER_CAPABILITY_BINDING,
    ['observation-report'],
    ['information', 'status', 'alert', 'acknowledgement-request'],
    {
      1: { outcome: 'terminal', detail: 'the provider fixture refuses this delivery' },
    },
  );
}

/** A provider failing once (retryable) then succeeding. */
export function flakyProvider(
  descriptor: AdapterDescriptor = GENERIC_DESCRIPTOR_A,
): ScriptedProvider {
  return new ScriptedProvider(
    descriptor,
    PROVIDER_CAPABILITY_BINDING,
    ['observation-report'],
    ['information', 'status', 'alert', 'acknowledgement-request'],
    {
      1: { outcome: 'retryable', detail: 'transient provider fixture congestion' },
    },
  );
}

/** A provider supporting ONLY the information class (class resolution fixture). */
export function informationOnlyProvider(
  descriptor: AdapterDescriptor = GENERIC_DESCRIPTOR_B,
): ScriptedProvider {
  return new ScriptedProvider(
    descriptor,
    PROVIDER_CAPABILITY_BINDING,
    ['information-response'],
    ['information'],
    {},
  );
}

/** The reference external-event fixture (an observation report). */
export function referenceExternalEvent(
  overrides?: Partial<{
    eventId: string;
    tenantId: string;
    eventClass: SealedExternalEvent['eventClass'];
    idempotencyKey: string;
    correlationId: string;
    causationId: string | null;
    payload: Record<string, unknown>;
    providerPayloadDigest: string;
  }>,
): SealedExternalEvent {
  const sealed = sealExternalEvent({
    schema: 'epoch.external-event-bridge.external-event',
    schemaVersion: 1,
    eventId: overrides?.eventId ?? 'bridge-event:msg-1',
    tenantId: overrides?.tenantId ?? TENANT_A,
    eventClass: overrides?.eventClass ?? 'observation-report',
    source: {
      kind: 'reported',
      adapterId: 'adapter:generic-alpha',
      adapterDescriptorDigest: DESCRIPTOR_DIGEST_A,
      providerEventRef: 'provider-msg-1',
      providerPayloadDigest: overrides?.providerPayloadDigest ?? '3a'.repeat(32),
    },
    correlationId: overrides?.correlationId ?? CORRELATION_1,
    causationId: overrides?.causationId ?? null,
    occurredAt: T1,
    payload: (overrides?.payload ?? {
      note: 'excavation depth measured at grid B4',
      depthMm: 1250,
    }) as Record<string, never>,
    confidence: { method: 'measured', value: 0.9 },
    idempotencyKey: overrides?.idempotencyKey ?? IDEMPOTENCY_1,
  });
  if (!sealed.ok) throw new Error(sealed.error.message);
  return sealed.value;
}

/** A REAL W036-valid observation context (subject/measure/payload/uncertainty). */
export function referenceObservationContext(
  overrides?: Partial<ObservationIntakeContext>,
): ObservationIntakeContext {
  return {
    proposalId: 'intake:msg-1',
    recordId: 'observation:site-a-depth',
    subject: {
      solutionId: 'solution:site-works',
      subjectKind: 'delivery',
      subjectId: 'delivery:site-a',
    },
    measure: { kind: 'quantity', value: '1250', unit: 'mm' },
    payload: {
      deliveryId: 'delivery:site-a',
      observedAt: T1,
      observedBy: FIELD_LEAD,
      evidence: [{ digest: '3a'.repeat(32) }],
    },
    recordedAt: T1,
    recordedBy: FIELD_LEAD,
    uncertainty: {
      schemaVersion: 1,
      provenance: { kind: 'reported' },
      freshness: { state: 'fresh', assessedAt: T1 },
      confidence: { method: 'measured', value: 0.9 },
    },
    proposedAt: T2,
    proposedBy: PRINCIPAL,
    ...overrides,
  };
}

/** The minimum-necessary recipient projection fixture. */
export function referenceProjection(
  overrides?: Partial<LeastPrivilegeProjection>,
): LeastPrivilegeProjection {
  return {
    policyDigest: POLICY_DIGEST_A,
    recipientRef: RECIPIENT_A,
    fieldAllowlist: ['activityTitle', 'questions[].channel', 'questions[].text', 'statusSummary', 'workPackageRef'],
    ...overrides,
  };
}

/** A caller-supplied retry schedule (typed DATA — ascending instants). */
export function referenceRetryPolicy(): { attemptInstants: string[] } {
  return { attemptInstants: [T2, T3, T4] };
}

/** The raw outbound information payload fixture (pre-filtering). */
export const RAW_INFORMATION_PAYLOAD: Record<string, unknown> = {
  activityTitle: 'Excavate grid B4 to foundation level',
  workPackageRef: 'work-package:earthworks',
  statusSummary: 'Awaiting confirmation of achieved depth',
  questions: [
    { text: 'Confirm the measured depth at grid B4', channel: 'field-report' },
  ],
  internalCommercialNote: 'contract penalty threshold is 14 days',
  supplierIdentity: 'supplier:acme-excavation',
};

/** The digest of an arbitrary JSON value (test convenience). */
export function digestOf(value: unknown): string {
  return canonicalDigest(value as never);
}
