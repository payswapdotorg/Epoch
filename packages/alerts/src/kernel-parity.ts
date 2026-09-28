/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-to-kernel
 * devDep precedent). This file pins structural compatibility between
 * the alerts shapes and the sibling kernel vocabularies WITHOUT adding
 * runtime dependencies (the W043 runtime-dependency policy:
 * @epoch/action-protocol, @epoch/agent-protocol, @epoch/tenancy, and
 * zod only):
 *
 * - `EscalationOutcomeContent.decidedByRole` is TYPE-EQUAL to the W003
 *   authorizer-role grammar (escalation decisions come from the Action
 *   Gateway or a human approver — agents are structurally excluded);
 * - the W010 event-log actor grammar is the plain principal alias (the
 *   mirrored alerts principal grammar);
 * - the W006 exact-revision digest grammar is the sha256-hex grammar of
 *   every alerts content address;
 * - the W038 issue-family digest grammar (the sealed issue-record
 *   content digest) is the same sha256-hex grammar (escalation
 *   evidence references stay exact-revision addressable).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index. It is compiled by this package's own
 * `tsc --noEmit` and mirrored by runtime parity tests.
 */
import type { Equals, Expect } from './type-utils';
import type { EscalationOutcomeContent } from './escalation';
import type { SealedAlertRecord } from './alerts';
import type { AuthorizerRole } from '@epoch/action-protocol';
import type { EventActor } from '@epoch/event-log';
import type { ExactRevisionRef } from '@epoch/evidence';
import type { SealedIssueRecord } from '@epoch/execution-tracking';

/** Escalation decisions come from the W022 gateway roles (agents excluded). */
export type DecidedByRoleParity = Expect<
  Equals<EscalationOutcomeContent['decidedByRole'], AuthorizerRole>
>;

/** The W010 event actor grammar is the plain principal alias (W009 parity). */
export type EventActorParity = Expect<Equals<string, EventActor>>;

/** Every alerts content address carries the W006 exact-revision digest grammar. */
export type AlertDigestParity = Expect<
  Equals<SealedAlertRecord['contentDigest'], ExactRevisionRef['digest']>
>;

/** The W038 sealed issue-record digest is the same exact-revision grammar. */
export type IssueDigestParity = Expect<
  Equals<SealedAlertRecord['contentDigest'], SealedIssueRecord['contentDigest']>
>;
