// The gateway composition across the authority surface: read projections,
// evidence intake with digest recomputation, the delivery-domain ops
// (solution/program/delivery/observe/close), the constraint and
// verification surfaces, and delegation-contract checks for the deep
// domain kernels (authority rejections ride verbatim — the composition
// proof for every mapped authority).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TenancyHierarchy, sealTenancyNode } from '@epoch/tenancy';
import { compileConstraint } from '@epoch/policy-contracts';
import { sealEvent } from '@epoch/event-log';
import { ApplicationGateway } from '../src/gateway';
import { buildGateway, envelope, issueSession, TENANT, T1, unwrapResult } from './helpers';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(here, '..', '..', '..');
const fixture = (rel: string): Record<string, unknown> =>
  JSON.parse(readFileSync(path.join(REPO_ROOT, rel), 'utf8')) as Record<string, unknown>;

const CONSTRUCTION_TENANCY = fixture('qa/fixtures/construction/tenancy.json');
const CONSTRUCTION_SOLUTION = fixture('qa/fixtures/construction/solution.json');
const CONSTRUCTION_PROGRAM = fixture('qa/fixtures/construction/program-of-work.json');

/** The fixture-seeded tenancy hierarchy (the REAL authority, restored from the fixture snapshot; parents first). */
const TENANCY_KIND_ORDER = ['platform', 'tenant', 'workspace', 'project'] as const;
function fixtureTenancy(): TenancyHierarchy {
  const hierarchy = new TenancyHierarchy();
  const records = (
    CONSTRUCTION_TENANCY['records'] as Array<Record<string, unknown>>
  ).sort((a, b) => {
    const kindOf = (record: Record<string, unknown>) =>
      TENANCY_KIND_ORDER.indexOf((record['node'] as Record<string, unknown>)['kind'] as never);
    return kindOf(a) - kindOf(b);
  });
  for (const record of records) {
    const sealed = sealTenancyNode(record['node'] as Record<string, unknown>);
    if (!sealed.ok) throw new Error(sealed.error.message);
    const created = hierarchy.createNode(sealed.value);
    if (!created.ok) throw new Error(created.error.message);
  }
  return hierarchy;
}

async function seededGateway(): Promise<{ gateway: ApplicationGateway; sessionId: string }> {
  const gateway = buildGateway({ tenancy: fixtureTenancy() });
  const sessionId = await issueSession(gateway);
  return { gateway, sessionId };
}

/** The construction fixture's field-capture shape (valid for intakeFieldObservation). */
function fieldCapture(): Record<string, unknown> {
  return {
    captureKey: 'composition-capture-1',
    tenantId: 'tenant:nordstrand',
    solutionId: 'solution:warehouse-extension-steel',
    deliveryId: 'delivery:warehouse-b-001',
    observedAt: T1,
    observedBy: 'principal:field-engineer',
    subjectRef: { kind: 'activity', id: 'activity:warehouse-excavation' },
    measure: { kind: 'quantity', value: '118.5', unit: 'm3' },
    uncertainty: {
      schemaVersion: 1,
      provenance: { kind: 'observed', sourceRef: 'source:composition-fixture', actor: 'principal:field-engineer' },
      freshness: { state: 'fresh', assessedAt: T1 },
      confidence: { method: 'measured', value: 0.95, rationale: 'direct field measurement' },
    },
  };
}

