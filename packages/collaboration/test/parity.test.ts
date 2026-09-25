// RUNTIME PARITY with the W009 sibling vocabularies and the W002/W003
// subject grammars (the W010 kernel-parity pattern): the mirrored
// tenant/principal/workspace/project id grammars are IDENTICAL to
// @epoch/tenancy's and @epoch/identity's; world-entity subjects are
// accepted by the REAL @epoch/world-model validator; action-proposal
// subjects are accepted by the REAL @epoch/action-protocol validator.
// DevDependencies only — no runtime coupling.
import { describe, expect, it } from 'vitest';
import {
  PRINCIPAL_ID_PATTERN as IDENTITY_PRINCIPAL_ID_PATTERN,
  PrincipalIdSchema as IdentityPrincipalIdSchema,
} from '@epoch/identity';
import {
  PROJECT_ID_PATTERN as TENANCY_PROJECT_ID_PATTERN,
  TENANT_ID_PATTERN as TENANCY_TENANT_ID_PATTERN,
  WORKSPACE_ID_PATTERN as TENANCY_WORKSPACE_ID_PATTERN,
} from '@epoch/tenancy';
import { ProposalReferenceSchema } from '@epoch/action-protocol';
import { EntityIdSchema } from '@epoch/world-model';
import {
  COLLABORATION_PRINCIPAL_ID_PATTERN,
  COLLABORATION_PROJECT_ID_PATTERN,
  COLLABORATION_TENANT_ID_PATTERN,
  COLLABORATION_WORKSPACE_ID_PATTERN,
  CollaborationSubjectSchema,
  sealEvent,
  sealSession,
} from '../src/index';
import { joinEvent, session } from './helpers';

describe('W009 tenancy parity (runtime)', () => {
  it('the mirrored tenant id pattern is exactly the tenancy pattern', () => {
    expect(COLLABORATION_TENANT_ID_PATTERN.source).toBe(TENANCY_TENANT_ID_PATTERN.source);
    expect(COLLABORATION_TENANT_ID_PATTERN.flags).toBe(TENANCY_TENANT_ID_PATTERN.flags);
  });

  it('the mirrored workspace/project id patterns are exactly the tenancy patterns', () => {
    expect(COLLABORATION_WORKSPACE_ID_PATTERN.source).toBe(
      TENANCY_WORKSPACE_ID_PATTERN.source,
    );
    expect(COLLABORATION_PROJECT_ID_PATTERN.source).toBe(
      TENANCY_PROJECT_ID_PATTERN.source,
    );
  });

  it('the same sample ids pass/fail both grammars', () => {
    const valid = ['tenant:acme', 'tenant:a', 'tenant:globex'];
    const invalid = ['Tenant:ACME', 'tenant:', 'acme', 'tenant:' + 'a'.repeat(64)];
    for (const id of valid) {
      expect(new RegExp(COLLABORATION_TENANT_ID_PATTERN).test(id)).toBe(true);
      expect(new RegExp(TENANCY_TENANT_ID_PATTERN).test(id)).toBe(true);
    }
    for (const id of invalid) {
      expect(new RegExp(COLLABORATION_TENANT_ID_PATTERN).test(id)).toBe(false);
      expect(new RegExp(TENANCY_TENANT_ID_PATTERN).test(id)).toBe(false);
    }
  });
});

describe('W009 identity parity (runtime)', () => {
  it('the mirrored participant pattern is exactly the identity principal pattern', () => {
    expect(COLLABORATION_PRINCIPAL_ID_PATTERN.source).toBe(
      IDENTITY_PRINCIPAL_ID_PATTERN.source,
    );
    expect(COLLABORATION_PRINCIPAL_ID_PATTERN.flags).toBe(
      IDENTITY_PRINCIPAL_ID_PATTERN.flags,
    );
  });

  it('identity principal ids are valid participants and vice versa', () => {
    const samples = ['principal:lead-eng', 'principal:inspector', 'principal:svc-42'];
    for (const id of samples) {
      expect(IdentityPrincipalIdSchema.safeParse(id).success).toBe(true);
      expect(new RegExp(COLLABORATION_PRINCIPAL_ID_PATTERN).test(id)).toBe(true);
    }
    const invalid = ['principal:', 'Principal:X', 'agent:bot', 'user:ada'];
    for (const id of invalid) {
      expect(IdentityPrincipalIdSchema.safeParse(id).success).toBe(false);
      expect(new RegExp(COLLABORATION_PRINCIPAL_ID_PATTERN).test(id)).toBe(false);
    }
  });

  it('a join event with a REAL identity principal id seals and is accepted', () => {
    const sealed = sealEvent(joinEvent({ participant: 'principal:inspector' }));
    expect(sealed.ok).toBe(true);
  });
});

describe('W002/W003 subject parity (runtime)', () => {
  it('world-entity subjects use the real world-model entity id grammar', () => {
    const subject = { kind: 'world-entity', entityId: 'element:column-c4' };
    const parsed = CollaborationSubjectSchema.safeParse(subject);
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.kind === 'world-entity') {
      expect(EntityIdSchema.safeParse(parsed.data.entityId).success).toBe(true);
    }
  });

  it('action-proposal subjects use the real action-protocol proposal grammar', () => {
    const subject = {
      kind: 'action-proposal',
      proposal: { proposalId: 'msg-abc-001', canonicalDigest: '0'.repeat(64) },
    };
    const parsed = CollaborationSubjectSchema.safeParse(subject);
    expect(parsed.success).toBe(true);
    if (parsed.success && parsed.data.kind === 'action-proposal') {
      expect(ProposalReferenceSchema.safeParse(parsed.data.proposal).success).toBe(true);
    }
  });

  it('a focus event with an action-proposal subject seals', () => {
    const sealed = sealEvent({
      ...joinEvent(),
      kind: 'subject.focused',
      participant: undefined,
      subject: {
        kind: 'action-proposal',
        proposal: { proposalId: 'msg-abc-001', canonicalDigest: '0'.repeat(64) },
      },
    });
    expect(sealed.ok).toBe(true);
  });

  it('session scope narrowing uses the tenancy grammar', () => {
    expect(sealSession(session()).ok).toBe(true);
    expect(
      sealSession(session({ scope: { projectId: 'project:bridge-12' } })).ok,
    ).toBe(false);
    expect(
      sealSession(
        session({
          scope: {
            workspaceId: 'workspace:acme-eng',
            projectId: 'project:bridge-12',
          },
        }),
      ).ok,
    ).toBe(true);
  });
});
