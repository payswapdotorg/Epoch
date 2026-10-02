/**
 * @epoch/web shell WORLD MOUNT (W057 — the world route/mount, the ONLY
 * shell surface this Work Order touches).
 *
 * The typed registration of the interactive world as the PRIMARY Epoch
 * problem-solving surface:
 *
 * - the world ROUTE (`route:world`, path `/world` — bootstrap.ts) joins
 *   the built-in registry right after home;
 * - the world FEATURE descriptor registers the world feature at the
 *   shell's Experience mounts: the SCENE slot (the viewport — 2d/3d/
 *   animation/timeline-replay/presence graph kinds) plus the CONTENT
 *   region, with the CONTROLS slot for the candidate/action controls;
 * - `createWorldShell` assembles the reference shell WITH the world
 *   feature registered (the isolation law holds: features enter only
 *   through explicit descriptor registration — src/shell/mounting.ts —
 *   never through imports; the shell still compiles with the features
 *   tree absent, pinned by isolation.test.ts).
 *
 * The App Router PAGE (`app/world/page.tsx`) that renders the feature's
 * WorldWorkspace component belongs to the app-owner surface (W014/W047);
 * this module + the route descriptor are everything the shell owns.
 */
import type { ReactNode } from 'react';
import { Panel, PanelTitle } from '../shared/components';
import { SHELL_SPACING } from '../shared/tokens';
import {
  createReferenceShell,
  type ReferenceShell,
} from './bootstrap';
import { ExperienceSurfaces, FeatureMountsRegion } from './frame';
import type { FeatureDescriptor } from './mounting';
import type { SessionContextValue } from './session';
import type { TenantContextValue } from './tenancy';
import { SHELL_RECORD_VERSION } from './version';

/** The world feature id (the mounting-seam grammar: feature:<slug>). */
export const WORLD_FEATURE_ID = 'feature:world' as const;

/**
 * The world feature descriptor: the interactive-world workspace occupying
 * the shell's Experience scene slot (the viewport), the content region,
 * and the controls slot (candidate/action controls).
 */
export function worldFeatureDescriptor(): FeatureDescriptor {
  return {
    schemaVersion: SHELL_RECORD_VERSION,
    featureId: WORLD_FEATURE_ID,
    displayName: 'Interactive World',
    version: '1.0.0',
    mounts: [
      {
        mountId: 'mount:scene',
        required: true,
        experienceGraphKinds: ['2d', '3d', 'animation', 'timeline-replay', 'presence'],
      },
      {
        mountId: 'mount:controls',
        required: true,
        experienceGraphKinds: ['controls'],
      },
      {
        mountId: 'mount:content',
        required: false,
      },
    ],
  };
}

/** The world route's page metadata. */
export function worldMetadata(): { readonly title: string } {
  return { title: 'World — Epoch' };
}

/**
 * The reference shell WITH the world feature registered (the world
 * route/mount, fully typed). The world route resolves; the feature
 * registers through the mounting seam only.
 */
export function createWorldShell(options?: {
  readonly tenant?: TenantContextValue | undefined;
  readonly session?: SessionContextValue | undefined;
}): ReferenceShell {
  return createReferenceShell({
    tenant: options?.tenant,
    session: options?.session,
    features: [worldFeatureDescriptor()],
  });
}

/** The world route surface: the shell-owned mount frame of the world route. */
export function WorldRouteSurface({
  shell,
  session,
}: {
  readonly shell: ReferenceShell;
  readonly session: SessionContextValue;
}): ReactNode {
  const route = shell.routes.resolve('route:world');
  if (!route.ok) {
    return (
      <Panel title="Unavailable route">
        <p style={{ marginTop: 0 }}>
          The world route is not wired in this shell.
        </p>
      </Panel>
    );
  }
  const worldFeature = shell.features.resolve(WORLD_FEATURE_ID);
  return (
    <div
      data-route-surface="route:world"
      data-world-mounted={worldFeature.ok ? 'true' : 'false'}
      data-principal={session.principal?.principalId ?? 'session:anonymous'}
      style={{ display: 'grid', gap: `${SHELL_SPACING.lg}px` }}
    >
      <Panel>
        <PanelTitle>The primary workspace</PanelTitle>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>
          {route.value.title}
        </h1>
        <p style={{ marginBottom: 0 }}>
          The interactive spatial world — the primary Epoch problem-solving
          surface. The renderer fabric presents the canonical world
          projection; the lifecycle stages remain secondary context.
        </p>
      </Panel>
      <Panel title="Experience surfaces">
        <ExperienceSurfaces mounts={shell.mounts} />
      </Panel>
      <Panel title="Feature mounts">
        <FeatureMountsRegion mounts={shell.mounts} features={shell.features} mountId="mount:content" />
      </Panel>
    </div>
  );
}
