/**
 * The discriminated union over all action-protocol message kinds (a Tech
 * Lead design pin: "discriminated unions for message kinds").
 *
 * `parseActionProtocolMessage` routes on `messageKind` and delegates to the
 * per-message parsers, preserving their precise version/kind/schema error
 * reporting; unknown kinds fail through the union schema as
 * schema-violations.
 */
import { z } from 'zod';
import { admitMessage, type ParseOutcome } from '@epoch/agent-protocol';
import { ActionProposalSchema, parseActionProposal, type ActionProposal } from './proposal';
import {
  AuthorizationDecisionSchema,
  AuthorizationRequestSchema,
  parseAuthorizationDecision,
  parseAuthorizationRequest,
  type AuthorizationDecision,
  type AuthorizationRequest,
} from './authorization';
import { ACTION_PROTOCOL_VERSION } from './version';

export const ActionProtocolMessageSchema = z
  .discriminatedUnion('messageKind', [
    ActionProposalSchema,
    AuthorizationRequestSchema,
    AuthorizationDecisionSchema,
  ])
  .meta({
    id: 'ActionProtocolMessage',
    title: 'ActionProtocolMessage',
    description: 'Discriminated union of all action-protocol v1 messages (proposal, authorization request, decision).',
  });

export type ActionProtocolMessage =
  | ActionProposal
  | AuthorizationRequest
  | AuthorizationDecision;

/**
 * Admit any action-protocol message, routed by `messageKind` so that the
 * per-message admission pipeline (version gate, kind gate, schema
 * validation, canonical evidence) applies unchanged.
 */
export function parseActionProtocolMessage(input: unknown): ParseOutcome<ActionProtocolMessage> {
  if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
    const kind = (input as Record<string, unknown>).messageKind;
    switch (kind) {
      case 'action.proposal':
        return parseActionProposal(input);
      case 'action.authorization-request':
        return parseAuthorizationRequest(input);
      case 'action.authorization-decision':
        return parseAuthorizationDecision(input);
      default:
        break;
    }
  }
  // Unknown or missing kind: run the shared pipeline against the union so
  // the failure is a typed schema-violation (after the version gate).
  return admitMessage({
    input,
    expectedVersion: ACTION_PROTOCOL_VERSION,
    schema: ActionProtocolMessageSchema,
  });
}
