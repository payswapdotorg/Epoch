/**
 * The public surface of the W015 agents feature module: feature
 * contracts, runtime guards, view-model builders, and presentational
 * components. The module stands alone inside `apps/web` — see
 * `contracts.ts` for the structural-projection discipline and the
 * integration path.
 */
export * from './contracts';
export * from './guards';
export * from './view-models';
export {
  AgentCollaborationPanel,
  ControlPanel,
  IntentFeed,
  MomentCardView,
  PresenceRoster,
  TimelineBar,
} from './components/AgentCollaborationPanel';
