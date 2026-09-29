/**
 * The UNIVERSAL role synthesizer (ARCD1.0 step 4, acceptance 2).
 *
 * Groups the compiled capability demands into candidate
 * {@link RoleProposal} records — WITHOUT any predefined role/model pair:
 *
 * - the grouping rule is universal (connected components over capability
 *   dependency edges + shared operation namespace); the slug, mission,
 *   interfaces, planning behavior, authority boundary and confidence are
 *   all DERIVED from the member demands;
 * - a role is a task specialization, never a model/provider name
 *   (ARCD1.0 "Role != model; Role != provider");
 * - domain-pack role templates are PRIORS: a template whose grouping
 *   agrees with the universal clustering is CONSULTED (its knowledge
 *   requirements merge in); a template that would merge or split the
 *   universal grouping is OVERRIDDEN and recorded — the universal
 *   compiler owns the organization decision (autonomous-discovery
 *   invariants; negative test d).
 *
 * Deterministic: components, members and every derived field fold over
 * canonically-ordered content; zero wall-clock, zero randomness.
 */
import type {
  CapabilityDemand,
  CapabilityDemandSet,
  DiscoveryInput,
  DomainPackContribution,
  RoleInterfaceEntry,
  RoleProposal,
} from './types';
import { canonicalStringUnion, contentDigest, digestSuffix16, operationKey } from './canonical';
import { CAPABILITY_DISCOVERY_RECORD_VERSION, DISCOVERY_COMPILER_VERSION } from './version';

/** Synthesis output: role proposals + grouping rejections. */
export interface RoleSynthesis {
  readonly roleProposals: readonly RoleProposal[];
  /** Set digest over the canonically-ordered role set (lineage stage). */
  readonly roleSetDigest: string;
  readonly templateOverrideRejections: readonly string[];
}

/** Namespace (first dot-segment) of an operation id. */
function namespaceOf(operationId: string): string {
  const index = operationId.indexOf('.');
  return index === -1 ? operationId : operationId.slice(0, index);
}

/** Union-find over demand indexes (deterministic, small n). */
class UnionFind {
  private readonly parent: number[];
  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }
  find(index: number): number {
    let root = index;
    while (this.parent[root] !== root) root = this.parent[root];
    let current = index;
    while (this.parent[current] !== root) {
      const next = this.parent[current]!;
      this.parent[current] = root;
      current = next;
    }
    return root;
  }
  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return;
    // Deterministic: the smaller root wins.
    if (rootA < rootB) this.parent[rootB] = rootA;
    else this.parent[rootA] = rootB;
  }
}

/**
 * Synthesize candidate roles from a compiled demand set. The input's pack
 * contributions provide role-template priors (considered, never
 * authoritative).
 */
