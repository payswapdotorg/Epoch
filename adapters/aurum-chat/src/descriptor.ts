/**
 * The W007 adapter descriptors (typed, content-addressed,
 * provider-neutral — the descriptor NEVER names the provider).
 */
import { computeAdapterDescriptorDigest, type AdapterDescriptor } from '@epoch/adapter-sdk';
import {
  EXTERNAL_EXCHANGE_CAPABILITY_ID,
  EXTERNAL_EXCHANGE_CAPABILITY_VERSION,
} from './version';

/** The source-category adapter descriptor (the bridge provider port). */
export const CHAT_PROVIDER_ADAPTER_DESCRIPTOR: AdapterDescriptor = {
  schemaVersion: 1,
  adapterId: 'adapter:external-chat-reference',
  category: 'source',
  displayName: 'External Chat Reference Provider (fixture-driven)',
  description:
    'Reference provider for the external event bridge: normalizes fixture chat payloads into bridge external events and delivers bridge dispatch requests as scripted fixture outcomes. In-memory reference behavior — no network, no live provider calls.',
  binding: {
    capabilityId: EXTERNAL_EXCHANGE_CAPABILITY_ID,
    versionRange: { kind: 'exact', version: EXTERNAL_EXCHANGE_CAPABILITY_VERSION },
  },
};

/** The exact descriptor digest (content address; the REAL SDK discipline). */
export const CHAT_PROVIDER_ADAPTER_DESCRIPTOR_DIGEST = computeAdapterDescriptorDigest(
  CHAT_PROVIDER_ADAPTER_DESCRIPTOR,
);

/** The adapter's identity view for bridge provenance blocks. */
export const CHAT_ADAPTER_IDENTITY = {
  adapterId: CHAT_PROVIDER_ADAPTER_DESCRIPTOR.adapterId,
  adapterDescriptorDigest: CHAT_PROVIDER_ADAPTER_DESCRIPTOR_DIGEST,
} as const;
