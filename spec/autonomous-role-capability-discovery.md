# Epoch Autonomous Role & Capability Discovery ARCD1.0

## Purpose

Epoch must be able to infer what kinds of agents and capabilities a problem requires instead of assuming that every engineering role, model or provider was predefined.

The governing sequence is:

`Problem evidence → capability demands → role proposals → candidate agents/capabilities → evaluation → approved organization`

A role is an executable specialization description. It is not a profession claim about a person or a model.

## Discovery loop

1. **Observe / reconstruct** the task-sufficient world.
2. **Detect decision or delivery gaps** from constraints, evidence, failed attempts, unresolved unknowns, verification requirements, work packages and outcomes.
3. **Compile capability demands** describing what must be done, what inputs/outputs are required, quality/fidelity, uncertainty, evidence, tools, latency/cost and authority.
4. **Synthesize role proposals** that group related capability demands into coherent missions with explicit interfaces and authority boundaries.
5. **Resolve candidates** from:
   - existing Agent registrations;
   - reusable skills/extensions;
   - human roles;
   - domain-pack role templates;
   - capability implementations;
   - model/cognitive-substrate candidates.
6. **Check compatibility** with modalities, tools, context, runtime, cost, latency, environment and authority.
7. **Construct candidate organizations** with roles, communication topology, delegation, handoffs, redundancy and supervision.
8. **Evaluate candidates** against constraints, simulation/evaluation tasks and verification requirements.
9. **Select or stage** the best admissible organization for the task according to declared objective/constraint criteria.
10. **Record rejected candidates and evidence** so the decision is reproducible and learnable.

## Never infer profession from model label

A model's repository tags, name, benchmark claims or marketing description are not sufficient evidence that it is an engineer, surveyor, mathematician, architect or other professional role.

The correct chain is:

`model → measured capabilities → compatible role candidate → evaluated possession/use`

not:

`model → profession`

Human agents may also satisfy a role. The role is a task specialization, not a qualification decision.

## Canonical capability demand

A CapabilityDemand should describe at least:

- required operation or outcome;
- input representations/modalities;
- output contract;
- quality/fidelity target;
- relevant units/coordinate systems when applicable;
- acceptable uncertainty/confidence;
- evidence/verification requirements;
- tool requirements;
- environment requirements;
- latency budget;
- cost budget;
- safety/authority constraints;
- dependencies on other capabilities;
- domain/lifecycle stage;
- affected world/solution/work identities.

A demand is provider-neutral.

## Canonical role proposal

A RoleProposal should describe:

- stable candidate role id/name;
- mission;
- capability demands it satisfies;
- required inputs/outputs and handoff contracts;
- knowledge/tool requirements;
- planning/delegation behavior;
- authority boundary;
- evidence requirements;
- evaluation suite;
- environment/fidelity requirements;
- candidate Agent registrations or substrate bindings;
- unresolved capability gaps;
- confidence and provenance.

A role proposal can be synthesized for a single task without immediately becoming a globally reusable role.

## Domain packs

A domain pack may provide:

- role templates;
- capability-demand templates;
- task signals that frequently imply certain demands;
- domain evaluation suites;
- terminology and visualization.

These are priors and reusable templates, not mandatory role assignments.

Example:

Construction may expose templates for:
- site/condition reconstruction;
- structural analysis;
- quantity/cost derivation;
- scheduling;
- procurement;
- inspection/verification.

The system may combine, split or ignore those templates when the evidence indicates a different organization.

## Agent and model resolution

Epoch must resolve role demands against capabilities rather than hard-coded provider/model pairings.

For an AI candidate:

`RoleProposal + CapabilityDemandSet → Agent capability requirements → Capability Registry resolution → model/provider candidate → compatibility/evaluation`

For a human candidate:

`RoleProposal → authorized human capability declaration → tool/environment requirements → assignment`

For an external specialist service:

`RoleProposal → provider-neutral capability → adapter/capability resolution → evaluation`

All three can coexist in one organization.

## Capability gap states

A missing capability should become an explicit record, for example:

- `UNSATISFIED` — no known candidate meets the demand;
- `CANDIDATE_FOUND` — candidate exists but is not yet evaluated;
- `EVALUATED` — evidence exists but acceptance policy is not met;
- `VERIFIED` — candidate may be used under its recorded conditions;
- `DEGRADED` — usable with explicit reduced-fidelity constraints;
- `REQUIRES_HUMAN` — current automation is insufficient.

Capability gaps should be visible to the user and feed discovery of new models, adapters, extensions and domain packs.

## Organization evaluation

Candidate organizations are evaluated as organizations, not merely as a bag of model scores.

Evaluation may consider:
- objective satisfaction;
- hard/soft constraints;
- evidence coverage;
- communication/handoff quality;
- redundancy and single-point-of-failure risk;
- latency;
- compute/resource cost;
- robustness to candidate substitution;
- simulation/evaluation outcomes;
- verification readiness.

The evaluator records the candidate organization, assumptions, scenario/configuration, outcomes and rejected alternatives.

## Safety and authority

Discovery never grants execution authority.

The Action Gateway, authorization policy and verification systems remain authoritative. A discovered role may propose, inspect, monitor or request approval, but consequential execution remains outside model prompts.

## Reproducibility

Every discovery run retains:
- source problem/solution/delivery revision;
- capability demands;
- role proposals;
- candidate capabilities/agents/substrates;
- versions and manifests;
- evaluation suites and configuration;
- evidence;
- cost/latency observations;
- rejected candidates and reasons;
- final selected/staged organization.

Historical discovery decisions are immutable.

## Relationship to Capability Foundation Discovery

External model scanning is one input into this compiler. A newly discovered model does not automatically become an agent role.

The full path is:

`External source → candidate capability/substrate → sandbox/ingestion → evaluation → registry → role resolution → organization evaluation`

## Relationship to Domain Packs

The mechanism is universal. Domain packs contribute reusable domain knowledge and priors, while the compiler remains responsible for constructing the task-specific role set.

This lets the same engine support construction, software, mechanical, electrical, infrastructure and future packs without hard-coding a different organization compiler per domain.
