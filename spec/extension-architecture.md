# Epoch Extension Architecture

## Extension surfaces
1. Declarative: manifest, schemas, ontology, metadata, constraints.
2. UI/visual: TypeScript/React.
3. Portable compute: WebAssembly Component Model/WIT.
4. Remote capability: HTTP/gRPC/MCP/custom service.

## Extension can contribute
world types, mappings, reconstructions, visualizations, animations, interactions, agents, constraints, simulators, evaluators, verification methods, workflows, connectors, UI.

## Manifest
Every extension declares:
- id/version/API compatibility;
- capabilities;
- dependencies;
- requested permissions;
- input/output types;
- side effects;
- trust class;
- license;
- pricing/entitlements;
- data handling.

## Trust
T0 untrusted/read-only
T1 provisional model population
T2 validated simulation/evaluation
T3 trusted reversible execution
T4 certified controlled autonomy

Document-derived extensions begin provisional and cannot certify or execute.

## Security
Public extensions never receive unrestricted host access. Capability grants are tenant-scoped and evaluated by policy. Heavy/untrusted work runs isolated.

## Marketplace
Supports free, one-time, subscription, seat/workspace, usage, hybrid, enterprise/private.

Payment processor state is not entitlement authority. Entitlement revocation is immediate at the Epoch capability boundary.

## Provider neutrality
MCP, vendor APIs, local CLI, remote service, Wasm and native adapters all implement the same capability contracts.
