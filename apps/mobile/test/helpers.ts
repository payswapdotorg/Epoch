// Shared fixtures for the mobile field-client tests (the solution-delivery
// fixtures pattern): builders return loose JSON objects so negative tests
// can corrupt single fields precisely. ZERO clock reads: every instant is
// a fixed constant.
import {
  openDeliveryRecord,
  type SealedDeliveryRecord,
} from '@epoch/solution-delivery';
import {
  buildFieldDeviceDescriptor,
  openFieldSession,
  sealFieldCapture,
  sealFieldReviewProposal,
  type SealFieldCaptureOptions,
  type SealFieldReviewOptions,
  type SealedFieldCapture,
  type SealedFieldReviewProposal,
  type SealedFieldSession,
} from '../src/index';

/** Admit loose JSON through the capture seam (negative-fixture harness). */
export function sealLooseCapture(input: unknown) {
  return sealFieldCapture(input as SealFieldCaptureOptions);
}

/** Admit loose JSON through the review seam (negative-fixture harness). */
export function sealLooseReview(input: unknown) {
  return sealFieldReviewProposal(input as SealFieldReviewOptions);
}

// Canonical instants (caller-supplied everywhere; zero wall-clock in src).
export const T0 = '2026-03-02T08:00:00.000Z';
export const T1 = '2026-03-02T08:00:01.000Z';
export const T2 = '2026-03-02T08:00:02.000Z';
export const T3 = '2026-03-02T08:00:03.000Z';
export const T4 = '2026-03-02T08:00:04.000Z';
export const T5 = '2026-03-02T08:00:05.000Z';
export const T6 = '2026-03-02T08:00:06.000Z';
export const T7 = '2026-03-02T08:00:07.000Z';
export const T8 = '2026-03-02T08:00:08.000Z';

// The W009 tenant grammars.
export const TENANT = 'tenant:fieldco';
export const OTHER_TENANT = 'tenant:initech';

// The W009/W036 principal grammars.
export const FIELD_ENGINEER = 'principal:field-engineer';
export const DELIVERY_LEAD = 'principal:delivery-lead';
export const REVIEWER = 'principal:site-reviewer';

// The work context (opaque W036 ids).
export const SOLUTION = 'solution:tower-retrofit';
export const DELIVERY = 'delivery:tower-retrofit-v1';
export const WORK_PACKAGE = 'work-package:excavation-north';
export const WORK_PACKAGE_ALT = 'work-package:excavation-south';
export const SOLUTION_VERSION = '1.0.0';
export const SOLUTION_VERSION_DIGEST = 'c'.repeat(64);

// The field evidence digests (W006 convention: content digests only).
export const PHOTO_DIGEST = 'a'.repeat(64);
export const SENSOR_DIGEST = 'b'.repeat(64);
export const NOTE_DIGEST = 'd'.repeat(64);

/** The field device descriptor (FIELD fidelity, default phone class). */
export function fieldDevice(): ReturnType<typeof buildFieldDeviceDescriptor> {
  return buildFieldDeviceDescriptor();
}

/** One valid W036 uncertainty state for a field capture (loose JSON). */
export function fieldUncertainty(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    provenance: { kind: 'observed', sourceRef: 'source:field-capture', actor: FIELD_ENGINEER },
    freshness: { state: 'fresh', assessedAt: T1 },
    confidence: { method: 'stated', value: 0.9, rationale: 'direct field measurement' },
    ...overrides,
  };
}

/** One valid field session (sealed). */
export function sealedSession(overrides: Record<string, unknown> = {}): SealedFieldSession {
  const device = fieldDevice();
  if (!device.ok) {
    throw new Error(`fixture device failed to build: ${device.error.message}`);
  }
  const opened = openFieldSession({
    sessionId: 'field-session:shift-alpha',
    tenantId: TENANT,
    device: device.value,
    solutionId: SOLUTION,
    deliveryId: DELIVERY,
    openedBy: FIELD_ENGINEER,
    openedAt: T0,
    ...overrides,
  });
  if (!opened.ok) {
    throw new Error(`fixture session failed to open: ${JSON.stringify(opened.error)}`);
  }
  return opened.value;
}

