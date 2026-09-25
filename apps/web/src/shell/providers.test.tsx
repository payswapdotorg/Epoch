// W014 shell providers: composition + tenant/session context propagation
// (rendered through react-dom/server — no DOM emulator in the frozen
// dependency catalog, and none needed).
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MissingSessionContextError,
  MissingTenantContextError,
  SessionProvider,
  ShellProviders,
  TenantProvider,
  useSessionContext,
  useTenantContext,
} from './providers';
import { REFERENCE_SESSION, REFERENCE_TENANT } from './bootstrap';

function TenantProbe() {
  const tenant = useTenantContext();
  return createElement('span', { 'data-tenant-probe': tenant.tenantId }, tenant.displayName);
}

function SessionProbe() {
  const session = useSessionContext();
  return createElement(
    'span',
    { 'data-session-probe': session.sessionId },
    session.principal === undefined ? 'anonymous' : session.principal.displayName,
  );
}

describe('shell providers', () => {
  it('composes tenant + session providers and propagates both contexts (positive)', () => {
    const html = renderToStaticMarkup(
      createElement(ShellProviders, {
        tenant: REFERENCE_TENANT,
        session: REFERENCE_SESSION,
        children: [
          createElement(TenantProbe, { key: 'tenant' }),
          createElement(SessionProbe, { key: 'session' }),
        ],
      }),
    );
    expect(html).toContain('data-tenant-probe="tenant:epoch-reference"');
    expect(html).toContain('Epoch Reference Tenant');
    expect(html).toContain('data-session-probe="session:reference-ada"');
    expect(html).toContain('Ada (Reference)');
  });

  it('each provider propagates its own context (positive)', () => {
    const tenantHtml = renderToStaticMarkup(
      createElement(TenantProvider, { value: REFERENCE_TENANT, children: createElement(TenantProbe) }),
    );
    expect(tenantHtml).toContain('tenant:epoch-reference');
    const sessionHtml = renderToStaticMarkup(
      createElement(SessionProvider, {
        value: REFERENCE_SESSION,
        children: createElement(SessionProbe),
      }),
    );
    expect(sessionHtml).toContain('session:reference-ada');
  });

  it('reading the tenant context outside its provider throws the TYPED error (negative)', () => {
    expect(() => renderToStaticMarkup(createElement(TenantProbe))).toThrowError(
      MissingTenantContextError,
    );
    try {
      renderToStaticMarkup(createElement(TenantProbe));
    } catch (error) {
      expect((error as MissingTenantContextError).code).toBe('missing-tenant-context');
    }
  });

  it('reading the session context outside its provider throws the TYPED error (negative)', () => {
    expect(() => renderToStaticMarkup(createElement(SessionProbe))).toThrowError(
      MissingSessionContextError,
    );
    try {
      renderToStaticMarkup(createElement(SessionProbe));
    } catch (error) {
      expect((error as MissingSessionContextError).code).toBe('missing-session-context');
    }
  });

  it('an anonymous session propagates too (provider neutrality: no auth logic inside)', () => {
    const html = renderToStaticMarkup(
      createElement(ShellProviders, {
        tenant: REFERENCE_TENANT,
        session: { schemaVersion: 1, sessionId: 'session:anon', state: 'anonymous' },
        children: createElement(SessionProbe),
      }),
    );
    expect(html).toContain('data-session-probe="session:anon"');
    expect(html).toContain('anonymous');
  });
});
