'use client';
/**
 * @epoch/web — the home route surface (W047, J01).
 *
 * When a fresh user has no session: the entry surface (tenant/project
 * entry + sign-in). When active: the project context (context.resolve
 * through the gateway) and the lifecycle navigator overview — the J01
 * acceptance: a fresh user reaches a project and the navigator.
 */
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useSession } from '../src/client/session';
import { useGateway } from '../src/client/hooks';
import { EntryGate } from '../src/product/app-root';
import { Panel } from '../src/shared/components';
import { SHELL_SPACING } from '../src/shared/tokens';
import { Button, Digest, KeyValueGrid, Loading, Pill } from '../src/product/ui';
import { NAVIGATOR_STAGES } from '../src/product/shell';
import type { UiGatewayError } from '../src/product/types';

function ProjectOverview(): ReactNode {
  // The EntryGate guarantees an active session + loaded configuration
  // before this surface mounts (useGateway requires both).
  const { configuration, session } = useSession();
  const { call } = useGateway();
  const [node, setNode] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<UiGatewayError | null>(null);
  const [worldDigest, setWorldDigest] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const context = await call('context.resolve', { nodeId: configuration!.projectId });
      if (context.ok) {
        setNode(context.value.result as Record<string, unknown>);
      } else {
        setError(context.error);
      }
      const world = await call('world.snapshot', {});
      if (world.ok) {
        setWorldDigest((world.value.result as { digest: string }).digest);
      }
    })();
  }, [call, configuration]);

  const projectNode = (node?.['node'] ?? null) as Record<string, unknown> | null;

  return (
    <div data-route-surface="route:home" style={{ display: 'grid', gap: `${SHELL_SPACING.lg}px` }}>
      <Panel title="Project context">
        {projectNode === null && error === null ? (
          <Loading label="Resolving the project through the gateway…" />
        ) : (
          <KeyValueGrid
            testId="project-summary"
            rows={[
              { key: 'Project', value: String(projectNode?.['displayName'] ?? configuration!.projectId) },
              { key: 'Workspace', value: String(projectNode?.['parentId'] ?? configuration!.workspaceId) },
              { key: 'Tenant', value: configuration!.tenantId },
              { key: 'Solution', value: configuration!.solutionTitle },
              {
                key: 'Session principal',
                value: String(
                  configuration!.principals.find((entry) => entry.principalId === session?.principalId)?.displayName ??
                    session?.principalId ??
                    '',
                ),
              },
              {
                key: 'World digest (authoritative)',
                value: worldDigest === null ? <Loading label="…" /> : <Digest value={worldDigest} label="world snapshot digest" />,
              },
            ]}
          />
        )}
        {error === null ? null : <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>authority error: {error.message}</div>}
      </Panel>

      <Panel title="Solution Navigator">
        <p style={{ marginTop: 0, color: '#57534e' }}>
          The lifecycle spine of the project. Each stage is a synchronized projection — the world model,
          the solution records and the Action Gateway stay the authorities.
        </p>
        <ul data-testid="navigator-links" style={{ margin: 0, paddingLeft: `${SHELL_SPACING.xl}px`, display: 'grid', gap: `${SHELL_SPACING.xs}px` }}>
          {NAVIGATOR_STAGES.map((entry) => (
            <li key={entry.stage} data-stage-entry={entry.stage}>
              <a href={entry.path}>{entry.title}</a>
            </li>
          ))}
        </ul>
        <p style={{ marginBottom: 0, color: '#57534e', fontSize: '13px' }}>
          Plus <a href="/marketplace">Marketplace</a> and <a href="/developers">Developers</a> for capability
          acquisition (J10).
        </p>
      </Panel>

      <Panel title="Journey scenario contract">
        <p style={{ marginTop: 0, color: '#57534e', fontSize: '13px' }}>
          This deployment runs the deterministic W046 fixture set: every journey is reproducible, digest-anchored
          and idempotent. Offline captures queue as pending projections and drain through the gateway replay.
        </p>
        <KeyValueGrid
          rows={[
            { key: 'Fixture', value: <Pill tone="accent">{configuration!.fixtureId}</Pill> },
            { key: 'Scenario scripts', value: 'J07 offline sync · J08 cross-device handoff · J11 recovery' },
          ]}
        />
        <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
          <Button tone="secondary" onClick={() => window.location.reload()} testId="reload-authoritative" ariaLabel="Reload and re-resolve authoritative state">
            Reload (re-resolve authoritative state)
          </Button>
        </div>
      </Panel>
    </div>
  );
}

/** The home route. */
export default function Page(): ReactNode {
  return (
    <EntryGate>
      <ProjectOverview />
    </EntryGate>
  );
}
