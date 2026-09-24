/**
 * Agent Protocol version constants and message-kind vocabulary.
 *
 * Versioning policy (v1): a message is admitted only when its
 * `protocolVersion` equals {@link AGENT_PROTOCOL_VERSION} exactly. The parser
 * reports a distinct `version-mismatch` error (with expected/encountered
 * versions) before any schema validation, so version skew is always
 * distinguishable from malformed payloads. Tolerance for compatible
 * minor/patch versions is a future, explicit protocol decision — see the
 * limitations recorded in contracts/agent/README.md.
 */
import { z } from 'zod';

/** Protocol version carried by every agent-protocol message. */
export const AGENT_PROTOCOL_VERSION = '1.0.0' as const;

/** The protocol version literal type. */
export type ProtocolVersion = typeof AGENT_PROTOCOL_VERSION;

export const ProtocolVersionSchema = z.literal(AGENT_PROTOCOL_VERSION).meta({
  id: 'ProtocolVersion',
  title: 'ProtocolVersion',
  description: 'Exact agent-protocol version admitted by this release ("1.0.0").',
});

/** Message kind of the agent registration message. */
export const AGENT_MESSAGE_KIND_REGISTRATION = 'agent.registration' as const;

/** All message kinds defined by agent protocol v1. */
export const AGENT_PROTOCOL_MESSAGE_KINDS = [
  AGENT_MESSAGE_KIND_REGISTRATION,
] as const;

/** Message-kind value type of agent protocol v1. */
export type MessageKind = (typeof AGENT_PROTOCOL_MESSAGE_KINDS)[number];

export const MessageKindSchema = z
  .enum(AGENT_PROTOCOL_MESSAGE_KINDS)
  .meta({
    id: 'MessageKind',
    title: 'MessageKind',
    description: 'Discriminating message kind for agent-protocol messages.',
  });

/** Version of the published contract surface at contracts/agent. */
export const AGENT_CONTRACT_VERSION = '1.0.0' as const;
