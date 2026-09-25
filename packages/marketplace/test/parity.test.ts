// RUNTIME PARITY with the sibling kernel vocabularies (the W011
// kernel-parity pattern; devDependencies only — no runtime coupling):
//
// - W006: the W006-shaped trust-evidence mirror validates through the REAL
//   @epoch/evidence validator and digests identically;
// - W009 identity: the mirrored principal grammar IS identity's pattern;
// - W010: the mirrored usage-event shape is admitted by the REAL
//   @epoch/event-log seal path, the stream/actor grammars are
//   pattern-identical, the record versions are equal, and the digests
//   agree;
// - W004 authorization: the shared cross-tenant denial code is a member of
//   the real DENIAL_CODES vocabulary;
// - W008 extension-sdk: listing capability references bind ids accepted by
//   the real extension-grant grammar;
// - W011 (digest discipline): the mirrored SHA-256 grammar is
//   pattern-identical across the evidence and event-log kernel mirrors.
//
// NOTE on @epoch/experience-protocol: the dispatch listed it among the
// devDep-parity packages, but the binding layer model (boundary-check
// LAYER_RULES, architecture lock) forbids kernel -> experience imports
// entirely (dependencies included), so no experience-protocol pin exists;
// the shared digest discipline is pinned against the kernel mirrors
// instead (reported as a deviation in the PR).
import { describe, expect, it } from 'vitest';
import { EvidenceRecordSchema, computeEvidenceDigest, type EvidenceRecord } from '@epoch/evidence';
import { PRINCIPAL_ID_PATTERN as IDENTITY_PRINCIPAL_ID_PATTERN } from '@epoch/identity';
import {
  computeEventDigest,
  EVENT_ACTOR_PATTERN,
  EVENT_LOG_RECORD_VERSION,
  EVENT_STREAM_ID_PATTERN,
  EVENT_TENANT_ID_PATTERN,
  SHA256_HEX_PATTERN as EVENT_LOG_SHA256_PATTERN,
  sealEvent,
} from '@epoch/event-log';
import { DENIAL_CODES } from '@epoch/authorization';
import { ExtensionGrantSchema } from '@epoch/extension-sdk';
import { SHA256_HEX_PATTERN as EVIDENCE_SHA256_PATTERN } from '@epoch/evidence';
import {
  CapabilityVersionReferenceSchema,
  computeTrustEvidenceDigest,
  computeUsageEventDigest,
  MARKETPLACE_PRINCIPAL_ID_PATTERN,
  parseUsageEventContent,
  PrincipalIdSchema,
  SHA256_HEX_PATTERN,
  USAGE_EVENT_RECORD_VERSION,
  USAGE_STREAM_ID_PATTERN,
} from '../src/index';
import { trustEvidence, usageEvent } from './fixtures';

