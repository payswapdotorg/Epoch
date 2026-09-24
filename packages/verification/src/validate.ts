/**
 * The reference chain validator (W006): walks
 * Requirement -> Claim -> Method -> Run -> Evidence -> Result -> Approval
 * and rejects broken chains with typed, precisely-pathed issues.
 *
 * Rejected conditions (each with a dedicated issue code):
 * - orphan records: claims referencing absent requirements; methods/results
 *   referencing absent claims; runs referencing absent methods; results
 *   referencing absent runs; approvals referencing absent results;
 * - claims without methods (the chain cannot skip the Method stage);
 * - stage confusion: verification and validation are DISTINCT stages — a
 *   validation method cannot operationalize a verification claim, a
 *   verification run cannot execute a validation method, and a validation
 *   result cannot satisfy a verification claim/run (or vice versa);
 * - evidence discipline: every digest referenced by a run or result must be
 *   the canonical digest of an evidence record in the chain (mismatched or
 *   tampered evidence no longer resolves); a result may only consume
 *   evidence produced by its own run; evidence must name its producing run
 *   and (when recorded) method consistently; one revision label cannot be
 *   pinned to two different content digests;
 * - approval authority: results do not self-approve (the approver must
 *   differ from the executor of the run behind the result); duplicate
 *   (result, approver) approvals are rejected;
 * - temporal sanity: runs end after they start, results are decided after
 *   their run ends, approvals are recorded after the result they judge;
 * - provenance: attached graphs must themselves be valid.
 *
 * Partial-but-consistent chains are VALID (no workflow engine): a run may
 * exist without a result, a result without an approval. An empty chain is
 * vacuously valid. Total function: collects ALL issues, never throws.
 */
import { computeEvidenceDigest } from '@epoch/evidence';
import { validateProvenanceGraph } from '@epoch/provenance';
import { parseVerificationChain } from './parse';
import type {
  ChainIssue,
  Claim,
  Method,
  Requirement,
  Result,
  Run,
  VerificationChain,
} from './types';
import type { EvidenceRecord } from '@epoch/evidence';
import type { Sha256Hex } from '@epoch/agent-protocol';

/** Outcome of semantic chain validation. */
export type ChainValidation =
  | { ok: true; chain: VerificationChain }
  | { ok: false; issues: readonly ChainIssue[] };

interface ChainIndices {
  requirements: Map<string, Requirement>;
  claims: Map<string, Claim>;
  methods: Map<string, Method>;
  runs: Map<string, Run>;
  results: Map<string, Result>;
  evidenceByDigest: Map<Sha256Hex, EvidenceRecord>;
}

function indexById<T>(
  records: readonly T[],
  idOf: (record: T) => string,
  collection: string,
  issues: ChainIssue[],
): Map<string, T> {
  const index = new Map<string, T>();
  records.forEach((record, i) => {
    const id = idOf(record);
    if (index.has(id)) {
      issues.push({
        code: 'duplicate-id',
        message: `duplicate id "${id}" in ${collection}`,
        path: [collection, i],
      });
      return;
    }
    index.set(id, record);
  });
  return index;
}

function indexEvidence(
  chain: VerificationChain,
  issues: ChainIssue[],
): Map<Sha256Hex, EvidenceRecord> {
  const byDigest = new Map<Sha256Hex, EvidenceRecord>();
  const revisionPins = new Map<string, Sha256Hex>();
  chain.evidence.forEach((record, i) => {
    const digest = computeEvidenceDigest(record);
    if (byDigest.has(digest)) return; // identical content is redundant, not contradictory
    byDigest.set(digest, record);
    const pin = `${record.subject.artifactId} ${record.subject.revision}`;
    const pinned = revisionPins.get(pin);
    if (pinned !== undefined && pinned !== record.subject.digest) {
      issues.push({
        code: 'evidence-subject-conflict',
        message: `artifact "${record.subject.artifactId}" revision "${record.subject.revision}" is described with two different content digests (${pinned}, ${record.subject.digest}) — one revision label must identify exactly one content revision`,
        path: ['evidence', i],
      });
    } else {
      revisionPins.set(pin, record.subject.digest);
    }
  });
  return byDigest;
}

function indexChain(chain: VerificationChain, issues: ChainIssue[]): ChainIndices {
  return {
    requirements: indexById(chain.requirements, (r) => r.requirementId, 'requirements', issues),
    claims: indexById(chain.claims, (c) => c.claimId, 'claims', issues),
    methods: indexById(chain.methods, (m) => m.methodId, 'methods', issues),
    runs: indexById(chain.runs, (r) => r.runId, 'runs', issues),
    results: indexById(chain.results, (r) => r.resultId, 'results', issues),
    evidenceByDigest: indexEvidence(chain, issues),
  };
}

