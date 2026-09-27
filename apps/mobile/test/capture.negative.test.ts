// NEGATIVE (the named W018 dispatch battery): capture without the mandatory
// uncertainty state (`uncertainty-missing-rejected`), ambiguous work-package
// linkage (`ambiguous-linkage-rejected` — never a guess), malformed envelope,
// tampered digest, embedded evidence payloads (`evidence-payload-rejected`),
// and vendor-field smuggle attempts.
import { describe, expect, it } from 'vitest';
import {
  admitFieldEvidenceRef,
  verifySealedFieldCapture,
} from '../src/index';
import {
  FIELD_ENGINEER,
  NOTE_DIGEST,
  OTHER_TENANT,
  PHOTO_DIGEST,
  SOLUTION,
  T3,
  TENANT,
  WORK_PACKAGE,
  WORK_PACKAGE_ALT,
  captureInput,
  fieldUncertainty,
  sealLooseCapture,
  sealedCapture,
} from './helpers';

describe('uncertainty-missing-rejected (the mandatory uncertainty state)', () => {
  it('a capture WITHOUT any uncertainty state is a typed rejection', () => {
    const input = captureInput();
    delete (input as Record<string, unknown>)['uncertainty'];
    const sealed = sealLooseCapture(input);
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('uncertainty-missing-rejected');
    expect(sealed.error.message).toContain('inexpressible');
    expect(sealed.error.issues).toEqual([
      { path: 'uncertainty', message: 'the uncertainty state is required' },
    ]);
  });

  it('a capture with a null uncertainty state is a typed rejection', () => {
    const sealed = sealLooseCapture({ ...captureInput(), uncertainty: null });
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('uncertainty-missing-rejected');
  });

  it('an uncertainty state missing its confidence component is a typed rejection', () => {
    const partial = fieldUncertainty();
    delete (partial as Record<string, unknown>)['confidence'];
    const sealed = sealLooseCapture({ ...captureInput(), uncertainty: partial });
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('uncertainty-missing-rejected');
    expect(sealed.error.message).toContain('provenance, freshness AND confidence');
  });

  it('an uncertainty state missing its provenance component is a typed rejection', () => {
    const partial = fieldUncertainty();
    delete (partial as Record<string, unknown>)['provenance'];
    const sealed = sealLooseCapture({ ...captureInput(), uncertainty: partial });
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('uncertainty-missing-rejected');
  });

  it('an uncertainty state missing its freshness component is a typed rejection', () => {
    const partial = fieldUncertainty();
    delete (partial as Record<string, unknown>)['freshness'];
    const sealed = sealLooseCapture({ ...captureInput(), uncertainty: partial });
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('uncertainty-missing-rejected');
  });

  it('an uncertainty state carrying vendor fields is a typed vendor-fields rejection', () => {
    const smuggled = fieldUncertainty({ vendorConfidence: 'high' });
    const sealed = sealLooseCapture({ ...captureInput(), uncertainty: smuggled });
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('vendor-fields-rejected');
  });
});

describe('ambiguous-linkage-rejected (never a guess)', () => {
  it('an unresolved link with multiple candidates is a typed rejection', () => {
    const sealed = sealLooseCapture({
      ...captureInput(),
      link: {
        status: 'unresolved',
        candidateWorkPackageIds: [WORK_PACKAGE, WORK_PACKAGE_ALT],
      },
    });
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('ambiguous-linkage-rejected');
    expect(sealed.error.message).toContain(WORK_PACKAGE);
    expect(sealed.error.message).toContain(WORK_PACKAGE_ALT);
    expect(sealed.error.message).toContain('never a guess');
  });

  it('a malformed link input (unknown status) is a typed validation error', () => {
    const sealed = sealLooseCapture({
      ...captureInput(),
      link: { status: 'best-effort', workPackageId: WORK_PACKAGE },
    });
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('validation');
  });

  it('a resolved link with a malformed work-package id is a typed validation error', () => {
    const sealed = sealLooseCapture({
      ...captureInput(),
      link: { status: 'resolved', workPackageId: 'package:malformed' },
    });
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('validation');
  });
});

