// Contract surface completeness: the published schema surface covers the
// complete versioned data-type inventory, the surface entries resolve to
// distinct validators, and the package's public API re-exports the
// contract constants coherently.
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EVIDENCE_KINDS } from '@epoch/evidence';
import {
  DOCUMENT_ADAPTER_CONTRACT_VERSION,
  DOCUMENT_ADAPTER_ERROR_CODES,
  DOCUMENT_ADAPTER_SCHEMA_SURFACE,
  DOCUMENT_DERIVED_TRUST_CLASS,
  DOCUMENT_FORMATS,
  DOCUMENT_RECORD_VERSION,
  EXTRACTION_STAGE_KINDS,
  PROVISIONAL_CAPABILITY_CATEGORY,
  PROVISIONAL_CAPABILITY_ORIGIN,
  PROVISIONAL_LIFECYCLE_TRANSITIONS,
  STAGE_EVIDENCE_KINDS,
  TRUST_ESCALATION_OPS,
} from '../src/index';

describe('contract surface (schema surface inventory)', () => {
  it('the surface is sorted and duplicate-free', () => {
    const types = DOCUMENT_ADAPTER_SCHEMA_SURFACE.map((entry) => entry.type);
    expect([...types].sort((a, b) => a.localeCompare(b))).toEqual(types as string[]);
    expect(new Set(types).size).toBe(types.length);
  });

  it('every surface entry is a zod validator that emits a JSON Schema', () => {
    for (const entry of DOCUMENT_ADAPTER_SCHEMA_SURFACE) {
      expect(() => z.toJSONSchema(entry.schema, { target: 'draft-2020-12' })).not.toThrow();
    }
  });

  it('the core derivation types are on the surface', () => {
    const types = new Set(DOCUMENT_ADAPTER_SCHEMA_SURFACE.map((entry) => entry.type));
    for (const required of [
      'DocumentDescriptor',
      'DocumentContent',
      'ExtractionCandidate',
      'StageEvidenceChain',
      'ProvisionalAdapterDefinition',
      'ProvisionalRegistrationPlan',
      'TenantScope',
    ]) {
      expect(types.has(required), `surface is missing ${required}`).toBe(true);
    }
  });
});

describe('contract vocabulary coherence', () => {
  it('the pipeline is exactly the five binding stages, terminal at provisional', () => {
    expect(EXTRACTION_STAGE_KINDS).toEqual([
      'uploaded',
      'parsed',
      'candidates-extracted',
      'review-pending',
      'provisional',
    ]);
    expect(PROVISIONAL_LIFECYCLE_TRANSITIONS.provisional).toEqual([]);
    for (const stage of EXTRACTION_STAGE_KINDS.slice(0, 4)) {
      const successors = PROVISIONAL_LIFECYCLE_TRANSITIONS[stage];
      expect(successors).toHaveLength(1);
      expect(successors[0]).toBe(EXTRACTION_STAGE_KINDS[EXTRACTION_STAGE_KINDS.indexOf(stage) + 1]);
    }
  });

  it('every stage evidence kind is a closed W006 evidence kind', () => {
    for (const stage of EXTRACTION_STAGE_KINDS) {
      expect(EVIDENCE_KINDS).toContain(STAGE_EVIDENCE_KINDS[stage]);
    }
    expect(STAGE_EVIDENCE_KINDS['candidates-extracted']).toBe('computation');
    expect(STAGE_EVIDENCE_KINDS.uploaded).toBe('document');
  });

  it('the trust floor is fixed at t1 with the three denied ops', () => {
    expect(DOCUMENT_DERIVED_TRUST_CLASS).toBe('t1');
    expect(TRUST_ESCALATION_OPS).toEqual(['certify', 'execute', 'grant-capability']);
  });

  it('the W007 registration vocabulary pins source + provisional-document-derived', () => {
    expect(PROVISIONAL_CAPABILITY_CATEGORY).toBe('source');
    expect(PROVISIONAL_CAPABILITY_ORIGIN).toBe('provisional-document-derived');
  });

  it('the error-code taxonomy is exactly the W028 Tech Lead pin', () => {
    expect([...DOCUMENT_ADAPTER_ERROR_CODES].sort()).toEqual(
      [
        'broken-evidence-chain',
        'cross-tenant-denied',
        'digest-mismatch',
        'malformed-document',
        'policy-violation',
        'trust-escalation-denied',
        'unknown-capability-reference',
        'unsupported-format',
      ].sort(),
    );
  });

  it('the format vocabulary is exactly the two deterministic forms', () => {
    expect(DOCUMENT_FORMATS).toEqual(['structured-text', 'structured-json']);
    expect(DOCUMENT_RECORD_VERSION).toBe(1);
    expect(DOCUMENT_ADAPTER_CONTRACT_VERSION).toBe('1.0.0');
  });
});
