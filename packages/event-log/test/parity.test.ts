// RUNTIME PARITY with the W009 sibling vocabularies (the W011
// kernel-parity pattern): the mirrored tenant/principal id grammars are
// IDENTICAL to @epoch/tenancy's TENANT_ID_PATTERN and @epoch/identity's
// PRINCIPAL_ID_PATTERN; world entity ids and relation ids are accepted by
// (and round-trip through) the REAL @epoch/world-model validators and the
// WorldModel API; the action-derived payload references are accepted by
// the REAL @epoch/action-protocol validators. DevDependencies only — no
// runtime coupling.
import { describe, expect, it } from 'vitest';
import {
  PRINCIPAL_ID_PATTERN as IDENTITY_PRINCIPAL_ID_PATTERN,
  PrincipalIdSchema as IdentityPrincipalIdSchema,
} from '@epoch/identity';
import { TENANT_ID_PATTERN as TENANCY_TENANT_ID_PATTERN } from '@epoch/tenancy';
import {
  ActionProposalSchema,
  ProposalReferenceSchema,
} from '@epoch/action-protocol';
import { EntityIdSchema, RelationSchema, relationKeyId, WorldModel } from '@epoch/world-model';
import {
  EVENT_ACTOR_PATTERN,
  EVENT_TENANT_ID_PATTERN,
  EventSubjectSchema,
  parseActionLifecycleEventData,
  parseWorldSubjectsEventData,
  sealEvent,
  WORLD_RELATION_ID_PATTERN,
} from '../src/index';
import { firstEvent, thirdEvent } from './helpers';

describe('W009 tenancy parity (runtime)', () => {
  it('the mirrored tenant id pattern is exactly the tenancy pattern', () => {
    expect(EVENT_TENANT_ID_PATTERN.source).toBe(TENANCY_TENANT_ID_PATTERN.source);
    expect(EVENT_TENANT_ID_PATTERN.flags).toBe(TENANCY_TENANT_ID_PATTERN.flags);
  });

  it('the same sample ids pass/fail both patterns', () => {
    const valid = ['tenant:acme', 'tenant:a', 'tenant:bridge-12'];
    const invalid = ['Tenant:ACME', 'tenant:', 'tenant:-x', 'acme', 'tenant:' + 'a'.repeat(64)];
    for (const id of valid) {
      expect(new RegExp(EVENT_TENANT_ID_PATTERN).test(id)).toBe(true);
      expect(new RegExp(TENANCY_TENANT_ID_PATTERN).test(id)).toBe(true);
    }
    for (const id of invalid) {
      expect(new RegExp(EVENT_TENANT_ID_PATTERN).test(id)).toBe(false);
      expect(new RegExp(TENANCY_TENANT_ID_PATTERN).test(id)).toBe(false);
    }
  });
});

describe('W009 identity parity (runtime)', () => {
  it('the mirrored actor pattern is exactly the identity principal pattern', () => {
    expect(EVENT_ACTOR_PATTERN.source).toBe(IDENTITY_PRINCIPAL_ID_PATTERN.source);
    expect(EVENT_ACTOR_PATTERN.flags).toBe(IDENTITY_PRINCIPAL_ID_PATTERN.flags);
  });

  it('identity principal ids are valid event actors and vice versa', () => {
    const samples = ['principal:lead-eng', 'principal:a', 'principal:svc-42'];
    for (const id of samples) {
      expect(IdentityPrincipalIdSchema.safeParse(id).success).toBe(true);
      expect(new RegExp(EVENT_ACTOR_PATTERN).test(id)).toBe(true);
    }
    const invalid = ['principal:', 'Principal:X', 'agent:bot', 'human:ada'];
    for (const id of invalid) {
      expect(IdentityPrincipalIdSchema.safeParse(id).success).toBe(false);
      expect(new RegExp(EVENT_ACTOR_PATTERN).test(id)).toBe(false);
    }
  });
});

