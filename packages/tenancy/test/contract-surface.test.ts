// Contract surface: the versioned index export and the schema surface
// cover every published data type, and the strict validators reject
// unknown fields (vendor/provider leakage — lock rule 13).
import { describe, expect, it } from 'vitest';
import * as index from '../src/index';
import { TENANCY_SCHEMA_SURFACE } from '../src/index';
import { workspaceNode, worldNode } from './helpers';

describe('packages/tenancy contract surface', () => {
  it('exports the version constants', () => {
    expect(index.TENANCY_CONTRACT_VERSION).toBe('1.0.0');
    expect(index.TENANCY_RECORD_VERSION).toBe(1);
  });

  it('the schema surface is complete, ordered, and duplicate-free', () => {
    const types = TENANCY_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(new Set(types).size).toBe(types.length);
    expect(types).toEqual([...types].sort());
    for (const entry of TENANCY_SCHEMA_SURFACE) {
      expect(typeof entry.schema.safeParse, entry.type).toBe('function');
    }
  });

  it('every surface schema is exported from the index under its name', () => {
    const schemaExportNames: Record<string, string> = {
      TenancyNode: 'TenancyNodeSchema',
      TenancyNodeKind: 'TenancyNodeKindSchema',
      TenancyNodeId: 'TenancyNodeIdSchema',
      TenancyRecordVersion: 'TenancyRecordVersionSchema',
      TenancySnapshot: 'TenancySnapshotSchema',
      SealedTenancyNode: 'SealedTenancyNodeSchema',
      PlatformId: 'PlatformIdSchema',
      TenantId: 'TenantIdSchema',
      WorkspaceId: 'WorkspaceIdSchema',
      ProjectId: 'ProjectIdSchema',
      WorldId: 'WorldIdSchema',
      ScenarioId: 'ScenarioIdSchema',
      EvidenceId: 'EvidenceIdSchema',
      Sha256Digest: 'Sha256DigestSchema',
    };
    for (const [type, exportName] of Object.entries(schemaExportNames)) {
      expect(
        TENANCY_SCHEMA_SURFACE.some((entry) => entry.type === type),
        type,
      ).toBe(true);
      expect((index as Record<string, unknown>)[exportName], exportName).toBeDefined();
    }
  });

  it('strict validators reject unknown fields on every node-kind document', () => {
    const corruption = { ...worldNode(), vendor: 'acme-idp' };
    expect(index.TenancyNodeSchema.safeParse(corruption).success).toBe(false);
    const corruptedWorkspace = { ...workspaceNode(), issuer: 'https://idp.example' };
    expect(index.TenancyNodeSchema.safeParse(corruptedWorkspace).success).toBe(false);
  });

  it('the parent-kind table encodes exactly the frozen hierarchy', () => {
    expect(index.TENANCY_PARENT_KINDS.platform).toBeNull();
    expect(index.TENANCY_PARENT_KINDS.tenant).toEqual(['platform']);
    expect(index.TENANCY_PARENT_KINDS.workspace).toEqual(['tenant']);
    expect(index.TENANCY_PARENT_KINDS.project).toEqual(['workspace']);
    expect(index.TENANCY_PARENT_KINDS.world).toEqual(['project']);
    expect(index.TENANCY_PARENT_KINDS.scenario).toEqual(['project']);
    expect(index.TENANCY_PARENT_KINDS.evidence).toEqual(['project']);
  });

  it('legalParentKinds is total over unknown kinds', () => {
    expect(index.legalParentKinds('tenant')).toEqual(['platform']);
    expect(index.legalParentKinds('galaxy')).toBeUndefined();
  });
});
