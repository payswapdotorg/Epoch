# ACR-004 — Autonomous Engineering Role & Capability Discovery

## Status

APPROVED
Approved by product/architecture authority: 2026-09-27
Effective architecture version: pending the next explicit architecture lock transition

## Intent

Make autonomous role formation, capability-gap discovery, model/substrate discovery and organization construction a first-class Epoch capability.

TradRL demonstrates the target pattern for an adaptive organization compiler: infer missing capability from evidence, synthesize candidate specializations, search bodies/substrates, test compatibility, evaluate organizations and retain reproducible evidence. Epoch must generalize this from trading to all engineering domain packs.

## Architectural decision

Epoch shall add a universal **Role & Capability Discovery Plane** above the Capability Registry and Agent Protocol.

The plane:

1. reconstructs the task-sufficient problem;
2. detects missing capabilities or role coverage;
3. compiles provider-neutral CapabilityDemand records;
4. synthesizes candidate RoleProposals;
5. resolves existing agents, humans, skills, extensions and model substrates;
6. evaluates candidate organizations under the task's constraints;
7. selects or stages an organization without assuming predefined role/model pairs;
8. records gaps for external capability discovery and learning.

## Agent role semantics

A role is a task specialization defined by mission, capability demands, interfaces, authority, evidence and evaluation requirements.

Role != model.
Role != provider.
Role != human profession qualification.

A model is one possible cognitive substrate for an agent performing a role. A human or specialist service may also satisfy the role.

## Domain pack integration

Every domain pack may provide reusable:
- role templates;
- capability-demand templates;
- task-to-demand signals;
- evaluation suites;
- evidence methods.

The compiler remains universal and may recompose these templates.

This makes role discovery portable across construction, software, mechanical, electrical, infrastructure and future domains.

## External model/capability discovery

Epoch shall support a scheduled, provider-neutral discovery workflow.

Recommended weekly default:

`Scheduler → source adapters → candidate ingestion → sandbox/profile → capability mapping → evaluation → registry proposal → role/organization availability`

Initial source classes may include:
- public model registries/model cards;
- public code repositories/releases;
- academic papers and project pages;
- domain-specific engineering software catalogs;
- internal project/outcome gaps;
- tenant-authorized private catalogs.

Named providers are adapters, not kernel dependencies.

## Two separate discovery streams

### A. Problem-driven discovery

Triggered by a concrete unresolved need:

`task evidence → capability gap → search known capabilities → search new external candidates → evaluate`

### B. Ecosystem-driven discovery

Triggered by a schedule:

`known gaps + weak capabilities + new source artifacts → candidate scan → evaluate → register/notify`

The streams share the same capability contribution and evaluation machinery.

## What weekly discovery may do automatically

Subject to deployment/tenant policy, it may:
- collect public metadata;
- detect new model/repository versions;
- deduplicate candidates;
- classify likely capability contributions;
- create sandbox evaluation jobs;
- benchmark candidates;
- update capability intelligence;
- create capability-gap/candidate records;
- propose new adapters, skills or domain packs;
- notify or queue human review for consequential changes.

## What it must not do blindly

It must not:
- execute untrusted downloaded code in the main Epoch trust domain;
- promote an unverified model to consequential workflows;
- infer professional qualifications from labels or benchmarks;
- change authoritative world/solution/delivery state solely from external claims;
- bypass tenant authorization, constraints or verification;
- install arbitrary software or grant credentials without policy.

## Model-to-role resolution

A model is selected because its measured capabilities satisfy the role's demands under the task's constraints.

Example:

`Structural assessment demand`
→ candidate structural-analysis role
→ candidate simulation/geometry/reasoning capabilities
→ candidate models/substrates
→ evaluation
→ possession/assignment
→ organization evaluation

The model name is not part of the semantic role identity.

## Existing-model improvement

Weekly discovery should not only search for new models.

It should also:
- test replacements against existing capabilities;
- detect regressions or degraded candidates;
- identify cheaper/faster equivalent candidates;
- identify capabilities currently supplied by weak adapters;
- discover complementary models that fill existing gaps;
- detect recurrent failures that suggest a missing role or domain capability.

## New domain pack discovery

Epoch may detect clusters of recurring tasks/capability gaps that are not adequately expressed by current packs and create a **DomainPackProposal**.

The proposal should include evidence, task examples, missing semantics, world-model bindings, capabilities, evaluation/verification needs and a proposed user-facing projection.

The proposal is not automatically activated merely because a model was discovered.

## Relationship to existing architecture

ACR-004 is compatible with ACR-001/002/003.

It adds no lifecycle authority:
- World Model remains semantic world authority.
- SolutionPackage/SolutionVersion remain solution baseline authority.
- DeliveryRecord remains delivery-state authority.
- Constraint Engine remains constraint authority.
- Verification remains proof authority.
- Action Gateway remains execution authority.
- Capability Registry remains capability identity/contract authority.
- Experience/Solution Navigator remain projections.

## Implementation entry point

W045 implements the Role & Capability Discovery Plane and the scheduled discovery workflow. It must build on the existing Capability Registry, Adapter SDK, Agent Protocol, Constraint/Evidence/Verification surfaces and the universal domain-pack contract.

No domain-specific organization compiler may be created as a substitute for W045.
