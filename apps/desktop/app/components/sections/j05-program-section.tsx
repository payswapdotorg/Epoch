'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { ProgramOfWorkViewModel, ScheduleRow } from '../../../src/native/web';
import {
  ActionButton,
  Badge,
  BusyIndicator,
  DataTable,
  ErrorCard,
  FieldLabel,
  GuidanceCard,
  KeyValue,
  Mono,
  Panel,
  ResultCard,
  TextArea,
} from '../ui-kit';
import { parseJsonInput, useProductAction } from '../use-product-action';
import { solutionContentFromBundle } from '../ui-scenarios';
import type { SectionProps } from './section-props';

/**
 * J05 — program of work, BOQ/domain schedule, acquisition/procurement.
 *
 * Paste-based inputs over fixture defaults: an empty solution textarea
 * uses the sealed fixture solution minus its digest envelope (the
 * runner's solutionContent pattern); an empty program textarea uses the
 * fixture program of work. approvedBy is the bound principal. The
 * procurement quote is harness-scoped — assembling it needs the REAL
 * procurement kernels (qa/desktop), so the UI leaves quoteId null.
 */
export function J05ProgramSection({ ctx }: SectionProps): ReactNode {
  const [solutionText, setSolutionText] = useState('');
  const [programText, setProgramText] = useState('');
  const action = useProductAction<ProgramOfWorkViewModel>();

  const runWorkflow = async (): Promise<void> => {
    const solutionTrimmed = solutionText.trim();
    const programTrimmed = programText.trim();

    let solutionContent: unknown = solutionContentFromBundle(ctx.bundle);
    if (solutionTrimmed !== '') {
      const parsed = parseJsonInput('The solution content', solutionTrimmed);
      if (!parsed.ok) {
        action.fail(parsed.error);
        return;
      }
      solutionContent = parsed.value;
    }

    let program: unknown = ctx.bundle.files['program-of-work.json'];
    if (programTrimmed !== '') {
      const parsed = parseJsonInput('The program of work', programTrimmed);
      if (!parsed.ok) {
        action.fail(parsed.error);
        return;
      }
      program = parsed.value;
    }

    await action.run(() =>
      ctx.product.runProgramWorkflow({
        solutionContent,
        approvedBy: ctx.binding.principalId,
        program,
        // No quote: the procurement assembly is harness-scoped (see qa/desktop).
      }),
    );
  };

  const workflow = action.outcome !== null && action.outcome.ok ? action.outcome.value : null;
  const digestMatchesRegistry = workflow !== null && workflow.solutionVersionDigest === ctx.bundle.solutionContentDigest;

  const scheduleColumns = (valueHeader: string, costHeader: string): readonly {
    header: string;
    cell: (row: ScheduleRow) => ReactNode;
    width?: string;
  }[] => [
    { header: 'key', cell: (row) => <Mono>{row.key}</Mono> },
    { header: valueHeader, cell: (row) => row.quantity, width: '22%' },
    { header: costHeader, cell: (row) => row.cost, width: '28%' },
  ];

  return (
    <>
      <Panel
        title="Run the program workflow"
        hint="Seals + approves the solution, folds the program schedule/BOQ and the milestones through the authorities. Leave the textareas empty to run the fixture solution + program."
      >
        {!ctx.authenticated ? (
          <GuidanceCard>Authenticate to begin — the program workflow needs a bound session.</GuidanceCard>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <FieldLabel>Solution content (JSON) — empty uses the fixture solution</FieldLabel>
            <TextArea
              id="j05-solution"
              ariaLabel="Solution content JSON override"
              value={solutionText}
              onChange={setSolutionText}
              placeholder='{} — leave empty to derive the solution content from the sealed fixture (contentDigest stripped)'
              rows={6}
            />
          </div>
          <div>
            <FieldLabel>Program of work (JSON) — empty uses the fixture program</FieldLabel>
            <TextArea
              id="j05-program"
              ariaLabel="Program of work JSON override"
              value={programText}
              onChange={setProgramText}
              placeholder='{} — leave empty to use the fixture program-of-work.json'
              rows={6}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <ActionButton
              variant="primary"
              disabled={!ctx.authenticated || action.busy}
              onClick={() => void runWorkflow()}
            >
              Run program workflow
            </ActionButton>
            {action.busy ? <BusyIndicator label="Sealing, approving, folding the schedule…" /> : null}
          </div>
        </div>
        {action.outcome !== null && !action.outcome.ok ? <ErrorCard error={action.outcome.error} /> : null}
      </Panel>

      {workflow !== null ? (
        <>
          <ResultCard
            title="Solution baseline"
            badge={
              digestMatchesRegistry ? (
                <Badge tone="success">re-seals to the fixture digest</Badge>
              ) : (
                <Badge tone="warning">digest differs from the registry</Badge>
              )
            }
          >
            <KeyValue label="solution version digest" value={<Mono>{workflow.solutionVersionDigest}</Mono>} />
            <KeyValue label="fixture registry digest" value={<Mono>{ctx.bundle.solutionContentDigest}</Mono>} />
            <KeyValue
              label="approved by"
              value={<Mono>{ctx.binding.principalId}</Mono>}
            />
            <KeyValue
              label="procurement quote"
              value={
                workflow.quoteId === null ? (
                  <span style={{ color: '#8a929c' }}>harness-scoped (see qa/desktop) — quoteId stays null</span>
                ) : (
                  <Mono>{workflow.quoteId}</Mono>
                )
              }
            />
          </ResultCard>

          <ResultCard title={`Quantity schedule (${workflow.quantitySchedule.length} rows)`}>
            <DataTable<ScheduleRow>
              caption="program.schedule — quantity fold"
              rows={workflow.quantitySchedule}
              emptyLabel="The quantity fold carries no rows."
              columns={scheduleColumns('quantity', 'cost')}
            />
          </ResultCard>

          <ResultCard title={`Cost schedule (${workflow.costSchedule.length} rows)`}>
            <DataTable<ScheduleRow>
              caption="program.schedule — cost fold"
              rows={workflow.costSchedule}
              emptyLabel="The cost fold carries no rows."
              columns={scheduleColumns('quantity', 'cost')}
            />
          </ResultCard>

          <ResultCard title={`Milestones (${workflow.milestones.length})`}>
            <DataTable<{ readonly milestoneId: string; readonly title: string; readonly status: string }>
              caption="program.schedule — milestone fold"
              rows={workflow.milestones}
              emptyLabel="The program carries no milestones."
              columns={[
                { header: 'milestone', cell: (row) => <Mono>{row.milestoneId}</Mono> },
                { header: 'title', cell: (row) => row.title },
                {
                  header: 'status',
                  cell: (row) => (
                    <Badge tone={row.status === 'done' || row.status === 'complete' ? 'success' : 'neutral'}>
                      {row.status}
                    </Badge>
                  ),
                  width: '22%',
                },
              ]}
            />
          </ResultCard>
        </>
      ) : null}
    </>
  );
}
