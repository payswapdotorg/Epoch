'use client';
/**
 * @epoch/web — the Marketplace + Developers surfaces (W047, J10).
 *
 * The marketplace capability flow: the entitlement check through the
 * gateway (marketplace.entitlement — the marketplace kernel decides over
 * the deployment's grant ledger); an entitled capability pack becomes an
 * installable candidate visible in capability discovery (J03). The
 * developer surface: the developer's capability contributions and their
 * approval state through the Action Gateway (action.status — the
 * developer/marketplace capability flow's approval leg).
 */
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useGateway } from '../client/hooks';
import { Panel } from '../shared/components';
import { SHELL_SPACING } from '../shared/tokens';
import { Button, DataTable, Digest, ErrorBanner, KeyValueGrid, Loading, Pill, SuccessNote } from './ui';
import { entitlementCheckPayload } from './derivation';
import type { UiGatewayCallResult } from './types';

export function MarketplaceStage(): ReactNode {
  const { configuration, call } = useGateway();
  const [checkResult, setCheckResult] = useState<UiGatewayCallResult | null>(null);
  const ledger = configuration.templates.entitlementLedger as Record<string, unknown>;

  const check = async (): Promise<void> => {
    setCheckResult(null);
    const result = await call('marketplace.entitlement', entitlementCheckPayload(configuration));
    setCheckResult(result);
  };

  const entitled = checkResult?.ok === true;

  return (
    <div data-route-surface="route:marketplace" data-stage="marketplace" style={{ display: 'grid', gap: `${SHELL_SPACING.lg}px` }}>
      <Panel title="Marketplace — capability entitlement">
        <p style={{ marginTop: 0, color: '#57534e' }}>
          The entitlement check is decided by the marketplace authority over the tenant&apos;s grant ledger (the
          deployment provides the grants; the kernel decides — immediate revocation semantics, no grace).
        </p>
        <KeyValueGrid
          testId="marketplace-listing"
          rows={[
            { key: 'Listing', value: String(ledger['listingTitle']) },
            { key: 'Listing id', value: <code style={{ fontSize: '12px' }}>{String(ledger['listingId'])}</code> },
            { key: 'Grants', value: `${(ledger['grants'] as unknown[]).length} (tenant scope)` },
          ]}
        />
        <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
          <Button onClick={() => void check()} testId="check-entitlement" ariaLabel="Check the capability entitlement through the marketplace authority">
            Check entitlement
          </Button>
        </div>
        {checkResult === null ? (
          <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
            <Loading label="Run the entitlement check to resolve the capability state." />
          </div>
        ) : checkResult.ok ? (
          <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
            <SuccessNote testId="entitlement-success">
              Entitled — the capability pack is installed for this tenant; its candidates participate in capability
              discovery (see Decide).
            </SuccessNote>
          </div>
        ) : (
          <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
            <ErrorBanner error={checkResult.error} testId="entitlement-error" onRetry={() => void check()} />
          </div>
        )}
      </Panel>

      <Panel title="Installed capability packs">
        <DataTable
          caption="Installed capability packs"
          testId="capability-pack-table"
          rows={[{ pack: String(ledger['listingTitle']), state: entitled ? 'entitled' : 'unresolved' }]}
          rowKey={(row) => row.pack}
          columns={[
            { header: 'Pack', cell: (row) => row.pack },
            { header: 'Entitlement', cell: (row) => <Pill tone={row.state === 'entitled' ? 'positive' : 'neutral'}>{row.state}</Pill> },
            {
              header: 'Discovery',
              cell: () => (
                <a href="/decide" data-testid="discovery-link">
                  participates in discovery
                </a>
              ),
            },
          ]}
        />
      </Panel>
    </div>
  );
}

export function DevelopersStage(): ReactNode {
  const { session, call } = useGateway();
  const [actions, setActions] = useState<Record<string, unknown>[] | null>(null);
  const [error, setError] = useState<UiGatewayCallResult | null>(null);

  useEffect(() => {
    void (async () => {
      const status = await call('action.status', {});
      if (status.ok) {
        const result = status.value.result;
        setActions(Array.isArray(result) ? (result as Record<string, unknown>[]) : [result as Record<string, unknown>]);
      } else {
        setError(status);
      }
    })();
  }, [call, session.sessionId]);

  return (
    <div data-route-surface="route:developers" data-stage="developers" style={{ display: 'grid', gap: `${SHELL_SPACING.lg}px` }}>
      <Panel title="Developers — capability contribution flow">
        <p style={{ marginTop: 0, color: '#57534e' }}>
          Developer contributions flow through the Action Gateway: a capability submission is an action proposal
          (action.submit), the marketplace approval leg is the human-approval flow (action.approve), and the live
          approval state is readable here (action.status — read-only through the gateway).
        </p>
        {error !== null && !error.ok ? (
          <div style={{ marginBottom: `${SHELL_SPACING.md}px` }}>
            <ErrorBanner error={error.error} testId="actions-error" />
          </div>
        ) : null}
        {actions === null ? (
          <Loading label="Reading the action stream through the gateway…" />
        ) : (
          <DataTable
            caption="Action Gateway stream (this tenant)"
            testId="action-status-table"
            rows={actions}
            rowKey={(action) => String(action['actionId'] ?? Math.random())}
            emptyLabel="No actions submitted in this tenant yet (submit one on Decide)."
            columns={[
              { header: 'Action', cell: (action) => <code style={{ fontSize: '12px' }}>{String(action['actionId'] ?? '—')}</code> },
              { header: 'Type', cell: (action) => String((action['actionType'] as Record<string, unknown> | undefined)?.['id'] ?? '—') },
              {
                header: 'Status',
                cell: (action) => {
                  const status = String(action['status'] ?? '—');
                  return <Pill tone={status === 'authorized' ? 'positive' : status === 'denied' || status === 'rejected' ? 'negative' : 'warning'}>{status}</Pill>;
                },
              },
              { header: 'Digest', cell: (action) => <Digest value={String(action['decisionDigest'] ?? '—')} label="decision digest" /> },
            ]}
          />
        )}
        <p style={{ color: '#57534e', fontSize: '13px', marginBottom: 0 }}>
          The developer/marketplace boundary: contributions are capability-scoped and never become semantic
          authorities; entitlement is separate from payment-processor state (lock rule 11).
        </p>
      </Panel>
    </div>
  );
}
