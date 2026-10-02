'use client';
/**
 * @epoch/web — the Realize / Observe / Verify / Forecast / Close / Learn
 * stage surfaces (W047, J06 + J09).
 *
 * Realize: open the delivery record (delivery.open) + field observation
 * capture (delivery.observe — queueable offline, J07). Observe: the
 * observation ledger of this session + the rolling forecast
 * (actualization.forecast). Verify: the verification chain +
 * supervision.check + alerts.raise (J09 supervision/intervention).
 * Forecast: the rolling forecast projection. Close: delivery.close.
 * Learn: outcome.learn (the kernel-sealed outcome record).
 */
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useGateway } from '../../client/hooks';
import { useOfflineQueue } from '../../client/offline';
import { queueingCall } from '../../client/offline';
import { callGateway } from '../../client/transport';
import { envelope } from '../../client/envelopes';
import { Panel } from '../../shared/components';
import { SHELL_SPACING } from '../../shared/tokens';
import { Button, DataTable, Digest, ErrorBanner, Field, KeyValueGrid, Pill, SuccessNote, TextInput } from '../ui';
import {
  alertRaisePayload,
  deliveryObservePayload,
  deliveryOpenPayload,
  forecastPayload,
  outcomeLearnPayload,
  solutionAlternativeContents,
  supervisionCheckPayload,
  verificationChainPayload,
} from '../derivation';
import type { UiGatewayCallResult } from '../types';

const FIRST_ACTIVITY: Readonly<Record<string, string>> = {
  construction: 'activity:warehouse-excavation',
  software: 'activity:provision-repositories',
};

const MEASURE_UNIT: Readonly<Record<string, string>> = {
  construction: 'm3',
  software: 'points',
};

