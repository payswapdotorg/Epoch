'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ObservationRow, RealizeViewModel } from '../../../src/native/web';
import {
  ActionButton,
  Badge,
  BusyIndicator,
  DataTable,
  ErrorCard,
  FieldLabel,
  GuidanceCard,
  JsonBlock,
  KeyValue,
  Mono,
  Panel,
  ResultCard,
  TextArea,
} from '../ui-kit';
import { parseJsonInput, useProductAction } from '../use-product-action';
import { deliveryContentFor, uiVerificationChain } from '../ui-scenarios';
import type { SectionProps } from './section-props';

/**
 * J06 — realize, field observation, actualization, verification, close.
 *
 * Fixture-driven realize over the runner's J06 pattern: an empty
 * textarea uses the fixture-derived delivery record (delivery
 * `delivery:ui-j06-001`, solutionId/version/digest from the sealed
 * fixture solution); the single observation uses the runner's
 * field-capture shape (delivery ids pointing at the UI delivery). The
 * forecast, verification chain and closing record are the plain
 * reference payloads — every semantic value still flows through the
 * solution-delivery / execution-tracking / actualization authorities.
 */
export function J06RealizeSection({ ctx }: SectionProps): ReactNode {
  const [deliveryText, setDeliveryText] = useState('');
  const action = useProductAction<RealizeViewModel>();

  const deliveryEmpty = deliveryText.trim() === '';

  const realize = async (): Promise<void> => {
    const trimmed = deliveryText.trim();
    let deliveryContent: unknown = deliveryContentFor(ctx.bundle, ctx.scenario);
    if (trimmed !== '') {
      const parsed = parseJsonInput('The delivery record content', trimmed);
      if (!parsed.ok) {
        action.fail(parsed.error);
        return;
      }
      deliveryContent = parsed.value;
    }
    await action.run(() =>
      ctx.product.realizeDelivery({
        deliveryContent,
        observations: [
          {
            solutionId: ctx.scenario.solutionId,
            capture: ctx.scenario.fieldCapture('ui-capture-1'),
            program: ctx.bundle.files['program-of-work.json'],
          },
        ],
        forecastInput: ctx.scenario.forecastInput(),
        verificationChain: uiVerificationChain(),
        closing: ctx.scenario.deliveryClosing(),
      }),
    );
  };

  const realized = action.outcome !== null && action.outcome.ok ? action.outcome.value : null;

  return (
    <>
      <Panel
        title="Realize the delivery"
        hint="Opens the delivery record, intakes one field observation, rolls the forecast, validates the chain and closes — all through the authorities."
      >
        {!ctx.authenticated ? (
          <GuidanceCard>Authenticate to begin — delivery realization needs a bound session.</GuidanceCard>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <FieldLabel>Delivery record content (JSON) — empty uses the fixture-derived delivery</FieldLabel>
            <TextArea
              id="j06-delivery"
              ariaLabel="Delivery record content JSON override"
              value={deliveryText}
              onChange={setDeliveryText}
              placeholder='{ "schema": "epoch.solution-delivery.delivery-record", … } — leave empty to derive the delivery from the sealed fixture solution'
              rows={7}
            />
          </div>
          {deliveryEmpty ? (
            <GuidanceCard>
              <span>
                The fixture-derived default opens delivery <span style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace" }}>delivery:ui-j06-001</span>{' '}
                (solutionId / version / digest from the sealed fixture solution) and observes once with the
                runner&apos;s field-capture shape. Paste your own delivery record to override.
              </span>
            </GuidanceCard>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <ActionButton
              variant="primary"
              disabled={!ctx.authenticated || action.busy}
              onClick={() => void realize()}
            >
              Run realize delivery
            </ActionButton>
            {action.busy ? <BusyIndicator label="Opening, observing, forecasting, closing…" /> : null}
          </div>
        </div>
        {action.outcome !== null && !action.outcome.ok ? <ErrorCard error={action.outcome.error} /> : null}
      </Panel>

      {realized !== null ? (
        <>
          <ResultCard
            title="Delivery realization"
            badge={
              <>
                <Badge tone="accent">{realized.deliveryId ?? 'delivery'}</Badge>
                {realized.closed ? <Badge tone="success">closed</Badge> : <Badge tone="warning">open</Badge>}
              </>
            }
          >
            <KeyValue label="delivery id" value={<Mono>{realized.deliveryId ?? '—'}</Mono>} />
            <KeyValue label="observations" value={realized.observations.length} />
            <KeyValue label="closed" value={realized.closed ? 'yes — delivery.close accepted' : 'no'} />
          </ResultCard>

          <ResultCard title={`Field observations (${realized.observations.length})`}>
            <DataTable<ObservationRow>
              caption="delivery.observe intake records"
              rows={realized.observations}
              emptyLabel="No observations were intaken."
              columns={[
                { header: 'observation', cell: (row) => <Mono>{row.observationId}</Mono> },
                { header: 'subject', cell: (row) => <Mono>{row.subject}</Mono> },
                { header: 'measure', cell: (row) => <Mono>{row.measure}</Mono> },
                { header: 'at', cell: (row) => row.at, width: '24%' },
              ]}
            />
          </ResultCard>

          <ResultCard title="Forecast and verification">
            <JsonBlock label="rolling forecast (actualization.forecast)" value={realized.forecast} />
            {realized.verification !== null ? (
              <JsonBlock label="verification chain outcome" value={realized.verification} />
            ) : (
              <GuidanceCard>No verification chain was supplied.</GuidanceCard>
            )}
          </ResultCard>
        </>
      ) : null}
    </>
  );
}
