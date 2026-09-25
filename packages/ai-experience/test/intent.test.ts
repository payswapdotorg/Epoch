// Intent-vocabulary validation across the typed subsets + the named
// negatives (malformed/unknown intent, executable-UI, vendor fields) and
// boundaries.
import { describe, expect, it } from 'vitest';
import {
  admitIntent,
  InteractionIntentSchema,
  INTERACTION_INTENT_KINDS,
  VENDOR_FIELD_BLOCKLIST,
  EXECUTABLE_FIELD_BLOCKLIST,
  type AiCollaborationEvent,
} from '../src/index';
import {
  ENTITY_REF,
  FULL_GRANT,
  LEAD,
  OTHER_TENANT,
  PROPOSAL_TARGET,
  RELATION_REF,
  SESSION,
  STREAM,
  TENANT,
  T1,
  expectFailure,
  validSession,
} from './helpers';

function envelope(intent: unknown, overrides: Record<string, unknown> = {}) {
  return {
    sessionId: SESSION,
    tenantId: TENANT,
    actor: LEAD,
    occurredAt: T1,
    sequence: 10,
    intent,
    ...overrides,
  };
}

const STREAM_BOUNDS = [{ streamId: STREAM, lastSequence: 7 }];

/** One VALID intent payload per kind (the positive matrix). */
function validIntentOf(kind: string): Record<string, unknown> {
  switch (kind) {
    case 'annotate':
      return { kind, intentVersion: 1, target: ENTITY_REF, note: 'Check the cover width' };
    case 'approve':
      return { kind, intentVersion: 1, target: PROPOSAL_TARGET };
    case 'branch':
      return { kind, intentVersion: 1, from: { streamId: STREAM, sequence: 4 }, label: 'alt-steel' };
    case 'compare':
      return { kind, intentVersion: 1, targets: [ENTITY_REF, RELATION_REF] };
    case 'execute':
      return { kind, intentVersion: 1, target: PROPOSAL_TARGET };
    case 'filter':
      return { kind, intentVersion: 1, criteria: { discipline: 'structural' } };
    case 'follow-agent':
      return { kind, intentVersion: 1, agentId: 'agent:reviewer-01' };
    case 'inspect':
      return { kind, intentVersion: 1, target: ENTITY_REF };
    case 'pause':
      return { kind, intentVersion: 1 };
    case 'query':
      return { kind, intentVersion: 1, text: 'Which columns fail the check?' };
    case 'replay':
      return { kind, intentVersion: 1, position: { streamId: STREAM, sequence: 3 } };
    case 'reject':
      return { kind, intentVersion: 1, target: PROPOSAL_TARGET };
    case 'release-control':
      return { kind, intentVersion: 1 };
    case 'resume':
      return { kind, intentVersion: 1 };
    case 'select':
      return { kind, intentVersion: 1, target: ENTITY_REF };
    case 'take-control':
      return { kind, intentVersion: 1, authority: { kind: 'role-grant' } };
    default:
      throw new Error(`unknown kind ${kind}`);
  }
}

describe('the interaction-intent vocabulary (positives)', () => {
  it('publishes exactly sixteen Universal-interaction subsets, sorted', () => {
    expect([...INTERACTION_INTENT_KINDS]).toEqual([...FULL_GRANT]);
    expect(INTERACTION_INTENT_KINDS).toHaveLength(16);
  });

  it.each([...INTERACTION_INTENT_KINDS])('validates a well-formed %s intent', (kind) => {
    const parsed = InteractionIntentSchema.safeParse(validIntentOf(kind));
    expect(parsed.success, `kind ${kind} should parse`).toBe(true);
  });

  it.each([...INTERACTION_INTENT_KINDS])('admits a %s intent end-to-end', (kind) => {
    const result = admitIntent(envelope(validIntentOf(kind)), {
      session: validSession(),
      streamBounds: STREAM_BOUNDS,
      control: { controller: undefined },
    });
    expect(result.ok, `kind ${kind} should admit`).toBe(true);
    if (!result.ok) return;
    const emitted = result.value as AiCollaborationEvent;
    if (kind === 'take-control') {
      // The typed takeover transition (with provenance), not an emission.
      expect(emitted.kind).toBe('control.taken');
      expect(emitted.provenance?.actor).toBe(LEAD);
    } else if (kind === 'release-control') {
      // Nobody holds control: the typed denial (with provenance recorded).
      expect(emitted.kind).toBe('control.denied');
      expect(emitted.rejection?.reason).toBe('actor-not-controller');
    } else {
      expect(emitted.kind).toBe('intent.emitted');
      expect((emitted.intent as { kind: string }).kind).toBe(kind);
    }
  });

  it('admits an annotate intent with open data (clean keys)', () => {
    const result = admitIntent(
      envelope({
        kind: 'annotate',
        intentVersion: 1,
        target: ENTITY_REF,
        note: 'note',
        data: { discipline: 'structural', severity: 2 },
      }),
      { session: validSession(), streamBounds: STREAM_BOUNDS },
    );
    expect(result.ok).toBe(true);
  });
});

