import { referenceShell } from '../../../src/shell/bootstrap';
import { NavigatorStageRoute, stageMetadata } from '../../../src/shell/route-surfaces';

export const metadata = stageMetadata('plan');

/** The 'plan' navigator stage route: the shell frame with empty mounted surfaces. */
export default function Page() {
  return <NavigatorStageRoute shell={referenceShell} stage="plan" />;
}
