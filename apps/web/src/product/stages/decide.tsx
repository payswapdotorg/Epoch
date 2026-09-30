'use client';
/**
 * @epoch/web — the Decide stage surface (W047, J03 + J04).
 *
 * Capability/role discovery (J03: discovery.run over the candidate
 * catalog — roles synthesized from capability demands, never model names),
 * solution alternatives (sealed through solution.sealVersion), constraint
 * evaluation (constraints.evaluate through the Constraint Engine),
 * verification (verification.validateChain), the human baseline decision
 * (solution.approveBaseline) and the Action Gateway approval path
 * (action.submit -> action.approve -> action.execute — the UI cannot
 * bypass the Action Gateway: every affordance is a gateway envelope).
 */
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useGateway } from '../../client/hooks';
import { Panel } from '../../shared/components';
import { SHELL_SPACING } from '../../shared/tokens';
import { Button, DataTable, Digest, ErrorBanner, Field, KeyValueGrid, Pill, SelectInput, SuccessNote, TextInput } from '../ui';
import {
  actionApprovePayload,
  actionSubmitPayload,
  approveBaselinePayload,
  constraintEvaluationPayload,
  discoveryRunPayload,
  solutionAlternativeContents,
  verificationChainPayload,
} from '../derivation';
import type { UiGatewayCallResult } from '../types';

interface SealedSolution {
  readonly contentDigest: string;
  readonly solutionId: string;
  readonly version: string;
}

/** The action statuses the Action Gateway itself derives (the authority's
 * own vocabulary — the UI never invents a status). */
const ACTION_STATUS_TONE: Readonly<Record<string, 'warning' | 'positive' | 'negative' | 'neutral'>> = {
  'awaiting-approval': 'warning',
  authorized: 'positive',
  executed: 'positive',
  denied: 'negative',
  rejected: 'negative',
  'approval-expired': 'warning',
  failed: 'negative',
};

/** The real status of one action-shaped gateway result (never invented). */
function statusOfActionResult(result: UiGatewayCallResult): string | null {
  if (!result.ok) return null;
  const action = (result.value.result as Record<string, unknown> | null)?.['action'];
  if (typeof action !== 'object' || action === null) return null;
  const status = (action as Record<string, unknown>)['status'];
  return typeof status === 'string' ? status : null;
}

/** The latest action in the authority's stream still awaiting its human
 * approval (action ids carry a monotonic timestamp suffix — ascending id
 * order is submission order). Null when the queue is empty. */
function latestPendingAction(actions: readonly Record<string, unknown>[]): Record<string, unknown> | null {
  const pending = actions
    .filter((action) => action['status'] === 'awaiting-approval')
    .sort((a, b) => (String(a['actionId']) < String(b['actionId']) ? 1 : String(a['actionId']) > String(b['actionId']) ? -1 : 0));
  return pending[0] ?? null;
}

