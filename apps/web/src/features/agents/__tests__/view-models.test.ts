// View-model tests: deterministic ordering, label derivation, feed
// bounding, and the aggregate panel model. These run under the
// @epoch/ai-experience Vitest runner in globals mode (the app manifest is
// frozen during W015 — see ../README.md).
import {
  buildAgentCollaborationViewModel,
  buildIntentFeed,
  buildMomentCard,
  buildPresenceRoster,
  INTENT_FEED_LIMIT,
  principalLabel,
  shortDigest,
  focusTargetLabel,
  projectedRefLabel,
  authorityLabel,
  eventSummary,
  intentSummary,
  scopeLabel,
} from '../view-models';
import {
  AGENT_ID,
  DIGEST_MOMENT,
  ENTITY_REF,
  LEAD,
  eventFixture,
  eventFixtures,
  momentFixture,
  projectionFixture,
  sessionFixture,
} from './fixtures';

describe('label derivation (deterministic)', () => {
  it('strips the opaque id prefixes', () => {
    expect(principalLabel('principal:lead-eng')).toBe('lead-eng');
    expect(principalLabel('principal:agent-reviewer')).toBe('agent-reviewer');
    expect(principalLabel('workspace:acme-eng')).toBe('acme-eng');
    expect(principalLabel('bare')).toBe('bare');
  });

  it('shortens digests to 12 hex characters with an ellipsis', () => {
    expect(shortDigest(DIGEST_MOMENT)).toBe(`${DIGEST_MOMENT.slice(0, 12)}…`);
    expect(shortDigest(DIGEST_MOMENT)).toHaveLength(13);
  });

  it('labels focus targets and projected references opaquely', () => {
    expect(focusTargetLabel({ kind: 'world-entity', entityId: 'element:column-c4' })).toBe(
      'world entity element:column-c4',
    );
    expect(
      focusTargetLabel({
        kind: 'action-proposal',
        proposal: { proposalId: 'msg-proposal-0001', canonicalDigest: 'c'.repeat(64) },
      }),
    ).toBe('proposal msg-proposal-0001');
    expect(projectedRefLabel(ENTITY_REF)).toBe('world entity element:column-c4');
  });

  it('labels control authorities', () => {
    expect(authorityLabel({ kind: 'session-owner' })).toBe('session owner');
    expect(authorityLabel({ kind: 'role-grant' })).toBe('role grant');
    expect(authorityLabel({ kind: 'explicit-handover', from: LEAD })).toBe(
      'handover from lead-eng',
    );
  });
});

describe('the presence roster', () => {
  it('builds sorted, badge-carrying rows and excludes departed participants', () => {
    const roster = buildPresenceRoster(projectionFixture());
    expect(roster).toHaveLength(3);
    expect(roster.map((row) => row.label)).toEqual(['agent-reviewer', 'inspector', 'lead-eng']);
    expect(roster[0]?.agentId).toBe(AGENT_ID);
    expect(roster[0]?.focusLabel).toBe('world entity element:column-c4');
    expect(roster[1]?.followsAgentId).toBe(AGENT_ID);
    expect(roster[2]?.holdsControl).toBe(true);
    expect(roster.every((row) => !row.holdsControl || row.principalId === LEAD)).toBe(true);
  });

  it('marks nobody as holding control when unassigned', () => {
    const projection = {
      ...projectionFixture(),
      controller: undefined,
    };
    const roster = buildPresenceRoster(projection);
    expect(roster.every((row) => row.holdsControl === false)).toBe(true);
  });
});

