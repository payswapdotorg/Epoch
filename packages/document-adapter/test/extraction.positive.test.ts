// Staged extraction (positive): the full evidence-first derivation over
// content-addressed documents — parse, deterministic candidate
// extraction, complete stage evidence chains, candidate provenance
// verification, provisional definition derivation, and the W007
// source-category registration into a REAL CapabilityRegistry.
import { describe, expect, it } from 'vitest';
import { CapabilityRegistry, sealCapabilityManifest } from '@epoch/capability-registry';
import { EvidenceRecordSchema } from '@epoch/evidence';
import {
  advanceExtractionStage,
  buildProvisionalRegistration,
  deriveProvisionalDefinitions,
  verifyCandidateProvenance,
  verifyDefinitionProvenance,
  verifyEvidenceChain,
  DEFINITION_CHAIN_STAGES,
  parseExtractionCandidate,
  parseProvisionalAdapterDefinition,
} from '../src/index';
import {
  jsonFixture,
  runContext,
  runStagedPipeline,
  textFixture,
  expectFailure,
  chainThroughReview,
} from './fixtures';

describe('staged extraction with complete evidence chains (positive)', () => {
  it('every stage emits a valid W006 evidence record anchored to the exact document revision', () => {
    const pipeline = runStagedPipeline(textFixture());
    for (const receipt of pipeline.receipts.slice(0, 3)) {
      expect(EvidenceRecordSchema.safeParse(receipt.record).success).toBe(true);
      expect(receipt.record.subject.digest).toBe(pipeline.descriptor.digest);
      expect(receipt.record.subject.artifactId).toBe(`doc:${pipeline.descriptor.digest}`);
      expect(receipt.link.evidenceDigest).toBe(receipt.digest);
      expect(receipt.link.stage).toBe((receipt.record.content.data as { stage: string }).stage);
    }
    // Stage kinds follow the fixed stage->kind vocabulary.
    const [uploaded, parsed, extracted] = pipeline.receipts;
    expect(uploaded!.record.kind).toBe('document');
    expect(parsed!.record.kind).toBe('document');
    expect(extracted!.record.kind).toBe('computation');
  });

  it('the chain covering uploaded..review-pending verifies end-to-end', () => {
    const pipeline = runStagedPipeline(jsonFixture());
    const chain = chainThroughReview(pipeline);
    const verified = verifyEvidenceChain(chain, pipeline.records);
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.value.stages.map((link) => link.stage)).toEqual([
      'uploaded',
      'parsed',
      'candidates-extracted',
      'review-pending',
    ]);
  });

  it('candidates derive deterministically and carry full provenance through the chain', () => {
    const pipeline = runStagedPipeline(textFixture());
    expect(pipeline.candidates).toHaveLength(3);
    const chain = {
      schemaVersion: 1 as const,
      documentDigest: pipeline.descriptor.digest,
      tenantScope: pipeline.descriptor.tenantScope,
      stages: pipeline.receipts.map((receipt) => receipt.link),
    };
    for (const candidate of pipeline.candidates) {
      const admitted = verifyCandidateProvenance(candidate, chain, pipeline.records);
      expect(admitted.ok).toBe(true);
      expect(candidate.documentDigest).toBe(pipeline.descriptor.digest);
      expect(candidate.tenantScope.tenantId).toBe('tenant:alpha');
      expect(candidate.candidateId).toMatch(/^cand:[0-9a-f]{64}$/);
    }
  });

  it('the JSON form derives candidates with property mappings and capability refs', () => {
    const pipeline = runStagedPipeline(jsonFixture());
    expect(pipeline.candidates).toHaveLength(2);
    const withProperties = pipeline.candidates.find(
      (candidate) => candidate.locator.sourcePath === 'fields.walls',
    );
    expect(withProperties).toBeDefined();
    expect(withProperties!.propertyMappings).toHaveLength(2);
    expect(withProperties!.declaredConfidence).toBe(0.9);
    expect(withProperties!.capabilityRef).toEqual({
      id: 'construction.geometry',
      version: '1.2.0',
    });
    expect(withProperties!.locator.format).toBe('structured-json');
  });

  it('the text form records 1-based line locators', () => {
    const pipeline = runStagedPipeline(textFixture());
    const walls = pipeline.candidates.find(
      (candidate) => candidate.locator.sourcePath === 'fields.walls',
    );
    expect(walls).toBeDefined();
    if (walls!.locator.format !== 'structured-text') {
      throw new Error('text fixture must carry a text locator');
    }
    expect(walls!.locator.line).toBe(2);
    expect(walls!.declaredConfidence).toBe(0.9);
  });

  it('candidates round-trip through the total parse surface', () => {
    const pipeline = runStagedPipeline(jsonFixture());
    const candidate = pipeline.candidates[0]!;
    const round = parseExtractionCandidate(JSON.parse(JSON.stringify(candidate)));
    expect(round.ok).toBe(true);
    if (round.ok) expect(round.value).toEqual(candidate);
  });
});

