/**
 * Presentational components for the AI Collaboration UX feature module.
 * Pure rendering of the typed view models — no data fetching, no side
 * effects, no styling dependencies (the app shell owns the design
 * system; this module renders semantic markup only).
 */
import type { ReactNode } from 'react';
import type {
  AgentCollaborationViewModel,
  BranchRow,
  DenialRow,
  FeedRow,
  MomentCard,
  PresenceRow,
} from '../view-models';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

/** The presence roster: peers, presence states, focus, control. */
export function PresenceRoster({ rows }: { rows: readonly PresenceRow[] }) {
  if (rows.length === 0) {
    return (
      <Section title="Participants">
        <p>No active participants.</p>
      </Section>
    );
  }
  return (
    <Section title="Participants">
      <ul>
        {rows.map((row) => (
          <li key={row.key} data-presence={row.presence}>
            <strong>{row.label}</strong>
            <span> ({row.participantKind})</span>
            {row.agentId !== undefined ? <span> · agent {row.agentId}</span> : null}
            <span> · {row.presence}</span>
            {row.holdsControl ? <span> · holds control</span> : null}
            {row.focusLabel !== undefined ? <span> · focusing {row.focusLabel}</span> : null}
            {row.followsAgentId !== undefined ? (
              <span> · follows {row.followsAgentId}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** The control state: current controller plus recorded denials. */
export function ControlPanel({
  controllerLabel,
  denials,
}: {
  controllerLabel: string | null;
  denials: readonly DenialRow[];
}) {
  return (
    <Section title="Control">
      <p>
        <span>Controller: </span>
        <strong data-has-control={controllerLabel !== null}>
          {controllerLabel ?? 'unassigned'}
        </strong>
      </p>
      {denials.length > 0 ? (
        <details>
          <summary>{denials.length} recorded takeover denial(s)</summary>
          <ul>
            {denials.map((denial) => (
              <li key={denial.key}>
                <span>{denial.actorLabel}</span>
                <span> — {denial.reason}</span>
                <span> (claimed: {denial.claimedAuthorityLabel})</span>
              </li>
            ))}
          </ul>
        </details>
      ) : (
        <p>No takeover denials recorded.</p>
      )}
    </Section>
  );
}

/** The timeline: playback state, position, branch points. */
export function TimelineBar({
  playback,
  positionLabel,
  branches,
}: {
  playback: string;
  positionLabel: string;
  branches: readonly BranchRow[];
}) {
  return (
    <Section title="Timeline">
      <p>
        <span>Playback: {playback} · Position: {positionLabel}</span>
      </p>
      {branches.length > 0 ? (
        <ul>
          {branches.map((branch) => (
            <li key={branch.key}>
              {branch.label} <span>({branch.positionLabel})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>No branch points.</p>
      )}
    </Section>
  );
}

/** The activity feed: the latest typed events, newest first. */
export function IntentFeed({ rows }: { rows: readonly FeedRow[] }) {
  if (rows.length === 0) {
    return (
      <Section title="Activity">
        <p>No activity yet.</p>
      </Section>
    );
  }
  return (
    <Section title="Activity">
      <ol reversed>
        {rows.map((row) => (
          <li key={row.key} value={row.sequence}>
            <span>{row.summary}</span>
            <span> — {row.actorLabel}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** One Engineering Moment summary card. */
export function MomentCardView({ moment }: { moment: MomentCard }) {
  return (
    <article aria-label={`Engineering moment ${moment.label}`}>
      <h4>{moment.label}</h4>
      <dl>
        <dt>Digest</dt>
        <dd title={moment.digest}>{moment.shortDigest}</dd>
        <dt>Captured by</dt>
        <dd>
          {moment.capturedByLabel} at {moment.capturedAt}
        </dd>
        <dt>Snapshot</dt>
        <dd>
          {moment.snapshotCount} reference(s) · {moment.agentCount} agent(s) ·{' '}
          {moment.humanCount} human(s)
        </dd>
        <dt>Evidence</dt>
        <dd>{moment.evidenceCount} record(s)</dd>
        <dt>Timeline</dt>
        <dd>{moment.positionLabel}</dd>
        <dt>Available actions</dt>
        <dd>{moment.availableActions.join(', ')}</dd>
      </dl>
    </article>
  );
}

/** The feature root: the full AI collaboration panel. */
export function AgentCollaborationPanel({ model }: { model: AgentCollaborationViewModel }) {
  return (
    <div data-feature="agents" data-session={model.sessionKey}>
      <header>
        <h2>{model.title}</h2>
        <p>
          <span>{model.tenantId}</span>
          <span> · {model.scopeLabel}</span>
          <span> · {model.stateLabel}</span>
          <span>
            {' '}
            · opened by {model.openedByLabel} at {model.openedAt}
          </span>
          <span>
            {' '}
            · {model.eventCount} event(s) through sequence {model.lastSequence}
          </span>
        </p>
      </header>
      <PresenceRoster rows={model.roster} />
      <ControlPanel controllerLabel={model.controllerLabel} denials={model.denials} />
      <TimelineBar playback={model.playback} positionLabel={model.positionLabel} branches={model.branches} />
      <IntentFeed rows={model.feed} />
      {model.moments.length > 0 ? (
        <Section title="Engineering moments">
          {model.moments.map((moment) => (
            <MomentCardView key={moment.key} moment={moment} />
          ))}
        </Section>
      ) : null}
    </div>
  );
}
