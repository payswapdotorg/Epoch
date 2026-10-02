# Epoch Renderer Fabric Architecture

## Role

The Renderer Fabric is the concrete presentation boundary between Epoch's canonical World Experience projection and replaceable rendering foundations.

It is not a semantic layer.

## Required contract concepts

W056 must freeze provider-neutral equivalents of:

- RendererDescriptor
- RendererCapabilitySet
- RendererSession
- RendererSessionSnapshot
- RendererSwitchRequest
- RendererFrameEnvelope
- RendererInputEnvelope
- RendererIntentReceipt
- RendererFailure
- RendererHealth
- RendererAssetBinding
- RendererConformanceResult

Exact TypeScript names remain W056's implementation decision; authority and portability rules do not.

## Lifecycle

```
resolve capability
 -> probe compatibility
 -> create session
 -> mount canonical scene
 -> render/update
 -> translate input
 -> emit canonical intent
 -> receive canonical projection updates
 -> capture/dispose/switch
```

## Epoch -> renderer

Translate canonical scene/view state into:

- entity nodes/meshes;
- semantic transforms;
- materials and state overlays;
- animations;
- agent representations;
- timeline position;
- device/fidelity budgets;
- evidence overlays.

## Renderer -> Epoch

Translate:

- hit-test -> semantic entity ID;
- gizmo/edit -> canonical intent;
- measurement -> canonical intent/record through existing authority;
- annotation -> canonical record;
- renderer failure -> typed renderer failure;
- frame/evidence capture -> existing Verification/Evidence path.

Camera interpolation and GPU/resource state remain presentation-only unless represented by existing Epoch contracts.

## Switching invariant

```
save canonical session snapshot
 -> resolve target renderer
 -> verify digest/tenant compatibility
 -> mount target from canonical projection
 -> restore portable focus/layers/timeline
 -> emit switch receipt
 -> dispose previous session
```

The switch itself must not create durable semantic state.

## Conformance

A shared fixture must prove:

- same tenant;
- same world digest;
- same semantic entity IDs;
- equivalent supported interaction outcomes;
- same semantic focus/layers;
- equivalent normalized intents;
- renderer-specific differences confined to presentation.

## Renderer classes

- Embedded: Three.js, Babylon.js.
- Sidecar: Blender.
- Native engine candidate: Godot, O3DE.
- Specialized: FreeCAD, ParaView, CesiumJS.
- Import/interchange: Assimp, glTF, OpenUSD.

## UX invariant

Epoch owns the chrome, tools, selection, layers, agent UI, timeline, renderer selector, health state and fallback messaging. Third-party editor UI is never required for the core workflow.

## Security

Adapters use least privilege. External engines receive typed inputs and scoped assets only. No adapter gets direct durable-state authority. Untrusted assets remain untrusted until validation.

## Performance

Every renderer reports its scene, GPU, memory, texture and interaction budgets plus explicit fidelity reductions. A renderer may reduce presentation fidelity but may not silently alter semantics.

## Testing

Required batteries:

- contract/conformance;
- semantic picking;
- interaction-intent normalization;
- renderer switching;
- fallback/degradation;
- cold start;
- relaunch;
- visual smoke;
- browser/desktop E2E;
- digest continuity.

A unit suite without a real renderer surface does not close a renderer Work Order.
