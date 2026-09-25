// W014 shared view-model helpers: typed result/error presentation states.
import { describe, expect, it } from 'vitest';
import {
  PRESENTATION_STATUSES,
  presentEmpty,
  presentLoading,
  presentResult,
  presentationSummary,
  readyValue,
  type ResultLike,
} from './view-models';

describe('shared view-model helpers', () => {
  it('the presentation-status vocabulary is closed and pinned', () => {
    expect([...PRESENTATION_STATUSES]).toEqual(['loading', 'ready', 'empty', 'failed']);
  });

  it('projects a structural ok result into the ready state', () => {
    const result: ResultLike<string, { message: string; code?: string }> = {
      ok: true,
      value: 'hello',
    };
    expect(presentResult(result)).toEqual({ status: 'ready', value: 'hello' });
  });

  it('projects ANY result-like value (shell, tenancy, authorization shapes)', () => {
    // A tenancy-shaped result (structural compatibility, no import needed).
    const tenancyShaped: ResultLike<number, { code: string; message: string }> = {
      ok: false,
      error: { code: 'cross-tenant-reference', message: 'no' },
    } as const;
    expect(presentResult(tenancyShaped)).toEqual({
      status: 'failed',
      code: 'cross-tenant-reference',
      message: 'no',
    });
    // A result whose error carries no code degrades to the unknown code.
    const bare: ResultLike<number, { message: string }> = {
      ok: false,
      error: { message: 'boom' },
    };
    expect(presentResult(bare)).toEqual({ status: 'failed', code: 'unknown', message: 'boom' });
  });

  it('an ok result over empty content projects into the empty state', () => {
    const result: ResultLike<readonly string[], { message: string }> = {
      ok: true,
      value: [],
    };
    expect(presentResult(result, { isEmpty: (v) => v.length === 0, emptySubject: 'features' })).toEqual(
      { status: 'empty', subject: 'features' },
    );
    expect(presentResult(result)).toEqual({ status: 'ready', value: [] });
  });

  it('loading and empty constructors are typed states', () => {
    expect(presentLoading()).toEqual({ status: 'loading' });
    expect(presentEmpty('mounts')).toEqual({ status: 'empty', subject: 'mounts' });
  });

  it('readyValue narrows only the ready state', () => {
    expect(readyValue({ status: 'ready', value: 7 })).toBe(7);
    expect(readyValue(presentLoading<number>())).toBeUndefined();
    expect(readyValue(presentEmpty<number>('x'))).toBeUndefined();
    expect(readyValue({ status: 'failed', code: 'c', message: 'm' })).toBeUndefined();
  });

  it('presentation summaries are deterministic strings', () => {
    expect(presentationSummary(presentLoading())).toBe('Loading…');
    expect(presentationSummary({ status: 'ready', value: 1 })).toBe('Ready');
    expect(presentationSummary(presentEmpty('features'))).toBe('No features yet');
    expect(presentationSummary({ status: 'failed', code: 'x1', message: 'Nope' })).toBe(
      'Nope (code: x1)',
    );
  });
});
