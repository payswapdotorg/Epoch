'use client';

import type { ReactNode } from 'react';
import type { RelaunchViewModel } from '../../../src/native/web';
import {
  ActionButton,
  Badge,
  BusyIndicator,
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
 * J12 — install → launch → work → close → relaunch → update.
 *
 * `relaunchView(null)` restores the persisted session / queue /
 * projection-cache from durable state and runs the update check. No
 * update channel is wired into this build, so the null candidate is
 * refused by the protocol gate (the typed envelope-malformed refusal —
 * honest product behavior, never a silent pass); the packaged build
 * checks a real updater candidate instead.
 */
export function J12RelaunchSection({ ctx }: SectionProps): ReactNode {
  const action = useProductAction<RelaunchViewModel>();

  const relaunch = async (): Promise<void> => {
    await action.run(() => ctx.product.relaunchView(null));
    // restoreSession re-binds the session — the session bar must re-read it.
    ctx.refreshSession();
  };

  const relaunchView = action.outcome !== null && action.outcome.ok ? action.outcome.value : null;

  return (
    <>
      <Panel
        title="Simulate relaunch"
        hint="Restores the persisted session, the offline queue and the projection cache from durable host state, then runs the update compatibility check."
      >
        {!ctx.authenticated ? (
          <GuidanceCard>
            Authenticate to begin — with no session persisted, the relaunch restore reports nothing restored
            (re-authentication is the J11 recovery path).
          </GuidanceCard>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <ActionButton
            variant="primary"
            disabled={action.busy}
            onClick={() => void relaunch()}
          >
            Simulate relaunch
          </ActionButton>
          {action.busy ? <BusyIndicator label="Restoring persisted state…" /> : null}
        </div>
        <GuidanceCard>
          <span>
            The update check receives a null candidate in this build (no update channel wired): the protocol
            gate refuses it with the typed{' '}
            <span style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>envelope-malformed</span>{' '}
            refusal — incompatible envelopes are never opened, never partially applied.
          </span>
        </GuidanceCard>
        {action.outcome !== null && !action.outcome.ok ? <ErrorCard error={action.outcome.error} /> : null}
      </Panel>

      {relaunchView !== null ? (
        <ResultCard
          title="Relaunch state"
          badge={
            relaunchView.sessionRestored ? (
              <Badge tone="success">session restored</Badge>
            ) : (
              <Badge tone="warning">session not restored</Badge>
            )
          }
        >
          <KeyValue label="session restored" value={relaunchView.sessionRestored ? 'yes' : 'no'} />
          <KeyValue label="queue restored" value={`${relaunchView.queueRestoredCount} intent(s)`} />
          <KeyValue label="projections restored" value={`${relaunchView.projectionsRestoredCount} entr(ies)`} />
          <KeyValue
            label="update check"
            value={
              <Badge
                tone={
                  relaunchView.updateCheck === 'compatible'
                    ? 'success'
                    : relaunchView.updateCheck === 'refused'
                      ? 'danger'
                      : 'neutral'
                }
              >
                {relaunchView.updateCheck}
              </Badge>
            }
          />
          <KeyValue
            label="refusal reason"
            value={relaunchView.updateRefusalReason ?? '—'}
          />
        </ResultCard>
      ) : null}

      {relaunchView !== null && relaunchView.appMeta !== null ? (
        <ResultCard title="App meta (host handshake)">
          <KeyValue label="product version" value={<Mono>{relaunchView.appMeta.productVersion}</Mono>} />
          <KeyValue label="host protocol" value={<Mono>{relaunchView.appMeta.hostProtocolVersion}</Mono>} />
          <KeyValue
            label="gateway contract"
            value={<Mono>{relaunchView.appMeta.gatewayContractVersion}</Mono>}
          />
          <KeyValue label="platform" value={<Mono>{relaunchView.appMeta.platform}</Mono>} />
          <KeyValue label="locale" value={<Mono>{relaunchView.appMeta.locale}</Mono>} />
        </ResultCard>
      ) : null}
    </>
  );
}
