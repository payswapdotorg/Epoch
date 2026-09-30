import { StageRoute } from '../../../src/product/stage-route';

export const metadata = { title: 'Plan — Epoch' };

/** The 'plan' navigator stage route. */
export default function Page() {
  return <StageRoute stage="plan" />;
}
