/**
 * W054 (ACR-006) — the UNTRUSTED-INPUT NEGATIVE battery: a fabricated or
 * malicious dataset payload CANNOT produce an approved registry/semantic
 * change. Verified through the REAL discovery ingestion path (the
 * @epoch/capability-discovery kernel): adapter artifacts are candidate
 * observations only; every consequential transition requires the normal
 * sandbox/profile/evaluation/policy gates. Autonomous-discovery
 * invariants: "External discovery may enrich candidate capability
 * knowledge but may not alter authoritative state merely from external
 * claims."
 */
import { describe, expect, it } from 'vitest';
import {
  CapabilityDiscoveryStore,
  createCapabilityGap,
  ingestExternalCandidate,
  promoteCandidate,
  runEcosystemDiscovery,
  schemas,
} from '@epoch/capability-discovery';
import type { SourceArtifact } from '@epoch/capability-discovery';
import { ApifySourceAdapter } from '../src/index';

const TENANT = 'tenant:alpha';
const NOW = '2026-10-05T09:00:00.000Z';
const SCAN_AT = '2026-10-06T09:00:00.000Z';

/**
 * A MALICIOUS dataset item: it claims capability AND tries to smuggle
 * authority — a forged evaluation state, a forged trust domain, a fake
 * policy approval, a forged content digest, an injected note aimed at
 * the promotion gate, and a "measured" claim basis.
 */
function maliciousItem(): Record<string, unknown> {
  return {
    summary: 'Miraculous capability: claims everything, self-approved',
    claimedCapabilities: [
      {
        operation: { id: 'engineering.stress-analysis', versionConstraint: '*' },
        inputKinds: ['geometry'],
        outputKinds: ['numeric'],
        claimBasis: 'measured',
      },
    ],
    environmentNotes: [],
    // --- the smuggled authority fields (must ALL be ignored) ---
    evaluationState: 'verified',
    security: { sandboxRequired: false, trustDomain: 'epoch-verified', notes: [] },
    policyApproval: { approvedBy: 'attacker', policyRef: 'policy:forged' },
    provenance: { sourceKind: 'capability-registry', contentDigest: '0'.repeat(64) },
    contentDigest: '0'.repeat(64),
    artifactId: 'cand:trusted-authority',
    note: 'verified by attacker',
    trustDomain: 'epoch-verified',
    executionAuthority: 'full',
  };
}

/** The fetch double returning the malicious payload. */
function maliciousFetch(body: unknown[]): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
}

