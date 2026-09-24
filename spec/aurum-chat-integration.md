# Epoch ↔ Aurum Chat Integration Contract AUR1.0

## Status

Reference adapter architecture; optional capability.

## Boundary

Epoch and Aurum communicate only through provider-neutral integration contracts. Aurum-specific schemas never enter Epoch kernel types.

## Inbound to Epoch

Aurum may transmit:

- normalized Observation
- Evidence reference/content metadata
- DeliveryEvent
- acknowledgement
- response to an information request
- status report
- exception/failure
- communication delivery receipt

All messages carry tenant/project correlation where authorized, source identity, timestamp, provenance, confidence and correlation/causation ids.

## Outbound from Epoch

Epoch may request:

- acquire information
- ask an authorized person
- obtain a status update
- send a notification/alert
- request acknowledgement
- request evidence
- escalate according to policy

Requests are typed, policy checked, idempotent and traceable.

## Information acquisition example

`Epoch unknown detector
→ AcquisitionRequest
→ Aurum adapter
→ authorized channel/person selection
→ Aurum question
→ response/evidence
→ normalized Observation
→ Epoch validation
→ World/Delivery update
→ confidence recalculation`

## Program-of-work monitoring example

`Program baseline: Activity A due
→ schedule monitor detects due/late
→ SupervisionRequest
→ Aurum adapter
→ supervisor contact
→ response + evidence
→ Epoch actualization
→ progress/forecast/variance recalculation
→ alert/escalation if needed`

## Failure and fallback

If Aurum is unavailable:

- Epoch continues normally.
- Requests become pending/manual/alternative-channel work items according to policy.
- No project truth is fabricated.
- An unresolved request remains explicit.

Other adapters may implement the same contract.

## Security

- tenant and project authorization is checked before transmission;
- only minimum necessary fields are shared;
- secrets/provider identities remain adapter-private;
- external communication is audited;
- sensitive evidence may be withheld from an external channel even when the underlying project event is visible.

## Versioning

The contract is versioned independently of Aurum's implementation. Compatible providers may be substituted without changing Epoch semantic types.
