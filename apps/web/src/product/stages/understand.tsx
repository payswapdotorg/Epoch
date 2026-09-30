'use client';
/**
 * @epoch/web — the Understand stage surface (W047, J02).
 *
 * The World View: the authoritative world digest (world.snapshot), the
 * entity projection (world.entities, client-filtered by type — the W046
 * service passes the filter under a key the kernel ignores, so the
 * product filters as a presentation projection), the knowns (live
 * assertions with confidence), the unknowns (information-gap projection:
 * unconnected entities + below-floor confidence), and evidence capture
 * (evidence.intake) with lookup (evidence.get) — "acquire high-value
 * missing information".
 */
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useGateway } from '../../client/hooks';
import { useOfflineQueue } from '../../client/offline';
import { queueingCall } from '../../client/offline';
import { callGateway } from '../../client/transport';
import { envelope } from '../../client/envelopes';
import { Panel } from '../../shared/components';
import { SHELL_SPACING } from '../../shared/tokens';
import { Button, DataTable, Digest, ErrorBanner, Field, Loading, Pill, SuccessNote, TextInput } from '../ui';
import { evidenceIntakePayload, projectAssertions, projectUnknowns } from '../derivation';
import { projectionCache } from '../../client/projection-cache';
import type { UiGatewayCallResult } from '../types';

const TYPE_FILTER = 'all';

