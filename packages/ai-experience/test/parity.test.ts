// Runtime parity pins (devDependencies): the mirrored grammars and
// vocabularies are byte-equal to the upstream W009/W010 surfaces, and the
// mirrored collaboration subject/action-proposal grammars accept the same
// documents. (The compile-time half lives in src/kernel-parity.ts.)
import { describe, expect, it } from 'vitest';
import {
  AGENT_PRESENCE_STATES,
  AGENT_PRESENCE_TRANSITIONS,
  AI_PRINCIPAL_ID_PATTERN,
  AI_PROJECT_ID_PATTERN,
  AI_SESSION_ID_PATTERN,
  AI_TENANT_ID_PATTERN,
  AI_WORKSPACE_ID_PATTERN,
  INTERACTION_INTENT_KINDS,
  FOCUS_TARGET_KINDS,
  ActionProposalTargetSchema,
} from '../src/index';
import {
  COLLABORATION_PRINCIPAL_ID_PATTERN,
  COLLABORATION_SESSION_ID_PATTERN,
  COLLABORATION_TENANT_ID_PATTERN,
  COLLABORATION_SUBJECT_KINDS,
  PRESENCE_STATES,
  PRESENCE_TRANSITIONS,
  CollaborationSubjectSchema,
} from '@epoch/collaboration';
import { TENANT_ID_PATTERN, WORKSPACE_ID_PATTERN, PROJECT_ID_PATTERN } from '@epoch/tenancy';
import { ReplayCursorSchema } from '@epoch/replay';
import { TimelinePositionSchema } from '../src/index';

describe('mirrored W009 tenancy grammar parity', () => {
  it('tenant id patterns are identical to @epoch/tenancy', () => {
    expect(AI_TENANT_ID_PATTERN.source).toBe(TENANT_ID_PATTERN.source);
    expect(AI_TENANT_ID_PATTERN.flags).toBe(TENANT_ID_PATTERN.flags);
  });

  it('workspace and project id patterns are identical to @epoch/tenancy', () => {
    expect(AI_WORKSPACE_ID_PATTERN.source).toBe(WORKSPACE_ID_PATTERN.source);
    expect(AI_PROJECT_ID_PATTERN.source).toBe(PROJECT_ID_PATTERN.source);
  });
});

describe('mirrored W010 collaboration grammar parity', () => {
  it('session, tenant, and principal patterns are identical to @epoch/collaboration', () => {
    expect(AI_SESSION_ID_PATTERN.source).toBe(COLLABORATION_SESSION_ID_PATTERN.source);
    expect(AI_TENANT_ID_PATTERN.source).toBe(COLLABORATION_TENANT_ID_PATTERN.source);
    expect(AI_PRINCIPAL_ID_PATTERN.source).toBe(COLLABORATION_PRINCIPAL_ID_PATTERN.source);
  });

  it('presence states and the transition table are identical to @epoch/collaboration (plus the documented rejoin)', () => {
    expect([...AGENT_PRESENCE_STATES]).toEqual([...PRESENCE_STATES]);
    for (const state of PRESENCE_STATES) {
      const upstream = PRESENCE_TRANSITIONS[state];
      const mine = AGENT_PRESENCE_TRANSITIONS[state];
      if (state === 'left') {
        // The documented deviation: the membership-sourced rejoin.
        expect(mine).toEqual(['joining']);
        expect(upstream).toEqual([]);
      } else {
        expect(mine).toEqual(upstream);
      }
    }
  });

  it('focus-target kinds are identical to collaboration subject kinds', () => {
    expect([...FOCUS_TARGET_KINDS]).toEqual([...COLLABORATION_SUBJECT_KINDS]);
  });

  it('the mirrored action-proposal target accepts exactly the upstream subject payloads', () => {
    const valid = {
      kind: 'action-proposal',
      proposal: { proposalId: 'msg-proposal-0001', canonicalDigest: 'c'.repeat(64) },
    };
    const invalid = {
      kind: 'action-proposal',
      proposal: { proposalId: 'msg-proposal-0001', canonicalDigest: 'not-hex' },
    };
    expect(CollaborationSubjectSchema.safeParse(valid).success).toBe(true);
    expect(CollaborationSubjectSchema.safeParse(invalid).success).toBe(false);
    expect(ActionProposalTargetSchema.safeParse(valid.proposal).success).toBe(true);
    expect(ActionProposalTargetSchema.safeParse(invalid.proposal).success).toBe(false);
  });
});

describe('timeline position grammar parity (W010 replay)', () => {
  it('field grammar matches @epoch/replay ReplayCursor field-for-field', () => {
    const streamId = 'stream:bridge-12-review';
    const upstream = ReplayCursorSchema.safeParse({ streamId, lastSequence: 3 });
    const mine = TimelinePositionSchema.safeParse({ streamId, sequence: 3 });
    expect(upstream.success).toBe(true);
    expect(mine.success).toBe(true);
    // Zero is admitted by the timeline position (the stream-start
    // position) but not by a replay resume cursor (event-log sequences
    // are 1-based); negative values are invalid in both grammars.
    expect(TimelinePositionSchema.safeParse({ streamId, sequence: 0 }).success).toBe(true);
    expect(ReplayCursorSchema.safeParse({ streamId, lastSequence: 0 }).success).toBe(false);
    expect(TimelinePositionSchema.safeParse({ streamId, sequence: -1 }).success).toBe(false);
    expect(ReplayCursorSchema.safeParse({ streamId, lastSequence: -1 }).success).toBe(false);
    expect(TimelinePositionSchema.safeParse({ streamId: 'bad stream', sequence: 1 }).success).toBe(false);
    expect(ReplayCursorSchema.safeParse({ streamId: 'bad stream', lastSequence: 1 }).success).toBe(false);
  });
});

describe('the interaction-intent vocabulary', () => {
  it('is a subset of the Universal interactions (spec/experience-architecture.md)', () => {
    const universal = new Set([
      'select', 'inspect', 'measure', 'move', 'rotate', 'zoom', 'isolate', 'hide',
      'show', 'compare', 'annotate', 'simulate', 'change', 'connect', 'disconnect',
      'filter', 'query', 'branch', 'approve', 'reject', 'execute', 'replay', 'pause',
      'resume', 'follow-agent', 'take-control', 'release-control',
    ]);
    for (const kind of INTERACTION_INTENT_KINDS) {
      expect(universal.has(kind), `kind "${kind}" must be a Universal interaction`).toBe(true);
    }
    expect(INTERACTION_INTENT_KINDS).toHaveLength(16);
  });
});
