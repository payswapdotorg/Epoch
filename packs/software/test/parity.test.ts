// Runtime parity with the sibling kernel vocabularies (the
// devDependency parity test — mirrors src/parity.ts at runtime; never a
// runtime dependency): the W036 universal stages, the W006 confidence
// methods, the W004 policy-binding grammar, the W007 capability-id
// grammar, the W002 type-key grammar, the W010 principal grammar, and the
// W003 action-proposal admission.
//
// RENDERING-SHAPE COMPATIBILITY IS ASSERTED STRUCTURALLY, NOT BY IMPORT:
// the W001 boundary model (pack -> contracts/kernel/tooling only) forbids
// even devDependencies on the experience layer, so the pack proves its
// views are render-safe (JSON-safe, zero UI-protocol coupling) without
// importing @epoch/experience-protocol / @epoch/renderer-runtime.
import { describe, expect, it } from 'vitest';
import { UNIVERSAL_LIFECYCLE_STAGES } from '@epoch/solution-delivery';
import { parseActionProposal } from '@epoch/action-protocol';
import { CONFIDENCE_METHODS } from '@epoch/evidence';
import { policyBindingSchema, type PolicyBinding } from '@epoch/policy-contracts';
import { CapabilityIdSchema } from '@epoch/capability-registry';
import { TypeKeySchema } from '@epoch/world-model';
import { EVENT_ACTOR_PATTERN } from '@epoch/event-log';
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  SOFTWARE_CAPABILITY_DEPENDENCIES,
  SOFTWARE_CONSTRAINT_DESCRIPTORS,
  SOFTWARE_ENTITY_BINDINGS,
  SOFTWARE_STAGE_VOCABULARY,
  SOFTWARE_VERIFICATION_METHODS,
  digestPackProfile,
  projectBacklog,
  projectDeploymentPlan,
  projectRoadmap,
  renderDeployProposal,
  sealSoftwareProfile,
  softwareDeployProposalTemplates,
  softwarePackProfile,
  softwareVocabularyBundle,
  softwareWorkTemplates,
  PACK_CONFIDENCE_METHODS,
} from '../src/index';
import {
  checkoutChain,
  deployProposalParams,
  environmentAssignments,
  workItemIndex,
  TENANT,
} from './fixtures';

describe('runtime parity: the pack vocabulary references the kernel grammars', () => {
  it('the stage vocabulary keys ARE the eleven universal lifecycle stages (W036 parity)', () => {
    expect(Object.keys(SOFTWARE_STAGE_VOCABULARY).sort()).toEqual(
      [...UNIVERSAL_LIFECYCLE_STAGES].sort(),
    );
  });

  it('the mirrored confidence-method vocabulary IS the W006 CONFIDENCE_METHODS (W006 parity)', () => {
    expect([...PACK_CONFIDENCE_METHODS].sort()).toEqual([...CONFIDENCE_METHODS].sort());
    for (const method of SOFTWARE_VERIFICATION_METHODS) {
      expect(CONFIDENCE_METHODS).toContain(method.confidenceMethod);
    }
  });

  it('every constraint descriptor policyBinding parses through the W004 schema (W004 parity)', () => {
    for (const descriptor of SOFTWARE_CONSTRAINT_DESCRIPTORS) {
      const parsed = policyBindingSchema.safeParse(descriptor.policyBinding);
      expect(parsed.success, descriptor.constraintId).toBe(true);
      if (parsed.success) {
        const binding: PolicyBinding = parsed.data;
        expect(binding.constraintId).toBe(descriptor.policyBinding.constraintId);
      }
    }
  });

  it('the capability dependencies parse through the W007 CapabilityIdSchema (W007 parity)', () => {
    for (const capabilityId of SOFTWARE_CAPABILITY_DEPENDENCIES) {
      expect(CapabilityIdSchema.safeParse(capabilityId).success, capabilityId).toBe(true);
    }
  });

  it('the entity-binding type keys parse through the W002 TypeKeySchema (W002 parity)', () => {
    for (const binding of SOFTWARE_ENTITY_BINDINGS) {
      expect(TypeKeySchema.safeParse(binding.entityTypeKey).success, binding.entityTypeKey).toBe(
        true,
      );
    }
  });

  it('the backlog assignee references parse through the W010 event actor grammar (W010 parity)', () => {
    const chain = checkoutChain();
    const backlog = projectBacklog({
      program: chain.program,
      delivery: chain.delivery,
      workItemIndex: workItemIndex(),
    });
    if (!backlog.ok) {
      throw new Error('fixture backlog failed to project');
    }
    for (const issue of backlog.value.issues) {
      if (issue.assignee !== undefined) {
        expect(EVENT_ACTOR_PATTERN.test(issue.assignee), issue.assignee).toBe(true);
      }
    }
  });

  it('the rendered deploy proposal admits through the W003 pipeline (W003 parity)', () => {
    const template = softwareDeployProposalTemplates().find(
      (candidate) => candidate.templateId === 'software.deploy.template.release-rollout',
    )!;
    const rendered = renderDeployProposal(template, deployProposalParams());
    if (!rendered.ok) {
      throw new Error('fixture deploy proposal failed to render');
    }
    const admitted = parseActionProposal(rendered.value);
    expect(admitted.ok).toBe(true);
  });

  it('the pack digest machinery IS the agent-protocol canonicalDigest (digest parity)', () => {
    const profile = softwarePackProfile(TENANT);
    expect(digestPackProfile(profile)).toBe(canonicalDigest(profile as never));
    const sealed = sealSoftwareProfile(profile);
    expect(sealed.contentDigest).toBe(canonicalDigest(profile as never));
  });
});

