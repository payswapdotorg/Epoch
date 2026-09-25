// Contract surface: the versioned index export and the schema surface
// cover every published data type, and the strict validators reject
// unknown fields (vendor/provider leakage — lock rule 13).
import { describe, expect, it } from 'vitest';
import * as index from '../src/index';
import { AUTHORIZATION_SCHEMA_SURFACE } from '../src/index';
import { evidencePath, request } from './helpers';

describe('packages/authorization contract surface', () => {
  it('exports the version constants', () => {
    expect(index.AUTHORIZATION_CONTRACT_VERSION).toBe('1.0.0');
    expect(index.AUTHORIZATION_RECORD_VERSION).toBe(1);
  });

  it('the schema surface is complete, sorted, and duplicate-free', () => {
    const types = AUTHORIZATION_SCHEMA_SURFACE.map((entry) => entry.type);
    expect(new Set(types).size).toBe(types.length);
    expect(types).toEqual([...types].sort());
    for (const entry of AUTHORIZATION_SCHEMA_SURFACE) {
      expect(typeof entry.schema.safeParse, entry.type).toBe('function');
    }
  });

  it('every surface schema is exported from the index under its name', () => {
    const schemaExportNames: Record<string, string> = {
      ActionKind: 'ActionKindSchema',
      AuthorizationContext: 'AuthorizationContextSchema',
      AuthorizationDecision: 'AuthorizationDecisionSchema',
      AuthorizationRecord: 'AuthorizationRecordSchema',
      AuthorizationRecordVersion: 'AuthorizationRecordVersionSchema',
      AuthorizationRequest: 'AuthorizationRequestSchema',
      DecisionOutcome: 'DecisionOutcomeSchema',
      DecisionReason: 'DecisionReasonSchema',
      DecisionReasonCode: 'DecisionReasonCodeSchema',
      EvidencePath: 'EvidencePathSchema',
      PolicyTag: 'PolicyTagSchema',
      PolicyTargetProjection: 'PolicyTargetProjectionSchema',
      PrincipalId: 'PrincipalIdSchema',
      ResourceId: 'ResourceIdSchema',
      ResourceReference: 'ResourceReferenceSchema',
      ResourceType: 'ResourceTypeSchema',
      Sha256Digest: 'Sha256DigestSchema',
      TenantId: 'TenantIdSchema',
    };
    for (const [type, exportName] of Object.entries(schemaExportNames)) {
      expect(
        AUTHORIZATION_SCHEMA_SURFACE.some((entry) => entry.type === type),
        type,
      ).toBe(true);
      expect((index as Record<string, unknown>)[exportName], exportName).toBeDefined();
    }
  });

  it('strict validators reject unknown fields on request documents', () => {
    const requestFixture = request();
    const resource = requestFixture['resource'] as Record<string, unknown>;
    expect(
      index.AuthorizationRequestSchema.safeParse({
        ...requestFixture,
        policyEngine: 'acme-opa',
      }).success,
    ).toBe(false);
    expect(
      index.AuthorizationRequestSchema.safeParse({
        ...requestFixture,
        resource: { ...resource, vendor: 'acme' },
      }).success,
    ).toBe(false);
    expect(
      index.EvidencePathSchema.safeParse({ ...evidencePath(), locator: 's3://bucket' })
        .success,
    ).toBe(false);
  });

  it('the decision vocabularies are pinned', () => {
    expect(index.DECISION_OUTCOMES).toEqual(['allow', 'deny', 'not-applicable']);
    expect(index.DECISION_REASON_CODES).toEqual([
      'principal-verified',
      'tenant-verified',
      'policy-allows',
      'policy-denies',
      'no-applicable-policy',
    ]);
  });
});
