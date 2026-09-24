# W043 — Delivery Supervision + Alerts
Status: READY_AFTER_DEPENDENCIES
Depends On: W020,W022,W036,W038
Worker Count: 1
Owned surfaces: packages/supervision/*, services/supervision/*, packages/alerts/*, contracts/supervision/*

## Objective

Implement policy-driven supervision of ProgramOfWork and DeliveryRecord state.

## Must provide
- planned-vs-actual monitoring;
- critical-path and prerequisite checks;
- acquisition/lead-time risk checks;
- consumption/cost anomalies;
- verification failures;
- unresolved high-impact unknown detection;
- severity and escalation policy;
- typed notifications through optional external event adapters.

## Acceptance

Synthetic schedules prove due/late/blocker transitions, alert idempotency and policy-controlled escalation without requiring Aurum or any external provider.
