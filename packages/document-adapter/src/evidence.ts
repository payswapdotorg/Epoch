/**
 * Stage evidence emission and verification (the W006 consumption seam).
 *
 * EVERY derivation stage — Uploaded -> Parsed -> CandidatesExtracted ->
 * ReviewPending -> Provisional — emits a W006-shaped
 * {@link EvidenceRecord} whose subject is the EXACT document revision
 * (`doc:<sha256>` at the content digest) and whose payload names the
 * stage, the tenant scope, and stage-specific detail. The records are
 * chained into a {@link StageEvidenceChain}; a candidate derived through
 * a chain whose records are missing, tampered, unanchored, mis-staged, or
 * out of order is rejected with `broken-evidence-chain`.
 *
 * Determinism: evidence content is a pure function of the typed inputs —
 * the descriptor, the stage, and the HOST-SUPPLIED run context (identity +
 * observed instant). The derivation never reads the wall clock and never
 * samples randomness; identical inputs produce byte-identical records and
 * digests. No stage here mutates kernel state: emission is pure
 * construction, verification is pure validation.
 */
import {
  EVIDENCE_RECORD_VERSION,
  computeEvidenceDigest,
  parseEvidenceRecord,
  type EvidenceRecord,
} from '@epoch/evidence';
import { documentArtifactId, DOCUMENT_REVISION_LABEL } from './canonical';
import { malformedDocument } from './issues';
import { DocumentDescriptorSchema } from './schema';
import { STAGE_EVIDENCE_KINDS, EXTRACTION_STAGE_KINDS } from './version';
import type {
  DocumentDescriptor,
  DocumentAdapterError,
  DocumentAdapterResult,
  ExtractionStageKind,
  StageEvidenceChain,
  StageEvidenceLink,
  StageRunContext,
  TenantScope,
} from './types';
import type { JsonValue, Sha256Hex } from '@epoch/agent-protocol';
import type { BrokenChainReason } from './provenance';

/** A stage evidence record together with its content address and link. */
export interface StageEvidenceReceipt {
  readonly record: EvidenceRecord;
  readonly digest: Sha256Hex;
  readonly link: StageEvidenceLink;
}

/** Input of {@link emitStageEvidence}. */
export interface StageEvidenceInput {
  readonly stage: ExtractionStageKind;
  readonly descriptor: DocumentDescriptor;
  readonly run: StageRunContext;
  /** Stage-specific detail captured in the payload (candidate ids, counts). */
  readonly detail?: JsonValue | undefined;
}

/** The typed payload carried inside a stage evidence record. */
export interface StageEvidencePayload {
  readonly stage: ExtractionStageKind;
  readonly tenantScope: TenantScope;
  readonly documentDigest: Sha256Hex;
  readonly format: string;
  readonly byteLength: number;
  readonly detail?: JsonValue | undefined;
}

/** The media type of every stage evidence payload (canonical JSON data). */
export const STAGE_EVIDENCE_MEDIA_TYPE = 'application/json' as const;

/** The fixed confidence of deterministic typed derivations. */
const DETERMINISTIC_CONFIDENCE = {
  distribution: { kind: 'point', value: 1 },
  method: 'stated',
  rationale: 'deterministic typed derivation over content-addressed document bytes',
} as const;

/** Serialize the stage payload to its canonical JSON form. */
export function stageEvidencePayload(input: StageEvidenceInput): StageEvidencePayload {
  return {
    stage: input.stage,
    tenantScope: input.descriptor.tenantScope,
    documentDigest: input.descriptor.digest,
    format: input.descriptor.format,
    byteLength: input.descriptor.byteLength,
    ...(input.detail === undefined ? {} : { detail: input.detail }),
  };
}

/**
 * Emit the W006 evidence record of one derivation stage. Total: a
 * descriptor that fails validation returns `malformed-document`; the
 * returned receipt carries the record, its content address (the W006
 * canonical digest), and the chain link.
 */
