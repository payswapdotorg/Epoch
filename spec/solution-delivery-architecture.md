# Epoch Solution Delivery Architecture SD1.0

## Purpose

Solution Delivery turns an approved Epoch solution into a living project record that can be procured, executed, observed, verified, forecast, compared with its original prediction and used to improve future solutions.

It is universal. Construction renders it as an Interactive BOQ + Program of Work; other domains render equivalent solution schedules and execution plans.

## Canonical lifecycle

`Reconstruct → Generate → Constrain → Simulate → Evaluate → Verify → Approve → Baseline → Plan → Procure → Execute → Observe → Actualize → Verify → Forecast → Close → Learn`

The lifecycle may branch, pause, resume and repeat. A provider or channel is never required for core progression.

## Core objects

### SolutionPackage

A versioned solution definition containing:

- Scenario and world references
- alternatives
- selected alternative
- assumptions and uncertainties
- work breakdown
- quantity schedule
- cost schedule
- resource schedule
- Program of Work
- constraints/results
- simulations/evaluations
- verification/evidence
- spatial bindings
- decision log
- execution prerequisites
- delivery policy

### SolutionVersion

Immutable snapshot of a proposed/approved state. Changes create a new version linked by supersession/derivation relationships.

### DeliveryRecord

Live delivery state for one approved SolutionVersion.

Includes:

- procurement state
- execution state
- commitments
- observations
- actual quantities/resources/costs
- progress
- changes
- verification
- payments
- forecasts
- outcome measurements
- unresolved unknowns
- deviations from baseline

### ProgramOfWork

A first-class schedule attached to SolutionPackage and DeliveryRecord.

Each activity/work package may carry:

- id
- parent/section
- description
- responsible role
- planned quantity
- unit
- planned start/finish
- dependencies
- milestone flag
- predecessor/successor relations
- required materials/resources
- required approvals
- verification gates
- baseline status
- actual start/finish
- actual progress
- forecast finish
- blocker/issue state
- evidence refs
- confidence

The schedule is synchronized with the BOQ. A BOQ item may contribute to one or more activities, and an activity may consume one or more BOQ/quantity lines.

## Commercial state model

Keep these values semantically distinct:

- Prediction: what the system expected before execution.
- Estimate: a user/system projection at a point in time.
- Commitment: an accepted commercial obligation.
- Actual: an observed/validated realized value.
- Forecast: current projection using actuals and remaining work.

Never collapse them to one cost or quantity field.

## Procurement model

`Requirement → Procurement Package → RFQ/Quote → Selection → Purchase Order → Delivery → Acceptance → Consumption → Invoice → Payment`

Procurement references SolutionPackage quantities and the Program of Work. Substitutions and changes are recorded as explicit events and evaluated against constraints/specifications before becoming accepted delivery state.

## Execution model

`Work Package → Activity → Observation → Progress → Verification → Completion`

Execution may record:

- progress quantity
- labour/time
- equipment/time
- material consumption
- waste
- delays
- rework
- defects
- inspection outcomes
- evidence
- actual cost
- responsible party

## Evidence/uncertainty model

Facts can be marked:

`OBSERVED | MEASURED | INFERRED | ESTIMATED | ASSUMED | UNKNOWN | CONFLICTING | VERIFIED`

Every uncertain fact may include confidence, provenance, freshness, validity interval and what decision(s) it affects.

An estimate may be accepted with a confidence value and later replaced/validated without erasing the earlier state.

## Information acquisition

Epoch detects consequential unknowns by decision impact, not by a completeness checklist.

An acquisition request includes:

- question / information needed
- why it matters
- affected object/activity
- urgency/deadline
- target confidence
- acceptable answer forms
- evidence requirements
- authorized acquisition channels
- fallback options

Acquisition providers return normalized observations/evidence. Core Epoch works without any acquisition provider.

## External Event Bridge

Provider-neutral integration contracts support:

- incoming event/observation ingestion
- outgoing information requests
- outgoing status queries
- reminders
- alerts
- approval prompts
- result/evidence transmission
- delivery receipts
- correlation/causation ids
- idempotency
- retries
- authorization/audit

### Aurum Chat reference adapter

Aurum may be installed as an optional capability that:

1. receives an Epoch information acquisition request;
2. resolves authorized people/channels;
3. asks the relevant supervisor/employee;
4. collects response/evidence;
5. normalizes the response;
6. returns observations/evidence/events to Epoch.

Epoch then updates the project automatically subject to validation/policy.

The reverse path is also supported:

1. Epoch detects schedule drift, risk or missing prerequisite;
2. Epoch emits a typed alert/request;
3. Aurum relays it through an authorized channel;
4. Aurum returns acknowledgement/response;
5. Epoch records the event and updates delivery state.

Epoch never depends on Aurum's internal world model, identities, message formats or storage.

## Supervision and alerts

The Delivery State Engine evaluates:

- planned vs actual progress
- critical path drift
- missing prerequisites
- procurement lead-time risk
- consumption anomalies
- cost variance
- verification failures
- unresolved high-impact unknowns
- change propagation

Alerts are policy-controlled and severity-classified.

Alerts may remain in Epoch, or be relayed by an optional channel/external event capability.

## Variance and learning

For every materially completed scope, preserve:

`Prediction → Baseline → Commitment → Actual → Variance → Cause Attribution → Outcome`

Variance attribution should distinguish at least:

- quantity
- rate/price
- productivity
- schedule
- waste
- rework
- scope/change
- external condition
- measurement uncertainty

Only validated actual/outcome data becomes eligible for calibration datasets.

## Learning boundary

Learning systems may improve model parameters, priors, retrieval/ranking and prediction calibration, but may not rewrite historical facts, approved baselines or audit records.

The learning record must retain:

- model/version
- training/selection evidence
- input population
- prediction timestamp
- confidence/calibration state
- observed actual
- error/variance
- applicability/context
- subsequent model version

## Access projections

Authorization may operate at:

- tenant/workspace/project
- solution/version
- section/work package/activity
- field/group
- evidence item
- supplier/commercial record
- action type

Canonical state is unchanged by access projection.

Examples:

Client may see committed project cost and progress without seeing supplier margin.

Procurement may see supplier quotations and terms.

Engineer may see geometry, assumptions, quantities and verification.

Agent may see only the fields needed for its authorized task.

## UX modes

The Solution Navigator exposes synchronized modes:

- Design
- Approval
- Program of Work
- BOQ
- Procurement
- Execution
- Verification
- Forecast
- Outcomes
- Learning

Selecting a row, activity, event or 3D object preserves the same semantic identity and can navigate across modes.

## Adoption rule

The minimum interaction path must remain useful with partial data. Capture methods should prefer reuse/extraction of already-produced artifacts and one-tap confirmations over form-heavy entry.
