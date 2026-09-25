// W014 shell frame: region structure, permission-gated navigation list,
// experience mount placeholders, and feature-mount occupancy.
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AppFrame,
  ExperienceMountPlaceholder,
  ExperienceSurfaces,
  FeatureMountsRegion,
} from './frame';
import { createFeatureSet } from './mounting';
import { anonymousSession } from './session';
import {
  createReferenceShell,
  REFERENCE_SESSION,
  referenceShell,
} from './bootstrap';
import { SHELL_RECORD_VERSION } from './version';

function frameHtml(
  options?: { readonly session?: typeof REFERENCE_SESSION } | undefined,
): string {
  const shell = createReferenceShell({ session: options?.session ?? REFERENCE_SESSION });
  return renderToStaticMarkup(
    createElement(AppFrame, {
      routes: shell.routes,
      mounts: shell.mounts,
      features: shell.features,
      tenant: shell.tenant,
      session: shell.session,
      children: createElement('div', { 'data-page-content': '' }, 'route content'),
    }),
  );
}

describe('shell app frame', () => {
  it('renders the four frame regions in canonical structure (positive)', () => {
    const html = frameHtml();
    expect(html).toContain('data-shell="epoch-web-shell-1.0.0"');
    expect(html).toContain('data-region="header"');
    expect(html).toContain('data-region="navigation"');
    expect(html).toContain('data-region="content"');
    expect(html).toContain('data-region="status"');
    // The route content renders inside the content region.
    expect(html).toContain('data-page-content');
    expect(html).toContain('route content');
    // Header shows tenant + session badges.
    expect(html).toContain('tenant:epoch-reference');
    expect(html).toContain('Ada (Reference)');
  });

  it('renders the permission-gated navigation list with every allowed route (positive)', () => {
    const html = frameHtml();
    expect(html).toContain('data-route-id="route:home"');
    expect(html).toContain('data-route-id="route:understand"');
    expect(html).toContain('data-route-id="route:learn"');
    expect(html).toContain('href="/understand"');
  });

  it('the anonymous session sees only the public home route in the nav (gated projection)', () => {
    const html = frameHtml({ session: anonymousSession() });
    expect(html).toContain('data-route-id="route:home"');
    expect(html).not.toContain('data-route-id="route:understand"');
    expect(html).toContain('Anonymous session');
  });

  it('the status region summarizes mounts and features deterministically', () => {
    const html = frameHtml();
    expect(html).toContain('Epoch shell v1.0.0 · 7 mounts · 0 features');
  });
});

describe('shell experience mounts', () => {
  it('renders the three Experience slots with their accepted graph kinds (positive)', () => {
    const html = renderToStaticMarkup(
      createElement(ExperienceSurfaces, { mounts: referenceShell.mounts }),
    );
    expect(html).toContain('data-experience-slot="scene"');
    expect(html).toContain('data-experience-slot="narrative"');
    expect(html).toContain('data-experience-slot="controls"');
    expect(html).toContain('2d, 3d, animation, timeline-replay, presence');
    expect(html).toContain('narrative');
    expect(html).toContain('awaiting renderer wiring');
  });

  it('a single slot placeholder renders its mount id and kinds', () => {
    const html = renderToStaticMarkup(
      createElement(ExperienceMountPlaceholder, { mounts: referenceShell.mounts, slot: 'controls' }),
    );
    expect(html).toContain('mount:controls');
    expect(html).toContain('controls');
  });
});

describe('shell feature mounts', () => {
  it('renders the typed empty state when no features are mounted (positive)', () => {
    const html = renderToStaticMarkup(
      createElement(FeatureMountsRegion, {
        mounts: referenceShell.mounts,
        features: referenceShell.features,
        mountId: 'mount:content',
      }),
    );
    expect(html).toContain('data-mount-empty="mount:content"');
    expect(html).toContain('No features mounted at mount:content yet');
  });

  it('renders registered feature badges in deterministic order (positive)', () => {
    const shell = createReferenceShell();
    const set = createFeatureSet(
      [
        {
          schemaVersion: SHELL_RECORD_VERSION,
          featureId: 'feature:beta',
          displayName: 'Beta',
          version: '0.1.0',
          mounts: [{ mountId: 'mount:content', required: true }],
        },
        {
          schemaVersion: SHELL_RECORD_VERSION,
          featureId: 'feature:alpha',
          displayName: 'Alpha',
          version: '1.2.3',
          mounts: [{ mountId: 'mount:content', required: true }],
        },
      ],
      shell.mounts,
      shell.tenant,
    );
    expect(set.ok).toBe(true);
    if (!set.ok) return;
    const html = renderToStaticMarkup(
      createElement(FeatureMountsRegion, {
        mounts: shell.mounts,
        features: set.value,
        mountId: 'mount:content',
      }),
    );
    expect(html).toContain('data-mount-occupied="mount:content"');
    const alpha = html.indexOf('data-feature="feature:alpha"');
    const beta = html.indexOf('data-feature="feature:beta"');
    expect(alpha).toBeGreaterThan(-1);
    expect(beta).toBeGreaterThan(-1);
    expect(alpha).toBeLessThan(beta); // sorted by feature id
  });

  it('an unknown mount id renders the unknown-mount placeholder (negative)', () => {
    const html = renderToStaticMarkup(
      createElement(FeatureMountsRegion, {
        mounts: referenceShell.mounts,
        features: referenceShell.features,
        mountId: 'mount:sidebar',
      }),
    );
    // (Static markup escapes apostrophes — assert the stable substrings.)
    expect(html).toContain('Unknown mount');
    expect(html).toContain('mount:sidebar');
  });
});
