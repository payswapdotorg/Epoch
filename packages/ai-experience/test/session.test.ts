// Session lifecycle + tenant scoping: positives, negatives, boundaries.
import { describe, expect, it } from 'vitest';
import {
  projectCollaboration,
  validateSessionDescriptor,
  type AiSessionDescriptor,
} from '../src/index';
import {
  AGENT_PEER,
  LEAD,
  OTHER_TENANT,
  SESSION,
  TENANT,
  event,
  expectFailure,
  joinedEvents,
  presenceEvent,
  session,
} from './helpers';

describe('session descriptor validation', () => {
  it('admits a valid tenant-scoped descriptor with sorted, unique roles', () => {
    const result = validateSessionDescriptor(session());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const value = result.value as AiSessionDescriptor;
    expect(value.tenantId).toBe(TENANT);
    expect(value.sessionId).toBe(SESSION);
    expect(value.roles).toHaveLength(3);
    expect(value.roles.map((r) => r.principalId)).toEqual([
      AGENT_PEER,
      'principal:inspector',
      LEAD,
    ]);
  });

  it('admits a workspace/project-narrowed scope', () => {
    const result = validateSessionDescriptor(
      session({
        scope: { workspaceId: 'workspace:acme-eng', projectId: 'project:bridge-12' },
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a project narrowing without its workspace (W009 hierarchy)', () => {
    const result = validateSessionDescriptor(
      session({ scope: { projectId: 'project:bridge-12' } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation');
    expect(JSON.stringify(result.error)).toContain('workspace');
  });

  it('rejects an unsorted role list (deterministic serialization)', () => {
    const unsorted = session();
    (unsorted.roles as Record<string, unknown>[]).reverse();
    const result = validateSessionDescriptor(unsorted);
    expectFailure(result, 'validation');
  });

  it('rejects duplicate role principals', () => {
    const duplicate = session();
    (duplicate.roles as Record<string, unknown>[]).push(
      (duplicate.roles as Record<string, unknown>[])[0],
    );
    expectFailure(validateSessionDescriptor(duplicate), 'validation');
  });

  it('rejects an opener without a declared role', () => {
    expectFailure(validateSessionDescriptor(session({ openedBy: 'principal:ghost' })), 'validation');
  });

  it('rejects an agent peer without its registered agent id', () => {
    const noAgentId = session();
    delete (noAgentId.roles as Record<string, unknown>[])[0].agentId;
    expectFailure(validateSessionDescriptor(noAgentId), 'validation');
  });

  it('rejects a human peer carrying an agent id', () => {
    const withAgentId = session();
    (withAgentId.roles as Record<string, unknown>[])[1].agentId = 'agent:reviewer-01';
    expectFailure(validateSessionDescriptor(withAgentId), 'validation');
  });

  it('rejects unknown (vendor) fields (strict objects)', () => {
    expectFailure(validateSessionDescriptor(session({ provider: 'openai' })), 'validation');
  });

  it('rejects malformed tenant ids (the W009 grammar)', () => {
    expectFailure(validateSessionDescriptor(session({ tenantId: 'acme' })), 'validation');
  });
});

describe('session lifecycle projection', () => {
  it('projects an open session from admitted facts', () => {
    const descriptor = validateSessionDescriptor(session());
    expect(descriptor.ok).toBe(true);
    if (!descriptor.ok) return;
    const result = projectCollaboration(descriptor.value, joinedEvents());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state).toBe('open');
    expect(result.value.eventCount).toBe(7);
    expect(result.value.lastSequence).toBe(7);
  });

  it('projects the terminal close (sessions close, never mutate)', () => {
    const descriptor = validateSessionDescriptor(session());
    expect(descriptor.ok).toBe(true);
    if (!descriptor.ok) return;
    const result = projectCollaboration(descriptor.value, [
      ...joinedEvents(),
      event({ sequence: 8, actor: LEAD, kind: 'session.closed' }),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state).toBe('closed');
  });

  it('rejects an event following the terminal close', () => {
    const descriptor = validateSessionDescriptor(session());
    expect(descriptor.ok).toBe(true);
    if (!descriptor.ok) return;
    const result = projectCollaboration(descriptor.value, [
      event({ sequence: 1, actor: LEAD, kind: 'session.closed' }),
      event({ sequence: 2, actor: LEAD, kind: 'focus.released', participant: LEAD }),
    ]);
    expectFailure(result, 'validation');
  });

  it('rejects events of a foreign session (unknown-session-reference)', () => {
    const descriptor = validateSessionDescriptor(session());
    expect(descriptor.ok).toBe(true);
    if (!descriptor.ok) return;
    const result = projectCollaboration(descriptor.value, [
      presenceEvent({ sessionId: 'session:other-review' }),
    ]);
    expectFailure(result, 'unknown-session-reference');
  });

  it('rejects a cross-tenant join (R12)', () => {
    const descriptor = validateSessionDescriptor(session());
    expect(descriptor.ok).toBe(true);
    if (!descriptor.ok) return;
    const result = projectCollaboration(descriptor.value, [
      presenceEvent({ tenantId: OTHER_TENANT, actor: 'principal:spy', participant: 'principal:spy' }),
    ]);
    const denial = expectFailure(result, 'cross-tenant-denied');
    expect(denial.expectedTenantId).toBe(TENANT);
    expect(denial.encounteredTenantId).toBe(OTHER_TENANT);
  });

  it('rejects duplicate journal sequences (the W010 discipline)', () => {
    const descriptor = validateSessionDescriptor(session());
    expect(descriptor.ok).toBe(true);
    if (!descriptor.ok) return;
    const result = projectCollaboration(descriptor.value, [
      presenceEvent({ sequence: 1 }),
      presenceEvent({ sequence: 1, participant: LEAD }),
    ]);
    expectFailure(result, 'validation');
  });
});