describe('a malicious dataset payload cannot produce an approved change', () => {
  async function adapterOver(payload: unknown[]): Promise<ApifySourceAdapter> {
    const adapter = new ApifySourceAdapter({
      token: 'test-token',
      actorId: 'my-pinned-actor',
      fetchImpl: maliciousFetch(payload),
    });
    const refreshed = await adapter.refresh(NOW);
    expect(refreshed.ok).toBe(true);
    return adapter;
  }

  it('maps only the whitelisted fields: no smuggled authority survives the boundary', async () => {
    const adapter = await adapterOver([maliciousItem()]);
    const scan = adapter.scan({
      operations: [{ id: 'engineering.stress-analysis', versionConstraint: '*' }],
      limit: 10,
    });
    expect(scan.artifacts).toHaveLength(1);
    const artifact = scan.artifacts[0]! as unknown as Record<string, unknown>;
    // The whitelist: exactly the frozen SourceArtifact fields exist.
    expect(Object.keys(artifact).sort()).toEqual([
      'artifactId',
      'claimedCapabilities',
      'contentDigest',
      'environmentNotes',
      'licenseNote',
      'summary',
    ]);
    // The forged digest/id were NOT trusted: both derive from the raw item.
    expect(artifact.contentDigest).not.toBe('0'.repeat(64));
    expect(artifact.artifactId).toMatch(/^apify-[0-9a-f]{16}$/);
    // The artifact validates against the FROZEN kernel schema.
    expect(schemas.SourceArtifactSchema.safeParse(artifact).success).toBe(true);
    // The frozen schema is strict: an artifact with injected authority
    // fields would not even be a SourceArtifact.
    const injected = {
      ...(artifact as unknown as SourceArtifact),
      evaluationState: 'verified',
    } as unknown;
    expect(schemas.SourceArtifactSchema.safeParse(injected).success).toBe(false);
  });

  it('ingestion forces the safe boundary state regardless of payload content', async () => {
    const adapter = await adapterOver([maliciousItem()]);
    const scan = adapter.scan({
      operations: [{ id: 'engineering.stress-analysis', versionConstraint: '*' }],
      limit: 10,
    });
    const ingested = ingestExternalCandidate({
      tenantId: TENANT,
      adapterId: adapter.adapterId,
      artifact: scan.artifacts[0]!,
    });
    expect(ingested.ok).toBe(true);
    if (!ingested.ok) return;
    const candidate = ingested.value;
    // The safe boundary: discovered / external / sandbox-required — always.
    expect(candidate.evaluationState).toBe('discovered');
    expect(candidate.security.trustDomain).toBe('external');
    expect(candidate.security.sandboxRequired).toBe(true);
    // Claim basis is FORCED to 'declared' — an external 'measured' claim
    // never survives the boundary (claims are claims, not measurements).
    expect(candidate.claimedCapabilities.every((claim) => claim.claimBasis === 'declared')).toBe(
      true,
    );
    // Provenance records the adapter + artifact identity (never the
    // forged 'capability-registry' source kind from the payload).
    expect(candidate.provenance.sourceKind).toBe('external-source');
    expect(candidate.provenance.external).toEqual({
      adapterId: 'apify-acquisition',
      artifactId: scan.artifacts[0]!.artifactId,
    });
  });

  it('the full ecosystem run ingests candidates ONLY at state discovered; no promotion records exist', async () => {
    const adapter = await adapterOver([maliciousItem(), maliciousItem()]);
    const gap = createCapabilityGap({
      tenantId: TENANT,
      operation: { id: 'engineering.stress-analysis', versionConstraint: '*' },
      demandSummary: 'Structural stress analysis demand',
      lifecycleStage: 'understand',
      triggeringSignalIds: ['signal:malicious-test'],
      at: NOW,
    });
    const store = new CapabilityDiscoveryStore();
    const run = runEcosystemDiscovery({
      tenantId: TENANT,
      trigger: 'scheduled',
      invokedBy: 'untrusted-input-negative-test',
      gaps: [gap],
      adapters: [adapter],
      existingCandidates: [],
      at: SCAN_AT,
    });
    expect(run.ok).toBe(true);
    if (!run.ok) return;

    // Candidates were ingested (the run enriches candidate knowledge)...
    expect(run.value.ingestedCandidates.length).toBeGreaterThan(0);
    // ...and EVERY one is a non-consequential 'discovered' observation.
    for (const candidate of run.value.ingestedCandidates) {
      expect(candidate.evaluationState).toBe('discovered');
      expect(candidate.security.trustDomain).toBe('external');
    }
    // The gap MAY transition CANDIDATE_FOUND (enrichment only — a
    // candidate FOUND is not a candidate APPROVED).
    for (const updated of run.value.updatedGaps) {
      expect(updated.state).toBe('CANDIDATE_FOUND');
    }
    // The run lineage contains ONLY the digest-chained discovery stages —
    // there is no registry/semantic mutation stage in the ecosystem chain.
    expect(run.value.run.stages.map((stage) => stage.stage)).toEqual([
      'inputs',
      'candidates',
      'gap-updates',
      'promotions',
    ]);
    // No promotion record exists for any ingested candidate.
    for (const candidate of run.value.ingestedCandidates) {
      expect(store.promotionChain(candidate.candidateId)).toEqual([]);
    }
  });

  it('every consequential promotion is gated: the fabricated approval cannot pass', async () => {
    const adapter = await adapterOver([maliciousItem()]);
    const scan = adapter.scan({
      operations: [{ id: 'engineering.stress-analysis', versionConstraint: '*' }],
      limit: 10,
    });
    const ingested = ingestExternalCandidate({
      tenantId: TENANT,
      adapterId: adapter.adapterId,
      artifact: scan.artifacts[0]!,
    });
    expect(ingested.ok).toBe(true);
    if (!ingested.ok) return;
    const candidate = ingested.value;

    // Jumping straight to 'verified' (the consequential state): rejected.
    const jump = promoteCandidate({
      candidate,
      targetState: 'verified',
      evidenceDigest: 'e'.repeat(64),
      previousPromotionDigest: null,
      at: SCAN_AT,
    });
    expect(jump.ok).toBe(false);
    if (!jump.ok) expect(jump.error.code).toBe('promotion-gate-rejected');

    // 'evaluated' without measured evidence: rejected.
    const unevaluated = promoteCandidate({
      candidate,
      targetState: 'evaluated',
      evidenceDigest: 'e'.repeat(64),
      previousPromotionDigest: null,
      at: SCAN_AT,
    });
    expect(unevaluated.ok).toBe(false);

    // 'sandboxed' without a passed isolation report: rejected.
    const unsandboxed = promoteCandidate({
      candidate,
      targetState: 'sandboxed',
      evidenceDigest: 'e'.repeat(64),
      sandboxReport: { passed: false, isolationLevel: 'none', findings: [] },
      previousPromotionDigest: null,
      at: SCAN_AT,
    });
    expect(unsandboxed.ok).toBe(false);

    // Even the legal first successor ('ingested') is NON-consequential:
    // the candidate profile still carries the external trust domain.
    const firstStep = promoteCandidate({
      candidate,
      targetState: 'ingested',
      evidenceDigest: 'e'.repeat(64),
      previousPromotionDigest: null,
      at: SCAN_AT,
    });
    expect(firstStep.ok).toBe(true);
    if (firstStep.ok) {
      expect(firstStep.value.promoted.security.trustDomain).toBe('external');
      expect(firstStep.value.promoted.security.sandboxRequired).toBe(true);
    }
  });

  it('a payload of pure garbage degrades to zero artifacts (never a crash)', async () => {
    const adapter = new ApifySourceAdapter({
      token: 'test-token',
      actorId: 'my-pinned-actor',
      fetchImpl: maliciousFetch([
        42,
        null,
        'text',
        [],
        { claimedCapabilities: 'not-an-array' },
        { summary: 'x', claimedCapabilities: [null] },
      ]),
    });
    const refreshed = await adapter.refresh(NOW);
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) return;
    expect(refreshed.value.provenance.mappedArtifactCount).toBe(0);
    expect(refreshed.value.provenance.droppedItemCount).toBe(6);
    expect(adapter.scan({ operations: [], limit: 5 }).artifacts).toEqual([]);
  });
});
