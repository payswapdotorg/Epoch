/**
 * Presentational component: the camera status (mode, viewpoint or the
 * followed agent + cursor). Pure function of the view model.
 */
import type { CameraStatusViewModel } from '../contracts';

export function CameraStatusView({ camera }: { readonly camera: CameraStatusViewModel }) {
  return (
    <dl aria-label="Camera status">
      <div>
        <dt>Mode</dt>
        <dd>{camera.mode}</dd>
      </div>
      <div>
        <dt>Detail</dt>
        <dd>{camera.detailLabel}</dd>
      </div>
      {camera.cursorLabel !== null ? (
        <div>
          <dt>Agent cursor</dt>
          <dd>{camera.cursorLabel}</dd>
        </div>
      ) : null}
    </dl>
  );
}
