/**
 * Provenance verification for derivation outputs (the evidence-first
 * gate).
 *
 * A candidate is only admitted when it is derived through a COMPLETE,
 * UNBROKEN stage evidence chain anchored to its exact document revision:
 * `document digest -> stage evidence -> candidate`. A definition
 * additionally requires the full five-stage chain (terminal at
 * `provisional`) and a registration plan attested by the provisional
 * stage evidence digest. Tenant boundaries are enforced here too: a
 * candidate, chain, or definition that crosses a tenant scope is the
 * typed rejection `cross-tenant-denied` (R12).
 */
import { computeEvidenceDigest, parseEvidenceRecord } from '@epoch/evidence';
import { verifyEvidenceChain, type EvidenceRecordLookup } from './evidence';
import { EXTRACTION_STAGE_KINDS } from './version';
import type {
  DocumentAdapterError,
  DocumentAdapterResult,
  ExtractionCandidate,
  ExtractionStageKind,
  ProvisionalAdapterDefinition,
  StageEvidenceChain,
} from './types';

/** The reason a stage evidence chain (or a derivation through it) broke. */
export type BrokenChainReason =
  | 'missing-record'
  | 'invalid-record'
  | 'digest-mismatch'
  | 'unanchored-subject'
  | 'stage-mismatch'
  | 'kind-mismatch'
  | 'tenant-mismatch'
  | 'out-of-order'
  | 'incomplete-chain'
  | 'uncovered-candidate';

/** The minimum chain length that covers a candidate (through extraction). */
export const CANDIDATE_CHAIN_STAGES = 3 as const;

/** The chain length that covers a provisional definition (all stages). */
export const DEFINITION_CHAIN_STAGES = 5 as const;

function broken(
  reason: BrokenChainReason,
  message: string,
  path: readonly (string | number)[],
  stage?: ExtractionStageKind,
): DocumentAdapterError {
  return { code: 'broken-evidence-chain', message, path, stage, reason };
}

function crossTenant(
  expectedTenantId: string,
  encounteredTenantId: string,
  path: readonly (string | number)[],
): DocumentAdapterError {
  return {
    code: 'cross-tenant-denied',
    message:
      `provenance crosses a tenant boundary: the derivation belongs to tenant ` +
      `"${encounteredTenantId}" but the chain (or the admission scope) belongs to ` +
      `"${expectedTenantId}" (R12 multi-tenant isolation)`,
    path,
    expectedTenantId,
    encounteredTenantId,
  };
}

/** The ids listed in a stage record's payload detail, when present. */
function payloadCandidateIds(
  records: EvidenceRecordLookup,
  digest: string,
): readonly string[] | undefined {
  const raw = records.get(digest);
  if (raw === undefined) return undefined;
  const parsed = parseEvidenceRecord(raw);
  if (!parsed.ok) return undefined;
  const data = parsed.record.content.data as
    | { detail?: { candidateIds?: unknown } | null }
    | null;
  if (data === null || typeof data !== 'object') return undefined;
  const ids = data.detail?.candidateIds;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) return undefined;
  return ids as readonly string[];
}

/**
 * Verify that a candidate was derived through a complete, unbroken
 * evidence chain:
 *
 * 1. the chain covers at least the first three stages (uploaded, parsed,
 *    candidates-extracted) — else `incomplete-chain`;
 * 2. the chain itself verifies (order, record validity, digests,
 *    anchoring, staging, kinds, tenants);
 * 3. the candidate's document digest is the chain's document — else
 *    `unanchored-subject`;
 * 4. the candidate's tenant scope equals the chain's — else
 *    `cross-tenant-denied`;
 * 5. the candidates-extracted evidence covers the candidate's id — else
 *    `uncovered-candidate`.
 */
