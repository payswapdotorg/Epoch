'use client';

/**
 * W073 — the ENGINEERING INSPECTOR + BOQ/COST + CONSTRAINTS + VARIANTS
 * (the right panel of the desktop construction solution workspace; the
 * Atelier "right inspector/cost" adapted to professional engineering).
 *
 * The inspector is a PROJECTION of the semantic world — never a second
 * ledger: every value comes from the frozen W071 fixture's engineering
 * projection (identity, material, dimensions, quantity, phase, status,
 * cost, constraints) or the canonical runtime view model (content digest,
 * visibility, position). The BOQ/cost surface reads the fixture's
 * per-layer rollups (identity-mapped to canonical plan-line ids) with
 * bidirectional BOQ-item ↔ world-entity cross-selection; the
 * constraints/findings surface reads the fixture's finding records with
 * spatial focus; the variant comparison reads the fixture's solution
 * variants and CHANGES THE WORLD through the workspace's variant
 * presentation (never a table-only feature).
 */
import { useState, type ReactNode } from 'react';
import type { WorldWorkspaceRuntime, WorkspaceViewModel } from '@epoch/world-runtime';
import type { SolutionVariantId } from '@epoch/construction-world-fixture';
import {
  BOQ_ROLLUPS,
  BOQ_TOTAL,
  SOLUTION_BRANCH_PHASE,
  SOLUTION_SIMULATE_CONTROL,
  SOLUTION_VARIANT_IDS_ORDERED,
  entityEvidenceOf,
  formatEur,
  layerRecordOf,
  presentedConstraints,
  variantDeltaSummary,
  variantOf,
  type ConstructionBoqLineItem,
  type ConstructionPhase,
  type CrossHighlight,
  type PresentedConstructionEntity,
} from './construction-projection';
import { CS, CS_TYPE, STATUS_COLORS, layerColorOf } from './construction-tokens';
import { FONTS, RADII, SPACE } from '../ui-tokens';
import type { PresentedAgent } from './world-viewport';

export interface EngineeringInspectorProps {
  readonly view: WorkspaceViewModel;
  readonly runtime: WorldWorkspaceRuntime;
  readonly selectedEntityId: string | null;
  readonly presented: readonly PresentedConstructionEntity[];
  readonly variantId: SolutionVariantId;
  /** Select a solution variant: issue the typed branch intent at the
   * fixture's branch point and re-present the world. */
  readonly onVariantChange: (variantId: SolutionVariantId) => void;
  /** Request a programme simulation of the variant comparison: the
   * fixture's declared typed simulate control (effect-only — the canonical
   * world is never mutated; a simulate-requested effect is recorded). */
  readonly onSimulateProgramme: () => void;
  /** Cross-highlight from a BOQ line item → its world entity. */
  readonly onBoqHighlight: (line: ConstructionBoqLineItem) => void;
  /** Spatial focus from a constraint finding → its world entities. */
  readonly onConstraintFocus: (entityIds: readonly string[]) => void;
  /** The persistent cross-selection state (BOQ ↔ world / constraint / agent). */
  readonly crossHighlight: CrossHighlight;
  /** Clear the cross-highlight (the persistence contract's explicit exit). */
  readonly onClearHighlight: () => void;
  /** Inspect one agent's task (the agent evidence links). */
  readonly onInspectAgent: (agentId: string) => void;
  /** Select one entity from the inspector (the agent's current-work link). */
  readonly onSelectEntity: (entityId: string) => void;
  readonly activeAgent: PresentedAgent | null;
  readonly onClearAgent: () => void;
  readonly activePhase: ConstructionPhase;
  readonly compact: boolean;
}

