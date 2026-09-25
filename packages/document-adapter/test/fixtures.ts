/**
 * Test fixtures: deterministic builders for valid documents, descriptors,
 * run contexts, and the staged derivation pipeline used across the
 * positive/negative batteries. Everything is typed data — no wall-clock,
 * no randomness.
 */
import { createHash } from 'node:crypto';
import type { JsonValue } from '@epoch/agent-protocol';
import {
  chainPrefix,
  deriveDocumentDescriptor,
  emitStageEvidence,
  extractCandidates,
  parseDocument,
} from '../src/index';
import type {
  DocumentAdapterError,
  DocumentContent,
  DocumentDescriptor,
  ExtractionCandidate,
  ParsedDocument,
  StageEvidenceReceipt,
  StageRunContext,
  TenantScope,
} from '../src/index';

/** The typed shape of one typed-error variant. */
export type TypedError<C extends DocumentAdapterError['code']> = Extract<
  DocumentAdapterError,
  { code: C }
>;

/**
 * Test helper: assert a result is a typed failure of exactly `code` and
 * return the narrowed error (throws descriptive errors otherwise, so test
 * failures remain readable).
 */
export function expectFailure<C extends DocumentAdapterError['code']>(
  result: { readonly ok: false; readonly error: DocumentAdapterError } | { readonly ok: true },
  code: C,
): TypedError<C> {
  if (result.ok) {
    throw new Error(`expected a typed "${code}" failure, got a success`);
  }
  if (result.error.code !== code) {
    throw new Error(
      `expected a typed "${code}" failure, got "${result.error.code}": ${result.error.message}`,
    );
  }
  return result.error as TypedError<C>;
}

export const TENANT_A = 'tenant:alpha';
export const TENANT_B = 'tenant:beta';

export const SCOPE_A: TenantScope = {
  tenantId: TENANT_A,
  workspaceId: 'workspace:alpha-eng',
  projectId: 'project:alpha-tower',
};

export const SCOPE_B: TenantScope = {
  tenantId: TENANT_B,
};

/** A fixed, deterministic run context (host-supplied typed data). */
export function runContext(tag = 'run-1'): StageRunContext {
  return {
    runId: `run:${tag}`,
    actorId: 'principal:test-operator',
    methodId: 'epoch.document-adapter.derive',
    observedAt: '2026-01-05T09:00:00.000Z',
  };
}

/** A second, different-but-valid run context (determinism negative). */
export function runContextAlt(): StageRunContext {
  return {
    runId: 'run:other',
    actorId: 'principal:another-operator',
    observedAt: '2026-02-05T18:30:00.000Z',
  };
}

/** The canonical structured-text mapping-table fixture. */
export const TEXT_DOCUMENT = [
  '# Epoch document mapping table',
  'fields.walls -> construction:wall [confidence 0.9]',
  'fields.floors -> construction:floor',
  'fields.beams -> construction:beam [confidence 0.75]',
].join('\n');

/** The canonical structured-json mapping-table fixture. */
export const JSON_DOCUMENT: JsonValue = {
  documentKind: 'mapping-table',
  mappings: [
    {
      sourcePath: 'fields.walls',
      semanticTarget: 'construction:wall',
      propertyMappings: [
        { sourceProperty: 'thickness', semanticProperty: 'thickness' },
        { sourceProperty: 'material', semanticProperty: 'material' },
      ],
      confidence: 0.9,
      capabilityRef: { id: 'construction.geometry', version: '1.2.0' },
    },
    {
      sourcePath: 'fields.floors',
      semanticTarget: 'construction:floor',
    },
  ],
};

/** Text content + derived descriptor for tenant A. */
export function textFixture(): { content: DocumentContent; descriptor: DocumentDescriptor } {
  const content: DocumentContent = { format: 'structured-text', text: TEXT_DOCUMENT };
  return { content, descriptor: deriveDocumentDescriptor(content, SCOPE_A) };
}

/** JSON content + derived descriptor for tenant A. */
export function jsonFixture(): { content: DocumentContent; descriptor: DocumentDescriptor } {
  const content: DocumentContent = {
    format: 'structured-json',
    json: JSON_DOCUMENT,
  };
  return { content, descriptor: deriveDocumentDescriptor(content, SCOPE_A) };
}

/** Cross-check the kernel digest against node:crypto (W001-style evidence). */
export function nodeCryptoSha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Drive the full staged pipeline over a fixture (deterministic): parse,
 * extract, verify, and emit one evidence record per stage with the SAME
 * run context. Returns every artifact the batteries need.
 */
export interface StagedPipeline {
  readonly descriptor: DocumentDescriptor;
  readonly parsed: ParsedDocument;
  readonly candidates: readonly ExtractionCandidate[];
  readonly receipts: readonly StageEvidenceReceipt[];
  readonly records: ReadonlyMap<string, unknown>;
}

export function runStagedPipeline(
  fixture: { content: DocumentContent; descriptor: DocumentDescriptor },
  run: StageRunContext = runContext(),
): StagedPipeline {
  const { content, descriptor } = fixture;
  const parsed = parseDocument(content, descriptor);
  if (!parsed.ok) throw new Error(`fixture failed to parse: ${parsed.error.message}`);
  const candidates = extractCandidates(parsed.value);
  const receipts: StageEvidenceReceipt[] = [];

  const uploaded = emitStageEvidence({ stage: 'uploaded', descriptor, run });
  if (!uploaded.ok) throw new Error(uploaded.error.message);
  receipts.push(uploaded.value);

  const parsedStage = emitStageEvidence({
    stage: 'parsed',
    descriptor,
    run,
    detail: { mappingCount: parsed.value.rows.length },
  });
  if (!parsedStage.ok) throw new Error(parsedStage.error.message);
  receipts.push(parsedStage.value);

  const extracted = emitStageEvidence({
    stage: 'candidates-extracted',
    descriptor,
    run,
    detail: { candidateIds: candidates.map((candidate) => candidate.candidateId) },
  });
  if (!extracted.ok) throw new Error(extracted.error.message);
  receipts.push(extracted.value);

  const review = emitStageEvidence({
    stage: 'review-pending',
    descriptor,
    run,
    detail: { candidateIds: candidates.map((candidate) => candidate.candidateId) },
  });
  if (!review.ok) throw new Error(review.error.message);
  receipts.push(review.value);

  const records = new Map<string, unknown>();
  for (const receipt of receipts) {
    records.set(receipt.digest, receipt.record);
  }
  return { descriptor, parsed: parsed.value, candidates, receipts, records };
}

/** The four-stage chain (uploaded .. review-pending) of a pipeline run. */
export function chainThroughReview(pipeline: StagedPipeline) {
  return chainPrefix(
    pipeline.descriptor,
    pipeline.receipts.map((receipt) => receipt.link),
  );
}
