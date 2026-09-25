/**
 * @epoch/web shell app frame (W014).
 *
 * The composition surface of the shell: header / navigation / content /
 * status regions (the frame regions of the mounting-point contract), the
 * permission-gated navigation list, the Experience mount placeholders
 * (scene surface, narrative/status surface, candidate/action controls —
 * spec/experience-architecture.md), and the feature-mount placeholders of
 * the content region.
 *
 * Server component by design (App Router conventions): the frame is a pure
 * function of typed props — no hooks, no client state. Client context is
 * established ONCE by the shell providers (`src/shell/providers.tsx`).
 * Styling comes exclusively from the shared design tokens.
 */
import type { ReactNode } from 'react';
import { Badge, EmptySlot } from '../shared/components';
import {
  SHELL_COLORS,
  SHELL_LAYOUT,
  SHELL_RADII,
  SHELL_SPACING,
  SHELL_TYPOGRAPHY,
} from '../shared/tokens';
import { visibleRoutes } from './navigation';
import { featuresAtMount, type FeatureSet, type MountRegistry } from './mounting';
import type { RouteDescriptor, RouteRegistry } from './routes';
import type { SessionContextValue } from './session';
import type { TenantContextValue } from './tenancy';
import { EXPERIENCE_SLOT_IDS, SHELL_CONTRACT_VERSION, type ExperienceSlotId } from './version';

/** AppFrame props: the typed shell state the frame renders. */
export interface AppFrameProps {
  readonly routes: RouteRegistry;
  readonly mounts: MountRegistry;
  readonly features: FeatureSet;
  readonly tenant: TenantContextValue;
  readonly session: SessionContextValue;
  readonly children: ReactNode;
}

