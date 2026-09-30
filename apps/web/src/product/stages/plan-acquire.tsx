'use client';
/**
 * @epoch/web — the Plan + Acquire stage surfaces (W047, J05).
 *
 * Plan: the Program of Work (program.build over the sealed solution) and
 * the domain schedule / BOQ folds (program.schedule: quantity / cost /
 * resource / milestone schedules — the domain projection of the plan).
 * Acquire: the procurement chain (procurement.quote → procurement.order)
 * grounded on the kernel-sealed acquisition package.
 */
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useGateway } from '../../client/hooks';
import { Panel } from '../../shared/components';
import { SHELL_SPACING } from '../../shared/tokens';
import { Button, DataTable, Digest, ErrorBanner, KeyValueGrid, Pill, SuccessNote } from '../ui';
import { procurementOrderPayload, procurementQuotePayload, programContentPayload } from '../derivation';
import type { UiGatewayCallResult } from '../types';

/** One schedule fold as returned by the solution-delivery authority. */
interface ScheduleFold {
  readonly rows: readonly Record<string, unknown>[];
  readonly totals?: readonly Record<string, unknown>[];
}

/** Project an authority fold (`{rows, totals?}`) defensively (never invents rows). */
function asScheduleFold(value: unknown): ScheduleFold | null {
  if (typeof value !== 'object' || value === null || !Array.isArray((value as { rows?: unknown }).rows)) {
    return null;
  }
  const fold = value as { rows: unknown[]; totals?: unknown };
  return {
    rows: fold.rows.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null),
    totals: Array.isArray(fold.totals)
      ? fold.totals.filter((row): row is Record<string, unknown> => typeof row === 'object' && row !== null)
      : undefined,
  };
}

