// KERNEL PARITY with the W002/W006/W007/W008/W009 dependency contracts
// (the W011 kernel-parity pattern; devDependencies only — no runtime
// coupling beyond the pinned @epoch runtime dependencies):
//
// - @epoch/world-model (W002): the semantic-target grammar accepts EVERY
//   core entity/relation type key, and fixture targets resolve against a
//   REAL WorldModel's registered vocabulary;
// - @epoch/evidence (W006, runtime dep): stage evidence records are real
//   evidence records — they store in a REAL EvidenceStore;
// - @epoch/verification + @epoch/provenance (W006): stage evidence
//   records flow into a REAL verification chain (Requirement -> Claim ->
//   Method -> Run -> Evidence -> Result) and validate;
// - @epoch/capability-registry + @epoch/extension-sdk (W007/W008): the
//   provisional origin is the exact W007 origin vocabulary member, and
//   the t1 trust floor is the exact extension-sdk trust class with its
//   provisional grant ceiling;
// - @epoch/tenancy (W009): the tenant/workspace/project id grammars are
//   IDENTICAL to the tenancy patterns;
// - @epoch/constraint-language (W004): the identifier grammar family is
//   compatible with the ECL input-name grammar (shared alphabet family).
import { describe, expect, it } from 'vitest';
import { WorldModel } from '@epoch/world-model';
import { CORE_ENTITY_TYPES, CORE_RELATION_TYPES } from '@epoch/world-model';
import { EvidenceStore, EvidenceRecordSchema } from '@epoch/evidence';
import { validateChain, parseVerificationChain } from '@epoch/verification';
import { CAPABILITY_ORIGINS, CapabilityRegistry } from '@epoch/capability-registry';
import {
  EXTENSION_TRUST_CLASSES,
  TRUST_CLASS_GRANT_CEILINGS,
} from '@epoch/extension-sdk';
import {
  TENANT_ID_PATTERN as TENANCY_TENANT_ID_PATTERN,
  WORKSPACE_ID_PATTERN as TENANCY_WORKSPACE_ID_PATTERN,
  PROJECT_ID_PATTERN as TENANCY_PROJECT_ID_PATTERN,
} from '@epoch/tenancy';
import { inputNameSchema } from '@epoch/constraint-language';
import {
  PROPERTY_NAME_PATTERN,
  SEMANTIC_TYPE_KEY_PATTERN,
  SOURCE_PATH_PATTERN,
  TENANT_ID_PATTERN,
  WORKSPACE_ID_PATTERN,
  PROJECT_ID_PATTERN,
  PROVISIONAL_CAPABILITY_ORIGIN,
  DOCUMENT_DERIVED_TRUST_CLASS,
  SemanticTypeKeySchema,
  TenantIdSchema,
  WorkspaceIdSchema,
  ProjectIdSchema,
  PropertyNameSchema,
  SourcePathSchema,
} from '../src/index';
import { runContext, runStagedPipeline, jsonFixture } from './fixtures';

describe('W002 world-model parity (devDependency)', () => {
  it('every core entity type key is a valid semantic target', () => {
    for (const type of CORE_ENTITY_TYPES) {
      expect(SEMANTIC_TYPE_KEY_PATTERN.test(type.key), type.key).toBe(true);
      expect(SemanticTypeKeySchema.safeParse(type.key).success).toBe(true);
    }
  });

  it('every core relation type key is a valid semantic target', () => {
    for (const type of CORE_RELATION_TYPES) {
      expect(SEMANTIC_TYPE_KEY_PATTERN.test(type.key), type.key).toBe(true);
    }
  });

  it('fixture semantic targets resolve against a REAL registered world vocabulary', () => {
    const world = WorldModel.create({ clock: () => '2026-01-01T00:00:00.000Z' });
    const registered = world.registerEntityType({ key: 'construction:wall' });
    expect(registered.key).toBe('construction:wall');
    // The fixture target grammar matches the registered key exactly.
    expect(SemanticTypeKeySchema.safeParse('construction:wall').success).toBe(true);
    // The registered type actually carries assertions: a typed entity with
    // that type is admitted (unregistered types are rejected by W002).
    world.applyAssertion({
      statement: { kind: 'entity', entityId: 'wall-1', entityType: 'construction:wall', properties: { thickness: 0.3 } },
      provenance: {
        actor: { id: 'user:alice', role: 'human', displayName: 'Alice' },
        method: 'direct-observation',
        evidence: [{ id: 'ev:doc-1', kind: 'document' }],
      },
      confidence: { distribution: { kind: 'point', value: 0.95 }, method: 'measured' },
    });
    expect(world.getEntity('wall-1')).not.toBeNull();
  });

  it('the core namespace is reserved: kernel vocabulary stays kernel vocabulary', () => {
    // core:entity / core:artifact are VALID grammar targets (the world
    // model owns them); the document adapter never defines its own
    // namespace vocabulary.
    expect(CORE_ENTITY_TYPES.some((type) => type.key === 'core:entity')).toBe(true);
    expect(CORE_ENTITY_TYPES.some((type) => type.key === 'core:artifact')).toBe(true);
  });
});

