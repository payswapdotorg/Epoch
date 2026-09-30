import { StageRoute } from '../../../src/product/stage-route';

export const metadata = { title: 'Forecast — Epoch' };

/** The 'forecast' navigator stage route. */
export default function Page() {
  return <StageRoute stage="forecast" />;
}
