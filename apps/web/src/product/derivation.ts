/**
 * @epoch/web — the journey payload derivation (W047).
 *
 * Pure deterministic functions deriving Gateway operation payloads from
 * the bootstrap configuration, user input and prior gateway outcomes.
 * NO kernel imports, NO side effects: the owning authorities validate
 * every derived payload again on submission (the derivation is a
 * projection, never authority).
 */
import type { JsonValue } from '@epoch/client-runtime';
import type { ProductConfiguration } from './types';

function asRecord(value: JsonValue): Record<string, JsonValue> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, JsonValue>;
  }
  throw new Error('expected a JSON object');
}

function str(value: JsonValue): string {
  return String(value);
}

// ---------------------------------------------------------------------------
// Understand (J02): world projections, unknowns, evidence.
// ---------------------------------------------------------------------------

/** One projected world entity. */
export interface ProjectedEntity {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly properties: Readonly<Record<string, JsonValue>>;
}

/** One projected world assertion (a known, with confidence). */
export interface ProjectedAssertion {
  readonly id: string;
  readonly key: string;
  readonly status: string;
  readonly confidence: number | null;
  readonly statementKind: string;
}

/** Project the entities from a world snapshot (read-only projection). */
export function projectEntities(snapshot: JsonValue): ProjectedEntity[] {
  const assertions = (asRecord(snapshot)['assertions'] as readonly JsonValue[]) ?? [];
  const entities = new Map<string, ProjectedEntity>();
  for (const entry of assertions) {
    const assertion = asRecord(entry);
    if (str(assertion['status']) !== 'live') continue;
    const statement = asRecord(assertion['statement']);
    if (str(statement['kind']) !== 'entity') continue;
    const id = str(statement['entityId']);
    if (entities.has(id)) continue;
    entities.set(id, {
      id,
      type: str(statement['entityType']),
      title: str((asRecord(statement['properties'] ?? {}))['title'] ?? id),
      properties: asRecord(statement['properties'] ?? {}),
    });
  }
  return [...entities.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** Project the live assertions (the knowns with confidence). */
export function projectAssertions(snapshot: JsonValue): ProjectedAssertion[] {
  const assertions = (asRecord(snapshot)['assertions'] as readonly JsonValue[]) ?? [];
  return assertions.map((entry) => {
    const assertion = asRecord(entry);
    const confidence = asRecord(assertion['confidence'] ?? {});
    const distribution = asRecord(confidence['distribution'] ?? {});
    return {
      id: str(assertion['id']),
      key: str(assertion['key']),
      status: str(assertion['status']),
      confidence: typeof distribution['value'] === 'number' ? (distribution['value'] as number) : null,
      statementKind: str(asRecord(assertion['statement'])['kind']),
    };
  });
}

/**
 * The unknowns projection: information gaps derived from the authoritative
 * world — entities with no incoming/outgoing relations, plus assertions
 * below the confidence floor. A UI projection (spec: J02 "inspect
 * known/unknowns, acquire high-value missing information"), never stored.
 */
export interface ProjectedUnknown {
  readonly entityId: string;
  readonly reason: string;
}

export function projectUnknowns(snapshot: JsonValue): ProjectedUnknown[] {
  const entities = projectEntities(snapshot);
  const assertions = (asRecord(snapshot)['assertions'] as readonly JsonValue[]) ?? [];
  const related = new Set<string>();
  for (const entry of assertions) {
    const assertion = asRecord(entry);
    if (str(assertion['status']) !== 'live') continue;
    const statement = asRecord(assertion['statement']);
    if (str(statement['kind']) === 'relation') {
      related.add(str(statement['source']));
      related.add(str(statement['target']));
    }
  }
  const unknowns: ProjectedUnknown[] = [];
  for (const entity of entities) {
    if (!related.has(entity.id)) {
      unknowns.push({
        entityId: entity.id,
        reason: 'no live relations — insufficient context to reconstruct its role',
      });
    }
  }
  for (const assertion of projectAssertions(snapshot)) {
    if (assertion.statementKind === 'entity' && assertion.confidence !== null && assertion.confidence < 0.95) {
      unknowns.push({
        entityId: assertion.key,
        reason: `live assertion below the 0.95 confidence floor (${assertion.confidence})`,
      });
    }
  }
  return unknowns.sort((a, b) => (a.entityId < b.entityId ? -1 : 1));
}

/** The evidence.intake payload (record + optional bytes). */
export function evidenceIntakePayload(
  configuration: ProductConfiguration,
  input: {
    readonly subjectId: string;
    readonly note: string;
    readonly confidenceValue: number;
    readonly observedBy: string;
  },
): JsonValue {
  const evidenceFile = asRecord(configuration.records.evidence);
  const observedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
  return {
    record: {
      schemaVersion: 1,
      kind: 'observation',
      subject: {
        artifactId: input.subjectId,
        revision: 'r1',
        digest: str(evidenceFile['objectBytesDigest']),
      },
      producedBy: { runId: `web-${configuration.domain}-run`, actorId: input.observedBy },
      observedAt,
      content: {
        mediaType: 'application/json',
        data: { note: input.note, domain: configuration.domain, tenantId: configuration.tenantId },
      },
      confidence: {
        distribution: { kind: 'point', value: input.confidenceValue },
        method: 'stated',
        rationale: 'web evidence capture',
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Decide (J04): alternatives, constraints, verification, gateway approval.
// ---------------------------------------------------------------------------

/**
 * The alternative solution contents (deterministic variants of the fixture
 * solution): the baseline alternative (the fixture content verbatim) and
 * the domain's second variant (a materially different line plan). Sealing
 * each through `solution.sealVersion` yields distinct content digests —
 * the alternatives the Decide stage compares.
 */
export function solutionAlternativeContents(
  configuration: ProductConfiguration,
): { readonly id: string; readonly label: string; readonly content: JsonValue }[] {
  const solution = asRecord(configuration.records.solution);
  const { contentDigest, ...fixtureContent } = solution;
  void contentDigest;
  const base = {
    schema: 'epoch.solution-delivery.solution-version',
    schemaVersion: 1,
    ...fixtureContent,
  } as Record<string, unknown>;
  const lines = (base['solutionLines'] as readonly Record<string, unknown>[]).map((line) => ({ ...line }));
  const variant = {
    ...base,
    title: `${str(solution['title'])} — alternative line plan`,
    description: 'Alternative plan: reduced scope on the primary line with compensating quantities.',
    solutionLines: lines.map((line, index) =>
      index === 0
        ? { ...line, quantity: { ...(line['quantity'] as Record<string, unknown>), value: '96' } }
        : line,
    ),
  };
  return [
    { id: 'baseline', label: `Baseline — ${str(solution['title'])}`, content: base as unknown as JsonValue },
    { id: 'alternative', label: 'Alternative — reduced primary quantity', content: variant as unknown as JsonValue },
  ];
}

/** The constraints.evaluate payload for a user-supplied input value. */
export function constraintEvaluationPayload(
  configuration: ProductConfiguration,
  value: number,
): JsonValue {
  return {
    compiledConstraint: configuration.templates.constraint.compiledConstraint,
    context: { inputs: { [configuration.templates.constraint.inputName]: value } },
  };
}

/**
 * The verification.validateChain payload over the committed field evidence.
 *
 * The chain the verification authority ADMITS (the W052 production journey
 * P06 surfaced that the earlier projection submitted a chain the authority
 * REJECTED — evidence-run-mismatch / evidence-not-produced-by-run /
 * evidence-digest-mismatch — because it fabricated a web run claiming the
 * fixture evidence and cited the solution digest as unproduced evidence).
 * The honest chain grounds every link on the fixture run that ACTUALLY
 * produced the evidence (the record's own `producedBy`): the method's run
 * is the producing run, and the result cites exactly the evidence that run
 * produced — nothing else. The verification authority re-validates the
 * whole linkage on submission; the client never invents a verdict.
 */
export function verificationChainPayload(
  configuration: ProductConfiguration,
  input: {
    readonly evidenceRecord: JsonValue;
    readonly evidenceDigest: string;
    readonly solutionId: string;
    readonly approverId: string;
  },
): JsonValue {
  void configuration;
  const record = asRecord(input.evidenceRecord);
  const producedBy = asRecord(record['producedBy']);
  const producedAt = str(record['observedAt']);
  const producingRunId = str(producedBy['runId']);
  const producingActor = str(producedBy['actorId']);
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
  const requirementId = `req:${input.solutionId}-baseline-sealed`;
  const claimId = `claim:${input.solutionId}-baseline-verified`;
  const methodId = `method:${input.solutionId}-digest-anchored`;
  const resultId = `result:${input.solutionId}-baseline-pass`;
  const approvalId = `approval:${input.solutionId}-baseline-approved`;
  return {
    chain: {
      schemaVersion: 1,
      requirements: [
        {
          schemaVersion: 1,
          requirementId,
          statement: 'The delivery decision is grounded in committed, digest-anchored field evidence.',
        },
        {
          schemaVersion: 1,
          requirementId: `req:${input.solutionId}-field-evidence`,
          statement: 'Field evidence covers the delivered scope.',
        },
      ],
      claims: [
        {
          schemaVersion: 1,
          claimId,
          requirementId,
          statement: 'The baseline decision is grounded in the committed field evidence, anchored by its content digest.',
          stage: 'verification',
        },
      ],
      methods: [
        {
          schemaVersion: 1,
          methodId,
          claimId,
          stage: 'verification',
          description: 'Digest-anchored verification over the committed field-evidence record and its producing run.',
          deterministic: true,
        },
      ],
      runs: [
        {
          schemaVersion: 1,
          runId: producingRunId,
          methodId,
          stage: 'verification',
          executedBy: producingActor,
          executedByKind: 'person',
          startedAt: producedAt,
          endedAt: producedAt,
          status: 'completed',
          producedEvidence: [input.evidenceDigest],
        },
      ],
      results: [
        {
          schemaVersion: 1,
          resultId,
          claimId,
          runId: producingRunId,
          stage: 'verification',
          outcome: 'pass',
          evidenceDigests: [input.evidenceDigest],
          confidence: { distribution: { kind: 'point', value: 0.95 } },
          decidedAt: now,
          rationale: 'The committed field evidence resolves by digest and was produced by the citing run.',
        },
      ],
      evidence: [input.evidenceRecord],
      approvals: [
        {
          schemaVersion: 1,
          approvalId,
          resultId,
          approverId: input.approverId,
          approverKind: 'person',
          decision: 'approved',
          decidedAt: now,
        },
      ],
    },
  };
}

/** The solution.approveBaseline payload for a sealed solution outcome. */
export function approveBaselinePayload(
  configuration: ProductConfiguration,
  sealedSolution: JsonValue,
  approvedBy: string,
): JsonValue {
  const sealed = asRecord(sealedSolution);
  return {
    solution: sealedSolution,
    approval: {
      schema: 'epoch.solution-delivery.baseline-approval',
      schemaVersion: 1,
      approvalId: `approval:${configuration.domain}-baseline-web`,
      solutionId: str(sealed['solutionId']),
      tenantId: configuration.tenantId,
      version: str(sealed['version']),
      baselineDigest: str(sealed['contentDigest']),
      approvedBy,
      approvedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z'),
      decisionNote: 'web decide-stage approval through the Action Gateway flow',
    },
  };
}

/** The action.submit payload (the Gateway approval path). */
export function actionSubmitPayload(
  configuration: ProductConfiguration,
  input: {
    readonly actionId: string;
    readonly proposedBy: string;
    /** The constrained value bound by the tenant approval policy. */
    readonly constrainedValue: number;
  },
): JsonValue {
  const proposal = asRecord(configuration.templates.action.proposal);
  const policySet = asRecord(configuration.templates.action.policySet);
  // The proposal + approval horizon is derived at submit time (the
  // product clock is the real now; the fixture instants are historical).
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
  const deadline = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();
  return {
    actionId: input.actionId,
    proposal: { ...proposal, proposedBy: input.proposedBy, expiresAt },
    policies: [policySet],
    evaluationContext: { inputs: { [configuration.templates.constraint.inputName]: input.constrainedValue } },
    approval: { deadline, maxDelegationDepth: 1 },
  };
}

/** The action.approve payload (the human-approval flow). */
export function actionApprovePayload(
  configuration: ProductConfiguration,
  input: { readonly actionId: string; readonly decidedBy: string; readonly note: string },
): JsonValue {
  return {
    actionId: input.actionId,
    decidedBy: { id: input.decidedBy, role: 'human-approver' },
    asRole: configuration.templates.action.approvalRole,
    note: input.note,
  };
}

// ---------------------------------------------------------------------------
// Plan (J05): program of work + BOQ / domain schedule.
// ---------------------------------------------------------------------------

/** The program.build payload for a sealed solution outcome. */
export function programContentPayload(
  configuration: ProductConfiguration,
  sealedSolution: JsonValue,
): JsonValue {
  const program = asRecord(configuration.records.program);
  const sealed = asRecord(sealedSolution);
  const { contentDigest, ...content } = program;
  void contentDigest;
  return {
    content: {
      ...content,
      solutionVersion: str(sealed['version']),
      solutionVersionDigest: str(sealed['contentDigest']),
    },
  };
}

// ---------------------------------------------------------------------------
// Acquire (J05): procurement quote + purchase order.
// ---------------------------------------------------------------------------

/** The procurement.quote payload (quote content + sealed package store). */
export function procurementQuotePayload(configuration: ProductConfiguration): JsonValue {
  const procurement = asRecord(configuration.templates.procurement);
  return {
    content: procurement['quoteContent'],
    packages: { packages: [procurement['package']] },
    store: { quotes: [] },
  };
}

/** The procurement.order payload (order content + the full grounded chain). */
export function procurementOrderPayload(
  configuration: ProductConfiguration,
  runtimeQuote: JsonValue,
): JsonValue {
  const procurement = asRecord(configuration.templates.procurement);
  return {
    content: procurement['orderContent'],
    packages: { packages: [procurement['package']] },
    quotes: { quotes: [runtimeQuote] },
    selections: { selections: [procurement['selection']] },
    commitments: [procurement['commitment']],
    store: { orders: [] },
  };
}

// ---------------------------------------------------------------------------
// Realize / Observe (J06): delivery + field observation + forecast.
// ---------------------------------------------------------------------------

/** The delivery.open content for a sealed solution outcome. */
export function deliveryOpenPayload(
  configuration: ProductConfiguration,
  sealedSolution: JsonValue,
  deliveryId: string,
): JsonValue {
  const sealed = asRecord(sealedSolution);
  return {
    content: {
      schema: 'epoch.solution-delivery.delivery-record',
      schemaVersion: 1,
      deliveryId,
      tenantId: configuration.tenantId,
      solutionId: str(sealed['solutionId']),
      solutionVersion: str(sealed['version']),
      solutionVersionDigest: str(sealed['contentDigest']),
      openedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z'),
      openedBy: configuration.committedAuthentication.principalId,
      status: 'open',
      observations: [],
      acceptedObservationIds: [],
      rejectedObservationIds: [],
      actuals: [],
    },
  };
}

/** The delivery.observe payload (the field capture of J06). */
export function deliveryObservePayload(
  configuration: ProductConfiguration,
  input: {
    readonly solutionId: string;
    readonly deliveryId: string;
    readonly activityId: string;
    readonly observedBy: string;
    readonly quantity: string;
    readonly unit: string;
    readonly captureKey: string;
    /** The governing sealed program (anchors the capture on its activities). */
    readonly program?: JsonValue | undefined;
  },
): JsonValue {
  const observedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
  return {
    solutionId: input.solutionId,
    ...(input.program !== undefined ? { program: input.program } : {}),
    capture: {
      captureKey: input.captureKey,
      tenantId: configuration.tenantId,
      solutionId: input.solutionId,
      deliveryId: input.deliveryId,
      observedAt,
      observedBy: input.observedBy,
      subjectRef: { kind: 'activity', id: input.activityId },
      measure: { kind: 'quantity', value: input.quantity, unit: input.unit },
      uncertainty: {
        schemaVersion: 1,
        provenance: {
          kind: 'observed',
          sourceRef: `source:web-${configuration.domain}`,
          actor: input.observedBy,
        },
        freshness: { state: 'fresh', assessedAt: observedAt },
        confidence: { method: 'measured', value: 0.95, rationale: 'direct field measurement' },
      },
    },
  };
}

/** The actualization.forecast input (the rolling projection). */
export function forecastPayload(
  configuration: ProductConfiguration,
  input: {
    readonly solutionId: string;
    readonly activityId: string;
    readonly plannedValue: string;
    readonly actualsValue: string;
    readonly unit: string;
    readonly performanceFactor: string;
    readonly recordedBy: string;
  },
): JsonValue {
  const recordedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
  return {
    input: {
      recordId: `forecast:${configuration.domain}-web-${Date.now().toString(36)}`,
      tenantId: configuration.tenantId,
      subject: {
        solutionId: input.solutionId,
        subjectKind: 'activity',
        subjectId: input.activityId,
      },
      planned: { kind: 'quantity', value: input.plannedValue, unit: input.unit },
      actualsToDate: { kind: 'quantity', value: input.actualsValue, unit: input.unit },
      performanceFactor: input.performanceFactor,
      asOf: recordedAt,
      refines: null,
      recordedAt,
      recordedBy: input.recordedBy,
      uncertainty: {
        schemaVersion: 1,
        provenance: {
          kind: 'observed',
          sourceRef: `source:web-${configuration.domain}`,
          actor: input.recordedBy,
        },
        freshness: { state: 'fresh', assessedAt: recordedAt },
        confidence: { method: 'measured', value: 0.9, rationale: 'rolling forecast from observed actuals' },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Verify / supervision (J06 + J09).
// ---------------------------------------------------------------------------

/** The supervision.check input over the program + delivery. */
export function supervisionCheckPayload(
  configuration: ProductConfiguration,
  input: {
    readonly program: JsonValue;
    readonly delivery: JsonValue;
    readonly evaluatedBy: string;
  },
): JsonValue {
  return {
    input: {
      passId: `pass:${configuration.domain}-web-${Date.now().toString(36)}`,
      tenantId: configuration.tenantId,
      evaluatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z'),
      evaluatedBy: input.evaluatedBy,
      program: input.program,
      delivery: input.delivery,
      thresholds: configuration.templates.supervisionThresholds,
      executionIssues: [],
      leadTimeInputs: [],
      infoRequests: [],
    },
  };
}

/** The alerts.raise payload for one supervision finding. */
export function alertRaisePayload(
  configuration: ProductConfiguration,
  input: {
    readonly finding: JsonValue;
    readonly raisedBy: string;
  },
): JsonValue {
  const finding = asRecord(input.finding);
  const raisedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');
  return {
    chain: [],
    options: {
      alertId: `alert:${configuration.domain}-web-${Date.now().toString(36)}`,
      tenantId: configuration.tenantId,
      summary: {
        findingId: str(finding['findingId']),
        findingDigest: str(finding['contentDigest']),
        findingClass: str(finding['findingClass']),
        findingStatus: str(finding['status']),
        subjectKind: str(asRecord(finding['subject'])['subjectKind']),
        subjectId: str(asRecord(finding['subject'])['subjectId']),
        title: str(finding['title']),
        detectedAt: str(finding['detectedAt'] ?? raisedAt),
      },
      policy: configuration.templates.escalationPolicy,
      raisedAt,
      raisedBy: input.raisedBy,
    },
  };
}

// ---------------------------------------------------------------------------
// Marketplace (J10).
// ---------------------------------------------------------------------------

/** The marketplace.entitlement payload (the fixture ledger + query). */
export function entitlementCheckPayload(configuration: ProductConfiguration): JsonValue {
  const ledger = asRecord(configuration.templates.entitlementLedger);
  return {
    grants: ledger['grants'],
    revocations: ledger['revocations'],
    query: {
      tenantId: configuration.tenantId,
      listingId: str(ledger['listingId']),
      scope: { kind: 'tenant' },
    },
  };
}

/** The outcome.learn payload (the kernel-sealed outcome record). */
export function outcomeLearnPayload(
  configuration: ProductConfiguration,
  solutionId: string,
): JsonValue {
  return {
    solutionId,
    record: configuration.templates.outcomeRecord,
  };
}

/** The discovery.run payload (candidates selected by the user). */
export function discoveryRunPayload(
  configuration: ProductConfiguration,
  selectedCandidateIds: readonly string[],
): JsonValue {
  const discovery = asRecord(configuration.templates.discovery);
  const candidates = (discovery['candidates'] as readonly JsonValue[]).filter((candidate) =>
    selectedCandidateIds.includes(str(asRecord(candidate)['candidateId'])),
  );
  return {
    input: discovery['input'],
    options: { candidates },
  };
}
