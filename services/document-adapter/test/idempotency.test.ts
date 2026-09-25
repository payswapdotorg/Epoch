// Idempotency + replay battery (positive and negative): idempotent
// re-runs with typed idempotency keys, duplicate suppression negatives,
// and stage-driver replay semantics (re-advancing an applied stage is a
// no-op returning the ORIGINAL evidence digest; the state never moves).
import { describe, expect, it } from 'vitest';
import { CapabilityRegistry, sealCapabilityManifest } from '@epoch/capability-registry';
import { DocumentAdapterHost, type DocumentAdapterHost as Host } from '../src/index';
import {
  TENANT_A,
  driveToProvisional,
  ingestInput,
  jsonDocument,
  mustAdvance,
  mustIngest,
  newHost,
  runContext,
  runContextAlt,
  textDocument,
} from './fixtures';
import { expectHostFailure } from './host-helpers';

describe('idempotent ingestion (positive)', () => {
  it('the same (key, digest) re-ingestion returns the SAME session with duplicate: true', () => {
    const host = newHost();
    const document = jsonDocument();
    const first = mustIngest(host, document, 'upload-001');
    const second = mustIngest(host, document, 'upload-001');
    expect(second.sessionId).toBe(first.sessionId);
    expect(second.duplicate).toBe(true);
    expect(second.evidenceDigest).toBe(first.evidenceDigest);
    expect(host.health().sessionCount).toBe(1);
    expect(host.health().evidenceCount).toBe(1);
  });

  it('a DIFFERENT key with the same document opens an independent session', () => {
    const host = newHost();
    const document = jsonDocument();
    const first = mustIngest(host, document, 'upload-001');
    const second = mustIngest(host, document, 'upload-002');
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(host.health().sessionCount).toBe(2);
  });
});

describe('duplicate suppression (negative — idempotency conflicts)', () => {
  it('the same key with a DIFFERENT digest is the typed idempotency-conflict', () => {
    const host = newHost();
    mustIngest(host, textDocument(), 'upload-001');
    const conflict = host.ingestDocument(ingestInput(jsonDocument(), 'upload-001'));
    const error = expectHostFailure(conflict, 'idempotency-conflict');
    expect(error.idempotencyKey).toBe('upload-001');
    expect(error.encounteredDocumentDigest).toBe(jsonDocument().descriptor.digest);
    expect(error.expectedDocumentDigest).toBe(textDocument().descriptor.digest);
    // The conflicting ingestion never created a session.
    expect(host.health().sessionCount).toBe(1);
  });

  it('a malformed idempotency key is rejected by the typed grammar', () => {
    const host = newHost();
    const rejected = host.ingestDocument(ingestInput(jsonDocument(), 'not a valid key!'));
    expectHostFailure(rejected, 'malformed-document');
  });
});

