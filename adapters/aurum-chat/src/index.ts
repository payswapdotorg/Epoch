/**
 * @epoch/adapter-aurum-chat — public API (service layer, Work Order W042).
 *
 * The REFERENCE provider adapter for the external event bridge (the
 * W029 adapter pattern): a fixture-driven, in-memory stand-in for an
 * external team-chat system that implements the bridge's provider
 * contract.
 *
 * - INBOUND: provider chat-message payloads (fixtures) normalize into
 *   bridge ExternalEvent records — W006-shaped provenance carrying the
 *   adapter identity + the EXACT provider payload digest, correlation
 *   and causation ids, caller-supplied instants, and an idempotency
 *   key. Observation-report events then flow through the bridge's
 *   W036-shaped observation INTAKE PROPOSAL machinery (the authority
 *   path — this adapter NEVER writes observations).
 * - OUTBOUND: bridge dispatch requests become scripted fixture
 *   delivery outcomes (success / retryable / terminal) with
 *   content-addressed provider delivery references.
 * - The provider port: `ChatReferenceProvider` implements the REAL
 *   bridge `ExternalEventProvider` contract — the SAME contract a
 *   second generic provider satisfies (the W042 acceptance).
 *
 * Cross-cutting invariants (tested): provider vocabulary quarantined
 * in `src/provider` (the per-adapter blocklist test), kernel-import
 * isolation (the adapter imports ONLY the bridge provider contract +
 * the adapter SDK — the `kernel-import-rejected` boundary test),
 * determinism (identical fixtures -> identical digests), and W007
 * registration derivation (devDep parity).
 *
 * In-memory reference behavior: NO network, NO live provider calls, NO
 * real side effects — fixtures stand in for provider payloads (the
 * W029 fixture discipline). Zero wall-clock, zero randomness.
 *
 * Runtime dependency policy (W042 Tech Lead pin, frozen):
 * @epoch/external-event-bridge, @epoch/adapter-sdk,
 * @epoch/agent-protocol, @epoch/tenancy, and zod — NOTHING else at
 * runtime. Compatibility with @epoch/capability-registry,
 * @epoch/event-log, @epoch/evidence, @epoch/solution-delivery and
 * @epoch/access-projection is exercised via devDependencies +
 * compile-time parity (src/parity.ts) + runtime parity tests — never
 * runtime deps.
 */

// Version + vocabularies.
export {
  AURUM_CHAT_ADAPTER_CATEGORIES,
  AURUM_CHAT_ADAPTER_CONTRACT_VERSION,
  AURUM_CHAT_ADAPTER_RECORD_VERSION,
  AURUM_CHAT_PROVIDER_CONTRACT_ID,
  EXTERNAL_EXCHANGE_CAPABILITY_ID,
  EXTERNAL_EXCHANGE_CAPABILITY_VERSION,
  PROVIDER_KIND_TO_EVENT_CLASS,
  PROVIDER_MESSAGE_KINDS,
  SUPPORTED_INBOUND_CLASSES,
  SUPPORTED_OUTBOUND_CLASSES,
} from './version';
export type { ProviderMessageKind } from './version';

// The provider seam (provider vocabulary — fixtures + payload parsing).
export {
  ProviderAttachmentSchema,
  ProviderChatMessageSchema,
  ProviderThreadSchema,
  ProviderUserSchema,
  parseProviderChatMessage,
  parseProviderThread,
  parseProviderUser,
} from './provider/payload';
export type {
  ProviderAttachment,
  ProviderChatMessage,
  ProviderThread,
  ProviderUser,
} from './provider/payload';
export {
  PROVIDER_T0,
  PROVIDER_T1,
  PROVIDER_T2,
  PROVIDER_T3,
  PROVIDER_OPERATOR,
  PROVIDER_TENANT_A,
  PROVIDER_TENANT_B,
  conflictingProviderMessage,
  malformedProviderMessage,
  referenceProviderMessage,
  referenceProviderThread,
  referenceProviderUsers,
  RETRYABLE_DELIVERY_SCRIPT,
  SUCCESS_DELIVERY_SCRIPT,
  TERMINAL_DELIVERY_SCRIPT,
} from './provider/fixtures';

// The adapter descriptor (W007 discipline).
export {
  CHAT_PROVIDER_ADAPTER_DESCRIPTOR,
  CHAT_PROVIDER_ADAPTER_DESCRIPTOR_DIGEST,
  CHAT_ADAPTER_IDENTITY,
} from './descriptor';

// The inbound seam (provider payloads -> bridge external events).
export {
  adaptInboundMessage,
  providerPayloadDigestOf,
} from './inbound';
export type { AdaptInboundContext } from './inbound';

// The outbound seam (bridge dispatch -> scripted fixture outcomes).
export {
  providerDeliveryRefOf,
  scriptedOutcomeOf,
} from './outbound';
export type { ScriptedDeliveryStep } from './outbound';

// The provider port implementation (the bridge provider contract).
export { ChatReferenceProvider, CHAT_PROVIDER_IDENTITY } from './adapters';
export type { ChatReferenceProviderOptions } from './adapters';

// W007 capability-registration derivation.
export { deriveCapabilityRegistrations } from './registration';
export type {
  DerivedExchangeCapabilityManifest,
  DerivedExchangeCapabilityRegistration,
} from './registration';

// Typed error taxonomy (values, never thrown).
export type {
  ChatAdapterError,
  ChatAdapterErrorCode,
  ChatAdapterIssue,
  ChatAdapterResult,
} from './errors';
