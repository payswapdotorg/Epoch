'use client';
/**
 * @epoch/web — the entry surface (W047, J01 + J08 + J11).
 *
 * The fresh-user surface: choose the fixture environment (tenant/project
 * entry), authenticate as a registered principal, issue the gateway
 * session (J01); resume a session from another device through the handoff
 * ref (J08); and when a session expired, the re-authenticate recovery
 * state (J11) is the same surface with an expiry notice.
 */
import { useState, type ReactNode } from 'react';
import { useSession } from '../client/session';
import { Panel, PanelTitle } from '../shared/components';
import { SHELL_SPACING } from '../shared/tokens';
import { Button, ErrorBanner, Field, SelectInput, SuccessNote, TextInput } from './ui';
import type { ProductDomain } from './types';

const DOMAIN_OPTIONS: readonly { readonly value: ProductDomain; readonly label: string }[] = [
  { value: 'construction', label: 'Construction — Nordstrand (warehouse extension)' },
  { value: 'software', label: 'Software — Lightspeed (checkout v2)' },
];

const TTL_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '28800000', label: '8 hours' },
  { value: '3600000', label: '1 hour' },
  { value: '60000', label: '1 minute' },
];

const DOMAIN_PRINCIPALS: Readonly<Record<ProductDomain, readonly { readonly principalId: string; readonly displayName: string }[]>> = {
  construction: [
    { principalId: 'principal:delivery-lead', displayName: 'Delivery lead' },
    { principalId: 'principal:field-engineer', displayName: 'Field engineer' },
    { principalId: 'principal:chief-engineer', displayName: 'Chief engineer (approver)' },
  ],
  software: [
    { principalId: 'principal:tech-lead', displayName: 'Tech lead' },
    { principalId: 'principal:oncall-engineer', displayName: 'On-call engineer' },
    { principalId: 'principal:staff-engineer', displayName: 'Staff engineer (approver)' },
  ],
};

/** The entry surface. */
export function EntrySurface(): ReactNode {
  const { lifecycle, error, signIn, resumeSession } = useSession();
  const [domain, setDomain] = useState<ProductDomain>('construction');
  const [principalId, setPrincipalId] = useState<string>(DOMAIN_PRINCIPALS.construction[0]!.principalId);
  const [ttlMs, setTtlMs] = useState('3600000');
  const [handoffId, setHandoffId] = useState('');
  const [handoffDomain, setHandoffDomain] = useState<ProductDomain>('construction');
  const [handoffNote, setHandoffNote] = useState<string | null>(null);

  const principals = DOMAIN_PRINCIPALS[domain];

  return (
    <div data-route-surface="route:entry" style={{ display: 'grid', gap: `${SHELL_SPACING.lg}px`, maxWidth: '640px', margin: '0 auto' }}>
      <Panel title="Enter Epoch">
        <p data-entry-intro style={{ marginTop: 0, color: '#57534e' }}>
          The universal engineering lifecycle — Understand, Decide, Plan, Acquire, Realize, Observe/Actualize,
          Verify, Forecast, Close, Learn — as one synchronized projection. The world model stays the single
          authority; every action flows through the Action Gateway.
        </p>
        {lifecycle === 'expired' ? (
          <div style={{ marginBottom: `${SHELL_SPACING.md}px` }}>
            <ErrorBanner
              error={{
                schemaVersion: 1,
                class: 'auth-session-expired',
                code: 'session-expired',
                message: 'The session expired — re-authenticate to continue (recovery action: re-authenticate).',
                operation: 'session.validate',
                correlationId: 'corr:unattributed',
              }}
              testId="expired-notice"
            />
          </div>
        ) : null}
        {error === null ? null : (
          <div style={{ marginBottom: `${SHELL_SPACING.md}px` }}>
            <ErrorBanner error={error} testId="signin-error" />
          </div>
        )}
        <div style={{ display: 'grid', gap: `${SHELL_SPACING.md}px` }}>
          <Field label="Environment (tenant / project)" htmlFor="entry-domain">
            <SelectInput
              id="entry-domain"
              value={domain}
              testId="entry-domain"
              onChange={(value) => {
                setDomain(value as ProductDomain);
                setPrincipalId(DOMAIN_PRINCIPALS[value as ProductDomain][0]!.principalId);
              }}
              options={DOMAIN_OPTIONS}
            />
          </Field>
          <Field label="Sign in as" htmlFor="entry-principal" hint="Registered principals of the fixture identity registry.">
            <SelectInput
              id="entry-principal"
              value={principalId}
              testId="entry-principal"
              onChange={setPrincipalId}
              options={principals.map((entry) => ({ value: entry.principalId, label: entry.displayName }))}
            />
          </Field>
          <Field label="Session duration" htmlFor="entry-ttl" hint="Short durations exercise the expiry + re-authentication recovery path.">
            <SelectInput id="entry-ttl" value={ttlMs} testId="entry-ttl" onChange={setTtlMs} options={TTL_OPTIONS} />
          </Field>
          <div>
            <Button
              disabled={lifecycle === 'signing-in'}
              onClick={() => void signIn({ domain, principalId, ttlMs: Number(ttlMs) })}
              testId="sign-in"
              ariaLabel="Authenticate and issue a session through the gateway"
            >
              {lifecycle === 'signing-in' ? 'Signing in…' : 'Enter Epoch'}
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Resume on this device (cross-device handoff)">
        <p style={{ marginTop: 0, color: '#57534e', fontSize: '13px' }}>
          Resume a session issued on another device: the session reference is validated by the authority;
          the world projection resolves to the same authoritative digest (J08).
        </p>
        <div style={{ display: 'grid', gap: `${SHELL_SPACING.md}px` }}>
          <Field label="Session reference" htmlFor="handoff-session">
            <TextInput
              id="handoff-session"
              value={handoffId}
              testId="handoff-session"
              placeholder="session:…"
              onChange={setHandoffId}
            />
          </Field>
          <Field label="Environment of the session" htmlFor="handoff-domain">
            <SelectInput
              id="handoff-domain"
              value={handoffDomain}
              testId="handoff-domain"
              onChange={(value) => setHandoffDomain(value as ProductDomain)}
              options={DOMAIN_OPTIONS}
            />
          </Field>
          <div>
            <Button
              tone="secondary"
              disabled={handoffId === '' || lifecycle === 'signing-in'}
              onClick={() => {
                setHandoffNote(null);
                void resumeSession(handoffId, handoffDomain).then(() => setHandoffNote('resumed'));
              }}
              testId="handoff-resume"
              ariaLabel="Resume the session from the other device"
            >
              Resume session
            </Button>
          </div>
          {handoffNote === 'resumed' && error === null ? (
            <SuccessNote testId="handoff-success">Session resumed — authoritative state re-resolved.</SuccessNote>
          ) : null}
        </div>
      </Panel>
      <PanelTitle>&nbsp;</PanelTitle>
    </div>
  );
}
