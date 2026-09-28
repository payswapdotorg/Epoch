# Provider registration guide (W042)

How a concrete provider adapter registers with the external event
bridge. The reference implementation is `adapters/aurum-chat`
(`@epoch/adapter-aurum-chat`); a second generic provider satisfying the
SAME contract is pinned by the acceptance test.

## 1. Implement the provider port

The port (`ExternalEventProvider` in `@epoch/external-event-bridge`) is
the whole contract:

```ts
interface ExternalEventProvider {
  readonly descriptor: AdapterDescriptor;        // the REAL W007 SDK type
  readonly capabilityBinding: CapabilityBinding; // the W007 capability served
  readonly supportedInboundClasses: readonly InboundEventClass[];
  readonly supportedOutboundClasses: readonly OutboundRequestClass[];
  deliver(request: ProviderDispatchRequest, attempt: DeliveryAttemptContext): ProviderDeliveryOutcome;
}
```

- `descriptor` follows the W007 adapter-sdk discipline: `adapter:<slug>`
  id, one of the eight Capability Fabric categories (the reference chat
  adapter uses `source`), and the capability binding it serves
  (`external.event-exchange` 1.0.0 exact).
- `supportedInboundClasses` / `supportedOutboundClasses` declare the
  bridge vocabularies the provider handles — the bridge resolves BY
  CLASS, never by name, so the declarations ARE the discovery surface.
  At least one class must be declared.
- `deliver` reports one typed outcome per attempt: `success` (carrying
  the provider's opaque delivery reference), `retryable` (the typed
  backoff schedule continues), or `terminal` (the fallback policy
  applies). The reference adapter's outcomes are scripted fixture DATA.

## 2. Register through the runtime host (the W009 gate first)

```ts
const runtime = new ExternalEventBridgeRuntime({ expectedTenantId });
runtime.registerProvider({
  provider,
  tenantId,
  registeredAt,          // caller-supplied instant
  registeredBy,          // the operating principal
  authorization: { request, decision },  // the W009 gate pair
});
```

The host derives the sealed registration record: the descriptor digest
is recomputed through the REAL SDK discipline (a claimed digest that
does not match the descriptor is rejected), the class lists are
canonicalized (sorted, duplicate-free), and a `bridge:provider-registered`
event is recorded. Registration is idempotent: re-registering the SAME
adapter surface returns the prior sealed record; the same adapter id
with different content is the typed `replay-conflict`.

## 3. The W007 capability binding (registry parity)

The capability a provider binds should be registered in the W007
capability registry. The reference adapter derives the registration
document (`deriveCapabilityRegistrations()`) whose digest equals the
registry's own `computeCapabilityManifestDigest`, admits verbatim
through the REAL `CapabilityRegistry.register`, and negotiates through
the REAL SDK `negotiateBinding` — pinned by the registration parity
tests. Adapters NEVER take a runtime dependency on the registry; the
manifest derivation uses the shared protocol primitives.

## 4. Vocabulary discipline (the quarantine)

Provider vocabulary (service names, message/thread/user field names)
lives ONLY inside the adapter's `src/provider/**` layer. The neutral
seam (public types, descriptors, registration manifests) is
blocklist-tested against the provider's own names AND competing
providers' names — vocabulary drift toward any vendor fails the build.
The bridge KERNEL itself is provider-name-free entirely.

## 5. Kernel-import isolation

The adapter imports ONLY: `@epoch/external-event-bridge` (the provider
contract), `@epoch/adapter-sdk`, `@epoch/agent-protocol`,
`@epoch/tenancy`, and `zod`. Any other `@epoch/*` import in the adapter
source fails the `kernel-import-rejected` boundary test — compatibility
with sibling kernels (registry, event log, evidence, delivery,
projection) is exercised via devDependencies + compile-time parity +
runtime parity tests, never runtime edges.

## 6. Inbound normalization

A provider payload becomes a bridge `ExternalEvent` through the
adapter's own normalization step (`adaptInboundMessage` in the
reference adapter): unknown provider shapes are the typed
`unknown-provider-payload` (never a partial silent load); the W006-shaped
provenance carries the adapter identity, the EXACT descriptor digest,
the provider's own event reference, and the raw provider-payload digest
(tamper-detectable, replay-comparable). The adapted event then flows
through the bridge intake — the W009 gate, the tenant pin, the
idempotency receipt, and (for observation reports) the W036-shaped
intake proposal through the delivery authority path.
