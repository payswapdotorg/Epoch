// W061 → W072 — the WEB WORLD HOST surface tests (Node, react-dom/server):
// the composing phase renders without ANY engine state (the engine
// composition happens ONLY in the client mount effect — SSR-safe by
// construction), the browser GL surface seam degrades typed, and the
// `/world` App Router page composes the host per the repo's page
// conventions.
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldWorkspaceHost } from './world-host';
import { webBabylonEngineHost, webThreeSurfaceFactory } from './browser-gl';
import { worldMetadata } from '../../../shell/world-mount';

/** The repository root (this file lives at apps/web/src/features/world/host). */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..', '..');

describe('the web world host surface', () => {
  it('renders the composing phase server-side with NO engine state at all (SSR composes nothing; the engine canvases mount in the stable client tree after the runtime exists — the W072 late-binding fix)', () => {
    const html = renderToStaticMarkup(createElement(WorldWorkspaceHost));
    expect(html).toContain('data-world-host="web"');
    expect(html).toContain('data-world-phase="composing"');
    // The pre-composition shell carries NO engine DOM (the stable tree that
    // mounts the stage + canvases renders on the client only, after the
    // runtime has been composed — the GL surfaces then bind lazily to the
    // canvases of THAT tree at the session's first mount).
    expect(html).toContain('Presenting the construction solution world');
    expect(html).not.toContain('data-engine-canvas');
    expect(html).not.toContain('data-engine-stage');
    expect(html).not.toContain('data-world-digest');
  });

  it('the browser GL surface seam degrades typed without a canvas (headless cores, never fabricated pixels) — the late-resolved CanvasSource reads the canvas only at the session mount', async () => {
    const three = webThreeSurfaceFactory(() => null);
    expect(three.factory({} as never)).toBeNull();
    expect(three.probe.glActive).toBe(false);
    const babylon = webBabylonEngineHost(() => null);
    expect(babylon.host.canRender).toBe(false);
    expect(babylon.probe.glActive).toBe(false);
    // The defensive host still constructs headless engines on demand (the
    // documented degradation — never a throw through the fabric).
    const engine = await babylon.host.createEngine();
    expect(typeof engine).toBe('object');
    expect(babylon.probe.glActive).toBe(false);
  });

  it('the /world App Router page composes the host behind the shell-owned route metadata (the page conventions)', () => {
    const page = readFileSync(join(REPO_ROOT, 'apps', 'web', 'app', 'world', 'page.tsx'), 'utf8');
    expect(page).toContain("from '../../src/shell/world-mount'");
    expect(page).toContain('worldMetadata');
    expect(page).toContain("from '../../src/features/world/host/world-host'");
    expect(page).toContain('WorldWorkspaceHost');
    // The shell owns the route (route:world -> /world — pinned by the shell
    // route tests); the page is the thin App Router segment.
    expect(worldMetadata()).toEqual({ title: 'World — Epoch' });
  });
});
