'use client';

import type { ReactNode } from 'react';
import type { HandoffViewModel } from '../../../src/native/web';
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
 * J08 — cross-device handoff.
 *
 * `handoffView(registryWorldDigest)` resolves the world snapshot,
 * validates the session scope and admits the server projection into the
 * read-only cache; the export/import buttons drive the native
 * handoff descriptor through the host file dialogs (typed refusals in
 * dev-server browser mode — the packaged Tauri host provides the
    * dialogs).
 */
export function J08HandoffSection({ ctx }: SectionProps): ReactNode {
  const viewAction = useProductAction<HandoffViewModel>();
  const exportAction = useProductAction<{ readonly path: string }>();
  const importAction = useProductAction<{ readonly worldDigest: string | null }>();

  const resolve = async (): Promise<void> => {
    await viewAction.run(() => ctx.product.handoffView(ctx.bundle.worldDigest));
  };

  const exportHandoff = async (): Promise<void> => {
    await exportAction.run(() => ctx.product.exportHandoff('epoch-handoff.json'));
  };

  const importHandoff = async (): Promise<void> => {
    await importAction.run(() => ctx.product.importHandoff());
  };

  const handoff = viewAction.outcome !== null && viewAction.outcome.ok ? viewAction.outcome.value : null;

  return (
    <>
      <Panel
        title="Resolve the cross-device handoff"
        hint="Compares the resolved world digest against the fixture registry anchor, validates the session scope and admits the server projection into the read-only cache."
      >
        {!ctx.authenticated ? (
          <GuidanceCard>Authenticate to begin — the handoff view needs a bound session.</GuidanceCard>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <ActionButton
            variant="primary"
            disabled={!ctx.authenticated || viewAction.busy}
            onClick={() => void resolve()}
          >
            Resolve handoff view
          </ActionButton>
          <ActionButton
            disabled={!ctx.authenticated || exportAction.busy}
            onClick={() => void exportHandoff()}
          >
            Export handoff…
          </ActionButton>
          <ActionButton
            disabled={!ctx.authenticated || importAction.busy}
            onClick={() => void importHandoff()}
          >
            Import handoff…
          </ActionButton>
          {(viewAction.busy || exportAction.busy || importAction.busy) && (
            <BusyIndicator label="Resolving the handoff state…" />
          )}
        </div>
        <GuidanceCard>
          <span>
            The export/import buttons drive the native file dialogs (epoch-handoff.json). In dev-server browser
            mode the host refuses dialogs with the typed{' '}
            <span style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>dialog-unavailable</span>{' '}
            card — the packaged Tauri host provides the real pickers.
          </span>
        </GuidanceCard>
        {viewAction.outcome !== null && !viewAction.outcome.ok ? <ErrorCard error={viewAction.outcome.error} /> : null}
        {exportAction.outcome !== null && !exportAction.outcome.ok ? (
          <ErrorCard error={exportAction.outcome.error} />
        ) : null}
        {exportAction.outcome !== null && exportAction.outcome.ok ? (
          <KeyValue label="exported to" value={<Mono>{exportAction.outcome.value.path}</Mono>} />
        ) : null}
        {importAction.outcome !== null && !importAction.outcome.ok ? (
          <ErrorCard error={importAction.outcome.error} />
        ) : null}
        {importAction.outcome !== null && importAction.outcome.ok ? (
          <KeyValue
            label="imported world digest"
            value={<Mono>{importAction.outcome.value.worldDigest ?? '—'}</Mono>}
          />
        ) : null}
      </Panel>

      {handoff !== null ? (
        <ResultCard
          title="Handoff view"
          badge={
            handoff.digestsMatch === true ? (
              <Badge tone="success">digests match the registry</Badge>
            ) : handoff.digestsMatch === false ? (
              <Badge tone="danger">digest mismatch</Badge>
            ) : (
              <Badge tone="warning">digest equality not established</Badge>
            )
          }
        >
          <KeyValue label="world digest" value={<Mono>{handoff.worldDigest ?? '—'}</Mono>} />
          <KeyValue label="registry world digest" value={<Mono>{handoff.registryWorldDigest ?? '—'}</Mono>} />
          <KeyValue
            label="session scope"
            value={
              handoff.sessionScope === null ? (
                <span style={{ color: '#8a929c' }}>none (session not validated)</span>
              ) : (
                <span>
                  <Mono>{handoff.sessionScope.principalId}</Mono>
                  {' in '}
                  <Mono>{handoff.sessionScope.tenantId}</Mono>
                </span>
              )
            }
          />
          <KeyValue
            label="cached projection"
            value={
              handoff.cachedProjectionDigest === null ? (
                <span style={{ color: '#8a929c' }}>nothing admitted</span>
              ) : (
                <Mono>{handoff.cachedProjectionDigest}</Mono>
              )
            }
          />
          <KeyValue label="note" value={handoff.note} />
        </ResultCard>
      ) : null}
    </>
  );
}
