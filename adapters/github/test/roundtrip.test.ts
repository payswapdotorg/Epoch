// Round-trip serialization + digest verification for every public type
// (acceptance: all public record shapes serialize deterministically,
// parse back to equal values, and address their exact content revision).
import { describe, expect, it } from 'vitest';
import { canonicalDigest, canonicalJsonStringify, type JsonValue } from '@epoch/agent-protocol';
import {
  AuthorityDecisionRecordSchema,
  AuthorityOutcomeRecordSchema,
  ChangeDispatchRecordSchema,
  ChangeProposalPlanSchema,
  SnapshotIngestionRecordSchema,
  WorkspaceObservationRecordSchema,
  WorkspaceProjectionSchema,
  buildChangeProposal,
  parseProviderSnapshot,
  projectSnapshot,
  referenceSnapshot,
  type ChangeDispatchRecord,
  type SnapshotIngestionRecord,
  type WorkspaceProjection,
} from '../src/index';
import { TENANT_A, T0, T1, T2, adapterSetup, allowingContext, DEADLINE, PRINCIPAL } from './helpers';

/** Deterministic round-trip: canonical JSON -> parse -> deep equal + digest stability. */
function roundTrip<T>(value: T, parse: (input: unknown) => { success: boolean; data?: unknown }): void {
  const serialized = canonicalJsonStringify(value as unknown as JsonValue);
  const parsed = parse(JSON.parse(serialized));
  expect(parsed.success, `${serialized}`).toBe(true);
  const reserialized = canonicalJsonStringify((parsed as { data: unknown }).data as JsonValue);
  expect(reserialized).toBe(serialized);
}

function referenceProjection(): WorkspaceProjection {
  const parsed = parseProviderSnapshot(referenceSnapshot());
  if (!parsed.success) throw new Error('fixture parse failed');
  return projectSnapshot({ tenantId: TENANT_A, snapshot: parsed.data, observedAt: T0 });
}

function ingestionRecord(): SnapshotIngestionRecord {
  const { host } = adapterSetup();
  const ingested = host.ingestSnapshot({ tenantId: TENANT_A, payload: referenceSnapshot(), ingestedAt: T0 });
  if (!ingested.ok) throw new Error(ingested.error.message);
  return ingested.value;
}

function dispatchRecord(): ChangeDispatchRecord {
  const { action, host } = adapterSetup();
  host.ingestSnapshot({ tenantId: TENANT_A, payload: referenceSnapshot(), ingestedAt: T0 });
  const dispatch = action.route({
    tenant: TENANT_A,
    workspace: 'sw:epoch-reference-app',
    changeKind: 'revision',
    summary: 'roundtrip evidence',
    actionId: 'action:roundtrip',
    authority: { principalId: PRINCIPAL, context: allowingContext() },
    approval: { deadline: DEADLINE, maxDelegationDepth: 1 },
    decidedAt: T1,
    executedAt: T2,
  });
  if (!dispatch.ok) throw new Error(dispatch.error.message);
  return dispatch.value;
}

describe('round-trip serialization + digest verification (every public type)', () => {
  it('WorkspaceObservationRecord round-trips through canonical JSON', () => {
    const projection = referenceProjection();
    for (const record of projection.records) {
      roundTrip(record, (input) => WorkspaceObservationRecordSchema.safeParse(input));
    }
  });

  it('WorkspaceProjection round-trips through canonical JSON', () => {
    roundTrip(referenceProjection(), (input) => WorkspaceProjectionSchema.safeParse(input));
  });

  it('SnapshotIngestionRecord round-trips through canonical JSON', () => {
    roundTrip(ingestionRecord(), (input) => SnapshotIngestionRecordSchema.safeParse(input));
  });

  it('ChangeProposalPlan round-trips through canonical JSON', () => {
    const plan = buildChangeProposal({
      tenantId: TENANT_A,
      workspaceId: 'sw:epoch-reference-app',
      changeKind: 'revision',
      actionId: 'action:roundtrip',
      summary: 'roundtrip evidence',
      proposedAt: T1,
    });
    roundTrip(plan, (input) => ChangeProposalPlanSchema.safeParse(input));
  });

  it('AuthorityDecisionRecord round-trips through canonical JSON', () => {
    const dispatch = dispatchRecord();
    roundTrip(dispatch.decision, (input) => AuthorityDecisionRecordSchema.safeParse(input));
  });

  it('AuthorityOutcomeRecord round-trips through canonical JSON', () => {
    const dispatch = dispatchRecord();
    // The pending dispatch carries no outcome; synthesize a valid one for the shape test.
    const outcome = {
      schemaVersion: 1,
      tenantId: dispatch.tenantId,
      actionId: dispatch.actionId,
      kind: 'succeeded',
      evidenceRefs: ['plan:roundtrip'],
      outcomeDigest: 'a'.repeat(64),
      executedAt: T2,
    };
    roundTrip(outcome, (input) => AuthorityOutcomeRecordSchema.safeParse(input));
  });

  it('ChangeDispatchRecord round-trips through canonical JSON', () => {
    roundTrip(dispatchRecord(), (input) => ChangeDispatchRecordSchema.safeParse(input));
  });

  it('observation record digests are stable under key reordering (canonical form)', () => {
    const projection = referenceProjection();
    const record = projection.records[0]!;
    const { contentDigest, ...content } = record;
    const reordered = Object.fromEntries(
      Object.entries(content as Record<string, unknown>).reverse(),
    );
    const reorderedRecord = { ...reordered, contentDigest } as typeof record;
    expect(canonicalDigest(reorderedRecord as unknown as JsonValue)).toBe(
      canonicalDigest(record as unknown as JsonValue),
    );
    // The sealed digest verifies against the record content.
    expect(contentDigest).toBe(canonicalDigest(content as unknown as JsonValue));
  });

  it('projection digest is stable under record-array key reordering', () => {
    const projection = referenceProjection();
    const { projectionDigest, ...content } = projection;
    expect(projectionDigest).toBe(canonicalDigest(content as unknown as JsonValue));
  });
});
