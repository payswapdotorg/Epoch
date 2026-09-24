/**
 * Semantic validation of a provenance graph (the reference validator).
 *
 * Walks every statement and enforces the PROV-DM structural constraints
 * that make a graph trustworthy as audit data (R17):
 * - every identifier referenced by a statement must resolve to a node
 *   declared in the same graph (unknown agents, unknown activities, and
 *   dangling entities are rejected);
 * - node ids are unique within their collection;
 * - activity time bounds are ordered (startedAt <= endedAt);
 * - derivation is irreflexive (no self-derivation) and acyclic — PROV
 *   derivation is a strict partial order over entities.
 *
 * Total function: collects ALL issues and never throws.
 */
import type {
  ProvenanceActivity,
  ProvenanceAgent,
  ProvenanceEntity,
  ProvenanceGraph,
  ProvenanceIssue,
  ProvenanceStatement,
} from './types';

/** Outcome of semantic graph validation. */
export type ProvenanceValidation =
  | { ok: true; graph: ProvenanceGraph }
  | { ok: false; issues: readonly ProvenanceIssue[] };

function indexNodes<T extends ProvenanceAgent | ProvenanceActivity | ProvenanceEntity>(
  nodes: readonly T[],
  idOf: (node: T) => string,
  collection: string,
  duplicateCode: ProvenanceIssue['code'],
  issues: ProvenanceIssue[],
): Map<string, T> {
  const index = new Map<string, T>();
  nodes.forEach((node, i) => {
    const id = idOf(node);
    if (index.has(id)) {
      issues.push({
        code: duplicateCode,
        message: `duplicate ${collection} id "${id}"`,
        path: [collection, i],
      });
      return;
    }
    index.set(id, node);
  });
  return index;
}

/** Find a derivation cycle (PROV derivation is a strict partial order). */
function findDerivationCycle(
  statements: readonly ProvenanceStatement[],
): readonly string[] | undefined {
  const edges = new Map<string, string[]>();
  for (const statement of statements) {
    if (statement.relation !== 'was-derived-from') continue;
    const list = edges.get(statement.generatedEntityId) ?? [];
    list.push(statement.usedEntityId);
    edges.set(statement.generatedEntityId, list);
  }
  const ON_STACK = 1;
  const DONE = 2;
  const state = new Map<string, number>();
  const stack: string[] = [];
  const visit = (node: string): boolean => {
    const nodeState = state.get(node);
    if (nodeState === DONE) return false;
    if (nodeState === ON_STACK) return true;
    state.set(node, ON_STACK);
    stack.push(node);
    for (const next of edges.get(node) ?? []) {
      if (visit(next)) return true;
    }
    stack.pop();
    state.set(node, DONE);
    return false;
  };
  for (const node of edges.keys()) {
    stack.length = 0;
    if (visit(node)) return stack.slice();
  }
  return undefined;
}

/** Validate the reference integrity and ordering constraints of a graph. */
export function validateProvenanceGraph(graph: ProvenanceGraph): ProvenanceValidation {
  const issues: ProvenanceIssue[] = [];

  const agents = indexNodes(
    graph.agents,
    (agent) => agent.agentId,
    'agents',
    'duplicate-agent',
    issues,
  );
  const activities = indexNodes(
    graph.activities,
    (activity) => activity.activityId,
    'activities',
    'duplicate-activity',
    issues,
  );
  const entities = indexNodes(
    graph.entities,
    (entity) => entity.entityId,
    'entities',
    'duplicate-entity',
    issues,
  );

  graph.statements.forEach((statement, i) => {
    const at = (code: ProvenanceIssue['code'], what: string): void => {
      issues.push({ code, message: what, path: ['statements', i] });
    };
    switch (statement.relation) {
      case 'was-generated-by':
        if (!entities.has(statement.entityId)) {
          at('unknown-entity', `was-generated-by references dangling entity "${statement.entityId}"`);
        }
        if (!activities.has(statement.activityId)) {
          at('unknown-activity', `was-generated-by references unknown activity "${statement.activityId}"`);
        }
        break;
      case 'used':
        if (!activities.has(statement.activityId)) {
          at('unknown-activity', `used references unknown activity "${statement.activityId}"`);
        }
        if (!entities.has(statement.entityId)) {
          at('unknown-entity', `used references dangling entity "${statement.entityId}"`);
        }
        break;
      case 'was-associated-with':
        if (!activities.has(statement.activityId)) {
          at('unknown-activity', `was-associated-with references unknown activity "${statement.activityId}"`);
        }
        if (!agents.has(statement.agentId)) {
          at('unknown-agent', `was-associated-with references unknown agent "${statement.agentId}"`);
        }
        break;
      case 'was-attributed-to':
        if (!entities.has(statement.entityId)) {
          at('unknown-entity', `was-attributed-to references dangling entity "${statement.entityId}"`);
        }
        if (!agents.has(statement.agentId)) {
          at('unknown-agent', `was-attributed-to references unknown agent "${statement.agentId}"`);
        }
        break;
      case 'was-derived-from':
        if (!entities.has(statement.generatedEntityId)) {
          at('unknown-entity', `was-derived-from references dangling generated entity "${statement.generatedEntityId}"`);
        }
        if (!entities.has(statement.usedEntityId)) {
          at('unknown-entity', `was-derived-from references dangling used entity "${statement.usedEntityId}"`);
        }
        if (statement.generatedEntityId === statement.usedEntityId) {
          at('self-derivation', `was-derived-from entity "${statement.generatedEntityId}" from itself`);
        }
        if (statement.activityId !== undefined && !activities.has(statement.activityId)) {
          at('unknown-activity', `was-derived-from references unknown activity "${statement.activityId}"`);
        }
        break;
      case 'acted-on-behalf-of':
        if (!agents.has(statement.subordinateAgentId)) {
          at('unknown-agent', `acted-on-behalf-of references unknown subordinate agent "${statement.subordinateAgentId}"`);
        }
        if (!agents.has(statement.responsibleAgentId)) {
          at('unknown-agent', `acted-on-behalf-of references unknown responsible agent "${statement.responsibleAgentId}"`);
        }
        if (statement.activityId !== undefined && !activities.has(statement.activityId)) {
          at('unknown-activity', `acted-on-behalf-of references unknown activity "${statement.activityId}"`);
        }
        break;
    }
  });

  graph.activities.forEach((activity, i) => {
    if (
      activity.startedAt !== undefined &&
      activity.endedAt !== undefined &&
      activity.startedAt > activity.endedAt
    ) {
      issues.push({
        code: 'activity-time-order',
        message: `activity "${activity.activityId}" starts (${activity.startedAt}) after it ends (${activity.endedAt})`,
        path: ['activities', i],
      });
    }
  });

  const cycle = findDerivationCycle(graph.statements);
  if (cycle !== undefined) {
    issues.push({
      code: 'derivation-cycle',
      message: `derivation cycle detected: ${cycle.join(' -> ')} -> ${cycle[0]}`,
      path: ['statements'],
    });
  }

  return issues.length === 0 ? { ok: true, graph } : { ok: false, issues };
}
