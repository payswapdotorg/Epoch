/**
 * COMPILE-TIME KERNEL PARITY (devDependencies only — the kernel-to-kernel
 * devDep precedent of W036/W041; the frozen runtime dependency policy of
 * this kernel is @epoch/adapter-sdk, @epoch/agent-protocol,
 * @epoch/tenancy, and zod).
 *
 * This file pins structural compatibility between the bridge shapes and
 * the sibling kernel vocabularies WITHOUT runtime edges:
 *
 * - W010: `BridgeEventContent` is TYPE-EQUAL to @epoch/event-log's
 *   `EventContent` (bridge lifecycle events are append-only typed events
 *   over the W010 event shapes — the open `bridge:` payload namespace);
 * - W009: `BridgeAuthorizationRequest` is TYPE-EQUAL to
 *   @epoch/authorization's `AuthorizationRequest`, and every real W009
 *   decision (allow/deny/not-applicable) is assignable to the
 *   `BridgeAuthorizationDecision` structural subset the gate consumes;
 * - W041: the least-privilege field-allowlist grammar is the REAL
 *   `PolicyBinding.fieldAllowlist` grammar (assignable), and the bridge
 *   redaction-class vocabulary is TYPE-EQUAL to the W041 vocabulary;
 * - W036: the observation intake-proposal slot is a structural SUPERSET
 *   of the W036 observation distinction-record envelope, and every
 *   opaque slot (subject, measure, payload, uncertainty) accepts the
 *   REAL W036 value types;
 * - W006: the provider-payload digest grammar is the exact-revision
 *   digest grammar (`ExactRevisionRef['digest']`).
 *
 * IMPORTANT: this module is type-only and is deliberately NOT
 * re-exported from the package index — importing it into the public
 * surface would drag the devDependencies into every downstream
 * consumer's compile graph. It is compiled by this package's own
 * `tsc --noEmit` (tsconfig.json includes src/**) and mirrored by
 * runtime parity tests (test/parity.test.ts).
 */
import type { Equals, Expect } from './type-utils';
import type { BridgeEventContent } from './events';
import type { BridgeAuthorizationDecision, BridgeAuthorizationRequest } from './authorization';
import type { BridgeRedactionClass, LeastPrivilegeProjection } from './outbound';
import type { ObservationIntakePayload } from './inbound';
import type { BridgeProvenance } from './provenance';
import type { EventContent } from '@epoch/event-log';
import type {
  AllowDecision,
  AuthorizationRequest,
  DenyDecision,
  NotApplicableDecision,
} from '@epoch/authorization';
import type { PolicyBinding, RedactionClass } from '@epoch/access-projection';
import type {
  DistinctionRecordContent,
  ObservationPayload,
  UncertaintyState,
} from '@epoch/solution-delivery';
import type { DistinctionSubject, Measure } from '@epoch/solution-delivery';
import type { ExactRevisionRef } from '@epoch/evidence';
import type { JsonValue } from '@epoch/agent-protocol';

// ---- W010: the bridge event content is the W010 event content. ----------------

/** Bridge lifecycle events are W010 event shapes, structurally (W010 parity). */
export type BridgeEventContentParity = Expect<Equals<BridgeEventContent, EventContent>>;

// ---- W009: the authorization mirror. -------------------------------------------

/** The gate's request mirror is the REAL W009 request type. */
export type AuthorizationRequestParity = Expect<
  Equals<BridgeAuthorizationRequest, AuthorizationRequest>
>;

/** A REAL allow decision is assignable to the gate's decision subset. */
export type AllowDecisionAssignable = Expect<
  AllowDecision extends BridgeAuthorizationDecision ? true : false
>;

/** A REAL deny decision is assignable to the gate's decision subset. */
export type DenyDecisionAssignable = Expect<
  DenyDecision extends BridgeAuthorizationDecision ? true : false
>;

/** A REAL not-applicable decision is assignable to the gate's decision subset. */
export type NotApplicableDecisionAssignable = Expect<
  NotApplicableDecision extends BridgeAuthorizationDecision ? true : false
>;

// ---- W041: the least-privilege projection reference. -----------------------------

/** The bridge consumes the REAL W041 field-allowlist grammar. */
export type PolicyBindingAllowlistAssignable = Expect<
  PolicyBinding extends { fieldAllowlist: readonly string[] } ? true : false
>;

/** A W041 binding's allowlist feeds the bridge projection directly. */
export type PolicyBindingFeedsProjection = Expect<
  PolicyBinding['fieldAllowlist'] extends LeastPrivilegeProjection['fieldAllowlist'] ? true : false
>;

/** The bridge redaction-class vocabulary is the W041 vocabulary. */
export type RedactionClassParity = Expect<Equals<BridgeRedactionClass, RedactionClass>>;

// ---- W036: the observation intake-proposal slot. ----------------------------------

/** The W036 observation content envelope (the observation branch). */
type W036ObservationContent = Extract<DistinctionRecordContent, { kind: 'observation' }>;

/** The W036 observation envelope fields the bridge slot types identically. */
export type ObservationEnvelopeParity = Expect<
  W036ObservationContent extends {
    schema: 'epoch.solution-delivery.distinction-record';
    schemaVersion: 1;
    kind: 'observation';
    recordId: string;
    tenantId: string;
    recordedAt: string;
    recordedBy: string;
  } ? true : false
>;

/** The bridge slot is a structural superset of the W036 envelope. */
export type IntakeSlotSupersetParity = Expect<
  ObservationIntakePayload extends {
    schema: 'epoch.solution-delivery.distinction-record';
    schemaVersion: 1;
    kind: 'observation';
    recordId: string;
    tenantId: string;
    recordedAt: string;
    recordedBy: string;
  } ? true : false
>;

/** The opaque subject slot accepts the REAL W036 subject. */
export type SubjectSlotAssignable = Expect<DistinctionSubject extends JsonValue ? true : false>;

/** The opaque measure slot accepts the REAL W036 measure. */
export type MeasureSlotAssignable = Expect<Measure extends JsonValue ? true : false>;

/** The opaque payload slot accepts the REAL W036 observation payload. */
export type PayloadSlotAssignable = Expect<ObservationPayload extends JsonValue ? true : false>;

/** The opaque uncertainty slot accepts the REAL W036 uncertainty state. */
export type UncertaintySlotAssignable = Expect<UncertaintyState extends JsonValue ? true : false>;

// ---- W006: the provenance digest grammar. ------------------------------------------

/** The provider-payload digest is the W006 exact-revision digest grammar. */
export type ProviderPayloadDigestParity = Expect<
  Equals<BridgeProvenance['providerPayloadDigest'], ExactRevisionRef['digest']>
>;
