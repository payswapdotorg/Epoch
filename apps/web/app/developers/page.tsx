import { StageRoute } from '../../src/product/stage-route';

export const metadata = { title: 'Developers — Epoch' };

/** The 'developers' navigator stage route. */
export default function Page() {
  return <StageRoute stage="developers" />;
}