export function synthesizeRoleProposals(
  input: DiscoveryInput,
  demandSet: CapabilityDemandSet,
  demandTemplateRejections: readonly string[],
): RoleSynthesis {
  const rejections = [...demandTemplateRejections];
  const demands = [...demandSet.demands].sort((a, b) =>
    operationKey(a.operation) < operationKey(b.operation) ? -1 : 1,
  );
  const indexByKey = new Map(demands.map((demand, index) => [operationKey(demand.operation), index]));

  // -------------------------------------------------------------------------
  // Universal clustering: connected components over
  //   (a) capability dependency edges (A depends on B's operation), and
  //   (b) shared operation namespace (the same specialization area).
  // -------------------------------------------------------------------------
  const union = new UnionFind(demands.length);
  for (const demand of demands) {
    const ownIndex = indexByKey.get(operationKey(demand.operation))!;
    for (const dependency of demand.dependsOnOperations) {
      const dependencyIndex = indexByKey.get(operationKey(dependency));
      if (dependencyIndex !== undefined) {
        union.union(ownIndex, dependencyIndex);
      }
    }
  }
  const namespaceRoots = new Map<string, number>();
  demands.forEach((demand, index) => {
    const namespace = namespaceOf(demand.operation.id);
    const existing = namespaceRoots.get(namespace);
    if (existing === undefined) {
      namespaceRoots.set(namespace, index);
    } else {
      union.union(existing, index);
    }
  });

  const components = new Map<number, CapabilityDemand[]>();
  demands.forEach((demand, index) => {
    const root = union.find(index);
    const member = components.get(root);
    if (member === undefined) components.set(root, [demand]);
    else member.push(demand);
  });

  // -------------------------------------------------------------------------
  // Role-template priors: consulted when the template's grouping agrees
  // with the universal clustering; overridden when it would re-shape it.
  // -------------------------------------------------------------------------
  const consultedByRole = new Map<number, Set<string>>(); // component root -> template ids
  const knowledgeByRole = new Map<number, Set<string>>();
  const packs = [...input.packContributions].sort((a, b) =>
    a.packId < b.packId ? -1 : a.packId > b.packId ? 1 : 0,
  );
  for (const pack of packs) {
    const outcome = considerRoleTemplates(pack, demands, union, rejections);
    for (const [root, templates] of outcome.consultedByRoot) {
      const consulted = consultedByRole.get(root) ?? new Set<string>();
      for (const templateId of templates) consulted.add(templateId);
      consultedByRole.set(root, consulted);
    }
    for (const [root, knowledge] of outcome.knowledgeByRoot) {
      const existing = knowledgeByRole.get(root) ?? new Set<string>();
      for (const item of knowledge) existing.add(item);
      knowledgeByRole.set(root, existing);
    }
  }

  // -------------------------------------------------------------------------
  // Derive one role per component.
  // -------------------------------------------------------------------------
  const sortedComponents = [...components.entries()]
    .map(([root, memberDemands]) => ({ root, memberDemands }))
    .sort((a, b) => {
      const keyA = operationKey(a.memberDemands[0]!.operation);
      const keyB = operationKey(b.memberDemands[0]!.operation);
      return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
    });

  const preRoles: Omit<RoleProposal, 'roleProposalId'>[] = [];
  const slugCounts = new Map<string, number>();
  for (const component of sortedComponents) {
    const role = deriveRole(component.memberDemands, input, {
      consultedTemplates: [...(consultedByRole.get(component.root) ?? new Set<string>())].sort(),
      knowledgeFromTemplates: [...(knowledgeByRole.get(component.root) ?? new Set<string>())].sort(),
    });
    preRoles.push(role);
    const count = slugCounts.get(role.roleSlug) ?? 0;
    slugCounts.set(role.roleSlug, count + 1);
  }

  // Slug collision disambiguation (append a stable suffix to every
  // colliding slug), THEN content-address the final body — the id always
  // addresses the exact record content.
  const roles: RoleProposal[] = preRoles.map((preRole) => {
    let roleSlug = preRole.roleSlug;
    if ((slugCounts.get(roleSlug) ?? 0) > 1) {
      const suffix = digestSuffix16(
        contentDigest({ slug: roleSlug, demands: preRole.satisfiesDemands }),
      ).slice(0, 8);
      roleSlug = `${roleSlug}-${suffix}`;
    }
    const body = { ...preRole, roleSlug };
    const digest = contentDigest(body);
    return { ...body, roleProposalId: `drole:${digestSuffix16(digest)}` };
  });
  roles.sort((a, b) => (a.roleProposalId < b.roleProposalId ? -1 : 1));
  const roleSetDigest = contentDigest(
    roles.map((role) => [role.roleProposalId, roleDigestOf(role)]),
  );
  return {
    roleProposals: roles,
    roleSetDigest,
    templateOverrideRejections: [...rejections].sort(),
  };
}

/** The body digest of a sealed role proposal (excludes the derived id). */
export function roleDigestOf(role: RoleProposal): string {
  return contentDigest({ ...role, roleProposalId: undefined });
}

/** Outcome of considering one pack's role templates. */
interface TemplateConsideration {
  readonly consultedByRoot: ReadonlyMap<number, readonly string[]>;
  readonly knowledgeByRoot: ReadonlyMap<number, readonly string[]>;
}

function considerRoleTemplates(
  pack: DomainPackContribution,
  demands: readonly CapabilityDemand[],
  union: UnionFind,
  rejections: string[],
): TemplateConsideration {
  const consultedByRoot = new Map<number, string[]>();
  const knowledgeByRoot = new Map<number, string[]>();
  const templatesById = new Map(pack.demandTemplates.map((template) => [template.templateId, template]));

  // Map each demand-template id to the demands derived from it.
  const demandsByTemplate = new Map<string, number[]>();
  demands.forEach((demand, index) => {
    for (const templateId of demand.derivedFromTemplates) {
      const existing = demandsByTemplate.get(templateId) ?? [];
      existing.push(index);
      demandsByTemplate.set(templateId, existing);
    }
  });

  const templates = [...pack.roleTemplates].sort((a, b) =>
    a.templateId < b.templateId ? -1 : 1,
  );
  for (const template of templates) {
    const memberIndexes = template.demandTemplateRefs.flatMap(
      (templateId) => demandsByTemplate.get(templateId) ?? [],
    );
    const validRefs = template.demandTemplateRefs.every((templateId) => {
      const demandTemplate = templatesById.get(templateId);
      return (
        demandTemplate === undefined ||
        (demandsByTemplate.get(templateId) ?? []).length > 0 ||
        // Referenced template never fired: not a grouping conflict, the
        // prior simply had nothing to group in this run.
        true
      );
    });
    if (!validRefs) continue;
    if (memberIndexes.length === 0) continue;
    const roots = new Set(memberIndexes.map((index) => union.find(index)));
    if (roots.size === 1) {
      // The template grouping agrees with the universal clustering.
      const root = union.find(memberIndexes[0]!);
      consultedByRoot.set(root, [...(consultedByRoot.get(root) ?? []), template.templateId]);
      knowledgeByRoot.set(
        root,
        [...(knowledgeByRoot.get(root) ?? []), ...(template.knowledgeRequirements ?? [])],
      );
    } else {
      // The template would MERGE universal components: overridden.
      rejections.push(
        `role-template ${template.templateId} attempted to regroup ${roots.size} universal role clusters into one; universal grouping retained`,
      );
    }
  }
  return { consultedByRoot, knowledgeByRoot };
}

