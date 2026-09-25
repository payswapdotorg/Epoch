// Tenant isolation (negative — R12): cross-tenant admission is denied
// with typed `cross-tenant-denied` errors everywhere a tenant boundary
// can be crossed: descriptor admission, document parsing, candidate and
// chain provenance, and definition verification.
import { describe, expect, it } from 'vitest';
import {
  admitDocumentDescriptor,
  deriveDocumentDescriptor,
  deriveProvisionalDefinitions,
  parseDocument,
  parseDocumentDescriptor,
  parseExtractionCandidate,
  parseProvisionalAdapterDefinition,
  verifyCandidateProvenance,
  verifyDefinitionProvenance,
} from '../src/index';
import {
  SCOPE_B,
  TENANT_A,
  TENANT_B,
  chainThroughReview,
  expectFailure,
  jsonFixture,
  runContext,
  runStagedPipeline,
  textFixture,
} from './fixtures';

describe('tenant gate (negative — cross-tenant access is denied)', () => {
  it('rejects a descriptor admitted for another tenant', () => {
    const { descriptor } = textFixture();
    const error = expectFailure(
      admitDocumentDescriptor(descriptor, { expectedTenantId: TENANT_B }),
      'cross-tenant-denied',
    );
    expect(error.expectedTenantId).toBe(TENANT_B);
    expect(error.encounteredTenantId).toBe(TENANT_A);
    expect(error.path).toEqual(['tenantScope', 'tenantId']);
  });

  it('rejects a descriptor parsed for another tenant', () => {
    const { descriptor } = textFixture();
    const error = expectFailure(
      parseDocumentDescriptor(descriptor, { expectedTenantId: TENANT_B }),
      'cross-tenant-denied',
    );
    expect(error.encounteredTenantId).toBe('tenant:alpha');
  });

  it('rejects a document parsed for another tenant', () => {
    const { content, descriptor } = jsonFixture();
    const error = expectFailure(
      parseDocument(content, descriptor, { expectedTenantId: TENANT_B }),
      'cross-tenant-denied',
    );
    expect(error.path).toEqual(['tenantScope', 'tenantId']);
  });

  it('rejects a candidate parsed for another tenant', () => {
    const pipeline = runStagedPipeline(jsonFixture());
    const candidate = JSON.parse(
      JSON.stringify(pipeline.candidates[0]),
    ) as typeof pipeline.candidates[number];
    const error = expectFailure(
      parseExtractionCandidate(candidate, { expectedTenantId: TENANT_B }),
      'cross-tenant-denied',
    );
    expect(error.encounteredTenantId).toBe(TENANT_A);
  });

  it('rejects a candidate whose tenant scope disagrees with its chain (provenance gate)', () => {
    const pipeline = runStagedPipeline(jsonFixture());
    const chain = {
      schemaVersion: 1 as const,
      documentDigest: pipeline.descriptor.digest,
      tenantScope: pipeline.descriptor.tenantScope,
      stages: pipeline.receipts.map((receipt) => receipt.link),
    };
    const foreignCandidate = {
      ...pipeline.candidates[0]!,
      tenantScope: SCOPE_B,
    };
    const error = expectFailure(
      verifyCandidateProvenance(foreignCandidate, chain, pipeline.records),
      'cross-tenant-denied',
    );
    expect(error.expectedTenantId).toBe(TENANT_A);
    expect(error.encounteredTenantId).toBe(TENANT_B);
    expect(error.path).toEqual(['candidate', 'tenantScope', 'tenantId']);
  });

  it('rejects a definition whose tenant scope disagrees with its chain', () => {
    const pipeline = runStagedPipeline(jsonFixture());
    const derived = deriveProvisionalDefinitions({
      descriptor: pipeline.descriptor,
      candidates: [pipeline.candidates[0]!],
      chain: chainThroughReview(pipeline),
      run: runContext('provisional'),
    });
    if (!derived.ok) throw new Error(derived.error.message);
    const records = new Map(pipeline.records);
    records.set(derived.value.evidence.digest, derived.value.evidence.record);
    const forged = {
      ...derived.value.definitions[0]!,
      tenantScope: SCOPE_B,
    };
    const error = expectFailure(verifyDefinitionProvenance(forged, records), 'cross-tenant-denied');
    expect(error.expectedTenantId).toBe(TENANT_A);
    expect(error.encounteredTenantId).toBe(TENANT_B);
  });

  it('rejects a definition parsed for another tenant', () => {
    const pipeline = runStagedPipeline(jsonFixture());
    const derived = deriveProvisionalDefinitions({
      descriptor: pipeline.descriptor,
      candidates: [pipeline.candidates[0]!],
      chain: chainThroughReview(pipeline),
      run: runContext('provisional'),
    });
    if (!derived.ok) throw new Error(derived.error.message);
    const serialized = JSON.parse(JSON.stringify(derived.value.definitions[0]!));
    const error = expectFailure(
      parseProvisionalAdapterDefinition(serialized, { expectedTenantId: TENANT_B }),
      'cross-tenant-denied',
    );
    expect(error.encounteredTenantId).toBe(TENANT_A);
  });

  it('same-tenant admission succeeds (the gate opens only for the owner)', () => {
    const { content, descriptor } = textFixture();
    const admitted = admitDocumentDescriptor(descriptor, { expectedTenantId: TENANT_A });
    expect(admitted.ok).toBe(true);
    const parsed = parseDocument(content, descriptor, { expectedTenantId: TENANT_A });
    expect(parsed.ok).toBe(true);
  });

  it('a document genuinely owned by tenant B admits for tenant B', () => {
    const content = { format: 'structured-text', text: 'fields.x -> demo:thing' } as const;
    const descriptor = deriveDocumentDescriptor(content, SCOPE_B);
    const admitted = admitDocumentDescriptor(descriptor, { expectedTenantId: TENANT_B });
    expect(admitted.ok).toBe(true);
  });
});
