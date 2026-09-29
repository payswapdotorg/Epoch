// The service happy path: a full problem-driven run through the facade
// (authorization gate + REAL tenancy validation + lineage-verified
// recording), followed by the ecosystem workflow.
import { describe, expect, it } from 'vitest';
import { StaticCatalogSourceAdapter } from '@epoch/capability-discovery';
import type { DiscoveryInput } from '@epoch/capability-discovery';
import { buildService } from './fixtures';
import {
  ALLOW,
  DENY,
  PRINCIPAL_LEAD,
  TENANT_ALPHA,
  expectServiceFailure,
} from './fixtures';

function softwareInput(): DiscoveryInput {
  return {
    schemaVersion: 1,
    tenantId: TENANT_ALPHA,
    task: {
      summary: 'Migrate the checkout service to the new platform',
      lifecycleStage: 'realize',
      domainRefs: ['software'],
      objectives: ['zero-downtime migration'],
    },
    worldRefs: [
      { refId: 'world:service-inventory', contentDigest: 'd'.repeat(64), summary: 'service inventory' },
    ],
    evidenceSignals: [],
    constraintSignals: [],
    taskSignals: [
      {
        signalId: 't-review',
        kind: 'operation',
        summary: 'Review the migration diff',
        subjectRefs: ['service-checkout'],
        evidenceRefs: [],
        constraintRefs: [],
        operationRef: { id: 'software.code-review', versionConstraint: '*' },
        representationHints: ['code'],
        outputHints: ['document'],
      },
      {
        signalId: 't-security',
        kind: 'operation',
        summary: 'Security audit of the new surface',
        subjectRefs: ['service-checkout'],
        evidenceRefs: [],
        constraintRefs: [],
        operationRef: { id: 'software.security-audit', versionConstraint: '*' },
        representationHints: ['code'],
        outputHints: ['document'],
      },
    ],
    packContributions: [],
  };
}

const REVIEW_AGENT = {
  schemaVersion: 1 as const,
  candidateId: 'cand:agent-review',
  kind: 'agent' as const,
  displayName: 'Code review agent',
  summary: 'Reviews diffs',
  claimedCapabilities: [
    {
      operation: { id: 'software.code-review', versionConstraint: '*' },
      inputKinds: ['code' as const],
      outputKinds: ['document' as const],
      claimBasis: 'measured' as const,
    },
  ],
  runtimeRequirements: [],
  environmentRequirements: [],
  latency: { p50Milliseconds: 30_000, p95Milliseconds: 120_000 },
  provenance: {
    sourceKind: 'agent-protocol' as const,
    sourceRef: 'agent:reviewer',
    contentDigest: 'a'.repeat(64),
  },
  evaluationState: 'verified' as const,
  security: { sandboxRequired: false, trustDomain: 'epoch-verified' as const, notes: [] },
};