describe('evidence-payload-rejected (evidence by digest only, never payloads)', () => {
  it('an evidence reference carrying raw data is a typed rejection', () => {
    const sealed = sealLooseCapture({
      ...captureInput(),
      evidence: [{ kind: 'photo', digest: PHOTO_DIGEST, capturedAt: T3, data: 'base64:...' }],
    });
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('evidence-payload-rejected');
    expect(sealed.error.message).toContain('never embedded');
  });

  it('an evidence reference carrying a payload byte array is a typed rejection', () => {
    const admitted = admitFieldEvidenceRef({
      kind: 'photo',
      digest: PHOTO_DIGEST,
      capturedAt: T3,
      bytes: [255, 216, 255, 224],
    });
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('evidence-payload-rejected');
  });

  it('an evidence reference carrying a locator/url is a typed rejection', () => {
    const admitted = admitFieldEvidenceRef({
      kind: 'photo',
      digest: PHOTO_DIGEST,
      capturedAt: T3,
      url: 'https://example.invalid/photo.jpg',
    });
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('evidence-payload-rejected');
  });

  it('duplicate evidence digests are rejected (duplicate-free discipline)', () => {
    const sealed = sealLooseCapture({
      ...captureInput(),
      evidence: [
        { kind: 'photo', digest: PHOTO_DIGEST, capturedAt: T3 },
        { kind: 'sensor-reading', digest: PHOTO_DIGEST, capturedAt: T3 },
      ],
    });
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('validation');
    expect(JSON.stringify(sealed.error)).toContain('duplicate-free');
  });

  it('an invalid digest form (not 64 lowercase hex) is a typed validation error', () => {
    const admitted = admitFieldEvidenceRef({
      kind: 'photo',
      digest: 'not-a-digest',
      capturedAt: T3,
    });
    expect(admitted.ok).toBe(false);
    if (admitted.ok) return;
    expect(admitted.error.code).toBe('validation');
  });
});

describe('malformed envelope rejected', () => {
  it('a schemaVersion skew is rejected (the version pin)', () => {
    const input = captureInput();
    (input as Record<string, unknown>)['schemaVersion'] = 2;
    // sealFieldCapture pins the version itself; the sealed verify path catches drift.
    const sealed = sealLooseCapture(input);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const drifted = { ...sealed.value, schemaVersion: 2 };
    const verified = verifySealedFieldCapture(drifted);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('validation');
  });

  it('missing required fields are typed validation errors, never exceptions', () => {
    for (const field of ['captureId', 'tenantId', 'capturedBy', 'capturedAt', 'measure', 'context']) {
      const input = captureInput();
      delete (input as Record<string, unknown>)[field];
      const sealed = sealLooseCapture(input);
      expect(sealed.ok).toBe(false);
      if (sealed.ok) return;
      expect(sealed.error.code).toBe('validation');
    }
  });

  it('a capture id outside the field-capture grammar is rejected', () => {
    const sealed = sealLooseCapture({ ...captureInput(), captureId: 'capture:bad-prefix' });
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('validation');
  });

  it('an observation id outside the observation grammar is rejected', () => {
    const sealed = sealLooseCapture({ ...captureInput(), observationId: 'forecast:bad-kind' });
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('validation');
  });

  it('an observation id without the observation prefix fails the envelope refinement', () => {
    const sealed = sealLooseCapture({ ...captureInput(), observationId: 'measurement:pit-volume' });
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('validation');
    expect(sealed.error.issues?.some((issue) => issue.path === 'observationId')).toBe(true);
  });

  it('non-object inputs are typed validation errors, never exceptions', () => {
    for (const input of [null, 42, 'capture', [], true]) {
      const sealed = sealLooseCapture(input);
      expect(sealed.ok).toBe(false);
      if (sealed.ok) return;
      expect(sealed.error.code).toBe('validation');
    }
  });

  it('a vendor field never enters the sealed record (strict content keys only)', () => {
    const sealed = sealLooseCapture({ ...captureInput(), vendorCaptureApp: 'field-pro' });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    expect(Object.keys(sealed.value).sort()).toEqual([
      'captureId',
      'capturedAt',
      'capturedBy',
      'contentDigest',
      'context',
      'deliveryId',
      'evidence',
      'link',
      'measure',
      'observationId',
      'schema',
      'schemaVersion',
      'sessionId',
      'solutionId',
      'tenantId',
      'uncertainty',
    ]);
  });

  it('a vendor field on a sealed envelope is a typed vendor-fields rejection at verify', () => {
    const sealed = sealedCapture();
    const smuggled = { ...sealed, vendorCaptureApp: 'field-pro' };
    const verified = verifySealedFieldCapture(smuggled);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('vendor-fields-rejected');
  });
});

