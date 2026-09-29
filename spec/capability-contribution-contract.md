# Epoch Capability Contribution Contract CC1.0

## Purpose

Define the universal contribution boundary through which a new model, solver, tool, dataset service or other computational system can make itself usable by Epoch without requiring provider-specific kernel changes.

## Contribution stages

`Describe → Admit → Sandbox → Profile → Evaluate → Register → Resolve → Learn`

A contribution may be:
- an existing model;
- a new model version;
- a solver/algorithm;
- a geometry or visualization engine;
- an external engineering application;
- a dataset/evidence source;
- a composite capability made from other capabilities.

## Capability contribution descriptor

A contribution should declare:

- contribution id/version;
- capability category/categories;
- operations;
- input/output schemas;
- modalities and formats;
- units/coordinate systems where relevant;
- quality/fidelity characteristics;
- uncertainty/error characteristics;
- environment/runtime requirements;
- hardware requirements;
- cost/latency characteristics;
- reproducibility/version pinning;
- dependencies;
- license/dependency metadata;
- data retention/egress behavior;
- security/isolation requirements;
- evidence produced;
- benchmark/evaluation entry points;
- fallback/degraded modes.

The descriptor is provider-neutral at the semantic boundary. Provider identity remains metadata owned by the adapter/registry.

## Composite contributions

A contribution can expose a capability graph rather than one operation.

For example:

`image → segmentation → depth → geometry → scene assembly`

Each stage can be represented as a capability with explicit dependencies, intermediate artifacts and evidence.

Epoch can therefore use a multi-stage model such as a scene reconstruction pipeline without treating the entire external project as an opaque monolith.

## Contract adaptation

A source that does not natively match an Epoch contract may be wrapped by an adapter that:

- translates requests;
- maps types;
- manages provider-native state;
- invokes required sub-stages;
- normalizes outputs;
- attaches provenance and evidence;
- reports failures and degraded conditions.

The adapter must not silently invent semantics that the provider cannot support.

## Evaluation status

A contribution is not trusted merely because its descriptor exists.

Recommended lifecycle:

- `DISCOVERED`
- `INGESTED`
- `SANDBOXED`
- `PROFILED`
- `EVALUATED`
- `VERIFIED`
- `DEPRECATED`
- `RETIRED`

Only policy-approved states may be resolved into consequential workflows.

## Capability discovery

A verified contribution becomes visible to the Capability Registry and role/capability compiler with:

- its capability contracts;
- applicability conditions;
- evidence/benchmark lineage;
- known limitations;
- resource profile;
- provenance.

The compiler may then discover it when solving a task. It must not require a hard-coded model name.

## Domain contribution

A contribution may support an existing domain pack or reveal the need for a new domain pack.

A candidate new pack should be represented as a proposal with:
- unmet recurring capability demands;
- example task clusters;
- required vocabulary;
- World Model bindings;
- capability dependencies;
- evaluation/verification requirements;
- UX projections;
- migration/compatibility implications.

Activation of a new domain pack remains subject to Epoch domain-pack governance.

## Reproducibility

Every accepted contribution retains exact source/version/revision, adapter version, manifest digest, evaluation evidence, environment and dependency information.

## Security

External code and model artifacts are treated as untrusted until sandboxing and policy checks pass. Discovery may inspect metadata without executing untrusted artifacts.

No discovery mechanism may grant itself access to customer secrets, credentials or authoritative state.

## Provider neutrality

The kernel identifies capabilities and contracts. Adapter metadata identifies the concrete provider/model/project. Replacing a provider must not change the universal lifecycle or agent-role semantics.
