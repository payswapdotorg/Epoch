// W057 — the shell WORLD ROUTE/MOUNT tests: the typed registration of the
// interactive world as the PRIMARY Epoch problem-solving surface (the only
// shell surface this Work Order owns). The world feature enters through
// the explicit mounting seam (never an import); the world route resolves
// in the built-in registry; the route surface renders.
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createReferenceShell, REFERENCE_SESSION } from './bootstrap';
import {
  WORLD_FEATURE_ID,
  WorldRouteSurface,
  createWorldShell,
  worldFeatureDescriptor,
  worldMetadata,
} from './world-mount';

describe('the shell world route/mount (W057)', () => {
  it('the world route is a built-in non-lifecycle route (home, world, then stages)', () => {
    const shell = createReferenceShell();
    const world = shell.routes.resolve('route:world');
    expect(world.ok).toBe(true);
    if (world.ok) {
      expect(world.value.path).toBe('/world');
      expect(world.value.title).toBe('World');
      expect(world.value.stage).toBeUndefined();
    }
    expect(shell.routes.resolvePath('/world').ok).toBe(true);
  });

  it('the reference shell keeps the EMPTY feature set (the world feature registers explicitly)', () => {
    const reference = createReferenceShell();
    expect(reference.features.listFeatureIds()).toEqual([]);
    // The world feature descriptor itself is well-formed at the seam.
    const shell = createWorldShell();
    const resolved = shell.features.resolve(WORLD_FEATURE_ID);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.value.displayName).toBe('Interactive World');
      expect(resolved.value.version).toBe('1.0.0');
    }
    expect(shell.features.listFeatureIds()).toEqual([WORLD_FEATURE_ID]);
  });

  it('the world feature mounts the SCENE + CONTROLS experience slots', () => {
    const descriptor = worldFeatureDescriptor();
    const scene = descriptor.mounts.find((mount) => mount.mountId === 'mount:scene');
    const controls = descriptor.mounts.find((mount) => mount.mountId === 'mount:controls');
    expect(scene?.required).toBe(true);
    expect(scene?.experienceGraphKinds).toContain('3d');
    expect(scene?.experienceGraphKinds).toContain('timeline-replay');
    expect(scene?.experienceGraphKinds).toContain('presence');
    expect(controls?.required).toBe(true);
    expect(controls?.experienceGraphKinds).toEqual(['controls']);
  });

  it('the world route surface renders the world workspace framing', () => {
    const shell = createWorldShell();
    const html = renderToStaticMarkup(
      createElement(WorldRouteSurface, { shell, session: REFERENCE_SESSION }),
    );
    expect(html).toContain('data-route-surface="route:world"');
    expect(html).toContain('data-world-mounted="true"');
    expect(html).toContain('The primary workspace');
    expect(html).toContain('data-experience-surfaces');
    expect(worldMetadata()).toEqual({ title: 'World — Epoch' });
  });
});