/** The shell frame: composition, never authority. */
export function AppFrame({
  routes,
  mounts,
  features,
  tenant,
  session,
  children,
}: AppFrameProps): ReactNode {
  const nav = visibleRoutes(routes, session, tenant);
  return (
    <div
      data-shell={`epoch-web-shell-${SHELL_CONTRACT_VERSION}`}
      style={{
        background: SHELL_COLORS.background,
        color: SHELL_COLORS.textPrimary,
        fontFamily: SHELL_TYPOGRAPHY.fontFamily,
        fontSize: SHELL_TYPOGRAPHY.sizeMd,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      <HeaderRegion tenant={tenant} session={session} />
      <NavigationRegion routes={nav} />
      <main data-region="content" role="main" style={{ flex: 1, maxWidth: `${SHELL_LAYOUT.frameMaxWidth}px`, margin: '0 auto', padding: `${SHELL_SPACING.xl}px`, width: '100%', boxSizing: 'border-box' }}>
        {children}
      </main>
      <StatusRegion mounts={mounts} features={features} />
    </div>
  );
}

/** The header region: brand, tenant badge, session badge. */
export function HeaderRegion({
  tenant,
  session,
}: {
  readonly tenant: TenantContextValue;
  readonly session: SessionContextValue;
}): ReactNode {
  return (
    <header
      data-region="header"
      style={{
        background: SHELL_COLORS.surface,
        borderBottom: `1px solid ${SHELL_COLORS.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: `${SHELL_SPACING.md}px`,
        padding: `0 ${SHELL_SPACING.xl}px`,
        minHeight: `${SHELL_LAYOUT.headerHeight}px`,
      }}
    >
      <span
        style={{
          fontSize: SHELL_TYPOGRAPHY.sizeLg,
          fontWeight: SHELL_TYPOGRAPHY.weightSemibold,
          letterSpacing: '0.02em',
        }}
      >
        Epoch
      </span>
      <Badge tone="accent">{tenant.displayName}</Badge>
      <Badge>{tenant.tenantId}</Badge>
      <span style={{ marginLeft: 'auto' }} />
      <Badge>
        {session.principal === undefined ? 'Anonymous session' : session.principal.displayName}
      </Badge>
    </header>
  );
}

/** The navigation region: the permission-gated route list (deterministic order). */
export function NavigationRegion({
  routes,
}: {
  readonly routes: readonly RouteDescriptor[];
}): ReactNode {
  return (
    <nav
      data-region="navigation"
      aria-label="Solution Navigator"
      style={{
        background: SHELL_COLORS.surface,
        borderBottom: `1px solid ${SHELL_COLORS.border}`,
        display: 'flex',
        flexWrap: 'wrap',
        gap: `${SHELL_SPACING.sm}px`,
        padding: `${SHELL_SPACING.md}px ${SHELL_SPACING.xl}px`,
      }}
    >
      {routes.map((route) => (
        <a
          key={route.routeId}
          data-route-id={route.routeId}
          href={route.path}
          style={{
            color: SHELL_COLORS.textSecondary,
            textDecoration: 'none',
            borderRadius: `${SHELL_RADII.sm}px`,
            border: `1px solid transparent`,
            padding: `${SHELL_SPACING.xs}px ${SHELL_SPACING.sm}px`,
            fontSize: SHELL_TYPOGRAPHY.sizeSm,
          }}
        >
          {route.title}
        </a>
      ))}
    </nav>
  );
}

/** The status region: shell version + mounting summary (deterministic). */
export function StatusRegion({
  mounts,
  features,
}: {
  readonly mounts: MountRegistry;
  readonly features: FeatureSet;
}): ReactNode {
  const summary = `Epoch shell v${SHELL_CONTRACT_VERSION} · ${mounts.listMounts().length} mounts · ${features.listFeatures().length} features`;
  return (
    <footer
      data-region="status"
      style={{
        background: SHELL_COLORS.surface,
        borderTop: `1px solid ${SHELL_COLORS.border}`,
        color: SHELL_COLORS.textMuted,
        fontSize: SHELL_TYPOGRAPHY.sizeSm,
        padding: `${SHELL_SPACING.md}px ${SHELL_SPACING.xl}px`,
      }}
    >
      {summary}
    </footer>
  );
}

/** One Experience mount placeholder (scene / narrative / controls). */
export function ExperienceMountPlaceholder({
  mounts,
  slot,
}: {
  readonly mounts: MountRegistry;
  readonly slot: ExperienceSlotId;
}): ReactNode {
  const mount = mounts.experienceSlot(slot);
  if (!mount.ok) {
    return <EmptySlot label={`Experience slot '${slot}' is not exposed by this shell`} />;
  }
  const kindNote = mount.value.acceptedGraphKinds.join(', ');
  return (
    <div data-experience-slot={slot}>
      <EmptySlot
        label={`Experience ${slot} surface (mount:${slot})`}
        hint={`hosts graph kinds: ${kindNote} — awaiting renderer wiring`}
      />
    </div>
  );
}

/** The three Experience mount surfaces in canonical slot order (empty in W014). */
export function ExperienceSurfaces({ mounts }: { readonly mounts: MountRegistry }): ReactNode {
  return (
    <div
      data-experience-surfaces=""
      style={{
        display: 'grid',
        gap: `${SHELL_SPACING.lg}px`,
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      }}
    >
      {EXPERIENCE_SLOT_IDS.map((slot) => (
        <ExperienceMountPlaceholder key={slot} mounts={mounts} slot={slot} />
      ))}
    </div>
  );
}

/** The feature-mount placeholders of one mounting point (empty state when unoccupied). */
export function FeatureMountsRegion({
  mounts,
  features,
  mountId,
}: {
  readonly mounts: MountRegistry;
  readonly features: FeatureSet;
  readonly mountId: string;
}): ReactNode {
  const mount = mounts.resolve(mountId);
  if (!mount.ok) {
    return <EmptySlot label={`Unknown mount '${mountId}'`} />;
  }
  const mounted = featuresAtMount(features, mountId);
  if (mounted.length === 0) {
    return (
      <div data-mount-empty={mountId}>
        <EmptySlot
          label={`No features mounted at ${mountId} yet`}
          hint="features register explicitly through the shell mounting seam"
        />
      </div>
    );
  }
  return (
    <div data-mount-occupied={mountId} style={{ display: 'flex', flexWrap: 'wrap', gap: `${SHELL_SPACING.sm}px` }}>
      {mounted.map((feature) => (
        <span key={feature.featureId} data-feature={feature.featureId}>
          <Badge>
            {feature.displayName} v{feature.version}
          </Badge>
        </span>
      ))}
    </div>
  );
}
