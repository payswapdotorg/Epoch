// W031 Reference E2E slice 3 — the ADAPTER INTAKE scenario definition.
//
// The external-adapter path: a provider payload (the W029 github
// reference adapter on its reference fixtures) becomes an Epoch
// observation through the FULL seam chain, with tenancy + authorization
// gates at every boundary crossing:
//
//   W029 GithubAdapterHost.ingestSnapshot (provider payload, content-
//     addressed, tenant-gated)
//     -> W029 projectSnapshot (the NEUTRAL W002-convention projection;
//        provider vocabulary never leaves src/provider)
//     -> W028 document-adapter (the same payload enters as a document:
//        content admitted, descriptor derived, parsed, candidates
//        extracted, five-stage evidence chain emitted into a REAL W006
//        evidence store)
//     -> W036 external-request/external-event correlation (the external
//        event bridge seam)
//     -> W036 externalEventToObservation (the reference adapter step:
//        the event's content digest becomes the observation's evidence)
//     -> W036 recordObservation (the delivery authority path)
//     -> W009 authorization evaluate (the cross-tenant denial is a SEALED
//        decision — auditable evidence)
//
// NEGATIVE PATHS exercised by the slice test (all typed, never thrown):
//   - cross-tenant external event correlation: `cross-tenant-denied`
//   - cross-tenant observation intake: `cross-tenant-denied`
//   - cross-tenant descriptor admission (W028): `cross-tenant-denied`
//   - cross-tenant ingestion (W029 host): `tenant-isolation-rejected`
//   - cross-tenant authorization (W009): deny `cross-tenant-denied`,
//     sealed + digest-verified (the auditable denial)
import {
  ACTION_ADAPTER_DESCRIPTOR_DIGEST,
  GithubAdapterHost,
  SOFTWARE_ENTITY_TYPES,
  buildChangeProposal,
  parseProviderSnapshot,
  projectSnapshot,
  referenceSnapshot,
  snapshotDigestOf,
  workspaceIdOf,
  type ProviderSnapshot,
  type SnapshotIngestionRecord,
  type WorkspaceProjection,
} from '@epoch/adapter-github';
import {
  admitDocumentContent,
  deriveDocumentDescriptor,
  emitStageEvidence,
  extendChain,
  extractCandidates,
  initialChain,
  parseDocument,
  verifyEvidenceChain,
  type DocumentContent,
  type DocumentDescriptor,
  type ExtractionCandidate,
  type ParsedDocument,
  type StageEvidenceChain,
} from '@epoch/document-adapter';
import {
  admitExternalEvent,
  admitExternalRequest,
  correlateExternalEvent,
  externalEventToObservation,
  openDeliveryRecord,
  recordObservation,
  sealDistinctionRecord,
  sealSolutionVersion,
  admitSolutionVersion,
  type CorrelatedExchange,
  type ExternalEventEnvelope,
  type ExternalRequestEnvelope,
  type ObservationRecord,
  type SealedDeliveryRecord,
  type SealedSolutionVersion,
} from '@epoch/solution-delivery';
import {
  evaluate,
  sealAuthorizationDecision,
  verifyAuthorizationDecisionDigest,
  type AuthorizationDecisionRegistration,
} from '@epoch/authorization';
import { EvidenceStore, type EvidenceStore as EvidenceStoreType } from '@epoch/evidence';
import { OBSERVER, OTHER_TENANT, PRINCIPAL, T, TENANT, uncertainty } from './shared';

// --------------------------------------------------------------------------------
// Scenario vocabulary.
// --------------------------------------------------------------------------------

export const ADAPTER_TENANT = TENANT;
export const ADAPTER_FOREIGN_TENANT = OTHER_TENANT;
export const ADAPTER_WORKSPACE_ID = 'sw:epoch-reference-app';
export const ADAPTER_SOLUTION_ID = 'solution:hosted-workspace-monitoring';
export const ADAPTER_DELIVERY_ID = 'delivery:hosted-workspace-monitoring-v1';

export const EXTERNAL_REQUEST_ID = 'external-request:workspace-observation-1';
export const EXTERNAL_EVENT_ID = 'external-event:workspace-observation-1';
export const EXTERNAL_OBSERVATION_ID = 'observation:workspace-state-monday';
export const CORRELATION_KEY = 'workspace-observation:epoch-reference-app';
export const SOURCE_SYSTEM_REF = 'adapter:software-workspace-source';

/** The W009 principal driving the adapter path. */
export const WORKSPACE_ENGINEER = 'principal:workspace-engineer';

