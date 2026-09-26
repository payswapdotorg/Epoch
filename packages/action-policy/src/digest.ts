/**
 * Digest discipline for action-policy records: every published record is
 * content-addressed (SHA-256 over the canonical JSON of its immutable
 * content via @epoch/agent-protocol — the same machinery W003 proposals,
 * W006 evidence, and W010 events use), and decision records are
 * HASH-CHAINED per proposal (the W023 listing-version-chain style: each
 * record's `previousDecisionDigest` links to the prior recorded decision
 * for the same proposal id in the same tenant; the digest covers content
 * AND chain link, so the chain is tamper-evident by construction).
 *
 * A record whose claimed digest does not match the recomputed one is
 * rejected with the typed `digest-mismatch` error (tamper detection); a
 * chain whose links do not line up is rejected with the typed
 * `chain-broken` error. Decisions are NEVER mutated — a changed situation
 * (changed proposal revision or changed policy set) produces a NEW sealed
 * record whose chain link points at its predecessor.
 */
import { canonicalDigest, type JsonValue, type Sha256Hex } from '@epoch/agent-protocol';
import {
  ApprovalRecordContentSchema,
  ExpiryRecordContentSchema,
  PolicyDecisionSealInputSchema,
  RejectionRecordContentSchema,
  SealedApprovalRecordSchema,
  SealedExpiryRecordSchema,
  SealedPolicyDecisionSchema,
  SealedRejectionRecordSchema,
} from './schema';
import { validationError } from './issues';
import type {
  ActionPolicyResult,
  ApprovalRecordContent,
  ExpiryRecordContent,
  PolicyDecisionContent,
  RejectionRecordContent,
  SealedApprovalRecord,
  SealedExpiryRecord,
  SealedPolicyDecision,
  SealedRejectionRecord,
} from './types';

/** The seal input of a decision: content plus the chain link. */
export type PolicyDecisionSealInput = PolicyDecisionContent & {
  readonly previousDecisionDigest: Sha256Hex | null;
};

/**
 * Compute the content digest of a decision seal input: the SHA-256 of the
 * canonical JSON of the content INCLUDING the chain link. Equivalent
 * inputs always produce the same digest. Throws on an invalid seal input —
 * producers validate first ({@link sealDecision} is the total form).
 */
