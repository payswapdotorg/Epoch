# The provider-neutral contract catalog (W042)

The typed records every bridge participant binds to. Declarations live
at `contracts/external-event-bridge/index.d.ts` (self-contained);
runtime validators live in `@epoch/external-event-bridge`; the JSON
Schema projection at `contracts/external-event-bridge/schemas/` is
byte-pinned to the deterministic emission. Every record is
tenant-scoped, content-addressed (SHA-256 over canonical JSON), and
carries `schemaVersion` exactly.

## Inbound: the normalized external event

`ExternalEventContent` / `SealedExternalEvent`:

| Field | Discipline |
|---|---|
| `eventId` | `bridge-event:<slug>` (kind-prefixed, opaque). |
| `tenantId` | The W009 tenancy grammar; the runtime host pins it (R12). |
| `eventClass` | One of eight provider-neutral classes: `observation-report`, `evidence-reference`, `delivery-event`, `acknowledgement`, `information-response`, `status-report`, `exception`, `communication-receipt`. |
| `source` | W006-shaped provenance: adapter id, EXACT adapter-descriptor digest, the provider's own event reference, the raw provider-payload digest, provenance kind (`reported`). |
| `correlationId` / `causationId` | Correlation ties the exchange; causation names the prior fact (null for roots). |
| `occurredAt` | CALLER-SUPPLIED instant — the kernel never reads a clock. |
| `payload` / `confidence` | Opaque JSON (the W036/W006 authorities validate on admission; provider payloads never claim kernel authority — embedded Epoch schema discriminators are typed rejections). |
| `idempotencyKey` | The duplicate-delivery identity. |

**Idempotency:** a duplicate delivery (same key, same content) returns
the SEALED PRIOR intake receipt — never a second effect, never a second
`bridge:*` event. The same key with different content is the typed
`replay-conflict`.

**The authority path:** `buildObservationIntakeProposal(event, context)`
turns an admitted `observation-report` into a sealed
`ObservationIntakeProposal` whose observation slot is W036-SHAPED (the
W036 observation distinction-record envelope with opaque
subject/measure/payload/uncertainty slots). The W036 delivery authority
validates, records, reviews and actualizes — the bridge only proposes
(`observation-bypass-rejected` otherwise).

## Outbound: the four request classes

`OutboundRequestContent` / `SealedOutboundRequest` — the classes are
FROZEN at exactly four:

| Class | Meaning |
|---|---|
| `information` | Acquire information / ask an authorized person. |
| `status` | Obtain a status update. |
| `alert` | Send a notification/alert. |
| `acknowledgement-request` | Request an acknowledgement. |

Every request carries: recipient reference, correlation/causation ids,
a creation instant + principal (caller-supplied), an idempotency key,
a `payload` of type `FilteredOutboundPayload`, and the
`projectionDigest` citing the W041 projection-policy revision it was
filtered under.

**Least privilege:** `filterOutboundPayload(rawPayload, projection)`
walks the payload into leaf paths (dot-separated keys, `[index]` for
arrays) and splits it into RELEASED fields (by reference — same value,
same digest) and typed `OutboundRedactionMarker`s (never a silent
drop). The dispatch-time gate re-derives coverage (defense in depth): a
released path outside the projection's allowlist, a missing projection,
or a policy-digest mismatch is the typed
`least-privilege-violation-rejected`.

## Retry + receipts

- `RetryPolicy`: `attemptInstants` — 1..16 caller-supplied, strictly
  ascending instants. NO timers: the reference host executes the
  schedule deterministically and stamps each receipt.
- `DeliveryReceiptContent` / `SealedDeliveryReceipt`: per-attempt
  outcome records (`success` with the provider's delivery reference /
  `retryable` with a detail / `terminal` with a detail), the scheduled
  instant, the delivering provider, correlation/causation ids —
  content-addressed.

## Provider registration + class resolution

`ProviderRegistrationContent` / `SealedProviderRegistration`: the W007
`AdapterDescriptor` plus its EXACT digest (recomputed through the REAL
SDK discipline), the W007 capability binding, and the sorted
supported inbound/outbound class declarations. Resolution is BY CLASS,
never by name: `resolveProvidersByClass` filters on declared class
support, canonicalizes (sorted by adapter id — registration order never
leaks), with an optional preferred provider and exclusion set.

## Unavailability, fallback, manual queue

- `ProviderUnavailableContent` / `SealedProviderUnavailable`: the
  request, the typed reason, the canonicalized candidate list, the
  fallback mode if a policy applied, the detection instant. The request
  stays EXPLICITLY unresolved — no project truth is fabricated.
- `ProviderFallbackDirective`: `{ mode: 'fallback', fallbackAdapterId }`
  | `{ mode: 'manual-queue' }` |
  `{ mode: 'alternative-provider', excludeAdapterIds }`.
- `ManualQueueRecordContent` / `SealedManualQueueRecord`: the pending
  manual work item an unresolved request becomes (`resolution:
  'pending'`).

## The bridge:* events (W010-shaped)

`BridgeEventContent` / `SealedBridgeEvent` mirror the W010 event
content shape over one per-tenant stream (`stream:bridge-<slug>`):
`bridge:provider-registered`, `bridge:event-received`,
`bridge:intake-proposed`, `bridge:request-dispatched`,
`bridge:receipt-recorded`, `bridge:fallback-applied`,
`bridge:manual-queued`, `bridge:provider-unavailable` — each with a
typed data payload.

## The W009 gate

`BridgeAuthorizationRequest` (the W009 `AuthorizationRequest`
structural mirror) + `BridgeAuthorizationDecision` (the
requestDigest + outcome subset every real W009 decision satisfies).
The gate runs BEFORE any kernel admission: a missing or unverifiable
decision, a request-digest mismatch, a non-allow outcome, or an
untenanted resource is `authorization-bypass-rejected`; a tenant
mismatch is `tenant-isolation-rejected`.
