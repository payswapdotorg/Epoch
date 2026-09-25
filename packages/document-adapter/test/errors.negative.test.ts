// Document admission failures (negative): unsupported formats, digest
// mismatches/tampering, malformed documents with PRECISE paths, vendor
// field rejection (strict objects + a named blocklist assertion), trust
// escalation denials, and dangling capability references.
import { describe, expect, it } from 'vitest';
import { CapabilityRegistry } from '@epoch/capability-registry';
import {
  TRUST_ESCALATION_OPS,
  DOCUMENT_DERIVED_TRUST_CLASS,
  PROVISIONAL_TRUST_CEILING,
  admitDocumentContent,
  admitDocumentDescriptor,
  advanceExtractionStage,
  buildProvisionalRegistration,
  deriveDocumentDescriptor,
  deriveProvisionalDefinitions,
  deriveRegistrationPlan,
  parseDocument,
  parseDocumentDescriptor,
  requestTrustEscalation,
} from '../src/index';
import { SCOPE_A, jsonFixture, textFixture, expectFailure, runContext, runStagedPipeline, chainThroughReview } from './fixtures';
import type { DocumentContent } from '../src/index';

describe('unsupported format (negative)', () => {
  it('rejects a document content whose format is outside the closed vocabulary', () => {
    const error = expectFailure(
      admitDocumentContent({ format: 'pdf', text: 'whatever' }),
      'unsupported-format',
    );
    expect(error.format).toBe('pdf');
    expect(error.supportedFormats).toEqual(['structured-text', 'structured-json']);
    expect(error.message).toContain('future adapter work');
  });

  it('rejects a serialized descriptor whose format is outside the closed vocabulary', () => {
    const { descriptor } = textFixture();
    const forged = { ...descriptor, format: 'office-document' };
    const error = expectFailure(admitDocumentDescriptor(forged), 'unsupported-format');
    expect(error.format).toBe('office-document');
  });

  it('rejects an absent format with the same typed error', () => {
    const error = expectFailure(admitDocumentContent({ text: 'x' }), 'unsupported-format');
    expect(error.format).toBe('undefined');
  });
});

describe('digest mismatch / tamper (negative)', () => {
  it('rejects a descriptor whose digest claim does not match the actual content', () => {
    const { content, descriptor } = textFixture();
    const tampered = { ...descriptor, digest: 'f'.repeat(64) };
    const error = expectFailure(parseDocument(content, tampered), 'digest-mismatch');
    expect(error.expected).toBe(descriptor.digest);
    expect(error.encountered).toBe('f'.repeat(64));
    expect(error.path).toEqual(['digest']);
  });

  it('rejects content that changed after the descriptor was derived (tamper)', () => {
    const { content, descriptor } = jsonFixture();
    const tamperedContent: DocumentContent = {
      format: 'structured-json',
      json: { ...(content as { json: object }).json, extra: 'tampered' },
    };
    expectFailure(parseDocument(tamperedContent, descriptor), 'digest-mismatch');
  });

  it('rejects a byte-length claim that disagrees with the canonical bytes', () => {
    const { content, descriptor } = textFixture();
    const forged = { ...descriptor, byteLength: descriptor.byteLength + 7 };
    const error = expectFailure(parseDocument(content, forged), 'malformed-document');
    expect(error.issues[0]!.path).toBe('byteLength');
  });
});

