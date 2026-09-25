/**
 * Presentational component: one fidelity profile (device adaptation —
 * same semantics, different fidelity). Pure function of the view model.
 */
import type { FidelityProfileViewModel } from '../contracts';

export function FidelityProfileView({ profile }: { readonly profile: FidelityProfileViewModel }) {
  return (
    <article aria-label={`Fidelity profile ${profile.level}`}>
      <h4>{profile.level}</h4>
      <dl>
        {profile.capabilityLines.map((line) => (
          <div key={line.label}>
            <dt>{line.label}</dt>
            <dd>{line.value}</dd>
          </div>
        ))}
        <div>
          <dt>Explicit reductions</dt>
          <dd>{profile.reductionCount}</dd>
        </div>
      </dl>
    </article>
  );
}
