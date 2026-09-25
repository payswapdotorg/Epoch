// Determinism (positive battery + the ordering negative): extraction is a
// pure projection over content-addressed documents — identical (document
// bytes, descriptor) derive identical candidates in identical order, and
// NO non-deterministic ordering can leak (sorted iteration everywhere,
// JSON key order irrelevant, document row order irrelevant to the sorted
// candidate output, and the src contains zero wall-clock/randomness).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { canonicalDigest } from '@epoch/agent-protocol';
import {
  deriveDocumentDescriptor,
  deriveProvisionalDefinitions,
  emitStageEvidence,
  extractCandidates,
  parseDocument,
} from '../src/index';
import {
  SCOPE_A,
  chainThroughReview,
  jsonFixture,
  runContext,
  runContextAlt,
  runStagedPipeline,
  textFixture,
} from './fixtures';
import type { DocumentContent } from '../src/index';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('deterministic re-derivation (positive)', () => {
  it('identical (bytes, descriptor) derive identical candidates — twice, byte-for-byte', () => {
    const first = runStagedPipeline(textFixture());
    const second = runStagedPipeline(textFixture());
    expect(second.candidates).toEqual(first.candidates);
    expect(second.candidates.map((candidate) => candidate.candidateId)).toEqual(
      first.candidates.map((candidate) => candidate.candidateId),
    );
  });

  it('identical (bytes, descriptor, run) derive identical evidence — byte-identical digests', () => {
    const first = runStagedPipeline(jsonFixture(), runContext());
    const second = runStagedPipeline(jsonFixture(), runContext());
    expect(
      second.receipts.map((receipt) => receipt.digest),
    ).toEqual(first.receipts.map((receipt) => receipt.digest));
  });

  it('identical inputs derive identical definitions and chains', () => {
    const pipeline = runStagedPipeline(jsonFixture());
    const derive = () =>
      deriveProvisionalDefinitions({
        descriptor: pipeline.descriptor,
        candidates: [pipeline.candidates[0]!],
        chain: chainThroughReview(pipeline),
        run: runContext('provisional'),
      });
    const first = derive();
    const second = derive();
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.definitions.map((d) => d.definitionId)).toEqual(
      first.value.definitions.map((d) => d.definitionId),
    );
    expect(second.value.evidence.digest).toBe(first.value.evidence.digest);
  });

  it('a DIFFERENT run context changes evidence digests but NEVER the candidates', () => {
    const first = runStagedPipeline(textFixture(), runContext());
    const second = runStagedPipeline(textFixture(), runContextAlt());
    expect(second.candidates).toEqual(first.candidates);
    expect(
      second.receipts.map((receipt) => receipt.digest),
    ).not.toEqual(first.receipts.map((receipt) => receipt.digest));
    expect(second.receipts.map((receipt) => receipt.link.stage)).toEqual(
      first.receipts.map((receipt) => receipt.link.stage),
    );
  });

  it('JSON key insertion order never changes the digest (canonicalization)', () => {
    const a: DocumentContent = {
      format: 'structured-json',
      json: { documentKind: 'mapping-table', mappings: [] },
    };
    const b: DocumentContent = {
      format: 'structured-json',
      json: { mappings: [], documentKind: 'mapping-table' },
    };
    expect(canonicalDigest(a.json)).toBe(canonicalDigest(b.json));
    expect(deriveDocumentDescriptor(a, SCOPE_A).digest).toBe(
      deriveDocumentDescriptor(b, SCOPE_A).digest,
    );
  });
});

describe('non-deterministic ordering is structurally impossible (negative assertions)', () => {
  it('candidate output is sorted by candidateId — NOT by document row order', () => {
    const { content, descriptor } = jsonFixture();
    const parsed = parseDocument(content, descriptor);
    if (!parsed.ok) throw new Error(parsed.error.message);
    const candidates = extractCandidates(parsed.value);
    const ids = candidates.map((candidate) => candidate.candidateId);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
    // The sort is by the CONTENT-DERIVED id, so the output order is a
    // property of the mapping content, never of the document row order:
    // reordering the rows (next test) cannot change it.
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reversed mapping rows derive the same mapping CONTENT, each output sorted by id', () => {
    const forward: DocumentContent = {
      format: 'structured-json',
      json: {
        documentKind: 'mapping-table',
        mappings: [
          { sourcePath: 'fields.walls', semanticTarget: 'construction:wall' },
          { sourcePath: 'fields.floors', semanticTarget: 'construction:floor' },
          { sourcePath: 'fields.beams', semanticTarget: 'construction:beam' },
        ],
      },
    };
    const reversed: DocumentContent = {
      format: 'structured-json',
      json: {
        documentKind: 'mapping-table',
        mappings: [
          { sourcePath: 'fields.beams', semanticTarget: 'construction:beam' },
          { sourcePath: 'fields.floors', semanticTarget: 'construction:floor' },
          { sourcePath: 'fields.walls', semanticTarget: 'construction:wall' },
        ],
      },
    };
    // Reordered arrays are DIFFERENT documents (different digests), so
    // candidate ids differ — but the derived mapping content per source
    // path is identical, and each output is independently sorted by id:
    // no document row order can leak into the output ordering.
    const forwardParsed = parseDocument(forward, deriveDocumentDescriptor(forward, SCOPE_A));
    const reversedParsed = parseDocument(reversed, deriveDocumentDescriptor(reversed, SCOPE_A));
    if (!forwardParsed.ok || !reversedParsed.ok) throw new Error('fixture');
    const forwardCandidates = extractCandidates(forwardParsed.value);
    const reversedCandidates = extractCandidates(reversedParsed.value);
    expect(forwardCandidates.map((c) => c.candidateId)).toEqual(
      [...forwardCandidates.map((c) => c.candidateId)].sort(),
    );
    expect(reversedCandidates.map((c) => c.candidateId)).toEqual(
      [...reversedCandidates.map((c) => c.candidateId)].sort(),
    );
    const key = (c: (typeof forwardCandidates)[number]) => `${c.locator.sourcePath}:${c.semanticTarget}`;
    expect(reversedCandidates.map(key).sort()).toEqual(forwardCandidates.map(key).sort());
    expect(forwardCandidates).toHaveLength(3);
  });

  it('the src contains zero wall-clock reads and zero randomness', () => {
    const forbidden = [
      /Date\.now\s*\(/,
      /new\s+Date\s*\(/,
      /Math\.random\s*\(/,
      /crypto\.randomUUID\s*\(/,
      /performance\.now\s*\(/,
    ];
    const files = [
      'canonical.ts',
      'evidence.ts',
      'extract.ts',
      'lifecycle.ts',
      'provenance.ts',
      'registration.ts',
      'version.ts',
      'schema.ts',
      'parse.ts',
      'errors.ts',
      'issues.ts',
    ];
    for (const file of files) {
      const source = readFileSync(path.resolve(here, '..', 'src', file), 'utf8');
      for (const pattern of forbidden) {
        // Comments/doc text mentioning the ban are fine; only executable
        // call sites are forbidden. Cheap guard: strip block/line comments.
        const stripped = source
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '');
        expect(stripped.match(pattern), `${file}: ${pattern}`).toBeNull();
      }
    }
  });

  it('stage evidence payloads are pure functions of their typed inputs', () => {
    const { descriptor } = textFixture();
    const run = runContext();
    const first = emitStageEvidence({ stage: 'uploaded', descriptor, run });
    const second = emitStageEvidence({ stage: 'uploaded', descriptor, run });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.digest).toBe(first.value.digest);
    expect(second.value.record).toEqual(first.value.record);
  });
});