export function RealizeStage(): ReactNode {
  const { session, configuration, call } = useGateway();
  const queue = useOfflineQueue();
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [openResult, setOpenResult] = useState<UiGatewayCallResult | null>(null);
  const [quantity, setQuantity] = useState('118.5');
  const [observeResult, setObserveResult] = useState<UiGatewayCallResult | null>(null);
  const [observations, setObservations] = useState<Record<string, unknown>[]>([]);
  // The queued capture this surface is holding (J07): keyed by the intent's
  // idempotency key, resolved when the drain's AUTHORITATIVE replay outcome
  // arrives (never a locally minted success).
  const [queuedCapture, setQueuedCapture] = useState<{ idempotencyKey: string; captureKey: string } | null>(null);
  const queuedCaptureRef = useRef<{ idempotencyKey: string; captureKey: string } | null>(null);
  queuedCaptureRef.current = queuedCapture;
  const solutionFile = configuration.records.solution as Record<string, unknown>;

  const openDelivery = async (): Promise<void> => {
    setOpenResult(null);
    const nextId = `delivery:${configuration.domain}-web-${Date.now().toString(36)}`;
    setDeliveryId(nextId);
    const result = await call('delivery.open', deliveryOpenPayload(configuration, configuration.records.solution, nextId));
    setOpenResult(result);
  };

  const observe = async (): Promise<void> => {
    setObserveResult(null);
    const captureKey = `web-capture-${Date.now().toString(36)}`;
    const request = envelope(
      'delivery.observe',
      session,
      deliveryObservePayload(configuration, {
        solutionId: String(solutionFile['solutionId']),
        deliveryId: deliveryId ?? String((configuration.records.delivery as Record<string, unknown>)['deliveryId']),
        activityId: FIRST_ACTIVITY[configuration.domain]!,
        observedBy: session.principalId,
        quantity,
        unit: MEASURE_UNIT[configuration.domain]!,
        captureKey,
        program: configuration.records.program,
      }),
    );
    // Queueable intent: offline failures hold the capture as a pending
    // projection (J07) and drain through recovery.replay on reconnect.
    const result = await queueingCall(() => callGateway(request), queue.enqueue, request);
    setObserveResult(result);
    if (result.ok) {
      setQueuedCapture(null);
      setObservations((current) => [...current, result.value.result as Record<string, unknown>]);
    } else if (result.error.class === 'transient' && request.idempotencyKey !== undefined) {
      // The intent is held in the shared queue under this key; the surface
      // resolves it from the drain outcome below.
      setQueuedCapture({ idempotencyKey: request.idempotencyKey, captureKey });
    }
  };

  // J07 post-drain resolution: when the queued capture drains through
  // recovery.replay, the observation result + ledger update from the
  // AUTHORITATIVE replay outcome (the recorded outcomeDigest + replayed
  // flag — the same evidence the server returns, never minted locally).
  useEffect(() => {
    const held = queuedCaptureRef.current;
    if (held === null || queue.lastDrain === null) return;
    const intent = queue.intents.find((entry) => entry.idempotencyKey === held.idempotencyKey);
    if (intent === undefined || intent.state !== 'drained') return;
    const outcome = queue.lastDrain.outcomes.find((entry) => entry.queueId === intent.queueId);
    if (outcome === undefined || outcome.status !== 'drained') return;
    setQueuedCapture(null);
    setObserveResult({
      ok: true,
      value: {
        outcomeDigest: String(outcome.outcomeDigest ?? ''),
        replayed: outcome.replayed === true,
        result: { captureKey: held.captureKey, contentDigest: String(outcome.outcomeDigest ?? '') },
      } as never,
    });
    setObservations((current) => [
      ...current,
      { captureKey: held.captureKey, contentDigest: String(outcome.outcomeDigest ?? '') },
    ]);
  }, [queue.intents, queue.lastDrain]);

  return (
    <div data-route-surface="route:realize" data-stage="realize" style={{ display: 'grid', gap: `${SHELL_SPACING.lg}px` }}>
      <Panel title="Realize — open the delivery record">
        <p style={{ marginTop: 0, color: '#57534e' }}>
          The DeliveryRecord is the live delivery fact ledger for the approved solution. Opening grounds it on
          the sealed solution version digest.
        </p>
        <div>
          <Button onClick={() => void openDelivery()} testId="open-delivery" ariaLabel="Open a delivery record for the sealed solution">
            Open delivery record
          </Button>
        </div>
        {openResult === null ? null : openResult.ok ? (
          <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
            <KeyValueGrid
              testId="delivery-summary"
              rows={[
                { key: 'Delivery', value: <code style={{ fontSize: '12px' }}>{String((openResult.value.result as Record<string, unknown>)['deliveryId'])}</code> },
                { key: 'Status', value: <Pill tone="positive">open</Pill> },
                { key: 'Content digest', value: <Digest value={String((openResult.value.result as Record<string, unknown>)['contentDigest'])} label="delivery digest" /> },
              ]}
            />
          </div>
        ) : (
          <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
            <ErrorBanner error={openResult.error} testId="delivery-open-error" onRetry={() => void openDelivery()} />
          </div>
        )}
      </Panel>

      <Panel title="Field observation capture">
        <p style={{ marginTop: 0, color: '#57534e' }}>
          Low-friction field observation anchored on the program activity (delivery.observe). Offline captures
          queue as pending projections and replay idempotently through the gateway.
        </p>
        <div style={{ display: 'flex', gap: `${SHELL_SPACING.md}px`, alignItems: 'end', flexWrap: 'wrap', maxWidth: '560px' }}>
          <Field label={`Observed quantity (${MEASURE_UNIT[configuration.domain]})`} htmlFor="observe-quantity">
            <TextInput id="observe-quantity" value={quantity} testId="observe-quantity" onChange={setQuantity} />
          </Field>
          <Button onClick={() => void observe()} testId="capture-observation" ariaLabel="Capture the field observation">
            Capture observation
          </Button>
        </div>
        {observeResult === null ? null : observeResult.ok ? (
          <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
            <SuccessNote testId="observe-success">
              Observation admitted (digest <Digest value={String((observeResult.value.result as Record<string, unknown>)['contentDigest'] ?? observeResult.value.outcomeDigest)} label="observation digest" />)
              {observeResult.value.replayed ? ' — replayed idempotently' : ''}.
            </SuccessNote>
          </div>
        ) : (
          <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
            <ErrorBanner error={observeResult.error} testId="observe-error" onRetry={() => void observe()} />
          </div>
        )}
        <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
          <DataTable
            caption="Session observation ledger"
            testId="observation-table"
            rows={observations}
            rowKey={(row) => String(row['captureKey'] ?? row['capture'] ?? Math.random())}
            emptyLabel="No observations captured in this session yet."
            columns={[
              { header: 'Capture', cell: (row) => <code style={{ fontSize: '12px' }}>{String((row['capture'] as Record<string, unknown> | undefined)?.['captureKey'] ?? row['captureKey'] ?? '—')}</code> },
              { header: 'Digest', cell: (row) => <Digest value={String(row['contentDigest'] ?? '—')} label="observation digest" /> },
            ]}
          />
        </div>
      </Panel>
    </div>
  );
}