describe('runtime parity: rendering-surface shape compatibility asserted WITHOUT importing the experience layer (the pack owns NO UI)', () => {
  const chain = checkoutChain();

  // Structural JSON-value grammar (mirrors the W011 JsonValueSchema shape
  // locally — the pack boundary forbids importing it): primitives, plain
  // arrays, and plain string-keyed objects; never undefined, functions,
  // symbols, dates, maps, or class instances.
  const isJsonValue = (value: unknown): boolean => {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return true;
    }
    if (Array.isArray(value)) return value.every(isJsonValue);
    if (typeof value === 'object') {
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) return false;
      return Object.entries(value).every(
        ([k, v]) => typeof k === 'string' && isJsonValue(v),
      );
    }
    return false;
  };

  it('every public view is a JSON value (renderable content; no dates, maps, class instances, or undefined)', () => {
    const roadmap = projectRoadmap(chain.program);
    const backlog = projectBacklog({
      program: chain.program,
      delivery: chain.delivery,
      workItemIndex: workItemIndex(),
    });
    const plan = projectDeploymentPlan({
      program: chain.program,
      assignments: environmentAssignments(),
    });
    if (!roadmap.ok || !backlog.ok || !plan.ok) {
      throw new Error('fixture projections failed');
    }
    const renderable = [
      softwarePackProfile(TENANT),
      softwareVocabularyBundle(),
      ...softwareWorkTemplates(),
      ...softwareDeployProposalTemplates(),
      roadmap.value,
      backlog.value,
      plan.value,
    ];
    for (const view of renderable) {
      expect(isJsonValue(view)).toBe(true);
      // Full JSON round-trip: every view survives serialization unchanged
      // (what any experience/renderer pipeline would receive over the wire).
      expect(JSON.parse(JSON.stringify(view))).toEqual(view);
    }
  });

  it('no view carries any experience/renderer protocol marker (no UI coupling)', () => {
    const roadmap = projectRoadmap(chain.program);
    const backlog = projectBacklog({ program: chain.program });
    const plan = projectDeploymentPlan({ program: chain.program });
    if (!roadmap.ok || !backlog.ok || !plan.ok) {
      throw new Error('fixture projections failed');
    }
    // Denylist: W011/W013 protocol-version and wire-message vocabulary.
    // Version constants cannot be imported (experience layer is off-limits
    // to packs), so any *version-shaped* key is rejected wholesale.
    const uiCouplingKeys = new Set([
      'protocolVersion',
      'experienceVersion',
      'rendererVersion',
      'wireVersion',
    ]);
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
        return;
      }
      if (node !== null && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
          expect(uiCouplingKeys.has(key), `unexpected UI-coupling key: ${key}`).toBe(false);
          walk(value);
        }
      }
    };
    for (const view of [roadmap.value, backlog.value, plan.value]) {
      walk(view);
      const json = JSON.stringify(view);
      expect(json.includes('mount-graph')).toBe(false);
      expect(json.includes('advance-frame')).toBe(false);
      expect(json.includes('submit-intent')).toBe(false);
    }
  });
});
