/**
 * The Document-to-Adapter HOST (service layer, W028): the long-running
 * in-memory reference model.
 *
 * - **Ingestion session lifecycle** — typed bytes in, staged evidence
 *   out: admission (kernel discipline: format vocabulary, content
 *   address, tenant grammar), then the fixed pipeline
 *   Uploaded -> Parsed -> CandidatesExtracted -> ReviewPending ->
 *   Provisional driven one stage at a time.
 * - **Deterministic stage driver** — advance-on-evidence: an advance
 *   commits only when the stage's W006 evidence record validates and
 *   stores (real @epoch/evidence EvidenceStore consumption); re-running
 *   an applied advance is an idempotent no-op that returns the ORIGINAL
 *   evidence digest (duplicate suppression — no second record, no state
 *   change); re-ingesting the same key with the same digest returns the
 *   same session; the same key with a different digest is the typed
 *   `idempotency-conflict`.
 * - **Registration** — the terminal advance seals the W007 registration
 *   (real @epoch/capability-registry consumption) and registers it;
 *   an identical re-registration is suppressed, a conflicting one is a
 *   typed `registration-conflict`.
 * - **Tenant isolation (R12)** — every read/advance is tenant-scoped;
 *   cross-tenant access is the kernel-typed `cross-tenant-denied`.
 * - **Trust floor** — escalation requests are always the kernel-typed
 *   `trust-escalation-denied` (the floor, not the gate).
 * - **Health/liveness as typed data** — a pure state projection: no
 *   wall clock, no randomness, deterministic key order.
 *
 * In-memory reference behavior only: NO persistence, NO network, NO real
 * processes (later Work Orders add those behind this seam).
 */
import { canonicalDigest, type Sha256Hex } from '@epoch/agent-protocol';
import { CapabilityRegistry, type CapabilityRegistration } from '@epoch/capability-registry';
import { EvidenceStore } from '@epoch/evidence';
import {
  admitDocumentContent,
  admitDocumentDescriptor,
  advanceExtractionStage,
  buildProvisionalRegistration,
  chainPrefix,
  deriveProvisionalDefinitions,
  emitStageEvidence,
  extractCandidates,
  parseDocument,
  requestTrustEscalation,
  verifyEvidenceChain,
  DOCUMENT_FORMATS,
  EXTRACTION_STAGE_KINDS,
  DOCUMENT_ADAPTER_CONTRACT_VERSION,
  PROVISIONAL_LIFECYCLE_TRANSITIONS,
} from '@epoch/document-adapter';
import type {
  DocumentContent,
  DocumentDescriptor,
  ExtractionCandidate,
  ExtractionStageKind,
  ProvisionalAdapterDefinition,
  StageEvidenceChain,
  StageEvidenceLink,
  StageRunContext,
} from '@epoch/document-adapter';
import {
  DOCUMENT_ADAPTER_SERVICE_NAME,
  HOST_RECORD_VERSION,
  IDEMPOTENCY_KEY_PATTERN,
} from './version';
import {
  idempotencyConflict,
  registrationConflict,
  unknownSession,
} from './errors';
import type {
  AdvanceSessionInput,
  DocumentAdapterHostError,
  GetSessionInput,
  HealthReport,
  HostResult,
  HostTrustEscalationInput,
  IdempotencyKey,
  IngestDocumentInput,
  IngestionReceipt,
  ListSessionsInput,
  SessionCandidates,
  SessionId,
  SessionSnapshot,
  ServiceDescription,
  StageAdvance,
} from './types';

/** Internal session record: the snapshot plus in-memory-only state. */
interface SessionRecord {
  readonly sessionId: SessionId;
  readonly idempotencyKey: IdempotencyKey;
  readonly descriptor: DocumentDescriptor;
  readonly content: DocumentContent;
  readonly createdAt: string;
  stage: ExtractionStageKind;
  chain: StageEvidenceChain;
  candidates: readonly ExtractionCandidate[];
  definitions: readonly ProvisionalAdapterDefinition[];
}