export function ObserveStage(): ReactNode {
  const { session, configuration, call } = useGateway();
  const [actuals, setActuals] = useState('40');
  const [factor, setFactor] = useState('1.1');
  const [forecastResult, setForecastResult] = useState<UiGatewayCallResult | null>(null);
  const solutionFile = configuration.records.solution as Record<string, unknown>;

  const roll = async (): Promise<void> => {
    setForecastResult(null);
    const result = await call(
      'actualization.forecast',
      forecastPayload(configuration, {
        solutionId: String(solutionFile['solutionId']),
        activityId: FIRST_ACTIVITY[configuration.domain]!,
        plannedValue: '120',
        actualsValue: actuals,
        unit: MEASURE_UNIT[configuration.domain]!,
        performanceFactor: factor,
        recordedBy: session.principalId,
      }),
    );
    setForecastResult(result);
  };

  const forecast = forecastResult?.ok ? (forecastResult.value.result as Record<string, unknown>) : null;

  return (
    <div data-route-surface="route:observe" data-stage="observe" style={{ display: 'grid', gap: `${SHELL_SPACING.lg}px` }}>
      <Panel title="Observe / Actualize — the rolling forecast">
        <p style={{ marginTop: 0, color: '#57534e' }}>
          Actualization folds the observed actuals against the plan and rolls the completion projection
          (remaining = max(0, planned − actuals); at-completion = actuals + remaining × factor — exact decimals).
        </p>
        <div style={{ display: 'flex', gap: `${SHELL_SPACING.md}px`, alignItems: 'end', flexWrap: 'wrap', maxWidth: '640px' }}>
          <Field label={`Actuals to date (${MEASURE_UNIT[configuration.domain]})`} htmlFor="actuals-value">
            <TextInput id="actuals-value" value={actuals} testId="actuals-value" onChange={setActuals} />
          </Field>
          <Field label="Performance factor" htmlFor="factor-value">
            <TextInput id="factor-value" value={factor} testId="factor-value" onChange={setFactor} />
          </Field>
          <Button onClick={() => void roll()} testId="roll-forecast" ariaLabel="Roll the forecast revision">
            Roll forecast
          </Button>
        </div>
        {forecastResult === null ? null : forecastResult.ok ? (
          <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
            <KeyValueGrid
              testId="forecast-summary"
              rows={[
                { key: 'Remaining', value: String(forecast?.['remaining']) },
                { key: 'At completion', value: String(forecast?.['atCompletion']) },
                { key: 'Factor', value: String(forecast?.['performanceFactor']) },
                { key: 'Plan exhausted', value: String(forecast?.['planExhausted']) },
              ]}
            />
          </div>
        ) : (
          <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
            <ErrorBanner error={forecastResult.error} testId="forecast-error" onRetry={() => void roll()} />
          </div>
        )}
      </Panel>
    </div>
  );
}

