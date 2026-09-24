/**
 * Action Protocol version constants and message-kind vocabulary.
 *
 * Versioning policy mirrors the agent protocol (see
 * `@epoch/agent-protocol/src/version.ts`): a message is admitted only when
 * its `protocolVersion` equals {@link ACTION_PROTOCOL_VERSION} exactly, and
 * version skew is reported as a distinct `version-mismatch` admission error
 * before any schema validation. The action-protocol version evolves
 * independently of the agent-protocol version; when shared primitives
 * consumed from `@epoch/agent-protocol` change materially, the action
 * protocol's major version must be revisited (recorded as an architecture
 * note in the W003 PR).
 */
import { z } from 'zod';

/** Protocol version carried by every action-protocol message. */
export const ACTION_PROTOCOL_VERSION = '1.0.0' as const;

/** The action-protocol version literal type. */
export type ActionProtocolVersion = typeof ACTION_PROTOCOL_VERSION;

export const ActionProtocolVersionSchema = z.literal(ACTION_PROTOCOL_VERSION).meta({
  id: 'ActionProtocolVersion',
  title: 'ActionProtocolVersion',
  description: 'Exact action-protocol version admitted by this release ("1.0.0").',
});

/** Message kind of the action proposal message. */
export const ACTION_MESSAGE_KIND_PROPOSAL = 'action.proposal' as const;

/** Message kind of the authorization request message. */
export const ACTION_MESSAGE_KIND_AUTHORIZATION_REQUEST = 'action.authorization-request' as const;

/** Message kind of the authorization decision message. */
export const ACTION_MESSAGE_KIND_AUTHORIZATION_DECISION = 'action.authorization-decision' as const;

/** All message kinds defined by action protocol v1. */
export const ACTION_PROTOCOL_MESSAGE_KINDS = [
  ACTION_MESSAGE_KIND_PROPOSAL,
  ACTION_MESSAGE_KIND_AUTHORIZATION_REQUEST,
  ACTION_MESSAGE_KIND_AUTHORIZATION_DECISION,
] as const;

/** Message-kind value type of action protocol v1. */
export type ActionMessageKind = (typeof ACTION_PROTOCOL_MESSAGE_KINDS)[number];

export const ActionMessageKindSchema = z.enum(ACTION_PROTOCOL_MESSAGE_KINDS).meta({
  id: 'ActionMessageKind',
  title: 'ActionMessageKind',
  description: 'Discriminating message kind for action-protocol messages.',
});

/** Version of the published contract surface at contracts/actions. */
export const ACTION_CONTRACT_VERSION = '1.0.0' as const;