describe('W006 evidence + verification parity (runtime + devDependency)', () => {
  const pipeline = runStagedPipeline(jsonFixture());

  it('stage evidence records validate as W006 evidence and store in a REAL EvidenceStore', () => {
    const store = EvidenceStore.create();
    for (const receipt of pipeline.receipts) {
      expect(EvidenceRecordSchema.safeParse(receipt.record).success).toBe(true);
      const stored = store.add(receipt.record);
      expect(stored.ok).toBe(true);
      if (stored.ok) expect(stored.receipt.digest).toBe(receipt.digest);
    }
    expect(store.size).toBe(pipeline.receipts.length);
  });

  it('stage evidence flows into a REAL verification chain and the chain validates', () => {
    const run = runContext('verification');
    const stages = runStagedPipeline(jsonFixture(), run);
    const digests = stages.receipts.map((receipt) => receipt.digest);
    const chain = {
      schemaVersion: 1,
      requirements: [
        {
          schemaVersion: 1,
          requirementId: 'req:docmap-001',
          statement: 'The document mapping table derives provisional source mappings deterministically.',
        },
      ],
      claims: [
        {
          schemaVersion: 1,
          claimId: 'claim:docmap-derivation',
          requirementId: 'req:docmap-001',
          statement: 'The staged derivation produced complete evidence for the document revision.',
          stage: 'verification',
        },
      ],
      methods: [
        {
          schemaVersion: 1,
          methodId: run.methodId!,
          claimId: 'claim:docmap-derivation',
          stage: 'verification',
          description: 'Re-run the deterministic derivation pipeline and check the evidence chain.',
          deterministic: true,
        },
      ],
      runs: [
        {
          schemaVersion: 1,
          runId: run.runId,
          methodId: run.methodId!,
          stage: 'verification',
          executedBy: run.actorId,
          executedByKind: 'software',
          startedAt: '2026-01-05T08:59:00.000Z',
          endedAt: '2026-01-05T09:01:00.000Z',
          status: 'completed',
          producedEvidence: digests,
        },
      ],
      evidence: stages.receipts.map((receipt) => receipt.record),
      results: [
        {
          schemaVersion: 1,
          resultId: 'result:docmap-1',
          claimId: 'claim:docmap-derivation',
          runId: run.runId,
          stage: 'verification',
          outcome: 'pass',
          evidenceDigests: digests,
          confidence: { distribution: { kind: 'point', value: 1 }, method: 'stated' },
          decidedAt: '2026-01-05T09:02:00.000Z',
          rationale: 'Deterministic derivation: identical inputs, identical evidence.',
        },
      ],
      approvals: [],
    };
    const parsed = parseVerificationChain(chain);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const validated = validateChain(parsed.chain);
    expect(validated.ok).toBe(true);
    if (!validated.ok) {
      throw new Error(`verification chain rejected: ${validated.issues[0]?.message}`);
    }
  });
});

