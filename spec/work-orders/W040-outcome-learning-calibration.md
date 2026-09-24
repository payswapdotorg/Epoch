# W040 — Outcome Learning & Prediction Calibration
Status: READY_AFTER_DEPENDENCIES
Depends On: W039,W005,W006
Worker Count: 1
Owned surfaces: packages/learning-calibration/*, services/learning-calibration/*, contracts/learning-calibration/*

## Objective
Turn validated delivery outcomes into governed calibration/training records for future prediction improvement.

## Must provide
- prediction-to-outcome datasets;
- model/version/applicability lineage;
- error and variance features;
- calibration metrics;
- data eligibility states;
- exclusion of unresolved/unvalidated observations;
- no mutation of historical source facts;
- controlled model/parameter update interfaces.

## Acceptance
Fixtures prove only validated actual/outcome records can enter calibration datasets and that model revisions retain lineage to the observations that changed them.