export function verifyCandidateProvenance(
  candidate: ExtractionCandidate,
  chain: StageEvidenceChain,
  records: EvidenceRecordLookup,
): DocumentAdapterResult<ExtractionCandidate> {
  if (chain.stages.length < CANDIDATE_CHAIN_STAGES) {
    return {
      ok: false,
      error: broken(
        'incomplete-chain',
        `a candidate requires a chain through "candidates-extracted" (stages[0..2]); the given chain covers ${chain.stages.length} stage(s)`,
        ['evidenceChain', 'stages'],
      ),
    };
  }
  const chainOk = verifyEvidenceChain(chain, records);
  if (!chainOk.ok) return chainOk;

  if (candidate.documentDigest !== chain.documentDigest) {
    return {
      ok: false,
      error: broken(
        'unanchored-subject',
        `the candidate claims document digest ${candidate.documentDigest} but its evidence chain is anchored to ${chain.documentDigest}`,
        ['candidate', 'documentDigest'],
      ),
    };
  }
  if (candidate.tenantScope.tenantId !== chain.tenantScope.tenantId) {
    return {
      ok: false,
      error: crossTenant(
        chain.tenantScope.tenantId,
        candidate.tenantScope.tenantId,
        ['candidate', 'tenantScope', 'tenantId'],
      ),
    };
  }
  const extractionLink = chain.stages[CANDIDATE_CHAIN_STAGES - 1]!;
  const covered = payloadCandidateIds(records, extractionLink.evidenceDigest);
  if (covered === undefined || !covered.includes(candidate.candidateId)) {
    return {
      ok: false,
      error: broken(
        'uncovered-candidate',
        `the candidate ${candidate.candidateId} is not covered by the "candidates-extracted" evidence record (the record lists ${covered === undefined ? 'no candidate ids' : `${covered.length} other candidate id(s)`})`,
        ['candidate', 'candidateId'],
        'candidates-extracted',
      ),
    };
  }
  return { ok: true, value: candidate };
}

/**
 * Verify that a provisional definition carries complete provenance:
 * the full five-stage chain, the verified embedded candidate, the
 * anchored document digest, the matching tenant scope, and a
 * registration plan attested by the provisional stage evidence digest.
 * The lifecycle is terminal — nothing beyond verification exists here.
 */
export function verifyDefinitionProvenance(
  definition: ProvisionalAdapterDefinition,
  records: EvidenceRecordLookup,
): DocumentAdapterResult<ProvisionalAdapterDefinition> {
  const chain = definition.evidenceChain;
  if (chain.stages.length < DEFINITION_CHAIN_STAGES) {
    return {
      ok: false,
      error: broken(
        'incomplete-chain',
        `a provisional definition requires the complete five-stage chain; the given chain covers ${chain.stages.length} stage(s)`,
        ['evidenceChain', 'stages'],
      ),
    };
  }
  if (chain.stages[DEFINITION_CHAIN_STAGES - 1]!.stage !== EXTRACTION_STAGE_KINDS[DEFINITION_CHAIN_STAGES - 1]) {
    return {
      ok: false,
      error: broken(
        'out-of-order',
        'the definition\u2019s chain does not terminate at the "provisional" stage',
        ['evidenceChain', 'stages', DEFINITION_CHAIN_STAGES - 1],
      ),
    };
  }
  const chainOk = verifyEvidenceChain(chain, records);
  if (!chainOk.ok) return chainOk;

  const candidateOk = verifyCandidateProvenance(definition.candidate, chain, records);
  if (!candidateOk.ok) return candidateOk;

  if (definition.documentDigest !== chain.documentDigest) {
    return {
      ok: false,
      error: broken(
        'unanchored-subject',
        `the definition claims document digest ${definition.documentDigest} but its evidence chain is anchored to ${chain.documentDigest}`,
        ['documentDigest'],
      ),
    };
  }
  if (definition.tenantScope.tenantId !== chain.tenantScope.tenantId) {
    return {
      ok: false,
      error: crossTenant(
        chain.tenantScope.tenantId,
        definition.tenantScope.tenantId,
        ['tenantScope', 'tenantId'],
      ),
    };
  }
  const provisionalLink = chain.stages[DEFINITION_CHAIN_STAGES - 1]!;
  if (definition.registration.attestationDigest !== provisionalLink.evidenceDigest) {
    return {
      ok: false,
      error: {
        code: 'broken-evidence-chain',
        message:
          `the registration plan is attested by ${definition.registration.attestationDigest} but the provisional stage evidence digest is ${provisionalLink.evidenceDigest}`,
        path: ['registration', 'attestationDigest'],
        stage: 'provisional',
        reason: 'digest-mismatch',
      },
    };
  }
  const provisionalRecord = records.get(provisionalLink.evidenceDigest);
  if (provisionalRecord !== undefined) {
    const parsed = parseEvidenceRecord(provisionalRecord);
    if (parsed.ok && computeEvidenceDigest(parsed.record) === provisionalLink.evidenceDigest) {
      const data = parsed.record.content.data as
        | { detail?: { candidateIds?: unknown } | null }
        | null;
      const detailCandidateIds = data?.detail?.candidateIds;
      const covered =
        Array.isArray(detailCandidateIds) &&
        detailCandidateIds.includes(definition.candidate.candidateId);
      if (!covered) {
        return {
          ok: false,
          error: broken(
            'uncovered-candidate',
            `the provisional stage evidence does not attest candidate ${definition.candidate.candidateId}`,
            ['candidate', 'candidateId'],
            'provisional',
          ),
        };
      }
    }
  }
  return { ok: true, value: definition };
}
