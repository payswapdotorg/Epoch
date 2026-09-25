// W014 shared presentational components: rendering smoke (server markup).
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Badge, EmptySlot, Panel, PanelTitle, StateView } from './components';
import { presentEmpty, presentLoading, presentResult, type PresentationState } from './view-models';

describe('shared presentational components', () => {
  it('Panel renders a titled raised surface with a region role', () => {
    const html = renderToStaticMarkup(
      createElement(Panel, { title: 'Stage', children: 'content' }),
    );
    expect(html).toContain('<section');
    expect(html).toContain('data-panel="default"');
    expect(html).toContain('Stage');
    expect(html).toContain('content');
  });

  it('Panel tone=danger marks the failure surface', () => {
    const html = renderToStaticMarkup(createElement(Panel, { tone: 'danger', children: 'x' }));
    expect(html).toContain('data-panel="danger"');
  });

  it('PanelTitle renders the uppercase title heading', () => {
    const html = renderToStaticMarkup(createElement(PanelTitle, { children: 'Feature mounts' }));
    expect(html).toContain('<h2');
    expect(html).toContain('Feature mounts');
  });

  it('Badge renders a neutral and an accent chip', () => {
    expect(
      renderToStaticMarkup(createElement(Badge, { children: 'tenant:acme' })),
    ).toContain('tenant:acme');
    const accent = renderToStaticMarkup(createElement(Badge, { tone: 'accent', children: 'T' }));
    expect(accent).toContain('data-badge="accent"');
    expect(renderToStaticMarkup(createElement(Badge, { children: 'T' }))).toContain(
      'data-badge="default"',
    );
  });

  it('EmptySlot renders a labeled placeholder with an optional hint', () => {
    const html = renderToStaticMarkup(
      createElement(EmptySlot, { label: 'Scene surface', hint: 'awaiting renderer wiring' }),
    );
    expect(html).toContain('data-empty-slot');
    expect(html).toContain('Scene surface');
    expect(html).toContain('awaiting renderer wiring');
    expect(renderToStaticMarkup(createElement(EmptySlot, { label: 'L' }))).not.toContain('hint');
  });

  it('StateView renders every typed presentation state', () => {
    expect(
      renderToStaticMarkup(
        createElement(StateView, { state: presentLoading(), renderReady: () => null }),
      ),
    ).toContain('Loading…');
    expect(
      renderToStaticMarkup(
        createElement(StateView, { state: presentEmpty('features'), renderReady: () => null }),
      ),
    ).toContain('No features yet');
    expect(
      renderToStaticMarkup(
        createElement(StateView, {
          state: presentResult<string, { message: string }>({
            ok: false,
            error: { message: 'denied' },
          }),
          renderReady: () => null,
        }),
      ),
    ).toContain('denied');
    const ready: PresentationState<string> = { status: 'ready', value: 'V' };
    expect(
      renderToStaticMarkup(
        createElement(StateView<string>, { state: ready, renderReady: (v: string) => v }),
      ),
    ).toContain('V');
  });
});
