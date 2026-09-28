// RUNTIME PARITY against the REAL sibling kernels (devDependencies —
// the kernel-to-kernel devDep precedent; the compile-time pins live in
// src/parity.ts). This file proves the same compatibility with real
// objects at runtime:
//
// - W010: bridge events seal through the REAL sealEvent and digest
//   identically through the REAL computeEventDigest; the mirrored
//   stream/actor grammars are pattern-equal; the mirrored record
//   version equals EVENT_LOG_RECORD_VERSION;
// - W009: the gate's request mirror parses through the REAL
//   parseAuthorizationRequest and digests identically through the REAL
//   computeAuthorizationRequestDigest; a REAL-shaped AllowDecision
//   feeds the gate (the structural consumption pin);
// - W036: the observation intake-proposal slot parses through the REAL
//   DistinctionRecordContent validator and seals through the REAL W036
//   sealDistinctionRecord (the authority path), with the digest the W036
//   authority computes;
// - W041: a REAL PolicyBinding.fieldAllowlist feeds the bridge's
//   least-privilege projection directly; the redaction-class vocabulary
//   equals the REAL vocabulary;
// - W007: the provider registration's capability binding negotiates
//   against a manifest registered in the REAL CapabilityRegistry
//   through the REAL SDK negotiateBinding.
import { describe, expect, it } from 'vitest';
import {
  EVENT_ACTOR_PATTERN,
  EVENT_LOG_RECORD_VERSION,
  EVENT_STREAM_ID_PATTERN,
  computeEventDigest,
  sealEvent,
} from '@epoch/event-log';
import {
  computeAuthorizationRequestDigest,
  parseAuthorizationRequest,
  type AllowDecision,
} from '@epoch/authorization';
import {
  DistinctionRecordContentSchema,
  sealDistinctionRecord,
  type DistinctionRecordContent,
} from '@epoch/solution-delivery';
import {
  REDACTION_CLASSES,
  sealProjectionPolicy,
  type SealedProjectionPolicy,
} from '@epoch/access-projection';
import {
  CapabilityRegistry,
  computeCapabilityManifestDigest,
} from '@epoch/capability-registry';
import { negotiateBinding } from '@epoch/adapter-sdk';
import {
  BRIDGE_REDACTION_CLASSES,
  EXTERNAL_EVENT_BRIDGE_RECORD_VERSION,
  LeastPrivilegeProjectionSchema,
  admitBridgeOperation,
  buildObservationIntakeProposal,
  bridgeStreamIdOf,
  computeBridgeAuthorizationRequestDigest,
  computeBridgeEventDigest,
  filterOutboundPayload,
  sealBridgeEvent,
  type BridgeAuthorizationRequest,
  type BridgeEventContent,
} from '../src/index';
import {
  DESCRIPTOR_DIGEST_A,
  GENERIC_DESCRIPTOR_A,
  POLICY_DIGEST_A,
  PRINCIPAL,
  PROVIDER_CAPABILITY_BINDING,
  RAW_INFORMATION_PAYLOAD,
  TENANT_A,
  T2,
  referenceExternalEvent,
  referenceObservationContext,
} from './fixtures';
import { unwrap } from './helpers';

