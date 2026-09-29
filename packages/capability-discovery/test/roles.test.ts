// Acceptance 2: candidate roles are synthesized WITHOUT a predefined
// role/model pair; negative (d): a domain-pack role template cannot
// override the universal compiler's grouping decision.
import { describe, expect, it } from 'vitest';
import { compileCapabilityDemands } from '../src/compile';
import { synthesizeRoleProposals } from '../src/roles';
import type { DiscoveryInput } from '../src/types';
import { constructionInput, softwareInput } from './fixtures';

describe('acceptance 2 — universal role synthesis', () => {
  it('synthesizes roles with derived slugs, missions, interfaces and authority boundaries', () => {
    const compilation = compileCapabilityDemands(constructionInput());
    expect(compilation.ok).toBe(true);
    if (!compilation.ok) return;
    const synthesis = synthesizeRoleProposals(
      constructionInput(),
      compilation.value.demandSet,
      compilation.value.templateOverrideRejections,
    );
    expect(synthesis.roleProposals.length).toBeGreaterThan(0);

    for (const role of synthesis.roleProposals) {
      // No predefined role/model pair: the slug derives from operations.
      expect(role.roleSlug).toMatch(/^[a-z0-9][a-z0-9-]{0,79}$/);
      expect(role.mission.length).toBeGreaterThan(0);
      // Structurally no execution authority (W003 convention).
      expect(role.authorityBoundary.executionAuthority).toBe('none');
      // Every member demand is content-addressed and covered.
      expect(role.satisfiesDemands.length).toBeGreaterThan(0);
      expect(role.provenance.compilerVersion).toBe('1.0.0');
      // Confidence is a deterministic fraction.
      expect(role.confidence).toBeGreaterThanOrEqual(0);
      expect(role.confidence).toBeLessThanOrEqual(1);
    }

    // The construction stress-analysis demand carries the cosign
    // requirement, so its role must be supervised-multi-step.
    const stressRole = synthesis.roleProposals.find((role) =>
      role.satisfiesDemands.length > 0 &&
      role.authorityBoundary.proposableOperations.some(
        (operation) => operation.id === 'engineering.stress-analysis',
      ),
    );
    expect(stressRole).toBeDefined();
    expect(stressRole!.planningBehavior).toBe('supervised-multi-step');
    expect(stressRole!.authorityBoundary.requiresHumanCosign).toBe(true);
  });

  it('the same machinery synthesizes software roles (no domain-specific compiler)', () => {
    const compilation = compileCapabilityDemands(softwareInput());
    expect(compilation.ok).toBe(true);
    if (!compilation.ok) return;
    const synthesis = synthesizeRoleProposals(
      softwareInput(),
      compilation.value.demandSet,
      compilation.value.templateOverrideRejections,
    );
    expect(synthesis.roleProposals.length).toBeGreaterThan(0);
    const allOperations = synthesis.roleProposals.flatMap((role) =>
      role.authorityBoundary.proposableOperations.map((operation) => operation.id),
    );
    expect(allOperations).toContain('software.code-review');
    expect(allOperations).toContain('software.test-generation');
  });
});

describe('negative (d) — domain-pack templates cannot override the universal grouping', () => {
  it('a role template spanning universal clusters is overridden and recorded', () => {
    // The software pack's role template groups review + test generation.
    // Both live in the SAME universal cluster (same namespace), so it is
    // consulted. Now build a hostile pack whose role template spans
    // TWO universal clusters (software.* + verification.*) to force a
    // regroup attempt: it must be overridden.
    const base = softwareInput();
    // Add a verification demand in a separate namespace with no
    // dependency, guaranteeing a separate universal cluster.
    const input: DiscoveryInput = {
      ...base,
      taskSignals: [
      ...base.taskSignals,
      {
        signalId: 't-audit-verify',
        kind: 'operation',
        summary: 'Independent verification of the migration evidence',
        subjectRefs: [],
        evidenceRefs: [],
        constraintRefs: [],
        operationRef: { id: 'verification.evidence-verification', versionConstraint: '*' },
        representationHints: ['structured'],
        outputHints: ['document'],
      },
    ],
      packContributions: [
      ...base.packContributions,
      {
        packId: 'pack:hostile-roles',
        packVersion: '1.0.0',
        demandTemplates: [
          {
            templateId: 'tpl-hostile-verify',
            summary: 'Verification template (fires on the audit-verify signal)',
            operation: { id: 'verification.evidence-verification', versionConstraint: '*' },
            applicability: { domainRefs: ['software'], signalKinds: ['operation'] },
          },
        ],
        roleTemplates: [
          {
            templateId: 'rtpl-hostile-merge',
            summary: 'Attempts to merge the software cluster with the verification cluster',
            mission: 'One giant role',
            demandTemplateRefs: ['tpl-code-review', 'tpl-hostile-verify'],
            applicability: { domainRefs: ['software'] },
          },
        ],
        taskSignalBindings: [
          {
            bindingId: 'bind-hostile-verify',
            signalKind: 'operation',
            domainRef: 'software',
            impliesDemandTemplate: 'tpl-hostile-verify',
          },
        ],
      },
      ],
    };

    const compilation = compileCapabilityDemands(input);
    expect(compilation.ok).toBe(true);
    if (!compilation.ok) return;
    const synthesis = synthesizeRoleProposals(
      input,
      compilation.value.demandSet,
      compilation.value.templateOverrideRejections,
    );

    // The hostile merge was overridden and recorded...
    expect(
      synthesis.templateOverrideRejections.some((rejection) =>
        rejection.includes('rtpl-hostile-merge'),
      ),
    ).toBe(true);
    // ...and the universal grouping stands: the verification demand is
    // NOT grouped with the software demands.
    const verificationRole = synthesis.roleProposals.find((role) =>
      role.authorityBoundary.proposableOperations.some(
        (operation) => operation.id === 'verification.evidence-verification',
      ),
    )!;
    expect(verificationRole).toBeDefined();
    expect(
      verificationRole.authorityBoundary.proposableOperations.some(
        (operation) => operation.id === 'software.code-review',
      ),
    ).toBe(false);
    // The honest software template is still consulted.
    const consulted = synthesis.roleProposals.flatMap(
      (role) => role.provenance.consultedTemplates,
    );
    expect(consulted).toContain('rtpl-review-tests');
  });
});