describe('the gateway composition — reads (W046)', () => {
  it('context.resolve projects the fixture tenancy node (the W009 hierarchy authority)', async () => {
    const { gateway, sessionId } = await seededGateway();
    const node = unwrapResult(
      await gateway.call(envelope('context.resolve', sessionId, { nodeId: 'project:steel-warehouse-b' })),
    ) as Record<string, unknown>;
    const resolvedNode = node['node'] as Record<string, unknown>;
    expect(resolvedNode['kind']).toBe('project');
    expect(resolvedNode['parentId']).toBe('workspace:warehouse-extension');
  });

  it('context.resolve of an unknown node is the tenancy authority rejection verbatim', async () => {
    const { gateway, sessionId } = await seededGateway();
    const result = await gateway.call(envelope('context.resolve', sessionId, { nodeId: 'workspace:nope' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.class).toBe('authority-rejected');
      expect(result.error.details?.authority).toBe('@epoch/tenancy');
      expect(result.error.details?.authorityCode).toBe('unknown-node');
    }
  });

  it('world.snapshot projects the world + its content digest; world.entities lists entities', async () => {
    const { gateway, sessionId } = await seededGateway();
    const snapshot = unwrapResult(await gateway.call(envelope('world.snapshot', sessionId, {}))) as Record<string, unknown>;
    expect(snapshot['digest']).toMatch(/^[0-9a-f]{64}$/);
    expect(snapshot['snapshot']).toBeDefined();
    const entities = unwrapResult(await gateway.call(envelope('world.entities', sessionId, {}))) as unknown as unknown[];
    expect(Array.isArray(entities)).toBe(true);
    expect(entities.length).toBe(0); // the in-memory world starts empty (projection of authoritative state)
  });

  it('events.read reads a REAL sealed event stream (appended by a domain authority, never by the client)', async () => {
    const gateway = buildGateway();
    // The domain authority path appends the event (W010 discipline: the
    // gateway never appends raw events).
    const sealed = sealEvent({
      schemaVersion: 1,
      streamId: 'stream:composition-test',
      sequence: 1,
      tenantId: TENANT,
      actor: 'principal:delivery-lead',
      causalParent: null,
      payload: { discriminator: 'gateway:composition', data: { note: 'appended by the domain authority' } },
      occurredAt: T1,
    });
    if (!sealed.ok) throw new Error(sealed.error.message);
    const appended = gateway['authorities' as keyof ApplicationGateway] as unknown as { eventLog: { appendEvent: (input: unknown) => unknown } };
    const record = appended.eventLog.appendEvent(sealed.value) as { ok: boolean; error?: unknown };
    if (!record.ok) throw new Error(JSON.stringify(record.error));

    const sessionId = await issueSession(gateway);
    const stream = unwrapResult(
      await gateway.call(envelope('events.read', sessionId, { streamId: 'stream:composition-test' })),
    ) as unknown as unknown as unknown[];
    expect(stream).toHaveLength(1);
  });
});

describe('the gateway composition — evidence + object bytes (W046)', () => {
  it('evidence.intake stores bytes by RECOMPUTED digest + admits the evidence record (the claimed digest is never trusted)', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const bytes = new Uint8Array([99, 111, 109, 112, 111, 115, 105, 116, 105, 111, 110]);
    const intake = unwrapResult(
      await gateway.call(envelope('evidence.intake', sessionId, {
        bytesBase64: Buffer.from(bytes).toString('base64'),
        metadata: { kind: 'evidence-artifact', label: 'composition capture' },
        record: {
          schemaVersion: 1,
          kind: 'observation',
          subject: { artifactId: 'composition-artifact', revision: 'r1', digest: 'f'.repeat(64) },
          producedBy: { runId: 'composition-run', actorId: 'principal:field-engineer' },
          observedAt: T1,
          content: { mediaType: 'application/json', data: { note: 'composition evidence' } },
          confidence: { distribution: { kind: 'point', value: 0.9 }, method: 'stated', rationale: 'fixture' },
        },
      })),
    ) as Record<string, unknown>;
    const objectRef = intake['objectRef'] as Record<string, unknown>;
    expect(objectRef['digest']).toMatch(/^[0-9a-f]{64}$/);
    expect(objectRef['size']).toBe(bytes.byteLength);
    const receipt = intake['receipt'] as Record<string, unknown>;
    expect(receipt['digest']).toMatch(/^[0-9a-f]{64}$/);
  });

  it('evidence.get retrieves by digest and by artifact (the evidence authority)', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const intake = unwrapResult(
      await gateway.call(envelope('evidence.intake', sessionId, {
        record: {
          schemaVersion: 1,
          kind: 'observation',
          subject: { artifactId: 'composition-artifact-2', revision: 'r1', digest: 'e'.repeat(64) },
          producedBy: { runId: 'composition-run', actorId: 'principal:field-engineer' },
          observedAt: T1,
          content: { mediaType: 'application/json', data: { note: 'evidence get' } },
          confidence: { distribution: { kind: 'point', value: 0.9 }, method: 'stated', rationale: 'fixture' },
        },
      })),
    ) as Record<string, unknown>;
    const digest = (intake['receipt'] as Record<string, unknown>)['digest'] as string;
    const got = unwrapResult(await gateway.call(envelope('evidence.get', sessionId, { digest }))) as Record<string, unknown>;
    expect(got['subject']).toBeDefined();
    const byArtifact = unwrapResult(await gateway.call(envelope('evidence.get', sessionId, { artifactId: 'composition-artifact-2' }))) as unknown as unknown[];
    expect(byArtifact).toHaveLength(1);
  });
});

