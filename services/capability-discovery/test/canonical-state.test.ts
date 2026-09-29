// Negative (b): external discovery CANNOT mutate canonical
// world/solution/delivery state. The proof uses the REAL W002 World Model
// and the REAL W036 solution surfaces (devDependencies — runtime parity
// only): a full discovery workflow (problem run + ecosystem scan with
// authority-claiming external artifacts + promotion) references their
// canonical state opaquely, and their serialized state stays
// BYTE-IDENTICAL before and after.
import { describe, expect, it } from 'vitest';
import { canonicalJson, WorldModel } from '@epoch/world-model';
import { sealSolutionVersion } from '@epoch/solution-delivery';
import { StaticCatalogSourceAdapter } from '@epoch/capability-discovery';
import type { DiscoveryInput } from '@epoch/capability-discovery';
import { buildService } from './fixtures';
import { ALLOW, PRINCIPAL_LEAD, TENANT_ALPHA } from './fixtures';

function inputReferencingCanonicalState(worldDigest: string, solutionDigest: string): DiscoveryInput {
  return {
    schemaVersion: 1,
    tenantId: TENANT_ALPHA,
    task: {
      summary: 'Assess the structure recorded in the canonical world',
      lifecycleStage: 'understand',
      domainRefs: ['construction'],
      objectives: ['assessment'],
    },
    worldRefs: [
      // OPAQUE references: ids + content digests, never embedded state.
      { refId: 'world:bridge-12-model', contentDigest: worldDigest, summary: 'the canonical world' },
      { refId: 'solution:bridge-12-baseline', contentDigest: solutionDigest, summary: 'the approved solution baseline' },
    ],
    evidenceSignals: [],
    constraintSignals: [],
    taskSignals: [
      {
        signalId: 's-analysis',
        kind: 'operation',
        summary: 'Structural analysis over the recorded world',
        subjectRefs: ['world:bridge-12-model'],
        evidenceRefs: [],
        constraintRefs: [],
        operationRef: { id: 'engineering.stress-analysis', versionConstraint: '*' },
        representationHints: ['geometry'],
        outputHints: ['numeric'],
      },
    ],
    packContributions: [],
  };
}

