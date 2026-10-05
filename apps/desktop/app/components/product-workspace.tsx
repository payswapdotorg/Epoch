'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { FixtureDomain, HostAppMeta, SessionBarViewModel } from '../../src/native/web';
import { composeProductRoot } from './product-root';
import type { ProductRoot } from './product-root';
import { SECTIONS } from './sections/registry';
import type { SectionId } from './sections/registry';
import type { WorkspaceContext } from './sections/section-props';
import { SolutionWorkspace } from './construction/solution-workspace';
import { SessionBar } from './session-bar';
import { StatusStrip } from './status-strip';
import { ActionButton, ErrorCard, GuidanceCard, Spinner } from './ui-kit';
import { thrownToUiError } from './use-product-action';
import type { UiActionError } from './use-product-action';
import { UI_SCENARIOS } from './ui-scenarios';
import { COLORS, FONTS, RADII, SPACE, TYPE } from './ui-tokens';
import { useViewport } from './use-viewport';

/**
 * The desktop product workspace (W048).
 *
 * Composes the product root ONCE per mount (never during prerender —
 * static export pre-renders this page) and renders the two-region
 * desktop window UI: the session bar on top, the journey-section rail +
 * main pane in the middle, the status strip at the bottom. Remounting
 * with a fresh key per fixture domain rebuilds the entire root — a
 * fresh embedded gateway per domain switch.
 */
export interface ProductWorkspaceProps {
  readonly domain: FixtureDomain;
  readonly onDomainChange: (domain: FixtureDomain) => void;
}

type ComposePhase =
  | { readonly phase: 'composing' }
  | { readonly phase: 'ready' }
  | { readonly phase: 'failed'; readonly message: string };