/** Unwrap helper: scenario builders fail LOUDLY on impossible admissions. */
function need<T>(result: { ok: true; value: T } | { ok: false; error: unknown }, label: string): T {
  if (!result.ok) {
    throw new Error(`adapter-intake scenario: ${label} failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}

// --------------------------------------------------------------------------------
// The scenario result.
// --------------------------------------------------------------------------------

export interface AdapterIntakeScenario {
  /** The W029 ingestion record (the content-addressed provider payload). */
  readonly ingestion: SnapshotIngestionRecord;
  /** The parsed provider snapshot (the provider seam's own shape). */
  readonly snapshot: ProviderSnapshot;
  /** The NEUTRAL W002-convention projection (provider vocabulary free). */
  readonly projection: WorkspaceProjection;
  /** The W028 mapping-table document (the adapter's neutral vocabulary). */
  readonly document: DocumentContent;
  /** The W028 document descriptor (digest COMPUTED from the content). */
  readonly descriptor: DocumentDescriptor;
  /** The W028 parsed document. */
  readonly parsed: ParsedDocument;
  /** The W028 extracted candidates (sorted, content-addressed). */
  readonly candidates: readonly ExtractionCandidate[];
  /** The W028 five-stage evidence chain (uploaded..provisional prefix). */
  readonly evidenceChain: StageEvidenceChain;
  /** The REAL W006 evidence store holding the stage evidence records. */
  readonly evidence: EvidenceStoreType;
  /** The W036 admitted external request envelope. */
  readonly request: ExternalRequestEnvelope;
  /** The W036 admitted external event envelope. */
  readonly event: ExternalEventEnvelope;
  /** The correlated request+event exchange. */
  readonly exchange: CorrelatedExchange;
  /** The W036 observation derived from the external event. */
  readonly observation: ObservationRecord;
  /** The delivery record after the observation intake. */
  readonly delivery: SealedDeliveryRecord;
  /** The sealed W009 authorization decision for the intake (allow). */
  readonly authorization: AuthorizationDecisionRegistration;
  /** The sealed W009 cross-tenant DENIAL (the auditable negative). */
  readonly crossTenantDenial: AuthorizationDecisionRegistration;
  /** The solution the delivery belongs to. */
  readonly solution: SealedSolutionVersion;
}

// --------------------------------------------------------------------------------
// The scenario runner.
// --------------------------------------------------------------------------------

export function runAdapterIntakeScenario(): AdapterIntakeScenario {
  // -- W029: ingest the provider payload (tenant-gated host, fixtures).
  const host = new GithubAdapterHost({ expectedTenantId: ADAPTER_TENANT });
  const ingestion = need(
    host.ingestSnapshot({
      tenantId: ADAPTER_TENANT,
      payload: referenceSnapshot(),
      ingestedAt: T[3],
    }),
    'ingest provider snapshot',
  );
  const parsedSnapshot = parseProviderSnapshot(referenceSnapshot());
  if (!parsedSnapshot.success) {
    throw new Error(`adapter-intake scenario: reference snapshot failed to parse: ${parsedSnapshot.error.message}`);
  }
  const snapshot = parsedSnapshot.data;
  if (workspaceIdOf(snapshot) !== ADAPTER_WORKSPACE_ID) {
    throw new Error('adapter-intake scenario: fixture workspace id drifted');
  }

  // -- W029: the NEUTRAL projection (W002-convention observation records;
  //    the provider vocabulary never crosses this seam).
  const projection = projectSnapshot({ tenantId: ADAPTER_TENANT, snapshot, observedAt: T[3] });

  // -- W028: the adapter's neutral vocabulary enters the document
  //    pipeline as a REAL mapping-table document (the provisional
  //    document-derived mapping seam): every mapping targets one of the
  //    adapter's OWN projected entity types — the document teaches the
  //    same neutral vocabulary the projection speaks.
  const content: DocumentContent = {
    format: 'structured-json',
    json: {
      documentKind: 'mapping-table',
      mappings: [
        { sourcePath: 'workspace.name', semanticTarget: 'software:workspace' },
        { sourcePath: 'revisions.sha', semanticTarget: 'software:revision' },
        { sourcePath: 'workItems.number', semanticTarget: 'software:work-item' },
      ],
    },
  };
  need(admitDocumentContent(content), 'admit document content');
  const descriptor = deriveDocumentDescriptor(content, { tenantId: ADAPTER_TENANT });
  const parsed = need(parseDocument(content, descriptor), 'parse document');
  const candidates = extractCandidates(parsed);
  for (const candidate of candidates) {
    if (!(SOFTWARE_ENTITY_TYPES as readonly string[]).includes(candidate.semanticTarget)) {
      throw new Error(`adapter-intake scenario: mapping target ${candidate.semanticTarget} is outside the adapter's neutral vocabulary`);
    }
  }

  // The five-stage evidence chain into a REAL W006 store (uploaded ->
  // parsed -> candidates-extracted; the review stages stay open).
  const evidence = EvidenceStore.create();
  let chain = initialChain(descriptor);
  const stages = ['uploaded', 'parsed', 'candidates-extracted'] as const;
  for (const [index, stage] of stages.entries()) {
    const receipt = need(
      emitStageEvidence({
        stage,
        descriptor,
        run: {
          runId: `run:adapter-intake-${index + 1}`,
          actorId: WORKSPACE_ENGINEER,
          methodId: 'document-adapter.stage-evidence',
          observedAt: T[3],
        },
        detail: { stage, candidateCount: candidates.length },
      }),
      `emit ${stage} stage evidence`,
    );
    const stored = evidence.add(receipt.record);
    if (!stored.ok) {
      throw new Error(`adapter-intake scenario: evidence store rejected the ${stage} record`);
    }
    chain = extendChain(chain, receipt.link);
  }
  const evidenceChain = need(
    verifyEvidenceChain(chain, new Map(evidence.digests().map((digest) => [digest, evidence.byDigest(digest)]))),
    'verify evidence chain',
  );

  // -- W036: the external seam — request + event correlation, then the
  //    reference adapter step (event -> sealed observation).
  const request = need(
    admitExternalRequest({
      schema: 'epoch.solution-delivery.external-request',
      schemaVersion: 1,
      requestId: EXTERNAL_REQUEST_ID,
      tenantId: ADAPTER_TENANT,
      solutionId: ADAPTER_SOLUTION_ID,
      kind: 'status-check',
      targetSystemRef: SOURCE_SYSTEM_REF,
      correlationKey: CORRELATION_KEY,
      payload: { workspace: ADAPTER_WORKSPACE_ID, observationKind: 'workspace-state' },
      issuedAt: T[3],
      issuedBy: PRINCIPAL,
    }),
    'admit external request',
  );
  const event = need(
    admitExternalEvent({
      schema: 'epoch.solution-delivery.external-event',
      schemaVersion: 1,
      eventId: EXTERNAL_EVENT_ID,
      tenantId: ADAPTER_TENANT,
      kind: 'observation-report',
      sourceSystemRef: SOURCE_SYSTEM_REF,
      correlationKey: CORRELATION_KEY,
      payload: {
        workspace: ADAPTER_WORKSPACE_ID,
        projectionDigest: projection.projectionDigest,
        headRevisionDigest: projection.source.digest,
        recordCount: projection.records.length,
      },
      occurredAt: T[4],
    }),
    'admit external event',
  );
  const exchange = need(correlateExternalEvent(request, event), 'correlate external event');

  // -- W036: the delivery the observation flows into.
  const solution = need(
    sealSolutionVersion({
      schema: 'epoch.solution-delivery.solution-version',
      schemaVersion: 1,
      solutionId: ADAPTER_SOLUTION_ID,
      version: '1.0.0',
      tenantId: ADAPTER_TENANT,
      title: 'Hosted workspace monitoring',
      description: 'Observation-driven monitoring of the hosted software workspace',
      objective: 'Track the hosted workspace state through adapter observations',
      solutionLines: [
        {
          lineId: 'line:workspace-monitoring',
          title: 'Workspace state monitoring',
          quantity: { value: '1', unit: 'sum' },
          unitCost: { amount: '0.00', currency: 'EUR' },
          acquisitionVariant: 'internal-allocation',
        },
      ],
      worldReferences: [],
      constraintReferences: [],
      previousVersionDigest: null,
      createdAt: T[0],
      createdBy: PRINCIPAL,
    }),
    'seal solution version',
  );
  need(admitSolutionVersion([], solution), 'admit solution version');
  const delivery = need(
    openDeliveryRecord({
      schema: 'epoch.solution-delivery.delivery-record',
      schemaVersion: 1,
      deliveryId: ADAPTER_DELIVERY_ID,
      tenantId: ADAPTER_TENANT,
      solutionId: ADAPTER_SOLUTION_ID,
      solutionVersion: solution.version,
      solutionVersionDigest: solution.contentDigest,
      openedAt: T[2],
      openedBy: PRINCIPAL,
      status: 'open',
      observations: [],
      acceptedObservationIds: [],
      rejectedObservationIds: [],
      actuals: [],
    }),
    'open delivery record',
  );

  // The reference adapter step: correlated event -> sealed observation
  // (the event's content digest becomes the evidence reference).
  const observation = need(
    externalEventToObservation(exchange, {
      observationRecordId: EXTERNAL_OBSERVATION_ID,
      deliveryId: ADAPTER_DELIVERY_ID,
      subject: {
        solutionId: ADAPTER_SOLUTION_ID,
        subjectKind: 'solution',
        subjectId: ADAPTER_SOLUTION_ID,
      },
      measure: { kind: 'progress', fraction: 1 },
      observedBy: OBSERVER,
      observedAt: T[4],
      uncertainty: uncertainty({
        provenance: { kind: 'observed', sourceRef: SOURCE_SYSTEM_REF, actor: OBSERVER },
        confidence: { method: 'imported', value: 0.9, rationale: 'adapter-projected workspace state' },
      }) as never,
    }),
    'external event to observation',
  );
  const recorded = need(recordObservation(delivery, observation), 'record adapter observation');

  // -- W009: the authorization decisions (the gate pair: allow + the
  //    auditable cross-tenant denial).
  const allowingContext = {
    schemaVersion: 1 as const,
    principals: [{ principalId: WORKSPACE_ENGINEER, status: 'active' as const, authenticated: true }],
    memberships: [{ principalId: WORKSPACE_ENGINEER, tenantId: ADAPTER_TENANT }],
    knownTenants: [ADAPTER_TENANT],
  };
  const allowingDecision = need(
    evaluate(
      {
        schemaVersion: 1,
        principalId: WORKSPACE_ENGINEER,
        actionKind: 'observation.record',
        resource: {
          resourceType: 'delivery-record',
          resourceId: ADAPTER_DELIVERY_ID,
          tenantId: ADAPTER_TENANT,
        },
        justification: 'recording the adapter-projected workspace observation',
      },
      allowingContext,
    ),
    'evaluate allowing decision',
  );
  const authorization = need(sealAuthorizationDecision(allowingDecision), 'seal allowing authorization decision');
  need(verifyAuthorizationDecisionDigest(authorization), 'verify allowing decision digest');

  // The cross-tenant denial: the SAME principal, a resource belonging to
  // a KNOWN foreign tenant the principal holds no membership in — deny
  // 'cross-tenant-denied' (the isolation boundary), SEALED (auditable).
  const denialDecision = need(
    evaluate(
      {
        schemaVersion: 1,
        principalId: WORKSPACE_ENGINEER,
        actionKind: 'observation.record',
        resource: {
          resourceType: 'delivery-record',
          resourceId: ADAPTER_DELIVERY_ID,
          tenantId: ADAPTER_FOREIGN_TENANT,
        },
        justification: 'cross-tenant observation attempt (negative evidence)',
      },
      {
        schemaVersion: 1,
        principals: [{ principalId: WORKSPACE_ENGINEER, status: 'active', authenticated: true }],
        memberships: [{ principalId: WORKSPACE_ENGINEER, tenantId: ADAPTER_TENANT }],
        knownTenants: [ADAPTER_TENANT, ADAPTER_FOREIGN_TENANT],
      },
    ),
    'evaluate cross-tenant denial',
  );
  const crossTenantDenial = need(sealAuthorizationDecision(denialDecision), 'seal cross-tenant denial decision');
  need(verifyAuthorizationDecisionDigest(crossTenantDenial), 'verify cross-tenant denial digest');

  return {
    ingestion,
    snapshot,
    projection,
    document: content,
    descriptor,
    parsed,
    candidates,
    evidenceChain,
    evidence,
    request,
    event,
    exchange,
    observation,
    delivery: recorded,
    authorization,
    crossTenantDenial,
    solution,
  };
}