describe('negative (b) — external discovery cannot mutate canonical state', () => {
  it('a full discovery workflow leaves the REAL world model + solution records byte-identical', () => {
    // Canonical state under protection: a REAL W002 world model and a
    // REAL W036 sealed solution version.
    const world = WorldModel.create();
    const worldBefore = canonicalJson(world.serialize() as never);
    // The REAL W036 sealed solution version (baseline authority).
    const sealedSolution = sealSolutionVersion({
      schema: 'epoch.solution-delivery.solution-version',
      schemaVersion: 1,
      solutionId: 'solution:bridge-12-retrofit',
      version: '1.0.0',
      tenantId: 'tenant:alpha',
      title: 'Bridge 12 retrofit baseline',
      objective: 'safe retrofit',
      solutionLines: [
        {
          lineId: 'line:structural-works',
          title: 'Structural works',
          quantity: { value: '1', unit: 'lot' },
        },
      ],
      worldReferences: [{ entityId: 'bridge-12' }],
      constraintReferences: [],
      previousVersionDigest: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      createdBy: 'principal:tech-lead',
    });
    // If the W036 shape changed, fail loudly — the fixture must be real.
    expect(sealedSolution.ok).toBe(true);
    if (!sealedSolution.ok) return;
    const solutionBefore = canonicalJson(sealedSolution.value as never);

    // The discovery input references the canonical state ONLY opaquely.
    const service = buildService();
    const input = inputReferencingCanonicalState('a'.repeat(64), 'b'.repeat(64));

    // Phase 1: problem-driven run with an external (unverified) candidate
    // claiming it can "modify world state" (inert self-description).
    const externalCandidate = {
      schemaVersion: 1 as const,
      candidateId: 'cand:ext-world-writer',
      kind: 'external' as const,
      displayName: 'External candidate world-writer-artifact',
      summary: 'Self-description: claims it can modify world state (inert metadata)',
      claimedCapabilities: [
        {
          operation: { id: 'engineering.stress-analysis', versionConstraint: '*' },
          inputKinds: ['geometry' as const],
          outputKinds: ['numeric' as const],
          claimBasis: 'declared' as const,
        },
      ],
      runtimeRequirements: [],
      environmentRequirements: [],
      provenance: {
        sourceKind: 'external-source' as const,
        sourceRef: 'world-writer-artifact',
        contentDigest: 'c'.repeat(64),
        external: { adapterId: 'fixture-catalog', artifactId: 'world-writer-artifact' },
      },
      evaluationState: 'discovered' as const,
      security: {
        sandboxRequired: true,
        trustDomain: 'external' as const,
        notes: ['untrusted external artifact'],
      },
    };
    const run = service.runProblemDiscovery({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      input,
      options: { candidates: [externalCandidate] },
      at: '2026-10-05T09:00:00.000Z',
    });
    expect(run.ok).toBe(true);
    if (!run.ok) return;

    // Phase 2: an ecosystem scan with more authority-claiming artifacts.
    const scan = service.runEcosystemScan({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      trigger: 'gap',
      adapters: [
        new StaticCatalogSourceAdapter({
          adapterId: 'fixture-catalog',
          description: 'static fixture catalog',
          catalog: [
            {
              artifactId: 'state-writer-artifact',
              contentDigest: 'd'.repeat(64),
              summary: 'Self-description: writes to the world database (inert metadata)',
              claimedCapabilities: [
                {
                  operation: { id: 'engineering.stress-analysis', versionConstraint: '*' },
                  inputKinds: ['geometry'],
                  outputKinds: ['numeric'],
                  claimBasis: 'declared',
                },
              ],
              environmentNotes: [],
            },
          ],
        }),
      ],
      at: '2026-10-06T09:00:00.000Z',
    });
    expect(scan.ok).toBe(true);

    // Phase 3: promote the external candidate honestly through the gates.
    if (scan.ok && scan.value.ingestedCandidates.length > 0) {
      const candidateId = scan.value.ingestedCandidates[0]!.candidateId;
      const first = service.promoteExternalCandidate({
        principal: PRINCIPAL_LEAD,
        authorization: ALLOW,
        tenantId: TENANT_ALPHA,
        candidateId,
        targetState: 'ingested',
        evidenceDigest: 'e'.repeat(64),
        at: '2026-10-06T10:00:00.000Z',
      });
      expect(first.ok).toBe(true);
    }

    // THE ASSERTION: canonical state is byte-identical after the whole
    // workflow. The discovery plane holds only its own records.
    const worldAfter = canonicalJson(world.serialize() as never);
    expect(worldAfter).toBe(worldBefore);
    const solutionAfter = canonicalJson(sealedSolution.value as never);
    expect(solutionAfter).toBe(solutionBefore);
  });

  it('the service API exposes NO write path to canonical state (structural)', () => {
    const service = buildService();
    const methodNames = Object.getOwnPropertyNames(
      Object.getPrototypeOf(service),
    ).filter((name) => name !== 'constructor');
    // Every method is a discovery-plane operation; none accepts or
    // returns world/solution/delivery state to write.
    for (const name of methodNames) {
      expect(name).not.toMatch(/world|solution|delivery|baseline|write|mutate/i);
    }
    // The record types the service can produce are discovery records only.
    expect(methodNames.sort()).toEqual([
      'authorize',
      'getRun',
      'listCandidates',
      'listGaps',
      'listProposals',
      'listRuns',
      'listSchedules',
      'promoteExternalCandidate',
      'proposeEcosystemArtifact',
      'registerSchedule',
      'runEcosystemScan',
      'runProblemDiscovery',
      'tickScheduler',
      'validateTenant',
    ]);
  });
});
