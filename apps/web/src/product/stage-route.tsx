'use client';
/**
 * @epoch/web — the stage route switch (W047).
 *
 * Renders the product surface of one Solution Navigator stage. Pages are
 * thin App Router segments delegating here; the stage surfaces are client
 * components exercising Gateway operations through the session context.
 */
import type { ReactNode } from 'react';
import { EntryGate } from './app-root';
import { UnderstandStage } from './stages/understand';
import { DecideStage } from './stages/decide';
import { AcquireStage, PlanStage } from './stages/plan-acquire';
import { CloseStage, ForecastStage, LearnStage, ObserveStage, RealizeStage, VerifyStage } from './stages/realize';
import { DevelopersStage, MarketplaceStage } from './marketplace';

export type StageRoute =
  | 'understand'
  | 'decide'
  | 'plan'
  | 'acquire'
  | 'realize'
  | 'observe'
  | 'verify'
  | 'forecast'
  | 'close'
  | 'learn'
  | 'marketplace'
  | 'developers';

/** Render the stage surface behind the entry gate. */
export function StageRoute({ stage }: { readonly stage: StageRoute }): ReactNode {
  return <EntryGate>{surfaceOf(stage)}</EntryGate>;
}

function surfaceOf(stage: StageRoute): ReactNode {
  switch (stage) {
    case 'understand':
      return <UnderstandStage />;
    case 'decide':
      return <DecideStage />;
    case 'plan':
      return <PlanStage />;
    case 'acquire':
      return <AcquireStage />;
    case 'realize':
      return <RealizeStage />;
    case 'observe':
      return <ObserveStage />;
    case 'verify':
      return <VerifyStage />;
    case 'forecast':
      return <ForecastStage />;
    case 'close':
      return <CloseStage />;
    case 'learn':
      return <LearnStage />;
    case 'marketplace':
      return <MarketplaceStage />;
    case 'developers':
      return <DevelopersStage />;
  }
}
