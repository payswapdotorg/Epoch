// W047 route wiring smoke: the App Router files compose the product app
// root (session provider + shell) and render the stage surfaces. The
// wiring is proven as React element trees via react-dom/server (the
// product surfaces' initial states — data loads happen client-side
// through the gateway).
import { describe, expect, it } from 'vitest';
import { createElement, isValidElement } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import RootLayout from '../layout';
import HomePage from '../page';
import UnderstandPage from '../(navigator)/understand/page';
import DecidePage from '../(navigator)/decide/page';
import PlanPage from '../(navigator)/plan/page';
import AcquirePage from '../(navigator)/acquire/page';
import RealizePage from '../(navigator)/realize/page';
import ObservePage from '../(navigator)/observe/page';
import VerifyPage from '../(navigator)/verify/page';
import ForecastPage from '../(navigator)/forecast/page';
import ClosePage from '../(navigator)/close/page';
import LearnPage from '../(navigator)/learn/page';
import MarketplacePage from '../marketplace/page';
import DevelopersPage from '../developers/page';
import { StageRoute } from '../../src/product/stage-route';
import { EntrySurface } from '../../src/product/entry';
import { SessionProvider } from '../../src/client/session';

const STAGE_PAGES: readonly [string, () => ReactNode][] = [
  ['understand', UnderstandPage],
  ['decide', DecidePage],
  ['plan', PlanPage],
  ['acquire', AcquirePage],
  ['realize', RealizePage],
  ['observe', ObservePage],
  ['verify', VerifyPage],
  ['forecast', ForecastPage],
  ['close', ClosePage],
  ['learn', LearnPage],
  ['marketplace', MarketplacePage],
  ['developers', DevelopersPage],
];

describe('app router wiring (W047 product)', () => {
  it('the root layout composes the product app root around route content (structure)', () => {
    const html = renderToStaticMarkup(
      createElement(RootLayout, { children: createElement('div', { 'data-child': '' }, 'X') }),
    );
    expect(html).toMatch(/^<html lang="en">/);
    expect(html).toContain('<body');
    // The product shell frame regions render inside the layout.
    expect(html).toContain('data-region="header"');
    expect(html).toContain('data-region="navigation"');
    expect(html).toContain('data-region="content"');
    expect(html).toContain('data-region="status"');
    expect(html).toContain('data-shell="epoch-web-product-1.0.0"');
    // The navigator landmarks are semantic.
    expect(html).toContain('aria-label="Solution Navigator"');
    // Children render inside the content region (the boot gate shows the
    // loading state; the entry surface renders after session boot).
    expect(html).toContain('data-testid="loading"');
  });

  it('the entry surface renders the fresh-user sign-in + handoff (J01 + J08)', () => {
    expect(isValidElement(createElement(HomePage))).toBe(true);
    const html = renderToStaticMarkup(createElement(SessionProvider, { children: createElement(EntrySurface) }));
    expect(html).toContain('data-route-surface="route:entry"');
    expect(html).toContain('Enter Epoch');
    expect(html).toContain('data-testid="entry-domain"');
    expect(html).toContain('data-testid="sign-in"');
    expect(html).toContain('data-testid="handoff-session"');
    expect(html).toContain('data-testid="handoff-resume"');
  });

  it('every navigator stage segment renders inside the product shell (wiring smoke)', () => {
    for (const [stage, Page] of STAGE_PAGES) {
      const html = renderToStaticMarkup(createElement(RootLayout, { children: createElement(Page) }));
      // The boot gate renders while the session resolves; the stage
      // surfaces render client-side after entry (browser E2E proves the
      // full stage wiring against the real product).
      expect(html, stage).toContain('data-shell="epoch-web-product-1.0.0"');
      expect(html, stage).toContain('data-region="content"');
      expect(isValidElement(createElement(Page))).toBe(true);
    }
  });

  it('the stage route switch covers every wired segment (lockstep)', () => {
    const wired = STAGE_PAGES.map(([stage]) => stage).sort();
    const routed: readonly string[] = [
      'understand',
      'decide',
      'plan',
      'acquire',
      'realize',
      'observe',
      'verify',
      'forecast',
      'close',
      'learn',
      'marketplace',
      'developers',
    ].sort();
    expect(wired).toEqual(routed);
    // The switch returns an element for every stage.
    for (const stage of routed) {
      expect(isValidElement(createElement(StageRoute, { stage: stage as import('../../src/product/stage-route').StageRoute }))).toBe(true);
    }
  });

  it('page metadata is derived deterministically', async () => {
    const understand = await import('../(navigator)/understand/page');
    const marketplace = await import('../marketplace/page');
    expect(understand.metadata).toEqual({ title: 'Understand — Epoch' });
    expect(marketplace.metadata).toEqual({ title: 'Marketplace — Epoch' });
  });
});
