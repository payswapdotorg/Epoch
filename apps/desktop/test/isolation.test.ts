// W017 acceptance: tenant isolation battery (R12) — the cross-tenant
// denials across every surface that carries a tenant: session scopes,
// experience offers, authoring proposals, cache reads, and W013
// invocations (via the shell).
import { describe, expect, it } from 'vitest';
import {
  admitExperienceOffer,
  admitProposalForTenant,
  createDesktopShell,
  createReferenceHost,
  resolveSessionScope,
} from '../src/index';
import {
  PRINCIPAL,
  TENANT_A,
  TENANT_B,
  buildHierarchy,
  compiledExperience,
  expectFailure,
  goldenScenario,
} from './fixtures';

describe('cross-tenant denial battery (R12)', () => {
  it('session scopes: a workspace of another tenant is denied', () => {
    expectFailure(
      resolveSessionScope(buildHierarchy(), { tenantId: TENANT_A, workspaceId: 'workspace:other' }),
      'cross-tenant-denied',
    );
  });

  it('experience offers: a graph of another tenant is denied', () => {
    const foreign = compiledExperience('2d', { tenantScope: { tenantId: TENANT_B } });
    expectFailure(
      admitExperienceOffer(
        { tenantId: TENANT_A },
        { graph: foreign.graph, plan: foreign.plan },
        { envelopeId: 'env-host-0003', atMs: 20 },
      ),
      'cross-tenant-denied',
    );
  });

  it('authoring proposals: a proposal submitted for another tenant is denied', () => {
    const proposal = goldenScenario({ withMount: false });
    const emitted = proposal.shellEnvelopes.find(
      (envelope) => envelope.body.kind === 'authoring-proposal',
    );
    expect(emitted).toBeDefined();
    if (emitted && emitted.body.kind === 'authoring-proposal') {
      const sealed = emitted.body.payload.proposal as Parameters<typeof admitProposalForTenant>[0];
      expectFailure(admitProposalForTenant(sealed, TENANT_B), 'cross-tenant-denied');
      expect(admitProposalForTenant(sealed, TENANT_A).ok).toBe(true);
    }
  });

  it('cache reads: an entry of another tenant is denied', () => {
    const scenario = goldenScenario();
    const session = scenario.shell.session;
    expect(session).toBeDefined();
    if (session) {
      expectFailure(
        session.cache.resolve(scenario.experience.graph.digest, { expectedTenantId: TENANT_B }),
        'cross-tenant-denied',
      );
      expect(session.cache.resolve(scenario.experience.graph.digest, { expectedTenantId: TENANT_A }).ok).toBe(true);
    }
  });

  it('shell-level: a cross-tenant session open never establishes a session', () => {
    const shell = createDesktopShell({ tenancy: buildHierarchy() });
    const host = createReferenceHost({
      sessionId: 'dss-beta-1',
      scope: { tenantId: TENANT_A, workspaceId: 'workspace:other' },
      principal: PRINCIPAL,
    });
    const envelope = host.send(
      {
        kind: 'session-open',
        payload: { scope: { tenantId: TENANT_A, workspaceId: 'workspace:other' }, principal: PRINCIPAL },
      },
      0,
      'env-host-session-open',
    );
    expect(envelope.ok).toBe(true);
    if (envelope.ok) {
      expectFailure(shell.applyHostEnvelope(envelope.value.envelope), 'cross-tenant-denied');
      expect(shell.session).toBeUndefined();
    }
  });

  it('isolation by construction: a tenant-B shell never sees tenant-A experiences', () => {
    // A session scoped to tenant B cannot admit tenant-A offers at all.
    const foreign = compiledExperience('2d', { tenantScope: { tenantId: TENANT_A } });
    expectFailure(
      admitExperienceOffer(
        { tenantId: TENANT_B },
        { graph: foreign.graph, plan: foreign.plan },
        { envelopeId: 'env-host-0003', atMs: 20 },
      ),
      'cross-tenant-denied',
    );
  });
});