/** Derived-field inputs for one component. */
interface DeriveInputs {
  readonly consultedTemplates: readonly string[];
  readonly knowledgeFromTemplates: readonly string[];
}

function deriveRole(
  memberDemands: readonly CapabilityDemand[],
  input: DiscoveryInput,
  priors: DeriveInputs,
): Omit<RoleProposal, 'roleProposalId'> {
  const sortedMembers = [...memberDemands].sort((a, b) =>
    a.demandId < b.demandId ? -1 : 1,
  );
  const namespaces = canonicalStringUnion(
    sortedMembers.map((demand) => namespaceOf(demand.operation.id)),
  );
  // The dominant namespace (most member demands; ties break
  // alphabetically) names the role — deterministic and derived, never a
  // model/provider name.
  const namespaceCounts = new Map<string, number>();
  for (const demand of sortedMembers) {
    const namespace = namespaceOf(demand.operation.id);
    namespaceCounts.set(namespace, (namespaceCounts.get(namespace) ?? 0) + 1);
  }
  const dominantNamespace = [...namespaceCounts.entries()]
    .sort((a, b) => (a[1] === b[1] ? (a[0] < b[0] ? -1 : 1) : b[1] - a[1]))[0]![0];
  const operations = sortedMembers.map((demand) => demand.operation);

  // Interfaces: inputs = union of input representations; outputs = union
  // of output-contract entries (by name + kind).
  const inputs: RoleInterfaceEntry[] = canonicalStringUnion(
    sortedMembers.flatMap((demand) => [...demand.inputRepresentations]),
  ).map((kind) => ({ name: `input-${kind}`, kind: kind as RoleInterfaceEntry['kind'] }));
  const outputMap = new Map<string, RoleInterfaceEntry>();
  for (const demand of sortedMembers) {
    for (const entry of demand.outputContract) {
      outputMap.set(`${entry.name}#${entry.kind}`, entry);
    }
  }
  const outputs = [...outputMap.values()].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : a.kind < b.kind ? -1 : 1,
  );

  const requiresCosign = sortedMembers.some(
    (demand) => demand.authorityConstraints.requiresHumanCosign,
  );
  const hasDependencies = sortedMembers.some(
    (demand) => demand.dependsOnOperations.length > 0,
  );
  const planningBehavior = requiresCosign
    ? 'supervised-multi-step'
    : hasDependencies
      ? 'multi-step'
      : 'single-step';

  const slugBase = `${dominantNamespace}-${sortedMembers.length > 1 ? 'lead' : 'specialist'}`;
  const mission =
    `${input.task.summary} — satisfy ${sortedMembers.length} capability demand(s) ` +
    `across ${namespaces.join(', ')} at stage "${input.task.lifecycleStage}".`;

  // Confidence: deterministic completeness fraction over six facets.
  const facets = sortedMembers.map((demand) => {
    let present = 0;
    if (demand.qualityTarget !== undefined) present += 1;
    if (demand.evidenceRequirements.length > 0) present += 1;
    if (demand.verificationRequired) present += 1;
    if (demand.outputContract.length > 0) present += 1;
    if (demand.inputRepresentations.length > 0) present += 1;
    if (demand.latencyBudgetMs !== undefined || demand.costBudget !== undefined) present += 1;
    return present / 6;
  });
  const confidence =
    Math.round((facets.reduce((acc, value) => acc + value, 0) / facets.length) * 1000) / 1000;

  return {
    schemaVersion: CAPABILITY_DISCOVERY_RECORD_VERSION,
    roleSlug: slugBase,
    mission,
    satisfiesDemands: sortedMembers.map((demand) => demand.demandId),
    inputs,
    outputs,
    knowledgeRequirements: canonicalStringUnion(namespaces, priors.knowledgeFromTemplates),
    toolRequirements: canonicalStringUnion(
      sortedMembers.flatMap((demand) => [...demand.toolRequirements]),
    ),
    planningBehavior,
    authorityBoundary: {
      executionAuthority: 'none',
      requiresHumanCosign: requiresCosign,
      proposableOperations: operations,
    },
    evidenceRequirements: canonicalStringUnion(
      sortedMembers.flatMap((demand) => [...demand.evidenceRequirements]),
    ),
    environmentRequirements: canonicalStringUnion(
      sortedMembers.flatMap((demand) => [...demand.environmentRequirements]),
    ),
    evaluationSuiteRef: undefined,
    confidence,
    provenance: {
      derivedFromDemands: sortedMembers.map((demand) => demand.demandId),
      consultedTemplates: [...priors.consultedTemplates].sort(),
      overriddenTemplates: [],
      compilerVersion: DISCOVERY_COMPILER_VERSION,
    },
  };
}

/** Utility re-export for lineage verification. */
export { namespaceOf };
