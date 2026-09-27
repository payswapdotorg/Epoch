// POSITIVE: the capture flow — low-friction observation capture with
// evidence by digest (the W006 convention), the MANDATORY uncertainty
// state (W036 grammar), resolved work-package linkage, and the conversion
// into a W036 Observation-distinction record the kernel admits verbatim.
import { describe, expect, it } from 'vitest';
import {
  admitFieldEvidenceRef,
  captureSessionGuard,
  captureTenantGuard,
  computeFieldEvidenceDigest,
  toObservationRecord,
  verifySealedFieldCapture,
} from '../src/index';
import {
  recordObservation,
  verifySealedDistinctionRecord,
} from '@epoch/solution-delivery';
import {
  NOTE_DIGEST,
  OTHER_TENANT,
  TENANT,
  PHOTO_DIGEST,
  SENSOR_DIGEST,
  T3,
  T5,
  WORK_PACKAGE,
  captureInput,
  openedDelivery,
  sealedCapture,
  sealedSession,
  sealLooseCapture,
} from './helpers';

describe('capture envelope admission (positive)', () => {
  it('seals a valid capture with the mandatory uncertainty state', () => {
    const sealed = sealLooseCapture(captureInput());
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    expect(sealed.value.captureId).toBe('field-capture:pit-volume-morning');
    expect(sealed.value.link.status).toBe('resolved');
    expect(sealed.value.link.workPackageId).toBe(WORK_PACKAGE);
    expect(sealed.value.evidence).toHaveLength(3);
  });

  it('carries the quantity/progress measure in the W036 grammar', () => {
    const sealed = sealLooseCapture({
      ...captureInput(),
      measure: { kind: 'progress', fraction: 0.4 },
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    expect(sealed.value.measure).toEqual({ kind: 'progress', fraction: 0.4 });
  });

  it('evidence references are photo/sensor/note kinds BY DIGEST (never payloads)', () => {
    const sealed = sealedCapture();
    const kinds = sealed.evidence.map((ref) => ref.kind).sort();
    expect(kinds).toEqual(['note', 'photo', 'sensor-reading']);
    for (const ref of sealed.evidence) {
      expect(ref.digest).toMatch(/^[0-9a-f]{64}$/);
      expect(Object.keys(ref).sort()).toEqual(['capturedAt', 'digest', 'kind']);
    }
  });

  it('the evidence digests are canonical content digests (same payload -> same digest)', () => {
    const first = computeFieldEvidenceDigest({ note: 'excavation complete' });
    const second = computeFieldEvidenceDigest({ note: 'excavation complete' });
    expect(first).toBe(second);
    const reordered = computeFieldEvidenceDigest({ note: 'excavation complete', extra: 1 });
    expect(reordered).not.toBe(first);
  });

  it('evidence refs are sorted by digest and duplicate-free (deterministic serialization)', () => {
    const sealed = sealLooseCapture({
      ...captureInput(),
      evidence: [
        { kind: 'note', digest: NOTE_DIGEST, capturedAt: T3 },
        { kind: 'photo', digest: PHOTO_DIGEST, capturedAt: T3 },
        { kind: 'sensor-reading', digest: SENSOR_DIGEST, capturedAt: T3 },
      ],
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    expect(sealed.value.evidence.map((ref: { digest: string }) => ref.digest)).toEqual([
      PHOTO_DIGEST,
      SENSOR_DIGEST,
      NOTE_DIGEST,
    ]);
  });

  it('capture context carries provenance (device descriptor digest + offline flag)', () => {
    const sealed = sealedCapture();
    expect(sealed.context.deviceDescriptorDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(sealed.context.offline).toBe(true);
  });

  it('JSON round-trip preserves the sealed capture and its digest verifies', () => {
    const sealed = sealedCapture();
    const roundTripped = JSON.parse(JSON.stringify(sealed)) as unknown;
    const verified = verifySealedFieldCapture(roundTripped);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toEqual(sealed);
    }
  });

  it('evidence reference admission is total and typed (valid ref round-trips)', () => {
    const admitted = admitFieldEvidenceRef({
      kind: 'photo',
      digest: PHOTO_DIGEST,
      capturedAt: T3,
    });
    expect(admitted.ok).toBe(true);
    if (admitted.ok) {
      expect(admitted.value.kind).toBe('photo');
    }
  });
});

describe('the W036 conversion (envelope -> Observation-distinction record)', () => {
  it('converts into a kernel-sealed observation record (digest verifies through the kernel)', () => {
    const capture = sealedCapture();
    const converted = toObservationRecord(capture, {
      recordId: capture.observationId,
      recordedAt: T5,
      recordedBy: 'principal:delivery-lead',
    });
    expect(converted.ok).toBe(true);
    if (!converted.ok) return;
    expect(converted.value.kind).toBe('observation');
    expect(converted.value.recordId).toBe('observation:pit-volume-morning');
    expect(converted.value.subject.subjectKind).toBe('work-package');
    expect(converted.value.subject.subjectId).toBe(WORK_PACKAGE);
    expect(converted.value.measure).toEqual({ kind: 'quantity', value: '118.5', unit: 'm3' });
    // Evidence becomes the W036 EvidenceReference digest-only list.
    expect(converted.value.payload.evidence).toEqual([
      { digest: PHOTO_DIGEST },
      { digest: SENSOR_DIGEST },
      { digest: NOTE_DIGEST },
    ]);
    // The kernel's own verify admits the converted record.
    const verified = verifySealedDistinctionRecord(converted.value);
    expect(verified.ok).toBe(true);
  });

  it('the converted observation is admitted by the W036 recordObservation seam (end-to-end)', () => {
    const delivery = openedDelivery();
    const capture = sealedCapture();
    const converted = toObservationRecord(capture, {
      recordId: capture.observationId,
      recordedAt: T5,
      recordedBy: 'principal:delivery-lead',
    });
    expect(converted.ok).toBe(true);
    if (!converted.ok) return;
    const recorded = recordObservation(delivery, converted.value);
    expect(recorded.ok).toBe(true);
    if (recorded.ok) {
      expect(recorded.value.observations).toHaveLength(1);
      expect(recorded.value.observations[0]!.recordId).toBe('observation:pit-volume-morning');
    }
  });

  it('the mandatory uncertainty state is preserved verbatim in the conversion', () => {
    const capture = sealedCapture();
    const converted = toObservationRecord(capture, {
      recordId: capture.observationId,
      recordedAt: T5,
      recordedBy: 'principal:delivery-lead',
    });
    expect(converted.ok).toBe(true);
    if (!converted.ok) return;
    expect(converted.value.uncertainty).toEqual(capture.uncertainty);
    expect(converted.value.uncertainty.provenance.kind).toBe('observed');
  });

  it('a conversion record id without the observation prefix is a typed rejection', () => {
    const capture = sealedCapture();
    const converted = toObservationRecord(capture, {
      recordId: 'actual:not-an-observation',
      recordedAt: T5,
      recordedBy: 'principal:delivery-lead',
    });
    expect(converted.ok).toBe(false);
    if (converted.ok) return;
    expect(converted.error.code).toBe('validation');
    expect(converted.error.message).toContain('observation:');
  });
});

describe('capture guards (tenant + session)', () => {
  it('the tenant guard rejects a capture from another tenant (cross-tenant-denied)', () => {
    const other = sealedCapture({ tenantId: OTHER_TENANT, sessionId: 'field-session:other' });
    const guarded = captureTenantGuard(other, TENANT);
    expect(guarded.ok).toBe(false);
    if (guarded.ok) return;
    expect(guarded.error.code).toBe('cross-tenant-denied');
  });

  it('the session guard rejects a capture from another session', () => {
    const capture = sealedCapture();
    const session = sealedSession();
    const guarded = captureSessionGuard(capture, { ...session, sessionId: 'field-session:other' });
    expect(guarded.ok).toBe(false);
    if (guarded.ok) return;
    expect(guarded.error.code).toBe('validation');
    expect(guarded.error.message).toContain('belongs to session');
  });

  it('the session guard ties the capture to the session tenant (R12)', () => {
    const capture = sealedCapture();
    const session = { ...sealedSession(), tenantId: OTHER_TENANT };
    const guarded = captureSessionGuard(capture, session);
    expect(guarded.ok).toBe(false);
    if (guarded.ok) return;
    expect(guarded.error.code).toBe('cross-tenant-denied');
  });

  it('a capture of another delivery scope does not convert into the wrong delivery', () => {
    const capture = sealedCapture({ deliveryId: 'delivery:another-scope' });
    const converted = toObservationRecord(capture, {
      recordId: capture.observationId,
      recordedAt: T5,
      recordedBy: 'principal:delivery-lead',
    });
    expect(converted.ok).toBe(true);
    if (!converted.ok) return;
    // The conversion preserves the envelope's own delivery scope.
    expect(converted.value.payload.deliveryId).toBe('delivery:another-scope');
    // The kernel rejects recording it into the mismatched delivery.
    const recorded = recordObservation(openedDelivery(), converted.value);
    expect(recorded.ok).toBe(false);
    if (recorded.ok) return;
    expect(recorded.error.code).toBe('validation');
  });
});
