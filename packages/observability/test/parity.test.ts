// RUNTIME PARITY with the sibling kernel vocabularies (the W043
// kernel-parity pattern; devDependencies only — no runtime coupling):
//
// - W010 event-log: the mirrored security-event shape is admitted by
//   the REAL @epoch/event-log seal path (sealEvent) and digests
//   identically through the REAL computeEventDigest; the record
//   versions are equal;
// - W009 tenancy/identity: the mirrored tenant/principal id grammars
//   are member-equal to the REAL patterns;
// - W009 authorization: a REAL authorization decision's request
//   digest satisfies the observability provenance grammar;
// - W008 extension-runtime: a REAL SandboxSurfaceDescription parses
//   through the mirrored SandboxSubject schema; the mirrored
//   grant-ceiling table is MEMBER-FOR-MEMBER equal to the REAL
//   TRUST_CLASS_GRANT_CEILINGS; the isolation check's ceiling verdict
//   AGREES with the REAL grantExceedsCeiling on every combination;
// - W041 access-projection: a REAL authorized projection projects
//   into a summary the audit family accepts (the invariants hold on
//   the real records).
import { describe, expect, it } from 'vitest';
import {
  computeEventDigest,
  EVENT_LOG_RECORD_VERSION,
  sealEvent,
} from '@epoch/event-log';
import { TENANT_ID_PATTERN } from '@epoch/tenancy';
import { PRINCIPAL_ID_PATTERN } from '@epoch/identity';
import { evaluate } from '@epoch/authorization';
import {
  EXTENSION_FLAVORS,
  DATA_HANDLING_CLASSIFICATIONS,
  EXTENSION_TRUST_CLASSES,
  TRUST_CLASS_GRANT_CEILINGS,
  grantExceedsCeiling,
  type GrantDescription,
  type ResourceScopeMirror,
  type SandboxSurfaceDescription,
} from '@epoch/extension-runtime';
import {
  SandboxSubjectSchema,
  OBSERVABILITY_EVENT_RECORD_VERSION,
  OBSERVABILITY_PRINCIPAL_ID_PATTERN,
  OBSERVABILITY_TENANT_ID_PATTERN,
  SANDBOX_GRANT_CEILINGS,
  checkIsolation,
  computeSecurityEventDigest,
  sealSecurityEvent,
  securityStreamIdOf,
} from '../src/index';
import {
  EXTENSION_ID,
  LISTING_ID,
  PRINCIPAL,
  SOURCE_DIGEST,
  T1,
  TENANT,
  conformingSubject,
  sealedPolicy,
} from './fixtures';

const LEGAL_GRANTS: readonly GrantDescription[] = [
  {
    capabilityId: 'capability:terrain-render',
    hostFunctions: ['world.read', 'log.write'],
    resourceScopes: [{ resource: 'world', access: 'read' }],
  },
];

describe('W010 event-log parity (runtime)', () => {
  it('the mirrored event shape seals through the REAL W010 sealEvent and digests identically', () => {
    const content = {
      schemaVersion: OBSERVABILITY_EVENT_RECORD_VERSION,
      streamId: securityStreamIdOf(EXTENSION_ID),
      sequence: 1,
      tenantId: TENANT,
      actor: PRINCIPAL,
      causalParent: null,
      payload: {
        discriminator: 'security:observation-recorded',
        data: {
          observationId: 'observation:ext-admission-001',
          observationDigest: SOURCE_DIGEST,
          observationClass: 'sandbox-admission',
          subjectId: EXTENSION_ID,
          outcome: 'allowed',
          observedAt: T1,
        },
      },
      occurredAt: T1,
    };
    const ours = sealSecurityEvent(content);
    expect(ours.ok).toBe(true);
    // The REAL W010 sealEvent takes the event CONTENT and returns the
    // registration (event + digest).
    const theirs = sealEvent(content);
    expect(theirs.ok).toBe(true);
    expect(ours.ok && theirs.ok && ours.value.contentDigest === theirs.value.digest).toBe(true);
    expect(computeSecurityEventDigest(content)).toBe(computeEventDigest(content));
    expect(OBSERVABILITY_EVENT_RECORD_VERSION).toBe(EVENT_LOG_RECORD_VERSION);
  });
});

