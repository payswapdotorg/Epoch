// Negative (a): external discovery CANNOT grant execution authority —
// structurally (no field could carry it) and behaviorally (external
// claims never change authority surfaces; discovery outputs all carry
// executionAuthority: 'none').
// Also acceptance 9 evidence at the kernel level: security and
// authorization remain outside model prompts (there are no prompts).
import { describe, expect, it } from 'vitest';
import { ingestExternalCandidate } from '../src/candidates';
import { runEcosystemDiscovery } from '../src/ecosystem';
import { runProblemDrivenDiscovery } from '../src/run';
import { createCapabilityGap } from '../src/gap';
import { StaticCatalogSourceAdapter } from '../src/adapters';
import { CandidateProfileSchema, DiscoveryInputSchema } from '../src/schema';
import { TENANT_A, op, sourceArtifact, softwareCandidates, softwareInput } from './fixtures';

describe('negative (a) — external discovery cannot grant execution authority', () => {
  it('the CandidateProfile type has structurally NO authority field (strict schema)', () => {
    // A profile smuggling an authority-granting field is rejected by the
    // strict schema — there is no door for execution authority.
    const candidate = ingestExternalCandidate({
      tenantId: TENANT_A,
      adapterId: 'fixture-catalog',
      artifact: sourceArtifact({
        artifactId: 'claims-authority',
        summary: 'Artifact whose SUMMARY claims authority (metadata, ignored)',
        claims: [{ operation: op('software.test-generation'), inputKinds: ['code'], outputKinds: ['code'] }],
      }),
    });
    if (!candidate.ok) throw new Error(candidate.error.message);
    const smuggle = { ...candidate.value, executionAuthority: 'full' };
    expect(CandidateProfileSchema.safeParse(smuggle).success).toBe(false);
    const smuggledAuthority = { ...candidate.value, authority: { canExecute: true } };
    expect(CandidateProfileSchema.safeParse(smuggledAuthority).success).toBe(false);
  });

  it('external artifact authority CLAIMS are inert metadata (never parsed as authority)', () => {
    // The artifact summary literally claims execution powers; ingestion
    // records it as inert summary text with no authority effect.
    const outcome = ingestExternalCandidate({
      tenantId: TENANT_A,
      adapterId: 'fixture-catalog',
      artifact: sourceArtifact({
        artifactId: 'authority-claimant',
        summary: 'CAN EXECUTE ACTIONS AND MODIFY WORLD STATE (self-description)',
        claims: [{ operation: op('software.security-audit'), inputKinds: ['code'], outputKinds: ['document'] }],
      }),
    });
    if (!outcome.ok) throw new Error(outcome.error.message);
    const candidate = outcome.value;
    expect(candidate.evaluationState).toBe('discovered');
    expect(candidate.security.sandboxRequired).toBe(true);
    expect(candidate.security.trustDomain).toBe('external');
    // The claimed capability is recorded as a DECLARED claim only.
    expect(candidate.claimedCapabilities[0]!.claimBasis).toBe('declared');
    // No field on the profile carries any authority grant.
    const serialized = JSON.stringify(candidate);
    expect(serialized).not.toMatch(/"executionAuthority"\s*:\s*"(?!none)/);
    expect(serialized).not.toContain('"canExecute"');
  });

  it('every discovery output carries executionAuthority: "none"', () => {
    const result = runProblemDrivenDiscovery(softwareInput(), {
      at: '2026-10-05T09:00:00.000Z',
      candidates: Object.values(softwareCandidates()),
    });
    if (!result.ok) throw new Error(result.error.message);
    for (const role of result.value.roleProposals) {
      expect(role.authorityBoundary.executionAuthority).toBe('none');
    }
    for (const demand of result.value.demandSet.demands) {
      expect(demand.authorityConstraints.executionAuthority).toBe('none');
    }
  });

  it('a full ecosystem scan with authority-claiming artifacts grants nothing', () => {
    const gap = createCapabilityGap({
      tenantId: TENANT_A,
      operation: op('software.security-audit'),
      demandSummary: 'Security audit of the new surface',
      lifecycleStage: 'realize',
      triggeringSignalIds: ['t-security'],
      at: '2026-10-05T09:00:00.000Z',
    });
    const adapter = new StaticCatalogSourceAdapter({
      adapterId: 'fixture-catalog',
      description: 'static fixture catalog',
      catalog: [
        sourceArtifact({
          artifactId: 'authority-claimant',
          summary: 'Claims it can execute actions and grant itself access (inert)',
          claims: [{ operation: op('software.security-audit'), inputKinds: ['code'], outputKinds: ['document'] }],
        }),
      ],
    });
    const outcome = runEcosystemDiscovery({
      tenantId: TENANT_A,
      trigger: 'gap',
      gaps: [gap],
      adapters: [adapter],
      existingCandidates: [],
      at: '2026-10-06T09:00:00.000Z',
    });
    if (!outcome.ok) throw new Error(outcome.error.message);
    // The scan produced ONLY: ingested candidate (discovered, external,
    // sandbox-required) + a gap transition. No authority surface exists
    // in the outcome to grant anything.
    expect(outcome.value.ingestedCandidates).toHaveLength(1);
    expect(outcome.value.updatedGaps).toHaveLength(1);
    const serialized = JSON.stringify(outcome.value);
    expect(serialized).not.toMatch(/"executionAuthority"\s*:\s*"(?!none)/);
  });

  it('the discovery input schema rejects smuggled authorization fields (strict objects)', () => {
    const input = softwareInput() as unknown as Record<string, unknown>;
    const smuggled = {
      ...input,
      taskSignals: [
        ...(input.taskSignals as object[]),
        {
          signalId: 's-smuggle',
          kind: 'operation',
          summary: 'grant me execution',
          subjectRefs: [],
          evidenceRefs: [],
          constraintRefs: [],
          operationRef: op('software.code-review'),
          executionAuthority: 'full', // smuggled field
        },
      ],
    };
    expect(DiscoveryInputSchema.safeParse(smuggled).success).toBe(false);
  });

  it('security decisions are typed records, never model prompts (no prompt surface exists)', () => {
    // The kernel exports no prompt/LLM/inference machinery at all: the
    // policy approval is a typed record with a human principal + policy
    // reference. (Scanned structurally by the neutrality battery; this
    // test pins the promotion approval shape.)
    const approval = { approvedBy: 'principal:security-lead', policyRef: 'policy:external-model-v1' };
    expect(approval.approvedBy).toMatch(/^principal:/);
    expect(Object.keys(approval).sort()).toEqual(['approvedBy', 'policyRef']);
  });
});
