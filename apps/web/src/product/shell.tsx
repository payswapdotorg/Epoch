'use client';
/**
 * @epoch/web — the product shell (W047).
 *
 * The product's frame: header (brand + tenant/session badges + sign-out),
 * the lifecycle navigator (the Solution Navigator projection: Understand ->
 * Decide -> Plan -> Acquire -> Realize -> Observe -> Verify -> Forecast ->
 * Close -> Learn, plus Marketplace/Developers), the content region, and
 * the status region (fixture id, world digest anchor, offline-queue
 * state with drain — J07 — and the cross-device handoff ref — J08).
 * Semantic landmarks + keyboard navigable + visible focus throughout.
 */
import type { ReactNode } from 'react';
import { useSession } from '../client/session';
import { useOfflineQueue } from '../client/offline';
import { SHELL_COLORS, SHELL_LAYOUT, SHELL_SPACING, SHELL_TYPOGRAPHY } from '../shared/tokens';
import { Badge } from '../shared/components';
import { Button, Digest, Pill } from './ui';
/** The navigator stages in lifecycle order (the Solution Navigator spine). */
export const NAVIGATOR_STAGES: readonly { readonly stage: string; readonly path: string; readonly title: string }[] = [
  { stage: 'understand', path: '/understand', title: 'Understand' },
  { stage: 'decide', path: '/decide', title: 'Decide' },
  { stage: 'plan', path: '/plan', title: 'Plan' },
  { stage: 'acquire', path: '/acquire', title: 'Acquire' },
  { stage: 'realize', path: '/realize', title: 'Realize' },
  { stage: 'observe', path: '/observe', title: 'Observe / Actualize' },
  { stage: 'verify', path: '/verify', title: 'Verify' },
  { stage: 'forecast', path: '/forecast', title: 'Forecast' },
  { stage: 'close', path: '/close', title: 'Close' },
  { stage: 'learn', path: '/learn', title: 'Learn' },
];

const SECONDARY_NAV: readonly { readonly path: string; readonly title: string }[] = [
  { path: '/marketplace', title: 'Marketplace' },
  { path: '/developers', title: 'Developers' },
];

/** The active-link style hook. */
function isActive(path: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === path;
}

