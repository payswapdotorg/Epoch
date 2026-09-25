/**
 * Presentational component: one typed world-experience error notice
 * (code, message, and the typed detail line). Pure function of the view
 * model.
 */
import type { WorldErrorNoticeViewModel } from '../contracts';

export function WorldErrorNotice({ notice }: { readonly notice: WorldErrorNoticeViewModel }) {
  return (
    <aside role="alert" aria-label={`World error ${notice.code}`}>
      <h4>
        <code>{notice.title}</code>
      </h4>
      <p>{notice.message}</p>
      {notice.detailLabel !== null ? <p>{notice.detailLabel}</p> : null}
    </aside>
  );
}