export function computeDecisionDigest(sealInput: PolicyDecisionSealInput): Sha256Hex {
  const parsed = PolicyDecisionSealInputSchema.safeParse(sealInput);
  if (!parsed.success) {
    throw new Error('cannot digest an invalid decision seal input (validate first — sealDecision is the total form)');
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/**
 * Seal valid decision content plus its chain link into the published
 * record. Total: invalid input yields a typed `validation` error
 * (including the denial-iff-deny / directive-iff-requires-approval
 * refinements).
 */
export function sealDecision(
  content: unknown,
  previousDecisionDigest: Sha256Hex | null,
): ActionPolicyResult<SealedPolicyDecision> {
  const parsed = PolicyDecisionSealInputSchema.safeParse(
    typeof content === 'object' && content !== null
      ? { ...(content as Record<string, unknown>), previousDecisionDigest }
      : content,
  );
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const sealed: SealedPolicyDecision = {
    ...parsed.data,
    contentDigest: canonicalDigest(parsed.data as unknown as JsonValue),
  };
  const recheck = SealedPolicyDecisionSchema.safeParse(sealed);
  if (!recheck.success) {
    return { ok: false, error: validationError(recheck.error) };
  }
  return { ok: true, value: recheck.data };
}

/**
 * Verify a sealed decision: schema validation + digest recomputation
 * (tamper detection — `digest-mismatch`).
 */
export function verifySealedDecision(sealed: unknown): ActionPolicyResult<SealedPolicyDecision> {
  const parsed = SealedPolicyDecisionSchema.safeParse(sealed);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message:
          'sealed decision digest does not match its content (tampered or mismatched envelope) — the record is rejected',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Verify a per-proposal decision chain (W023 style): walk the records in
 * recording order, recompute every content digest (tamper detection) and
 * check every `previousDecisionDigest` link against the prior record's
 * content digest (chain integrity). The first record's link must be null.
 */
export function verifyDecisionChain(
  chain: readonly SealedPolicyDecision[],
): ActionPolicyResult<readonly SealedPolicyDecision[]> {
  let previous: Sha256Hex | null = null;
  for (const record of chain) {
    const verified = verifySealedDecision(record);
    if (!verified.ok) {
      return verified;
    }
    if (verified.value.previousDecisionDigest !== previous) {
      return {
        ok: false,
        error: {
          code: 'chain-broken',
          message:
            "decision chain link does not match the prior record's content digest — the chain is broken",
          tenantId: verified.value.tenantId,
          proposalId: verified.value.proposalRef.proposalId,
          expected: previous,
          encountered: verified.value.previousDecisionDigest,
        },
      };
    }
    previous = verified.value.contentDigest;
  }
  return { ok: true, value: chain };
}

/**
 * Compute the content digest of an approval record. Throws on invalid
 * content; producers validate first ({@link sealApproval} is the total
 * form).
 */
export function computeApprovalDigest(content: ApprovalRecordContent): Sha256Hex {
  const parsed = ApprovalRecordContentSchema.safeParse(content);
  if (!parsed.success) {
    throw new Error('cannot digest an invalid approval record (validate first — sealApproval is the total form)');
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/** Seal valid approval content into its published record. Total. */
export function sealApproval(content: unknown): ActionPolicyResult<SealedApprovalRecord> {
  const parsed = ApprovalRecordContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: canonicalDigest(parsed.data as unknown as JsonValue) },
  };
}

/** Verify a sealed approval record (tamper detection — `digest-mismatch`). */
export function verifySealedApproval(sealed: unknown): ActionPolicyResult<SealedApprovalRecord> {
  const parsed = SealedApprovalRecordSchema.safeParse(sealed);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'sealed approval digest does not match its content — the record is rejected',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Compute the content digest of a rejection record. Throws on invalid
 * content; producers validate first ({@link sealRejection} is the total
 * form).
 */
export function computeRejectionDigest(content: RejectionRecordContent): Sha256Hex {
  const parsed = RejectionRecordContentSchema.safeParse(content);
  if (!parsed.success) {
    throw new Error('cannot digest an invalid rejection record (validate first — sealRejection is the total form)');
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/** Seal valid rejection content into its published record. Total. */
export function sealRejection(content: unknown): ActionPolicyResult<SealedRejectionRecord> {
  const parsed = RejectionRecordContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: canonicalDigest(parsed.data as unknown as JsonValue) },
  };
}

/** Verify a sealed rejection record (tamper detection — `digest-mismatch`). */
export function verifySealedRejection(sealed: unknown): ActionPolicyResult<SealedRejectionRecord> {
  const parsed = SealedRejectionRecordSchema.safeParse(sealed);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'sealed rejection digest does not match its content — the record is rejected',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Compute the content digest of an expiry record. Throws on invalid
 * content; producers validate first ({@link sealExpiry} is the total
 * form).
 */
export function computeExpiryDigest(content: ExpiryRecordContent): Sha256Hex {
  const parsed = ExpiryRecordContentSchema.safeParse(content);
  if (!parsed.success) {
    throw new Error('cannot digest an invalid expiry record (validate first — sealExpiry is the total form)');
  }
  return canonicalDigest(parsed.data as unknown as JsonValue);
}

/** Seal valid expiry content into its published record. Total. */
export function sealExpiry(content: unknown): ActionPolicyResult<SealedExpiryRecord> {
  const parsed = ExpiryRecordContentSchema.safeParse(content);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  return {
    ok: true,
    value: { ...parsed.data, contentDigest: canonicalDigest(parsed.data as unknown as JsonValue) },
  };
}

/** Verify a sealed expiry record (tamper detection — `digest-mismatch`). */
export function verifySealedExpiry(sealed: unknown): ActionPolicyResult<SealedExpiryRecord> {
  const parsed = SealedExpiryRecordSchema.safeParse(sealed);
  if (!parsed.success) {
    return { ok: false, error: validationError(parsed.error) };
  }
  const { contentDigest, ...content } = parsed.data;
  const expected = canonicalDigest(content as unknown as JsonValue);
  if (expected !== contentDigest) {
    return {
      ok: false,
      error: {
        code: 'digest-mismatch',
        message: 'sealed expiry digest does not match its content — the record is rejected',
        expected,
        encountered: contentDigest,
      },
    };
  }
  return { ok: true, value: parsed.data };
}
