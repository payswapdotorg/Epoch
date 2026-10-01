'use client';

import type { ReactNode } from 'react';
import type { ProjectEntryViewModel } from '../../../src/native/web';
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
 * J01 — onboard / project entry.
 *
 * `enterProject(projectId)` resolves the tenancy context
 * (context.resolve) and the world snapshot (world.snapshot) through the
 * bridge — the identical call the journey runner drives.
 */
export function J01ProjectSection({ ctx }: SectionProps): ReactNode {
  const action = useProductAction<ProjectEntryViewModel>();

  const enter = async (): Promise<void> => {
    await action.run(() => ctx.product.enterProject(ctx.binding.projectId));
  };

  const digestMatchesRegistry =
    action.outcome !== null && action.outcome.ok && action.outcome.value.worldDigest === ctx.bundle.worldDigest;

  return (
    <>
      <Panel
        title="Enter the project"
        hint="Resolves the tenancy node and the world snapshot through the embedded Application Gateway (context.resolve + world.snapshot)."
      >
        {!ctx.authenticated ? (
          <GuidanceCard>Authenticate to begin — project entry needs a bound session.</GuidanceCard>
        ) : null}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <ActionButton
            variant="primary"
            disabled={!ctx.authenticated || action.busy}
            onClick={() => void enter()}
          >
            Enter project
          </ActionButton>
          {action.busy ? <BusyIndicator label="Resolving the tenancy context…" /> : null}
        </div>
        {action.outcome !== null && !action.outcome.ok ? <ErrorCard error={action.outcome.error} /> : null}
      </Panel>

      {action.outcome !== null && action.outcome.ok ? (
        <ResultCard
          title="Project entry"
          badge={
            digestMatchesRegistry ? (
              <Badge tone="success">world digest matches the fixture registry</Badge>
            ) : (
              <Badge tone="warning">world digest differs from the registry</Badge>
            )
          }
        >
          <KeyValue label="node kind" value={<Badge tone="accent">{action.outcome.value.nodeKind}</Badge>} />
          <KeyValue label="node id" value={<Mono>{action.outcome.value.nodeId}</Mono>} mono />
          <KeyValue
            label="parent"
            value={
              action.outcome.value.parentId === null ? (
                <span style={{ color: '#8a929c' }}>none (root)</span>
              ) : (
                <Mono>{action.outcome.value.parentId}</Mono>
              )
            }
          />
          <KeyValue label="world digest" value={<Mono>{action.outcome.value.worldDigest ?? '—'}</Mono>} />
          <KeyValue label="entities" value={action.outcome.value.entityCount ?? '—'} />
          <KeyValue label="relations" value={action.outcome.value.relationCount ?? '—'} />
        </ResultCard>
      ) : null}
    </>
  );
}
