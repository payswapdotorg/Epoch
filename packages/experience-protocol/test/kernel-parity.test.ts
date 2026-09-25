// Kernel parity (devDependencies — NO runtime coupling): the mirrored and
// structurally-compatible vocabularies are pinned member-for-member against
// the real kernel packages. A real action-protocol ActionTypeReference
// parses as a ControlIntent and vice versa; a real evidence digest flows
// into a ProjectedEvidenceRef; a real capability-manifest identity flows
// into a ProjectedCapabilityRef (the W006/W007/W008 devDep parity pattern;
// the compile-time half lives in src/kernel-parity.ts).
import { describe, expect, it } from 'vitest';
import type { ActionTypeReference } from '@epoch/action-protocol';
import { ActionTypeReferenceSchema } from '@epoch/action-protocol';
import { computeEvidenceDigest, EvidenceRecordSchema } from '@epoch/evidence';
import {
  CapabilityManifestSchema,
  computeCapabilityManifestDigest,
} from '@epoch/capability-registry';
import {
  ControlIntentSchema,
  ProjectedCapabilityRefSchema,
  ProjectedEvidenceRefSchema,
  parseExperienceGraph,
  sealExperienceGraph,
} from '../src/index';
import { TENANT_A, graphContent } from './fixtures';

const ACTION_TYPE_REF: ActionTypeReference = {
  id: 'world.entity.focus',
  version: '1.0.0',
};

function evidenceRecord(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: 'measurement',
    subject: {
      artifactId: 'stress-report-r3',
      revision: 'r3',
      digest: 'f'.repeat(64),
    },
    producedBy: { runId: 'run-17', actorId: 'agent:planner-1', methodId: 'method-fem-1' },
    observedAt: '2026-02-05T12:00:00.000Z',
    content: {
      mediaType: 'application/json',
      data: { maxStressMpa: 312.4 },
    },
    confidence: { distribution: { kind: 'point', value: 0.95 }, method: 'measured' },
  };
}

function capabilityManifest(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    capabilityId: 'engineering.stress-analysis',
    category: 'simulation',
    version: '1.4.0',
    descriptor: {
      displayName: 'Stress analysis',
      description: 'Finite-element stress analysis.',
      inputs: [{ name: 'load-kn', kind: 'number', required: true, description: 'Rated load in kilonewtons.' }],
      outputs: [{ name: 'max-stress-mpa', kind: 'number', required: true, description: 'Peak von Mises stress.' }],
      assumptions: ['linear elasticity'],
    },
    contracts: [{ contractId: 'epoch.simulation-protocol', contractVersion: '1.0.0' }],
    trust: { origin: 'first-party' },
  };
}

describe('action-protocol parity (devDependency)', () => {
  it('a real ActionTypeReference parses as a ControlIntent', () => {
    // Cross-validation: the action-protocol schema and the experience
    // ControlIntent schema admit each other's documents.
    expect(ActionTypeReferenceSchema.safeParse(ACTION_TYPE_REF).success).toBe(true);
    const asIntent = ControlIntentSchema.safeParse(ACTION_TYPE_REF);
    expect(asIntent.success).toBe(true);
    if (asIntent.success) {
      expect(ActionTypeReferenceSchema.safeParse(asIntent.data).success).toBe(true);
    }
  });

  it('a ControlIntent parses as a real ActionTypeReference', () => {
    const intent = ControlIntentSchema.parse({
      id: 'world.view.switch',
      version: '1.2.0',
    });
    expect(ActionTypeReferenceSchema.safeParse(intent).success).toBe(true);
  });

  it('a control node carrying a real action-type intent admits end-to-end', () => {
    const content = graphContent('controls');
    const control = content.nodes[0];
    if (control.kind !== 'control') throw new Error('fixture control');
    control.descriptor.intent = ACTION_TYPE_REF;
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (sealed.ok) {
      expect(parseExperienceGraph(sealed.value).ok).toBe(true);
    }
  });

  it('an invalid action-type reference is rejected by both schemas identically', () => {
    const bad = { id: 'Not A Name', version: '1.0.0' };
    expect(ActionTypeReferenceSchema.safeParse(bad).success).toBe(false);
    expect(ControlIntentSchema.safeParse(bad).success).toBe(false);
  });
});

describe('evidence parity (devDependency)', () => {
  it('a real evidence record\'s content-addressed digest flows into a ProjectedEvidenceRef', () => {
    const parsed = EvidenceRecordSchema.safeParse(evidenceRecord());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const digest = computeEvidenceDigest(parsed.data);
    const ref = {
      kind: 'evidence-record',
      tenantId: TENANT_A,
      recordDigest: digest,
    };
    expect(ProjectedEvidenceRefSchema.safeParse(ref).success).toBe(true);
  });

  it('an evidence reference admits inside a graph end-to-end', () => {
    const parsed = EvidenceRecordSchema.safeParse(evidenceRecord());
    if (!parsed.success) throw new Error('evidence fixture');
    const digest = computeEvidenceDigest(parsed.data);
    const content = graphContent('narrative');
    content.projectedFrom = [
      { kind: 'evidence-record', tenantId: TENANT_A, recordDigest: digest },
    ];
    const beat = content.nodes[0];
    if (beat.kind !== 'narrative-beat') throw new Error('fixture beat');
    delete (beat as { ref?: unknown }).ref;
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (sealed.ok) {
      expect(parseExperienceGraph(sealed.value).ok).toBe(true);
    }
  });

  it('a non-digest evidence identity is rejected', () => {
    expect(
      ProjectedEvidenceRefSchema.safeParse({
        kind: 'evidence-record',
        tenantId: TENANT_A,
        recordDigest: 'not-a-digest',
      }).success,
    ).toBe(false);
  });
});

describe('capability-registry parity (devDependency)', () => {
  it('a real capability manifest\'s identity and digest flow into a ProjectedCapabilityRef', () => {
    const parsed = CapabilityManifestSchema.safeParse(capabilityManifest());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const digest = computeCapabilityManifestDigest(parsed.data);
    const ref = {
      kind: 'capability',
      tenantId: TENANT_A,
      capabilityId: parsed.data.capabilityId,
      capabilityVersion: parsed.data.version,
      contentDigest: digest,
    };
    expect(ProjectedCapabilityRefSchema.safeParse(ref).success).toBe(true);
  });

  it('a capability reference admits inside a graph end-to-end', () => {
    const parsed = CapabilityManifestSchema.safeParse(capabilityManifest());
    if (!parsed.success) throw new Error('capability fixture');
    const digest = computeCapabilityManifestDigest(parsed.data);
    const content = graphContent('narrative');
    content.projectedFrom = [
      {
        kind: 'capability',
        tenantId: TENANT_A,
        capabilityId: parsed.data.capabilityId,
        capabilityVersion: parsed.data.version,
        contentDigest: digest,
      },
    ];
    const beat = content.nodes[0];
    if (beat.kind !== 'narrative-beat') throw new Error('fixture beat');
    delete (beat as { ref?: unknown }).ref;
    const sealed = sealExperienceGraph(content);
    expect(sealed.ok).toBe(true);
    if (sealed.ok) {
      expect(parseExperienceGraph(sealed.value).ok).toBe(true);
    }
  });

  it('a non-qualified capability id is rejected', () => {
    expect(
      ProjectedCapabilityRefSchema.safeParse({
        kind: 'capability',
        tenantId: TENANT_A,
        capabilityId: 'Stress Analysis',
        capabilityVersion: '1.0.0',
        contentDigest: 'a'.repeat(64),
      }).success,
    ).toBe(false);
  });
});
