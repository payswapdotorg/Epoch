/**
 * Provisional registration against the W007 source-category vocabulary
 * (the Capability Registry consumption seam).
 *
 * Every document-derived mapping registers as a `source`-category
 * capability with origin `provisional-document-derived` (W007
 * CAPABILITY_ORIGINS), sealed with the SHA-256 of its manifest's
 * canonical JSON and attested by the provisional stage evidence digest.
 * This module DERIVES and SEALS registration documents; the registry
 * itself (W007) remains the authority for capability identity — the
 * document adapter never recreates it.
 *
 * Provider neutrality: the derived manifest embeds only typed, neutral
 * parameter specs (agent-protocol `ParameterSpec`); no vendor, service,
 * key, or client appears anywhere in the registration.
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  sealCapabilityManifest,
  type CapabilityRegistration,
  type CapabilityRegistry,
} from '@epoch/capability-registry';
import { emitStageEvidence, extendChain } from './evidence';
import type { StageEvidenceReceipt } from './evidence';
import { malformedDocument } from './issues';
import { ProvisionalAdapterDefinitionSchema } from './schema';
import {
  DOCUMENT_ADAPTER_CONTRACT_ID,
  DOCUMENT_ADAPTER_CONTRACT_VERSION,
  PROVISIONAL_CAPABILITY_CATEGORY,
  PROVISIONAL_CAPABILITY_ORIGIN,
  PROVISIONAL_CAPABILITY_VERSION,
} from './version';
import type {
  DocumentAdapterError,
  DocumentAdapterResult,
  ExtractionCandidate,
  ProvisionalAdapterDefinition,
  ProvisionalRegistrationPlan,
  StageEvidenceChain,
  StageRunContext,
  DocumentDescriptor,
} from './types';

/** Input of {@link deriveRegistrationPlan}. */
export interface RegistrationPlanInput {
  readonly candidate: ExtractionCandidate;
  /** Digest of the provisional stage evidence record (the attestation). */
  readonly attestationDigest: Sha256Hex;
}

/**
 * Derive the deterministic W007 registration plan for a candidate:
 * capability id `docmap.<namespace>.<name>` from the W002 semantic target,
 * category `source`, origin `provisional-document-derived`, first
 * provisional version, and the self-issued document-adapter contract
 * reference. Identical candidates always derive identical plans.
 */
export function deriveRegistrationPlan(
  input: RegistrationPlanInput,
): ProvisionalRegistrationPlan {
  const [namespace, name] = splitSemanticTarget(input.candidate.semanticTarget);
  return {
    capabilityId: `docmap.${namespace}.${name}`,
    category: PROVISIONAL_CAPABILITY_CATEGORY,
    version: PROVISIONAL_CAPABILITY_VERSION,
    origin: PROVISIONAL_CAPABILITY_ORIGIN,
    contracts: [
      { contractId: DOCUMENT_ADAPTER_CONTRACT_ID, contractVersion: DOCUMENT_ADAPTER_CONTRACT_VERSION },
    ],
    attestationDigest: input.attestationDigest,
  };
}

function splitSemanticTarget(semanticTarget: string): [string, string] {
  const separator = semanticTarget.indexOf(':');
  return [semanticTarget.slice(0, separator), semanticTarget.slice(separator + 1)];
}

/** Input of {@link deriveProvisionalDefinitions}. */
export interface ProvisionalDerivationInput {
  readonly descriptor: DocumentDescriptor;
  /** ALL extracted candidates of the document (sorted, non-empty). */
  readonly candidates: readonly ExtractionCandidate[];
  /** The four-stage chain (uploaded .. review-pending) to extend. */
  readonly chain: StageEvidenceChain;
  /** Host-supplied run context for the provisional stage evidence. */
  readonly run: StageRunContext;
}

/** Output of {@link deriveProvisionalDefinitions}. */
export interface ProvisionalDerivationOutput {
  /** One definition per candidate, sorted by definitionId ascending. */
  readonly definitions: readonly ProvisionalAdapterDefinition[];
  readonly evidence: StageEvidenceReceipt;
  /** The completed five-stage chain shared by every definition. */
  readonly chain: StageEvidenceChain;
}

