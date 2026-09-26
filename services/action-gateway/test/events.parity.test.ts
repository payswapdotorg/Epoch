// EVENT PARITY with the REAL W010 machinery (devDependencies only — no
// runtime coupling; the W036 pattern): the mirrored action-event shapes
// are admitted by the REAL sealEvent, the mirrored digest agrees with the
// REAL computeEventDigest, the phase vocabulary is member-identical, and
// the stream/actor grammars are pattern-identical.
import { describe, expect, it } from 'vitest';
import {
  ACTION_EVENT_PHASES as W010_PHASES,
  EVENT_STREAM_ID_PATTERN as W010_STREAM_PATTERN,
  ACTION_LIFECYCLE_EVENT_KIND,
  computeEventDigest,
  sealEvent,
} from '@epoch/event-log';
import { canonicalDigest } from '@epoch/action-policy';
import type { JsonValue } from '@epoch/action-policy';
import { ACTION_EVENT_PHASES } from '../src/version';
import {
  ACTION_EVENT_ACTOR_PATTERN,
  ACTION_STREAM_ID_PATTERN,
  ActionGateway,
  computeActionEventDigest,
} from '../src/index';
import {
  executeOptions,
  plainProposal,
  submitOptions,
  TENANT_A,
  unwrap,
} from './helpers';

describe('W010 event-log parity (runtime)', () => {
  it('the mirrored phase vocabulary is member-identical to W010', () => {
    expect([...ACTION_EVENT_PHASES].sort()).toEqual([...W010_PHASES].sort());
  });

  it('the mirrored stream + actor grammars are pattern-identical to W010/W009', () => {
    expect(ACTION_STREAM_ID_PATTERN.source).toBe(W010_STREAM_PATTERN.source);
    expect(ACTION_STREAM_ID_PATTERN.flags).toBe(W010_STREAM_PATTERN.flags);
    // The W009 principal grammar (W010 mirrors it; so do we).
    expect(ACTION_EVENT_ACTOR_PATTERN.source).toBe(/^principal:[a-z0-9][a-z0-9-]{0,62}$/.source);
  });

  it('every gateway event of a full lifecycle is admitted by the REAL W010 sealEvent and digests identically', () => {
    const gateway = new ActionGateway();
    const intake = unwrap(gateway.submitAction(submitOptions({ proposal: plainProposal() })));
    unwrap(gateway.executeAction(executeOptions()));
    const stream = unwrap(
      gateway.actionStream({ tenantId: TENANT_A, actionId: intake.action.actionId }),
    );
    expect(stream.length).toBe(4); // proposed, authorized, executed, effects-recorded
    for (const event of stream) {
      const { contentDigest, ...content } = event;
      // The mirrored digest equals the REAL W010 digest of the same content.
      expect(computeActionEventDigest(content)).toBe(computeEventDigest(content));
      expect(canonicalDigest(content as unknown as JsonValue)).toBe(contentDigest);
      // The REAL W010 seal path admits the same content with the same digest.
      const sealed = sealEvent(content);
      expect(sealed.ok, JSON.stringify(sealed)).toBe(true);
      if (!sealed.ok) return;
      expect(sealed.value.digest).toBe(contentDigest);
      expect(sealed.value.event.payload.discriminator).toBe(ACTION_LIFECYCLE_EVENT_KIND);
    }
  });

  it('a W010-invalid action payload is rejected by the mirrored schema too (reserved namespace discipline)', async () => {
    const { z } = await import('zod');
    const { ActionEventContentSchema } = await import('../src/index');
    const badPayload = {
      schemaVersion: 1,
      streamId: 'stream:action-parity-probe',
      sequence: 1,
      tenantId: TENANT_A,
      actor: 'principal:site-engineer',
      causalParent: null,
      payload: {
        discriminator: 'action:lifecycle',
        data: {
          // Missing the action reference: violates the W010 kernel payload
          // contract, and the mirrored schema rejects it identically.
          actionType: { id: 'structural.element.reinforce', version: '1.0.0' },
          phase: 'proposed',
        },
      },
      occurredAt: '2025-01-15T10:00:00.000Z',
    };
    expect(ActionEventContentSchema.safeParse(badPayload).success).toBe(false);
    const realSeal = sealEvent(badPayload);
    expect(realSeal.ok).toBe(false);
    void z;
  });
});
