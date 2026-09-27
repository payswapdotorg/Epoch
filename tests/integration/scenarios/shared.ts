// W032 — the CROSS-DOMAIN scenario vocabulary (shared fixtures + constants).
//
// The flagship scenario composes ONE solution carrying BOTH a
// construction work-package (W026) and a software work-package (W027)
// over the SAME W036 solution-delivery spine. This module holds the
// explicit ids, the fixed instant series and the uncertainty fixtures —
// the same deterministic discipline as the W031 reference slices (zero
// wall-clock, zero randomness, zero network; every id explicit).
import type { JsonValue } from '@epoch/test-harness';

/** The home tenant (W009 grammar). */
export const TENANT = 'tenant:globex' as const;

/** The foreign tenant of every cross-tenant negative path. */
export const OTHER_TENANT = 'tenant:initech' as const;

/** The cross-domain principals (W009 grammar). */
export const PRINCIPAL = 'principal:delivery-lead' as const;
export const OBSERVER = 'principal:field-engineer' as const;
export const PLATFORM_ENGINEER = 'principal:platform-engineer' as const;
export const APPROVER = 'principal:chief-engineer' as const;
export const PROCUREMENT = 'principal:procurement-lead' as const;
export const FOREIGN_ACTOR = 'principal:initech-agent' as const;

/** The fixed instant series (ISO-8601, UTC, one-hour steps). */
export const T = [
  '2026-06-01T08:00:00.000Z', // T0  — solution authored
  '2026-06-01T09:00:00.000Z', // T1  — solution sealed / programme built
  '2026-06-01T10:00:00.000Z', // T2  — baseline approved / delivery opened
  '2026-06-01T11:00:00.000Z', // T3  — acquisition requested / field work starts
  '2026-06-01T12:00:00.000Z', // T4  — quote submitted / observations made
  '2026-06-01T13:00:00.000Z', // T5  — selection decided / acceptance
  '2026-06-01T14:00:00.000Z', // T6  — commitment / deploy observed
  '2026-06-01T15:00:00.000Z', // T7  — purchase order / actualization
  '2026-06-01T16:00:00.000Z', // T8  — supplier delivery / variance computed
  '2026-06-01T17:00:00.000Z', // T9  — supervision fold / recovery
] as const;

/** A deterministic 64-char lowercase-hex digest (fixture convention). */
export const DIGEST = (char: string): string => char.repeat(64);

// --------------------------------------------------------------------------------
// Canonical ids (the identity spine the scenario asserts end-to-end).
// --------------------------------------------------------------------------------

export const SOLUTION_ID = 'solution:hybrid-plant-extension';
export const PROGRAM_ID = 'program:hybrid-plant-extension-v1';
export const DELIVERY_ID = 'delivery:hybrid-plant-extension-v1';
export const DELIVERY_STREAM_ID = 'stream:delivery-hybrid-v1';

// Solution plan lines (shared by BOTH packs' projections).
export const LINE_EXCAVATION = 'line:bulk-excavation';
export const LINE_STEEL = 'line:steel-frame';
export const LINE_CHECKOUT_UI = 'line:checkout-ui';

// The CONSTRUCTION work-package (W026 lens).
export const WORK_PACKAGE_SITEWORKS = 'work-package:site-works';
export const ACTIVITY_EXCAVATION = 'activity:bulk-excavation';
export const ACTIVITY_STEEL_ERECTION = 'activity:steel-erection';

// The SOFTWARE work-package (W027 lens) — in the SAME program.
export const WORK_PACKAGE_RELEASE = 'work-package:release-rollout';
export const ACTIVITY_DEPLOY_STAGING = 'activity:deploy-staging';

// Milestones (canonical ids; the W027 roadmap identity-maps them).
export const MILESTONE_FOUNDATIONS = 'milestone:foundations-complete';
export const MILESTONE_STAGING_RELEASE = 'milestone:staging-release';

// Procurement (the Acquire path for the steel line).
export const ACQUISITION_ID = 'acquisition:steel-supply';
export const PACKAGE_ID = 'package:steel-supply';
export const QUOTE_ID = 'quote:steel-supply-alpha';
export const SELECTION_ID = 'selection:steel-supply-alpha';
export const COMMITMENT_ID = 'commitment:steel-supply-order-1';
export const PO_ID = 'po:steel-supply-001';
export const SUPPLIER = 'supplier:alpha-steel';

// Observations / actuals / variance (the shared delivery spine).
export const EXCAVATION_CAPTURE_KEY = 'pit-progress-monday';
export const EXCAVATION_OBSERVATION_ID = `observation:field-${EXCAVATION_CAPTURE_KEY}`;
export const EXCAVATION_ACTUAL_ID = `actual:field-${EXCAVATION_CAPTURE_KEY}`;
export const DEPLOY_CAPTURE_KEY = 'staging-deploy-monday';
export const DEPLOY_OBSERVATION_ID = `observation:field-${DEPLOY_CAPTURE_KEY}`;
export const DEPLOY_ACTUAL_ID = `actual:field-${DEPLOY_CAPTURE_KEY}`;
export const RECEIPT_OBSERVATION_ID = 'observation:steel-receipt';
export const RECEIPT_ACTUAL_ID = 'actual:steel-receipt';
export const BASELINE_RECORD_ID = 'baseline:excavation-quantity';
export const VARIANCE_EXCAVATION_ID = 'variance:excavation-quantity';
export const VARIANCE_DEPLOY_ID = 'variance:staging-deploy-quantity';
export const ATTRIBUTION_ID = 'attribution:pit-geometry-revision';
export const ISSUE_ID = 'change:pit-geometry-revision';

/** The scenario's world entities (W002 type keys for the pack bindings). */
export const WORLD_ENTITIES = [
  { id: 'element-foundations', type: 'construction:element' },
  { id: 'element-frame', type: 'construction:element' },
  { id: 'service-checkout', type: 'software:service' },
] as const;

// --------------------------------------------------------------------------------
// Uncertainty fixtures (W036-shaped).
// --------------------------------------------------------------------------------

/** One valid W036 uncertainty state (observed provenance, fresh, measured). */
export function uncertainty(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    provenance: { kind: 'observed', sourceRef: 'source:site-report', actor: OBSERVER },
    freshness: { state: 'fresh', assessedAt: T[3] },
    confidence: { method: 'measured', value: 0.95, rationale: 'direct field measurement' },
    ...overrides,
  };
}

/** One valid W036 uncertainty state with derived provenance. */
export function derivedUncertainty(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return uncertainty({
    provenance: { kind: 'derived', sourceRef: 'source:delivery-pipeline' },
    confidence: { method: 'derived', value: 0.9, rationale: 'derived from accepted actuals' },
    ...overrides,
  });
}

/** Convenience: cast a fixture record into the harness JSON-value type. */
export function asJson(value: Record<string, unknown>): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}