describe('malformed documents with precise paths (negative)', () => {
  it('rejects a malformed text mapping line with the exact 1-based line path', () => {
    const text = ['fields.ok -> construction:wall', 'this line is garbage'].join('\n');
    const content: DocumentContent = { format: 'structured-text', text };
    const descriptor = deriveDescriptor(content);
    const error = expectFailure(parseDocument(content, descriptor), 'malformed-document');
    expect(error.issues[0]!.path).toBe('lines[2]');
    expect(error.issues[0]!.message).toContain('grammar');
  });

  it('rejects a text document with no mapping lines at root path', () => {
    const content: DocumentContent = { format: 'structured-text', text: '# only comments\n\n' };
    const descriptor = deriveDescriptor(content);
    const error = expectFailure(parseDocument(content, descriptor), 'malformed-document');
    expect(error.issues[0]!.path).toBe('$');
  });

  it('rejects a bad semantic target in a text mapping line', () => {
    const text = 'fields.walls -> Construction:Wall';
    const content: DocumentContent = { format: 'structured-text', text };
    const descriptor = deriveDescriptor(content);
    const error = expectFailure(parseDocument(content, descriptor), 'malformed-document');
    expect(error.issues[0]!.path).toBe('lines[1]');
  });

  it('rejects a JSON document whose root is not an object', () => {
    const content: DocumentContent = { format: 'structured-json', json: ['not', 'an', 'object'] };
    const descriptor = deriveDescriptor(content);
    const error = expectFailure(parseDocument(content, descriptor), 'malformed-document');
    expect(error.issues[0]!.path).toBe('$');
  });

  it('rejects a JSON document with the wrong documentKind at the exact path', () => {
    const content: DocumentContent = {
      format: 'structured-json',
      json: { documentKind: 'something-else', mappings: [] },
    };
    const descriptor = deriveDescriptor(content);
    const error = expectFailure(parseDocument(content, descriptor), 'malformed-document');
    expect(error.issues[0]!.path).toBe('documentKind');
  });

  it('rejects a JSON mapping with a malformed semanticTarget at the exact JSON path', () => {
    const content: DocumentContent = {
      format: 'structured-json',
      json: {
        documentKind: 'mapping-table',
        mappings: [
          { sourcePath: 'fields.walls', semanticTarget: 'construction:wall' },
          { sourcePath: 'fields.floors', semanticTarget: 'NOT-A-KEY' },
        ],
      },
    };
    const descriptor = deriveDescriptor(content);
    const error = expectFailure(parseDocument(content, descriptor), 'malformed-document');
    expect(error.issues[0]!.path).toBe('mappings[1].semanticTarget');
  });

  it('rejects a JSON mapping with malformed property mappings at nested paths', () => {
    const content: DocumentContent = {
      format: 'structured-json',
      json: {
        documentKind: 'mapping-table',
        mappings: [
          {
            sourcePath: 'fields.walls',
            semanticTarget: 'construction:wall',
            propertyMappings: [{ sourceProperty: 'ok', semanticProperty: 42 }],
          },
        ],
      },
    };
    const descriptor = deriveDescriptor(content);
    const error = expectFailure(parseDocument(content, descriptor), 'malformed-document');
    expect(error.issues[0]!.path).toBe('mappings[0].propertyMappings[0].semanticProperty');
  });

  it('rejects an out-of-range confidence at the exact path', () => {
    const content: DocumentContent = {
      format: 'structured-json',
      json: {
        documentKind: 'mapping-table',
        mappings: [{ sourcePath: 'fields.walls', semanticTarget: 'construction:wall', confidence: 1.5 }],
      },
    };
    const descriptor = deriveDescriptor(content);
    const error = expectFailure(parseDocument(content, descriptor), 'malformed-document');
    expect(error.issues[0]!.path).toBe('mappings[0].confidence');
  });

  it('rejects a malformed capabilityRef at the exact nested path', () => {
    const content: DocumentContent = {
      format: 'structured-json',
      json: {
        documentKind: 'mapping-table',
        mappings: [
          {
            sourcePath: 'fields.walls',
            semanticTarget: 'construction:wall',
            capabilityRef: { id: 'Not Qualified', version: '1.2.0' },
          },
        ],
      },
    };
    const descriptor = deriveDescriptor(content);
    const error = expectFailure(parseDocument(content, descriptor), 'malformed-document');
    expect(error.issues[0]!.path).toBe('mappings[0].capabilityRef.id');
  });

  it('rejects a malformed serialized descriptor with a version-skew issue at schemaVersion', () => {
    const { descriptor } = textFixture();
    const error = expectFailure(
      parseDocumentDescriptor({ ...descriptor, schemaVersion: 2 }),
      'malformed-document',
    );
    expect(error.issues[0]!.path).toBe('schemaVersion');
  });
});

describe('vendor/provider field rejection (blocklist, negative)', () => {
  it('rejects an unknown vendor field on a serialized descriptor (strict object)', () => {
    const { descriptor } = jsonFixture();
    const poisoned = { ...descriptor, provider: 'a-vendor-document-service' };
    const error = expectFailure(admitDocumentDescriptor(poisoned), 'malformed-document');
    expect(JSON.stringify(error.issues)).toContain('provider');
  });

  it('rejects unknown vendor fields on a serialized document content', () => {
    const error = expectFailure(
      admitDocumentContent({ format: 'structured-text', text: 'a -> x:y', apiKey: 'sk-123' }),
      'malformed-document',
    );
    expect(JSON.stringify(error.issues)).toContain('apiKey');
  });

  it('rejects unknown vendor fields on JSON mapping entries (strict row shape)', () => {
    const content: DocumentContent = {
      format: 'structured-json',
      json: {
        documentKind: 'mapping-table',
        mappings: [
          {
            sourcePath: 'fields.walls',
            semanticTarget: 'construction:wall',
            vendorService: 'acme-documents',
          },
        ],
      },
    };
    const descriptor = deriveDescriptor(content);
    expectFailure(parseDocument(content, descriptor), 'malformed-document');
  });

  it('rejects a vendor-provided blob URL inside a text document as a grammar violation', () => {
    const content: DocumentContent = {
      format: 'structured-text',
      text: 'https://vendor.example/documents/123 -> construction:wall',
    };
    const descriptor = deriveDescriptor(content);
    expectFailure(parseDocument(content, descriptor), 'malformed-document');
  });
});