describe('idempotent stage advances (replay, positive)', () => {
  it('re-advancing the APPLIED stage is a no-op returning the original evidence digest', () => {
    const host = newHost();
    const receipt = mustIngest(host, jsonDocument());
    const first = mustAdvance(host, receipt.sessionId, 'parsed', runContext('a'));
    // Replay with a DIFFERENT run context: still a no-op — the first
    // application is authoritative (duplicate suppression).
    const replay = host.advanceSession({
      sessionId: receipt.sessionId,
      to: 'parsed',
      asTenant: TENANT_A,
      run: runContextAlt(),
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value.duplicate).toBe(true);
    expect(replay.value.evidenceDigest).toBe(first.evidenceDigest);
    expect(replay.value.from).toBe('parsed');
    expect(replay.value.to).toBe('parsed');
    // No second evidence record was emitted.
    expect(host.health().evidenceCount).toBe(2);
    const snapshot = host.getSession({ sessionId: receipt.sessionId, asTenant: TENANT_A });
    if (!snapshot.ok) throw new Error(snapshot.error.message);
    expect(snapshot.value.stage).toBe('parsed');
  });

  it('replaying the terminal provisional advance stays terminal and idempotent', () => {
    const host = newHost();
    const sessionId = driveToProvisional(host, jsonDocument());
    const before = host.getSession({ sessionId, asTenant: TENANT_A });
    const healthBefore = host.health();
    const replay = host.advanceSession({
      sessionId,
      to: 'provisional',
      asTenant: TENANT_A,
      run: runContextAlt(),
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.value.duplicate).toBe(true);
    const after = host.getSession({ sessionId, asTenant: TENANT_A });
    expect(after).toEqual(before);
    expect(host.health()).toEqual(healthBefore);
  });

  it('re-ingesting after a full run replays the whole session idempotently', () => {
    const host = newHost();
    const document = jsonDocument();
    const sessionId = driveToProvisional(host, document, 'upload-001');
    const snapshotBefore = host.getSession({ sessionId, asTenant: TENANT_A });
    const receipt = host.ingestDocument(ingestInput(document, 'upload-001'));
    expect(receipt.ok).toBe(true);
    if (!receipt.ok) return;
    expect(receipt.value.duplicate).toBe(true);
    // Replaying the ingestion did NOT reset the session stage.
    const snapshotAfter = host.getSession({ sessionId: receipt.value.sessionId, asTenant: TENANT_A });
    expect(snapshotAfter).toEqual(snapshotBefore);
  });
});

describe('stage driver rejections (negative)', () => {
  it('an unknown session id is the typed unknown-session rejection', () => {
    const host = newHost();
    const missing = host.getSession({
      sessionId: `sess:${'0'.repeat(64)}`,
      asTenant: TENANT_A,
    });
    const error = expectHostFailure(missing, 'unknown-session');
    expect(error.sessionId).toBe(`sess:${'0'.repeat(64)}`);
  });

  it('a stage skip is the kernel-typed policy-violation', () => {
    const host = newHost();
    const receipt = mustIngest(host, jsonDocument());
    const skip = host.advanceSession({
      sessionId: receipt.sessionId,
      to: 'candidates-extracted',
      asTenant: TENANT_A,
      run: runContext(),
    });
    const error = expectHostFailure(skip, 'policy-violation');
    expect(error.rule).toBe('lifecycle-transition');
  });

  it('a stage regression is the kernel-typed policy-violation', () => {
    const host = newHost();
    const receipt = mustIngest(host, jsonDocument());
    mustAdvance(host, receipt.sessionId, 'parsed');
    const regression = host.advanceSession({
      sessionId: receipt.sessionId,
      to: 'uploaded',
      asTenant: TENANT_A,
      run: runContext(),
    });
    expectHostFailure(regression, 'policy-violation');
  });

  it('advancing past the terminal stage is rejected (the floor holds)', () => {
    const host = newHost();
    const sessionId = driveToProvisional(host, jsonDocument());
    const beyond = host.advanceSession({
      sessionId,
      to: 'review-pending',
      asTenant: TENANT_A,
      run: runContext(),
    });
    expectHostFailure(beyond, 'policy-violation');
  });
});

describe('registration conflicts (negative)', () => {
  it('a pre-registered DIFFERENT capability at the derived id is the typed registration-conflict', () => {
    // A registry that already holds docmap.construction.wall@1.0.0 with
    // DIFFERENT content: the derived registration collides.
    const { host } = conflictHostFixture();
    const receipt = mustIngest(host, jsonDocument());
    mustAdvance(host, receipt.sessionId, 'parsed');
    mustAdvance(host, receipt.sessionId, 'candidates-extracted');
    mustAdvance(host, receipt.sessionId, 'review-pending');
    const provisional = host.advanceSession({
      sessionId: receipt.sessionId,
      to: 'provisional',
      asTenant: TENANT_A,
      run: runContext(),
    });
    const error = expectHostFailure(provisional, 'registration-conflict');
    expect(error.capabilityId).toBe('docmap.construction.wall');
    expect(error.version).toBe('1.0.0');
  });
});

/** Build a host whose registry pre-holds a conflicting registration. */
function conflictHostFixture(): { host: Host } {
  const registry = new CapabilityRegistry();
  const sealed = sealCapabilityManifest({
    schemaVersion: 1,
    capabilityId: 'docmap.construction.wall',
    category: 'source',
    version: '1.0.0',
    descriptor: {
      displayName: 'Conflicting pre-registered mapping (different content)',
      description: 'Fixture registration with different content to force a digest conflict.',
      inputs: [{ name: 'source-path', kind: 'string', required: true, description: 'Locator.' }],
      outputs: [
        { name: 'semantic-target', kind: 'string', required: true, description: 'Target.' },
      ],
      assumptions: ['Conflicting fixture assumption.'],
    },
    contracts: [],
    trust: { origin: 'provisional-document-derived' },
  });
  if (!sealed.ok) throw new Error(sealed.error.message);
  const stored = registry.register(sealed.value);
  if (!stored.ok) throw new Error(stored.error.message);
  return { host: DocumentAdapterHost.create({ registry }) };
}
