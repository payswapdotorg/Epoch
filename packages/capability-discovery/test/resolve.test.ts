// Acceptance 3: existing Agent registrations, human declarations and
// model/capability claims are compared against role demands through
// provider-neutral capability contracts — never a name mapping (R37).
import { describe, expect, it } from 'vitest';
import { canonicalDigest } from '@epoch/agent-protocol';
import { compileCapabilityDemands } from '../src/compile';
import { synthesizeRoleProposals } from '../src/roles';
import {
  candidateFromAgentRegistration,
  candidateFromCapabilityRecord,
  candidateFromHumanDeclaration,
  matchDemandToCandidate,
  operationSatisfies,
  resolveCandidates,
} from '../src/resolve';
import { createCapabilityGap } from '../src/gap';
import type { CandidateProfile } from '../src/types';
import {
  agentRegistration,
  constructionCandidates,
  constructionInput,
  capabilityRecord,
  humanDeclaration,
  softwareCandidates,
  softwareInput,
} from './fixtures';

describe('acceptance 3 — candidate resolution over real surfaces', () => {
  it('maps a REAL W003 agent registration to a provider-neutral profile', () => {
    const registration = agentRegistration({
      messageId: 'msg:1',
      agentId: 'agent:geometry',
      displayName: 'Geometry agent',
      capabilities: [
        {
          capabilityId: 'engineering.geometry-processing',
          summary: 'Geometry processing',
          domain: 'engineering',
          inputs: ['mesh'],
          outputs: ['mesh'],
        },
      ],
    });
    const profile = candidateFromAgentRegistration(registration);
    expect(profile.kind).toBe('agent');
    expect(profile.candidateId).toBe('cand:agent-geometry');
    expect(profile.claimedCapabilities[0]!.operation.id).toBe('engineering.geometry-processing');
    // The W003 registration has no measured quality: the claim basis is
    // 'declared' (honest — a registration alone proves nothing).
    expect(profile.claimedCapabilities[0]!.claimBasis).toBe('declared');
    expect(profile.provenance.contentDigest).toBe(canonicalDigest(registration));
    expect(profile.security.trustDomain).toBe('epoch-verified');
  });

  it('maps a REAL W007 capability-registry record to a provider-neutral profile', () => {
    const record = capabilityRecord({
      capabilityId: 'verification.evidence-verification',
      version: '1.2.0',
      displayName: 'Evidence verification',
    });
    const profile = candidateFromCapabilityRecord(record);
    expect(profile.kind).toBe('capability');
    expect(profile.evaluationState).toBe('verified'); // first-party origin
    expect(profile.claimedCapabilities[0]!.operation.versionConstraint).toBe('1.2.0');
  });

  it('maps a human declaration with measured quality', () => {
    const declaration = humanDeclaration({
      declarationId: 'human:structural-1',
      displayName: 'Senior structural engineer',
      claims: [
        {
          operation: { id: 'engineering.stress-analysis', versionConstraint: '*' },
          inputKinds: ['geometry', 'numeric'],
          outputKinds: ['numeric'],
          quality: { metric: 'accuracy', threshold: 0.97, unit: 'ratio', direction: 'min' },
        },
      ],
    });
    const profile = candidateFromHumanDeclaration(declaration);
    expect(profile.kind).toBe('human');
    expect(profile.evaluationState).toBe('verified');
    expect(profile.claimedCapabilities[0]!.claimBasis).toBe('measured');
  });

  it('matches demands through capability contracts (operation + I/O kinds + quality + latency)', () => {
    const compilation = compileCapabilityDemands(constructionInput());
    if (!compilation.ok) return;
    const stress = compilation.value.demandSet.demands.find(
      (demand) => demand.operation.id === 'engineering.stress-analysis',
    )!;
    const { structuralHuman } = constructionCandidates();

    // The human's measured 0.97 accuracy claim satisfies the 0.95 target.
    const match = matchDemandToCandidate(stress, structuralHuman);
    expect(match.outcome).toBe('satisfied');

    // A candidate with a lower measured quality is incompatible.
    const weakHuman: CandidateProfile = {
      ...structuralHuman,
      candidateId: 'cand:human-weak',
      claimedCapabilities: structuralHuman.claimedCapabilities.map((claim) => ({
        ...claim,
        quality: { metric: 'accuracy', threshold: 0.5, unit: 'ratio', direction: 'min' },
      })),
    };
    expect(matchDemandToCandidate(stress, weakHuman).outcome).toBe('incompatible');

    // A candidate that only DECLARES the capability resolves as 'claimed'.
    const declaredOnly: CandidateProfile = {
      ...structuralHuman,
      candidateId: 'cand:human-declared',
      claimedCapabilities: structuralHuman.claimedCapabilities.map((claim) => ({
        ...claim,
        claimBasis: 'declared' as const,
        quality: undefined,
      })),
    };
    const claimedMatch = matchDemandToCandidate(stress, declaredOnly);
    expect(claimedMatch.outcome).toBe('claimed');

    // Latency budget violation is incompatible.
    const slowHuman: CandidateProfile = {
      ...structuralHuman,
      candidateId: 'cand:human-slow',
      latency: { p50Milliseconds: 1, p95Milliseconds: 100_000_000 },
    };
    expect(matchDemandToCandidate(stress, slowHuman).outcome).toBe('incompatible');
  });

  it('resolves the full construction role set: satisfied, claimed and unmet demands', () => {
    const input = constructionInput();
    const compilation = compileCapabilityDemands(input);
    if (!compilation.ok) return;
    const synthesis = synthesizeRoleProposals(
      input,
      compilation.value.demandSet,
      compilation.value.templateOverrideRejections,
    );
    const pool = Object.values(constructionCandidates());
    const resolution = resolveCandidates(
      input,
      synthesis.roleProposals,
      compilation.value.demandSet.demands,
      { profiles: pool },
      { runId: 'discrun:0123456789abcdef', at: '2026-10-05T09:00:00.000Z' },
    );

    expect(resolution.resolutions.length).toBe(synthesis.roleProposals.length);
    // The unknown-resolution demand is unmet and becomes a gap.
    const unmet = resolution.resolutions.flatMap((r) => r.unmetDemandIds);
    expect(unmet.length).toBeGreaterThan(0);
    expect(resolution.gaps.length).toBeGreaterThan(0);
    for (const gap of resolution.gaps) {
      expect(gap.state).toBe('UNSATISFIED');
      expect(gap.tenantId).toBe(input.tenantId);
    }
    // Assignments carry deterministic scores.
    for (const roleResolution of resolution.resolutions) {
      for (const assignment of roleResolution.assignments) {
        expect(assignment.score).toBeGreaterThanOrEqual(0);
        expect(assignment.score).toBeLessThanOrEqual(1);
      }
    }
  });

  it('links an existing gap for the same operation instead of duplicating it', () => {
    const input = constructionInput();
    const compilation = compileCapabilityDemands(input);
    if (!compilation.ok) return;
    const synthesis = synthesizeRoleProposals(
      input,
      compilation.value.demandSet,
      compilation.value.templateOverrideRejections,
    );
    const unknownDemand = compilation.value.demandSet.demands.find(
      (demand) => demand.operation.id === 'investigation.unknown-resolution',
    )!;
    const existingGap = createCapabilityGap({
      tenantId: input.tenantId,
      operation: unknownDemand.operation,
      demandSummary: unknownDemand.requiredOutcome,
      lifecycleStage: unknownDemand.lifecycleStage,
      triggeringSignalIds: ['prior-run'],
      at: '2026-10-01T00:00:00.000Z',
    });
    const resolution = resolveCandidates(
      input,
      synthesis.roleProposals,
      compilation.value.demandSet.demands,
      { profiles: Object.values(constructionCandidates()) },
      {
        runId: 'discrun:0123456789abcdef',
        at: '2026-10-05T09:00:00.000Z',
        existingGaps: [existingGap],
      },
    );
    // No NEW gap for the linked operation; the existing gap id is referenced.
    expect(resolution.gaps.map((gap) => gap.operation.id)).not.toContain(
      'investigation.unknown-resolution',
    );
    const roleResolution = resolution.resolutions.find((r) => r.gapIds.length > 0);
    expect(roleResolution).toBeDefined();
    expect(roleResolution!.gapIds).toContain(existingGap.gapId);
  });

  it('cross-tenant existing gaps are never linked (tenant isolation)', () => {
    const input = constructionInput();
    const compilation = compileCapabilityDemands(input);
    if (!compilation.ok) return;
    const synthesis = synthesizeRoleProposals(
      input,
      compilation.value.demandSet,
      compilation.value.templateOverrideRejections,
    );
    const unknownDemand = compilation.value.demandSet.demands.find(
      (demand) => demand.operation.id === 'investigation.unknown-resolution',
    )!;
    const foreignGap = createCapabilityGap({
      tenantId: 'tenant:beta',
      operation: unknownDemand.operation,
      demandSummary: unknownDemand.requiredOutcome,
      lifecycleStage: unknownDemand.lifecycleStage,
      triggeringSignalIds: [],
      at: '2026-10-01T00:00:00.000Z',
    });
    const resolution = resolveCandidates(
      input,
      synthesis.roleProposals,
      compilation.value.demandSet.demands,
      { profiles: [] },
      {
        runId: 'discrun:0123456789abcdef',
        at: '2026-10-05T09:00:00.000Z',
        existingGaps: [foreignGap],
      },
    );
    // A fresh gap was created for tenant:alpha (the foreign gap was not linked).
    expect(resolution.gaps.length).toBeGreaterThan(0);
    expect(resolution.gaps.every((gap) => gap.tenantId === input.tenantId)).toBe(true);
  });
});