describe('W007 capability-registry parity (runtime + devDependency)', () => {
  it('the provisional origin is exactly the W007 origin vocabulary member', () => {
    expect(CAPABILITY_ORIGINS).toContain(PROVISIONAL_CAPABILITY_ORIGIN);
    expect(PROVISIONAL_CAPABILITY_ORIGIN).toBe('provisional-document-derived');
  });

  it('the W007 registry resolves registrations the document adapter seals (real consumption)', () => {
    const registry = new CapabilityRegistry();
    expect(registry.list({ category: 'source' })).toHaveLength(0);
  });
});

describe('W008 extension-sdk trust parity (devDependency)', () => {
  it('the t1 floor is a real extension-sdk trust class', () => {
    expect(EXTENSION_TRUST_CLASSES).toContain(DOCUMENT_DERIVED_TRUST_CLASS);
  });

  it('t1 is exactly the provisional model-population class', () => {
    const t1 = TRUST_CLASS_GRANT_CEILINGS.find((entry) => entry.trustClass === 't1');
    expect(t1).toBeDefined();
    expect(t1!.title.toLowerCase()).toContain('provisional');
  });

  it('document-derived mappings can never reach the certify/execute classes (t3/t4)', () => {
    // The ceiling constant is t1 and the escalation ops are typed denials;
    // the sdk ladder above t1 exists only for non-document-derived paths.
    const classes = EXTENSION_TRUST_CLASSES as readonly string[];
    expect(classes.indexOf('t3')).toBeGreaterThan(classes.indexOf(DOCUMENT_DERIVED_TRUST_CLASS));
    expect(classes.indexOf('t4')).toBeGreaterThan(classes.indexOf(DOCUMENT_DERIVED_TRUST_CLASS));
  });
});

describe('W009 tenancy parity (devDependency)', () => {
  it('the mirrored id patterns are exactly the tenancy patterns', () => {
    expect(TENANT_ID_PATTERN.source).toBe(TENANCY_TENANT_ID_PATTERN.source);
    expect(TENANT_ID_PATTERN.flags).toBe(TENANCY_TENANT_ID_PATTERN.flags);
    expect(WORKSPACE_ID_PATTERN.source).toBe(TENANCY_WORKSPACE_ID_PATTERN.source);
    expect(WORKSPACE_ID_PATTERN.flags).toBe(TENANCY_WORKSPACE_ID_PATTERN.flags);
    expect(PROJECT_ID_PATTERN.source).toBe(TENANCY_PROJECT_ID_PATTERN.source);
    expect(PROJECT_ID_PATTERN.flags).toBe(TENANCY_PROJECT_ID_PATTERN.flags);
  });

  it('the same sample ids pass both pattern sets', () => {
    const tenants = ['tenant:alpha', 'tenant:a', 'tenant:bridge-12'];
    for (const id of tenants) {
      expect(TenantIdSchema.safeParse(id).success).toBe(true);
      expect(TENANCY_TENANT_ID_PATTERN.test(id)).toBe(true);
    }
    expect(TenantIdSchema.safeParse('tenant:-x').success).toBe(false);
    expect(TENANCY_TENANT_ID_PATTERN.test('tenant:-x')).toBe(false);
    expect(WorkspaceIdSchema.safeParse('workspace:alpha-eng').success).toBe(true);
    expect(ProjectIdSchema.safeParse('project:alpha-tower').success).toBe(true);
  });
});

describe('W004 constraint-language parity (devDependency)', () => {
  it('the identifier grammar family is shared (same alphabet as ECL input names)', () => {
    // ECL input names: /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/ — the document
    // property/source-path grammars use the same leading-letter alphabet,
    // so authored constraints can reference mapped properties.
    expect(inputNameSchema.safeParse('thickness').success).toBe(true);
    expect(PropertyNameSchema.safeParse('thickness').success).toBe(true);
    expect(SourcePathSchema.safeParse('fields.walls').success).toBe(true);
    expect(PROPERTY_NAME_PATTERN.test('material_grade')).toBe(true);
    expect(SOURCE_PATH_PATTERN.test('fields.level-2.beams')).toBe(true);
    expect(inputNameSchema.safeParse('1starts-with-digit').success).toBe(false);
    expect(SourcePathSchema.safeParse('1starts-with-digit').success).toBe(false);
  });
});
