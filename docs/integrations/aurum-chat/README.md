# Epoch ↔ External Chat Integration (the W042 reference adapter)

Status: reference adapter architecture; OPTIONAL capability (never a
lifecycle authority).

This directory documents the W042 integration surface for reviewers:
the provider-neutral contract catalog the bridge kernel publishes, the
provider registration guide a concrete adapter follows, the fallback
semantics when a provider is absent, and the optionality guarantee that
core Epoch flows keep running with NO bridge installed. The reference
adapter implementing all of this is `adapters/aurum-chat`
(`@epoch/adapter-aurum-chat`) — a fixture-driven, in-memory stand-in
for an external team-chat system with NO network and NO live provider
calls.

## Contents

| Document | What it covers |
|---|---|
| [`contract-catalog.md`](./contract-catalog.md) | The typed records every provider binds to: inbound external events, the four outbound request classes, receipts, registrations, fallback records. |
| [`provider-registration.md`](./provider-registration.md) | How a provider adapter registers, which vocabulary it declares, and the W007 capability binding discipline. |
| [`fallback-semantics.md`](./fallback-semantics.md) | The three fallback modes (fallback / manual-queue / alternative-provider), when each fires, and the explicit-unresolved discipline. |
| [`optionality.md`](./optionality.md) | The no-bridge guarantee: core flows with the bridge uninstalled, and how the evidence test pins it. |

## Boundary (binding)

Epoch and the external chat system communicate ONLY through the
provider-neutral integration contracts published at
`contracts/external-event-bridge` (and implemented by
`@epoch/external-event-bridge`). Provider-specific schemas NEVER enter
Epoch kernel types: the reference adapter quarantines the provider's
vocabulary in `adapters/aurum-chat/src/provider/**` (blocklist-tested),
and the bridge kernel itself is provider-name-free
(`provider-vocabulary-rejected`).

## Inbound to Epoch

The external system may transmit, through its adapter: normalized
observation reports, evidence references, delivery-lifecycle events,
acknowledgements, responses to prior information requests, status
reports, exceptions, and communication receipts. All of them normalize
into typed `ExternalEvent` records carrying tenant scope, source
identity, the occurrence instant (caller-supplied — the kernel never
reads a clock), W006-shaped provenance, confidence, and
correlation/causation ids. Observation reports become W036-shaped
observation INTAKE PROPOSALS through the existing delivery authority
path — the bridge never writes observations directly.

## Outbound from Epoch

Epoch may request — through the bridge's four outbound classes —
`information` (acquire information / ask an authorized person),
`status` (obtain a status update), `alert` (send a notification/alert),
and `acknowledgement-request` (request an acknowledgement). Requests
are typed, W009-authorized, idempotent, retryable through typed
backoff-schedule DATA (no timers), receipted per attempt, and
traceable through correlation/causation ids. Every payload is filtered
to the recipient's minimum-necessary allowlist through a W041
projection-policy reference — an unfiltered send is a typed rejection.

## Failure and fallback

If the provider is unavailable, Epoch continues normally. Requests
become pending manual work items, dispatch to a designated fallback
provider, or resolve to the next alternative provider of the same
class — according to the typed fallback directive. No project truth is
fabricated; an unresolved request remains explicit. See
[`fallback-semantics.md`](./fallback-semantics.md).

## Security

- Tenant and project authorization is checked BEFORE any kernel
  admission (the W009 gate; `tenant-isolation-rejected` on mismatch).
- Only minimum-necessary fields are shared (the W041 projection-policy
  reference; typed redaction markers, never silent drops).
- Secrets and provider identities remain adapter-private (the bridge
  consumes opaque adapter ids + descriptor digests only).
- External communication is audited (content-addressed receipts per
  delivery attempt; `bridge:*` events W010-shaped).
- Sensitive evidence may be withheld from an external channel even
  when the underlying project event is visible (the projection decides
  visibility, not the event).

## Versioning

The contract is versioned independently of any provider's
implementation (`contracts/external-event-bridge` carries
`contractVersion` 1.0.0 and per-record `schemaVersion` 1). Compatible
providers may be substituted without changing Epoch semantic types —
the acceptance test pins exactly this: the mocked chat provider AND a
second generic fixture provider both satisfy the same contract through
the same bridge API.