describe('trust escalation denied (negative — the floor, always)', () => {
  it('denies every escalation op with the typed rejection', () => {
    for (const op of TRUST_ESCALATION_OPS) {
      const error = expectFailure({ ok: false, error: requestTrustEscalation({ op }) }, 'trust-escalation-denied');
      expect(error.op).toBe(op);
      expect(error.currentTrustClass).toBe(DOCUMENT_DERIVED_TRUST_CLASS);
      expect(error.ceiling).toBe(PROVISIONAL_TRUST_CEILING);
      expect(error.message).toContain('provisional by construction');
    }
  });

  it('the denial is total: it does not consult the registry, policy, or scores', () => {
    const first = requestTrustEscalation({ op: 'certify' });
    const second = requestTrustEscalation({ op: 'certify' });
    expect(first).toEqual(second);
  });
});

describe('unknown capability reference (negative)', () => {
  it('rejects a candidate whose upstream capability does not resolve in the registry', () => {
    const pipeline = runStagedPipeline(jsonFixture());
    const derived = deriveProvisionalDefinitions({
      descriptor: pipeline.descriptor,
      candidates: [wallsCandidate(pipeline)],
      chain: chainThroughReview(pipeline),
      run: runContext('provisional'),
    });
    if (!derived.ok) throw new Error(derived.error.message);
    // An EMPTY registry: the upstream reference dangles.
    const registration = buildProvisionalRegistration({
      definition: derived.value.definitions[0]!,
      registry: new CapabilityRegistry(),
    });
    const error = expectFailure(registration, 'unknown-capability-reference');
    expect(error.capabilityId).toBe('construction.geometry');
    expect(error.version).toBe('1.2.0');
    expect(error.path).toEqual(['candidate', 'capabilityRef']);
  });
});

describe('registration policy violations (negative)', () => {
  it('rejects a registration plan whose category is not the source category', () => {
    const pipeline = runStagedPipeline(jsonFixture());
    const plan = deriveRegistrationPlan({
      candidate: wallsCandidate(pipeline),
      attestationDigest: pipeline.descriptor.digest,
    });
    const forged = {
      ...definitionFromPipeline(),
      registration: { ...plan, category: 'simulation' },
    };
    const error = expectFailure(
      buildProvisionalRegistration({ definition: forged as never }),
      'policy-violation',
    );
    expect(error.rule).toBe('registration-category');
    expect(error.path).toEqual(['registration', 'category']);
  });

  it('rejects a registration plan whose origin is not provisional-document-derived', () => {
    const pipeline = runStagedPipeline(jsonFixture());
    const plan = deriveRegistrationPlan({
      candidate: wallsCandidate(pipeline),
      attestationDigest: pipeline.descriptor.digest,
    });
    const forged = {
      ...definitionFromPipeline(),
      registration: { ...plan, origin: 'first-party' },
    };
    const error = expectFailure(
      buildProvisionalRegistration({ definition: forged as never }),
      'policy-violation',
    );
    expect(error.rule).toBe('registration-origin');
  });

  it('rejects a registration plan with a non-semver version at admission (schema discipline)', () => {
    const pipeline = runStagedPipeline(jsonFixture());
    const plan = deriveRegistrationPlan({
      candidate: wallsCandidate(pipeline),
      attestationDigest: pipeline.descriptor.digest,
    });
    const forged = {
      ...definitionFromPipeline(),
      registration: { ...plan, version: 'latest' },
    };
    const error = expectFailure(
      buildProvisionalRegistration({ definition: forged as never }),
      'malformed-document',
    );
    expect(error.issues[0]!.path).toBe('registration.version');
  });
});

describe('lifecycle policy violations (negative)', () => {
  it('rejects a stage skip', () => {
    const error = expectFailure(
      advanceExtractionStage({ current: 'uploaded', target: 'candidates-extracted' }),
      'policy-violation',
    );
    expect(error.rule).toBe('lifecycle-transition');
    expect(error.message).toContain('uploaded');
  });

  it('rejects a stage regression', () => {
    expectFailure(
      advanceExtractionStage({ current: 'review-pending', target: 'parsed' }),
      'policy-violation',
    );
  });

  it('rejects reviving the terminal provisional stage', () => {
    expectFailure(advanceExtractionStage({ current: 'provisional', target: 'uploaded' }), 'policy-violation');
  });
});

function deriveDescriptor(content: DocumentContent) {
  return deriveDocumentDescriptor(content, SCOPE_A);
}

function definitionFromPipeline() {
  const pipeline = runStagedPipeline(jsonFixture());
  const derived = deriveProvisionalDefinitions({
    descriptor: pipeline.descriptor,
    candidates: [wallsCandidate(pipeline)],
    chain: chainThroughReview(pipeline),
    run: runContext('provisional'),
  });
  if (!derived.ok) throw new Error(derived.error.message);
  return derived.value.definitions[0]!;
}

/** The walls mapping candidate (carries the upstream capabilityRef). */
function wallsCandidate(pipeline: ReturnType<typeof runStagedPipeline>) {
  const candidate = pipeline.candidates.find((c) => c.locator.sourcePath === 'fields.walls');
  if (candidate === undefined) throw new Error('fixture: walls candidate missing');
  return candidate;
}