/**
 * Derive the PROVISIONAL adapter definitions for a document's candidates:
 * emit ONE provisional stage evidence record attesting every candidate id
 * and its derived capability id, complete the five-stage chain, and seal
 * one definition per candidate (each carrying the shared chain and a
 * registration plan attested by the provisional evidence digest).
 *
 * Deterministic: identical (candidates, chain, run) derive identical
 * evidence, chain, and definitions — the output is sorted by
 * content-derived definition id, so document row order never leaks. No
 * kernel state is mutated.
 */
export function deriveProvisionalDefinitions(
  input: ProvisionalDerivationInput,
): DocumentAdapterResult<ProvisionalDerivationOutput> {
  if (input.candidates.length === 0) {
    return {
      ok: false,
      error: {
        code: 'broken-evidence-chain',
        message: 'cannot derive provisional definitions without extracted candidates',
        path: ['candidates'],
        reason: 'incomplete-chain',
      },
    };
  }
  const planPreviews = input.candidates.map((candidate) =>
    deriveRegistrationPlan({
      candidate,
      attestationDigest: '0'.repeat(64) as Sha256Hex,
    }),
  );
  const evidence = emitStageEvidence({
    stage: 'provisional',
    descriptor: input.descriptor,
    run: input.run,
    detail: {
      candidateIds: input.candidates.map((candidate) => candidate.candidateId),
      capabilityIds: planPreviews.map((plan) => plan.capabilityId),
    },
  });
  if (!evidence.ok) return evidence;
  const chain = extendChain(input.chain, evidence.value.link);
  const definitions = input.candidates.map((candidate) => {
    const plan = deriveRegistrationPlan({
      candidate,
      attestationDigest: evidence.value.digest,
    });
    const content = {
      schemaVersion: 1 as const,
      tenantScope: input.descriptor.tenantScope,
      documentDigest: input.descriptor.digest,
      candidate,
      evidenceChain: chain,
      registration: plan,
      lifecycle: 'provisional' as const,
    };
    const definitionId = `docmap:${canonicalDigest(content as unknown as JsonValue)}`;
    const definition: ProvisionalAdapterDefinition = { ...content, definitionId };
    return definition;
  });
  const sorted = [...definitions].sort((a, b) =>
    a.definitionId < b.definitionId ? -1 : a.definitionId > b.definitionId ? 1 : 0,
  );
  return { ok: true, value: { definitions: sorted, evidence: evidence.value, chain } };
}

/** Input of {@link buildProvisionalRegistration}. */
export interface RegistrationBuildInput {
  readonly definition: ProvisionalAdapterDefinition;
  /**
   * Optional registry used to validate upstream capability references:
   * when the candidate carries a `capabilityRef`, the referenced
   * (capabilityId, version) must resolve here, else
   * `unknown-capability-reference`.
   */
  readonly registry?: CapabilityRegistry | undefined;
}

/**
 * Build the sealed W007 registration document for a provisional
 * definition: the manifest (category `source`, origin
 * `provisional-document-derived`, neutral parameter specs, attestation
 * digest) plus the manifest's canonical SHA-256 — the envelope
 * `CapabilityRegistry.register` consumes. The registry stays the
 * authority; this only derives and seals the document.
 *
 * Total admission pipeline:
 * 1. definition shape validation (`malformed-document`);
 * 2. registration-plan policy checks — category `source`, origin
 *    `provisional-document-derived`, semver version (`policy-violation`);
 * 3. upstream capability-reference resolution (`unknown-capability-reference`);
 * 4. manifest sealing against the W007 schema (`policy-violation` /
 *    `manifest-shape` — unreachable for valid inputs, kept total).
 */
