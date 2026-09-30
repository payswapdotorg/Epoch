import { StageRoute } from '../../../src/product/stage-route';

export const metadata = { title: 'Verify — Epoch' };

/** The 'verify' navigator stage route. */
export default function Page() {
  return <StageRoute stage="verify" />;
}