describe('the intent feed', () => {
  it('renders the latest events newest first with stable keys', () => {
    const feed = buildIntentFeed(eventFixtures());
    expect(feed).toHaveLength(14);
    expect(feed[0]?.key).toBe('event#14');
    expect(feed[0]?.summary).toContain('engineering moment captured');
    expect(feed[13]?.key).toBe('event#1');
  });

  it('bounds the feed to the display limit', () => {
    const many = Array.from({ length: 120 }, (_, index) =>
      eventFixture({ sequence: index + 1, actor: LEAD, participant: LEAD, presence: 'present' }),
    );
    const feed = buildIntentFeed(many);
    expect(feed).toHaveLength(INTENT_FEED_LIMIT);
    expect(feed[0]?.sequence).toBe(120);
    expect(feed[feed.length - 1]?.sequence).toBe(120 - INTENT_FEED_LIMIT + 1);
  });

  it('summarizes every typed event kind (total — no bare kind leaks)', () => {
    const kinds = [
      'presence.changed',
      'focus.changed',
      'focus.released',
      'control.taken',
      'control.released',
      'control.denied',
      'intent.emitted',
      'moment.captured',
      'session.closed',
    ] as const;
    for (const kind of kinds) {
      const summary = eventSummary(eventFixture({ kind }));
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
    }
  });

  it('summarizes every intent kind without leaking raw payloads', () => {
    const intents = [
      { kind: 'select', intentVersion: 1, target: ENTITY_REF },
      { kind: 'inspect', intentVersion: 1, target: ENTITY_REF },
      { kind: 'follow-agent', intentVersion: 1, agentId: AGENT_ID },
      { kind: 'take-control', intentVersion: 1, authority: { kind: 'role-grant' } },
      { kind: 'release-control', intentVersion: 1 },
      { kind: 'pause', intentVersion: 1 },
      { kind: 'resume', intentVersion: 1 },
      {
        kind: 'replay',
        intentVersion: 1,
        position: { streamId: 'stream:bridge-12-review', sequence: 5 },
      },
      {
        kind: 'branch',
        intentVersion: 1,
        from: { streamId: 'stream:bridge-12-review', sequence: 3 },
        label: 'alt-steel',
      },
      {
        kind: 'approve',
        intentVersion: 1,
        target: { proposalId: 'msg-proposal-0001', canonicalDigest: 'c'.repeat(64) },
      },
      {
        kind: 'reject',
        intentVersion: 1,
        target: { proposalId: 'msg-proposal-0001', canonicalDigest: 'c'.repeat(64) },
      },
      {
        kind: 'execute',
        intentVersion: 1,
        target: { proposalId: 'msg-proposal-0001', canonicalDigest: 'c'.repeat(64) },
      },
      { kind: 'annotate', intentVersion: 1, target: ENTITY_REF, note: 'check this' },
      {
        kind: 'compare',
        intentVersion: 1,
        targets: [ENTITY_REF, { ...ENTITY_REF, entityId: 'element:beam-b2' }],
      },
      { kind: 'filter', intentVersion: 1, criteria: { discipline: 'structural' } },
      { kind: 'query', intentVersion: 1, text: 'which columns fail?' },
    ];
    for (const intent of intents) {
      const summary = intentSummary(intent as never);
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(0);
    }
  });
});

describe('Engineering Moment cards', () => {
  it('summarizes the shareable record with its content address', () => {
    const card = buildMomentCard(momentFixture());
    expect(card.key).toBe(DIGEST_MOMENT);
    expect(card.shortDigest).toBe(`${DIGEST_MOMENT.slice(0, 12)}…`);
    expect(card.label).toBe('column check');
    expect(card.capturedByLabel).toBe('lead-eng');
    expect(card.agentCount).toBe(1);
    expect(card.humanCount).toBe(2);
    expect(card.evidenceCount).toBe(1);
    expect(card.availableActions).toHaveLength(16);
    expect(card.positionLabel).toBe('stream:bridge-12-review @ 5');
  });
});

describe('the aggregate panel model', () => {
  it('binds the session, projection, events, and moments together', () => {
    const model = buildAgentCollaborationViewModel(
      sessionFixture(),
      projectionFixture(),
      eventFixtures(),
      [momentFixture()],
    );
    expect(model.sessionKey).toBe('session:design-review');
    expect(model.title).toBe('Bridge 12 design review');
    expect(model.tenantId).toBe('tenant:acme');
    expect(model.scopeLabel).toBe('acme-eng / bridge-12');
    expect(model.stateLabel).toBe('open');
    expect(model.controllerLabel).toBe('lead-eng');
    expect(model.hasControl).toBe(true);
    expect(model.denials).toHaveLength(1);
    expect(model.denials[0]?.actorLabel).toBe('inspector');
    expect(model.playback).toBe('paused');
    expect(model.positionLabel).toBe('stream:bridge-12-review @ 5');
    expect(model.branches).toHaveLength(1);
    expect(model.feed).toHaveLength(14);
    expect(model.moments).toHaveLength(1);
    expect(model.eventCount).toBe(14);
  });

  it('derives tenant-wide scope labels without a narrowing', () => {
    const session = sessionFixture();
    delete (session as { scope?: unknown }).scope;
    expect(scopeLabel(session)).toBe('tenant-wide');
  });
});
