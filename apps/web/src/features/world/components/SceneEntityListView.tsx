/**
 * Presentational component: the scene entity list (focus/visibility/
 * isolation view state per entity). Pure function of the view models.
 */
import type { SceneEntityRowViewModel } from '../contracts';

export function SceneEntityListView({ rows }: { readonly rows: readonly SceneEntityRowViewModel[] }) {
  if (rows.length === 0) {
    return <p role="status">No entities in this scene view.</p>;
  }
  return (
    <table aria-label="Scene entities">
      <thead>
        <tr>
          <th scope="col">Entity</th>
          <th scope="col">Type</th>
          <th scope="col">Placement</th>
          <th scope="col">View state</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.entityId}>
            <td>
              {row.label} <code aria-hidden="true">·</code> <code>{row.entityId}</code>
            </td>
            <td>{row.entityType}</td>
            <td>{row.positionLabel}</td>
            <td>
              {row.focused ? <span>focused </span> : null}
              {row.isolated ? <span>isolated </span> : null}
              <span>{row.visible ? 'visible' : 'hidden'}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
