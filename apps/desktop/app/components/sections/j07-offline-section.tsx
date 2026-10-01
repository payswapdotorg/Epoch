'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { OfflineQueueViewModel } from '../../../src/native/web';
import {
  ActionButton,
  Badge,
  BusyIndicator,
  DataTable,
  ErrorCard,
  GuidanceCard,
  KeyValue,
  Mono,
  Panel,
  ResultCard,
} from '../ui-kit';
import { useProductAction } from '../use-product-action';
import type { SectionProps } from './section-props';

/**
 * J07 — offline work, queue, reconnect, idempotent sync.
 *
 * The network toggles (goOffline / goOnline), the offline-queue view
 * model and the drain through the gateway — the identical calls the
 * journey runner drives. While offline, queueable operations (action
 * submissions, evidence intake, delivery observations) enqueue as
 * PENDING projections — never applied locally; the sample intent button
 * plays the runner's enqueue step so the pending list is observable.
 */
export function J07OfflineSection({ ctx }: SectionProps): ReactNode {
  const [online, setOnline] = useState(ctx.product.online);
  const [view, setView] = useState<OfflineQueueViewModel | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const drainAction = useProductAction<OfflineQueueViewModel>();
  const enqueueAction = useProductAction<{ readonly queueId: string }>();
  const enqueueCounter = useRef(0);

  const refresh = useCallback((): void => {
    setOnline(ctx.product.online);
    setView(ctx.product.offlineQueueView());
  }, [ctx.product]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const goOffline = async (): Promise<void> => {
    setToggleBusy(true);
    setToggleError(null);
    try {
      await ctx.product.goOffline();
    } catch (cause) {
      setToggleError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setToggleBusy(false);
      refresh();
    }
  };

  const goOnline = async (): Promise<void> => {
    setToggleBusy(true);
    setToggleError(null);
    try {
      await ctx.product.goOnline();
    } catch (cause) {
      setToggleError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setToggleBusy(false);
      refresh();
    }
  };

  const enqueueSample = async (): Promise<void> => {
    enqueueCounter.current += 1;
    const index = enqueueCounter.current;
    await enqueueAction.run(() =>
      ctx.product.enqueueOfflineIntent({
        queueId: `queue:${ctx.scenario.domain}-ui-j07-${index}`,
        operation: 'delivery.observe',
        idempotencyKey: `idem:${ctx.scenario.domain}-ui-j07-sync-${index}`,
        payload: {
          solutionId: ctx.scenario.solutionId,
          program: ctx.bundle.files['program-of-work.json'],
          capture: ctx.scenario.fieldCapture(`ui-j07-capture-${index}`),
        },
      }),
    );
    refresh();
  };

  const drain = async (): Promise<void> => {
    await drainAction.run(() => ctx.product.drainOfflineQueue());
    refresh();
  };

  const queueView =
    view ?? {
      pending: [],
      drained: [],
      lastDrainAt: null,
      stillPendingCount: 0,
    };

  const drainedView = drainAction.outcome !== null && drainAction.outcome.ok ? drainAction.outcome.value : null;

  return (
    <>
      <Panel
        title="Offline queue and reconnect"
        hint="Go offline, enqueue pending projections, reconnect and drain them through the gateway with their idempotency keys — exactly once."
      >
        {!ctx.authenticated ? (
          <GuidanceCard>
            Authenticate to begin — the offline queue binds to a session (while unauthenticated the pending list
            stays empty).
          </GuidanceCard>
        ) : null}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Badge tone={online ? 'success' : 'warning'}>{online ? 'online' : 'offline'}</Badge>
          <ActionButton disabled={toggleBusy || !online} onClick={() => void goOffline()}>
            Go offline
          </ActionButton>
          <ActionButton
            variant="primary"
            disabled={toggleBusy || online}
            onClick={() => void goOnline()}
          >
            Go online
          </ActionButton>
          <ActionButton
            disabled={!ctx.authenticated || enqueueAction.busy}
            onClick={() => void enqueueSample()}
          >
            Enqueue sample observation
          </ActionButton>
          <ActionButton
            disabled={!ctx.authenticated || drainAction.busy}
            onClick={() => void drain()}
          >
            Drain queue
          </ActionButton>
          {(toggleBusy || enqueueAction.busy || drainAction.busy) && (
            <BusyIndicator label="Working the queue…" />
          )}
        </div>

        <GuidanceCard>
          <span>
            While offline, queueable gateway operations (action.submit, evidence.intake, delivery.observe) route
            to the durable offline queue as PENDING projections — never applied locally. The enqueue button
            plays the runner&apos;s J07 step; running an action (J04) while offline lands in the same queue.
            Reconnect and drain to replay each intent through the gateway with its idempotency key.
          </span>
        </GuidanceCard>

        {toggleError !== null ? <ErrorCard error={{ errorClass: 'exception', code: 'toggle-failure', message: toggleError, recoveryAction: 'retry-with-backoff' }} /> : null}
        {enqueueAction.outcome !== null && !enqueueAction.outcome.ok ? (
          <ErrorCard error={enqueueAction.outcome.error} />
        ) : null}
        {enqueueAction.outcome !== null && enqueueAction.outcome.ok ? (
          <KeyValue label="enqueued" value={<Mono>{enqueueAction.outcome.value.queueId}</Mono>} />
        ) : null}
        {drainAction.outcome !== null && !drainAction.outcome.ok ? (
          <ErrorCard error={drainAction.outcome.error} />
        ) : null}
      </Panel>

      <ResultCard
        title="Offline queue"
        badge={
          queueView.stillPendingCount === 0 ? (
            <Badge tone="success">no pending intents</Badge>
          ) : (
            <Badge tone="warning">{queueView.stillPendingCount} pending</Badge>
          )
        }
      >
        <KeyValue label="network" value={<Badge tone={online ? 'success' : 'warning'}>{online ? 'online' : 'offline'}</Badge>} />
        <KeyValue label="still pending" value={queueView.stillPendingCount} />
        <KeyValue label="last drain at" value={queueView.lastDrainAt ?? '—'} />

        <DataTable<{ readonly queueId: string; readonly operation: string; readonly state: string }>
          caption={`pending projections (${queueView.pending.length})`}
          rows={queueView.pending}
          emptyLabel="No pending intents — the queue is drained."
          columns={[
            { header: 'queue id', cell: (row) => <Mono>{row.queueId}</Mono> },
            { header: 'operation', cell: (row) => <Badge tone="mono">{row.operation}</Badge> },
            { header: 'state', cell: (row) => <Badge tone="warning">{row.state}</Badge> },
          ]}
        />

        <DataTable<{ readonly queueId: string; readonly outcomeDigest: string; readonly replayed: boolean }>
          caption={`drained intents (${queueView.drained.length})`}
          rows={queueView.drained}
          emptyLabel="Nothing has been drained yet."
          columns={[
            { header: 'queue id', cell: (row) => <Mono>{row.queueId}</Mono> },
            { header: 'idempotency key', cell: (row) => <Mono>{row.outcomeDigest}</Mono> },
            {
              header: 'replayed',
              cell: (row) => <Badge tone={row.replayed ? 'accent' : 'neutral'}>{row.replayed ? 'yes' : 'no'}</Badge>,
              width: '18%',
            },
          ]}
        />
      </ResultCard>

      {drainedView !== null ? (
        <ResultCard title="Drain outcome" badge={<Badge tone="success">drained through the gateway</Badge>}>
          <KeyValue label="pending after drain" value={drainedView.stillPendingCount} />
          <KeyValue label="last drain at" value={drainedView.lastDrainAt ?? '—'} />
        </ResultCard>
      ) : null}
    </>
  );
}
