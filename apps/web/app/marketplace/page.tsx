import { StageRoute } from '../../src/product/stage-route';

export const metadata = { title: 'Marketplace — Epoch' };

/** The 'marketplace' navigator stage route. */
export default function Page() {
  return <StageRoute stage="marketplace" />;
}
