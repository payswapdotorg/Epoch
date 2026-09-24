# W037 — Procurement & Supplier Delivery
Status: READY_AFTER_DEPENDENCIES
Depends On: W036,W007,W009
Worker Count: 1
Owned surfaces: packages/procurement/*, services/procurement/*, contracts/procurement/*

## Objective
Track procurement from requirement through quote, commitment, purchase order, delivery, acceptance, consumption, invoice and payment.

## Must provide
- procurement packages linked to solution/BOQ/schedule lines;
- RFQ and quotation records;
- supplier selection and substitution;
- purchase commitments;
- delivery and acceptance records;
- commercial actuals and payment references;
- lead-time/status signals;
- auditable change propagation back to delivery forecasts and constraints.

## Acceptance
End-to-end contract tests show a procurement requirement remains linked to its originating solution line and can produce committed and actual states without overwriting the solution baseline.
