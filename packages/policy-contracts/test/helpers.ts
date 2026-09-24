// Shared policy test fixtures.
import type { PolicyDocument } from '../src';

export function policy(overrides: Partial<PolicyDocument> & Pick<PolicyDocument, 'id'>): PolicyDocument {
  return {
    languageVersion: '1.0.0',
    version: '1.0.0',
    name: `Policy ${overrides.id}`,
    enabled: true,
    applicability: {},
    bindings: [{ constraintId: `${overrides.id}-constraint` }],
    precedence: { tier: 'workspace', rank: 0 },
    composition: 'additive',
    ...overrides,
  };
}

export const target = {
  tenantId: 'tenant-1',
  workspaceId: 'ws-1',
  projectId: 'proj-1',
  actionKind: 'deploy',
  resourceType: 'cluster',
  tags: ['production', 'critical'],
};