export function ProductWorkspace({ domain, onDomainChange }: ProductWorkspaceProps): ReactNode {
  const [root, setRoot] = useState<ProductRoot | null>(null);
  const [compose, setCompose] = useState<ComposePhase>({ phase: 'composing' });
  const [composeAttempt, setComposeAttempt] = useState(0);
  const [sessionBar, setSessionBar] = useState<SessionBarViewModel | null>(null);
  const [appMeta, setAppMeta] = useState<HostAppMeta | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<UiActionError | null>(null);
  // W073 (ACR-012): the CONSTRUCTION SOLUTION world is the DEFAULT
  // problem-solving surface — the product opens into the construction
  // world (full-bleed workspace, no journey rail); the lifecycle /
  // administration sections (and the W057 reference world) are demoted to
  // the workspace bar's compact secondary navigation.
  const [section, setSection] = useState<SectionId>('solution');
  const composedRef = useRef<ProductRoot | null>(null);
  const nonceCounter = useRef(0);
  const { compact } = useViewport();

  // The product-root composition: client-side only, once per mount,
  // guarded by a ref and a cancellation flag (never during prerender).
  useEffect(() => {
    let cancelled = false;
    if (composedRef.current !== null) return;
    setCompose({ phase: 'composing' });
    void (async () => {
      try {
        const composed = await composeProductRoot(domain);
        if (cancelled) return;
        composedRef.current = composed;
        setRoot(composed);
        setSessionBar(composed.product.sessionBar());
        setCompose({ phase: 'ready' });
        try {
          const meta = await composed.host.appMeta();
          if (!cancelled) setAppMeta(meta);
        } catch {
          if (!cancelled) setAppMeta(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setCompose({
            phase: 'failed',
            message: cause instanceof Error ? cause.message : String(cause),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [domain, composeAttempt]);

  const refreshSession = useCallback((): void => {
    if (root !== null) setSessionBar(root.product.sessionBar());
  }, [root]);

  const authenticate = useCallback(async (): Promise<void> => {
    if (root === null) return;
    setAuthBusy(true);
    setAuthError(null);
    nonceCounter.current += 1;
    // The first authentication uses the canonical UI nonce
    // (`nonce:ui-1`); re-authentications after a sign-out increment it
    // so the gateway issues a FRESH session instead of replaying the
    // idempotent record of the revoked one.
    const nonce = `nonce:ui-${nonceCounter.current}`;
    try {
      const result = await root.product.authenticate({
        authentication: root.binding.authentication,
        principalId: root.binding.principalId,
        tenantId: root.binding.tenantId,
        projectId: root.binding.projectId,
        nonce,
      });
      if (!result.ok) {
        setAuthError({
          errorClass: result.error.class,
          code: result.error.code,
          message: result.error.message,
          recoveryAction: result.recoveryAction,
        });
      }
    } catch (cause) {
      setAuthError(thrownToUiError(cause));
    } finally {
      setAuthBusy(false);
      setSessionBar(root.product.sessionBar());
    }
  }, [root]);

  const signOut = useCallback(async (): Promise<void> => {
    if (root === null) return;
    setAuthBusy(true);
    setAuthError(null);
    try {
      await root.product.signOut();
    } catch (cause) {
      setAuthError(thrownToUiError(cause));
    } finally {
      setAuthBusy(false);
      setSessionBar(root.product.sessionBar());
    }
  }, [root]);

  if (compose.phase === 'failed') {
    return (
      <FrameShell>
        <div style={{ maxWidth: 640, margin: '0 auto', paddingTop: SPACE.xxl, width: '100%', boxSizing: 'border-box' }}>
          <ErrorCard
            error={{
              errorClass: 'composition',
              code: 'product-root-composition-failed',
              message: compose.message,
              recoveryAction: 'retry-with-backoff',
            }}
          />
          <GuidanceCard title="The product root could not compose">
            <span>
              The fixture bundle is fetched from <span style={{ fontFamily: FONTS.mono }}>public/fixtures</span>{' '}
              (synced by <span style={{ fontFamily: FONTS.mono }}>scripts/sync-fixtures.mjs</span>) and every
              file digest is re-verified against the registry — a mismatched or missing bundle refuses to seed
              the embedded gateway. Re-run the fixture sync or retry.
            </span>
          </GuidanceCard>
          <div style={{ display: 'flex', gap: SPACE.md }}>
            <ActionButton variant="primary" onClick={() => setComposeAttempt((attempt) => attempt + 1)}>
              Retry composition
            </ActionButton>
          </div>
        </div>
      </FrameShell>
    );
  }

  if (compose.phase === 'composing' || root === null) {
    return (
      <FrameShell>
        <div
          role="status"
          aria-live="polite"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: SPACE.lg,
            color: COLORS.textMuted,
          }}
        >
          <Spinner size={22} />
          <span style={{ fontSize: TYPE.sizeMd }}>Composing the product root over the embedded gateway…</span>
          <span style={{ fontFamily: FONTS.mono, fontSize: TYPE.sizeSm, color: COLORS.textMuted }}>
            loading registry-verified fixtures · binding authorities · sealing tenancy
          </span>
        </div>
      </FrameShell>
    );
  }

  const authenticated = sessionBar !== null && sessionBar.state === 'active';

  // W073: the solution section renders FULL-BLEED — its own construction
  // workspace (left construction-layers navigator, the dominant world
  // viewport, the right engineering inspector) with the lifecycle /
  // administration sections demoted to the workspace bar's secondary
  // links. Every other section keeps the classic rail layout (the rail's
  // first entry returns to the construction solution).
  if (section === 'solution') {
    return (
      <FrameShell>
        <SessionBar
          domain={domain}
          onDomainChange={onDomainChange}
          sessionBar={sessionBar}
          composing={compose.phase !== 'ready'}
          authBusy={authBusy}
          onAuthenticate={() => void authenticate()}
          onSignOut={() => void signOut()}
        />
        {authError !== null ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: SPACE.md,
              padding: `${SPACE.md}px ${SPACE.xl}px`,
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <ErrorCard error={authError} />
            </div>
            <ActionButton onClick={() => setAuthError(null)}>Dismiss</ActionButton>
          </div>
        ) : null}
        <SolutionWorkspace
          authenticated={authenticated}
          lifecycleSections={SECTIONS.filter((descriptor) => descriptor.id !== 'solution').map(
            (descriptor) => ({ id: descriptor.id, label: descriptor.label }),
          )}
          onOpenSection={(id) => setSection(id as SectionId)}
        />
        <StatusStrip hostKind={root.host.kind} fixtureId={root.bundle.fixtureId} appMeta={appMeta} />
      </FrameShell>
    );
  }

  const ctx: WorkspaceContext = {
    product: root.product,
    binding: root.binding,
    bundle: root.bundle,
    scenario: UI_SCENARIOS[domain],
    authenticated,
    refreshSession,
  };
  const active = SECTIONS.find((descriptor) => descriptor.id === section) ?? SECTIONS[0];

  return (
    <FrameShell>
      <SessionBar
        domain={domain}
        onDomainChange={onDomainChange}
        sessionBar={sessionBar}
        composing={compose.phase !== 'ready'}
        authBusy={authBusy}
        onAuthenticate={() => void authenticate()}
        onSignOut={() => void signOut()}
      />

      {authError !== null ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: SPACE.md,
            padding: `${SPACE.md}px ${SPACE.xl}px`,
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <ErrorCard error={authError} />
          </div>
          <ActionButton onClick={() => setAuthError(null)}>Dismiss</ActionButton>
        </div>
      ) : null}

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <nav
          aria-label="Journey sections"
          style={
            compact
              ? {
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 6,
                  padding: `${SPACE.sm}px ${SPACE.lg}px`,
                  borderBottom: `1px solid ${COLORS.border}`,
                  background: COLORS.rail,
                  overflowX: 'auto',
                }
              : {
                  width: 236,
                  flexShrink: 0,
                  overflowY: 'auto',
                  borderRight: `1px solid ${COLORS.border}`,
                  background: COLORS.rail,
                  padding: SPACE.md,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }
          }
        >
          {SECTIONS.map((descriptor) => {
            const selected = descriptor.id === section;
            return (
              <button
                key={descriptor.id}
                type="button"
                aria-current={selected ? 'true' : undefined}
                onClick={() => setSection(descriptor.id)}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: SPACE.sm,
                  padding: compact ? '6px 10px' : '8px 12px',
                  borderRadius: RADII.sm,
                  border: `1px solid ${selected ? COLORS.accentBorder : 'transparent'}`,
                  background: selected ? COLORS.accentDim : 'transparent',
                  color: selected ? COLORS.accent : COLORS.textSecondary,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: FONTS.sans,
                  fontSize: TYPE.sizeSm,
                  fontWeight: selected ? 600 : 400,
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ fontFamily: FONTS.mono, fontSize: TYPE.sizeXs, opacity: 0.9 }}>
                  {descriptor.journey}
                </span>
                <span>{descriptor.label}</span>
              </button>
            );
          })}
        </nav>

        <main
          aria-label={`${active.journey} — ${active.title}`}
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: 'auto',
            padding: compact ? SPACE.lg : `${SPACE.xl}px ${SPACE.xxl}px`,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE.xl,
              maxWidth: 1080,
              margin: '0 auto',
            }}
          >
            <header style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
              <span style={{ fontFamily: FONTS.mono, fontSize: TYPE.sizeXs, color: COLORS.accent, letterSpacing: '0.08em' }}>
                {active.journey}
              </span>
              <h2 style={{ margin: 0, fontSize: TYPE.sizeXl, fontWeight: 600, letterSpacing: '0.01em' }}>
                {active.title}
              </h2>
              <p style={{ margin: 0, color: COLORS.textSecondary, fontSize: TYPE.sizeMd, maxWidth: 760 }}>
                {active.summary}
              </p>
              {!authenticated ? (
                <p style={{ margin: 0, color: COLORS.warning, fontSize: TYPE.sizeSm }}>
                  Authenticate to begin — the session bar&apos;s Authenticate button issues a session from the
                  fixture identity.
                </p>
              ) : null}
            </header>
            {active.render(ctx)}
          </div>
        </main>
      </div>

      <StatusStrip hostKind={root.host.kind} fixtureId={root.bundle.fixtureId} appMeta={appMeta} />
    </FrameShell>
  );
}

/** The window frame: a full-height column (bars / regions / strip). */
function FrameShell({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: COLORS.bg,
        color: COLORS.text,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}
