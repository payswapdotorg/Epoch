/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-to-kernel
 * devDep precedent of W002/W006/W007/W008/W009/W011/W013/W023/W028/W036).
 *
 * This file pins structural compatibility between the action-policy shapes
 * and the sibling kernel vocabularies WITHOUT adding runtime dependencies
 * (the W022 runtime-dependency policy: @epoch/action-protocol,
 * @epoch/policy-contracts, @epoch/agent-protocol, @epoch/tenancy, and zod
 * only):
 *
 * - decision/approval content digests are TYPE-EQUAL to the W010 event-log
 *   digest grammar and the W006 evidence exact-revision digest grammar
 *   (every action-policy content address is a canonical SHA-256 hex, the
 *   same evidence discipline the event log and the evidence kernel use);
 * - the approval record content's digest fields are TYPE-EQUAL to the W006
 *   verification run's produced-evidence digest element (approvals are
 *   evidence-shaped authorization acts in the W006 chain sense:
 *   Requirement -> ... -> Result -> Approval);
 * - the mirrored SHA-256 grammar equals the W010 `SHA256_HEX_PATTERN`
 *   grammar member-for-member (runtime parity tests mirror this).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would drag
 * the devDependencies into every downstream consumer's compile graph. It
 * is compiled by this package's own `tsc --noEmit` (tsconfig.json includes
 * src/**) and mirrored by runtime parity tests (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { SealedPolicyDecision, SealedApprovalRecord } from './types';
import type { Sha256DigestSchema } from '@epoch/tenancy';
import type { z } from 'zod';
import type { Sha256Hex } from '@epoch/agent-protocol';
import type { EventContent, EventRecord } from '@epoch/event-log';
import type { ExactRevisionRef } from '@epoch/evidence';
import type { Run } from '@epoch/verification';

/** Every action-policy content address is the canonical SHA-256 grammar. */
export type DecisionDigestParity = Expect<
  Equals<SealedPolicyDecision['contentDigest'], z.infer<typeof Sha256DigestSchema>>
>;

/** The W006 exact-revision digest grammar is the same grammar. */
export type EvidenceDigestParity = Expect<
  Equals<SealedPolicyDecision['contentDigest'], ExactRevisionRef['digest']>
>;

/** The W010 event digest grammar is the same grammar. */
export type EventDigestParity = Expect<
  Equals<SealedPolicyDecision['contentDigest'], EventRecord['contentDigest']>
>;

/** Approval digests are the W006 verification-run evidence grammar. */
export type ApprovalEvidenceParity = Expect<
  Equals<SealedApprovalRecord['contentDigest'], Run['producedEvidence'][number]>
>;

/** The canonical SHA-256 alias is the agent-protocol grammar everywhere. */
export type Sha256AliasParity = Expect<Equals<SealedPolicyDecision['contentDigest'], Sha256Hex>>;

/** Timestamps are the shared canonical UTC grammar (W010 parity). */
export type TimestampParity = Expect<Equals<SealedPolicyDecision['decidedAt'], EventContent['occurredAt']>>;
