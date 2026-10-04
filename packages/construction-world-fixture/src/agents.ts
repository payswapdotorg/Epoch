/**
 * @epoch/construction-world-fixture — the spatial construction agents
 * (W071, ACR-012 §6 — ≥2 agents with spatial positions, tasks, current-
 * work entity references, and deterministic movement scripts).
 *
 * The agents REUSE the existing W016 agent-presence infrastructure
 * (ProjectedAgentRef) — the agent IDs are surfaced in the WorldScene's
 * `agents[]` array. The fixture-local ConstructionAgent record carries
 * the spatial position, current-work entity ref, task description and
 * movement script the host renders as the agent-presence projection.
 */
import type { ConstructionAgent } from './types';
import { AGENT_IDS, ENTITY_IDS } from './version';

/** The two construction-solution spatial agents (ACR-012 §6). */
export const AGENTS: readonly ConstructionAgent[] = [
  {
    agentId: AGENT_IDS.structuralEngineer,
    label: 'A. Reyes — Structural Engineer',
    role: 'Structural Engineer',
    position: [4, 0.0, -3],
    currentWorkEntityId: ENTITY_IDS.column04,
    task: 'Inspecting column COL-04 (SE) rebar fixings before concrete pour.',
    movementScript: [
      { atMs: 0, position: [-4, 0, -3] }, // start at COL-01 (NW)
      { atMs: 2000, position: [4, 0, -3] }, // move to COL-02 (NE)
      { atMs: 4000, position: [4, 0, 3] }, // move to COL-04 (SE)
      { atMs: 6000, position: [-4, 0, 3] }, // move to COL-03 (SW)
      { atMs: 8000, position: [0, 0, 0] }, // center for beam placement
    ],
  },
  {
    agentId: AGENT_IDS.siteCoordinator,
    label: 'M. Okafor — Site Coordinator',
    role: 'Site Coordinator',
    position: [-15, 0, -8],
    currentWorkEntityId: ENTITY_IDS.siteStaging,
    task: 'Coordinating staging yard deliveries and access gate scheduling.',
    movementScript: [
      { atMs: 0, position: [-15, 0, -8] }, // staging yard
      { atMs: 2000, position: [0, 0, -6] }, // access gate
      { atMs: 4000, position: [-15, 0, -8] }, // back to staging
      { atMs: 6000, position: [0, 0, 0] }, // slab pour supervision
      { atMs: 8000, position: [0, 0, -6] }, // back to access gate
    ],
  },
];
