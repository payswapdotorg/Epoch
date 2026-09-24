# W042 — External Event Bridge + Aurum Chat Reference Adapter
Status: READY_AFTER_DEPENDENCIES
Depends On: W007,W010,W036,W041
Worker Count: 1
Owned surfaces: packages/external-event-bridge/*, adapters/aurum-chat/*, contracts/external-event-bridge/*, docs/integrations/aurum-chat/*

## Objective
Implement a provider-neutral external event/request bridge and a reference Aurum Chat adapter.

## Must provide
- normalized inbound event/observation contract;
- outbound information/status/alert/acknowledgement request contract;
- correlation, causation, idempotency, retry and receipt handling;
- least-privilege payload filtering;
- capability discovery and optional-provider semantics;
- Aurum adapter isolated from Epoch kernel contracts;
- fallback/manual/alternative-provider behavior when Aurum is absent.

## Acceptance
A mocked Aurum provider and a second generic provider can both satisfy the same contract. Core project flows remain functional with no bridge installed.


The bridge is lifecycle-neutral: it may acquire information or relay supervision for any domain pack. Aurum remains an optional adapter, never a lifecycle authority.
