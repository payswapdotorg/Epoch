// OBSERVATIONS + QUARANTINE + STORE (positive + negative): admission
// idempotency, duplicate conflicts, tenant scoping, quarantine
// lifecycle conflicts, and the deterministic read paths.
import { describe, expect, it } from 'vitest';
import {
  ObservabilityStore,
  isSubjectQuarantined,
  sealObservation,
  sealQuarantineFact,
  verifySealedObservation,
} from '../src/index';
import {
  EXTENSION_ID,
  OBSERVATION_ID,
  OTHER_TENANT,
  PRINCIPAL,
  QUARANTINE_ID,
  SOURCE_DIGEST,
  T1,
  T2,
  T4,
  T5,
  TENANT,
  contentOf,
  expectError,
  sealedAdmissionObservation,
  sealedBoundaryObservation,
  sealedViolationObservation,
  unwrap,
} from './fixtures';

describe('observation sealing (positive + negative)', () => {
  it('seals a well-formed observation with a canonical digest', () => {
    const sealed = sealedAdmissionObservation();
    expect(sealed.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(unwrap(verifySealedObservation(sealed)).contentDigest).toBe(sealed.contentDigest);
  });

  it('canonicalizes detail key order: equal content digests regardless of insertion order', () => {
    const a = unwrap(
      sealObservation({
        ...contentOf(sealedAdmissionObservation()),
        detail: { alpha: 1, beta: 2 },
      }),
    );
    const b = unwrap(
      sealObservation({
        ...contentOf(sealedAdmissionObservation()),
        detail: { beta: 2, alpha: 1 },
      }),
    );
    expect(a.contentDigest).toBe(b.contentDigest);
  });

  it('rejects a subject id whose kind prefix disagrees with the subject kind', () => {
    const error = expectError(
      sealObservation({
        ...contentOf(sealedAdmissionObservation()),
        subjectKind: 'agent-session',
        subjectId: EXTENSION_ID,
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('rejects an unknown observation class', () => {
    const error = expectError(
      sealObservation({
        ...contentOf(sealedAdmissionObservation()),
        observationClass: 'arbitrary-vendor-class',
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('rejects vendor fields and tampered digests', () => {
    expect(
      expectError(
        sealObservation({ ...contentOf(sealedAdmissionObservation()), vendorTool: 'x' }),
      ).code,
    ).toBe('vendor-fields-rejected');
    expect(
      expectError(verifySealedObservation({ ...sealedAdmissionObservation(), contentDigest: '0'.repeat(64) }))
        .code,
    ).toBe('digest-mismatch');
  });
});

describe('the store (observations)', () => {
  it('admits idempotently by id + digest; conflicts on same id + different content', () => {
    const store = new ObservabilityStore();
    const first = unwrap(store.admitObservation(sealedAdmissionObservation()));
    expect(first.admitted).toBe(true);
    const replay = unwrap(store.admitObservation(sealedAdmissionObservation()));
    expect(replay.admitted).toBe(false);
    const conflict = expectError(
      store.admitObservation(
        unwrap(
          sealObservation({
            ...contentOf(sealedAdmissionObservation()),
            outcome: 'denied',
          }),
        ),
      ),
    );
    expect(conflict.code).toBe('duplicate-observation');
  });

  it('listObservations sorts by (observedAt, observationId) — no insertion-order leaks', () => {
    const store = new ObservabilityStore();
    unwrap(store.admitObservation(sealedAdmissionObservation({ observedAt: T2 })));
    unwrap(
      store.admitObservation(sealedViolationObservation('observation:viol-002', { observedAt: T1 })),
    );
    unwrap(
      store.admitObservation(sealedViolationObservation('observation:viol-001', { observedAt: T1 })),
    );
    const listed = store.listObservations(TENANT);
    expect(listed.map((o) => o.observationId)).toEqual([
      'observation:viol-001',
      'observation:viol-002',
      OBSERVATION_ID,
    ]);
  });

  it('rejects cross-tenant admission against a scoped store (R12)', () => {
    const store = new ObservabilityStore({ expectedTenantId: TENANT });
    const error = expectError(
      store.admitObservation(sealedAdmissionObservation({ tenantId: OTHER_TENANT })),
    );
    expect(error.code).toBe('cross-tenant-denied');
  });

  it('listObservationsOfSubject filters by subject', () => {
    const store = new ObservabilityStore();
    unwrap(store.admitObservation(sealedAdmissionObservation()));
    unwrap(
      store.admitObservation(
        sealedBoundaryObservation('observation:boundary-001'),
      ),
    );
    expect(store.listObservationsOfSubject(TENANT, EXTENSION_ID)).toHaveLength(1);
    expect(store.listObservationsOfSubject(TENANT, TENANT)).toHaveLength(1);
  });
});

describe('the store (quarantine)', () => {
  function imposeFact(overrides: Record<string, unknown> = {}) {
    return {
      schema: 'epoch.observability.quarantine',
      schemaVersion: 1,
      quarantineId: QUARANTINE_ID,
      tenantId: TENANT,
      factKind: 'quarantine-imposed',
      subjectId: EXTENSION_ID,
      reason: 'grant exceeded the trust-class ceiling',
      actedAt: T4,
      actedBy: PRINCIPAL,
      ...overrides,
    };
  }

  it('imposes deny-by-default and releases explicitly', () => {
    const store = new ObservabilityStore();
    expect(store.isQuarantined(TENANT, EXTENSION_ID)).toBe(false);
    unwrap(store.imposeQuarantine(imposeFact()));
    expect(store.isQuarantined(TENANT, EXTENSION_ID)).toBe(true);
    expect(store.listQuarantinedSubjects(TENANT)).toEqual([EXTENSION_ID]);
    unwrap(
      store.releaseQuarantine({
        ...imposeFact(),
        factKind: 'quarantine-released',
        quarantineId: 'quarantine:ext-release-001',
        reason: 'remediated extension re-published',
        actedAt: T5,
      }),
    );
    expect(store.isQuarantined(TENANT, EXTENSION_ID)).toBe(false);
    expect(store.listQuarantinedSubjects(TENANT)).toEqual([]);
  });

  it('quarantine-conflict on double imposition', () => {
    const store = new ObservabilityStore();
    unwrap(store.imposeQuarantine(imposeFact()));
    const error = expectError(
      store.imposeQuarantine({
        ...imposeFact(),
        quarantineId: 'quarantine:ext-terrain-002',
        actedAt: T4,
      }),
    );
    expect(error.code).toBe('quarantine-conflict');
  });

  it('quarantine-release-rejected on a non-quarantined subject (no silent no-op)', () => {
    const store = new ObservabilityStore();
    const error = expectError(
      store.releaseQuarantine({
        ...imposeFact(),
        factKind: 'quarantine-released',
      }),
    );
    expect(error.code).toBe('quarantine-release-rejected');
  });

  it('imposition facts cannot enter through releaseQuarantine and vice versa', () => {
    const store = new ObservabilityStore();
    // A release call carrying an impose fact is rejected on the
    // release path (the fact kind belongs to the impose gate).
    expect(expectError(store.releaseQuarantine(imposeFact())).code).toBe(
      'quarantine-release-rejected',
    );
    unwrap(store.imposeQuarantine(imposeFact()));
    // An impose call carrying a release fact is rejected on the impose
    // path (the fact kind belongs to the release gate).
    expect(
      expectError(
        store.imposeQuarantine({
          ...imposeFact(),
          quarantineId: 'quarantine:ext-terrain-003',
          factKind: 'quarantine-released',
          reason: 'attempted release through the impose path',
        }),
      ).code,
    ).toBe('quarantine-conflict');
  });

  it('an unexplained quarantine is a typed validation failure', () => {
    const store = new ObservabilityStore();
    const error = expectError(store.imposeQuarantine(imposeFact({ reason: '' })));
    expect(error.code).toBe('validation');
  });

  it('the quarantine fold is deny-by-default under ambiguity (impose breaks release ties)', () => {
    const impose = unwrap(sealQuarantineFact(imposeFact({ actedAt: T1 })));
    const release = unwrap(
      sealQuarantineFact({
        ...imposeFact(),
        factKind: 'quarantine-released',
        actedAt: T1,
      }),
    );
    expect(isSubjectQuarantined(EXTENSION_ID, [impose, release])).toBe(true);
    expect(isSubjectQuarantined(EXTENSION_ID, [release, impose])).toBe(true);
  });

  it('facts are verified at admission (tamper detection on a claimed digest)', () => {
    const sealed = unwrap(sealQuarantineFact(imposeFact()));
    const store = new ObservabilityStore();
    // A claimed digest that does not match the content never enters
    // (the impose path verifies sealed inputs before admitting).
    const error = expectError(
      store.imposeQuarantine({ ...sealed, contentDigest: '0'.repeat(64) }),
    );
    expect(error.code).toBe('digest-mismatch');
    expect(SOURCE_DIGEST).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('the store (events + snapshot)', () => {
  it('appends events with contiguous sequences and rejects gaps', () => {
    const store = new ObservabilityStore();
    const streamId = 'stream:security-terrain-viewer';
    unwrap(
      store.appendEvent({
        schemaVersion: 1,
        streamId,
        sequence: 1,
        tenantId: TENANT,
        actor: PRINCIPAL,
        causalParent: null,
        payload: {
          discriminator: 'security:observation-recorded',
          data: {
            observationId: OBSERVATION_ID,
            observationDigest: 'a'.repeat(64),
            observationClass: 'sandbox-admission',
            subjectId: EXTENSION_ID,
            outcome: 'allowed',
            observedAt: T1,
          },
        },
        occurredAt: T1,
      }),
    );
    const gap = expectError(
      store.appendEvent({
        schemaVersion: 1,
        streamId,
        sequence: 3,
        tenantId: TENANT,
        actor: PRINCIPAL,
        causalParent: { streamId, sequence: 1 },
        payload: {
          discriminator: 'security:violation-detected',
          data: {
            observationId: OBSERVATION_ID,
            observationDigest: 'a'.repeat(64),
            violationCode: 'grant-exceeds-trust-ceiling',
            subjectId: EXTENSION_ID,
            detectedAt: T2,
          },
        },
        occurredAt: T2,
      }),
    );
    expect(gap.code).toBe('sequence-gap');
  });

  it('rejects a same-stream causal parent that is not strictly earlier (schema-level)', () => {
    const store = new ObservabilityStore();
    const streamId = 'stream:security-terrain-viewer';
    // The event SCHEMA rejects a same-stream parent >= the event
    // sequence BEFORE admission (the W010 discipline); the store adds
    // unknown-parent detection for parents the schema cannot see.
    const error = expectError(
      store.appendEvent({
        schemaVersion: 1,
        streamId,
        sequence: 1,
        tenantId: TENANT,
        actor: PRINCIPAL,
        causalParent: { streamId, sequence: 1 },
        payload: {
          discriminator: 'security:observation-recorded',
          data: {
            observationId: OBSERVATION_ID,
            observationDigest: 'a'.repeat(64),
            observationClass: 'sandbox-admission',
            subjectId: EXTENSION_ID,
            outcome: 'allowed',
            observedAt: T1,
          },
        },
        occurredAt: T1,
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('rejects an unknown cross-stream causal parent', () => {
    const store = new ObservabilityStore();
    const error = expectError(
      store.appendEvent({
        schemaVersion: 1,
        streamId: 'stream:security-terrain-viewer',
        sequence: 1,
        tenantId: TENANT,
        actor: PRINCIPAL,
        causalParent: { streamId: 'stream:security-unknown', sequence: 1 },
        payload: {
          discriminator: 'security:observation-recorded',
          data: {
            observationId: OBSERVATION_ID,
            observationDigest: 'a'.repeat(64),
            observationClass: 'sandbox-admission',
            subjectId: EXTENSION_ID,
            outcome: 'allowed',
            observedAt: T1,
          },
        },
        occurredAt: T1,
      }),
    );
    expect(error.code).toBe('unknown-causal-parent');
  });

  it('open-namespace discriminators seal; KNOWN security:* kinds pin their payload contracts', () => {
    const store = new ObservabilityStore();
    // An unknown discriminator is an OPEN-namespace event: it seals
    // fine (the W010 open-namespace discipline).
    const open = store.appendEvent({
      schemaVersion: 1,
      streamId: 'stream:security-terrain-viewer',
      sequence: 1,
      tenantId: TENANT,
      actor: PRINCIPAL,
      causalParent: null,
      payload: { discriminator: 'security:future-kind', data: {} },
      occurredAt: T1,
    });
    expect(open.ok).toBe(true);
    // A KNOWN security:* discriminator with malformed payload data is
    // a typed validation failure.
    const error = expectError(
      store.appendEvent({
        schemaVersion: 1,
        streamId: 'stream:security-weather-wasm',
        sequence: 1,
        tenantId: TENANT,
        actor: PRINCIPAL,
        causalParent: null,
        payload: {
          discriminator: 'security:quarantine-imposed',
          data: { not: 'the payload contract' },
        },
        occurredAt: T1,
      }),
    );
    expect(error.code).toBe('validation');
  });

  it('snapshots deterministically (sorted; byte-identical for equal contents)', () => {
    const first = new ObservabilityStore();
    unwrap(first.admitObservation(sealedAdmissionObservation()));
    unwrap(first.admitObservation(sealedViolationObservation('observation:viol-001')));
    const second = new ObservabilityStore();
    unwrap(second.admitObservation(sealedViolationObservation('observation:viol-001')));
    unwrap(second.admitObservation(sealedAdmissionObservation()));
    expect(JSON.stringify(unwrap(first.snapshot(TENANT)))).toBe(
      JSON.stringify(unwrap(second.snapshot(TENANT))),
    );
  });
});
