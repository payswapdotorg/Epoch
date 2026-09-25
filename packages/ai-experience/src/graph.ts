/**
 * W011 presence-graph emission — typed projection helpers that turn the
 * AI-collaboration presence/focus semantics into Experience Graph
 * vocabulary (the genuine runtime composition with @epoch/experience-
 * protocol; downstream compatibility with @epoch/experience-compiler is
 * pinned by test/compiler-parity.test.ts).
 *
 * The emitted graphs are PRESENTATION projections (lock rule 8): presence
 * seats and cursors referencing participants opaquely — never embedded
 * kernel objects, never a second authority. Node ids are derived
 * deterministically from the participant principal ids so equal inputs
 * always emit equal graphs.
 */
import { sha256Hex } from '@epoch/agent-protocol';
import {
  DeviceDescriptorSchema,
  PresenceCursorDescriptorSchema,
  PresenceSeatDescriptorSchema,
  projectedReferenceKey,
  type ExperienceGraphContent,
  type ExperienceNode,
  type ProjectedReference,
} from '@epoch/experience-protocol';
import { validationMessage } from './issues';
import type { AiResult, PresenceCursorInput, PresenceSeatInput } from './types';

/**
 * Derive a deterministic, bounded presence node id from a principal id:
 * `xn-<role>-<first 16 hex of SHA-256(principalId)>` (the W011 node-id
 * grammar caps ids at 65 characters — opaque principal ids can exceed
 * that, so the derivation is content-addressed instead of transliterated).
 */
function presenceNodeId(role: 'seat' | 'cursor', principalId: string): string {
  return `xn-${role}-${sha256Hex(principalId).slice(0, 16)}`;
}

/** Derive a deterministic presence-seat node id from a principal id. */
export function presenceSeatNodeId(principalId: string): string {
  return presenceNodeId('seat', principalId);
}

/** Derive a deterministic presence-cursor node id from a principal id. */
export function presenceCursorNodeId(principalId: string): string {
  return presenceNodeId('cursor', principalId);
}

/**
 * Emit one W011 `presence-seat` node for a collaboration participant.
 * The participant is referenced OPAQUELY (bounded id + neutral kind —
 * the W011 vocabulary); the optional `ref` anchors the seat to projected
 * kernel state.
 */
export function presenceSeatNode(input: PresenceSeatInput): ExperienceNode {
  const descriptor = PresenceSeatDescriptorSchema.parse({
    participant: {
      participantId: input.principalId,
      participantKind: input.participantKind,
    },
  });
  return {
    id: presenceSeatNodeId(input.principalId),
    kind: 'presence-seat',
    ...(input.ref !== undefined ? { ref: input.ref } : {}),
    descriptor,
  } as ExperienceNode;
}

/**
 * Emit one W011 `presence-cursor` node (an agent camera/cursor or a human
 * pointer). Requires a 2D or 3D position (the W011 cursor contract).
 */
export function presenceCursorNode(input: PresenceCursorInput): AiResult<ExperienceNode> {
  const descriptor =
    PresenceCursorDescriptorSchema.safeParse({
      participant: {
        participantId: input.principalId,
        participantKind: input.participantKind,
      },
      ...(input.position2d !== undefined
        ? { position2d: { x: input.position2d[0], y: input.position2d[1] } }
        : {}),
      ...(input.position3d !== undefined
        ? { position3d: { x: input.position3d[0], y: input.position3d[1], z: input.position3d[2] } }
        : {}),
      ...(input.atMs !== undefined ? { atMs: input.atMs } : {}),
    });
  if (!descriptor.success) {
    return {
      ok: false,
      error: validationMessage(
        'presence cursor requires a 2D or 3D position (the W011 cursor contract)',
        'position2d',
      ),
    };
  }
  return {
    ok: true,
    value: {
      id: presenceCursorNodeId(input.principalId),
      kind: 'presence-cursor',
      descriptor: descriptor.data,
    } as ExperienceNode,
  };
}

/** The assembled presence-graph emission input. */
export interface PresenceGraphInput {
  /** The seats to project (one per participant). */
  readonly seats: readonly PresenceSeatInput[];
  /** Optional cursors (agent cameras / human pointers). */
  readonly cursors?: readonly PresenceCursorInput[];
  /** Projected kernel references the graph projects from (may be empty). */
  readonly projectedFrom?: readonly ProjectedReference[];
}

/**
 * Assemble a W011 presence-graph node set from the collaboration
 * semantics: seats (sorted by node id) plus cursors (sorted by node id).
 * Pure and deterministic: equal inputs emit equal node sets.
 */
export function presenceGraphNodes(input: PresenceGraphInput): AiResult<readonly ExperienceNode[]> {
  const nodes: ExperienceNode[] = [];
  for (const seat of input.seats) {
    nodes.push(presenceSeatNode(seat));
  }
  for (const cursor of input.cursors ?? []) {
    const node = presenceCursorNode(cursor);
    if (!node.ok) {
      return node;
    }
    nodes.push(node.value);
  }
  nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // Duplicate node ids cannot occur (ids derive from unique principal ids
  // with seat/cursor prefixes), but the invariant is cheap to prove.
  for (let i = 1; i < nodes.length; i += 1) {
    if (nodes[i].id === nodes[i - 1].id) {
      return {
        ok: false,
        error: validationMessage('duplicate presence node id', 'seats'),
      };
    }
  }
  return { ok: true, value: nodes };
}

/**
 * Assemble the complete W011 Experience Graph CONTENT for a presence
 * projection (graph kind `presence`): canonically ordered nodes, empty
 * edge set, sorted projected references, and the device the graph is
 * produced for. Seal it with @epoch/experience-protocol's
 * `sealExperienceGraph` (the W011 admission stays W011's).
 */
export function buildPresenceGraphContent(
  input: PresenceGraphInput & {
    readonly graphId: string;
    readonly tenantScope: { tenantId: string; workspaceId?: string; projectId?: string };
    readonly device: unknown;
  },
): AiResult<ExperienceGraphContent> {
  const deviceParsed = DeviceDescriptorSchema.safeParse(input.device);
  if (!deviceParsed.success) {
    return { ok: false, error: validationMessage('invalid device descriptor', 'device') };
  }
  const nodes = presenceGraphNodes(input);
  if (!nodes.ok) {
    return nodes;
  }
  if (nodes.value.length === 0) {
    return {
      ok: false,
      error: validationMessage('a presence graph requires at least one seat', 'seats'),
    };
  }
  const projectedFrom = [...(input.projectedFrom ?? [])].sort((a, b) =>
    projectedReferenceKey(a) < projectedReferenceKey(b)
      ? -1
      : projectedReferenceKey(a) > projectedReferenceKey(b)
        ? 1
        : 0,
  );
  const content: ExperienceGraphContent = {
    schema: 'epoch.experience-graph',
    protocolVersion: '1.0.0',
    graphId: input.graphId,
    graphKind: 'presence',
    tenantScope: input.tenantScope,
    projectedFrom,
    nodes: [...nodes.value],
    edges: [],
    device: deviceParsed.data,
  };
  return { ok: true, value: content };
}