describe('provisional definition derivation (positive)', () => {
  const pipeline = runStagedPipeline(jsonFixture());

  function definitionFixture() {
    const candidate = wallsCandidate(pipeline);
    const chain = chainThroughReview(pipeline);
    const derived = deriveProvisionalDefinitions({
      descriptor: pipeline.descriptor,
      candidates: [candidate],
      chain,
      run: runContext('provisional'),
    });
    if (!derived.ok) throw new Error(derived.error.message);
    const records = new Map(pipeline.records);
    records.set(derived.value.evidence.digest, derived.value.evidence.record);
    return { ...derived.value, definition: derived.value.definitions[0]!, candidate, records };
  }

  it('derives a definition with a complete five-stage chain and content-derived id', () => {
    const derived = definitionFixture();
    expect(derived.definition.definitionId).toMatch(/^docmap:[0-9a-f]{64}$/);
    expect(derived.definition.lifecycle).toBe('provisional');
    expect(derived.definition.evidenceChain.stages.map((link) => link.stage)).toEqual([
      'uploaded',
      'parsed',
      'candidates-extracted',
      'review-pending',
      'provisional',
    ]);
    expect(derived.chain.stages).toHaveLength(DEFINITION_CHAIN_STAGES);
  });

  it('the definition provenance verifies (chain + candidate + attestation)', () => {
    const derived = definitionFixture();
    const verified = verifyDefinitionProvenance(derived.definition, derived.records);
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    // The attestation is the provisional stage evidence digest.
    const provisionalLink = derived.definition.evidenceChain.stages[4]!;
    expect(derived.definition.registration.attestationDigest).toBe(provisionalLink.evidenceDigest);
  });

  it('the definition round-trips through the total parse surface', () => {
    const derived = definitionFixture();
    const round = parseProvisionalAdapterDefinition(
      JSON.parse(JSON.stringify(derived.definition)),
    );
    expect(round.ok).toBe(true);
    if (round.ok) expect(round.value).toEqual(derived.definition);
  });

  it('the registration plan is the deterministic W007 source-category shape', () => {
    const derived = definitionFixture();
    expect(derived.definition.registration.category).toBe('source');
    expect(derived.definition.registration.origin).toBe('provisional-document-derived');
    expect(derived.definition.registration.capabilityId).toBe('docmap.construction.wall');
    expect(derived.definition.registration.version).toBe('1.0.0');
    expect(derived.definition.registration.contracts).toEqual([
      { contractId: 'epoch.document-adapter', contractVersion: '1.0.0' },
    ]);
  });

  it('deriving the same definition twice yields byte-identical artifacts', () => {
    const first = definitionFixture();
    const second = definitionFixture();
    expect(second.definition).toEqual(first.definition);
    expect(second.evidence.digest).toBe(first.evidence.digest);
    expect(second.chain).toEqual(first.chain);
  });
});