export function VerifyStage(): ReactNode {
  const { session, configuration, call } = useGateway();
  const [chainResult, setChainResult] = useState<UiGatewayCallResult | null>(null);
  const [supervisionResult, setSupervisionResult] = useState<UiGatewayCallResult | null>(null);
  const [alertResult, setAlertResult] = useState<UiGatewayCallResult | null>(null);
  const evidenceFile = configuration.records.evidence as Record<string, unknown>;
  const solutionFile = configuration.records.solution as Record<string, unknown>;

  const validateChain = async (): Promise<void> => {
    setChainResult(null);
    const result = await call(
      'verification.validateChain',
      verificationChainPayload(configuration, {
        evidenceRecord: evidenceFile['record'] as never,
        evidenceDigest: String(evidenceFile['evidenceDigest']),
        solutionId: String(solutionFile['solutionId']),
        approverId: configuration.templates.action.approverPrincipal,
      }),
    );
    setChainResult(result);
  };

  const supervise = async (): Promise<void> => {
    setSupervisionResult(null);
    setAlertResult(null);
    const result = await call(
      'supervision.check',
      supervisionCheckPayload(configuration, {
        program: configuration.records.program,
        delivery: configuration.records.delivery,
        evaluatedBy: session.principalId,
      }),
    );
    setSupervisionResult(result);
  };

  const raiseAlert = async (): Promise<void> => {
    setAlertResult(null);
    if (!supervisionResult?.ok) return;
    const findings = (supervisionResult.value.result as Record<string, unknown>)['findings'] as Record<string, unknown>[];
    if (findings === undefined || findings.length === 0) return;
    const result = await call(
      'alerts.raise',
      alertRaisePayload(configuration, {
        finding: findings[0]! as never,
        raisedBy: session.principalId,
      }),
    );
    setAlertResult(result);
  };

  const findings = supervisionResult?.ok
    ? ((supervisionResult.value.result as Record<string, unknown>)['findings'] as Record<string, unknown>[] | undefined) ?? []
    : [];

  return (
    <div data-route-surface="route:verify" data-stage="verify" style={{ display: 'grid', gap: `${SHELL_SPACING.lg}px` }}>
      <Panel title="Verify — the verification chain">
        <div>
          <Button onClick={() => void validateChain()} testId="verify-chain" ariaLabel="Validate the verification chain through the verification authority">
            Validate chain
          </Button>
        </div>
        {chainResult === null ? null : chainResult.ok ? (
          (() => {
            // The authority's own verdict decides the note (P06 finding:
            // never claim validation the authority did not grant).
            const outcome = chainResult.value.result as Record<string, unknown>;
            if (outcome['ok'] === true) {
              return (
                <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
                  <SuccessNote testId="verify-success">Chain admitted by the verification authority (requirements, claims, methods, runs, evidence, results, approvals all validated).</SuccessNote>
                </div>
              );
            }
            const issues = Array.isArray(outcome['issues']) ? (outcome['issues'] as Record<string, unknown>[]) : [];
            return (
              <div data-testid="verify-rejected" style={{ marginTop: `${SHELL_SPACING.md}px` }}>
                <Pill tone="negative">verification authority rejected the chain</Pill>
                <ul style={{ margin: `${SHELL_SPACING.xs}px 0 0`, paddingLeft: '20px', color: '#57534e', fontSize: '13px' }}>
                  {issues.slice(0, 5).map((issue, index) => (
                    <li key={index}><code>{String(issue['code'])}</code> — {String(issue['message'])}</li>
                  ))}
                </ul>
              </div>
            );
          })()
        ) : (
          <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
            <ErrorBanner error={chainResult.error} testId="verify-error" />
          </div>
        )}
      </Panel>

      <Panel title="Supervision — delivery pass + intervention (J09)">
        <p style={{ marginTop: 0, color: '#57534e' }}>
          The supervision pass evaluates the program + delivery against the default thresholds; findings raise
          alerts through the alerts authority, and pending agent actions are intervened on through the Action
          Gateway approval path (see Decide).
        </p>
        <div style={{ display: 'flex', gap: `${SHELL_SPACING.sm}px`, flexWrap: 'wrap' }}>
          <Button onClick={() => void supervise()} testId="run-supervision" ariaLabel="Run the delivery supervision pass">
            Run supervision pass
          </Button>
          <Button tone="secondary" disabled={findings.length === 0} onClick={() => void raiseAlert()} testId="raise-alert" ariaLabel="Raise an alert for the first supervision finding">
            Raise alert (first finding)
          </Button>
        </div>
        <div style={{ marginTop: `${SHELL_SPACING.md}px`, display: 'grid', gap: `${SHELL_SPACING.md}px` }}>
          {supervisionResult === null ? null : supervisionResult.ok ? (
            <DataTable
              caption="Supervision findings"
              testId="findings-table"
              rows={findings}
              rowKey={(finding) => String(finding['findingId'])}
              emptyLabel="No findings — the delivery is within thresholds."
              columns={[
                { header: 'Finding', cell: (finding) => <code style={{ fontSize: '12px' }}>{String(finding['findingId'])}</code> },
                { header: 'Class', cell: (finding) => <Pill tone="warning">{String(finding['findingClass'])}</Pill> },
                { header: 'Title', cell: (finding) => String(finding['title']) },
              ]}
            />
          ) : (
            <ErrorBanner error={supervisionResult.error} testId="supervision-error" />
          )}
          {alertResult === null ? null : alertResult.ok ? (
            <SuccessNote testId="alert-success">Alert raised through the alerts authority (escalation policy applied).</SuccessNote>
          ) : (
            <ErrorBanner error={alertResult.error} testId="alert-error" />
          )}
        </div>
      </Panel>
    </div>
  );
}

