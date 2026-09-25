/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-to-kernel
 * devDep precedent of W002/W006-W009/W010/W011/W013/W028).
 *
 * This file pins structural compatibility between the AI-experience
 * package's mirrored W010/W003 grammars and the upstream vocabularies
 * WITHOUT adding runtime dependencies:
 *
 * - `AiTenantId` / `AiSessionId` / `AiPrincipalId` are TYPE-only `string`
 *   aliases, exactly like @epoch/tenancy's `TenantId` and
 *   @epoch/collaboration's `CollaborationSessionId` /
 *   `ParticipantPrincipalId` (value-level pattern equality is pinned by
 *   the runtime parity test test/parity.test.ts);
 * - the mirrored `ActionProposalTarget` is two-way structurally
 *   assignable with @epoch/action-protocol's `ProposalReference` (reached
 *   through collaboration's subject vocabulary);
 * - the mirrored W010 collaboration event envelope is two-way structurally
 *   assignable with @epoch/collaboration's `CollaborationEvent` over the
 *   shared coordination vocabulary;
 * - the `TimelinePosition` field grammar equals @epoch/replay's
 *   `ReplayCursor` field grammar field-for-field (semantics differ by
 *   design: replay cursors are exclusive resume bounds, timeline
 *   positions are inclusive last-applied coordinates).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT re-exported
 * from the package index — importing it into the public surface would
 * drag the devDependencies into every downstream consumer's compile
 * graph. It is compiled by this package's own `tsc --noEmit` and mirrored
 * by runtime parity tests.
 */
import type { Expect } from './type-utils';
import type {
  ActionProposalTarget,
  AiPrincipalId,
  AiSessionId,
  AiTenantId,
  MirroredCollaborationEventRecord,
  TimelinePosition,
} from './types';
import type { TenantId } from '@epoch/tenancy';
import type {
  CollaborationEvent,
  CollaborationSessionId,
  CollaborationSubject,
  ParticipantPrincipalId,
} from '@epoch/collaboration';
import type { ReplayCursor } from '@epoch/replay';

/** The W003 ProposalReference shape, reached through collaboration's subject vocabulary. */
type UpstreamProposalReference = Extract<CollaborationSubject, { kind: 'action-proposal' }>['proposal'];

/** Two-way structural assignability (the cross-package parity relation). */
type TwoWay<A, B> = A extends B ? (B extends A ? true : false) : false;

/** Tenant scopes are tenancy tenant ids, structurally (W009 parity). */
export type AiTenantIdParity = Expect<TwoWay<AiTenantId, TenantId>>;

/** Session ids are collaboration session ids, structurally (W010 parity). */
export type AiSessionIdParity = Expect<TwoWay<AiSessionId, CollaborationSessionId>>;

/** Participants are identity principal ids, structurally (W009 parity). */
export type AiPrincipalIdParity = Expect<TwoWay<AiPrincipalId, ParticipantPrincipalId>>;

/** The mirrored action-proposal target equals the W003 ProposalReference. */
export type ActionProposalTargetParity = Expect<
  TwoWay<ActionProposalTarget, UpstreamProposalReference>
>;

/**
 * The mirrored collaboration event envelope is two-way structurally
 * assignable with @epoch/collaboration's `CollaborationEvent` over the
 * shared coordination vocabulary (participant/presence/subject/data
 * members, envelope scoping, and the W010 kind set).
 */
export type MirroredEventEnvelopeParity = Expect<
  TwoWay<MirroredCollaborationEventRecord['event'], CollaborationEvent>
>;

/** Timeline positions share the W010 replay-cursor field grammar. */
export type TimelinePositionParity = [
  Expect<TwoWay<TimelinePosition['streamId'], ReplayCursor['streamId']>>,
  Expect<TwoWay<TimelinePosition['sequence'], ReplayCursor['lastSequence']>>,
];
