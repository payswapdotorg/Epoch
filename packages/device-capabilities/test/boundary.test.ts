// Boundary battery: tier thresholds at the exact floor, one-below-floor,
// mixed-budget downgrades, and remote-assist thresholds.
import { describe, expect, it } from 'vitest';
import {
  budgetFloorTierOf,
  adaptationTierOf,
  remoteAssistRecommendedFor,
  TIER_BUDGET_FLOORS,
  TIER_RANK,
  DEVICE_ADAPTATION_TIERS,
} from '../src/index';
import { desktopDevice, profileDevice } from './fixtures';
import type { DeviceDescriptor } from '@epoch/experience-protocol';

/** Clone the desktop fixture with budget overrides. */
function desktopWith(
  overrides: {
    maxPixels?: number;
    maxTriangles?: number;
    maxTextureBytes?: number;
  },
): DeviceDescriptor {
  const base = desktopDevice();
  return {
    ...base,
    display: { ...base.display, maxPixels: overrides.maxPixels },
    spatial: {
      ...base.spatial,
      maxTriangles: overrides.maxTriangles,
      maxTextureBytes: overrides.maxTextureBytes,
    },
  };
}

describe('tier boundary derivation', () => {
  it('the tier floor table is strictly monotone across descending rank (inclusive floors)', () => {
    const byDescendingRank = [...DEVICE_ADAPTATION_TIERS].sort(
      (a, b) => TIER_RANK[b] - TIER_RANK[a],
    );
    expect(byDescendingRank).toEqual(['full', 'normal', 'field', 'reduced']);
    const floors = byDescendingRank.map((tier) => TIER_BUDGET_FLOORS[tier]);
    for (let i = 1; i < floors.length; i += 1) {
      expect(floors[i - 1].minPixels).toBeGreaterThan(floors[i].minPixels);
      expect(floors[i - 1].minTriangles).toBeGreaterThan(floors[i].minTriangles);
      expect(floors[i - 1].minTextureBytes).toBeGreaterThan(floors[i].minTextureBytes);
    }
  });

  it('one axis below a floor downgrades the whole tier (weakest axis wins)', () => {
    expect(
      budgetFloorTierOf(desktopWith({ maxTriangles: TIER_BUDGET_FLOORS.full.minTriangles - 1 })),
    ).toBe('normal');
    expect(
      budgetFloorTierOf(desktopWith({ maxTextureBytes: TIER_BUDGET_FLOORS.normal.minTextureBytes - 1 })),
    ).toBe('field');
    expect(
      budgetFloorTierOf(desktopWith({ maxPixels: TIER_BUDGET_FLOORS.field.minPixels - 1 })),
    ).toBe('reduced');
  });

  it('normal-floor-exact budgets assess as normal', () => {
    expect(
      budgetFloorTierOf(
        desktopWith({
          maxPixels: TIER_BUDGET_FLOORS.normal.minPixels,
          maxTriangles: TIER_BUDGET_FLOORS.normal.minTriangles,
          maxTextureBytes: TIER_BUDGET_FLOORS.normal.minTextureBytes,
        }),
      ),
    ).toBe('normal');
  });

  it('field-floor-exact budgets assess as field', () => {
    expect(
      budgetFloorTierOf(
        desktopWith({
          maxPixels: TIER_BUDGET_FLOORS.field.minPixels,
          maxTriangles: TIER_BUDGET_FLOORS.field.minTriangles,
          maxTextureBytes: TIER_BUDGET_FLOORS.field.minTextureBytes,
        }),
      ),
    ).toBe('field');
  });

  it('class ceilings cap non-desktop classes (headset caps at normal)', () => {
    const headset = profileDevice('headset');
    // The headset baseline carries full-tier budgets...
    expect(budgetFloorTierOf(headset)).toBe('full');
    // ...but its class ceiling caps the derived tier at normal.
    expect(adaptationTierOf(headset)).toBe('normal');
  });

  it('remote-assist flips exactly at the reduced floor boundary', () => {
    const atFloor = desktopWith({
      maxPixels: TIER_BUDGET_FLOORS.reduced.minPixels,
      maxTriangles: TIER_BUDGET_FLOORS.reduced.minTriangles,
      maxTextureBytes: TIER_BUDGET_FLOORS.reduced.minTextureBytes,
    });
    expect(remoteAssistRecommendedFor(atFloor)).toBe(false);
    expect(
      remoteAssistRecommendedFor(desktopWith({ maxPixels: TIER_BUDGET_FLOORS.reduced.minPixels - 1 })),
    ).toBe(true);
    expect(
      remoteAssistRecommendedFor(
        desktopWith({ maxTextureBytes: TIER_BUDGET_FLOORS.reduced.minTextureBytes - 1 }),
      ),
    ).toBe(true);
  });

  it('a single reduced-floor-miss device still derives the reduced tier locally', () => {
    // Pixels one below the reduced floor: remote assist recommended, and
    // the budget floor falls through to reduced (the lowest tier).
    const device = desktopWith({ maxPixels: TIER_BUDGET_FLOORS.reduced.minPixels - 1 });
    expect(budgetFloorTierOf(device)).toBe('reduced');
    expect(remoteAssistRecommendedFor(device)).toBe(true);
  });
});
