# Fallback semantics (W042)

What happens when a provider is missing, unregistered, or failing. The
binding rules (spec/aurum-chat-integration.md): Epoch continues
normally; requests become pending/manual/alternative work items
according to policy; NO project truth is fabricated; an unresolved
request remains explicit.

## Resolution (BY CLASS, canonicalized)

`resolveProvidersByClass(registrations, requestClass, { preferredAdapterId?,
excludeAdapterIds? })`:

1. Filter to providers whose declared outbound classes include the
   request class (exclusion set applied).
2. Canonicalize: sort by adapter id — registration order NEVER leaks
   (order-independent by construction, pinned by the determinism
   tests).
3. An optional preferred provider goes deterministically first when it
   qualifies (registered + supports the class + not excluded).

## The typed provider-unavailable record

When the candidate set is empty, the host mints a sealed
`ProviderUnavailable` record: the request, the typed reason, the
canonicalized candidate list, the preferred provider if any, the
fallback mode if a policy applied, and the caller-supplied detection
instant. Reasons:

| Reason | When |
|---|---|
| `no-provider-registered` | The registry is empty. |
| `provider-lacks-class` | Providers are registered but none support the class. |
| `preferred-provider-unregistered` | The preferred adapter id is not registered. |
| `fallback-provider-unregistered` | The fallback directive names an unregistered provider. |
| `fallback-provider-lacks-class` | The fallback provider does not support the class. |
| `no-alternative-provider` | The alternative-provider mode found no next candidate. |

## The three fallback modes (typed DATA, applied on resolution failure
OR terminal delivery failure)

### `fallback` — a designated second provider

`{ mode: 'fallback', fallbackAdapterId }`: the named provider delivers
— it must be registered AND support the class (else the refined
unavailability reasons above). The outcome is `fallback-dispatched`
carrying the fallback provider's receipts and the unavailability
record. This is the "a second generic provider satisfies the SAME
contract" acceptance path: the fallback is class-checked, never a
blind name hop.

### `manual-queue` — an explicit pending work item

`{ mode: 'manual-queue' }`: the request becomes a sealed
`ManualQueueRecord` (`resolution: 'pending'`, reason
`provider-unavailable` or `delivery-terminal`). Nothing is lost and
nothing is invented — a human process owns the follow-up. The outcome
is `manual-queued`; a `bridge:manual-queued` event is recorded.

### `alternative-provider` — the next provider of the same class

`{ mode: 'alternative-provider', excludeAdapterIds }`: the host
re-resolves the class EXCLUDING the failed provider (plus the
directive's exclusions) and dispatches to the next candidate —
`fallback-dispatched` with the alternative's receipts. When no
alternative exists, the outcome is the bare `provider-unavailable`
record (reason `no-alternative-provider`).

## No directive → explicit unresolved

Without a fallback directive, a failed resolution yields the
`provider-unavailable` outcome and a terminal delivery failure yields
`delivery-failed` with the attempt receipts. Both stay EXPLICIT: the
request is never silently dropped, retried forever, or fabricated as
delivered.

## Evidence

Every branch above is a named test:

- `outbound.test.ts` — all three modes exercised through the same
  bridge API (bridge package) and the scripted terminal/retryable
  schedules (adapter package).
- `negative.test.ts` — the bare `provider-unavailable` outcome and the
  unregistered-preferred semantics.
- `acceptance.test.ts` (adapter package) — the mocked chat provider AND
  a second generic provider both satisfying the same contract.
