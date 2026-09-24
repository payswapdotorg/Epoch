// Extension lifecycle tests: the vocabulary is the W007 registry
// vocabulary (zero-drift import), and illegal transitions are typed
// lifecycle-conflict errors.
import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_LIFECYCLE_STATES,
  CAPABILITY_LIFECYCLE_TRANSITIONS,
} from '@epoch/capability-registry';
import {
  EXTENSION_LIFECYCLE_STATES,
  EXTENSION_LIFECYCLE_TRANSITIONS,
  checkExtensionLifecycleTransition,
} from '../src/index';

describe('extension lifecycle vocabulary (W007 alignment)', () => {
  it('states are the registry states, member-for-member (same objects)', () => {
    expect(EXTENSION_LIFECYCLE_STATES).toBe(CAPABILITY_LIFECYCLE_STATES);
    expect([...EXTENSION_LIFECYCLE_STATES]).toEqual(['registered', 'deprecated', 'retired']);
  });

  it('the transition table is the registry table (same object)', () => {
    expect(EXTENSION_LIFECYCLE_TRANSITIONS).toBe(CAPABILITY_LIFECYCLE_TRANSITIONS);
    expect(EXTENSION_LIFECYCLE_TRANSITIONS).toEqual({
      registered: ['deprecated', 'retired'],
      deprecated: ['retired'],
      retired: [],
    });
  });
});

describe('extension lifecycle transition checks', () => {
  it('accepts every legal transition', () => {
    for (const [from, to] of [
      ['registered', 'deprecated'],
      ['registered', 'retired'],
      ['deprecated', 'retired'],
    ] as const) {
      const result = checkExtensionLifecycleTransition({ from, to });
      expect(result.ok, `${from} -> ${to}`).toBe(true);
    }
  });

  it('rejects illegal transitions with a typed lifecycle-conflict error', () => {
    for (const [from, to] of [
      ['deprecated', 'registered'],
      ['retired', 'registered'],
      ['retired', 'deprecated'],
      ['registered', 'registered'],
    ] as const) {
      const result = checkExtensionLifecycleTransition({ from, to });
      expect(result.ok, `${from} -> ${to}`).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('lifecycle-conflict');
      if (result.error.code !== 'lifecycle-conflict') return;
      expect(result.error.from).toBe(from);
      expect(result.error.to).toBe(to);
      expect(result.error.message).toContain('illegal extension lifecycle transition');
    }
  });
});
