import { referenceShell } from '../src/shell/bootstrap';
import { HomeRouteSurface, homeMetadata } from '../src/shell/route-surfaces';

export const metadata = homeMetadata();

/**
 * The home route: the shell frame's content region with EMPTY mounted
 * surfaces (the three Experience slots and the content-region feature
 * mounts) plus the navigator overview.
 */
export default function Page() {
  return <HomeRouteSurface shell={referenceShell} />;
}
