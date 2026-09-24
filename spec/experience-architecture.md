# Epoch Experience Architecture X1.0

## Goal
The UI is a projection of the same world used by humans and agents. It is not a second authority.

## Experience Graph
An Experience Graph contains:
- scene/view definitions;
- focused entities;
- visual overlays;
- animation instructions;
- narrative/status blocks;
- interaction intents;
- timeline/replay position;
- presence;
- evidence references;
- candidate/action controls.

## Universal interactions
select, inspect, measure, move, rotate, zoom, isolate, hide, show, compare, annotate, simulate, change, connect, disconnect, filter, query, branch, approve, reject, execute, replay, pause, resume, follow-agent, take-control, release-control.

## Engineering Moment
A shareable/replayable collaboration unit:
world snapshot + agent state + human state + visual state + timeline position + evidence + scenario + available actions.

## Agent gameplay
Every material agent action becomes an event. Experience Runtime can:
- follow the agent camera/cursor;
- animate world effects;
- expose status/tool outputs;
- pause/resume;
- let humans take control;
- replay and branch.

## Dynamic UI
Agents emit typed Experience Intents, never arbitrary executable UI code. The Experience Compiler maps those intents to safe platform UI.

## Domain visual ontology
Packs/extensions contribute semantic visualizations:
- 2D symbols;
- 3D representations;
- materials/textures;
- state overlays;
- animations;
- interaction affordances.

## Rendering
Initial path: Three.js/R3F, WebGPU with WebGL2 fallback. Renderer abstraction permits other local/remote renderers.

## Device adaptation
Same semantics, different fidelity:
desktop = full;
web/laptop = normal;
mobile = field;
low capability = 2D/reduced 3D;
remote rendering = optional.