export function emitStageEvidence(input: StageEvidenceInput): DocumentAdapterResult<StageEvidenceReceipt> {
  const descriptor = DocumentDescriptorSchema.safeParse(input.descriptor);
  if (!descriptor.success) {
    return { ok: false, error: malformedDocument(descriptor.error) };
  }
  const payload = stageEvidencePayload({ ...input, descriptor: descriptor.data });
  const record: EvidenceRecord = {
    schemaVersion: EVIDENCE_RECORD_VERSION,
    kind: STAGE_EVIDENCE_KINDS[input.stage],
    subject: {
      artifactId: documentArtifactId(descriptor.data.digest),
      revision: DOCUMENT_REVISION_LABEL,
      digest: descriptor.data.digest,
    },
    producedBy: {
      runId: input.run.runId,
      actorId: input.run.actorId,
      ...(input.run.methodId === undefined ? {} : { methodId: input.run.methodId }),
    },
    observedAt: input.run.observedAt,
    content: {
      mediaType: STAGE_EVIDENCE_MEDIA_TYPE,
      data: payload as unknown as JsonValue,
    },
    confidence: DETERMINISTIC_CONFIDENCE,
  };
  const parsed = parseEvidenceRecord(record);
  if (!parsed.ok) {
    return {
      ok: false,
      error: malformedDocumentFromIssues(
        parsed.issues.map((issue) => ({
          path: issue.path?.join('.') ?? '$',
          message: issue.message,
        })),
      ),
    };
  }
  const digest = computeEvidenceDigest(parsed.record);
  return {
    ok: true,
    value: { record: parsed.record, digest, link: { stage: input.stage, evidenceDigest: digest } },
  };
}

/** Build a `malformed-document` error from pre-flattened issues. */
function malformedDocumentFromIssues(
  issues: readonly { path: string; message: string }[],
): DocumentAdapterError {
  return {
    code: 'malformed-document',
    message: `stage evidence record failed W006 validation (${issues.length} issue${issues.length === 1 ? '' : 's'})`,
    issues: [...issues],
  };
}

/** Look up a stage evidence record by content address. */
export type EvidenceRecordLookup = ReadonlyMap<Sha256Hex, unknown>;

/** Append a link to a chain (pure construction; order is verified later). */
export function extendChain(chain: StageEvidenceChain, link: StageEvidenceLink): StageEvidenceChain {
  return { ...chain, stages: [...chain.stages, link] };
}

/** Start a chain for a document descriptor. */
export function initialChain(descriptor: DocumentDescriptor): StageEvidenceChain {
  return {
    schemaVersion: 1,
    documentDigest: descriptor.digest,
    tenantScope: descriptor.tenantScope,
    stages: [],
  };
}

/** The chain covering exactly the first `count` stages of the pipeline. */
export function chainPrefix(
  descriptor: DocumentDescriptor,
  links: readonly StageEvidenceLink[],
): StageEvidenceChain {
  return {
    schemaVersion: 1,
    documentDigest: descriptor.digest,
    tenantScope: descriptor.tenantScope,
    stages: [...links],
  };
}

/**
 * Verify a stage evidence chain end-to-end (total, never throws):
 *
 * 1. the linked stages are a non-empty PREFIX of the pipeline sequence in
 *    exact order (no gaps, no repeats, no reordering) — else
 *    `out-of-order`;
 * 2. every linked record is present, valid W006 evidence, content-addressed
 *    at its claimed digest (tamper detection) — else `missing-record` /
 *    `invalid-record` / `digest-mismatch`;
 * 3. every record's subject anchors to the chain's document digest — else
 *    `unanchored-subject`;
 * 4. every record's payload names its link's stage — else
 *    `stage-mismatch`;
 * 5. every record's evidence kind is the stage's W006 kind — else
 *    `kind-mismatch`;
 * 6. every record's payload tenant scope equals the chain's — else
 *    `tenant-mismatch`.
 */
