// W017 acceptance: devDependency parity — the mirrored/structural
// consumption surfaces are pinned against the REAL references:
// - the plan-artifact projection consumes REAL @epoch/experience-compiler
//   output losslessly (digest chain preserved);
// - the principal vocabulary mirrors @epoch/identity;
// - the authoring denial vocabulary mirrors @epoch/authorization;
// - the action-type shape reuses the W011 control-intent vocabulary
//   (itself pinned to the action-protocol ActionTypeReference by W011's
//   kernel parity — the R30 chain of custody).
import { describe, expect, it } from 'vitest';
import { compileExperienceGraph, planDigestChain as compilerChain } from '@epoch/experience-compiler';
import { PRINCIPAL_ID_PATTERN as IDENTITY_PRINCIPAL_ID, PRINCIPAL_KINDS as IDENTITY_PRINCIPAL_KINDS } from '@epoch/identity';
import { DENIAL_CODES as AUTHORIZATION_DENIAL_CODES, PRINCIPAL_STATUSES } from '@epoch/authorization';
import { ControlIntentSchema } from '@epoch/experience-protocol';
import { DESKTOP_DEVICE } from '../src/index';
import {
  AUTHORING_DENIAL_CODES,
  PRINCIPAL_ID_PATTERN,
  PRINCIPAL_KINDS,
  projectPlanArtifact,
  planDigestChain,
  verifyPlanDocument,
} from '../src/index';
import { compiledExperience } from './fixtures';

describe('W012 parity: the plan-artifact projection consumes REAL compiler output', () => {
  it('projects a REAL compiled plan losslessly with the digest chain preserved', () => {
    const experience = compiledExperience('3d');
    const projected = projectPlanArtifact(experience.plan);
    expect(projected.ok).toBe(true);
    if (projected.ok) {
      // The projection preserves the addressing and chain verbatim.
      expect(projected.value.digest).toBe(experience.plan.digest);
      expect(projected.value.sourceEnvelopeDigest).toBe(experience.graph.digest);
      expect(projected.value.sourceGraphId).toBe(experience.graph.graphId);
      expect(projected.value.sourceGraphKind).toBe(experience.graph.graphKind);
      expect(projected.value.tenantScope).toEqual(experience.graph.tenantScope);
      expect(projected.value.target).toEqual(DESKTOP_DEVICE);
      // The digest chain matches the compiler's own chain helper.
      expect(planDigestChain(projected.value)).toEqual(compilerChain(experience.plan));
    }
  });

  it('the full plan document verifies against its own digest (the projection\u2019s address)', () => {
    const experience = compiledExperience('2d');
    const verified = verifyPlanDocument(experience.plan);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.value).toBe(experience.plan.digest);
    }
  });

  it('the projection rejects tampered plan documents (digest mismatch)', () => {
    const experience = compiledExperience('2d');
    const tampered = { ...experience.plan, usage: { ...experience.plan.usage, nodes: 99 } };
    expect(verifyPlanDocument(tampered).ok).toBe(false);
  });

  it('recompiling the same graph reproduces the identical plan digest (compiler determinism carries through)', () => {
    const a = compiledExperience('2d');
    const recompiled = compileExperienceGraph({
      envelope: a.graph,
      device: DESKTOP_DEVICE,
      expectedTenantId: a.graph.tenantScope.tenantId,
    });
    expect(recompiled.ok).toBe(true);
    if (recompiled.ok) {
      expect(recompiled.value.digest).toBe(a.plan.digest);
    }
  });
});

describe('identity parity: the principal vocabulary mirrors @epoch/identity', () => {
  it('the principal id pattern is identical', () => {
    expect(PRINCIPAL_ID_PATTERN.source).toBe(IDENTITY_PRINCIPAL_ID.source);
    expect(PRINCIPAL_ID_PATTERN.flags).toBe(IDENTITY_PRINCIPAL_ID.flags);
  });

  it('the principal kinds are identical (sorted)', () => {
    expect([...PRINCIPAL_KINDS].sort()).toEqual([...IDENTITY_PRINCIPAL_KINDS].sort());
  });

  it('the mirrored principal statuses of the authorization projection stay in the identity lifecycle vocabulary', () => {
    // The authorization package projects principal lifecycle states as
    // statuses; the desktop mirror must not invent foreign ones.
    for (const status of PRINCIPAL_STATUSES) {
      expect(['active', 'suspended', 'deactivated']).toContain(status);
    }
  });
});

describe('authorization parity: the authoring denial vocabulary mirrors @epoch/authorization', () => {
  it('the denial codes are identical (sorted)', () => {
    expect([...AUTHORING_DENIAL_CODES].sort()).toEqual([...AUTHORIZATION_DENIAL_CODES].sort());
  });
});

describe('R30 parity: the authoring action-type shape is the control-intent shape', () => {
  it('parses as the W011 ControlIntent (the action-protocol ActionTypeReference mirror)', () => {
    const reference = { id: 'world.view.annotate', version: '1.0.0' };
    expect(ControlIntentSchema.safeParse(reference).success).toBe(true);
    // And the inverse: the shape admits nothing else.
    expect(ControlIntentSchema.safeParse({ id: 'unqualified', version: '1.0.0' }).success).toBe(false);
    expect(ControlIntentSchema.safeParse({ id: 'world.view.annotate', version: '1.0' }).success).toBe(false);
  });
});
