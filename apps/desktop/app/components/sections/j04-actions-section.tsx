'use client';

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ActionApprovalViewModel, ActionStepRecord } from '../../../src/native/web';
import {
  ActionButton,
  Badge,
  BusyIndicator,
  ErrorCard,
  FieldLabel,
  GuidanceCard,
  KeyValue,
  Mono,
  Panel,
  ResultCard,
  TextArea,
  TextInput,
} from '../ui-kit';
import { parseJsonInput, useProductAction } from '../use-product-action';
import type { SectionProps } from './section-props';

/**
 * J04 — alternatives, constraints, evaluation, verification, Action
 * Gateway approval.
 *
 * The visible UI carries NO harness fixtures: the compiled constraint
 * pair, the policy set and the verification chain are reference data the
 * journey harness (qa/desktop) supplies through the REAL kernels. The
 * paste form drives the SAME `runActionApprovalCycle` the runner drives
 * — submit -> human approval -> execute -> status, all through the
 * Action Gateway.
 */
export function J04ActionsSection({ ctx }: SectionProps): ReactNode {
  const [proposalText, setProposalText] = useState('');
  const [approverId, setApproverId] = useState(ctx.scenario.approverId);
  const [asRole, setAsRole] = useState(ctx.scenario.approverRole);
  const action = useProductAction<ActionApprovalViewModel>();
  const actionCounter = useRef(0);

  const proposalEmpty = proposalText.trim() === '';

  const insertExample = (): void => {
    setProposalText(JSON.stringify(ctx.scenario.exampleActionProposal, null, 2));
  };

  const runCycle = async (): Promise<void> => {
    const trimmed = proposalText.trim();
    if (trimmed === '') return;
    const parsed = parseJsonInput('The action proposal', trimmed);
    if (!parsed.ok) {
      action.fail(parsed.error);
      return;
    }
    actionCounter.current += 1;
    await action.run(() =>
      ctx.product.runActionApprovalCycle({
        actionId: `action:${ctx.scenario.domain}-ui-${actionCounter.current}`,
        proposal: parsed.value,
        decidedBy: approverId.trim() === '' ? ctx.scenario.approverId : approverId.trim(),
        asRole: asRole.trim() === '' ? ctx.scenario.approverRole : asRole.trim(),
      }),
    );
  };

  const cycle = action.outcome !== null && action.outcome.ok ? action.outcome.value : null;
  const stepTone = (step: ActionStepRecord['step']): 'success' | 'accent' | 'warning' =>
    step === 'executed' ? 'success' : step === 'approved' ? 'accent' : 'warning';

  return (
    <>
      <Panel
        title="Run the action approval cycle"
        hint="Paste a W003 action.proposal message, name the human approver and role, then run submit → approve → execute → status through the Action Gateway."
      >
        {!ctx.authenticated ? (
          <GuidanceCard>Authenticate to begin — action submission needs a bound session.</GuidanceCard>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <FieldLabel>Action proposal (JSON)</FieldLabel>
            <TextArea
              id="j04-proposal"
              ariaLabel="Action proposal JSON"
              value={proposalText}
              onChange={setProposalText}
              placeholder='{ "protocolVersion": "1.0.0", "messageKind": "action.proposal", … }'
              rows={10}
            />
          </div>
          {proposalEmpty ? (
            <GuidanceCard title="Paste an action proposal to run the cycle">
              <span>
                The textarea above expects one JSON action proposal (the W003 action.proposal message shape:
                actionType, target, parameters, authorityRequirements…). The UI deliberately ships no harness
                fixtures — compiled constraints, policy sets and verification chains are harness reference data
                (see qa/desktop), so this form drives the same approval cycle with your own proposal.
              </span>
              <span>
                Approver defaults follow the domain quorum (
                {ctx.scenario.approverRole} for {ctx.scenario.domain}); a mismatched role or a malformed
                proposal surfaces as the authority&apos;s typed rejection card.
              </span>
            </GuidanceCard>
          ) : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <div>
              <FieldLabel>Approver principal id</FieldLabel>
              <TextInput
                id="j04-approver"
                ariaLabel="Approver principal id"
                value={approverId}
                onChange={setApproverId}
                placeholder={ctx.scenario.approverId}
              />
            </div>
            <div>
              <FieldLabel>Approver role</FieldLabel>
              <TextInput
                id="j04-role"
                ariaLabel="Approver role"
                value={asRole}
                onChange={setAsRole}
                placeholder={ctx.scenario.approverRole}
              />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <ActionButton
              variant="primary"
              disabled={!ctx.authenticated || action.busy || proposalEmpty}
              onClick={() => void runCycle()}
            >
              Run approval cycle
            </ActionButton>
            <ActionButton disabled={action.busy} onClick={insertExample}>
              Insert example proposal
            </ActionButton>
            {action.busy ? <BusyIndicator label="Running submit → approve → execute…" /> : null}
          </div>
        </div>

        {action.outcome !== null && !action.outcome.ok ? <ErrorCard error={action.outcome.error} /> : null}
      </Panel>

      {cycle !== null ? (
        <ResultCard
          title="Action lifecycle"
          badge={
            <>
              <Badge tone="accent">{cycle.actionId ?? 'action'}</Badge>
              <Badge tone="success">status: {cycle.status ?? '—'}</Badge>
            </>
          }
        >
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cycle.steps.map((step, index) => (
              <li
                key={`${step.step}-${index}`}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 12,
                  flexWrap: 'wrap',
                  padding: 8,
                  borderRadius: 4,
                  border: '1px solid #323943',
                  background: '#171a1f',
                }}
              >
                <Badge tone={stepTone(step.step)}>{step.step}</Badge>
                <Mono>{step.actionId}</Mono>
                <span style={{ color: '#8a929c', fontSize: '12px' }}>{step.at}</span>
                <span style={{ color: '#b9c0c8', fontSize: '12px' }}>{step.detail}</span>
              </li>
            ))}
          </ol>
          <KeyValue
            label="constraint / verification"
            value={
              cycle.constraintOutcome === null && cycle.verificationOutcome === null ? (
                <span style={{ color: '#8a929c' }}>
                  none supplied — compiled constraints and verification chains are harness reference data
                  (qa/desktop)
                </span>
              ) : (
                <span>supplied</span>
              )
            }
          />
        </ResultCard>
      ) : null}
    </>
  );
}