// --------------------------------------------------------------------------------
// The digest projection (determinism evidence).
// --------------------------------------------------------------------------------

export function adapterIntakeDigestProjection(
  scenario: AdapterIntakeScenario,
): Record<string, string | readonly string[]> {
  return {
    snapshotDigest: snapshotDigestOf(scenario.snapshot),
    ingestionSnapshotDigest: scenario.ingestion.snapshotDigest,
    projectionDigest: scenario.projection.projectionDigest,
    projectionSourceDigest: scenario.projection.source.digest,
    descriptorDigest: scenario.descriptor.digest,
    candidateIds: scenario.candidates.map((candidate) => candidate.candidateId),
    evidenceChainStages: scenario.evidenceChain.stages.map((stage) => stage.evidenceDigest),
    observationDigest: scenario.observation.contentDigest,
    deliveryDigest: scenario.delivery.contentDigest,
    authorizationDigest: scenario.authorization.digest,
    crossTenantDenialDigest: scenario.crossTenantDenial.digest,
  };
}

// --------------------------------------------------------------------------------
// Exported re-exports for the slice test's negative paths (the adapter's
// own reference vocabulary, so the test composes real fixtures only).
// --------------------------------------------------------------------------------

export {
  ACTION_ADAPTER_DESCRIPTOR_DIGEST,
  buildChangeProposal,
  referenceSnapshot,
  sealDistinctionRecord,
  workspaceIdOf,
};
