// W061 — the WEB WORLD HOST surface tests (Node, react-dom/server): the
// composing phase renders without any browser API (the engine composition
// happens ONLY in the client mount effect — SSR-safe by construction), the
// browser GL surface seam degrades typed, and the `/world` App Router page
// composes the host per the repo's page conventions.
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
  it('renders the composing phase server-side with the engine canvases present (SSR composes no engine state)', () => {
    const html = renderToStaticMarkup(createElement(WorldWorkspaceHost));
    expect(html).toContain('data-world-host="web"');
    expect(html).toContain('data-world-phase="composing"');
    // The two Epoch-owned engine canvases are in the tree from the start
    // (the client effect binds the GL surfaces to them); no engine state,
    // no GL construction, has run at this point.
    expect(html).toContain('data-engine-canvas="rr-threejs"');
    expect(html).toContain('data-engine-canvas="rr-babylonjs-embedded"');
    expect(html).toContain('data-engine-stage');
    expect(html).toContain('Presenting the canonical fixture problem');
  });

  it('the browser GL surface seam degrades typed without a canvas (headless cores, never fabricated pixels)', () => {
    const three = webThreeSurfaceFactory(null);
    expect(three.factory({} as never)).toBeNull();
    expect(three.probe.glActive).toBe(false);
    const babylon = webBabylonEngineHost(null);
    expect(babylon.host.name).toBe('babylonjs-null-engine');
    expect(babylon.host.canRender).toBe(false);
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