describe('the capability-discovery service facade', () => {
  it('runs a full problem-driven discovery through the gate + tenancy + lineage', () => {
    const service = buildService();
    const outcome = service.runProblemDiscovery({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      input: softwareInput(),
      options: { candidates: [REVIEW_AGENT] },
      at: '2026-10-05T09:00:00.000Z',
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const artifact = outcome.value;
    expect(artifact.run.tenantId).toBe(TENANT_ALPHA);
    expect(artifact.roleProposals.length).toBeGreaterThan(0);
    // The security-audit demand is unmet -> an explicit gap exists.
    expect(artifact.gaps.map((gap) => gap.operation.id)).toContain('software.security-audit');

    // The run is tenant-scoped readable.
    const read = service.getRun(PRINCIPAL_LEAD, ALLOW, TENANT_ALPHA, artifact.run.runId);
    expect(read.ok).toBe(true);
    const listed = service.listRuns(PRINCIPAL_LEAD, ALLOW, TENANT_ALPHA);
    expect(listed.ok && listed.value).toHaveLength(1);
    // The gap is visible through the service.
    const gaps = service.listGaps(PRINCIPAL_LEAD, ALLOW, TENANT_ALPHA, 'UNSATISFIED');
    expect(gaps.ok && gaps.value.length).toBeGreaterThan(0);
  });

  it('denies unauthorized operations before any kernel admission (fail-closed)', () => {
    const service = buildService();
    const denied = service.runProblemDiscovery({
      principal: PRINCIPAL_LEAD,
      authorization: DENY,
      tenantId: TENANT_ALPHA,
      input: softwareInput(),
      options: { candidates: [] },
      at: '2026-10-05T09:00:00.000Z',
    });
    expectServiceFailure(denied, 'authorization-rejected');
    // Nothing was recorded.
    const listed = service.listRuns(PRINCIPAL_LEAD, ALLOW, TENANT_ALPHA);
    expect(listed.ok && listed.value).toHaveLength(0);
  });

  it('a malformed authorization value is denied (no explicit allow)', () => {
    const service = buildService();
    const malformed = service.listRuns(PRINCIPAL_LEAD, {
      allowed: false,
      reason: 'no',
    }, TENANT_ALPHA);
    expectServiceFailure(malformed, 'authorization-rejected');
  });

  it('rejects unknown tenants (REAL W009 validation)', () => {
    const service = buildService();
    const unknown = service.runProblemDiscovery({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: 'tenant:ghost',
      input: { ...softwareInput(), tenantId: 'tenant:ghost' },
      options: { candidates: [] },
      at: '2026-10-05T09:00:00.000Z',
    });
    expectServiceFailure(unknown, 'unknown-tenant');
  });

  it('rejects inputs scoped to a different tenant than the request', () => {
    const service = buildService();
    const mismatch = service.runProblemDiscovery({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      input: { ...softwareInput(), tenantId: 'tenant:beta' },
      options: { candidates: [] },
      at: '2026-10-05T09:00:00.000Z',
    });
    expectServiceFailure(mismatch, 'cross-tenant-denied');
  });

  it('runs the ecosystem scan workflow over open gaps', () => {
    const service = buildService();
    // Seed a gap via a problem run.
    const seeded = service.runProblemDiscovery({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      input: softwareInput(),
      options: { candidates: [REVIEW_AGENT] },
      at: '2026-10-05T09:00:00.000Z',
    });
    if (!seeded.ok) throw new Error(seeded.error.message);

    const adapter = new StaticCatalogSourceAdapter({
      adapterId: 'fixture-catalog',
      description: 'static fixture catalog',
      catalog: [
        {
          artifactId: 'audit-artifact',
          contentDigest: 'f'.repeat(64),
          summary: 'Claims security audit capability',
          claimedCapabilities: [
            {
              operation: { id: 'software.security-audit', versionConstraint: '*' },
              inputKinds: ['code'],
              outputKinds: ['document'],
              claimBasis: 'measured',
            },
          ],
          environmentNotes: [],
        },
      ],
    });
    const scan = service.runEcosystemScan({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      trigger: 'gap',
      adapters: [adapter],
      at: '2026-10-06T09:00:00.000Z',
    });
    expect(scan.ok).toBe(true);
    if (!scan.ok) return;
    // The external candidate was ingested at the safe boundary and the
    // gap transitioned CANDIDATE_FOUND.
    expect(scan.value.ingestedCandidates).toHaveLength(1);
    expect(scan.value.updatedGaps).toHaveLength(1);
    expect(scan.value.updatedGaps[0]!.state).toBe('CANDIDATE_FOUND');

    // The gap list reflects the transition.
    const gapsAfter = service.listGaps(PRINCIPAL_LEAD, ALLOW, TENANT_ALPHA);
    expect(gapsAfter.ok && gapsAfter.value.some((gap) => gap.state === 'CANDIDATE_FOUND')).toBe(true);

    // The promotion workflow is available on the ingested candidate.
    const promoted = service.promoteExternalCandidate({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      candidateId: scan.value.ingestedCandidates[0]!.candidateId,
      targetState: 'ingested',
      evidenceDigest: 'e'.repeat(64),
      at: '2026-10-06T10:00:00.000Z',
    });
    expect(promoted.ok).toBe(true);
  });

  it('the promotion gate is enforced through the service (negative c surface)', () => {
    const service = buildService();
    const seeded = service.runProblemDiscovery({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      input: softwareInput(),
      options: { candidates: [] },
      at: '2026-10-05T09:00:00.000Z',
    });
    if (!seeded.ok) throw new Error(seeded.error.message);
    const adapter = new StaticCatalogSourceAdapter({
      adapterId: 'fixture-catalog',
      description: 'static fixture catalog',
      catalog: [
        {
          artifactId: 'audit-artifact',
          contentDigest: 'f'.repeat(64),
          summary: 'Claims security audit capability',
          claimedCapabilities: [
            {
              operation: { id: 'software.security-audit', versionConstraint: '*' },
              inputKinds: ['code'],
              outputKinds: ['document'],
              claimBasis: 'declared',
            },
          ],
          environmentNotes: [],
        },
      ],
    });
    const scan = service.runEcosystemScan({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      trigger: 'gap',
      adapters: [adapter],
      at: '2026-10-06T09:00:00.000Z',
    });
    if (!scan.ok) throw new Error(scan.error.message);
    const candidateId = scan.value.ingestedCandidates[0]!.candidateId;
    // Attempting to jump straight to 'verified' through the SERVICE is
    // the typed promotion-gate rejection.
    const jump = service.promoteExternalCandidate({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      candidateId,
      targetState: 'verified',
      evidenceDigest: 'e'.repeat(64),
      policyApproval: { approvedBy: 'principal:security-lead', policyRef: 'policy:v1' },
      at: '2026-10-06T10:00:00.000Z',
    });
    expectServiceFailure(jump, 'promotion-gate-rejected');
    // Unknown candidates are typed failures.
    expectServiceFailure(
      service.promoteExternalCandidate({
        principal: PRINCIPAL_LEAD,
        authorization: ALLOW,
        tenantId: TENANT_ALPHA,
        candidateId: 'cand:ext-unknown',
        targetState: 'ingested',
        evidenceDigest: 'e'.repeat(64),
        at: '2026-10-06T10:00:00.000Z',
      }),
      'unknown-candidate',
    );
  });

  it('derives ecosystem proposals from tenant gap evidence', () => {
    const service = buildService();
    const seeded = service.runProblemDiscovery({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      input: softwareInput(),
      options: { candidates: [] },
      at: '2026-10-05T09:00:00.000Z',
    });
    if (!seeded.ok) throw new Error(seeded.error.message);
    const proposal = service.proposeEcosystemArtifact({
      principal: PRINCIPAL_LEAD,
      authorization: ALLOW,
      tenantId: TENANT_ALPHA,
      kind: 'adapter',
      summary: 'Propose a private audit-catalog adapter',
      at: '2026-10-06T09:00:00.000Z',
    });
    expect(proposal.ok).toBe(true);
    if (proposal.ok) {
      expect(proposal.value.evidence.gapIds.length).toBeGreaterThan(0);
      expect(proposal.value.status).toBe('proposed');
    }
    const listed = service.listProposals(PRINCIPAL_LEAD, ALLOW);
    expect(listed.ok && listed.value).toHaveLength(1);
  });
});
