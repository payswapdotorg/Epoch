import type {
  Assertion,
  DecisionScopeSpec,
  EntityId,
  InformationGap,
  Instant,
  ResolvedAssertion,
  TaskSufficientWorld,
} from '@epoch/world-contracts';
import { WorldModelError, issuesToDetails } from '../errors';
import { deepFreeze } from '../immutable';
import { DecisionScopeSpecSchema } from '../schema';
import { entityKey, parseKey, propertyKey } from './keys';
import { materializeEntityAt, materializeRelationAt } from './materialize';
import { confidenceUpperBound, resolveKeyAt } from './reconcile';
import type { WorldStore } from './store';

/**
 * Task-sufficient reconstruction and epistemic gap analysis.
 *
 * Reconstructs only what can materially affect feasible solutions,
 * predicted effects, or verification: the seed entities, their live
 * resolutions, and the relation closure up to the requested depth. Then it
 * identifies the ways missing information or uncertainty could change a
 * decision — absent entities, sub-floor confidence, missing required
 * properties, unsupported claims.
 *
 * The model MODELS the epistemic state; it never acquires information
 * (acquisition is an agent action through the action protocol, W003/W022).
 */

const DEFAULT_REQUIRED_CONFIDENCE = 0.5;

export function decisionScopeAt(store: WorldStore, rawSpec: DecisionScopeSpec, at: Instant): TaskSufficientWorld {
  const parsed = DecisionScopeSpecSchema.safeParse(rawSpec);
  if (!parsed.success) {
    throw new WorldModelError('WM_VALIDATION', 'invalid decision scope', issuesToDetails(parsed.error.issues));
  }
  const spec = parsed.data;
  const requiredConfidence = spec.requiredConfidence ?? DEFAULT_REQUIRED_CONFIDENCE;
  const relationDepth = spec.relationDepth ?? 0;

  // --- relation closure (BFS from the seeds) ---
  const visited = new Map<EntityId, number>();
  for (const seed of spec.entities) {
    if (!visited.has(seed)) visited.set(seed, 0);
  }
  const relationKeysInScope: string[] = [];
  let frontier = [...spec.entities];
  for (let depth = 0; depth < relationDepth && frontier.length > 0; depth += 1) {
    const next: EntityId[] = [];
    for (const entityId of frontier) {
      for (const key of liveRelationKeysTouching(store, entityId, at)) {
        relationKeysInScope.push(key);
        const parsedKey = parseKey(key);
        if (parsedKey === null || parsedKey.length !== 4) continue;
        const [, , source, target] = parsedKey;
        const other = source === entityId ? target : source;
        if (!visited.has(other)) {
          visited.set(other, depth + 1);
          next.push(other);
        }
      }
    }
    frontier = next;
  }
  const uniqueRelationKeys = [...new Set(relationKeysInScope)].sort();

  // --- materialize the sub-world ---
  const gaps: InformationGap[] = [];
  const entities = [];
  const resolutions: ResolvedAssertion[] = [];

  for (const entityId of [...visited.keys()].sort()) {
    const entity = materializeEntityAt(store, entityId, at);
    if (entity === null) {
      gaps.push({
        kind: 'absent-entity',
        subject: entityId,
        detail: `entity '${entityId}' is referenced by the decision scope but has no live existence assertion at the reference instant`,
        couldChangeDecision: true,
      });
      continue;
    }
    entities.push(entity);
    const existence = resolveKeyAt(store, entityKey(entityId), at);
    if (existence !== null) {
      resolutions.push({ key: existence.key, assertion: existence });
    }
    for (const key of store.propertyKeysOf(entityId)) {
      const live = resolveKeyAt(store, key, at);
      if (live !== null) {
        resolutions.push({ key, assertion: live });
      }
    }
    // required-property gaps against the effective type specification
    const specs = store.registry.effectiveProperties(entity.type);
    for (const [name, propertySpec] of Object.entries(specs)) {
      if (propertySpec.required === true && !(name in entity.properties)) {
        gaps.push({
          kind: 'missing-property',
          subject: propertyKey(entityId, name),
          detail: `entity '${entityId}' (type '${entity.type}') is missing required property '${name}'`,
          couldChangeDecision: true,
        });
      }
    }
  }

  const relations = [];
  for (const key of uniqueRelationKeys) {
    const relation = materializeRelationAt(store, key, at);
    if (relation === null) continue;
    relations.push(relation);
    const live = resolveKeyAt(store, key, at);
    if (live !== null) {
      resolutions.push({ key, assertion: live });
    }
  }

  // --- epistemic gap analysis over every contributing resolution ---
  const seenKeys = new Set<string>();
  const dedupedResolutions: ResolvedAssertion[] = [];
  for (const resolution of resolutions) {
    if (seenKeys.has(resolution.key)) continue;
    seenKeys.add(resolution.key);
    dedupedResolutions.push(resolution);
  }
  dedupedResolutions.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  for (const { key, assertion } of dedupedResolutions) {
    const upper = confidenceUpperBound(assertion.confidence);
    if (upper < requiredConfidence) {
      gaps.push({
        kind: 'low-confidence',
        subject: key,
        detail: `best-case confidence ${upper} stays below the required floor ${requiredConfidence}`,
        observedConfidence: upper,
        requiredConfidence,
        couldChangeDecision: true,
      });
    }
    if (assertion.provenance.evidence.length === 0) {
      gaps.push({
        kind: 'unsupported-claim',
        subject: key,
        detail: 'assertion carries no evidence references',
        couldChangeDecision: true,
      });
    }
  }

  gaps.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    return a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0;
  });

  const world: TaskSufficientWorld = {
    at,
    entities: Object.freeze(entities),
    relations: Object.freeze(relations),
    resolutions: Object.freeze(dedupedResolutions),
    gaps: Object.freeze(gaps),
  };
  return deepFreeze(world);
}

function liveRelationKeysTouching(store: WorldStore, entityId: EntityId, at: Instant): string[] {
  const keys: string[] = [];
  for (const key of store.relationKeys()) {
    const parsed = parseKey(key);
    if (parsed === null || parsed.length !== 4) continue;
    const [, , source, target] = parsed;
    if (source !== entityId && target !== entityId) continue;
    if (resolveKeyAt(store, key, at) === null) continue;
    keys.push(key);
  }
  return keys;
}

/** Re-exported for tests: the assertion feeding a materialized view. */
export function resolutionOf(store: WorldStore, key: string, at: Instant): Assertion | null {
  return resolveKeyAt(store, key, at);
}
