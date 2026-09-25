// W014 shared design tokens: determinism + freeze coverage.
import { describe, expect, it } from 'vitest';
import {
  SHELL_COLORS,
  SHELL_LAYOUT,
  SHELL_RADII,
  SHELL_SPACING,
  SHELL_TOKENS,
  SHELL_TYPOGRAPHY,
} from './tokens';

describe('shared design tokens', () => {
  it('exposes the five token groups with expected keys', () => {
    expect(Object.keys(SHELL_TOKENS).sort()).toEqual([
      'colors',
      'layout',
      'radii',
      'spacing',
      'typography',
    ]);
    expect(Object.keys(SHELL_COLORS).sort()).toEqual([
      'accent',
      'accentForeground',
      'background',
      'border',
      'danger',
      'dangerText',
      'surface',
      'textMuted',
      'textPrimary',
      'textSecondary',
    ]);
    expect(Object.keys(SHELL_SPACING)).toEqual(['xs', 'sm', 'md', 'lg', 'xl', 'xxl']);
    expect(Object.keys(SHELL_RADII)).toEqual(['sm', 'md', 'lg']);
    expect(Object.keys(SHELL_LAYOUT)).toEqual(['frameMaxWidth', 'headerHeight']);
  });

  it('tokens are deep-frozen (deterministic, tamper-evident)', () => {
    expect(Object.isFrozen(SHELL_TOKENS)).toBe(true);
    expect(Object.isFrozen(SHELL_COLORS)).toBe(true);
    expect(Object.isFrozen(SHELL_SPACING)).toBe(true);
    expect(Object.isFrozen(SHELL_TYPOGRAPHY)).toBe(true);
    expect(Object.isFrozen(SHELL_RADII)).toBe(true);
    expect(Object.isFrozen(SHELL_LAYOUT)).toBe(true);
  });

  it('token values are presentation data only (no framework or vendor vocabulary)', () => {
    // Every color is a lowercase hex literal; every size is a px literal —
    // no CSS-in-JS framework, no vendor theme imports.
    for (const color of Object.values(SHELL_COLORS)) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
    for (const radius of Object.values(SHELL_RADII)) {
      expect(radius).toBeGreaterThanOrEqual(0);
    }
    expect(SHELL_TYPOGRAPHY.fontFamily).not.toMatch(/tailwind|styled|emotion|material/i);
  });
});