export function UnderstandStage(): ReactNode {
  const { session, configuration, call } = useGateway();
  const queue = useOfflineQueue();
  const [snapshot, setSnapshot] = useState<{ digest: string; snapshot: unknown } | null>(null);
  const [entities, setEntities] = useState<{ id: string; type: string; title: string }[]>([]);
  const [knownEvidence, setKnownEvidence] = useState<unknown[] | null>(null);
  const [error, setError] = useState<UiGatewayCallResult | null>(null);
  const [note, setNote] = useState('foundation survey received');
  const [confidence, setConfidence] = useState('0.9');
  const [intakeResult, setIntakeResult] = useState<UiGatewayCallResult | null>(null);

  const evidenceFile = configuration.records.evidence as Record<string, unknown>;

  useEffect(() => {
    void (async () => {
      const world = await call('world.snapshot', {});
      if (world.ok) {
        const result = world.value.result as { digest: string; snapshot: unknown };
        setSnapshot(result);
        // J08 step 4: the local projection cache admits the server
        // projection BY DIGEST (read-only, immutable).
        projectionCache.admit({
          digest: result.digest,
          revision: 1,
          fetchedAt: new Date().toISOString(),
          content: result.snapshot as never,
        });
      } else {
        setError(world);
      }
      const list = await call('world.entities', {});
      if (list.ok) {
        // The kernel materializes entities from live assertions: {id, type,
        // properties, ...}. Project them (title from properties, a UI-only
        // presentation concern — the world stays the authority).
        const materialized = list.value.result as unknown as readonly {
          readonly id: string;
          readonly type: string;
          readonly properties?: Readonly<Record<string, unknown>>;
        }[];
        setEntities(
          materialized
            .map((entity) => ({
              id: entity.id,
              type: entity.type,
              title: String(entity.properties?.['title'] ?? entity.id),
              properties: (entity.properties ?? {}) as Readonly<Record<string, unknown>>,
            }))
            .sort((a, b) => (a.id < b.id ? -1 : 1)),
        );
      }
      const evidence = await call('evidence.get', { artifactId: `${configuration.domain}-field-capture` });
      if (evidence.ok) {
        const records = evidence.value.result;
        setKnownEvidence(Array.isArray(records) ? records : [records]);
      }
    })();
  }, [call, configuration.domain]);

  const assertions = snapshot === null ? [] : projectAssertions(snapshot.snapshot as never);
  const unknowns = snapshot === null ? [] : projectUnknowns(snapshot.snapshot as never);
  const knowns = assertions.filter((assertion) => assertion.status === 'live');

  const captureEvidence = async (): Promise<void> => {
    setIntakeResult(null);
    const request = envelope('evidence.intake', session, evidenceIntakePayload(configuration, {
      subjectId: `${configuration.domain}-field-capture`,
      note,
      confidenceValue: Number(confidence),
      observedBy: session.principalId,
    }));
    const result = await queueingCall(() => callGateway(request), queue.enqueue, request);
    setIntakeResult(result);
    if (result.ok) {
      const evidence = await call('evidence.get', { artifactId: `${configuration.domain}-field-capture` });
      if (evidence.ok) {
        const records = evidence.value.result;
        setKnownEvidence(Array.isArray(records) ? records : [records]);
      }
    }
  };

  return (
    <div data-route-surface="route:understand" data-stage="understand" style={{ display: 'grid', gap: `${SHELL_SPACING.lg}px` }}>
      <Panel title="World view — authoritative projection">
        {snapshot === null ? (
          <Loading label="Projecting the world through the gateway…" />
        ) : (
          <>
            <div data-testid="world-digest" style={{ display: 'flex', gap: `${SHELL_SPACING.sm}px`, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: '#57534e' }}>Authoritative content digest:</span>
              <Digest value={snapshot.digest} label="world snapshot digest" />
              {snapshot.digest === configuration.anchors.worldDigest ? (
                <Pill tone="positive" testId="world-digest-match">matches fixture anchor</Pill>
              ) : null}
            </div>
            <p style={{ color: '#57534e', fontSize: '13px', marginBottom: 0 }}>
              The World Model is the semantic authority; this view is a synchronized projection. The projection
              cache admits the server projection by digest (read-only, immutable — J08).
            </p>
          </>
        )}
        {error !== null && !error.ok ? (
          <div style={{ marginTop: `${SHELL_SPACING.md}px` }}><ErrorBanner error={error.error} testId="world-error" /></div>
        ) : null}
      </Panel>

      <Panel title="Knowns — live world entities">
        <DataTable
          caption="World entities"
          testId="entity-table"
          rows={entities.filter((entity) => TYPE_FILTER === 'all' || entity.type === TYPE_FILTER)}
          rowKey={(entity) => entity.id}
          columns={[
            { header: 'Entity', cell: (entity) => <code style={{ fontSize: '12px' }}>{entity.id}</code> },
            { header: 'Type', cell: (entity) => <Pill>{entity.type}</Pill> },
            { header: 'Title', cell: (entity) => entity.title },
          ]}
        />
        <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
          <DataTable
            caption="Live assertions"
            testId="assertion-table"
            rows={knowns}
            rowKey={(assertion) => assertion.id}
            columns={[
              { header: 'Assertion', cell: (assertion) => <code style={{ fontSize: '12px' }}>{assertion.id}</code> },
              { header: 'Statement', cell: (assertion) => assertion.statementKind },
              {
                header: 'Confidence',
                cell: (assertion) =>
                  assertion.confidence === null ? <Pill tone="warning">unknown</Pill> : (
                    <Pill tone={assertion.confidence >= 0.95 ? 'positive' : 'warning'}>{assertion.confidence}</Pill>
                  ),
              },
            ]}
          />
        </div>
      </Panel>

      <Panel title="Unknowns — high-value missing information">
        <DataTable
          caption="Information gaps"
          testId="unknowns-table"
          rows={unknowns}
          rowKey={(unknown) => `${unknown.entityId}-${unknown.reason}`}
          emptyLabel="No information gaps in the current world projection."
          columns={[
            { header: 'Subject', cell: (unknown) => <code style={{ fontSize: '12px' }}>{unknown.entityId}</code> },
            { header: 'Gap', cell: (unknown) => unknown.reason },
          ]}
        />
        <div style={{ marginTop: `${SHELL_SPACING.md}px`, display: 'grid', gap: `${SHELL_SPACING.md}px`, maxWidth: '480px' }}>
          <Field label="Evidence note" htmlFor="evidence-note" hint="Captured as an observation record through evidence.intake (queueable offline).">
            <TextInput id="evidence-note" value={note} testId="evidence-note" onChange={setNote} />
          </Field>
          <Field label="Confidence (0-1)" htmlFor="evidence-confidence">
            <TextInput id="evidence-confidence" value={confidence} testId="evidence-confidence" onChange={setConfidence} />
          </Field>
          <div>
            <Button onClick={() => void captureEvidence()} testId="capture-evidence" ariaLabel="Capture evidence against the information gap">
              Capture evidence
            </Button>
          </div>
          {intakeResult === null ? null : intakeResult.ok ? (
            <SuccessNote testId="intake-success">
              Evidence admitted — digest{' '}
              <Digest value={((intakeResult.value.result as Record<string, unknown>)['receipt'] as Record<string, unknown>)['digest'] as string} label="evidence digest" />
              {intakeResult.value.replayed ? ' (replayed idempotently)' : ''}
            </SuccessNote>
          ) : (
            <ErrorBanner error={intakeResult.error} onRetry={() => void captureEvidence()} testId="intake-error" />
          )}
        </div>
      </Panel>

      <Panel title="Evidence records (subject artifact)">
        {knownEvidence === null ? (
          <Loading label="Looking up evidence…" />
        ) : (
          <DataTable
            caption="Evidence records"
            testId="evidence-table"
            rows={knownEvidence.map((record, index) => ({ record: record as Record<string, unknown>, index }))}
            rowKey={(row) => String(row.record['subject'] !== undefined ? (row.record['subject'] as Record<string, unknown>)['artifactId'] : row.index)}
            columns={[
              {
                header: 'Subject',
                cell: (row) => <code style={{ fontSize: '12px' }}>{String((row.record['subject'] as Record<string, unknown> | undefined)?.['artifactId'] ?? '—')}</code>,
              },
              { header: 'Kind', cell: (row) => String(row.record['kind']) },
              { header: 'Observed at', cell: (row) => String(row.record['observedAt']) },
              {
                header: 'Confidence',
                cell: (row) => String(((row.record['confidence'] as Record<string, unknown> | undefined)?.['distribution'] as Record<string, unknown> | undefined)?.['value'] ?? '—'),
              },
            ]}
          />
        )}
        <p style={{ color: '#57534e', fontSize: '13px', marginBottom: 0 }}>
          Fixture evidence digest: <Digest value={String(evidenceFile['evidenceDigest'])} label="fixture evidence digest" />
        </p>
      </Panel>
    </div>
  );
}
