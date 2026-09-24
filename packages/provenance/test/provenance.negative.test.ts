// Negative tests: unknown agents/activities and dangling entities are
// rejected, duplicate ids are rejected, derivation must be irreflexive and
// acyclic, activity time bounds must be ordered, schema violations and
// version skew are rejected with typed issues.
import { describe, expect, it } from 'vitest';
import { admitProvenanceGraph, parseProvenanceGraph } from '../src/index';
import { provenanceGraph, T0, T2 } from './helpers';

describe('reference integrity (negative: dangling references rejected)', () => {
  it('rejects an unknown agent in was-associated-with', () => {
    const result = admitProvenanceGraph(
      provenanceGraph({
        statements: [
          { relation: 'was-associated-with', activityId: 'run:stress-check-1', agentId: 'actor:ghost' },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'unknown-agent' && i.message.includes('actor:ghost'))).toBe(true);
  });

  it('rejects an unknown agent in was-attributed-to', () => {
    const result = admitProvenanceGraph(
      provenanceGraph({
        statements: [
          { relation: 'was-attributed-to', entityId: 'result:res-1', agentId: 'actor:nobody' },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'unknown-agent')).toBe(true);
  });

  it('rejects unknown agents in acted-on-behalf-of (subordinate and responsible)', () => {
    const result = admitProvenanceGraph(
      provenanceGraph({
        statements: [
          {
            relation: 'acted-on-behalf-of',
            subordinateAgentId: 'actor:ghost-a',
            responsibleAgentId: 'actor:ghost-b',
          },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const unknownAgents = result.issues.filter((i) => i.code === 'unknown-agent');
    expect(unknownAgents).toHaveLength(2);
  });

  it('rejects a dangling entity in was-generated-by', () => {
    const result = admitProvenanceGraph(
      provenanceGraph({
        statements: [
          { relation: 'was-generated-by', entityId: 'evidence:missing', activityId: 'run:stress-check-1' },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'unknown-entity' && i.message.includes('evidence:missing'))).toBe(true);
  });

  it('rejects a dangling entity in used', () => {
    const result = admitProvenanceGraph(
      provenanceGraph({
        statements: [{ relation: 'used', activityId: 'run:stress-check-1', entityId: 'nope' }],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'unknown-entity')).toBe(true);
  });

  it('rejects an unknown activity in used / was-generated-by / was-derived-from', () => {
    for (const statements of [
      [{ relation: 'used', activityId: 'run:ghost', entityId: 'evidence:abc123' }],
      [{ relation: 'was-generated-by', entityId: 'evidence:abc123', activityId: 'run:ghost' }],
      [
        {
          relation: 'was-derived-from',
          generatedEntityId: 'result:res-1',
          usedEntityId: 'evidence:abc123',
          activityId: 'run:ghost',
        },
      ],
    ]) {
      const result = admitProvenanceGraph(provenanceGraph({ statements: statements as never }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.code === 'unknown-activity')).toBe(true);
      }
    }
  });
});

describe('node identity (negative: duplicates rejected)', () => {
  it('rejects duplicate agent ids', () => {
    const result = admitProvenanceGraph(
      provenanceGraph({
        agents: [
          { agentId: 'actor:solver-01', agentKind: 'software' },
          { agentId: 'actor:solver-01', agentKind: 'person' },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'duplicate-agent')).toBe(true);
  });

  it('rejects duplicate activity and entity ids', () => {
    const dupActivities = admitProvenanceGraph(
      provenanceGraph({
        activities: [
          { activityId: 'run:stress-check-1', activityKind: 'verification-run' },
          { activityId: 'run:stress-check-1', activityKind: 'validation-run' },
        ],
      }),
    );
    expect(dupActivities.ok).toBe(false);
    if (!dupActivities.ok) {
      expect(dupActivities.issues.some((i) => i.code === 'duplicate-activity')).toBe(true);
    }
    const dupEntities = admitProvenanceGraph(
      provenanceGraph({
        entities: [
          { entityId: 'evidence:abc123', entityKind: 'evidence' },
          { entityId: 'evidence:abc123', entityKind: 'document' },
        ],
      }),
    );
    expect(dupEntities.ok).toBe(false);
    if (!dupEntities.ok) {
      expect(dupEntities.issues.some((i) => i.code === 'duplicate-entity')).toBe(true);
    }
  });
});

describe('derivation ordering (negative: cycles rejected)', () => {
  it('rejects self-derivation (was-derived-from itself)', () => {
    const result = admitProvenanceGraph(
      provenanceGraph({
        statements: [
          { relation: 'was-derived-from', generatedEntityId: 'evidence:abc123', usedEntityId: 'evidence:abc123' },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'self-derivation')).toBe(true);
  });

  it('rejects a two-node derivation cycle', () => {
    const result = admitProvenanceGraph(
      provenanceGraph({
        statements: [
          { relation: 'was-derived-from', generatedEntityId: 'result:res-1', usedEntityId: 'evidence:abc123' },
          { relation: 'was-derived-from', generatedEntityId: 'evidence:abc123', usedEntityId: 'result:res-1' },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'derivation-cycle')).toBe(true);
  });

  it('rejects a longer derivation cycle across three entities', () => {
    const result = admitProvenanceGraph(
      provenanceGraph({
        entities: [
          { entityId: 'e:a', entityKind: 'document' },
          { entityId: 'e:b', entityKind: 'document' },
          { entityId: 'e:c', entityKind: 'document' },
        ],
        statements: [
          { relation: 'was-derived-from', generatedEntityId: 'e:b', usedEntityId: 'e:a' },
          { relation: 'was-derived-from', generatedEntityId: 'e:c', usedEntityId: 'e:b' },
          { relation: 'was-derived-from', generatedEntityId: 'e:a', usedEntityId: 'e:c' },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'derivation-cycle')).toBe(true);
  });
});

describe('temporal sanity (negative: unordered activity bounds rejected)', () => {
  it('rejects an activity that starts after it ends', () => {
    const result = admitProvenanceGraph(
      provenanceGraph({
        activities: [
          { activityId: 'run:stress-check-1', activityKind: 'verification-run', startedAt: T2, endedAt: T0 },
          { activityId: 'approval:signoff-1', activityKind: 'approval', startedAt: T2, endedAt: T2 },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((i) => i.code === 'activity-time-order')).toBe(true);
  });
});

describe('schema violations (negative: malformed graphs rejected)', () => {
  it('rejects unknown keys (strict shape)', () => {
    const result = admitProvenanceGraph({ ...provenanceGraph(), extra: true });
    expect(result.ok).toBe(false);
  });

  it('rejects unknown relation kinds', () => {
    const result = admitProvenanceGraph(
      provenanceGraph({
        statements: [{ relation: 'was-magically-created-by', entityId: 'evidence:abc123' }],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects unknown agent kinds and malformed node kinds', () => {
    expect(admitProvenanceGraph(provenanceGraph({ agents: [{ agentId: 'a', agentKind: 'cyborg' }] })).ok).toBe(false);
    expect(admitProvenanceGraph(provenanceGraph({ activities: [{ activityId: 'r', activityKind: 'Not A Slug' }] })).ok).toBe(false);
    expect(admitProvenanceGraph(provenanceGraph({ entities: [{ entityId: 'e', entityKind: 'NOPE' }] })).ok).toBe(false);
  });

  it('rejects malformed entity digests (not 64 lowercase hex)', () => {
    const result = admitProvenanceGraph(
      provenanceGraph({ entities: [{ entityId: 'e', entityKind: 'evidence', digest: 'xyz' }] }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects non-canonical timestamps', () => {
    const result = admitProvenanceGraph(
      provenanceGraph({
        activities: [{ activityId: 'r', activityKind: 'run', startedAt: '2025-06-01T08:00:00Z' }],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects non-array collections', () => {
    const result = admitProvenanceGraph(provenanceGraph({ agents: 'many' }));
    expect(result.ok).toBe(false);
  });
});

describe('version discriminator (negative: version skew rejected distinctly)', () => {
  it('rejects schemaVersion 2 with the dedicated version-mismatch code', () => {
    const result = parseProvenanceGraph(provenanceGraph({ schemaVersion: 2 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.code).toBe('version-mismatch');
  });

  it('rejects a missing schemaVersion as a schema issue', () => {
    const bad = provenanceGraph();
    delete bad.schemaVersion;
    const result = parseProvenanceGraph(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.every((i) => i.code === 'schema')).toBe(true);
  });
});