describe('intent validation negatives', () => {
  it('rejects an unknown intent kind (invalid-intent)', () => {
    const result = admitIntent(envelope({ kind: 'teleport', intentVersion: 1 }), {
      session: validSession(),
    });
    expectFailure(result, 'invalid-intent');
  });

  it('rejects a malformed intent member (invalid-intent)', () => {
    const result = admitIntent(
      envelope({ kind: 'select', intentVersion: 1, target: { kind: 'world-entity' } }),
      { session: validSession() },
    );
    expectFailure(result, 'invalid-intent');
  });

  it('rejects a stale intent payload version (invalid-intent)', () => {
    const result = admitIntent(
      envelope({ kind: 'pause', intentVersion: 2 }),
      { session: validSession() },
    );
    expectFailure(result, 'invalid-intent');
  });

  it('rejects a query intent carrying an executable expression (invalid-intent)', () => {
    const result = admitIntent(
      envelope({ kind: 'query', intentVersion: 1, text: '' }),
      { session: validSession() },
    );
    expectFailure(result, 'invalid-intent');
  });

  it('rejects a cross-tenant envelope (R12)', () => {
    const result = admitIntent(envelope({ kind: 'pause', intentVersion: 1 }, {
      tenantId: OTHER_TENANT,
    }), { session: validSession() });
    const denial = expectFailure(result, 'cross-tenant-denied');
    expect(denial.expectedTenantId).toBe(TENANT);
    expect(denial.encounteredTenantId).toBe(OTHER_TENANT);
  });

  it('rejects an intent whose projected reference belongs to a foreign tenant', () => {
    const result = admitIntent(
      envelope({
        kind: 'select',
        intentVersion: 1,
        target: { ...ENTITY_REF, tenantId: OTHER_TENANT },
      }),
      { session: validSession() },
    );
    expectFailure(result, 'cross-tenant-denied');
  });

  it('rejects an intent addressed to a foreign session (unknown-session-reference)', () => {
    const result = admitIntent(
      envelope({ kind: 'pause', intentVersion: 1 }, { sessionId: 'session:elsewhere' }),
      { session: validSession() },
    );
    expectFailure(result, 'unknown-session-reference');
  });

  it('rejects an intent from a principal without a declared role', () => {
    const result = admitIntent(
      envelope({ kind: 'pause', intentVersion: 1 }, { actor: 'principal:ghost' }),
      { session: validSession() },
    );
    expectFailure(result, 'validation');
  });

  it('rejects an intent outside the acting role grant (validation, non-control kinds)', () => {
    const result = admitIntent(
      envelope({ kind: 'branch', intentVersion: 1, from: { streamId: STREAM, sequence: 1 } }, {
        actor: 'principal:inspector',
      }),
      { session: validSession(), streamBounds: STREAM_BOUNDS },
    );
    expectFailure(result, 'validation');
  });
});

describe('the Dynamic UI law (executable-ui-rejected)', () => {
  it('rejects executable KEYS in annotate data', () => {
    const result = admitIntent(
      envelope({
        kind: 'annotate',
        intentVersion: 1,
        target: ENTITY_REF,
        note: 'note',
        data: { code: 'alert(1)' },
      }),
      { session: validSession() },
    );
    const rejection = expectFailure(result, 'executable-ui-rejected');
    expect(rejection.key).toBe('code');
  });

  it('rejects executable VALUES in annotate data', () => {
    const result = admitIntent(
      envelope({
        kind: 'annotate',
        intentVersion: 1,
        target: ENTITY_REF,
        note: 'note',
        data: { hint: '<script>alert(1)</script>' },
      }),
      { session: validSession() },
    );
    expectFailure(result, 'executable-ui-rejected');
  });

  it('rejects executable keys nested in filter criteria', () => {
    const result = admitIntent(
      envelope({
        kind: 'filter',
        intentVersion: 1,
        criteria: { view: { script: 'payload' } },
      }),
      { session: validSession() },
    );
    expectFailure(result, 'executable-ui-rejected');
  });

  it('rejects a javascript: URI value deep in the payload', () => {
    const result = admitIntent(
      envelope({
        kind: 'filter',
        intentVersion: 1,
        criteria: { link: 'javascript:steal()' },
      }),
      { session: validSession() },
    );
    expectFailure(result, 'executable-ui-rejected');
  });

  it('the executable blocklist contains the UI-code vocabulary', () => {
    expect(EXECUTABLE_FIELD_BLOCKLIST).toContain('script');
    expect(EXECUTABLE_FIELD_BLOCKLIST).toContain('code');
    expect(EXECUTABLE_FIELD_BLOCKLIST).toContain('wasm');
  });
});