describe('W002 world-model parity (runtime)', () => {
  it('event subjects use the real world-model entity id grammar', () => {
    const subject = { kind: 'entity', entityId: 'element:column-c4' };
    const parsed = EventSubjectSchema.safeParse(subject);
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.kind === 'entity') {
      expect(EntityIdSchema.safeParse(parsed.data.entityId).success).toBe(true);
    }
  });

  it('the mirrored relation id grammar matches ids derived by the WorldModel API', () => {
    // relationKeyId is the W002 derivation of relation ids.
    const derivedId = relationKeyId('core:connects|element:a|element:b');
    expect(derivedId).toMatch(WORLD_RELATION_ID_PATTERN);
    // And a real relation materialized through the WorldModel API carries
    // an id that satisfies the mirrored grammar.
    const model = WorldModel.create();
    model.applyAssertion({
      statement: {
        kind: 'entity',
        entityId: 'element:column-c4',
        entityType: 'core:entity',
        properties: {},
      },
      provenance: {
        actor: { id: 'user:alice', role: 'human' },
        method: 'direct-observation',
        evidence: [],
      },
      confidence: { distribution: { kind: 'point', value: 0.9 }, method: 'measured' },
    });
    model.applyAssertion({
      statement: {
        kind: 'entity',
        entityId: 'element:beam-b7',
        entityType: 'core:entity',
        properties: {},
      },
      provenance: {
        actor: { id: 'user:alice', role: 'human' },
        method: 'direct-observation',
        evidence: [],
      },
      confidence: { distribution: { kind: 'point', value: 0.9 }, method: 'measured' },
    });
    model.applyAssertion({
      statement: {
        kind: 'relation',
        relationType: 'core:related-to',
        source: 'element:column-c4',
        target: 'element:beam-b7',
        properties: {},
      },
      provenance: {
        actor: { id: 'user:alice', role: 'human' },
        method: 'direct-observation',
        evidence: [],
      },
      confidence: { distribution: { kind: 'point', value: 0.9 }, method: 'measured' },
    });
    const relation = model.getRelation({
      type: 'core:related-to',
      source: 'element:column-c4',
      target: 'element:beam-b7',
    });
    expect(relation).not.toBeNull();
    expect(relation?.id).toMatch(WORLD_RELATION_ID_PATTERN);
    // The full relation record also validates against the real validator.
    expect(RelationSchema.safeParse(relation).success).toBe(true);
    // And a subject referencing that relation round-trips.
    const subject = { kind: 'relation', relationId: relation?.id ?? 'rel-'.padEnd(68, '0') };
    const parsedSubject = EventSubjectSchema.safeParse(subject);
    expect(parsedSubject.success).toBe(true);
  });

  it('a real world-model entity id round-trips through a world:subjects event', () => {
    // Materialize an entity through the real WorldModel API (builtin
    // core:actor vocabulary) and reference it.
    const model = WorldModel.create();
    model.applyAssertion({
      statement: {
        kind: 'entity',
        entityId: 'user:alice',
        entityType: 'core:actor',
        properties: { displayName: 'Alice' },
      },
      provenance: {
        actor: { id: 'user:alice', role: 'human', displayName: 'Alice' },
        method: 'direct-observation',
        evidence: [{ id: 'ev:doc-1', kind: 'document' }],
      },
      confidence: { distribution: { kind: 'point', value: 0.95 }, method: 'measured' },
    });
    const entity = model.getEntity('user:alice');
    expect(entity).not.toBeNull();
    const entityId = entity?.id ?? 'user:alice';
    const sealed = sealEvent(
      firstEvent({
        payload: {
          discriminator: 'world:subjects',
          data: { subjects: [{ kind: 'entity', entityId }] },
        },
      }),
    );
    expect(sealed.ok).toBe(true);
    if (sealed.ok) {
      const subjects = parseWorldSubjectsEventData(sealed.value.event.payload);
      if (!subjects.ok) throw new Error(subjects.error.message);
      expect(subjects.value.subjects[0]).toEqual({ kind: 'entity', entityId });
    }
  });
});

describe('W003 action-protocol parity (runtime)', () => {
  it('action lifecycle payload references satisfy the real action-protocol validators', () => {
    const sealed = sealEvent(thirdEvent());
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const parsed = parseActionLifecycleEventData(sealed.value.event.payload);
    if (!parsed.ok) throw new Error(parsed.error.message);
    expect(ProposalReferenceSchema.safeParse(parsed.value.action).success).toBe(true);

    // The proposal id/digest reference an EXACT proposal revision: build
    // a real proposal and reference IT.
    const proposal = {
      protocolVersion: '1.0.0',
      messageKind: 'action.proposal',
      messageId: 'msg-abc-001',
      createdAt: '2026-02-05T11:00:00.000Z',
      proposalId: 'msg-abc-001',
      proposedBy: 'agent:crane-planner',
      actionType: { id: 'structural.element.reinforce', version: '1.0.0' },
      target: { kind: 'world-entity', ref: 'element:column-c4' },
      parameters: { quantity: 12 },
      preconditions: [],
      predictedEffects: [
        {
          description: 'element strength raised',
          targetRef: { kind: 'world-entity', ref: 'element:column-c4' },
          confidence: { kind: 'quantified', value: 0.9 },
        },
      ],
      sideEffects: [],
      reversibility: { kind: 'reversible', via: 'manual' },
      authorityRequirements: {
        requiredScopes: ['world:write'],
        requiresHumanApproval: false,
      },
    };
    const admitted = ActionProposalSchema.safeParse(proposal);
    expect(admitted.success).toBe(true);
  });
});
