'use client';

import type { ReactNode } from 'react';
import type { UnderstandViewModel, WorldEntityRow } from '../../../src/native/web';
import {
  ActionButton,
  Badge,
  BusyIndicator,
  DataTable,
  ErrorCard,
  GuidanceCard,
  JsonBlock,
  KeyValue,
  Mono,
  Panel,
  ResultCard,
} from '../ui-kit';
import { useProductAction } from '../use-product-action';
import type { SectionProps } from './section-props';

/**
 * J02 — understand / reconstruct.
 *
 * `inspectWorld({ evidenceDigest })` projects the world entities
 * (world.entities), the world digest (world.snapshot) and the fixture
 * evidence record (evidence.get) — the identical call the journey
 * runner drives. The view model separates knowns from known-unknowns.
 */
export function J02UnderstandSection({ ctx }: SectionProps): ReactNode {
  const action = useProductAction<UnderstandViewModel>();

  const inspect = async (): Promise<void> => {
    await action.run(() => ctx.product.inspectWorld({ evidenceDigest: ctx.bundle.evidenceDigest }));
  };

  const understood = action.outcome !== null && action.outcome.ok ? action.outcome.value : null;

  return (
    <>
      <Panel
        title="Inspect the world"
        hint="Projects the world entities and reads the fixture evidence record through the bridge (world.entities + world.snapshot + evidence.get)."
      >
        {!ctx.authenticated ? (
          <GuidanceCard>Authenticate to begin — world inspection needs a bound session.</GuidanceCard>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <ActionButton
            variant="primary"
            disabled={!ctx.authenticated || action.busy}
            onClick={() => void inspect()}
          >
            Inspect world
          </ActionButton>
          {action.busy ? <BusyIndicator label="Projecting the world entities…" /> : null}
        </div>
        {action.outcome !== null && !action.outcome.ok ? <ErrorCard error={action.outcome.error} /> : null}
      </Panel>

      {understood !== null ? (
        <>
          <ResultCard
            title={`World entities (${understood.entities.length})`}
            badge={
              understood.entities.length > 0 ? (
                <Badge tone="accent">{understood.entities.length} known</Badge>
              ) : (
                <Badge tone="warning">no entities</Badge>
              )
            }
          >
            <DataTable<WorldEntityRow>
              caption="world.entities projection"
              rows={understood.entities}
              emptyLabel="The world projection carries no entities."
              columns={[
                { header: 'entity id', cell: (row) => <Mono>{row.entityId}</Mono> },
                { header: 'type', cell: (row) => <Badge tone="mono">{row.entityType}</Badge> },
                { header: 'title', cell: (row) => row.title },
              ]}
            />
          </ResultCard>

          <ResultCard
            title="Known / unknown"
            badge={
              understood.unknowns.length === 0 ? (
                <Badge tone="success">no known-unknowns</Badge>
              ) : (
                <Badge tone="warning">{understood.unknowns.length} known-unknowns</Badge>
              )
            }
          >
            <DataTable<{ readonly entityId: string; readonly note: string }>
              caption="entities without a title property"
              rows={understood.unknowns}
              emptyLabel="Every entity carries a title — no known-unknowns in this world."
              columns={[
                { header: 'entity id', cell: (row) => <Mono>{row.entityId}</Mono> },
                { header: 'note', cell: (row) => row.note },
              ]}
            />
          </ResultCard>

          <ResultCard title="Evidence and world digests">
            <KeyValue label="world digest" value={<Mono>{understood.worldDigest ?? '—'}</Mono>} />
            <KeyValue label="evidence digest" value={<Mono>{understood.evidenceDigest ?? '—'}</Mono>} />
            {understood.evidenceRecord !== null ? (
              <JsonBlock label="evidence record (evidence.get)" value={understood.evidenceRecord} />
            ) : (
              <GuidanceCard>No evidence record was requested.</GuidanceCard>
            )}
          </ResultCard>
        </>
      ) : null}
    </>
  );
}
