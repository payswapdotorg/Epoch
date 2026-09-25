// W014 route wiring smoke: the App Router files compose the shell
// providers + frame and render the route surfaces (element-structure
// assertions — the layout/page wiring is proven as React element trees,
// not as a running Next server).
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
import { stageMetadata, homeMetadata } from '../../src/shell/route-surfaces';
import { referenceShell } from '../../src/shell/bootstrap';
import type { NavigatorStage } from '../../src/shell/version';

const STAGE_PAGES: readonly [NavigatorStage, () => ReactNode][] = [
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
];

describe('app router wiring', () => {
  it('the root layout composes providers + frame around route content (structure)', () => {
    const element = createElement(RootLayout, {
      children: createElement('div', { 'data-child': '' }, 'X'),
    });
    const html = renderToStaticMarkup(element);
    // The full document structure the layout owns.
    expect(html).toMatch(/^<html lang="en">/);
    expect(html).toContain('<body');
    // The shell frame regions render inside the layout.
    expect(html).toContain('data-region="header"');
    expect(html).toContain('data-region="navigation"');
    expect(html).toContain('data-region="content"');
    expect(html).toContain('data-region="status"');
    // The tenant/session reference context is threaded through providers.
    expect(html).toContain('tenant:epoch-reference');
    expect(html).toContain('Ada (Reference)');
    // Children render inside the content region.
    expect(html).toContain('data-child');
  });

  it('the home page renders the shell frame content with empty mounted surfaces (positive)', () => {
    expect(isValidElement(createElement(HomePage))).toBe(true);
    const html = renderToStaticMarkup(
      createElement(RootLayout, { children: createElement(HomePage) }),
    );
    expect(html).toContain('data-route-surface="route:home"');
    expect(html).toContain('Epoch Solution Navigator');
    expect(html).toContain('data-mount-empty="mount:content"');
    expect(html).toContain('data-experience-slot="scene"');
    // The navigator overview links every stage.
    for (const stage of referenceShell.routes.listRoutes()) {
      if (stage.stage !== undefined) {
        expect(html).toContain(`data-stage-link="${stage.stage}"`);
      }
    }
  });

  it('every navigator stage segment renders its stage surface (wiring smoke)', () => {
    for (const [stage, Page] of STAGE_PAGES) {
      const html = renderToStaticMarkup(createElement(RootLayout, { children: createElement(Page) }));
      expect(html, stage).toContain(`data-route-surface="route:${stage}"`);
      expect(html, stage).toContain(`data-stage="${stage}"`);
      expect(html, stage).toContain('data-experience-slot="scene"');
      expect(html, stage).toContain('data-mount-empty="mount:content"');
    }
  });

  it('page metadata is derived from the route descriptors (deterministic)', () => {
    expect(homeMetadata()).toEqual({ title: 'Epoch — Solution Navigator' });
    expect(stageMetadata('understand')).toEqual({ title: 'Understand — Epoch' });
    expect(stageMetadata('observe')).toEqual({ title: 'Observe / Actualize — Epoch' });
  });

  it('every registry path is wired by a segment and every segment path is registered (lockstep)', () => {
    const wiredStages = STAGE_PAGES.map(([stage]) => stage).sort();
    const registeredStages = referenceShell.routes
      .listRoutes()
      .map((route) => route.stage)
      .filter((stage): stage is NavigatorStage => stage !== undefined)
      .sort();
    expect(wiredStages).toEqual(registeredStages);
    // The home path is wired by app/page.tsx.
    expect(referenceShell.routes.resolvePath('/').ok).toBe(true);
  });
});