/** Options of {@link DocumentAdapterHost.create}. */
export interface DocumentAdapterHostOptions {
  /**
   * The registry provisional mappings register into (defaults to a fresh
   * private registry). Real W007 consumption; the host never recreates
   * the registry's authority.
   */
  readonly registry?: CapabilityRegistry | undefined;
}

/** Derive the content-addressed session id of one ingestion intent. */
function deriveSessionId(idempotencyKey: IdempotencyKey, documentDigest: Sha256Hex): SessionId {
  return `sess:${canonicalDigest({ idempotencyKey, documentDigest })}`;
}

function ok<T>(value: T): HostResult<T> {
  return { ok: true, value };
}

function fail<T>(error: DocumentAdapterHostError): HostResult<T> {
  return { ok: false, error };
}

function crossTenant(expectedTenantId: string, encounteredTenantId: string): DocumentAdapterHostError {
  return {
    code: 'cross-tenant-denied',
    message:
      `session belongs to tenant "${encounteredTenantId}" but the caller acts for ` +
      `"${expectedTenantId}" (R12 multi-tenant isolation)`,
    path: ['tenantScope', 'tenantId'],
    expectedTenantId,
    encounteredTenantId,
  };
}

function badIdempotencyKey(key: string): DocumentAdapterHostError {
  return {
    code: 'malformed-document',
    message: `idempotency key "${key}" does not match the typed key grammar`,
    issues: [
      {
        path: 'idempotencyKey',
        message: 'must match /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/',
      },
    ],
  };
}

/**
 * The in-memory document-adapter host. Construct with
 * `DocumentAdapterHost.create()`.
 */
export class DocumentAdapterHost {
  private readonly sessions = new Map<SessionId, SessionRecord>();
  private readonly byKey = new Map<IdempotencyKey, SessionId>();
  private readonly evidence = EvidenceStore.create();
  private readonly registry: CapabilityRegistry;

  private constructor(registry: CapabilityRegistry) {
    this.registry = registry;
  }

  /** Create an empty host (optionally with a provided registry). */
  static create(options: DocumentAdapterHostOptions = {}): DocumentAdapterHost {
    return new DocumentAdapterHost(options.registry ?? new CapabilityRegistry());
  }

  /**
   * Ingest a document (typed bytes in, staged evidence out). Admission
   * discipline (kernel): content shape + format vocabulary
   * (`unsupported-format`), descriptor shape + tenant grammar
   * (`malformed-document`), descriptor/content digest agreement
   * (`digest-mismatch` — tamper), tenant ownership (`cross-tenant-denied`).
   * Idempotency: the same (key, digest) re-derives the same session and
   * returns `duplicate: true`; the same key with a different digest is
   * the typed `idempotency-conflict`.
   */
  ingestDocument(input: IngestDocumentInput): HostResult<IngestionReceipt> {
    if (!IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)) {
      return fail(badIdempotencyKey(input.idempotencyKey));
    }
    const content = admitDocumentContent(input.content);
    if (!content.ok) return fail(content.error);
    const descriptor = admitDocumentDescriptor(input.descriptor);
    if (!descriptor.ok) return fail(descriptor.error);
    if (descriptor.value.tenantScope.tenantId !== input.asTenant) {
      return fail(
        crossTenant(input.asTenant, descriptor.value.tenantScope.tenantId),
      );
    }
    // The content address is verified at birth: a descriptor that
    // mis-claims its content never starts a session (tamper rejection).
    const parsed = parseDocument(content.value, descriptor.value);
    if (!parsed.ok) return fail(parsed.error);

