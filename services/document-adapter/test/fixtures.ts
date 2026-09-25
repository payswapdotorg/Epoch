/**
 * Host test fixtures: deterministic documents, run contexts, and a
 * complete pipeline driver. Everything is typed data — no wall-clock,
 * no randomness.
 */
import {
  DocumentAdapterHost,
  type DocumentAdapterHost as Host,
  type HostResult,
} from '../src/index';
import type { JsonValue } from '@epoch/agent-protocol';
import {
  deriveDocumentDescriptor,
  type DocumentContent,
  type DocumentDescriptor,
  type ExtractionStageKind,
  type StageRunContext,
} from '@epoch/document-adapter';
import type {
  IngestDocumentInput,
  IngestionReceipt,
  SessionId,
  StageAdvance,
} from '../src/index';

export const TENANT_A = 'tenant:alpha';
export const TENANT_B = 'tenant:beta';

/** A fixed, deterministic run context (host-supplied typed data). */
export function runContext(tag = 'run-1'): StageRunContext {
  return {
    runId: `run:${tag}`,
    actorId: 'principal:test-operator',
    methodId: 'epoch.document-adapter-host.derive',
    observedAt: '2026-01-05T09:00:00.000Z',
  };
}

/** A second, different-but-valid run context. */
export function runContextAlt(): StageRunContext {
  return {
    runId: 'run:other',
    actorId: 'principal:another-operator',
    observedAt: '2026-02-05T18:30:00.000Z',
  };
}

/** The canonical JSON mapping-table document (two candidates). */
export const JSON_DOCUMENT: JsonValue = {
  documentKind: 'mapping-table',
  mappings: [
    {
      sourcePath: 'fields.walls',
      semanticTarget: 'construction:wall',
      propertyMappings: [
        { sourceProperty: 'thickness', semanticProperty: 'thickness' },
      ],
      confidence: 0.9,
    },
    {
      sourcePath: 'fields.floors',
      semanticTarget: 'construction:floor',
    },
  ],
};

/** The canonical text mapping-table document (three candidates). */
export const TEXT_DOCUMENT = [
  '# Epoch document mapping table',
  'fields.walls -> construction:wall [confidence 0.9]',
  'fields.floors -> construction:floor',
  'fields.beams -> construction:beam [confidence 0.75]',
].join('\n');

/** Build the (content, descriptor) pair of a text document. */
export function textDocument(): {
  content: unknown;
  descriptor: DocumentDescriptor;
} {
  const content: DocumentContent = { format: 'structured-text', text: TEXT_DOCUMENT };
  return { content, descriptor: deriveDocumentDescriptor(content, { tenantId: TENANT_A }) };
}

/** Build the (content, descriptor) pair of a JSON document. */
export function jsonDocument(): { content: unknown; descriptor: DocumentDescriptor } {
  const content: DocumentContent = {
    format: 'structured-json',
    json: JSON_DOCUMENT,
  };
  return { content, descriptor: deriveDocumentDescriptor(content, { tenantId: TENANT_A }) };
}

/** The default ingestion input for a document pair. */
export function ingestInput(
  document: { content: unknown; descriptor: DocumentDescriptor },
  key = 'upload-001',
  run = runContext(),
): IngestDocumentInput {
  return {
    content: document.content,
    descriptor: document.descriptor,
    asTenant: document.descriptor.tenantScope.tenantId,
    idempotencyKey: key,
    run,
  };
}

/** Ingest or throw (positive-path helper). */
export function mustIngest(
  host: Host,
  document: { content: unknown; descriptor: DocumentDescriptor },
  key = 'upload-001',
): IngestionReceipt {
  const receipt = host.ingestDocument(ingestInput(document, key));
  if (!receipt.ok) throw new Error(receipt.error.message);
  return receipt.value;
}

/** Advance one stage or throw (positive-path helper). */
export function mustAdvance(
  host: Host,
  sessionId: SessionId,
  to: ExtractionStageKind,
  run = runContext(),
): StageAdvance {
  const advance = host.advanceSession({ sessionId, to, asTenant: TENANT_A, run });
  if (!advance.ok) throw new Error(advance.error.message);
  return advance.value;
}

/** Drive a document through the whole pipeline to `provisional`. */
export function driveToProvisional(
  host: Host,
  document: { content: unknown; descriptor: DocumentDescriptor },
  key = 'upload-001',
): SessionId {
  const receipt = mustIngest(host, document, key);
  for (const stage of ['parsed', 'candidates-extracted', 'review-pending', 'provisional'] as const) {
    mustAdvance(host, receipt.sessionId, stage);
  }
  return receipt.sessionId;
}

/** Create a fresh host (typed helper for tests). */
export function newHost(): Host {
  return DocumentAdapterHost.create();
}

/** Silence unused type import when only types are re-exported. */
export type HostResultOf<T> = HostResult<T>;