export function DecideStage(): ReactNode {
  const { configuration, call } = useGateway();
  const alternatives = solutionAlternativeContents(configuration);
  const [selected, setSelected] = useState('baseline');
  const [constrainedValue, setConstrainedValue] = useState('12');
  const [sealed, setSealed] = useState<SealedSolution | null>(null);
  const [sealResult, setSealResult] = useState<UiGatewayCallResult | null>(null);
  const [constraintResult, setConstraintResult] = useState<UiGatewayCallResult | null>(null);
  const [chainResult, setChainResult] = useState<UiGatewayCallResult | null>(null);
  const [baselineResult, setBaselineResult] = useState<UiGatewayCallResult | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<UiGatewayCallResult | null>(null);
  const [approveResult, setApproveResult] = useState<UiGatewayCallResult | null>(null);
  const [executeResult, setExecuteResult] = useState<UiGatewayCallResult | null>(null);
  const [discovery, setDiscovery] = useState<Record<string, unknown> | null>(null);
  const [discoveryCandidates, setDiscoveryCandidates] = useState<string[]>(
    ['candidate:construction-delivery-team', 'candidate:construction-delivery-copilot'].map((id) =>
      id.replace('construction', configuration.domain),
    ),
  );
  const [discoveryResult, setDiscoveryResult] = useState<UiGatewayCallResult | null>(null);

  const candidateCatalog = (configuration.templates.discovery.candidates as { candidateId: string; displayName: string; kind: string; evaluationState: string }[]);

  const sealAlternative = async (): Promise<void> => {
    setSealResult(null);
    const alternative = alternatives.find((entry) => entry.id === selected)!;
    const result = await call('solution.sealVersion', { content: alternative.content });
    setSealResult(result);
    if (result.ok) {
      const record = result.value.result as unknown as SealedSolution;
      setSealed({ contentDigest: record.contentDigest, solutionId: record.solutionId, version: record.version });
    }
  };

  const evaluateConstraint = async (): Promise<void> => {
    setConstraintResult(null);
    const result = await call('constraints.evaluate', constraintEvaluationPayload(configuration, Number(constrainedValue)));
    setConstraintResult(result);
  };

  const validateChain = async (): Promise<void> => {
    setChainResult(null);
    const evidenceFile = configuration.records.evidence as Record<string, unknown>;
    const solutionFile = configuration.records.solution as Record<string, unknown>;
    const result = await call('verification.validateChain', verificationChainPayload(configuration, {
      evidenceRecord: evidenceFile['record'] as never,
      evidenceDigest: String(evidenceFile['evidenceDigest']),
      solutionId: String(solutionFile['solutionId']),
      solutionDigest: sealed?.contentDigest ?? String(solutionFile['contentDigest']),
      approverId: configuration.templates.action.approverPrincipal,
    }));
    setChainResult(result);
  };

  const approveBaseline = async (): Promise<void> => {
    setBaselineResult(null);
    if (sealed === null) return;
    const solutionFile = configuration.records.solution as Record<string, unknown>;
    const sealedRecord = sealed === null ? solutionFile : { ...solutionFile, contentDigest: sealed.contentDigest };
    const result = await call('solution.approveBaseline', approveBaselinePayload(configuration, sealedRecord as never, configuration.templates.action.approverPrincipal));
    setBaselineResult(result);
  };

  const submitAction = async (): Promise<void> => {
    setSubmitResult(null);
    setApproveResult(null);
    setExecuteResult(null);
    const nextActionId = `action:${configuration.domain}-web-${Date.now().toString(36)}`;
    const result = await call('action.submit', actionSubmitPayload(configuration, {
      actionId: nextActionId,
      proposedBy: 'agent:delivery-copilot',
      constrainedValue: Number(constrainedValue),
    }));
    // The authority's own verdict decides what the surface affords next
    // (e.g. a policy-denied action never offers approval/execution).
    const status = statusOfActionResult(result);
    if (result.ok) {
      setActionId(nextActionId);
      setActionStatus(status);
    }
    setSubmitResult(result);
  };

  const approveAction = async (): Promise<void> => {
    setApproveResult(null);
    if (actionId === null) return;
    const result = await call('action.approve', actionApprovePayload(configuration, {
      actionId,
      decidedBy: configuration.templates.action.approverPrincipal,
      note: 'web decide-stage approval (supervision intervention)',
    }));
    setActionStatus(statusOfActionResult(result) ?? actionStatus);
    setApproveResult(result);
  };

  const executeAction = async (): Promise<void> => {
    setExecuteResult(null);
    if (actionId === null) return;
    const result = await call('action.execute', { actionId });
    setActionStatus(statusOfActionResult(result) ?? actionStatus);
    setExecuteResult(result);
  };

  const runDiscovery = async (): Promise<void> => {
    setDiscoveryResult(null);
    const result = await call('discovery.run', discoveryRunPayload(configuration, discoveryCandidates));
    setDiscoveryResult(result);
    if (result.ok) {
      setDiscovery(result.value.result as Record<string, unknown>);
    }
  };

  // Full-page navigation (the navigator links are real <a href> reloads)
  // resets this surface's local state — so the pending approval is
  // re-resolved from the AUTHORITATIVE action stream on every mount (the
  // reload-resolves-authoritative-state rule; never localStorage). This is
  // the J09 intervention path: supervise elsewhere, return to Decide, and
  // the pending agent action is still here — because the queue IS the
  // gateway's, not the browser's.
  useEffect(() => {
    void (async () => {
      const list = await call('action.status', {});
      if (!list.ok || !Array.isArray(list.value.result)) return;
      const pending = latestPendingAction(list.value.result as readonly Record<string, unknown>[]);
      if (pending === null) return;
      const pendingId = pending['actionId'];
      if (typeof pendingId === 'string') {
        setActionId(pendingId);
        setActionStatus('awaiting-approval');
      }
    })();
  }, [call]);

  const roles = (discovery?.['roleProposals'] as { roleId: string; mission: string; proposedOperations?: string[] }[] | undefined) ?? [];
  const organizations = (discovery?.['organizations'] as { organizationId: string; summary?: string }[] | undefined) ?? [];
  const gaps = (discovery?.['gaps'] as { gapId: string; operation?: { id: string } }[] | undefined) ?? [];

  return (
    <div data-route-surface="route:decide" data-stage="decide" style={{ display: 'grid', gap: `${SHELL_SPACING.lg}px` }}>
      <Panel title="Capability discovery — organization composition (J03)">
        <p style={{ marginTop: 0, color: '#57534e' }}>
          Roles are synthesized from capability DEMANDS derived from the task/world/evidence/constraint signals,
          then resolved against candidates by MEASURED capability claims — never by model names. The candidate
          catalog declares capabilities; the discovery plane owns the matching.
        </p>
        <div style={{ display: 'grid', gap: `${SHELL_SPACING.md}px` }}>
          <div role="group" aria-label="Discovery candidates" style={{ display: 'grid', gap: `${SHELL_SPACING.xs}px` }}>
            {candidateCatalog.map((candidate) => (
              <label key={candidate.candidateId} style={{ display: 'flex', gap: `${SHELL_SPACING.sm}px`, alignItems: 'center', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={discoveryCandidates.includes(candidate.candidateId)}
                  onChange={(event) => {
                    setDiscoveryCandidates((current) =>
                      event.target.checked
                        ? [...current, candidate.candidateId]
                        : current.filter((id) => id !== candidate.candidateId),
                    );
                  }}
                  aria-label={`Include candidate ${candidate.displayName}`}
                />
                <span>{candidate.displayName}</span>
                <Pill tone={candidate.evaluationState === 'verified' ? 'positive' : 'warning'}>{candidate.evaluationState}</Pill>
                <Pill>{candidate.kind}</Pill>
              </label>
            ))}
          </div>
          <div>
            <Button onClick={() => void runDiscovery()} testId="run-discovery" ariaLabel="Run problem-driven capability discovery">
              Run discovery
            </Button>
          </div>
          {discoveryResult === null ? null : discoveryResult.ok ? (
            <SuccessNote testId="discovery-success">
              Discovery run complete — {roles.length} role proposals, {organizations.length} organization compositions, {gaps.length} capability gaps.
            </SuccessNote>
          ) : (
            <ErrorBanner error={discoveryResult.error} testId="discovery-error" />
          )}
          {discovery === null ? null : (
            <>
              <DataTable
                caption="Synthesized roles"
                testId="role-table"
                rows={roles}
                rowKey={(role) => role.roleId}
                columns={[
                  { header: 'Role', cell: (role) => <code style={{ fontSize: '12px' }}>{role.roleId}</code> },
                  { header: 'Mission', cell: (role) => role.mission },
                ]}
              />
              <DataTable
                caption="Capability gaps"
                testId="gap-table"
                rows={gaps}
                rowKey={(gap) => gap.gapId}
                emptyLabel="No capability gaps — every demand resolves."
                columns={[
                  { header: 'Gap', cell: (gap) => <code style={{ fontSize: '12px' }}>{gap.gapId}</code> },
                  { header: 'Operation', cell: (gap) => String(gap.operation?.id ?? '—') },
                ]}
              />
            </>
          )}
        </div>
      </Panel>

      <Panel title="Solution alternatives">
        <div style={{ display: 'grid', gap: `${SHELL_SPACING.md}px` }}>
          <Field label="Alternative" htmlFor="decide-alternative">
            <SelectInput
              id="decide-alternative"
              value={selected}
              testId="decide-alternative"
              onChange={setSelected}
              options={alternatives.map((alternative) => ({ value: alternative.id, label: alternative.label }))}
            />
          </Field>
          <div>
            <Button onClick={() => void sealAlternative()} testId="seal-solution" ariaLabel="Seal the selected solution version">
              Seal solution version
            </Button>
          </div>
          {sealResult === null ? null : sealResult.ok ? (
            <SuccessNote testId="seal-success">
              Sealed <Digest value={sealed?.contentDigest ?? ''} label="solution content digest" />
              {sealed?.contentDigest === String((configuration.records.solution as Record<string, unknown>)['contentDigest']) ? ' (the fixture baseline — byte-exact)' : ' (the alternative line plan)'}
            </SuccessNote>
          ) : (
            <ErrorBanner error={sealResult.error} testId="seal-error" />
          )}
        </div>
      </Panel>

      <Panel title="Constraints">
        <p style={{ marginTop: 0, color: '#57534e' }}>
          {configuration.templates.constraint.inputName} &lt; {configuration.templates.constraint.limit} {configuration.templates.constraint.unit} (hard constraint, evaluated by the Constraint Engine).
        </p>
        <div style={{ display: 'flex', gap: `${SHELL_SPACING.md}px`, alignItems: 'end', flexWrap: 'wrap', maxWidth: '560px' }}>
          <Field label={`${configuration.templates.constraint.inputName} (${configuration.templates.constraint.unit})`} htmlFor="constraint-value">
            <TextInput id="constraint-value" value={constrainedValue} testId="constraint-value" onChange={setConstrainedValue} />
          </Field>
          <Button tone="secondary" onClick={() => void evaluateConstraint()} testId="evaluate-constraint" ariaLabel="Evaluate the constraint against the input value">
            Evaluate
          </Button>
        </div>
        {constraintResult === null ? null : constraintResult.ok ? (
          <div style={{ marginTop: `${SHELL_SPACING.md}px` }} data-testid="constraint-outcome">
            <KeyValueGrid
              rows={Object.entries(constraintResult.value.result as Record<string, unknown>).slice(0, 4).map(([key, value]) => ({
                key,
                value: typeof value === 'object' ? JSON.stringify(value) : String(value),
              }))}
            />
          </div>
        ) : (
          <div style={{ marginTop: `${SHELL_SPACING.md}px` }}>
            <ErrorBanner error={constraintResult.error} testId="constraint-error" />
          </div>
        )}
      </Panel>

      <Panel title="Verification + decision">
        <div style={{ display: 'grid', gap: `${SHELL_SPACING.md}px` }}>
          <div style={{ display: 'flex', gap: `${SHELL_SPACING.sm}px`, flexWrap: 'wrap' }}>
            <Button tone="secondary" onClick={() => void validateChain()} testId="validate-chain" ariaLabel="Validate the verification chain">
              Validate verification chain
            </Button>
            <Button tone="secondary" disabled={sealed === null} onClick={() => void approveBaseline()} testId="approve-baseline" ariaLabel="Approve the sealed solution version as the baseline">
              Approve baseline (solution authority)
            </Button>
          </div>
          {chainResult === null ? null : chainResult.ok ? (
            <SuccessNote testId="chain-success">Chain validated by the verification authority — verdict: {JSON.stringify((chainResult.value.result as Record<string, unknown>)['valid'] ?? 'returned')}.</SuccessNote>
          ) : (
            <ErrorBanner error={chainResult.error} testId="chain-error" />
          )}
          {baselineResult === null ? null : baselineResult.ok ? (
            <SuccessNote testId="baseline-success">Baseline approved through the solution-delivery authority (human decision recorded).</SuccessNote>
          ) : (
            <ErrorBanner error={baselineResult.error} testId="baseline-error" />
          )}
        </div>
      </Panel>

      <Panel title="Action Gateway approval (the execution authority)">
        <p style={{ marginTop: 0, color: '#57534e' }}>
          The baseline decision&apos;s execution flows through the Action Gateway: submit (proposal + tenant
          approval policy + the constrained value) → human approval (quorum 1, role{' '}
          {configuration.templates.action.approvalRole}) → authorized execution. The UI has no other execution
          path, and the affordances below follow the authority&apos;s own status verdict — a policy-denied
          action never offers approval or execution.
        </p>
        <div style={{ display: 'flex', gap: `${SHELL_SPACING.sm}px`, flexWrap: 'wrap' }}>
          <Button onClick={() => void submitAction()} testId="submit-action" ariaLabel="Submit the baseline approval action to the Action Gateway">
            Submit action
          </Button>
          <Button tone="secondary" disabled={actionId === null || actionStatus !== 'awaiting-approval'} onClick={() => void approveAction()} testId="approve-action" ariaLabel="Approve the pending action through the human approval flow">
            Approve
          </Button>
          <Button tone="secondary" disabled={actionId === null || actionStatus !== 'authorized'} onClick={() => void executeAction()} testId="execute-action" ariaLabel="Request execution of the authorized action">
            Execute
          </Button>
        </div>
        {actionStatus !== null ? (
          <div style={{ marginTop: `${SHELL_SPACING.md}px`, display: 'flex', gap: `${SHELL_SPACING.sm}px`, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#57534e', fontSize: '13px' }}>Authority status:</span>
            <Pill tone={ACTION_STATUS_TONE[actionStatus] ?? 'neutral'}>{actionStatus}</Pill>
            <code style={{ fontSize: '12px' }}>{actionId}</code>
          </div>
        ) : null}
        <div style={{ marginTop: `${SHELL_SPACING.md}px`, display: 'grid', gap: `${SHELL_SPACING.md}px` }}>
          {submitResult === null ? null : submitResult.ok ? (
            <KeyValueGrid
              testId="submit-summary"
              rows={[
                { key: 'Action', value: <code style={{ fontSize: '12px' }}>{String(((submitResult.value.result as Record<string, unknown>)['action'] as Record<string, unknown> | undefined)?.['actionId'] ?? actionId)}</code> },
                { key: 'Status', value: <Pill tone={ACTION_STATUS_TONE[actionStatus ?? ''] ?? 'warning'}>{actionStatus ?? '—'}</Pill> },
                { key: 'Replay', value: submitResult.value.replayed ? 'replayed' : 'first application' },
              ]}
            />
          ) : (
            <ErrorBanner error={submitResult.error} testId="submit-error" onRetry={() => void submitAction()} />
          )}
          {approveResult === null ? null : approveResult.ok ? (
            <SuccessNote testId="approve-success">Approved through the Action Gateway (approval recorded in the action stream).</SuccessNote>
          ) : (
            <ErrorBanner error={approveResult.error} testId="approve-error" />
          )}
          {executeResult === null ? null : executeResult.ok ? (
            <SuccessNote testId="execute-success">Executed through the Action Gateway (authorized dispatch).</SuccessNote>
          ) : (
            <ErrorBanner error={executeResult.error} testId="execute-error" />
          )}
        </div>
      </Panel>
    </div>
  );
}