/** Walk the chain and report every violation (total, never throws). */
export function validateChain(chain: VerificationChain): ChainValidation {
  const issues: ChainIssue[] = [];
  const index = indexChain(chain, issues);
  const { requirements, claims, methods, runs, results, evidenceByDigest } = index;
  // Duplicate approval ids are detected alongside the semantic walk (the
  // approvals index itself is not needed for reference checks).
  indexById(chain.approvals, (a) => a.approvalId, 'approvals', issues);

  // --- Requirement -> Claim: every claim references an existing requirement.
  chain.claims.forEach((claim, i) => {
    if (!requirements.has(claim.requirementId)) {
      issues.push({
        code: 'unknown-requirement',
        message: `claim "${claim.claimId}" references absent requirement "${claim.requirementId}"`,
        path: ['claims', i],
      });
    }
  });

  // --- Claim -> Method: methods reference their claim, stages agree, and
  // every claim has at least one method (no skipping the Method stage).
  chain.methods.forEach((method, i) => {
    const claim = claims.get(method.claimId);
    if (claim === undefined) {
      issues.push({
        code: 'unknown-claim',
        message: `method "${method.methodId}" references absent claim "${method.claimId}"`,
        path: ['methods', i],
      });
    } else if (method.stage !== claim.stage) {
      issues.push({
        code: 'stage-mismatch',
        message: `method "${method.methodId}" declares stage '${method.stage}' but its claim "${claim.claimId}" declares stage '${claim.stage}' — verification and validation are distinct stages; a ${method.stage} method cannot operationalize a ${claim.stage} claim`,
        path: ['methods', i],
      });
    }
  });
  chain.claims.forEach((claim, i) => {
    const hasMethod = chain.methods.some((method) => method.claimId === claim.claimId);
    if (!hasMethod) {
      issues.push({
        code: 'claim-without-method',
        message: `claim "${claim.claimId}" has no method — the chain Requirement -> Claim -> Method -> Run -> Evidence -> Result cannot skip the Method stage`,
        path: ['claims', i],
      });
    }
  });

  // --- Method -> Run: runs reference their method and agree on stage; runs
  // are temporally ordered; produced evidence exists, is credited to this
  // run, and (when recorded) to this run's method.
  chain.runs.forEach((run, i) => {
    const method = methods.get(run.methodId);
    if (method === undefined) {
      issues.push({
        code: 'unknown-method',
        message: `run "${run.runId}" references absent method "${run.methodId}"`,
        path: ['runs', i],
      });
    } else if (run.stage !== method.stage) {
      issues.push({
        code: 'stage-mismatch',
        message: `run "${run.runId}" declares stage '${run.stage}' but its method "${method.methodId}" declares stage '${method.stage}' — verification and validation are distinct stages`,
        path: ['runs', i],
      });
    }
    if (run.startedAt > run.endedAt) {
      issues.push({
        code: 'run-time-order',
        message: `run "${run.runId}" starts (${run.startedAt}) after it ends (${run.endedAt})`,
        path: ['runs', i],
      });
    }
    run.producedEvidence.forEach((digest, j) => {
      const record = evidenceByDigest.get(digest);
      if (record === undefined) {
        issues.push({
          code: 'evidence-digest-mismatch',
          message: `run "${run.runId}" cites evidence digest ${digest}, but no evidence record in the chain digests to it (tampered, mismatched, or absent)`,
          path: ['runs', i, 'producedEvidence', j],
        });
        return;
      }
      if (record.producedBy.runId !== run.runId) {
        issues.push({
          code: 'evidence-run-mismatch',
          message: `evidence ${digest} names producing run "${record.producedBy.runId}", not the run "${run.runId}" that cites it`,
          path: ['runs', i, 'producedEvidence', j],
        });
      }
      if (record.producedBy.methodId !== undefined && record.producedBy.methodId !== run.methodId) {
        issues.push({
          code: 'evidence-method-mismatch',
          message: `evidence ${digest} names producing method "${record.producedBy.methodId}", not the run's method "${run.methodId}"`,
          path: ['runs', i, 'producedEvidence', j],
        });
      }
    });
  });

  // --- Run -> Evidence -> Result: results reference an existing claim AND
  // run, agree on stage, consume only evidence their run produced, cite
  // only digests that resolve, and are decided after the run ended.
  chain.results.forEach((result, i) => {
    const claim = claims.get(result.claimId);
    if (claim === undefined) {
      issues.push({
        code: 'unknown-claim',
        message: `orphan result "${result.resultId}" references absent claim "${result.claimId}"`,
        path: ['results', i],
      });
    } else if (result.stage !== claim.stage) {
      issues.push({
        code: 'stage-mismatch',
        message: `result "${result.resultId}" declares stage '${result.stage}' but its claim "${claim.claimId}" declares stage '${claim.stage}' — a ${result.stage} result cannot satisfy a ${claim.stage} claim`,
        path: ['results', i],
      });
    }
    const run = runs.get(result.runId);
    if (run === undefined) {
      issues.push({
        code: 'unknown-run',
        message: `orphan result "${result.resultId}" references absent run "${result.runId}"`,
        path: ['results', i],
      });
    } else {
      if (result.stage !== run.stage) {
        issues.push({
          code: 'stage-mismatch',
          message: `result "${result.resultId}" declares stage '${result.stage}' but its run "${run.runId}" declares stage '${run.stage}' — a ${result.stage} result cannot be grounded in a ${run.stage} run`,
          path: ['results', i],
        });
      }
      const foreign = result.evidenceDigests.filter(
        (digest) => !run.producedEvidence.includes(digest),
      );
      if (foreign.length > 0) {
        issues.push({
          code: 'evidence-not-produced-by-run',
          message: `result "${result.resultId}" cites evidence not produced by its run "${run.runId}": ${foreign.join(', ')}`,
          path: ['results', i, 'evidenceDigests'],
        });
      }
      if (result.decidedAt < run.endedAt) {
        issues.push({
          code: 'result-before-run-end',
          message: `result "${result.resultId}" is decided (${result.decidedAt}) before its run "${run.runId}" ends (${run.endedAt})`,
          path: ['results', i],
        });
      }
    }
    result.evidenceDigests.forEach((digest, j) => {
      if (!evidenceByDigest.has(digest)) {
        issues.push({
          code: 'evidence-digest-mismatch',
          message: `result "${result.resultId}" cites evidence digest ${digest}, but no evidence record in the chain digests to it (tampered, mismatched, or absent)`,
          path: ['results', i, 'evidenceDigests', j],
        });
      }
    });
  });

  // --- Result -> Approval: approvals reference an existing result, do not
  // self-approve (approver != executor of the result's run), are not
  // duplicated per (result, approver), and are recorded after the result.
  const approvalKeys = new Set<string>();
  const actorKinds = new Map<string, string>();
  const recordActor = (actorId: string, kind: string, where: readonly (string | number)[]): void => {
    const known = actorKinds.get(actorId);
    if (known !== undefined && known !== kind) {
      issues.push({
        code: 'actor-kind-conflict',
        message: `actor "${actorId}" is declared as both '${known}' and '${kind}' — one actor has one provenance kind within a chain`,
        path: where,
      });
    } else {
      actorKinds.set(actorId, kind);
    }
  };
  chain.runs.forEach((run, i) => recordActor(run.executedBy, run.executedByKind, ['runs', i, 'executedByKind']));
  chain.approvals.forEach((approval, i) =>
    recordActor(approval.approverId, approval.approverKind, ['approvals', i, 'approverKind']),
  );

  chain.approvals.forEach((approval, i) => {
    const result = results.get(approval.resultId);
    if (result === undefined) {
      issues.push({
        code: 'unknown-result',
        message: `approval "${approval.approvalId}" references absent result "${approval.resultId}"`,
        path: ['approvals', i],
      });
      return;
    }
    const key = `${approval.resultId} ${approval.approverId}`;
    if (approvalKeys.has(key)) {
      issues.push({
        code: 'duplicate-approval',
        message: `approver "${approval.approverId}" already recorded a decision for result "${approval.resultId}"`,
        path: ['approvals', i],
      });
    } else {
      approvalKeys.add(key);
    }
    const run = runs.get(result.runId);
    if (run !== undefined && approval.approverId === run.executedBy) {
      issues.push({
        code: 'self-approval',
        message: `result "${result.resultId}" cannot be approved by "${approval.approverId}": that actor executed run "${run.runId}" — results do not self-approve`,
        path: ['approvals', i],
      });
    }
    if (approval.decidedAt < result.decidedAt) {
      issues.push({
        code: 'approval-before-result',
        message: `approval "${approval.approvalId}" is recorded (${approval.decidedAt}) before its result "${result.resultId}" is decided (${result.decidedAt})`,
        path: ['approvals', i],
      });
    }
  });

  // --- Attached provenance graphs must themselves be valid.
  chain.provenance?.forEach((graph, i) => {
    const validation = validateProvenanceGraph(graph);
    if (!validation.ok) {
      issues.push({
        code: 'provenance-invalid',
        message: `attached provenance graph ${i} is invalid (${validation.issues.length} issue(s); first: ${validation.issues[0]?.message ?? 'invalid'})`,
        path: ['provenance', i],
        details: validation.issues,
      });
    }
  });

  return issues.length === 0 ? { ok: true, chain } : { ok: false, issues };
}

/**
 * Full admission pipeline (total, never throws): schema parse plus the
 * semantic chain walk. THE reference entry point for admitting a
 * serialized verification chain.
 */
export function admitChain(input: unknown): ChainValidation {
  const parsed = parseVerificationChain(input);
  if (!parsed.ok) return { ok: false, issues: parsed.issues };
  return validateChain(parsed.chain);
}
