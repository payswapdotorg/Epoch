// Shared fixtures for the provenance tests.
import { canonicalDigest, type JsonValue } from '@epoch/agent-protocol';

export const T0 = '2025-06-01T08:00:00.000Z';
export const T1 = '2025-06-01T09:30:00.000Z';
export const T2 = '2025-06-01T11:00:00.000Z';
export const T3 = '2025-06-01T12:00:00.000Z';

/** Artifact content + its exact-revision digest (content-addressed entity). */
export const REPORT: JsonValue = { report: 'structural-analysis', revision: 3 };
export const REPORT_DIGEST = canonicalDigest(REPORT);

/**
 * A complete, valid provenance graph exercising all six core relations:
 * a software agent (solver) executed a run activity that used a method
 * entity and generated a content-addressed report entity; a human reviewer
 * approved it, acting for an organization.
 */
export function provenanceGraph(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    agents: [
      { agentId: 'actor:solver-01', agentKind: 'software', displayName: 'FE solver' },
      { agentId: 'actor:reviewer-01', agentKind: 'person', displayName: 'Dr. Chen' },
      { agentId: 'org:engineering', agentKind: 'organization' },
    ],
    activities: [
      { activityId: 'run:stress-check-1', activityKind: 'verification-run', startedAt: T0, endedAt: T1 },
      { activityId: 'approval:signoff-1', activityKind: 'approval', startedAt: T2, endedAt: T2 },
    ],
    entities: [
      { entityId: 'method:deflection-check', entityKind: 'method' },
      { entityId: 'evidence:abc123', entityKind: 'evidence', digest: REPORT_DIGEST },
      { entityId: 'result:res-1', entityKind: 'result' },
    ],
    statements: [
      { relation: 'was-associated-with', activityId: 'run:stress-check-1', agentId: 'actor:solver-01', role: 'executor' },
      { relation: 'used', activityId: 'run:stress-check-1', entityId: 'method:deflection-check', role: 'method' },
      { relation: 'was-generated-by', entityId: 'evidence:abc123', activityId: 'run:stress-check-1', role: 'evidence', time: T1 },
      { relation: 'was-generated-by', entityId: 'result:res-1', activityId: 'run:stress-check-1', role: 'result', time: T1 },
      { relation: 'was-derived-from', generatedEntityId: 'result:res-1', usedEntityId: 'evidence:abc123' },
      { relation: 'was-attributed-to', entityId: 'result:res-1', agentId: 'actor:solver-01' },
      { relation: 'was-associated-with', activityId: 'approval:signoff-1', agentId: 'actor:reviewer-01', role: 'approver' },
      { relation: 'used', activityId: 'approval:signoff-1', entityId: 'result:res-1', role: 'approved-result', time: T2 },
      { relation: 'acted-on-behalf-of', subordinateAgentId: 'actor:reviewer-01', responsibleAgentId: 'org:engineering', activityId: 'approval:signoff-1' },
    ],
    ...overrides,
  };
}