describe('provisional registration against the W007 vocabulary (positive)', () => {
  const pipeline = runStagedPipeline(jsonFixture());

  /** A registry that already holds the candidate's upstream capability. */
  function registryWithUpstream(): CapabilityRegistry {
    const registry = new CapabilityRegistry();
    const sealed = sealCapabilityManifest({
      schemaVersion: 1,
      capabilityId: 'construction.geometry',
      category: 'source',
      version: '1.2.0',
      descriptor: {
        displayName: 'Construction geometry source',
        description: 'Upstream fixture capability referenced by the JSON mapping table.',
        inputs: [
          { name: 'source-path', kind: 'string', required: true, description: 'Locator.' },
        ],
        outputs: [
          { name: 'semantic-target', kind: 'string', required: true, description: 'Target.' },
        ],
        assumptions: ['Fixture assumption.'],
      },
      contracts: [],
      trust: { origin: 'first-party' },
    });
    if (!sealed.ok) throw new Error(sealed.error.message);
    const stored = registry.register(sealed.value);
    if (!stored.ok) throw new Error(stored.error.message);
    return registry;
  }

  function registeredFixture() {
    const candidate = wallsCandidate(pipeline);
    const derived = deriveProvisionalDefinitions({
      descriptor: pipeline.descriptor,
      candidates: [candidate],
      chain: chainThroughReview(pipeline),
      run: runContext('provisional'),
    });
    if (!derived.ok) throw new Error(derived.error.message);
    const registry = registryWithUpstream();
    const registration = buildProvisionalRegistration({
      definition: derived.value.definitions[0]!,
      registry,
    });
    if (!registration.ok) throw new Error(registration.error.message);
    return { derived: derived.value, registration: registration.value, registry };
  }

  it('registers into a REAL CapabilityRegistry in the source category with the provisional origin', () => {
    const { registration, registry } = registeredFixture();
    const stored = registry.register(registration);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.value.manifest.category).toBe('source');
    expect(stored.value.manifest.trust.origin).toBe('provisional-document-derived');
    expect(stored.value.manifest.trust.attestationDigest).toBe(
      registration.manifest.trust.attestationDigest,
    );
    expect(stored.value.lifecycle).toBe('registered');
    expect(stored.value.manifestDigest).toBe(registration.digest);
    // The W007 vocabulary is the source-category list of the fabric.
    expect(registry.list({ category: 'source' })).toHaveLength(2);
  });

  it('the manifest descriptor is provider-neutral typed data (ParameterSpec surface)', () => {
    const { registration } = registeredFixture();
    const { descriptor } = registration.manifest;
    expect(descriptor.displayName).toContain('construction:wall');
    expect(descriptor.inputs).toHaveLength(1);
    expect(descriptor.inputs[0]!.kind).toBe('string');
    expect(descriptor.outputs[0]!.name).toBe('semantic-target');
    expect(descriptor.assumptions.length).toBeGreaterThan(0);
  });

  it('an upstream capability reference resolves through the real registry (genuine consumption)', () => {
    const { registration, registry } = registeredFixture();
    const upstream = registry.get({ capabilityId: 'construction.geometry', version: '1.2.0' });
    expect(upstream.ok).toBe(true);
    expect(registration.manifest.capabilityId).not.toBe('construction.geometry');
  });
});

describe('lifecycle state machine (positive)', () => {
  it('advances one stage at a time through the pipeline', () => {
    let current: 'uploaded' | 'parsed' | 'candidates-extracted' | 'review-pending' | 'provisional' =
      'uploaded';
    for (const target of [
      'parsed',
      'candidates-extracted',
      'review-pending',
      'provisional',
    ] as const) {
      const next = advanceExtractionStage({ current, target });
      expect(next.ok).toBe(true);
      if (next.ok) current = next.value;
    }
    expect(current).toBe('provisional');
  });

  it('the provisional stage is terminal (no legal successors)', () => {
    const next = advanceExtractionStage({ current: 'provisional', target: 'provisional' });
    expectFailure(next, 'policy-violation');
  });
});

/** The walls mapping candidate (the one with capabilityRef + properties). */
function wallsCandidate(pipeline: ReturnType<typeof runStagedPipeline>) {
  const candidate = pipeline.candidates.find((c) => c.locator.sourcePath === 'fields.walls');
  if (candidate === undefined) throw new Error('fixture: walls candidate missing');
  return candidate;
}
