/**
 * Semantic entity mapping (W058) — the invariant that makes the Three.js
 * scene graph an EPOCH presentation rather than a second world:
 *
 * EVERY Object3D this adapter presents for a semantic world entity carries
 * its semantic entity id in `userData`, and every agent representation
 * carries its agent id. The mapping is total and bidirectional: the adapter
 * can resolve any hit-tested object back to its semantic identity, and any
 * semantic identity back to its presentation node.
 *
 * Renderer-native state (the Object3D graph itself) is DISPOSABLE
 * presentation state: it is rebuilt from the canonical projection on every
 * mount, never persisted, and never treated as semantic truth (lock rules
 * 8/16 — the scene graph is a projection, never a second source of truth).
 */
import type { Object3D, Scene } from 'three';

/** The userData key carrying a semantic world-entity id. */
export const SEMANTIC_ENTITY_KEY = 'epochEntityId' as const;

/** The userData key carrying an agent id (agent representations are not world entities). */
export const SEMANTIC_AGENT_KEY = 'epochAgentId' as const;

/** The userData key carrying a presentation label (host chrome renders the text). */
export const PRESENTATION_LABEL_KEY = 'epochLabel' as const;

/** The userData key carrying a presentation badge (state overlays). */
export const PRESENTATION_BADGE_KEY = 'epochBadge' as const;

/** Which semantic identity one Object3D carries (none for pure decoration children). */
export interface SemanticIdentity {
  readonly kind: 'entity' | 'agent';
  readonly id: string;
}

/**
 * Resolve the semantic identity of one Object3D: the nearest self-or-ancestor
 * node carrying a semantic id (decorations attached under an entity mesh
 * resolve to their entity — that is what makes a highlight ring clickable
 * as the entity it marks).
 */
export function semanticIdentityOf(object: Object3D | null): SemanticIdentity | undefined {
  let node: Object3D | null = object;
  while (node !== null) {
    const entityId = node.userData[SEMANTIC_ENTITY_KEY];
    if (typeof entityId === 'string' && entityId !== '') {
      return { kind: 'entity', id: entityId };
    }
    const agentId = node.userData[SEMANTIC_AGENT_KEY];
    if (typeof agentId === 'string' && agentId !== '') {
      return { kind: 'agent', id: agentId };
    }
    node = node.parent;
  }
  return undefined;
}

/** Attach a semantic entity id to one presentation node (total mapping). */
export function markEntityNode(node: Object3D, entityId: string): void {
  node.userData[SEMANTIC_ENTITY_KEY] = entityId;
}

/** Attach an agent id to one agent representation node. */
export function markAgentNode(node: Object3D, agentId: string): void {
  node.userData[SEMANTIC_AGENT_KEY] = agentId;
}

/** Attach a presentation label (the host chrome owns text rendering). */
export function setPresentationLabel(node: Object3D, label: string): void {
  node.userData[PRESENTATION_LABEL_KEY] = label;
}

/** The presentation label of one node (if any). */
export function presentationLabelOf(node: Object3D): string | undefined {
  const label = node.userData[PRESENTATION_LABEL_KEY];
  return typeof label === 'string' && label !== '' ? label : undefined;
}

/** Attach a presentation badge label (state overlays). */
export function setPresentationBadge(node: Object3D, badge: string): void {
  node.userData[PRESENTATION_BADGE_KEY] = badge;
}

/** The presentation badge of one node (if any). */
export function presentationBadgeOf(node: Object3D): string | undefined {
  const badge = node.userData[PRESENTATION_BADGE_KEY];
  return typeof badge === 'string' && badge !== '' ? badge : undefined;
}

/**
 * Count the presentation nodes that carry a semantic entity id (evidence
 * helper: every presented entity maps to exactly one root presentation
 * node; decorations are children and do not carry their own ids).
 */
export function countSemanticEntityNodes(root: Scene): number {
  let count = 0;
  root.traverse((node) => {
    if (typeof node.userData[SEMANTIC_ENTITY_KEY] === 'string') {
      count += 1;
    }
  });
  return count;
}