    const sessionId = deriveSessionId(input.idempotencyKey, descriptor.value.digest);
    const existing = this.sessions.get(sessionId);
    if (existing !== undefined) {
      // Same key + same digest: idempotent re-run.
      const uploaded = existing.chain.stages[0];
      return ok({
        schemaVersion: HOST_RECORD_VERSION,
        sessionId,
        stage: 'uploaded',
        evidenceDigest: uploaded === undefined ? ('0'.repeat(64) as Sha256Hex) : uploaded.evidenceDigest,
        duplicate: true,
      });
    }
    const bound = this.byKey.get(input.idempotencyKey);
    if (bound !== undefined) {
      const boundSession = this.sessions.get(bound);
      if (boundSession !== undefined) {
        // Same key + DIFFERENT digest: duplicate suppression.
        return fail(
          idempotencyConflict(
            input.idempotencyKey,
            boundSession.descriptor.digest,
            descriptor.value.digest,
          ),
        );
      }
    }

    const receipt = emitStageEvidence({
      stage: 'uploaded',
      descriptor: descriptor.value,
      run: input.run,
    });
    if (!receipt.ok) return fail(receipt.error);
    const stored = this.evidence.add(receipt.value.record);
    if (!stored.ok) {
      return fail({
        code: 'broken-evidence-chain',
        message: `uploaded-stage evidence record was rejected by the evidence store: ${stored.issues[0]?.message ?? 'invalid'}`,
        path: ['evidence', 'uploaded'],
        reason: 'invalid-record',
      });
    }
    const record: SessionRecord = {
      sessionId,
      idempotencyKey: input.idempotencyKey,
      descriptor: descriptor.value,
      content: content.value,
      createdAt: input.run.observedAt,
      stage: 'uploaded',
      chain: chainPrefix(descriptor.value, [receipt.value.link]),
      candidates: [],
      definitions: [],
    };
    this.sessions.set(sessionId, record);
    this.byKey.set(input.idempotencyKey, sessionId);
    return ok({
      schemaVersion: HOST_RECORD_VERSION,
      sessionId,
      stage: 'uploaded',
      evidenceDigest: receipt.value.digest,
      duplicate: false,
    });
  }

  /**
   * Advance a session one stage (advance-on-evidence). The typed
   * lifecycle is enforced (`policy-violation` on skips/regressions);
   * the stage's evidence record is emitted, stored, and verified in the
   * chain BEFORE the state commits; an already-applied advance is an
   * idempotent no-op returning the ORIGINAL evidence digest with
   * `duplicate: true`.
   */
  advanceSession(input: AdvanceSessionInput): HostResult<StageAdvance> {
    const session = this.sessions.get(input.sessionId);
    if (session === undefined) return fail(unknownSession(input.sessionId));
    if (session.descriptor.tenantScope.tenantId !== input.asTenant) {
      return fail(crossTenant(input.asTenant, session.descriptor.tenantScope.tenantId));
    }
    if (session.stage === input.to) {
      // Idempotent re-run of the terminal applied advance: the evidence
      // of the FIRST application is authoritative (duplicate suppression).
      const link = session.chain.stages[session.chain.stages.length - 1];
      return ok({
        schemaVersion: HOST_RECORD_VERSION,
        sessionId: session.sessionId,
        from: session.stage,
        to: session.stage,
        evidenceDigest: link === undefined ? ('0'.repeat(64) as Sha256Hex) : link.evidenceDigest,
        duplicate: true,
      });
    }
    const advance = advanceExtractionStage({ current: session.stage, target: input.to });
    if (!advance.ok) return fail(advance.error);

    const records = new Map<Sha256Hex, unknown>();
    for (const link of session.chain.stages) {
      const record = this.evidence.byDigest(link.evidenceDigest);
      if (record !== undefined) records.set(link.evidenceDigest, record);
    }
    const baseline = verifyEvidenceChain(session.chain, records);
    if (!baseline.ok) return fail(baseline.error);

    const applied = this.applyStage(session, input.to, input.run);
    if (!applied.ok) return fail(applied.error);

    const updated = verifyEvidenceChain(applied.value.chain, this.snapshotRecords(applied.value.chain));
    if (!updated.ok) return fail(updated.error);

    session.stage = input.to;
    session.chain = applied.value.chain;
    session.candidates = applied.value.candidates;
    session.definitions = applied.value.definitions;
    return ok({
      schemaVersion: HOST_RECORD_VERSION,
      sessionId: session.sessionId,
      from: applied.value.from,
      to: input.to,
      evidenceDigest: applied.value.evidenceDigest,
      duplicate: false,
    });
  }

  /** Apply one stage: emit + store evidence, derive the stage outputs. */
  private applyStage(
    session: SessionRecord,
    to: ExtractionStageKind,
    run: StageRunContext,
  ): HostResult<{
    from: ExtractionStageKind;
    evidenceDigest: Sha256Hex;
    chain: StageEvidenceChain;
    candidates: readonly ExtractionCandidate[];
    definitions: readonly ProvisionalAdapterDefinition[];
  }> {
    const { descriptor, content } = session;
    if (to === 'parsed') {
      const parsed = parseDocument(content, descriptor);
      if (!parsed.ok) return fail(parsed.error);
      const receipt = emitStageEvidence({
        stage: 'parsed',
        descriptor,
        run,
        detail: { mappingCount: parsed.value.rows.length },
      });
      if (!receipt.ok) return fail(receipt.error);
      const stored = this.evidence.add(receipt.value.record);
      if (!stored.ok) return fail(this.evidenceRejected('parsed', stored.issues[0]?.message));
      return ok({
        from: session.stage,
        evidenceDigest: receipt.value.digest,
        chain: this.extended(session, receipt.value.link),
        candidates: session.candidates,
        definitions: session.definitions,
      });
    }
    if (to === 'candidates-extracted') {
      const parsed = parseDocument(content, descriptor);
      if (!parsed.ok) return fail(parsed.error);
      const candidates = extractCandidates(parsed.value);
      const receipt = emitStageEvidence({
        stage: 'candidates-extracted',
        descriptor,
        run,
        detail: { candidateIds: candidates.map((candidate) => candidate.candidateId) },
      });
      if (!receipt.ok) return fail(receipt.error);
      const stored = this.evidence.add(receipt.value.record);
      if (!stored.ok) return fail(this.evidenceRejected('candidates-extracted', stored.issues[0]?.message));
      return ok({
        from: session.stage,
        evidenceDigest: receipt.value.digest,
        chain: this.extended(session, receipt.value.link),
        candidates,
        definitions: session.definitions,
      });
    }
    if (to === 'review-pending') {
      const receipt = emitStageEvidence({
        stage: 'review-pending',
        descriptor,
        run,
        detail: { candidateIds: session.candidates.map((candidate) => candidate.candidateId) },
      });
      if (!receipt.ok) return fail(receipt.error);
      const stored = this.evidence.add(receipt.value.record);
      if (!stored.ok) return fail(this.evidenceRejected('review-pending', stored.issues[0]?.message));
      return ok({
        from: session.stage,
        evidenceDigest: receipt.value.digest,
        chain: this.extended(session, receipt.value.link),
        candidates: session.candidates,
        definitions: session.definitions,
      });
    }
    if (to === 'provisional') {
      if (session.candidates.length === 0) {
        return fail({
          code: 'broken-evidence-chain',
          message: 'cannot confirm review without extracted candidates (the chain skipped extraction)',
          path: ['candidates'],
          reason: 'incomplete-chain',
        });
      }
      const derived = deriveProvisionalDefinitions({
        descriptor,
        candidates: session.candidates,
        chain: session.chain,
        run,
      });
      if (!derived.ok) return fail(derived.error);
      const stored = this.evidence.add(derived.value.evidence.record);
      if (!stored.ok) return fail(this.evidenceRejected('provisional', stored.issues[0]?.message));
      for (const definition of derived.value.definitions) {
        const sealed = buildProvisionalRegistration({
          definition,
          registry: this.registry,
        });
        if (!sealed.ok) return fail(sealed.error);
        const registered = this.registerProvisional(sealed.value);
        if (!registered.ok) return fail(registered.error);
      }
      return ok({
        from: session.stage,
        evidenceDigest: derived.value.evidence.digest,
        chain: derived.value.chain,
        candidates: session.candidates,
        definitions: derived.value.definitions,
      });
    }
    // Unreachable for legal transitions: 'uploaded' is the birth stage
    // (ingestion is the only way in) — the typed lifecycle table has no
    // edge into it. Kept total for the exhaustiveness check.
    const exhausted: 'uploaded' = to;
    return fail({
      code: 'policy-violation',
      message: `cannot advance to stage "${exhausted}" (ingestion is the only way into the pipeline)`,
      path: ['lifecycle'],
      rule: 'lifecycle-transition',
    });
  }

  /** Idempotent registration: identical re-runs are suppressed. */
  private registerProvisional(registration: CapabilityRegistration): HostResult<void> {
    const { capabilityId, version } = registration.manifest;
    const existing = this.registry.get({ capabilityId, version });
    if (existing.ok) {
      if (existing.value.manifestDigest === registration.digest) {
        return ok(undefined);
      }
      return fail(
        registrationConflict(
          capabilityId,
          version,
          `capability "${capabilityId}" at version "${version}" is already registered with DIFFERENT content (digest ${existing.value.manifestDigest} != ${registration.digest}); changed mapping content ships as a new version`,
        ),
      );
    }
    const stored = this.registry.register(registration);
    if (!stored.ok) return fail(this.fromRegistryError(stored.error, capabilityId, version));
    return ok(undefined);
  }

  /** Map a W007 registry error onto the host taxonomy (typed pass-through). */
  private fromRegistryError(
    error: { code: string; message: string },
    capabilityId: string,
    version: string,
  ): DocumentAdapterHostError {
    if (error.code === 'validation') {
      return {
        code: 'policy-violation',
        message: `the W007 registry rejected the provisional manifest: ${error.message}`,
        path: ['registration'],
        rule: 'manifest-shape',
      };
    }
    return registrationConflict(capabilityId, version, error.message);
  }

  private extended(session: SessionRecord, link: StageEvidenceLink): StageEvidenceChain {
    return chainPrefix(session.descriptor, [...session.chain.stages, link]);
  }

  private evidenceRejected(stage: ExtractionStageKind, message: string | undefined): DocumentAdapterHostError {
    return {
      code: 'broken-evidence-chain',
      message: `"${stage}"-stage evidence record was rejected by the evidence store: ${message ?? 'invalid'}`,
      path: ['evidence', stage],
      stage,
      reason: 'invalid-record',
    };
  }

  private snapshotRecords(chain: StageEvidenceChain): Map<Sha256Hex, unknown> {
    const records = new Map<Sha256Hex, unknown>();
    for (const link of chain.stages) {
      const record = this.evidence.byDigest(link.evidenceDigest);
      if (record !== undefined) records.set(link.evidenceDigest, record);
    }
    return records;
  }

  /** Read one session snapshot (tenant-scoped). */
  getSession(input: GetSessionInput): HostResult<SessionSnapshot> {
    const session = this.sessions.get(input.sessionId);
    if (session === undefined) return fail(unknownSession(input.sessionId));
    if (session.descriptor.tenantScope.tenantId !== input.asTenant) {
      return fail(crossTenant(input.asTenant, session.descriptor.tenantScope.tenantId));
    }
    return ok(this.snapshot(session));
  }

  /** The extracted candidates of one session (tenant-scoped read). */
  getSessionCandidates(input: GetSessionInput): HostResult<SessionCandidates> {
    const session = this.sessions.get(input.sessionId);
    if (session === undefined) return fail(unknownSession(input.sessionId));
    if (session.descriptor.tenantScope.tenantId !== input.asTenant) {
      return fail(crossTenant(input.asTenant, session.descriptor.tenantScope.tenantId));
    }
    if (session.stage === 'uploaded' || session.stage === 'parsed') {
      return fail({
        code: 'broken-evidence-chain',
        message: `session has not reached "candidates-extracted" yet (current stage: "${session.stage}")`,
        path: ['candidates'],
        stage: 'candidates-extracted',
        reason: 'incomplete-chain',
      });
    }
    return ok({
      schemaVersion: HOST_RECORD_VERSION,
      sessionId: session.sessionId,
      stage: session.stage,
      candidates: session.candidates,
    });
  }

  /** List session snapshots for one tenant, sorted by sessionId ascending. */
  listSessions(input: ListSessionsInput): readonly SessionSnapshot[] {
    const snapshots: SessionSnapshot[] = [];
    const ids = [...this.sessions.keys()].sort();
    for (const id of ids) {
      const session = this.sessions.get(id)!;
      if (session.descriptor.tenantScope.tenantId === input.asTenant) {
        snapshots.push(this.snapshot(session));
      }
    }
    return snapshots;
  }

  /**
   * Request a trust escalation for a session's provisional mapping. The
   * answer is ALWAYS the kernel-typed `trust-escalation-denied` (the
   * floor, not the gate). Tenant scoping applies first.
   */
  requestTrustEscalation(input: HostTrustEscalationInput): HostResult<never> {
    const session = this.sessions.get(input.sessionId);
    if (session === undefined) return fail(unknownSession(input.sessionId));
    if (session.descriptor.tenantScope.tenantId !== input.asTenant) {
      return fail(crossTenant(input.asTenant, session.descriptor.tenantScope.tenantId));
    }
    const definition = session.definitions[0];
    return fail(
      requestTrustEscalation({
        op: input.op,
        definition: definition === undefined ? undefined : {
          definitionId: definition.definitionId,
          lifecycle: definition.lifecycle,
        },
      }),
    );
  }

  /** Health/liveness as typed data (pure state projection). */
  health(): HealthReport {
    const stageHistogram = {} as Record<ExtractionStageKind, number>;
    for (const stage of EXTRACTION_STAGE_KINDS) stageHistogram[stage] = 0;
    for (const session of this.sessions.values()) {
      stageHistogram[session.stage] += 1;
    }
    return {
      schemaVersion: HOST_RECORD_VERSION,
      service: DOCUMENT_ADAPTER_SERVICE_NAME,
      status: 'ready',
      sessionCount: this.sessions.size,
      evidenceCount: this.evidence.size,
      registrationCount: this.registry.size,
      stageHistogram,
    };
  }

  /** The typed service surface this host exposes. */
  describeService(): ServiceDescription {
    return {
      schemaVersion: HOST_RECORD_VERSION,
      service: DOCUMENT_ADAPTER_SERVICE_NAME,
      contractVersion: DOCUMENT_ADAPTER_CONTRACT_VERSION,
      stages: [...EXTRACTION_STAGE_KINDS],
      formats: [...DOCUMENT_FORMATS],
      invariants: [
        'Tenant isolation (R12): cross-tenant reads, advances, and escalation requests are typed cross-tenant-denied rejections.',
        'Trust floor: document-derived mappings are provisional by construction; certify, execute, and grant-capability are typed denials.',
        'Deterministic derivation: identical (document bytes, descriptor, run context) produce identical candidates, evidence, and registrations.',
        'In-memory reference behavior: no persistence, no network, no real processes.',
      ],
    };
  }

  /** The legal successor map of the pipeline (typed passthrough). */
  lifecycleTransitions(): Readonly<Record<ExtractionStageKind, readonly ExtractionStageKind[]>> {
    return PROVISIONAL_LIFECYCLE_TRANSITIONS;
  }

  private snapshot(session: SessionRecord): SessionSnapshot {
    return {
      schemaVersion: HOST_RECORD_VERSION,
      sessionId: session.sessionId,
      idempotencyKey: session.idempotencyKey,
      descriptor: session.descriptor,
      tenantScope: session.descriptor.tenantScope,
      stage: session.stage,
      evidenceChain: session.chain,
      candidateIds: session.candidates.map((candidate) => candidate.candidateId),
      definitions: session.definitions,
    };
  }
}