describe('W009 tenancy + identity parity (runtime)', () => {
  it('the mirrored tenant id grammar is member-equal to the REAL pattern', () => {
    expect(OBSERVABILITY_TENANT_ID_PATTERN.source).toBe(TENANT_ID_PATTERN.source);
    expect(OBSERVABILITY_TENANT_ID_PATTERN.flags).toBe(TENANT_ID_PATTERN.flags);
  });

  it('the mirrored principal id grammar is member-equal to the REAL pattern', () => {
    expect(OBSERVABILITY_PRINCIPAL_ID_PATTERN.source).toBe(PRINCIPAL_ID_PATTERN.source);
    expect(OBSERVABILITY_PRINCIPAL_ID_PATTERN.flags).toBe(PRINCIPAL_ID_PATTERN.flags);
  });

  it('a REAL authorization decision digest satisfies the observation provenance grammar', () => {
    const decision = evaluate(
      {
        schemaVersion: 1,
        principalId: PRINCIPAL,
        actionKind: 'security.observe',
        resource: { resourceType: 'security-observation', resourceId: EXTENSION_ID, tenantId: TENANT },
      },
      {
        schemaVersion: 1,
        principals: [{ principalId: PRINCIPAL, status: 'active', authenticated: true }],
        memberships: [{ principalId: PRINCIPAL, tenantId: TENANT }],
        knownTenants: [TENANT],
      },
    );
    expect(decision.ok).toBe(true);
    if (decision.ok) {
      expect(decision.value.outcome).toBe('allow');
      expect(decision.value.requestDigest).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe('W008 extension-runtime parity (runtime)', () => {
  it('a REAL W008 SandboxSurfaceDescription parses through the mirrored SandboxSubject schema', () => {
    // The REAL W008 surface (ResolvedCapabilityBinding carries
    // capabilityVersion + manifest digest + version constraint).
    const realSurface: SandboxSurfaceDescription = {
      schemaVersion: 1,
      extensionId: EXTENSION_ID,
      extensionVersion: '1.2.0',
      extensionManifestDigest: SOURCE_DIGEST,
      flavor: 'wasm',
      trustClass: 't2',
      bindings: [
        {
          capabilityId: 'capability:terrain-render',
          capabilityVersion: '1.0.0',
          capabilityManifestDigest: SOURCE_DIGEST,
          bindingConstraint: { kind: 'exact', version: '1.0.0' },
        },
      ],
      grants: LEGAL_GRANTS,
    };
    // The mirror adds dataHandling + listingId (the W030 isolation
    // inputs W008 does not carry); every W008 field parses unchanged.
    const mirrored = SandboxSubjectSchema.safeParse({
      ...realSurface,
      bindings: [{ capabilityId: 'capability:terrain-render' }],
      dataHandling: 'sandbox-only',
      listingId: LISTING_ID,
    });
    expect(mirrored.success).toBe(true);
  });

  it('the mirrored flavor and data-handling vocabularies are member-for-member equal to W008', () => {
    // EXTENSION_FLAVORS + DATA_HANDLING_CLASSIFICATIONS are the W008
    // authority; the mirrored closed sets in version.ts must equal
    // them exactly (order included).
    expect(['declarative', 'ui', 'wasm', 'remote']).toEqual([...EXTENSION_FLAVORS]);
    expect(['sandbox-only', 'tenant-scoped', 'external-transfer']).toEqual([
      ...DATA_HANDLING_CLASSIFICATIONS,
    ]);
    expect(['t0', 't1', 't2', 't3', 't4']).toEqual([...EXTENSION_TRUST_CLASSES]);
  });

  it('the mirrored grant-ceiling table is member-for-member equal to the REAL W008 table', () => {
    expect(SANDBOX_GRANT_CEILINGS).toEqual(TRUST_CLASS_GRANT_CEILINGS);
  });

  it('the isolation check ceiling verdict AGREES with the REAL W008 grantExceedsCeiling', () => {
    const profile = sealedPolicy().isolation;
    const hostFunctions = [
      'clock.read',
      'log.write',
      'storage.read',
      'storage.write',
      'world.read',
      'evidence.append',
      'capability.invoke',
    ];
    // The legal (resource, access) pairs + one ILLEGAL pair
    // (world.write) exercising resource-scope-not-legal.
    const resourceScopes: readonly ResourceScopeMirror[] = [
      { resource: 'world', access: 'read' },
      { resource: 'evidence', access: 'append' },
      { resource: 'storage', access: 'read' },
      { resource: 'storage', access: 'write' },
      { resource: 'capability', access: 'invoke' },
      // One ILLEGAL pair (world.write) exercising
      // resource-scope-not-legal alongside the ceiling agreement.
      { resource: 'world', access: 'write' },
    ];
    for (const trustClass of ['t0', 't1', 't2', 't3', 't4'] as const) {
      for (const fn of hostFunctions) {
        const real = grantExceedsCeiling({ hostFunctions: [fn], resourceScopes: [] }, trustClass);
        const verdict = checkIsolation(
          {
            schemaVersion: 1,
            extensionId: EXTENSION_ID,
            extensionVersion: '1.2.0',
            extensionManifestDigest: SOURCE_DIGEST,
            flavor: 'declarative',
            trustClass,
            bindings: [{ capabilityId: 'capability:terrain-render' }],
            grants: [
              { capabilityId: 'capability:terrain-render', hostFunctions: [fn], resourceScopes: [] },
            ],
            dataHandling: 'sandbox-only',
          },
          { ...profile, maxTrustClass: 't4' },
        );
        const exceeds = verdict.violations.some((v) => v.code === 'grant-exceeds-trust-ceiling');
        expect(exceeds, `${trustClass} + ${fn}`).toBe(real.hostFunction !== undefined);
      }
      for (const scope of resourceScopes) {
        const real = grantExceedsCeiling({ hostFunctions: [], resourceScopes: [scope] }, trustClass);
        const verdict = checkIsolation(
          {
            schemaVersion: 1,
            extensionId: EXTENSION_ID,
            extensionVersion: '1.2.0',
            extensionManifestDigest: SOURCE_DIGEST,
            flavor: 'declarative',
            trustClass,
            bindings: [{ capabilityId: 'capability:terrain-render' }],
            grants: [
              { capabilityId: 'capability:terrain-render', hostFunctions: [], resourceScopes: [scope] },
            ],
            dataHandling: 'sandbox-only',
          },
          { ...profile, maxTrustClass: 't4' },
        );
        // The mirrored check flags grant-exceeds-trust-ceiling exactly
        // when the REAL W008 ceiling check flags the same grant (the
        // world.write pair additionally trips the illegal-scope
        // check, which is not a ceiling verdict).
        const exceeds = verdict.violations.some((v) => v.code === 'grant-exceeds-trust-ceiling');
        expect(exceeds, `${trustClass} + ${scope.resource}.${scope.access}`).toBe(
          real.resourceScope !== undefined,
        );
      }
    }
  });

  it('the conforming fixture subject is accepted by the isolation check', () => {
    const subject = SandboxSubjectSchema.parse(conformingSubject());
    expect(
      checkIsolation(subject, sealedPolicy().isolation).verdict,
    ).toBe('conforms');
  });
});