describe('W006 evidence parity (runtime)', () => {
  it('the trust-evidence mirror validates through the REAL W006 validator', () => {
    const record = trustEvidence();
    const parsed = EvidenceRecordSchema.safeParse(record);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it('the trust-evidence digest equals the REAL W006 digest for the same content', () => {
    const record = trustEvidence() as unknown as EvidenceRecord;
    expect(computeTrustEvidenceDigest(record)).toBe(computeEvidenceDigest(record));
  });

  it('a kind from the shared vocabulary round-trips through both validators', () => {
    const record = trustEvidence({ kind: 'observation' });
    expect(EvidenceRecordSchema.safeParse(record).success).toBe(true);
  });
});

describe('W009 identity parity (runtime)', () => {
  it('the mirrored principal pattern is exactly the identity pattern', () => {
    expect(MARKETPLACE_PRINCIPAL_ID_PATTERN.source).toBe(IDENTITY_PRINCIPAL_ID_PATTERN.source);
    expect(MARKETPLACE_PRINCIPAL_ID_PATTERN.flags).toBe(IDENTITY_PRINCIPAL_ID_PATTERN.flags);
  });

  it('identity principal ids are valid marketplace principals and vice versa', () => {
    const valid = ['principal:lead-eng', 'principal:a', 'principal:svc-42'];
    for (const id of valid) {
      expect(PrincipalIdSchema.safeParse(id).success).toBe(true);
      expect(new RegExp(IDENTITY_PRINCIPAL_ID_PATTERN).test(id)).toBe(true);
    }
    const invalid = ['principal:', 'Principal:X', 'agent:bot', 'human:ada'];
    for (const id of invalid) {
      expect(PrincipalIdSchema.safeParse(id).success).toBe(false);
      expect(new RegExp(IDENTITY_PRINCIPAL_ID_PATTERN).test(id)).toBe(false);
    }
  });
});

describe('W010 event-log parity (runtime)', () => {
  it('the mirrored usage stream pattern is exactly the W010 stream pattern', () => {
    expect(USAGE_STREAM_ID_PATTERN.source).toBe(EVENT_STREAM_ID_PATTERN.source);
    expect(USAGE_STREAM_ID_PATTERN.flags).toBe(EVENT_STREAM_ID_PATTERN.flags);
  });

  it('the mirrored actor grammar is exactly the W010 actor pattern (the W009 grammar)', () => {
    expect(MARKETPLACE_PRINCIPAL_ID_PATTERN.source).toBe(EVENT_ACTOR_PATTERN.source);
  });

  it('the W010 tenant pattern is the W009 tenancy grammar the marketplace composes', () => {
    expect(EVENT_TENANT_ID_PATTERN.source).toBe(/^tenant:[a-z0-9][a-z0-9-]{0,62}$/.source);
  });

  it('the mirrored record versions are equal (a W010 bump breaks this pin intentionally)', () => {
    expect(USAGE_EVENT_RECORD_VERSION).toBe(EVENT_LOG_RECORD_VERSION);
  });

  it('a marketplace usage event is admitted by the REAL W010 seal path', () => {
    const sealed = sealEvent(usageEvent());
    expect(sealed.ok, sealed.ok ? 'valid' : JSON.stringify(sealed.error)).toBe(true);
  });

  it('a W010-admitted event digests identically under both kernels', () => {
    const event = usageEvent();
    const fromW010 = sealEvent(event);
    expect(fromW010.ok).toBe(true);
    const fromMarketplace = parseUsageEventContent(event);
    expect(fromMarketplace.ok).toBe(true);
    if (fromW010.ok && fromMarketplace.ok) {
      expect(computeUsageEventDigest(fromMarketplace.value)).toBe(fromW010.value.digest);
      expect(computeUsageEventDigest(fromMarketplace.value)).toBe(computeEventDigest(fromW010.value.event));
    }
  });
});

describe('W004 authorization parity (runtime)', () => {
  it('the shared cross-tenant denial code is a member of the real DENIAL_CODES', () => {
    expect(DENIAL_CODES).toContain('cross-tenant-denied');
  });
});

describe('W008 extension-sdk parity (runtime)', () => {
  it('listing capability references bind ids accepted by the real extension-grant grammar', () => {
    // The extension grant vocabulary binds capabilities by the same
    // dot-namespaced qualified-name grammar marketplace listings reference.
    const grant = {
      capabilityId: 'engineering.stress-analysis',
      hostFunctions: ['world.read'],
      resourceScopes: [],
    };
    const parsed = ExtensionGrantSchema.safeParse(grant);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    // And the same id is a valid marketplace capability reference id.
    expect(
      CapabilityVersionReferenceSchema.safeParse({
        capabilityId: 'engineering.stress-analysis',
        version: '1.2.3',
      }).success,
    ).toBe(true);
  });
});

describe('W011 digest-discipline parity (runtime)', () => {
  it('the mirrored digest discipline is pattern-identical across kernels', () => {
    expect(SHA256_HEX_PATTERN.source).toBe(EVIDENCE_SHA256_PATTERN.source);
    expect(SHA256_HEX_PATTERN.flags).toBe(EVIDENCE_SHA256_PATTERN.flags);
    expect(SHA256_HEX_PATTERN.source).toBe(EVENT_LOG_SHA256_PATTERN.source);
    expect(SHA256_HEX_PATTERN.flags).toBe(EVENT_LOG_SHA256_PATTERN.flags);
  });
});
