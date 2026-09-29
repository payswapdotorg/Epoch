// Cross-domain role discovery (W045 pin 6): the construction AND software
// scenarios produce DISTINCT capability demands and DISTINCT role sets
// from the SAME universal machinery — no domain-specific compiler exists.
import { describe, expect, it } from 'vitest';
import { compileCapabilityDemands } from '../src/compile';
import { synthesizeRoleProposals } from '../src/roles';
import { runProblemDrivenDiscovery } from '../src/run';
import { constructionCandidates, constructionInput, softwareCandidates, softwareInput } from './fixtures';

describe('cross-domain discovery through one universal machinery', () => {
  it('construction and software scenarios derive distinct demand sets', () => {
    const construction = compileCapabilityDemands(constructionInput());
    const software = compileCapabilityDemands(softwareInput());
    expect(construction.ok).toBe(true);
    expect(software.ok).toBe(true);
    if (!construction.ok || !software.ok) return;

    const constructionIds = construction.value.demandSet.demands.map((d) => d.operation.id);
    const softwareIds = software.value.demandSet.demands.map((d) => d.operation.id);
    expect(constructionIds).toContain('engineering.stress-analysis');
    expect(softwareIds).toContain('software.code-review');
    expect(constructionIds.filter((id) => softwareIds.includes(id))).toEqual([]);
    expect(construction.value.demandSet.setDigest).not.toBe(software.value.demandSet.setDigest);
  });

  it('construction and software scenarios synthesize distinct roles from the same functions', () => {
    const construction = compileCapabilityDemands(constructionInput());
    const software = compileCapabilityDemands(softwareInput());
    if (!construction.ok || !software.ok) return;
    const constructionRoles = synthesizeRoleProposals(
      constructionInput(),
      construction.value.demandSet,
      construction.value.templateOverrideRejections,
    );
    const softwareRoles = synthesizeRoleProposals(
      softwareInput(),
      software.value.demandSet,
      software.value.templateOverrideRejections,
    );

    expect(constructionRoles.roleProposals.length).toBeGreaterThan(0);
    expect(softwareRoles.roleProposals.length).toBeGreaterThan(0);

    const constructionSlugs = constructionRoles.roleProposals.map((role) => role.roleSlug);
    const softwareSlugs = softwareRoles.roleProposals.map((role) => role.roleSlug);
    expect(constructionSlugs.some((slug) => slug.startsWith('engineering'))).toBe(true);
    expect(softwareSlugs.some((slug) => slug.startsWith('software'))).toBe(true);
    // The construction pack's honest role template was CONSULTED (its
    // grouping agrees with the universal clustering).
    const consulted = constructionRoles.roleProposals.flatMap(
      (role) => role.provenance.consultedTemplates,
    );
    expect(consulted).toContain('rtpl-engineering-lead');
  });

  it('the same pipeline runs end-to-end for both domains with different gaps', () => {
    const construction = runProblemDrivenDiscovery(constructionInput(), {
      at: '2026-10-05T09:00:00.000Z',
      candidates: Object.values(constructionCandidates()),
    });
    const software = runProblemDrivenDiscovery(softwareInput(), {
      at: '2026-10-05T09:00:00.000Z',
      candidates: Object.values(softwareCandidates()),
    });
    expect(construction.ok).toBe(true);
    expect(software.ok).toBe(true);
    if (!construction.ok || !software.ok) return;

    // Construction gap: code-compliance has the human; the unknown
    // resolution demand is unmet -> gap on investigation.unknown-resolution.
    const constructionGapOps = construction.value.gaps.map((gap) => gap.operation.id);
    expect(constructionGapOps).toContain('investigation.unknown-resolution');

    // Software gap: security audit has no candidate at all.
    const softwareGapOps = software.value.gaps.map((gap) => gap.operation.id);
    expect(softwareGapOps).toContain('software.security-audit');

    // Both domains' runs carry distinct content-addressed identities.
    expect(construction.value.run.runId).not.toBe(software.value.run.runId);
  });
});