describe('tampered digest (tamper detection)', () => {
  it('mutating the sealed capture content is a typed digest-mismatch', () => {
    const sealed = sealedCapture();
    const tampered = { ...sealed, capturedAt: '2026-03-02T09:30:00.000Z' };
    const verified = verifySealedFieldCapture(tampered);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('digest-mismatch');
    expect(verified.error.expectedDigest).not.toBe(verified.error.encounteredDigest);
  });

  it('mutating the measure is a typed digest-mismatch', () => {
    const sealed = sealedCapture();
    const tampered = { ...sealed, measure: { kind: 'quantity', value: '999', unit: 'm3' } };
    const verified = verifySealedFieldCapture(tampered);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('digest-mismatch');
  });

  it('swapping an evidence digest is a typed digest-mismatch', () => {
    const sealed = sealedCapture();
    const tampered = {
      ...sealed,
      evidence: sealed.evidence.map((ref) =>
        ref.digest === NOTE_DIGEST ? { ...ref, digest: 'f'.repeat(64) } : ref,
      ),
    };
    const verified = verifySealedFieldCapture(tampered);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('digest-mismatch');
  });

  it('a cross-tenant capture tampered into the tenant is still digest-verified first (order)', () => {
    const other = sealedCapture({ tenantId: OTHER_TENANT, sessionId: 'field-session:other' });
    const tampered = { ...other, tenantId: TENANT };
    const verified = verifySealedFieldCapture(tampered);
    expect(verified.ok).toBe(false);
    if (verified.ok) return;
    expect(verified.error.code).toBe('digest-mismatch');
  });
});

describe('capture cross-tenant input rejected at admission', () => {
  it('a capture naming another tenant is sealed but guards reject it (R12 seam)', () => {
    // Sealing is tenant-neutral (the record carries its own tenant); the
    // guards + host enforce isolation. The malformed-tenant id itself:
    const sealed = sealLooseCapture({ ...captureInput(), tenantId: 'tenant:BAD-UPPERCASE' });
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('validation');
  });

  it('a principal outside the W009 grammar is rejected', () => {
    const sealed = sealLooseCapture({ ...captureInput(), capturedBy: 'user:not-a-principal' });
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('validation');
  });

  it('a solution id outside the W036 grammar is rejected', () => {
    const sealed = sealLooseCapture({ ...captureInput(), solutionId: 'sol:malformed' });
    expect(sealed.ok).toBe(false);
    if (sealed.ok) return;
    expect(sealed.error.code).toBe('validation');
  });

  it('the field constants stay referenced (no unused-import drift)', () => {
    expect(FIELD_ENGINEER).toBe('principal:field-engineer');
    expect(SOLUTION).toContain('tower-retrofit');
    expect(TENANT).toContain('fieldco');
  });
});