/** One valid capture context (provenance of the capture itself). */
export function captureContext(offline = true): Record<string, unknown> {
  const device = fieldDevice();
  if (!device.ok) {
    throw new Error(`fixture device failed to build: ${device.error.message}`);
  }
  return {
    deviceDescriptorDigest: 'e'.repeat(64),
    offline,
    note: 'pit volume after morning excavation pass',
  };
}

/** One valid field evidence reference set (sorted by digest). */
export function fieldEvidence(): Record<string, unknown>[] {
  return [
    { kind: 'photo', digest: PHOTO_DIGEST, capturedAt: T2 },
    { kind: 'sensor-reading', digest: SENSOR_DIGEST, capturedAt: T2 },
    { kind: 'note', digest: NOTE_DIGEST, capturedAt: T2 },
  ];
}

/** One valid capture envelope (sealed) — loose-JSON input form. */
export function captureInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    captureId: 'field-capture:pit-volume-morning',
    tenantId: TENANT,
    sessionId: 'field-session:shift-alpha',
    solutionId: SOLUTION,
    deliveryId: DELIVERY,
    observationId: 'observation:pit-volume-morning',
    capturedBy: FIELD_ENGINEER,
    capturedAt: T3,
    measure: { kind: 'quantity', value: '118.5', unit: 'm3' },
    uncertainty: fieldUncertainty(),
    evidence: fieldEvidence(),
    link: { status: 'resolved', workPackageId: WORK_PACKAGE },
    context: captureContext(true),
    ...overrides,
  };
}

/** One valid sealed capture envelope. */
export function sealedCapture(overrides: Record<string, unknown> = {}): SealedFieldCapture {
  const sealed = sealLooseCapture(captureInput(overrides));
  if (!sealed.ok) {
    throw new Error(`fixture capture failed to seal: ${JSON.stringify(sealed.error)}`);
  }
  return sealed.value;
}

/** One valid field review proposal input (loose JSON). */
export function reviewInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const capture = sealedCapture();
  return {
    proposalId: 'field-approval:pit-volume-review',
    tenantId: TENANT,
    sessionId: 'field-session:shift-alpha',
    reviewKind: 'observation-acceptance',
    subject: {
      deliveryId: DELIVERY,
      observationId: capture.observationId,
      observationDigest: capture.contentDigest,
    },
    reviewer: REVIEWER,
    justification: 'Photo and sensor references corroborate the measured volume.',
    createdAt: T4,
    ...overrides,
  };
}

/** One valid sealed field review proposal. */
export function sealedReview(overrides: Record<string, unknown> = {}): SealedFieldReviewProposal {
  const sealed = sealLooseReview(reviewInput(overrides));
  if (!sealed.ok) {
    throw new Error(`fixture review failed to seal: ${JSON.stringify(sealed.error)}`);
  }
  return sealed.value;
}

/** One valid W036 delivery record state (just opened, empty). */
export function openedDelivery(): SealedDeliveryRecord {
  const opened = openDeliveryRecord({
    schema: 'epoch.solution-delivery.delivery-record',
    schemaVersion: 1,
    deliveryId: DELIVERY,
    tenantId: TENANT,
    solutionId: SOLUTION,
    solutionVersion: SOLUTION_VERSION,
    solutionVersionDigest: SOLUTION_VERSION_DIGEST,
    openedAt: T0,
    openedBy: DELIVERY_LEAD,
    status: 'open',
    observations: [],
    acceptedObservationIds: [],
    rejectedObservationIds: [],
    actuals: [],
  });
  if (!opened.ok) {
    throw new Error(`fixture delivery failed to open: ${JSON.stringify(opened.error)}`);
  }
  return opened.value;
}