describe('provider neutrality (vendor-fields-rejected)', () => {
  it('rejects provider fields in annotate data (lock rule 13)', () => {
    const result = admitIntent(
      envelope({
        kind: 'annotate',
        intentVersion: 1,
        target: ENTITY_REF,
        note: 'note',
        data: { provider: 'openai' },
      }),
      { session: validSession() },
    );
    const rejection = expectFailure(result, 'vendor-fields-rejected');
    expect(rejection.key).toBe('provider');
  });

  it('rejects model fields in filter criteria', () => {
    const result = admitIntent(
      envelope({
        kind: 'filter',
        intentVersion: 1,
        criteria: { model: 'gpt-4o' },
      }),
      { session: validSession() },
    );
    expectFailure(result, 'vendor-fields-rejected');
  });

  it('rejects credential fields nested in filter criteria', () => {
    const result = admitIntent(
      envelope({
        kind: 'filter',
        intentVersion: 1,
        criteria: { service: { apiKey: 'sk-...' } },
      }),
      { session: validSession() },
    );
    expectFailure(result, 'vendor-fields-rejected');
  });

  it('the vendor blocklist contains the provider vocabulary', () => {
    expect(VENDOR_FIELD_BLOCKLIST).toContain('provider');
    expect(VENDOR_FIELD_BLOCKLIST).toContain('model');
    expect(VENDOR_FIELD_BLOCKLIST).toContain('openai');
    expect(VENDOR_FIELD_BLOCKLIST).toContain('anthropic');
  });

});

describe('intent boundaries', () => {
  it('rejects an empty query text (min length 1)', () => {
    expect(
      InteractionIntentSchema.safeParse({ kind: 'query', intentVersion: 1, text: '' }).success,
    ).toBe(false);
  });

  it('rejects a compare intent with identical targets', () => {
    const result = InteractionIntentSchema.safeParse({
      kind: 'compare',
      intentVersion: 1,
      targets: [ENTITY_REF, ENTITY_REF],
    });
    expect(result.success).toBe(false);
  });

  it('admits a max-length query text (boundary)', () => {
    const result = InteractionIntentSchema.safeParse({
      kind: 'query',
      intentVersion: 1,
      text: 'x'.repeat(2000),
    });
    expect(result.success).toBe(true);
  });

  it('rejects an over-length query text (boundary)', () => {
    const result = InteractionIntentSchema.safeParse({
      kind: 'query',
      intentVersion: 1,
      text: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

describe('replay-position gate', () => {
  it('rejects a replay intent positioned on an unknown stream', () => {
    const result = admitIntent(
      envelope({ kind: 'replay', intentVersion: 1, position: { streamId: 'stream:ghost', sequence: 1 } }),
      { session: validSession(), streamBounds: STREAM_BOUNDS },
    );
    expectFailure(result, 'replay-position-invalid');
  });

  it('rejects a replay intent positioned beyond the stream bound', () => {
    const result = admitIntent(
      envelope({ kind: 'replay', intentVersion: 1, position: { streamId: STREAM, sequence: 8 } }),
      { session: validSession(), streamBounds: STREAM_BOUNDS },
    );
    expectFailure(result, 'replay-position-invalid');
  });

  it('rejects a negative replay position at the schema gate (invalid-intent)', () => {
    const result = admitIntent(
      envelope({ kind: 'replay', intentVersion: 1, position: { streamId: STREAM, sequence: -1 } }),
      { session: validSession(), streamBounds: STREAM_BOUNDS },
    );
    expectFailure(result, 'invalid-intent');
  });

  it('admits the boundary positions 0 (stream start) and the last sequence', () => {
    for (const sequence of [0, 7]) {
      const result = admitIntent(
        envelope({ kind: 'replay', intentVersion: 1, position: { streamId: STREAM, sequence } }),
        { session: validSession(), streamBounds: STREAM_BOUNDS },
      );
      expect(result.ok).toBe(true);
    }
  });

  it('rejects a branch intent from an invalid position', () => {
    const result = admitIntent(
      envelope({ kind: 'branch', intentVersion: 1, from: { streamId: 'stream:ghost', sequence: 2 } }, {
        actor: LEAD,
      }),
      { session: validSession(), streamBounds: STREAM_BOUNDS },
    );
    expectFailure(result, 'replay-position-invalid');
  });

  it('rejects replay positions when no stream bounds are known', () => {
    const result = admitIntent(
      envelope({ kind: 'replay', intentVersion: 1, position: { streamId: STREAM, sequence: 1 } }),
      { session: validSession() },
    );
    expectFailure(result, 'replay-position-invalid');
  });
});