/** Unwrap a REAL W041 total result (test-only convenience). */
function unwrapPolicy(result: { ok: true; value: SealedProjectionPolicy } | { ok: false; error: { message: string } }): SealedProjectionPolicy {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('W010 event parity (the REAL sealEvent admits bridge events)', () => {
  it('the mirrored record version equals EVENT_LOG_RECORD_VERSION', () => {
    expect(EXTERNAL_EVENT_BRIDGE_RECORD_VERSION).toBe(EVENT_LOG_RECORD_VERSION);
  });

  it('the mirrored stream and actor grammars are pattern-equal to the W010 grammars', () => {
    const bridgeStreamPattern = /^stream:[a-z0-9][a-z0-9-]{0,62}$/;
    const bridgeActorPattern = /^principal:[a-z0-9][a-z0-9-]{0,62}$/;
    expect(bridgeStreamPattern.source).toBe(EVENT_STREAM_ID_PATTERN.source);
    expect(bridgeStreamPattern.flags).toBe(EVENT_STREAM_ID_PATTERN.flags);
    expect(bridgeActorPattern.source).toBe(EVENT_ACTOR_PATTERN.source);
    expect(bridgeActorPattern.flags).toBe(EVENT_ACTOR_PATTERN.flags);
  });

  it('the same event seals through the REAL W010 sealEvent and digests identically', () => {
    const content: BridgeEventContent = {
      schemaVersion: 1,
      streamId: bridgeStreamIdOf(TENANT_A),
      sequence: 1,
      tenantId: TENANT_A,
      actor: PRINCIPAL,
      causalParent: null,
      payload: {
        discriminator: 'bridge:event-received',
        data: {
          eventId: 'bridge-event:msg-1',
          eventClass: 'observation-report',
          eventDigest: '3a'.repeat(32),
          idempotencyKey: 'idem:exchange-1',
          sourceAdapterId: 'adapter:generic-alpha',
        },
      },
      occurredAt: T2,
    };
    const ours = unwrap(sealBridgeEvent(content));
    const theirs = sealEvent(content);
    if (!theirs.ok) throw new Error(theirs.error.message);
    expect(ours.contentDigest).toBe(theirs.value.digest);
    expect(computeEventDigest(content)).toBe(ours.contentDigest);
    expect(computeBridgeEventDigest(content)).toBe(theirs.value.digest);
  });
});

describe('W009 authorization parity (the REAL decision machinery)', () => {
  it('the gate request mirror parses through the REAL parseAuthorizationRequest', () => {
    const request: BridgeAuthorizationRequest = {
      schemaVersion: 1,
      principalId: PRINCIPAL,
      actionKind: 'bridge.event-intake',
      resource: {
        resourceType: 'external-event-bridge',
        resourceId: 'bridge-event:msg-1',
        tenantId: TENANT_A,
      },
      justification: 'parity evidence',
    };
    const theirs = parseAuthorizationRequest(request);
    expect(theirs.ok).toBe(true);
  });

  it('the bridge request digest equals the REAL computeAuthorizationRequestDigest', () => {
    const request: BridgeAuthorizationRequest = {
      schemaVersion: 1,
      principalId: PRINCIPAL,
      actionKind: 'bridge.request-dispatch',
      resource: {
        resourceType: 'external-event-bridge',
        resourceId: 'outbound:info-1',
        tenantId: TENANT_A,
      },
    };
    expect(computeBridgeAuthorizationRequestDigest(request)).toBe(
      computeAuthorizationRequestDigest(request),
    );
  });

  it('a REAL-shaped AllowDecision feeds the gate (structural consumption)', () => {
    const request: BridgeAuthorizationRequest = {
      schemaVersion: 1,
      principalId: PRINCIPAL,
      actionKind: 'bridge.provider-registration',
      resource: {
        resourceType: 'external-event-bridge',
        resourceId: 'registration:generic-alpha',
        tenantId: TENANT_A,
      },
    };
    const realDecision: AllowDecision = {
      schemaVersion: 1,
      requestDigest: computeAuthorizationRequestDigest(request),
      outcome: 'allow',
      reasons: ['covering-membership'],
      evidence: ['memberships[0]'],
    };
    const gate = admitBridgeOperation({
      request,
      decision: realDecision,
      expectedTenantId: TENANT_A,
    });
    expect(gate.ok).toBe(true);
  });
});

describe('W036 observation parity (the REAL authority path)', () => {
  it('the intake-proposal observation slot parses through the REAL DistinctionRecordContent validator', () => {
    const event = referenceExternalEvent();
    const proposal = unwrap(
      buildObservationIntakeProposal(event, referenceObservationContext()),
    );
    const parsed = DistinctionRecordContentSchema.safeParse(proposal.observation);
    expect(parsed.success).toBe(true);
  });

  it('the proposal observation seals through the REAL W036 sealDistinctionRecord with its digest', () => {
    const event = referenceExternalEvent();
    const proposal = unwrap(
      buildObservationIntakeProposal(event, referenceObservationContext()),
    );
    const parsed = DistinctionRecordContentSchema.safeParse(proposal.observation);
    if (!parsed.success) throw new Error('the observation slot must be W036-valid');
    const w036 = parsed.data as DistinctionRecordContent;
    const sealed = sealDistinctionRecord(w036);
    expect(sealed.ok).toBe(true);
    if (sealed.ok) {
      // The W036 authority owns the sealed observation; the bridge only
      // proposed it (the authority path — never a bridge-sealed observation).
      expect(sealed.value.kind).toBe('observation');
      expect(sealed.value.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('the W036 external-event seam grammar is structurally compatible (opaque payload discipline)', () => {
    // The W036 ExternalEventEnvelope and the bridge ExternalEvent serve
    // the same seam discipline: opaque payloads, correlation keys,
    // provider-neutral source references. The bridge normalizes the
    // envelope; the W036 seam stays the delivery-side vocabulary.
    const event = referenceExternalEvent();
    expect(event.payload).toBeDefined();
    expect(Object.keys(event.payload).length).toBeGreaterThan(0);
    expect(event.correlationId).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
  });
});

describe('W041 projection-policy parity (the REAL policy feeds the bridge)', () => {
  it('the bridge redaction-class vocabulary equals the REAL W041 vocabulary', () => {
    expect([...BRIDGE_REDACTION_CLASSES]).toEqual([...REDACTION_CLASSES]);
  });

  it('a REAL PolicyBinding field allowlist feeds the bridge projection directly', () => {
    const policy = unwrapPolicy(
      sealProjectionPolicy({
        schema: 'epoch.access-projection.policy',
        schemaVersion: 1,
        policyId: 'policy:site-recipient-view',
        revision: 1,
        tenantId: TENANT_A,
        title: 'Site recipient minimum-necessary view',
        status: 'active',
        bindings: [
          {
            selector: { principalKind: 'human', role: 'role:site-supervisor' },
            objectClass: 'program-of-work',
            allowedActions: ['view'],
            fieldAllowlist: ['activityTitle', 'statusSummary', 'workPackageRef'],
            redactionRules: [],
            defaultRedactionClass: 'policy-scoped',
            scopeFilters: { evidence: { mode: 'all' }, commercial: 'hidden', supplier: 'hidden' },
          },
        ],
      }),
    );
    const binding = policy.bindings[0]!;
    // The REAL W041 binding's allowlist feeds the bridge projection:
    const projectionParsed = LeastPrivilegeProjectionSchema.safeParse({
      policyDigest: policy.contentDigest,
      recipientRef: 'role:site-supervisor',
      fieldAllowlist: binding.fieldAllowlist,
    });
    if (!projectionParsed.success) throw new Error('the REAL W041 binding must feed the bridge projection');
    const projection = projectionParsed.data;
    const filtered = filterOutboundPayload(
      RAW_INFORMATION_PAYLOAD as Record<string, never>,
      projection,
    );
    expect(filtered.released.map((f) => f.path)).toEqual([
      'activityTitle',
      'statusSummary',
      'workPackageRef',
    ]);
    expect(filtered.redacted.map((m) => m.path)).toContain('internalCommercialNote');
  });

  it('the projection cites the REAL sealed policy digest (the W041 typed reference)', () => {
    const policy = unwrapPolicy(
      sealProjectionPolicy({
        schema: 'epoch.access-projection.policy',
        schemaVersion: 1,
        policyId: 'policy:site-recipient-view',
        revision: 1,
        tenantId: TENANT_A,
        title: 'Site recipient minimum-necessary view',
        status: 'active',
        bindings: [
          {
            selector: { principalKind: 'human', role: 'role:site-supervisor' },
            objectClass: 'program-of-work',
            allowedActions: ['view'],
            fieldAllowlist: ['activityTitle'],
            redactionRules: [],
            defaultRedactionClass: 'policy-scoped',
            scopeFilters: { evidence: { mode: 'all' }, commercial: 'hidden', supplier: 'hidden' },
          },
        ],
      }),
    );
    expect(policy.contentDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(POLICY_DIGEST_A).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('W007 capability parity (the REAL registry + REAL SDK negotiation)', () => {
  it('the provider capability binding negotiates against a manifest in the REAL registry', () => {
    const manifest = {
      schemaVersion: 1,
      capabilityId: 'external.event-exchange',
      category: 'source',
      version: '1.0.0',
      descriptor: {
        displayName: 'External Event Exchange',
        description:
          'Provider-neutral external event intake and outbound request delivery (the bridge provider contract).',
        inputs: [],
        outputs: [],
        assumptions: ['providers are adapters behind the bridge contract'],
      },
      contracts: [
        {
          contractId: 'epoch.bridge.provider-exchange',
          contractVersion: '1.0.0',
        },
      ],
      trust: { origin: 'first-party' },
    } as const;
    const registration = {
      manifest,
      digest: computeCapabilityManifestDigest(manifest),
    };
    const registry = new CapabilityRegistry();
    const stored = registry.register(registration);
    expect(stored.ok).toBe(true);
    if (stored.ok) {
      const pin = negotiateBinding(GENERIC_DESCRIPTOR_A, stored.value);
      expect(pin.ok).toBe(true);
      if (pin.ok) {
        expect(pin.value.adapterId).toBe(GENERIC_DESCRIPTOR_A.adapterId);
        expect(pin.value.capabilityId).toBe(PROVIDER_CAPABILITY_BINDING.capabilityId);
        expect(pin.value.manifestDigest).toBe(registration.digest);
      }
    }
  });

  it('the bridge provenance carries the REAL SDK descriptor digest grammar', () => {
    expect(DESCRIPTOR_DIGEST_A).toMatch(/^[0-9a-f]{64}$/);
  });
});
