/**
 * The provider port implementation: the reference chat provider
 * implementing the bridge's `ExternalEventProvider` contract (the SAME
 * contract any second generic provider satisfies — the W042
 * acceptance). The delivery behavior is scripted fixture DATA; the
 * recorded dispatch requests are kept for test assertions.
 */
import type {
  ExternalEventProvider,
  ProviderDeliveryOutcome,
  ProviderDispatchRequest,
  DeliveryAttemptContext,
} from '@epoch/external-event-bridge';
import { CHAT_PROVIDER_ADAPTER_DESCRIPTOR, CHAT_PROVIDER_ADAPTER_DESCRIPTOR_DIGEST } from './descriptor';
import { scriptedOutcomeOf, type ScriptedDeliveryStep } from './outbound';
import {
  SUPPORTED_INBOUND_CLASSES,
  SUPPORTED_OUTBOUND_CLASSES,
  EXTERNAL_EXCHANGE_CAPABILITY_ID,
  EXTERNAL_EXCHANGE_CAPABILITY_VERSION,
} from './version';

/** Options of {@link ChatReferenceProvider}. */
export interface ChatReferenceProviderOptions {
  /** The scripted delivery schedule (deterministic DATA; default: success). */
  readonly deliveryScript?: readonly ScriptedDeliveryStep[];
}

/**
 * The reference chat provider: the bridge provider port implemented
 * over fixture payloads (NO network, NO real provider calls). The
 * capability binding is the REAL W007 binding shape (the SDK type).
 */
export class ChatReferenceProvider implements ExternalEventProvider {
  public readonly descriptor = CHAT_PROVIDER_ADAPTER_DESCRIPTOR;
  public readonly capabilityBinding = {
    capabilityId: EXTERNAL_EXCHANGE_CAPABILITY_ID,
    versionRange: { kind: 'exact', version: EXTERNAL_EXCHANGE_CAPABILITY_VERSION },
  } as const;
  public readonly supportedInboundClasses = SUPPORTED_INBOUND_CLASSES;
  public readonly supportedOutboundClasses = SUPPORTED_OUTBOUND_CLASSES;
  /** Every dispatch request the provider received (test assertions). */
  public readonly deliveredRequests: ProviderDispatchRequest[] = [];

  private readonly deliveryScript: readonly ScriptedDeliveryStep[];

  constructor(options: ChatReferenceProviderOptions = {}) {
    this.deliveryScript = options.deliveryScript ?? [];
  }

  deliver(
    request: ProviderDispatchRequest,
    attempt: DeliveryAttemptContext,
  ): ProviderDeliveryOutcome {
    this.deliveredRequests.push(request);
    return scriptedOutcomeOf(this.deliveryScript, request, attempt);
  }
}

/** The adapter identity view (attribution for bridge provenance blocks). */
export const CHAT_PROVIDER_IDENTITY = {
  adapterId: CHAT_PROVIDER_ADAPTER_DESCRIPTOR.adapterId,
  adapterDescriptorDigest: CHAT_PROVIDER_ADAPTER_DESCRIPTOR_DIGEST,
} as const;