export function PlanStage(): ReactNode {
  const { configuration, call } = useGateway();
  const [programResult, setProgramResult] = useState<UiGatewayCallResult | null>(null);
  const [scheduleResult, setScheduleResult] = useState<UiGatewayCallResult | null>(null);
  const [busy, setBusy] = useState(false);

  const buildProgram = async (): Promise<void> => {
    setBusy(true);
    setProgramResult(null);
    // Build the program over the fixture baseline solution (the sealed
    // content equals the committed fixture solution byte-exactly).
    const sealed = configuration.records.solution;
    const result = await call('program.build', programContentPayload(configuration, sealed));
    setProgramResult(result);
    const schedule = await call('program.schedule', { program: result.ok ? result.value.result : configuration.records.program });
    setScheduleResult(schedule);
    setBusy(false);
  };

  // The schedule folds are the solution-delivery authority's own typed
  // shapes: QuantitySchedule / CostSchedule / MilestoneSchedule each carry
  // `rows` (+ `totals` / `counts`) — objects, never bare arrays (the UI
  // projects them; it never re-folds the program itself).
  const schedule = scheduleResult?.ok ? (scheduleResult.value.result as Record<string, unknown>) : null;
  const quantityFold = asScheduleFold(schedule?.['quantity']);
  const costFold = asScheduleFold(schedule?.['cost']);
  const milestoneFold = asScheduleFold(schedule?.['milestones']);
  const quantityRows = quantityFold?.rows ?? [];
  const quantityTotals = quantityFold?.totals ?? [];
  const costRows = costFold?.rows ?? [];
  const milestoneRows = milestoneFold?.rows ?? [];

  return (
    <div data-route-surface="route:plan" data-stage="plan" style={{ display: 'grid', gap: `${SHELL_SPACING.lg}px` }}>
      <Panel title="Program of work (the authoritative schedule dimension)">
        <p style={{ marginTop: 0, color: '#57534e' }}>
          The Program of Work is the authoritative schedule dimension; the BOQ and the domain schedule are
          deterministic folds over it (quantity / cost / resource / milestone schedules).
        </p>
        <div>
          <Button disabled={busy} onClick={() => void buildProgram()} testId="build-program" ariaLabel="Build the program of work over the sealed solution">
            {busy ? 'Building…' : 'Build program of work'}
          </Button>
        </div>
        {programResult === null ? null : programResult.ok ? (
          <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
            <KeyValueGrid
              testId="program-summary"
              rows={[
                { key: 'Program', value: String((programResult.value.result as Record<string, unknown>)['programId']) },
                { key: 'Content digest', value: <Digest value={String((programResult.value.result as Record<string, unknown>)['contentDigest'])} label="program digest" /> },
                { key: 'Solution version', value: String((programResult.value.result as Record<string, unknown>)['solutionVersion']) },
                { key: 'Replay', value: programResult.value.replayed ? 'replayed' : 'first application' },
              ]}
            />
          </div>
        ) : (
          <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
            <ErrorBanner error={programResult.error} testId="program-error" onRetry={() => void buildProgram()} />
          </div>
        )}
      </Panel>

      <Panel title="BOQ — quantity schedule fold">
        <DataTable
          caption="Quantity schedule (per activity)"
          testId="boq-quantity-table"
          rows={quantityRows as Record<string, unknown>[]}
          rowKey={(row) => `${String(row['activityId'])}:${String(row['unit'])}`}
          emptyLabel="Build the program to fold the BOQ."
          columns={[
            { header: 'Activity', cell: (row) => <code style={{ fontSize: '12px' }}>{String(row['activityId'])}</code> },
            { header: 'Work package', cell: (row) => String(row['workPackageId']) },
            { header: 'Unit', cell: (row) => String(row['unit']) },
            { header: 'Planned quantity', cell: (row) => String(row['plannedValue']) },
          ]}
        />
        <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
          <DataTable
            caption="Quantity totals (by unit)"
            testId="boq-totals-table"
            rows={quantityTotals as Record<string, unknown>[]}
            rowKey={(row) => String(row['unit'])}
            emptyLabel="—"
            columns={[
              { header: 'Unit', cell: (row) => String(row['unit']) },
              { header: 'Total', cell: (row) => String(row['totalValue']) },
            ]}
          />
        </div>
      </Panel>

      <Panel title="Domain schedule — cost + milestones">
        <DataTable
          caption="Cost schedule"
          testId="cost-table"
          rows={costRows as Record<string, unknown>[]}
          rowKey={(row) => `${String(row['activityId'])}:${String(row['currency'])}`}
          emptyLabel="Build the program to fold the cost schedule."
          columns={[
            { header: 'Activity', cell: (row) => <code style={{ fontSize: '12px' }}>{String(row['activityId'])}</code> },
            { header: 'Planned cost', cell: (row) => String(row['plannedAmount']) },
            { header: 'Currency', cell: (row) => String(row['currency']) },
          ]}
        />
        <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
          <DataTable
            caption="Milestone schedule"
            testId="milestone-table"
            rows={milestoneRows as Record<string, unknown>[]}
            rowKey={(row) => String(row['milestoneId'])}
            emptyLabel="—"
            columns={[
              { header: 'Milestone', cell: (row) => <code style={{ fontSize: '12px' }}>{String(row['milestoneId'])}</code> },
              { header: 'Title', cell: (row) => String(row['title']) },
              { header: 'Status', cell: (row) => <Pill tone={row['status'] === 'reached' ? 'positive' : 'neutral'}>{String(row['status'])}</Pill> },
              { header: 'Target', cell: (row) => String(row['targetDate'] ?? '—') },
            ]}
          />
        </div>
        {scheduleResult !== null && !scheduleResult.ok ? (
          <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
            <ErrorBanner error={scheduleResult.error} testId="schedule-error" />
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

export function AcquireStage(): ReactNode {
  const { configuration, call } = useGateway();
  const [quoteResult, setQuoteResult] = useState<UiGatewayCallResult | null>(null);
  const [orderResult, setOrderResult] = useState<UiGatewayCallResult | null>(null);
  const [busy, setBusy] = useState(false);

  const requestQuote = async (): Promise<void> => {
    setBusy(true);
    setQuoteResult(null);
    const result = await call('procurement.quote', procurementQuotePayload(configuration));
    setQuoteResult(result);
    setBusy(false);
  };

  const issueOrder = async (): Promise<void> => {
    setBusy(true);
    setOrderResult(null);
    const quote = quoteResult?.ok ? (quoteResult.value.result as Record<string, unknown>)['quote'] : null;
    if (quote === null || quote === undefined) {
      setBusy(false);
      return;
    }
    const result = await call('procurement.order', procurementOrderPayload(configuration, quote as never));
    setOrderResult(result);
    setBusy(false);
  };

  const procurement = configuration.templates.procurement as Record<string, unknown>;
  const quote = quoteResult?.ok ? ((quoteResult.value.result as Record<string, unknown>)['quote'] as Record<string, unknown>) : null;
  const order = orderResult?.ok ? ((orderResult.value.result as Record<string, unknown>)['order'] as Record<string, unknown>) : null;

  return (
    <div data-route-surface="route:acquire" data-stage="acquire" style={{ display: 'grid', gap: `${SHELL_SPACING.lg}px` }}>
      <Panel title="Acquisition — the procurement projection">
        <p style={{ marginTop: 0, color: '#57534e' }}>
          The acquisition chain: the kernel-sealed package (grounded on the BOQ line) → a supplier quote
          (procurement.quote) → the purchase order (procurement.order, grounded on the selection + commitment).
          Every step is a Gateway envelope; the procurement authority validates each grounding digest.
        </p>
        <KeyValueGrid
          testId="acquisition-chain"
          rows={[
            { key: 'Package', value: <code style={{ fontSize: '12px' }}>{String((procurement['package'] as Record<string, unknown>)['packageId'])}</code> },
            { key: 'Supplier', value: String(procurement['supplierId']) },
            { key: 'Package digest', value: <Digest value={String((procurement['package'] as Record<string, unknown>)['contentDigest'])} label="package digest" /> },
          ]}
        />
        <div style={{ marginTop: `${SHELL_SPACING.md}px`, display: 'flex', gap: `${SHELL_SPACING.sm}px`, flexWrap: 'wrap' }}>
          <Button disabled={busy} onClick={() => void requestQuote()} testId="request-quote" ariaLabel="Request and admit the supplier quote through the gateway">
            Request quote
          </Button>
          <Button tone="secondary" disabled={busy || quote === null} onClick={() => void issueOrder()} testId="issue-order" ariaLabel="Issue the purchase order grounded on the selection and commitment">
            Issue purchase order
          </Button>
        </div>
        <div style={{ marginTop: `${SHELL_SPACING.md}px`, display: 'grid', gap: `${SHELL_SPACING.md}px` }}>
          {quoteResult === null ? null : quoteResult.ok ? (
            <SuccessNote testId="quote-success">
              Quote admitted — <Digest value={String(quote?.['contentDigest'])} label="quote digest" /> (state: {String(quote?.['state'])}).
            </SuccessNote>
          ) : (
            <ErrorBanner error={quoteResult.error} testId="quote-error" onRetry={() => void requestQuote()} />
          )}
          {orderResult === null ? null : orderResult.ok ? (
            <SuccessNote testId="order-success">
              Purchase order admitted — <code style={{ fontSize: '12px' }}>{String(order?.['poId'])}</code>, grounded on the
              selection + commitment digests (the procurement authority validated every cross-reference).
            </SuccessNote>
          ) : (
            <ErrorBanner error={orderResult.error} testId="order-error" />
          )}
        </div>
      </Panel>
    </div>
  );
}
