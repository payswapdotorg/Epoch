// Serialization round-trips: every published record type is plain JSON
// and re-parses through its runtime validator (the serialization-friendly
// by-construction guarantee).
import { describe, expect, it } from 'vitest';
import * as schemas from '../src/schema';
import { runProblemDrivenDiscovery, verifyDiscoveryRun } from '../src/run';
import { createCapabilityGap } from '../src/gap';
import { deriveEcosystemProposal } from '../src/proposals';
import { ingestExternalCandidate } from '../src/candidates';
import type { DiscoveryRunArtifact } from '../src/types';
import {
  TENANT_A,
  constructionCandidates,
  constructionInput,
  declaredCriteria,
  op,
  sourceArtifact,
} from './fixtures';

/** Local gap builder (kept here; fixtures.ts stays domain-focused). */
function localGap() {
  return createCapabilityGap({
    tenantId: TENANT_A,
    operation: op('mechanical.tolerance-analysis'),
    demandSummary: 'Recurring tolerance analysis need',
    lifecycleStage: 'realize',
    triggeringSignalIds: ['m-1'],
    at: '2026-10-05T09:00:00.000Z',
  });
}

describe('serialization round-trips', () => {
  it('a full run artifact survives JSON round-trip + re-verification', () => {
    const result = runProblemDrivenDiscovery(constructionInput(), {
      at: '2026-10-05T09:00:00.000Z',
      candidates: Object.values(constructionCandidates()),
      criteria: declaredCriteria(),
    });
    if (!result.ok) throw new Error(result.error.message);
    const artifact: DiscoveryRunArtifact = result.value;
    const roundTripped = JSON.parse(JSON.stringify(artifact)) as DiscoveryRunArtifact;
    expect(roundTripped).toEqual(artifact);
    expect(verifyDiscoveryRun(roundTripped).ok).toBe(true);
  });

  it('every record family parses through its runtime validator after a round-trip', () => {
    const result = runProblemDrivenDiscovery(constructionInput(), {
      at: '2026-10-05T09:00:00.000Z',
      candidates: Object.values(constructionCandidates()),
      criteria: declaredCriteria(),
    });
    if (!result.ok) throw new Error(result.error.message);
    const artifact = result.value;

    const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

    expect(
      schemas.DiscoveryInputSchema.safeParse(roundTrip(artifact.input)).success,
    ).toBe(true);
    expect(
      schemas.CapabilityDemandSetSchema.safeParse(roundTrip(artifact.demandSet)).success,
    ).toBe(true);
    for (const role of artifact.roleProposals) {
      expect(schemas.RoleProposalSchema.safeParse(roundTrip(role)).success).toBe(true);
    }
    for (const resolution of artifact.resolutions) {
      expect(schemas.RoleResolutionSchema.safeParse(roundTrip(resolution)).success).toBe(true);
    }
    for (const organization of artifact.organizations) {
      expect(schemas.OrganizationProposalSchema.safeParse(roundTrip(organization)).success).toBe(true);
    }
    for (const evaluation of artifact.evaluations) {
      expect(schemas.OrganizationEvaluationSchema.safeParse(roundTrip(evaluation)).success).toBe(true);
    }
    expect(
      schemas.OrganizationSelectionSchema.safeParse(roundTrip(artifact.selection)).success,
    ).toBe(true);
    for (const gap of artifact.gaps) {
      expect(schemas.CapabilityGapSchema.safeParse(roundTrip(gap)).success).toBe(true);
    }
    expect(schemas.DiscoveryRunSchema.safeParse(roundTrip(artifact.run)).success).toBe(true);
    expect(
      schemas.DiscoveryRunArtifactSchema.safeParse(roundTrip(artifact)).success,
    ).toBe(true);
    for (const candidate of artifact.candidates) {
      expect(schemas.CandidateProfileSchema.safeParse(roundTrip(candidate)).success).toBe(true);
    }
    for (const criterion of artifact.criteria) {
      expect(schemas.EvaluationCriterionSchema.safeParse(roundTrip(criterion)).success).toBe(true);
    }
  });

  it('gaps, proposals and external candidates round-trip', () => {
    const gap = createCapabilityGap({
      tenantId: TENANT_A,
      operation: op('software.security-audit'),
      demandSummary: 'audit',
      lifecycleStage: 'realize',
      triggeringSignalIds: ['t'],
      at: '2026-10-05T09:00:00.000Z',
    });
    expect(
      schemas.CapabilityGapSchema.safeParse(JSON.parse(JSON.stringify(gap))).success,
    ).toBe(true);

    const proposal = deriveEcosystemProposal({
      kind: 'adapter',
      summary: 'adapter proposal',
      gaps: [localGap()],
      at: '2026-10-05T09:00:00.000Z',
    });
    if (!proposal.ok) throw new Error(proposal.error.message);
    expect(
      schemas.EcosystemProposalSchema.safeParse(JSON.parse(JSON.stringify(proposal.value))).success,
    ).toBe(true);

    const candidate = ingestExternalCandidate({
      tenantId: TENANT_A,
      adapterId: 'fixture-catalog',
      artifact: sourceArtifact({
        artifactId: 'roundtrip-artifact',
        summary: 'roundtrip',
        claims: [{ operation: op('software.test-generation'), inputKinds: ['code'], outputKinds: ['code'] }],
      }),
    });
    if (!candidate.ok) throw new Error(candidate.error.message);
    expect(
      schemas.CandidateProfileSchema.safeParse(JSON.parse(JSON.stringify(candidate.value))).success,
    ).toBe(true);
  });

  it('strict schemas reject unknown fields (no vendor smuggle via JSON)', () => {
    const result = runProblemDrivenDiscovery(constructionInput(), {
      at: '2026-10-05T09:00:00.000Z',
      candidates: Object.values(constructionCandidates()),
      criteria: declaredCriteria(),
    });
    if (!result.ok) throw new Error(result.error.message);
    const smuggled = {
      ...JSON.parse(JSON.stringify(result.value.run)),
      vendorField: 'acme',
    };
    expect(schemas.DiscoveryRunSchema.safeParse(smuggled).success).toBe(false);
    expect(localGap()).toBeDefined();
  });
});