export function buildProvisionalRegistration(
  input: RegistrationBuildInput,
): DocumentAdapterResult<CapabilityRegistration> {
  const { definition } = input;
  const shape = ProvisionalAdapterDefinitionSchema.safeParse(definition);
  if (!shape.success) {
    return { ok: false, error: malformedDocument(shape.error) };
  }
  const plan = definition.registration;
  if (plan.category !== PROVISIONAL_CAPABILITY_CATEGORY) {
    return {
      ok: false,
      error: policyViolation(
        'registration-category',
        `a document-derived mapping must register in the "${PROVISIONAL_CAPABILITY_CATEGORY}" category; the plan declares "${plan.category}"`,
        ['registration', 'category'],
      ),
    };
  }
  if (plan.origin !== PROVISIONAL_CAPABILITY_ORIGIN) {
    return {
      ok: false,
      error: policyViolation(
        'registration-origin',
        `a document-derived mapping must declare origin "${PROVISIONAL_CAPABILITY_ORIGIN}"; the plan declares "${plan.origin}"`,
        ['registration', 'origin'],
      ),
    };
  }
  if (!/^\d+\.\d+\.\d+$/.test(plan.version)) {
    return {
      ok: false,
      error: policyViolation(
        'registration-version',
        `a provisional registration version must be a semver core; the plan declares "${plan.version}"`,
        ['registration', 'version'],
      ),
    };
  }
  const reference = definition.candidate.capabilityRef;
  if (reference !== undefined && input.registry !== undefined) {
    const resolved = input.registry.get({
      capabilityId: reference.id,
      version: reference.version,
    });
    if (!resolved.ok) {
      return {
        ok: false,
        error: {
          code: 'unknown-capability-reference',
          message:
            `the candidate references capability "${reference.id}" at version "${reference.version}", ` +
            'which does not resolve in the registry (dangling upstream capability reference)',
          path: ['candidate', 'capabilityRef'],
          capabilityId: reference.id,
          version: reference.version,
        },
      };
    }
  }
  const sealed = sealCapabilityManifest(buildManifest(definition));
  if (!sealed.ok) {
    return {
      ok: false,
      error: policyViolation(
        'manifest-shape',
        `the derived W007 manifest failed registry validation: ${sealed.error.message}`,
        ['registration'],
      ),
    };
  }
  return { ok: true, value: sealed.value };
}

/** Constructor for the typed `policy-violation` error. */
function policyViolation(
  rule: 'registration-category' | 'registration-origin' | 'registration-version' | 'manifest-shape',
  message: string,
  path: readonly (string | number)[],
): DocumentAdapterError {
  return { code: 'policy-violation', message, path, rule };
}

/** The neutral W007 manifest of a provisional mapping (typed data). */
function buildManifest(definition: ProvisionalAdapterDefinition): unknown {
  const [namespace, name] = splitSemanticTarget(definition.candidate.semanticTarget);
  return {
    schemaVersion: 1,
    capabilityId: definition.registration.capabilityId,
    category: PROVISIONAL_CAPABILITY_CATEGORY,
    version: definition.registration.version,
    descriptor: {
      displayName: `Document-derived source mapping ${definition.candidate.semanticTarget}`,
      description:
        `Provisional mapping derived from document ${definition.documentDigest} ` +
        `(candidate ${definition.candidate.candidateId}); W002 semantic target ` +
        `${definition.candidate.semanticTarget}; sealed by the document-adapter derivation pipeline`,
      inputs: [
        {
          name: 'source-path',
          kind: 'string',
          required: true,
          description: `Document field locator (${definition.candidate.locator.sourcePath}) this mapping projects.`,
        },
      ],
      outputs: [
        {
          name: 'semantic-target',
          kind: 'string',
          required: true,
          description: `W002 semantic type key (${namespace}:${name}) the projected document field maps onto.`,
        },
      ],
      assumptions: [
        'Derivation is a pure projection over content-addressed document bytes: identical (document bytes, descriptor) derive identical candidates and evidence.',
        'Provisional by construction: trust class t1; certify, execute, and grant-capability requests are typed denials (trust-escalation-denied).',
        'Provider-neutral: no vendor document service participates in the derivation; future concrete ingestion sources are adapters behind this seam.',
      ],
    },
    contracts: definition.registration.contracts,
    trust: {
      origin: PROVISIONAL_CAPABILITY_ORIGIN,
      attestationDigest: definition.registration.attestationDigest,
    },
  };
}