/** One inspector field row. */
function Field({
  label,
  value,
  mono = false,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly mono?: boolean;
}): ReactNode {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '86px 1fr', gap: SPACE.sm, alignItems: 'baseline' }}>
      <span
        style={{
          fontSize: CS_TYPE.sizeXxs,
          color: CS.textMuted,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: CS_TYPE.sizeSm,
          color: CS.text,
          fontFamily: mono ? FONTS.mono : FONTS.sans,
          wordBreak: 'break-word',
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** One inspector section card. */
function InspectorCard({
  title,
  testId,
  children,
  accent = false,
  dataEntityId,
}: {
  readonly title: string;
  readonly testId?: string;
  readonly children: ReactNode;
  readonly accent?: boolean;
  readonly dataEntityId?: string;
}): ReactNode {
  return (
    <section
      data-testid={testId}
      data-cs-inspect-entity={dataEntityId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.sm,
        padding: SPACE.md,
        borderRadius: RADII.md,
        border: `1px solid ${accent ? CS.accentBorder : CS.border}`,
        background: accent ? CS.accentDim : CS.surfaceRaised,
      }}
    >
      <span
        style={{
          fontSize: CS_TYPE.sizeXs,
          fontWeight: 700,
          color: CS.text,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </span>
      {children}
    </section>
  );
}

/** The right panel (inspector + BOQ + constraints + variants). */
export function EngineeringInspector(props: EngineeringInspectorProps): ReactNode {
  const { view, runtime } = props;
  const [boqOpen, setBoqOpen] = useState(false);
  const [annotationDraft, setAnnotationDraft] = useState('');
  const selected =
    props.presented.find((entity) => entity.geometry.entityId === props.selectedEntityId) ?? null;
  // The §9 evidence trail of the current selection (BOQ lines + findings +
  // working agents + layer/phase records — a pure fixture projection).
  const evidence = selected === null ? null : entityEvidenceOf(selected.geometry.entityId, props.variantId);
  const selectedLineIds = new Set(evidence?.boqLines.map((line) => line.lineId) ?? []);
  // A BOQ line is cross-highlighted when the cross-selection points at it
  // (either direction: a world entity's lines, or the picked BOQ line itself).
  const highlightedLineIds = new Set([...props.crossHighlight.lineIds, ...selectedLineIds]);
  const variant = variantOf(props.variantId);
  const constraints = presentedConstraints(props.variantId);
  const canonicalOfSelection =
    selected === null
      ? null
      : view.viewport.entities.find((entity) => entity.entityId === selected.geometry.entityId) ?? null;
  // The latest programme-simulation request (the typed simulate control's
  // effect — the honest receipt the affordance renders after a click; the
  // effect carries the scenario reference of the requested simulation).
  const lastSimulateRequest = [...view.effects]
    .reverse()
    .find((entry) => entry.effect.effect === 'simulate-requested');
  const simulateScenarioRef =
    lastSimulateRequest === undefined
      ? null
      : ((lastSimulateRequest.effect as { scenarioRef?: string | undefined }).scenarioRef ?? null);

  return (
    <aside
      aria-label="Engineering inspector"
      data-testid="cs-inspector"
      style={{
        width: props.compact ? '100%' : 328,
        flexShrink: 0,
        background: CS.surface,
        border: `1px solid ${CS.border}`,
        borderRadius: RADII.md,
        padding: SPACE.md,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.md,
        overflowY: 'auto',
        minHeight: 0,
      }}
    >
      {/* ---- The engineering inspector (a projection of the semantic world). */}
      <InspectorCard
        title="Engineering inspector"
        testId="cs-inspector-card"
        dataEntityId={
          props.activeAgent !== null
            ? props.activeAgent.agent.currentWorkEntityId
            : (selected?.geometry.entityId ?? undefined)
        }
      >
        {props.activeAgent !== null ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
              <span style={{ fontSize: CS_TYPE.sizeMd, fontWeight: 600, color: CS.text, flex: 1 }}>
                {props.activeAgent.agent.label}
              </span>
              <SmallButton onClick={props.onClearAgent}>Close</SmallButton>
            </div>
            <Field label="Agent id" value={props.activeAgent.agent.agentId} mono />
            <Field label="Role" value={props.activeAgent.agent.role} />
            <Field label="Task" value={props.activeAgent.agent.task} />
            <Field
              label="Current"
              value={
                <button
                  type="button"
                  data-testid="cs-inspect-agent-work"
                  onClick={() => props.onSelectEntity(props.activeAgent?.agent.currentWorkEntityId ?? '')}
                  style={{
                    padding: 0,
                    border: 'none',
                    background: 'transparent',
                    color: CS.accent,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    font: 'inherit',
                    textAlign: 'left',
                  }}
                >
                  {props.activeAgent.agent.currentWorkEntityId}
                </button>
              }
              mono
            />
            <Field
              label="Working on"
              value={
                props.presented.find((p) => p.geometry.entityId === props.activeAgent?.agent.currentWorkEntityId)
                  ?.projection.label ?? 'the element the agent is working on'
              }
            />
          </>
        ) : selected === null ? (
          <span style={{ fontSize: CS_TYPE.sizeSm, color: CS.textMuted, lineHeight: 1.5 }}>
            Pick an element in the world (3D · plan · section) or a layer member in the navigator —
            the inspector projects the canonical semantic record.
          </span>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, flexWrap: 'wrap' }}>
              <span style={{ fontSize: CS_TYPE.sizeMd, fontWeight: 600, color: CS.text, flex: 1, minWidth: 120 }}>
                {selected.projection.label}
              </span>
              <span
                style={{
                  fontSize: CS_TYPE.sizeXxs,
                  fontFamily: FONTS.mono,
                  padding: '1px 6px',
                  borderRadius: 3,
                  background: layerColorOf(selected.geometry.layer).fill,
                  border: `1px solid ${layerColorOf(selected.geometry.layer).stroke}`,
                  color: layerColorOf(selected.geometry.layer).ink,
                }}
              >
                {layerRecordOf(selected.geometry.layer)?.label ?? selected.geometry.layer}
              </span>
            </div>
            <Field label="Entity id" value={selected.geometry.entityId} mono />
            <Field label="Type" value={selected.projection.entityType} mono />
            <Field
              label="Status"
              value={
                <span style={{ color: STATUS_COLORS[selected.projection.status] ?? CS.text, fontWeight: 600 }}>
                  ● {selected.projection.status}
                </span>
              }
            />
            <Field label="Material" value={`${selected.projection.material.name} · ${selected.projection.material.grade}`} />
            <Field
              label="Dimensions"
              value={selected.projection.dimensions.map((v) => v.toFixed(2)).join(' × ') + ' m'}
              mono
            />
            <Field
              label="Quantity"
              value={`${selected.projection.quantity.value} ${selected.projection.quantity.unit}`}
              mono
            />
            <Field
              label="Phase"
              value={
                evidence?.phase === null || evidence?.phase === undefined
                  ? selected.projection.phase
                  : `${evidence.phase.label} · ${selected.projection.phase}`
              }
              mono
            />
            <Field
              label="Position"
              value={selected.geometry.position.map((v) => v.toFixed(2)).join(', ') + ' m (anchor)'}
              mono
            />
            <Field
              label="World"
              value={
                canonicalOfSelection === null
                  ? 'variant-added — not in the current revision'
                  : canonicalOfSelection.isolated
                    ? 'isolated (the only visible system)'
                    : canonicalOfSelection.visible
                      ? 'visible in the world'
                      : 'hidden in the world'
              }
              mono
            />
            <Field
              label="Cost"
              value={`${formatEur(selected.projection.cost.amount)} · ${selected.projection.cost.lineId}`}
              mono
            />
            {selected.projection.constraints.length > 0 ? (
              <Field
                label="Constraints"
                value={
                  <ul style={{ margin: 0, paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {selected.projection.constraints.map((constraint) => (
                      <li key={constraint}>{constraint}</li>
                    ))}
                  </ul>
                }
              />
            ) : null}
            {selected.delta !== null ? (
              <Field
                label={selected.state === 'removed' ? 'Removed by' : selected.state === 'added' ? 'Added by' : 'Changed by'}
                value={
                  <span style={{ color: selected.state === 'removed' ? CS.danger : CS.boq }}>
                    {variant?.label ?? props.variantId} — {selected.delta.note}
                  </span>
                }
              />
            ) : null}
            <Field
              label="Canonical"
              value={
                view.viewport.entities.find((entity) => entity.entityId === selected.geometry.entityId)
                  ?.contentDigest.slice(0, 16) ?? '(variant-added — not in the current revision)'
              }
              mono
            />
            {/* The §9 EVIDENCE TRAIL — the fixture records that reference
                this element: its BOQ line(s), the findings that cite it and
                the agents working on it (all cross-selectable). */}
            <Field
              label="BOQ line"
              value={
                evidence !== null && evidence.boqLines.length > 0 ? (
                  <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
                    {evidence.boqLines.map((line) => (
                      <button
                        key={line.lineId}
                        type="button"
                        data-testid="cs-inspect-boq-line"
                        data-cs-line-id={line.lineId}
                        onClick={() => props.onBoqHighlight(line)}
                        style={{
                          padding: 0,
                          border: 'none',
                          background: 'transparent',
                          color: CS.accent,
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          font: 'inherit',
                          fontFamily: FONTS.mono,
                          fontSize: CS_TYPE.sizeSm,
                          textAlign: 'left',
                        }}
                      >
                        {line.lineId} · {formatEur(line.amount.amount)}
                      </button>
                    ))}
                  </span>
                ) : (
                  <span style={{ color: CS.textMuted }}>(variant-added — no BOQ line)</span>
                )
              }
              mono
            />
            {evidence !== null && evidence.findings.length > 0 ? (
              <Field
                label="Findings"
                value={
                  <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
                    {evidence.findings.map(({ record, resolvedByVariant }) => (
                      <button
                        key={record.constraintId}
                        type="button"
                        data-testid="cs-inspect-finding"
                        data-constraint-id={record.constraintId}
                        data-severity={record.severity}
                        data-resolved={resolvedByVariant ? 'true' : 'false'}
                        onClick={() => props.onConstraintFocus(record.entityIds)}
                        style={{
                          padding: 0,
                          border: 'none',
                          background: 'transparent',
                          color:
                            record.severity === 'warn'
                              ? resolvedByVariant
                                ? CS.success
                                : CS.warn
                              : CS.success,
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          font: 'inherit',
                          fontSize: CS_TYPE.sizeSm,
                          textAlign: 'left',
                        }}
                      >
                        {record.severity === 'warn' ? (resolvedByVariant ? '✓' : '⚠') : '✓'} {record.title}
                      </button>
                    ))}
                  </span>
                }
              />
            ) : null}
            {evidence !== null && evidence.agents.length > 0 ? (
              <Field
                label="Agents"
                value={
                  <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
                    {evidence.agents.map((agent) => (
                      <button
                        key={agent.agentId}
                        type="button"
                        data-testid="cs-inspect-agent"
                        data-agent-id={agent.agentId}
                        onClick={() => props.onInspectAgent(agent.agentId)}
                        style={{
                          padding: 0,
                          border: 'none',
                          background: 'transparent',
                          color: CS.accent,
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          font: 'inherit',
                          fontSize: CS_TYPE.sizeSm,
                          textAlign: 'left',
                        }}
                      >
                        ⌖ {agent.label} — {agent.task}
                      </button>
                    ))}
                  </span>
                }
              />
            ) : null}
          </>
        )}
        {/* The typed annotation affordance (compose → annotate intent). */}
        <div style={{ display: 'flex', gap: SPACE.xs, marginTop: SPACE.xs }}>
          <input
            data-testid="cs-annotation-input"
            type="text"
            value={annotationDraft}
            placeholder="Annotate the selected element…"
            onChange={(event) => setAnnotationDraft(event.target.value)}
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: CS_TYPE.sizeSm,
              padding: `5px ${SPACE.sm}px`,
              borderRadius: RADII.sm,
              border: `1px solid ${CS.border}`,
              background: CS.surface,
              color: CS.text,
              fontFamily: FONTS.sans,
            }}
          />
          <SmallButton
            primary
            onClick={() => {
              if (annotationDraft.trim().length > 0) {
                void runtime.composeAnnotation(annotationDraft);
              }
              setAnnotationDraft('');
            }}
          >
            Annotate
          </SmallButton>
        </div>
      </InspectorCard>

      {/* ---- BOQ / cost -------------------------------------------------- */}
      <InspectorCard title="BOQ · cost estimate" testId="cs-boq-card">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.sm }}>
          <span style={{ fontSize: CS_TYPE.sizeLg, fontWeight: 700, color: CS.text }}>
            {formatEur(BOQ_TOTAL.amount)}
          </span>
          <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, fontFamily: FONTS.mono }}>
            grand total · {BOQ_ROLLUPS.length} layer rollups
          </span>
        </div>
        {BOQ_ROLLUPS.map((rollup) => (
          <div key={rollup.layerId} style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
            <span
              aria-hidden="true"
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: layerColorOf(rollup.layerId).fill,
                border: `1px solid ${layerColorOf(rollup.layerId).stroke}`,
              }}
            />
            <span style={{ fontSize: CS_TYPE.sizeSm, color: CS.text, flex: 1 }}>
              {rollup.label}
            </span>
            <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, fontFamily: FONTS.mono }}>
              {rollup.lineItems.length} lines
            </span>
            <span style={{ fontSize: CS_TYPE.sizeSm, color: CS.textSecondary, fontFamily: FONTS.mono }}>
              {formatEur(rollup.subtotal.amount)}
            </span>
          </div>
        ))}
        <SmallButton onClick={() => setBoqOpen((open) => !open)} testId="cs-boq-toggle">
          {boqOpen ? 'Hide BOQ line items' : 'View BOQ'}
        </SmallButton>
        {/* The persistent cross-highlight status + its explicit clear. */}
        <div
          data-testid="cs-cross-highlight"
          data-source={props.crossHighlight.source ?? 'none'}
          style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, flexWrap: 'wrap' }}
        >
          <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, fontFamily: FONTS.mono }}>
            {props.crossHighlight.source === null
              ? 'No cross-highlight.'
              : props.crossHighlight.source === 'boq'
                ? `BOQ → world · ${props.crossHighlight.entityIds.join(', ')}`
                : props.crossHighlight.source === 'world'
                  ? `world → BOQ · ${props.crossHighlight.lineIds.join(', ') || '(no BOQ line)'}`
                  : props.crossHighlight.source === 'constraint'
                    ? `finding focus · ${props.crossHighlight.entityIds.length} entities`
                    : `agent current-work · ${props.crossHighlight.entityIds.join(', ')}`}
          </span>
          {props.crossHighlight.source !== null ? (
            <SmallButton onClick={props.onClearHighlight} testId="cs-clear-highlight">
              Clear highlight
            </SmallButton>
          ) : null}
        </div>
        {boqOpen ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 260, overflowY: 'auto' }}>
            {BOQ_ROLLUPS.flatMap((rollup) =>
              rollup.lineItems.map((line) => {
                // Bidirectional: the line is highlighted when the
                // cross-selection points at it (a picked BOQ line, or the
                // lines of the SELECTED world entity).
                const crossHighlighted = highlightedLineIds.has(line.lineId);
                return (
                  <button
                    key={line.lineId}
                    type="button"
                    data-testid="cs-boq-line"
                    data-cs-boq-entity={line.entityId}
                    data-cross-highlighted={crossHighlighted ? 'true' : 'false'}
                    onClick={() => props.onBoqHighlight(line)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 1,
                      padding: `4px ${SPACE.sm}px`,
                      borderRadius: RADII.sm,
                      border: `1px solid ${crossHighlighted ? CS.boqDim : 'transparent'}`,
                      background: crossHighlighted ? CS.boqDim : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: CS_TYPE.sizeXs, color: CS.text }}>
                      {line.title}
                    </span>
                    <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, fontFamily: FONTS.mono }}>
                      {line.sectionCode} · {line.quantity} {line.unit} · {formatEur(line.amount.amount)} ·{' '}
                      {line.entityId}
                    </span>
                  </button>
                );
              }),
            )}
          </div>
        ) : null}
        <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, lineHeight: 1.45 }}>
          Line items are identity-mapped to canonical plan-line ids; clicking one cross-highlights
          its world entity (and the world selection highlights its line — bidirectional).
        </span>
      </InspectorCard>

      {/* ---- Constraints / findings --------------------------------------- */}
      <InspectorCard title="Constraints · findings" testId="cs-constraints-card">
        {constraints.map(({ record, resolvedByVariant, variantNote }) => (
          <button
            key={record.constraintId}
            type="button"
            data-testid="cs-constraint"
            data-constraint-id={record.constraintId}
            data-severity={record.severity}
            data-resolved={resolvedByVariant ? 'true' : 'false'}
            onClick={() => props.onConstraintFocus(record.entityIds)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              padding: `5px ${SPACE.sm}px`,
              borderRadius: RADII.sm,
              border: `1px solid ${CS.border}`,
              background:
                record.severity === 'warn' ? (resolvedByVariant ? CS.successDim : CS.warnDim) : CS.successDim,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: CS_TYPE.sizeXs, color: CS.text }}>
              {record.severity === 'warn' ? (resolvedByVariant ? '✓ (resolved by variant)' : '⚠') : '✓'}{' '}
              {record.title}
              {variantNote ? ' (variant)' : ''}
            </span>
            <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textSecondary, lineHeight: 1.45 }}>
              {record.description}
            </span>
            {record.entityIds.length > 0 ? (
              <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, fontFamily: FONTS.mono }}>
                ⌖ {record.entityIds.join(', ')}
              </span>
            ) : null}
          </button>
        ))}
        <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, lineHeight: 1.45 }}>
          Selecting a finding focuses its element(s) in the world (revealing a hidden owning layer
          through the typed show intent when needed).
        </span>
      </InspectorCard>

      {/* ---- Solution variants -------------------------------------------- */}
      <InspectorCard title="Solution variants" testId="cs-variants-card">
        {SOLUTION_VARIANT_IDS_ORDERED.map((candidateId) => {
          const candidate = variantOf(candidateId);
          if (candidate === null) return null;
          const active = candidateId === props.variantId;
          const summary = variantDeltaSummary(candidateId);
          return (
            <button
              key={candidateId}
              type="button"
              data-testid="cs-variant"
              data-variant-id={candidateId}
              aria-pressed={active}
              onClick={() => props.onVariantChange(candidateId)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
                padding: SPACE.sm,
                borderRadius: RADII.sm,
                border: `1px solid ${active ? CS.accentBorder : CS.border}`,
                background: active ? CS.accentDim : CS.surface,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: CS_TYPE.sizeSm, fontWeight: 600, color: active ? CS.accent : CS.text }}>
                {candidate.label}
              </span>
              <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textSecondary, lineHeight: 1.45 }}>
                {candidate.description}
              </span>
              <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, fontFamily: FONTS.mono }}>
                {formatEur(candidate.cost.total)} · {candidate.days} days · risk {candidate.risk} ·{' '}
                {summary.total > 0
                  ? `${summary.changed} changed · ${summary.removed} removed · ${summary.added} added`
                  : 'baseline'}
              </span>
            </button>
          );
        })}
        {/* The programme-simulation affordance (the variant comparison's
            typed simulate entry point): the fixture's DECLARED control,
            surfaced as-is — a projection, never a second control
            authority. Effect-only: the simulate-requested effect records
            the scenario; the canonical world is never mutated. */}
        <div
          data-testid="cs-variant-simulate-row"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: SPACE.sm,
            borderRadius: RADII.sm,
            border: `1px solid ${CS.border}`,
            background: CS.surface,
          }}
        >
          <SmallButton testId="cs-variant-simulate" onClick={props.onSimulateProgramme}>
            {SOLUTION_SIMULATE_CONTROL.label}
          </SmallButton>
          {simulateScenarioRef !== null ? (
            <span
              data-testid="cs-variant-simulate-status"
              style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textSecondary, fontFamily: FONTS.mono, lineHeight: 1.45 }}
            >
              simulate-requested · scenario {simulateScenarioRef} · world digest unchanged
            </span>
          ) : (
            <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, lineHeight: 1.45 }}>
              Requests a programme simulation of the presented variant through the typed simulate
              intent ({SOLUTION_SIMULATE_CONTROL.intentId}) — an effect-only request for the host to
              route; the world revision stays canonical.
            </span>
          )}
        </div>
        <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, lineHeight: 1.45 }}>
          Selecting a variant issues the typed branch intent at the programme branch point
          ({`@ ${(SOLUTION_BRANCH_PHASE.atMs / 1000).toFixed(1)}s`}) and re-presents the world with its
          fixture deltas — the plan, section and 3D presentations all change.
        </span>
      </InspectorCard>
    </aside>
  );
}

/** One compact inspector button. */
function SmallButton({
  children,
  onClick,
  primary = false,
  testId,
}: {
  readonly children: ReactNode;
  readonly onClick: () => void;
  readonly primary?: boolean;
  readonly testId?: string;
}): ReactNode {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: RADII.sm,
        border: `1px solid ${primary ? CS.accentBorder : CS.border}`,
        background: primary ? CS.accent : CS.surface,
        color: primary ? CS.accentInk : CS.textSecondary,
        fontSize: CS_TYPE.sizeXxs,
        fontWeight: 600,
        fontFamily: FONTS.sans,
        letterSpacing: '0.02em',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}
