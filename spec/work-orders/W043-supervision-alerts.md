# W043 — Delivery Supervision & Alerts
Status: READY_AFTER_DEPENDENCIES
Depends On: W020,W022,W036,W038
Worker Count: 1
Owned surfaces: packages/supervision/*, services/supervision/*, packages/alerts/*, contracts/supervision/*

## Objective
Continuously compare Program of Work and delivery state, identify material drift, and issue policy-controlled alerts/actions.

## Must provide
- planned-vs-actual schedule monitoring;
- critical-path and predecessor awareness;
- procurement prerequisite monitoring;
- anomaly and verification-failure detection;
- severity/urgency/escalation policy;
- in-Epoch alerts and typed external alert requests;
- human-approval requirements for consequential actions.

## Acceptance
Fixtures prove a missed milestone generates a traceable alert and can optionally route through an external bridge without making that bridge authoritative.