export function verifyEvidenceChain(
  chain: StageEvidenceChain,
  records: EvidenceRecordLookup,
): DocumentAdapterResult<StageEvidenceChain> {
  const fail = (
    reason: BrokenChainReason,
    message: string,
    stage?: ExtractionStageKind,
    path: readonly (string | number)[] = ['evidenceChain'],
  ): DocumentAdapterResult<StageEvidenceChain> => ({
    ok: false,
    error: { code: 'broken-evidence-chain', message, path, stage, reason },
  });

  if (chain.stages.length === 0) {
    return fail(
      'out-of-order',
      'stage evidence chain is empty',
      undefined,
      ['evidenceChain', 'stages'],
    );
  }
  for (let index = 0; index < chain.stages.length; index += 1) {
    const link = chain.stages[index]!;
    const expectedStage = EXTRACTION_STAGE_KINDS[index];
    if (link.stage !== expectedStage) {
      return fail(
        'out-of-order',
        `chain stage at index ${index} is "${link.stage}" but the pipeline requires "${expectedStage}" at that position (stages must be an ordered prefix of the pipeline)`,
        link.stage,
        ['evidenceChain', 'stages', index, 'stage'],
      );
    }
    const raw = records.get(link.evidenceDigest);
    if (raw === undefined) {
      return fail(
        'missing-record',
        `no evidence record stored at the claimed digest ${link.evidenceDigest} for stage "${link.stage}"`,
        link.stage,
        ['evidenceChain', 'stages', index, 'evidenceDigest'],
      );
    }
    const parsed = parseEvidenceRecord(raw);
    if (!parsed.ok) {
      return fail(
        'invalid-record',
        `the record stored for stage "${link.stage}" is not valid W006 evidence`,
        link.stage,
        ['evidenceChain', 'stages', index],
      );
    }
    const actual = computeEvidenceDigest(parsed.record);
    if (actual !== link.evidenceDigest) {
      return fail(
        'digest-mismatch',
        `evidence record for stage "${link.stage}" does not match its claimed content address (tampered record)`,
        link.stage,
        ['evidenceChain', 'stages', index, 'evidenceDigest'],
      );
    }
    const record = parsed.record;
    if (
      record.subject.digest !== chain.documentDigest ||
      record.subject.artifactId !== documentArtifactId(chain.documentDigest) ||
      record.subject.revision !== DOCUMENT_REVISION_LABEL
    ) {
      return fail(
        'unanchored-subject',
        `evidence record for stage "${link.stage}" is not anchored to the document revision ${documentArtifactId(chain.documentDigest)} (subject digest or artifact id disagrees)`,
        link.stage,
        ['evidenceChain', 'stages', index],
      );
    }
    const payload = record.content.data as Partial<StageEvidencePayload> | null;
    if (payload === null || typeof payload !== 'object' || payload.stage !== link.stage) {
      return fail(
        'stage-mismatch',
        `evidence record for link stage "${link.stage}" carries payload stage ${JSON.stringify(payload && 'stage' in payload ? payload.stage : null)}`,
        link.stage,
        ['evidenceChain', 'stages', index],
      );
    }
    if (record.kind !== STAGE_EVIDENCE_KINDS[link.stage]) {
      return fail(
        'kind-mismatch',
        `evidence record for stage "${link.stage}" carries kind "${record.kind}" but the stage requires "${STAGE_EVIDENCE_KINDS[link.stage]}"`,
        link.stage,
        ['evidenceChain', 'stages', index],
      );
    }
    const payloadTenant = payload.tenantScope;
    if (
      payloadTenant === undefined ||
      payloadTenant.tenantId !== chain.tenantScope.tenantId
    ) {
      return fail(
        'tenant-mismatch',
        `evidence record for stage "${link.stage}" carries a payload tenant scope that disagrees with the chain's tenant scope (tampered chain)`,
        link.stage,
        ['evidenceChain', 'stages', index],
      );
    }
  }
  return { ok: true, value: chain };
}

/** The number of stages a chain covers. */
export function chainLength(chain: StageEvidenceChain): number {
  return chain.stages.length;
}

/** Whether a chain covers at least the first `count` pipeline stages. */
export function chainCovers(chain: StageEvidenceChain, count: number): boolean {
  return chain.stages.length >= count;
}

/** The local `fail` constructor of {@link verifyEvidenceChain}. */
export type { BrokenChainReason };
