// W030 — THE CROSS-SURFACE SECURITY SCENARIO EVIDENCE (positive):
// the full admission -> observation -> violation -> quarantine ->
// audit -> recovery lifecycle over the REAL kernels, with the
// security:* events verified through the REAL W010 sealEvent.
import { describe, expect, it } from 'vitest';
import { sealEvent } from '@epoch/event-log';
import { computeSecurityEventDigest } from '@epoch/observability';
import { runSecurityScenario, unwrap } from '../scenarios/security-scenario';

describe('the W030 cross-surface security scenario (positive)', () => {
  it('runs the full lifecycle and produces the inspectable evidence chain', () => {
    const outcome = runSecurityScenario();

    // The conforming admission passed the isolation gate.
    expect(outcome.admission.verdict.verdict).toBe('conforms');
    expect(outcome.admission.quarantined).toBe(false);

    // The audit pass: the R12 record was DENIED (compliant) and the
    // REAL W041 projection holds its invariants — no findings.
    expect(outcome.auditPass.tenantBoundaryFindings).toEqual([]);
    expect(outcome.auditPass.projectionFindings).toEqual([]);
    expect(outcome.auditPass.observations).toEqual([]);

    // The recovery admission succeeded after the quarantine release.
    expect(outcome.recoveredAdmission.verdict.verdict).toBe('conforms');

    // The final state: the quarantine is RELEASED (no longer
    // 'critical'), the violation FACT persists in the metrics (the
    // audit trail is append-only — history never disappears), so the
    // recovered state is 'degraded' with 1 critical violation (below
    // the critical threshold of 2) and zero quarantined subjects.
    expect(outcome.state.health?.status).toBe('degraded');
    expect(outcome.state.quarantinedSubjects).toEqual([]);
    expect(outcome.state.metrics.observationsTotal).toBe(8);
    expect(outcome.state.metrics.sandboxAdmissionsConforming).toBe(2);
    expect(outcome.state.metrics.sandboxAdmissionsViolating).toBe(1);
    expect(outcome.state.metrics.byClass['agent-session']).toBe(1);
    expect(outcome.state.metrics.byClass['simulation-run']).toBe(1);
    expect(outcome.state.metrics.byClass['action-dispatch']).toBe(1);
    expect(outcome.state.metrics.byClass['tenant-boundary-check']).toBe(1);
    expect(outcome.state.metrics.byClass['authorization-decision']).toBe(1);

    // The audit trail: sorted, one observation per recorded fact.
    expect(outcome.trail.length).toBe(8);
    const observedAt = outcome.trail.map((observation) => observation.observedAt);
    expect([...observedAt].sort()).toEqual(observedAt);

    // The snapshot: the tenant + the admitted REAL listing.
    expect(outcome.snapshot.tenants).toEqual(['tenant:globex']);
    expect(outcome.snapshot.admittedListings).toHaveLength(1);
    expect(outcome.snapshot.admittedListings[0]!.listing.listingId).toBe('listing:terrain-viewer');
  });

  it('every security:* event seals through the REAL W010 sealEvent and digests identically', () => {
    const outcome = runSecurityScenario();
    const auth = {
      principalId: 'principal:security-officer',
      context: {
        schemaVersion: 1 as const,
        principals: [
          { principalId: 'principal:security-officer', status: 'active' as const, authenticated: true },
        ],
        memberships: [{ principalId: 'principal:security-officer', tenantId: 'tenant:globex' }],
        knownTenants: ['tenant:globex'],
      },
    };
    const stream = unwrap(
      outcome.runtime.readStream({
        tenantId: 'tenant:globex',
        authorization: auth,
        streamId: 'stream:security-host-globex',
      }),
    );
    expect(stream.length).toBeGreaterThan(0);
    expect(stream[0]!.payload.discriminator).toBe('security:policy-registered');
    for (const event of stream) {
      const { contentDigest, ...content } = event;
      const throughReal = sealEvent(content);
      expect(throughReal.ok).toBe(true);
      expect(computeSecurityEventDigest(content as never)).toBe(contentDigest);
    }
    // The per-subject streams carry the observed lifecycle (the
    // conforming extension's stream holds its admission event; the
    // violating extension's stream holds its violation + quarantine
    // + release events).
    const subjectStream = unwrap(
      outcome.runtime.readStream({
        tenantId: 'tenant:globex',
        authorization: auth,
        streamId: 'stream:security-terrain-viewer',
      }),
    );
    expect(subjectStream.length).toBe(1);
    expect(subjectStream.map((event) => event.sequence)).toEqual([1]);
    const rogueStream = unwrap(
      outcome.runtime.readStream({
        tenantId: 'tenant:globex',
        authorization: auth,
        streamId: 'stream:security-rogue-remote',
      }),
    );
    // The rogue extension's stream: the violation observation, the
    // quarantine imposition, the violation-detected record, the
    // release, and the recovered admission observation (5 events,
    // sequences 1..5).
    expect(rogueStream.length).toBe(5);
    expect(rogueStream.map((event) => event.sequence)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('the W030 cross-surface security scenario (determinism)', () => {
  it('two scenario runs produce byte-identical snapshots + states', () => {
    const first = runSecurityScenario();
    const second = runSecurityScenario();
    expect(JSON.stringify(first.snapshot)).toBe(JSON.stringify(second.snapshot));
    expect(JSON.stringify(first.state.metrics)).toBe(JSON.stringify(second.state.metrics));
    expect(JSON.stringify(first.trail)).toBe(JSON.stringify(second.trail));
    expect(JSON.stringify(first.auditPass)).toBe(JSON.stringify(second.auditPass));
  });
});
