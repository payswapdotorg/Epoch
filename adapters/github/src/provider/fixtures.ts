/**
 * @epoch/adapter-github — reference provider fixtures (provider
 * vocabulary allowed HERE only; the W020/W022 reference precedent: no
 * live network calls, fixtures stand in for provider payloads).
 *
 * Fixtures are DETERMINISTIC constructors, not literals with random or
 * wall-clock content: identical calls produce byte-identical payloads, so
 * ingestion digests and projections replay identically (pinned by the
 * determinism tests).
 */
import { sha256Hex } from '@epoch/agent-protocol';
import { PROVIDER_SNAPSHOT_VERSION, PROVIDER_SERVICE_NAME } from './payload';

/** A stable instant used by the reference fixtures (no wall-clock reads). */
export const FIXTURE_INSTANT = '2026-03-01T09:00:00.000Z' as const;

/** The canonical workspace name of the reference fixture. */
export const FIXTURE_WORKSPACE_NAME = 'epoch-reference-app' as const;

/** A fixed content hash for fixture entities (deterministic, full entropy). */
const fixtureHash = (seed: string): string => sha256Hex(`fixture:${seed}`).slice(0, 40);

const fixtureRevision = (seed: string, message: string, parents: string[]) => ({
  sha: fixtureHash(`revision:${seed}`),
  message,
  authorName: 'fixture-author',
  authoredAt: FIXTURE_INSTANT,
  parents,
  tree: [
    { path: 'README.md', kind: 'blob' as const, hash: fixtureHash(`blob:${seed}:readme`) },
    { path: 'src', kind: 'tree' as const, hash: fixtureHash(`tree:${seed}:src`) },
    { path: 'src/main.ts', kind: 'blob' as const, hash: fixtureHash(`blob:${seed}:main`) },
  ],
});

/**
 * The canonical reference snapshot: three chained revisions, one work
 * item referencing the head, default branch `main`.
 */
export function referenceSnapshot(): unknown {
  const revision1 = fixtureRevision('one', 'chore: scaffold workspace', []);
  const revision2 = fixtureRevision('two', 'feat: core pipeline', [revision1.sha]);
  const revision3 = fixtureRevision('three', 'fix: replay digest stability', [revision2.sha]);
  return {
    schemaVersion: PROVIDER_SNAPSHOT_VERSION,
    service: PROVIDER_SERVICE_NAME,
    repository: { name: FIXTURE_WORKSPACE_NAME, defaultBranch: 'main' },
    revisions: [revision1, revision2, revision3],
    workItems: [
      {
        number: 7,
        kind: 'issue',
        title: 'Replay must reproduce identical digests',
        state: 'open',
      },
      {
        number: 8,
        kind: 'pull-request',
        title: 'Stabilize projection ordering',
        state: 'open',
        headSha: revision3.sha,
      },
    ],
  };
}

/**
 * A SECOND, distinct reference snapshot (different revisions) for
 * replay-conflict evidence: same workspace identity, different content.
 */
export function conflictingSnapshot(): unknown {
  const revision1 = fixtureRevision('divergent-one', 'chore: divergent scaffold', []);
  const revision2 = fixtureRevision('divergent-two', 'feat: divergent pipeline', [revision1.sha]);
  return {
    schemaVersion: PROVIDER_SNAPSHOT_VERSION,
    service: PROVIDER_SERVICE_NAME,
    repository: { name: FIXTURE_WORKSPACE_NAME, defaultBranch: 'main' },
    revisions: [revision1, revision2],
    workItems: [],
  };
}

/** A malformed provider payload (unknown envelope version). */
export function malformedSnapshot(): unknown {
  return { schemaVersion: 99, service: PROVIDER_SERVICE_NAME, repository: {}, revisions: [] };
}

/** A structurally admitted but semantically empty payload (no revisions is invalid). */
export function incompleteSnapshot(): unknown {
  return {
    schemaVersion: PROVIDER_SNAPSHOT_VERSION,
    service: PROVIDER_SERVICE_NAME,
    repository: { name: FIXTURE_WORKSPACE_NAME, defaultBranch: 'main' },
    revisions: [],
    workItems: [],
  };
}