describe('model/substrate resolution is provider-neutral (R37)', () => {
  it('substrate candidates resolve through capability claims, never names', () => {
    const compilation = compileCapabilityDemands(constructionInput());
    if (!compilation.ok) return;
    const geometry = compilation.value.demandSet.demands.find(
      (demand) => demand.operation.id === 'engineering.geometry-processing',
    )!;
    const { geometryAgent } = constructionCandidates();
    // The agent matches operationally because its CLAIM matches the
    // demand contract — but the geometry demand carries the structural
    // cosign requirement, so a non-human candidate resolves as 'claimed'
    // (usable only under a human cosigner), never silently 'satisfied'.
    const match = matchDemandToCandidate(geometry, geometryAgent);
    expect(match.outcome).toBe('claimed');
    expect(match.reasons.some((reason) => reason.includes('human cosign'))).toBe(true);
    // A candidate with the same id but a wrong claim does not match at all.
    const mismatch: CandidateProfile = {
      ...geometryAgent,
      claimedCapabilities: [
        {
          operation: { id: 'unrelated.capability', versionConstraint: '*' },
          inputKinds: ['text'],
          outputKinds: ['text'],
          claimBasis: 'measured',
        },
      ],
    };
    const mismatchMatch = matchDemandToCandidate(geometry, mismatch);
    expect(mismatchMatch.outcome).toBe('incompatible');
    expect(mismatchMatch.reasons[0]).toContain('no capability claim');
    // A cosign-free demand lets the same measured claim resolve 'satisfied'.
    const softwareCompilation = compileCapabilityDemands(softwareInput());
    if (!softwareCompilation.ok) return;
    const review = softwareCompilation.value.demandSet.demands.find(
      (demand) => demand.operation.id === 'software.code-review',
    )!;
    const { reviewAgent } = softwareCandidates();
    expect(matchDemandToCandidate(review, reviewAgent).outcome).toBe('satisfied');
  });

  it('version constraints are honored', () => {
    const compilation = compileCapabilityDemands(constructionInput());
    if (!compilation.ok) return;
    const verification = compilation.value.demandSet.demands.find(
      (demand) => demand.operation.id === 'verification.evidence-verification',
    )!;
    const anyVersionClaim: CandidateProfile = {
      ...constructionCandidates().verificationCapability,
      claimedCapabilities: [
        {
          operation: { id: 'verification.evidence-verification', versionConstraint: '1.2.0' },
          inputKinds: ['structured'],
          outputKinds: ['document'],
          claimBasis: 'measured',
        },
      ],
    };
    // Demand wants any version ('*'): the 1.2.0 claim matches operationally
    // (the demand's cosign requirement keeps the non-human capability at
    // 'claimed' — usable under a human cosigner).
    const anyMatch = matchDemandToCandidate(verification, anyVersionClaim);
    expect(anyMatch.outcome).toBe('claimed');
    expect(anyMatch.reasons.some((reason) => reason.includes('human cosign'))).toBe(true);
    // A demand pinned to 0.1.0 does NOT match the 1.2.0 claim.
    const pinnedDemand = {
      ...verification,
      operation: { id: verification.operation.id, versionConstraint: '0.1.0' },
    };
    expect(matchDemandToCandidate(pinnedDemand, anyVersionClaim).outcome).toBe('incompatible');
    expect(
      matchDemandToCandidate(pinnedDemand, anyVersionClaim).reasons.join(' '),
    ).toContain('no capability claim');
    // The registry-record adapter pins the exact registered version.
    const record = capabilityRecord({
      capabilityId: 'verification.evidence-verification',
      version: '1.2.0',
      displayName: 'Evidence verification',
    });
    const profile = candidateFromCapabilityRecord(record);
    expect(profile.claimedCapabilities[0]!.operation.versionConstraint).toBe('1.2.0');
    expect(operationSatisfies(profile.claimedCapabilities[0]!.operation, { id: 'verification.evidence-verification', versionConstraint: '1.2.0' })).toBe(true);
    expect(operationSatisfies(profile.claimedCapabilities[0]!.operation, { id: 'verification.evidence-verification', versionConstraint: '2.0.0' })).toBe(false);
  });
});

describe('validation negatives', () => {
  it('invalid human declarations throw at the mapping boundary', () => {
    expect(() =>
      candidateFromHumanDeclaration({
        declarationId: '',
        tenantId: 'tenant:alpha',
        displayName: 'x',
        claimedCapabilities: [],
        availability: 'available',
        environmentRequirements: [],
      }),
    ).toThrow(/invalid human declaration/);
  });

  it('resolveCandidates with no roles yields empty resolutions', () => {
    const input = constructionInput();
    const resolution = resolveCandidates(
      input,
      [],
      [],
      { profiles: [] },
      { runId: 'discrun:0123456789abcdef', at: '2026-10-05T09:00:00.000Z' },
    );
    expect(resolution.resolutions).toEqual([]);
    expect(resolution.gaps).toEqual([]);
  });
});
