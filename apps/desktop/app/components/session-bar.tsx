'use client';

import type { ReactNode } from 'react';
import type { FixtureDomain, SessionBarViewModel } from '../../src/native/web';
import { ActionButton, Badge, BusyIndicator, SegmentedToggle } from './ui-kit';
import { COLORS, FONTS, RADII, SPACE, TYPE } from './ui-tokens';

/**
 * The session bar (the desktop product header): who is acting, in which
 * tenant, over which gateway binding — plus the fixture-domain switch
 * (a fresh product root per domain) and the authenticate / sign-out
 * commands.
 */
export interface SessionBarProps {
  readonly domain: FixtureDomain;
  readonly onDomainChange: (domain: FixtureDomain) => void;
  readonly sessionBar: SessionBarViewModel | null;
  readonly composing: boolean;
  readonly authBusy: boolean;
  readonly onAuthenticate: () => void;
  readonly onSignOut: () => void;
}

const DOMAIN_OPTIONS: readonly { readonly value: FixtureDomain; readonly label: string }[] = [
  { value: 'construction', label: 'Construction' },
  { value: 'software', label: 'Software' },
];

export function SessionBar({
  domain,
  onDomainChange,
  sessionBar,
  composing,
  authBusy,
  onAuthenticate,
  onSignOut,
}: SessionBarProps): ReactNode {
  const authenticated = sessionBar !== null && sessionBar.state === 'active';
  return (
    <header
      style={{
        background: COLORS.surface,
        borderBottom: `1px solid ${COLORS.border}`,
        padding: `${SPACE.md}px ${SPACE.xl}px`,
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.lg,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
        <span
          aria-hidden="true"
          style={{
            width: 30,
            height: 30,
            borderRadius: RADII.sm,
            background: COLORS.accent,
            color: COLORS.accentInk,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: TYPE.sizeLg,
            fontFamily: FONTS.sans,
            letterSpacing: '-0.02em',
            flexShrink: 0,
          }}
        >
          E
        </span>
        <span
          style={{
            fontSize: TYPE.sizeLg,
            fontWeight: 600,
            letterSpacing: '0.01em',
            whiteSpace: 'nowrap',
          }}
        >
          Epoch Desktop
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.sm,
          flexWrap: 'wrap',
          minWidth: 0,
        }}
        aria-label="Session state"
      >
        {composing || sessionBar === null ? (
          <Badge tone="warning">composing product root…</Badge>
        ) : (
          <>
            <Badge tone={authenticated ? 'success' : 'neutral'}>{sessionBar.state}</Badge>
            <Badge tone="mono" title="principal">
              {sessionBar.principalId ?? 'principal:—'}
            </Badge>
            <Badge tone="mono" title="tenant">
              {sessionBar.tenantId ?? 'tenant:—'}
            </Badge>
            <Badge tone="mono" title="session">
              {sessionBar.sessionId ?? 'session:—'}
            </Badge>
            <Badge tone="accent" title="gateway binding mode">
              gateway: {sessionBar.gatewayMode ?? '—'}
            </Badge>
            {sessionBar.protocol !== null ? (
              <Badge tone="neutral" title="protocol versions">
                gw {sessionBar.protocol.gatewayContract} · host {sessionBar.protocol.hostProtocol}
              </Badge>
            ) : null}
          </>
        )}
      </div>

      <span style={{ marginLeft: 'auto' }} />

      <SegmentedToggle
        ariaLabel="Fixture domain"
        options={DOMAIN_OPTIONS}
        value={domain}
        onChange={onDomainChange}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
        <ActionButton
          variant="primary"
          disabled={composing || sessionBar === null || authBusy}
          onClick={onAuthenticate}
        >
          {authenticated ? 'Re-authenticate' : 'Authenticate'}
        </ActionButton>
        <ActionButton disabled={!authenticated || authBusy} onClick={onSignOut}>
          Sign out
        </ActionButton>
        {authBusy ? <BusyIndicator label="Issuing session…" /> : null}
      </div>
    </header>
  );
}