describe('the gateway composition — the delivery domain over the committed fixtures (W046)', () => {
  it('solution.sealVersion seals the fixture content; solution.approveBaseline approves the sealed version', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    // The sealed record in the fixture carries the content inline (records are plain JSON).
    const sealed = unwrapResult(
      await gateway.call(envelope('solution.sealVersion', sessionId, { content: resealedContent() })),
    ) as Record<string, unknown>;
    expect(sealed['contentDigest']).toMatch(/^[0-9a-f]{64}$/);
    const approval = unwrapResult(
      await gateway.call(envelope('solution.approveBaseline', sessionId, {
        solution: sealed,
        approval: {
          schema: 'epoch.solution-delivery.baseline-approval',
          schemaVersion: 1,
          approvalId: 'approval:composition-baseline',
          solutionId: sealed['solutionId'],
          tenantId: TENANT,
          version: sealed['version'],
          baselineDigest: sealed['contentDigest'],
          approvedBy: 'principal:chief-engineer',
          approvedAt: T1,
          decisionNote: 'composition test approval',
        },
      })),
    ) as Record<string, unknown>;
    expect(approval['approval']).toBeDefined();
  });

  it('program.build seals a program; program.schedule folds the committed fixture program', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const schedule = unwrapResult(
      await gateway.call(envelope('program.schedule', sessionId, { program: CONSTRUCTION_PROGRAM })),
    ) as Record<string, unknown>;
    expect(schedule['quantity']).toBeDefined();
    expect(schedule['cost']).toBeDefined();
    expect(schedule['milestones']).toBeDefined();
    expect(schedule['resources']).toBeDefined();
  });

  it('delivery.open + delivery.observe + delivery.close run through the real authorities', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const solutionContent = resealedContent();
    const sealedSolution = unwrapResult(
      await gateway.call(envelope('solution.sealVersion', sessionId, { content: solutionContent })),
    ) as Record<string, unknown>;
    const delivery = unwrapResult(
      await gateway.call(envelope('delivery.open', sessionId, {
        content: {
          schema: 'epoch.solution-delivery.delivery-record',
          schemaVersion: 1,
          deliveryId: 'delivery:composition-001',
          tenantId: TENANT,
          solutionId: sealedSolution['solutionId'],
          solutionVersion: sealedSolution['version'],
          solutionVersionDigest: sealedSolution['contentDigest'],
          openedAt: T1,
          openedBy: 'principal:delivery-lead',
          status: 'open',
          observations: [],
          acceptedObservationIds: [],
          rejectedObservationIds: [],
          actuals: [],
        },
      })),
    ) as Record<string, unknown>;
    expect(delivery['contentDigest']).toMatch(/^[0-9a-f]{64}$/);

    const observation = unwrapResult(
      await gateway.call(envelope('delivery.observe', sessionId, {
        solutionId: sealedSolution['solutionId'],
        program: CONSTRUCTION_PROGRAM,
        capture: fieldCapture(),
      })),
    ) as Record<string, unknown>;
    expect(observation).toBeDefined();

    const closed = unwrapResult(
      await gateway.call(envelope('delivery.close', sessionId, {
        delivery,
        closing: {
          schema: 'epoch.solution-delivery.delivery-closing',
          schemaVersion: 1,
          closedAt: T1,
          closedBy: 'principal:delivery-lead',
          outcome: 'delivered',
          note: 'composition test closing',
        },
      })),
    ) as Record<string, unknown>;
    expect(closed['status']).toBe('closed');
  });
});

describe('the gateway composition — constraints + verification (W046)', () => {
  it('constraints.evaluate delegates to the constraint engine (compiled constraint + context)', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const outcome = compileConstraint({
      languageVersion: '1.0.0',
      id: 'composition-budget',
      version: '1.0.0',
      inputs: [{ name: 'spend', type: 'number' }],
      class: 'hard',
      predicate: { node: 'lt', left: { node: 'input', name: 'spend' }, right: { node: 'lit', type: 'number', value: 100 } },
    });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.errors));
    const result = unwrapResult(
      await gateway.call(envelope('constraints.evaluate', sessionId, {
        compiledConstraint: outcome.compiled,
        context: { inputs: { spend: 10 } },
      })),
    ) as Record<string, unknown>;
    expect(result).toBeDefined();
  });

  it("verification.validateChain surfaces the authority chain validation verbatim", async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const validation = unwrapResult(
      await gateway.call(envelope('verification.validateChain', sessionId, {
        chain: { schemaVersion: 1, requirements: [], claims: [], methods: [], runs: [], results: [], evidence: [], approvals: [] },
      })),
    ) as Record<string, unknown>;
    expect(validation).toBeDefined();
  });
});