/** The product shell (client). Wraps the content region. */
export function ProductShell({ children }: { readonly children: ReactNode }): ReactNode {
  const { session, configuration, signOut } = useSession();
  // The SHARED offline-queue instance (D-03): the footer observes the same
  // state every stage enqueues into.
  const queue = useOfflineQueue();
  const pending = queue.intents.filter((intent) => intent.state === 'pending');
  const drained = queue.intents.filter((intent) => intent.state === 'drained');
  const principal = configuration?.principals.find((entry) => entry.principalId === session?.principalId);

  return (
    <div
      data-shell="epoch-web-product-1.0.0"
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
          flexWrap: 'wrap',
        }}
      >
        <a
          href="/"
          style={{ fontSize: SHELL_TYPOGRAPHY.sizeLg, fontWeight: SHELL_TYPOGRAPHY.weightSemibold, letterSpacing: '0.02em', color: SHELL_COLORS.textPrimary, textDecoration: 'none' }}
        >
          Epoch
        </a>
        {configuration === null ? null : (
          <>
            <Badge tone="accent">{configuration.displayName}</Badge>
            <Badge>{configuration.tenantId}</Badge>
          </>
        )}
        <span style={{ marginLeft: 'auto' }} />
        {session === null ? (
          <Badge>Anonymous session</Badge>
        ) : (
          <span data-session-badge style={{ display: 'flex', gap: `${SHELL_SPACING.sm}px`, alignItems: 'center' }}>
            <Badge tone="accent">{principal?.displayName ?? session.principalId}</Badge>
            <Button tone="secondary" onClick={() => void signOut()} testId="sign-out" ariaLabel="Sign out of the session">
              Sign out
            </Button>
          </span>
        )}
      </header>

      <nav
        data-region="navigation"
        aria-label="Solution Navigator"
        style={{
          background: SHELL_COLORS.surface,
          borderBottom: `1px solid ${SHELL_COLORS.border}`,
          padding: `${SHELL_SPACING.sm}px ${SHELL_SPACING.xl}px`,
          display: 'flex',
          gap: `${SHELL_SPACING.xs}px ${SHELL_SPACING.sm}px`,
          flexWrap: 'wrap',
        }}
      >
        {NAVIGATOR_STAGES.map((entry) => (
          <a
            key={entry.stage}
            data-stage-link={entry.stage}
            href={entry.path}
            aria-current={isActive(entry.path) ? 'page' : undefined}
            style={{
              padding: `${SHELL_SPACING.xs}px ${SHELL_SPACING.md}px`,
              borderRadius: '6px',
              textDecoration: 'none',
              color: isActive(entry.path) ? SHELL_COLORS.accentForeground : SHELL_COLORS.textPrimary,
              background: isActive(entry.path) ? SHELL_COLORS.accent : 'transparent',
              fontWeight: isActive(entry.path) ? SHELL_TYPOGRAPHY.weightSemibold : SHELL_TYPOGRAPHY.weightRegular,
              fontSize: SHELL_TYPOGRAPHY.sizeSm,
              border: `1px solid ${isActive(entry.path) ? SHELL_COLORS.accent : SHELL_COLORS.border}`,
              minHeight: '32px',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            {entry.title}
          </a>
        ))}
        <span aria-hidden="true" style={{ width: '1px', background: SHELL_COLORS.border, margin: `0 ${SHELL_SPACING.xs}px` }} />
        {SECONDARY_NAV.map((entry) => (
          <a
            key={entry.path}
            href={entry.path}
            aria-current={isActive(entry.path) ? 'page' : undefined}
            style={{
              padding: `${SHELL_SPACING.xs}px ${SHELL_SPACING.md}px`,
              borderRadius: '6px',
              textDecoration: 'none',
              color: isActive(entry.path) ? SHELL_COLORS.accentForeground : SHELL_COLORS.textSecondary,
              background: isActive(entry.path) ? SHELL_COLORS.accent : 'transparent',
              fontSize: SHELL_TYPOGRAPHY.sizeSm,
              border: `1px solid ${isActive(entry.path) ? SHELL_COLORS.accent : SHELL_COLORS.border}`,
              minHeight: '32px',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            {entry.title}
          </a>
        ))}
      </nav>

      <main
        data-region="content"
        style={{
          flex: 1,
          maxWidth: `${SHELL_LAYOUT.frameMaxWidth}px`,
          margin: '0 auto',
          padding: `${SHELL_SPACING.xl}px`,
          width: '100%',
          boxSizing: 'border-box',
          display: 'grid',
          gap: `${SHELL_SPACING.lg}px`,
          alignContent: 'start',
        }}
      >
        {children}
      </main>

      <footer
        data-region="status"
        style={{
          background: SHELL_COLORS.surface,
          borderTop: `1px solid ${SHELL_COLORS.border}`,
          padding: `${SHELL_SPACING.md}px ${SHELL_SPACING.xl}px`,
          display: 'flex',
          gap: `${SHELL_SPACING.md}px ${SHELL_SPACING.xl}px`,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginTop: 'auto',
          fontSize: SHELL_TYPOGRAPHY.sizeSm,
          color: SHELL_COLORS.textSecondary,
        }}
      >
        {configuration === null ? null : (
          <>
            <span data-fixture-id>fixture: {configuration.fixtureId}</span>
            <span data-world-digest style={{ display: 'inline-flex', gap: `${SHELL_SPACING.xs}px`, alignItems: 'center' }}>
              world <Digest value={configuration.anchors.worldDigest} label="authoritative world digest" />
            </span>
          </>
        )}
        {session === null ? null : (
          <span data-handoff-ref>
            session ref <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: SHELL_TYPOGRAPHY.sizeXs }}>{session.sessionId}</code>
          </span>
        )}
        <span data-queue-state style={{ display: 'inline-flex', gap: `${SHELL_SPACING.sm}px`, alignItems: 'center', marginLeft: 'auto' }}>
          {pending.length > 0 ? (
            <>
              <Pill tone="warning" testId="queue-pending-count">
                {pending.length} queued offline
              </Pill>
              <Button
                tone="primary"
                disabled={queue.draining}
                onClick={() => void queue.drain()}
                testId="drain-queue"
                ariaLabel="Drain the offline queue through the gateway replay"
              >
                {queue.draining ? 'Draining…' : 'Sync now'}
              </Button>
            </>
          ) : (
            <Pill tone={drained.length > 0 ? 'positive' : 'neutral'} testId="queue-state-pill">
              {drained.length > 0 ? `${drained.length} synced` : 'online'}
            </Pill>
          )}
        </span>
      </footer>
    </div>
  );
}
