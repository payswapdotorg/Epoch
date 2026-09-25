// W014 shell boundaries: typed error/loading boundary states.
import { describe, expect, it } from 'vitest';
import {
  boundarySummary,
  degradedBoundary,
  emptyBoundary,
  failedBoundary,
  loadingBoundary,
} from './boundaries';

describe('shell boundary states', () => {
  it('constructs every typed boundary state', () => {
    expect(loadingBoundary('route content')).toEqual({ state: 'loading', subject: 'route content' });
    expect(emptyBoundary('features')).toEqual({ state: 'empty', subject: 'features' });
    expect(failedBoundary('route-render-failed', 'It broke')).toEqual({
      state: 'failed',
      code: 'route-render-failed',
      message: 'It broke',
    });
    expect(degradedBoundary('partial data')).toEqual({ state: 'degraded', reason: 'partial data' });
  });

  it('summaries are deterministic and human-facing', () => {
    expect(boundarySummary(loadingBoundary('route content'))).toBe('Loading route content…');
    expect(boundarySummary(emptyBoundary('features'))).toBe('No features yet');
    expect(boundarySummary(failedBoundary('x', 'Nope'))).toBe('Nope (code: x)');
    expect(boundarySummary(degradedBoundary('partial data'))).toBe(
      'Partial view — partial data',
    );
  });
});
