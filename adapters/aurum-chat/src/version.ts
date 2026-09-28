/**
 * @epoch/adapter-aurum-chat — contract versions and closed vocabularies.
 *
 * NEUTRAL SEAM (architecture lock rule 13: provider behavior is
 * adapterized): every vocabulary below names typed, provider-neutral
 * concepts of the external exchange adapter surface — the normalized
 * event classes and outbound request classes this adapter declares
 * support for (the bridge's own vocabularies, imported), the W007
 * category and capability binding it serves. The concrete provider's
 * vocabulary (service names, message/thread/user field names) lives
 * ONLY in `src/provider/` and never crosses this seam; the per-adapter
 * neutrality blocklist test pins that boundary (the W029 pattern).
 */

/** Version of the published adapter contract surface (types + vocabularies). */
export const AURUM_CHAT_ADAPTER_CONTRACT_VERSION = '1.0.0' as const;

/** Version discriminator carried by every serialized adapter record. */
export const AURUM_CHAT_ADAPTER_RECORD_VERSION = 1 as const;

/** The contract ids this package issues for W007 contract references. */
export const AURUM_CHAT_PROVIDER_CONTRACT_ID = 'epoch.adapter.external-chat-provider' as const;

/** The W007 adapter categories this package implements (the source seam). */
export const AURUM_CHAT_ADAPTER_CATEGORIES = ['source'] as const;

/** The W007 capability this reference adapter binds (the bridge provider port). */
export const EXTERNAL_EXCHANGE_CAPABILITY_ID = 'external.event-exchange' as const;

/** The capability version this reference adapter pins (exact). */
export const EXTERNAL_EXCHANGE_CAPABILITY_VERSION = '1.0.0' as const;

/**
 * The inbound event classes this adapter declares support for (the
 * bridge vocabulary): the chat surface reports observations, evidence
 * references, acknowledgements, information responses, status reports,
 * exceptions, and communication receipts.
 */
export const SUPPORTED_INBOUND_CLASSES = [
  'acknowledgement',
  'communication-receipt',
  'evidence-reference',
  'exception',
  'information-response',
  'observation-report',
  'status-report',
] as const;

/**
 * The outbound request classes this adapter declares support for (the
 * bridge vocabulary): the chat surface delivers all four classes.
 */
export const SUPPORTED_OUTBOUND_CLASSES = [
  'acknowledgement-request',
  'alert',
  'information',
  'status',
] as const;

/** The neutral event-class mapping of provider message kinds (the adapter seam). */
export const PROVIDER_MESSAGE_KINDS = [
  'observation',
  'acknowledgement',
  'information-response',
  'status',
  'exception',
  'receipt',
  'evidence',
] as const;

/** One provider message kind (the provider's own vocabulary, quarantined upstream). */
export type ProviderMessageKind = (typeof PROVIDER_MESSAGE_KINDS)[number];

/** The bridge event class each provider message kind normalizes to. */
export const PROVIDER_KIND_TO_EVENT_CLASS: Readonly<Record<ProviderMessageKind, string>> = {
  observation: 'observation-report',
  acknowledgement: 'acknowledgement',
  'information-response': 'information-response',
  status: 'status-report',
  exception: 'exception',
  receipt: 'communication-receipt',
  evidence: 'evidence-reference',
};