export function ForecastStage(): ReactNode {
  return (
    <div data-route-surface="route:forecast" data-stage="forecast" style={{ display: 'grid', gap: `${SHELL_SPACING.lg}px` }}>
      <Panel title="Forecast — completion projection">
        <p style={{ marginTop: 0, color: '#57534e' }}>
          The rolling forecast of the Observe/Actualize stage is the completion projection of the delivery —
          run it there (Observe / Actualize) and the same projection appears here (the stage surfaces are
          synchronized projections of the same authorities).
        </p>
        <div>
          <Button tone="secondary" onClick={() => { window.location.href = '/observe'; }} testId="goto-observe" ariaLabel="Open the observe and actualize stage">
            Open Observe / Actualize
          </Button>
        </div>
      </Panel>
    </div>
  );
}

export function CloseStage(): ReactNode {
  const { configuration, call } = useGateway();
  const [closeResult, setCloseResult] = useState<UiGatewayCallResult | null>(null);

  const close = async (): Promise<void> => {
    setCloseResult(null);
    const result = await call('delivery.close', {
      delivery: configuration.records.delivery,
      closing: {
        schema: 'epoch.solution-delivery.delivery-closing',
        schemaVersion: 1,
        closedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z'),
        closedBy: configuration.committedAuthentication.principalId,
        outcome: 'delivered',
        note: 'web close-stage delivery closing',
      },
    });
    setCloseResult(result);
  };

  const alternatives = solutionAlternativeContents(configuration);
  void alternatives;

  return (
    <div data-route-surface="route:close" data-stage="close" style={{ display: 'grid', gap: `${SHELL_SPACING.lg}px` }}>
      <Panel title="Close — the delivery closing">
        <p style={{ marginTop: 0, color: '#57534e' }}>
          The closing records the delivery outcome (delivered) through the solution-delivery authority. The
          fixture delivery record (open, grounded on the fixture solution) is the closing subject.
        </p>
        <div>
          <Button onClick={() => void close()} testId="close-delivery" ariaLabel="Close the delivery record with the delivered outcome">
            Close delivery
          </Button>
        </div>
        {closeResult === null ? null : closeResult.ok ? (
          <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
            <KeyValueGrid
              testId="close-summary"
              rows={[
                { key: 'Status', value: <Pill tone="positive">{String((closeResult.value.result as Record<string, unknown>)['status'])}</Pill> },
                { key: 'Digest', value: <Digest value={String((closeResult.value.result as Record<string, unknown>)['contentDigest'])} label="closed delivery digest" /> },
              ]}
            />
          </div>
        ) : (
          <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
            <ErrorBanner error={closeResult.error} testId="close-error" onRetry={() => void close()} />
          </div>
        )}
      </Panel>
    </div>
  );
}

export function LearnStage(): ReactNode {
  const { configuration, call } = useGateway();
  const [learnResult, setLearnResult] = useState<UiGatewayCallResult | null>(null);
  const solutionFile = configuration.records.solution as Record<string, unknown>;

  const learn = async (): Promise<void> => {
    setLearnResult(null);
    const result = await call('outcome.learn', outcomeLearnPayload(configuration, String(solutionFile['solutionId'])));
    setLearnResult(result);
  };

  return (
    <div data-route-surface="route:learn" data-stage="learn" style={{ display: 'grid', gap: `${SHELL_SPACING.lg}px` }}>
      <Panel title="Learn — outcome registration">
        <p style={{ marginTop: 0, color: '#57534e' }}>
          The outcome record (kernel-sealed W036 distinction record) registers the delivery outcome with the
          learning-calibration authority — the input to outcome learning and prediction calibration.
        </p>
        <div>
          <Button onClick={() => void learn()} testId="register-outcome" ariaLabel="Register the outcome record with the learning authority">
            Register outcome
          </Button>
        </div>
        {learnResult === null ? null : learnResult.ok ? (
          <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
            <SuccessNote testId="learn-success">
              Outcome registered (store now holds{' '}
              the learning store accepted the record).
            </SuccessNote>
          </div>
        ) : (
          <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
            <ErrorBanner error={learnResult.error} testId="learn-error" />
          </div>
        )}
      </Panel>
    </div>
  );
}

