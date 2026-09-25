// Scene admission negatives: cross-tenant access, dangling references
// (entity/agent/evidence), undeclared overlays, invalid replay positions,
// and digest tamper detection — every failure is a TYPED error code.
import { describe, expect, it } from 'vitest';
import { admitWorldScene, admitSealedWorldScene } from '../src/parse';
import { getWorldScene, createWorldScene, emptyWorldSceneStore } from '../src/scene';
import { sealWorldScene } from '../src/serialize';
import {
  TENANT_A,
  TENANT_B,
  deepClone,
  expectFailure,
  sceneContent,
} from './fixtures';

describe('world scene admission (negative)', () => {
  it('cross-tenant scene access is denied with a typed error', () => {
    const denied = admitWorldScene(sceneContent(), { expectedTenantId: TENANT_B });
    const failure = expectFailure(denied, 'cross-tenant-denied');
    expect(failure.expectedTenantId).toBe(TENANT_B);
    expect(failure.encounteredTenantId).toBe(TENANT_A);
  });

  it('a scene agent reference from another tenant is denied', () => {
    const content = deepClone(sceneContent());
    content.agents[0] = { ...content.agents[0], tenantId: TENANT_B };
    const denied = admitWorldScene(content);
    const failure = expectFailure(denied, 'cross-tenant-denied');
    expect(failure.encounteredTenantId).toBe(TENANT_B);
  });

  it('a scene evidence reference from another tenant is denied', () => {
    const content = deepClone(sceneContent());
    content.evidenceReferences[0] = { ...content.evidenceReferences[0], tenantId: TENANT_B };
    const denied = admitWorldScene(content);
    expectFailure(denied, 'cross-tenant-denied');
  });

  it('a follow-agent camera referencing another tenant is denied', () => {
    const content = deepClone(sceneContent());
    content.camera = {
      mode: 'follow-agent',
      agentRef: { kind: 'agent', tenantId: TENANT_B, agentId: 'agent:planner-1', contentDigest: 'c'.repeat(64) },
    };
    const denied = admitWorldScene(content);
    expectFailure(denied, 'cross-tenant-denied');
  });

  it('a dangling focus target is rejected with unknown-scene-reference', () => {
    const content = deepClone(sceneContent());
    content.focusedEntityIds = ['wall-east-missing'];
    const failure = expectFailure(admitWorldScene(content), 'unknown-scene-reference');
    expect(failure.encountered).toBe('wall-east-missing');
  });

  it('a dangling overlay entity target is rejected with unknown-scene-reference', () => {
    const content = deepClone(sceneContent());
    content.overlays[0] = {
      overlayId: 'ovl-highlight-missing',
      overlayKind: 'highlight',
      entityId: 'wall-east-missing',
      color: '#ff8800',
    };
    const failure = expectFailure(admitWorldScene(content), 'unknown-scene-reference');
    expect(failure.encountered).toBe('wall-east-missing');
  });

  it('a dangling animation target is rejected with unknown-scene-reference', () => {
    const content = deepClone(sceneContent());
    content.animations[0] = {
      ...content.animations[0],
      targetEntityId: 'wall-east-missing',
    };
    expectFailure(admitWorldScene(content), 'unknown-scene-reference');
  });

  it('a dangling narrative evidence citation is rejected with unknown-evidence-reference', () => {
    const content = deepClone(sceneContent());
    const unknownDigest = 'f'.repeat(64);
    content.narrativeBlocks[0] = {
      ...content.narrativeBlocks[0],
      evidenceDigests: [unknownDigest],
    };
    const failure = expectFailure(admitWorldScene(content), 'unknown-evidence-reference');
    expect(failure.evidenceDigest).toBe(unknownDigest);
  });

  it('an applied overlay not in the library is rejected with unknown-overlay-reference', () => {
    const content = deepClone(sceneContent());
    content.appliedOverlays = [{ overlayId: 'ovl-undeclared', orderIndex: 0 }];
    const failure = expectFailure(admitWorldScene(content), 'unknown-overlay-reference');
    expect(failure.overlayId).toBe('ovl-undeclared');
  });

  it('a follow-agent camera targeting an undeclared agent is rejected', () => {
    const content = deepClone(sceneContent());
    content.camera = {
      mode: 'follow-agent',
      agentRef: { kind: 'agent', tenantId: TENANT_A, agentId: 'agent:ghost-9', contentDigest: 'c'.repeat(64) },
    };
    const failure = expectFailure(admitWorldScene(content), 'unknown-scene-reference');
    expect(failure.encountered).toBe('agent:ghost-9');
  });

  it('an out-of-bounds replay position is rejected with invalid-replay-position', () => {
    const content = deepClone(sceneContent());
    content.timeline.position = { atMs: 5000, frameIndex: 3, paused: false };
    const failure = expectFailure(admitWorldScene(content), 'invalid-replay-position');
    expect(failure.encounteredMs).toBe(5000);
  });

  it('a replay window with toSequence <= fromSequence is malformed', () => {
    const content = deepClone(sceneContent());
    content.timeline.position.replayWindow = { fromSequence: 10, toSequence: 10 };
    expectFailure(admitWorldScene(content), 'malformed-record');
  });

  it('a tampered scene digest is rejected with digest-mismatch', () => {
    const sealed = sealWorldScene(sceneContent());
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const tampered = { ...sealed.value, name: 'Tower A — TAMPERED' };
    const failure = expectFailure(admitSealedWorldScene(tampered), 'digest-mismatch');
    expect(failure.encountered).toBe(sealed.value.digest);
  });

  it('protocol version skew fails fast with version-unsupported', () => {
    const content = deepClone(sceneContent());
    (content as { protocolVersion: string }).protocolVersion = '2.0.0';
    const failure = expectFailure(admitWorldScene(content), 'version-unsupported');
    expect(failure.expected).toBe('1.0.0');
    expect(failure.encountered).toBe('2.0.0');
  });

  it('getWorldScene on a missing scene is a typed unknown-scene-reference', () => {
    const found = getWorldScene(emptyWorldSceneStore(), 'wsc-missing');
    const failure = expectFailure(found, 'unknown-scene-reference');
    expect(failure.encountered).toBe('wsc-missing');
  });

  it('getWorldScene with the wrong expected tenant is denied', () => {
    const store = emptyWorldSceneStore();
    const created = createWorldScene(store, sceneContent());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const found = getWorldScene(created.value.state, 'wsc-tower-a-site', {
      expectedTenantId: TENANT_B,
    });
    expectFailure(found, 'cross-tenant-denied');
  });
});