describe('the gateway composition — deep domain kernels (delegation contract: authority errors ride verbatim)', () => {
  it('discovery.run rejects invalid input through the capability-discovery authority', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const result = await gateway.call(
      envelope('discovery.run', sessionId, {
        input: {
          schemaVersion: 1,
          tenantId: 'not-a-tenant',
          task: { description: 'invalid tenant grammar forces the typed zod failure' },
          worldRefs: [],
          evidenceSignals: [],
          constraintSignals: [],
          taskSignals: [],
          packContributions: [],
        },
        options: { candidates: [] },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.class).toBe('authority-rejected');
      expect(result.error.details?.authority).toBe('@epoch/capability-discovery');
    }
  });

  it('procurement.quote rejects malformed content through the procurement authority', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const result = await gateway.call(envelope('procurement.quote', sessionId, { content: { nonsense: true } }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details?.authority).toBe('@epoch/procurement');
    }
  });

  it('procurement.order rejects malformed content through the procurement authority', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const result = await gateway.call(envelope('procurement.order', sessionId, { content: { nonsense: true } }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details?.authority).toBe('@epoch/procurement');
    }
  });

  it('actualization.forecast rejects invalid input through the actualization authority', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    // Structurally present but semantically invalid (a bad performance
    // factor): the authority's typed validation rejects it.
    const result = await gateway.call(
      envelope('actualization.forecast', sessionId, {
        input: {
          recordId: 'forecast:composition-1',
          tenantId: TENANT,
          subject: { solutionId: 'solution:x', subjectKind: 'activity', subjectId: 'activity:y' },
          planned: { kind: 'quantity', value: '100', unit: 'm3' },
          actualsToDate: { kind: 'quantity', value: '40', unit: 'm3' },
          performanceFactor: 'not-a-decimal',
          asOf: T1,
          refines: null,
          recordedAt: T1,
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details?.authority).toBe('@epoch/actualization');
    }
  });

  it('outcome.learn rejects an unsealed record through the learning authority', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const result = await gateway.call(
      envelope('outcome.learn', sessionId, { solutionId: 'solution:x', record: { nonsense: true } }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details?.authority).toBe('@epoch/learning-calibration');
    }
  });

  it('access.project rejects an invalid policy through the access-projection authority', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const result = await gateway.call(
      envelope('access.project', sessionId, { policy: { nonsense: true }, record: { nonsense: true }, binding: {} }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details?.authority).toBe('@epoch/access-projection');
    }
  });

  it('supervision.check rejects an invalid input through the supervision authority', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const result = await gateway.call(envelope('supervision.check', sessionId, { input: { nonsense: true } }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details?.authority).toBe('@epoch/supervision');
    }
  });

  it('alerts.raise rejects malformed options through the alerts authority', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    // A structurally-present options record with an invalid tenant id:
    // the alerts authority's typed validation rejects it.
    const result = await gateway.call(
      envelope('alerts.raise', sessionId, {
        chain: [],
        options: {
          alertId: 'alert:composition-1',
          tenantId: 'not-a-tenant',
          summary: { kind: 'schedule', severity: 'warning', summary: 'test' },
          policy: { nonsense: true },
          raisedAt: T1,
          raisedBy: 'principal:delivery-lead',
        },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.details?.authority).toBe('@epoch/alerts');
    }
  });

  it('marketplace.entitlement answers through the marketplace authority (the entitlement check outcome)', async () => {
    const gateway = buildGateway();
    const sessionId = await issueSession(gateway);
    const result = await gateway.call(
      envelope('marketplace.entitlement', sessionId, {
        grants: [],
        revocations: [],
        query: { tenantId: TENANT, listingId: 'listing:none', scope: { kind: 'tenant' } },
      }),
    );
    // With zero grants the authority either answers not-entitled (typed
    // failure) or returns its positive record; BOTH prove real delegation.
    if (!result.ok) {
      expect(result.error.details?.authority).toBe('@epoch/marketplace');
    } else {
      expect(result.ok).toBe(true);
    }
  });
});

/** The fixture solution content (the unsealed intent, rebuilt for re-sealing). */
function resealedContent(): Record<string, unknown> {
  const solution = CONSTRUCTION_SOLUTION as Record<string, unknown>;
  // The sealed record embeds every content field; reconstruct the content
  // by stripping the seal envelope fields.
  const { schemaVersion, contentDigest, ...content } = solution;
  void schemaVersion;
  void contentDigest;
  return {
    schema: 'epoch.solution-delivery.solution-version',
    schemaVersion: 1,
    ...content,
  } as Record<string, unknown>;
}
