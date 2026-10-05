'use client';
/**
 * W072 — the ENGINEERING INSPECTOR + BOQ/COST + CONSTRAINTS + VARIANTS
 * (the right rail of the web construction solution workspace; the
 * design-language "right inspector/cost" adapted to professional
 * engineering — narrow, restrained, tabbed, scrollable).
 *
 * The inspector is a PROJECTION of the semantic world — never a second
 * ledger: every value comes from the frozen W071 fixture's engineering
 * projection (identity, material, dimensions, quantity, phase, status,
 * cost, constraints) or the canonical runtime view model (canonical
 * entity id, content digest, visibility). The BOQ/cost surface reads the
 * fixture's per-layer rollups (identity-mapped to canonical plan-line
 * ids) with bidirectional BOQ-item ↔ world-entity cross-selection; the
 * constraints/findings surface reads the fixture's finding records with
 * spatial focus; the variant comparison reads the fixture's solution
 * variants and CHANGES THE WORLD through the workspace's variant
 * presentation (never a table-only feature).
 */
import { useState, type ReactNode } from 'react';
import type { SolutionVariantId } from '../construction-solution';
import {
  BOQ_ROLLUPS,
  BOQ_TOTAL,
  CONTROL_IDS,
  SOLUTION_BRANCH_PHASE,
  SOLUTION_IDENTITY,
  SOLUTION_SIMULATE_CONTROL,
  SOLUTION_VARIANT_IDS_ORDERED,
  boqEstimate,
  entityEvidenceOf,
  formatEur,
  layerColorOf,
  presentedConstraints,
  variantDeltaSummary,
  variantOf,
  type ConstructionBoqLineItem,
  type ConstructionPhase,
  type CrossHighlight,
  type PresentedConstructionEntity,
} from '../construction-solution';
import { CS, CS_TYPE, FONTS, STATUS_COLORS } from '../construction-tokens';
import type { WorkspaceViewModelInput } from '../workspace-contracts';
import type { WorkspaceHandlers } from '../workspace-handlers';
import { WorldFoundationPanel } from './WorldWorkspacePanels';

/** The inspector tab ids. */
export type InspectorTab = 'inspect' | 'boq' | 'findings' | 'variants';

/** The inspector tabs (compact rail — one visible section at a time). */
const TABS: readonly { readonly tab: InspectorTab; readonly label: string }[] = [
  { tab: 'inspect', label: 'Inspector' },
  { tab: 'boq', label: 'BOQ' },
  { tab: 'findings', label: 'Findings' },
  { tab: 'variants', label: 'Variants' },
];

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
    <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 6, alignItems: 'baseline' }}>
      <span
        style={{
          fontSize: CS_TYPE.sizeXxs,
          color: CS.textMuted,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: CS_TYPE.sizeXs,
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
}: {
  readonly title: string;
  readonly testId?: string;
  readonly children: ReactNode;
  readonly accent?: boolean;
}): ReactNode {
  return (
    <section
      data-testid={testId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 8,
        borderRadius: 6,
        border: `1px solid ${accent ? CS.accentBorder : CS.border}`,
        background: accent ? CS.accentDim : CS.surfaceRaised,
      }}
    >
      <span
        style={{
          fontSize: CS_TYPE.sizeXxs,
          fontWeight: 700,
          color: CS.text,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </span>
      {children}
    </section>
  );
}

/** The agent card entry (the inspected agent's task). */
export interface InspectorAgent {
  readonly agentId: string;
  readonly label: string;
  readonly role: string;
  readonly task: string;
  readonly currentWorkEntityId: string;
  readonly followed: boolean;
}

/** The inspector props. */
export interface ConstructionInspectorProps {
  readonly view: WorkspaceViewModelInput;
  readonly handlers: WorkspaceHandlers;
  readonly annotationDraft: string;
  readonly onAnnotationDraftChange: (text: string) => void;
  readonly selectedEntityId: string | null;
  readonly presented: readonly PresentedConstructionEntity[];
  readonly variantId: SolutionVariantId;
  /** The tab presented first (defaults to 'inspect'; a testability seam). */
  readonly initialTab?: InspectorTab | undefined;
  /** Select a solution variant: issue the typed branch intent at the
   * fixture's branch point and re-present the world. */
  readonly onVariantChange: (variantId: SolutionVariantId) => void;
  /** Cross-highlight from a BOQ line item → its world entity. */
  readonly onBoqHighlight: (line: ConstructionBoqLineItem) => void;
  /** Spatial focus from a constraint finding → its world entities. */
  readonly onConstraintFocus: (entityIds: readonly string[]) => void;
  /** The persistent cross-selection state (BOQ ↔ world / constraint / agent). */
  readonly crossHighlight: CrossHighlight;
  /** Clear the cross-highlight (the persistence contract's explicit exit). */
  readonly onClearHighlight: () => void;
  /** The inspected agent (the agent card replaces the entity card). */
  readonly activeAgent: InspectorAgent | null;
  /** Clear the agent card (back to the entity inspector). */
  readonly onClearAgent: () => void;
  /** Select one entity from the inspector (the evidence links). */
  readonly onSelectEntity: (entityId: string) => void;
  readonly activePhase: ConstructionPhase;
}

/** The right rail: engineering inspector + BOQ/cost + constraints + variants. */
export function ConstructionInspector(props: ConstructionInspectorProps): ReactNode {
  const [tab, setTab] = useState<InspectorTab>(props.initialTab ?? 'inspect');
  const [boqOpen, setBoqOpen] = useState(false);
  const view = props.view;
  // The canonical inspect projection of the runtime (the seam's own view —
  // the fallback labels when the fixture carries no projection of the id).
  const runtimeInspect = view.inspect;
  const selected = props.selectedEntityId === null ? null : props.presented.find(
    (entity) => entity.geometry.entityId === props.selectedEntityId,
  );
  const selectedProjection = selected?.projection ?? null;
  const evidence = props.selectedEntityId === null ? null : entityEvidenceOf(props.selectedEntityId, props.variantId);
  const selectedLineIds = new Set(evidence?.boqLines.map((line) => line.lineId) ?? []);
  const highlightedLineIds = new Set(props.crossHighlight.lineIds);
  const estimate = boqEstimate();
  const constraints = presentedConstraints(props.variantId);

  return (
    <aside
      aria-label="Engineering inspector"
      data-testid="cs-inspector"
      data-panel="inspector"
      data-workspace-secondary=""
      style={{
        // The viewport-PROPORTIONAL right rail (the navigator's sibling:
        // ~15% of the workspace row, min-clamped for the smallest canonical
        // canvas — the world keeps its constant dominant share at every
        // window width; see ConstructionNavigator).
        flex: '0 0 15%',
        minWidth: 234,
        boxSizing: 'border-box',
        background: CS.surface,
        border: `1px solid ${CS.border}`,
        borderRadius: 8,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        overflowY: 'auto',
        minHeight: 0,
      }}
    >
      {/* ---- The tab strip ------------------------------------------------ */}
      <div role="tablist" aria-label="Inspector sections" style={{ display: 'flex', gap: 3 }}>
        {TABS.map((entry) => (
          <button
            key={entry.tab}
            type="button"
            role="tab"
            aria-selected={tab === entry.tab}
            data-testid={`cs-inspector-tab-${entry.tab}`}
            data-tab-active={tab === entry.tab ? 'true' : 'false'}
            onClick={() => setTab(entry.tab)}
            style={{
              flex: 1,
              padding: '3px 0',
              borderRadius: 4,
              border: `1px solid ${tab === entry.tab ? CS.accentBorder : CS.border}`,
              background: tab === entry.tab ? CS.accentDim : CS.surfaceRaised,
              color: tab === entry.tab ? CS.accent : CS.textSecondary,
              fontSize: CS_TYPE.sizeXxs,
              fontWeight: 600,
              fontFamily: FONTS.sans,
              cursor: 'pointer',
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {/* ---- The INSPECTOR tab (canonical identity + §9 projection) -------- */}
      {tab === 'inspect' ? (
        props.activeAgent !== null ? (
          <InspectorCard title="Agent — task inspection" testId="cs-agent-card" accent>
            <Field label="Agent" value={props.activeAgent.label} />
            <Field label="Role" value={props.activeAgent.role} />
            <Field label="Task" value={props.activeAgent.task} />
            <Field label="Working on" value={props.activeAgent.currentWorkEntityId} mono />
            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
              <button
                type="button"
                data-testid="cs-agent-card-work"
                onClick={() => props.onSelectEntity(props.activeAgent?.currentWorkEntityId ?? '')}
                style={{ flex: 1, padding: '3px 0', borderRadius: 4, border: `1px solid ${CS.accentBorder}`, background: CS.accentDim, color: CS.accent, fontSize: CS_TYPE.sizeXxs, fontWeight: 600, fontFamily: FONTS.sans, cursor: 'pointer' }}
              >
                Show element
              </button>
              <button
                type="button"
                data-testid="cs-agent-card-close"
                onClick={props.onClearAgent}
                style={{ flex: 1, padding: '3px 0', borderRadius: 4, border: `1px solid ${CS.border}`, background: CS.surfaceRaised, color: CS.textSecondary, fontSize: CS_TYPE.sizeXxs, fontFamily: FONTS.sans, cursor: 'pointer' }}
              >
                Back to element
              </button>
            </div>
          </InspectorCard>
        ) : props.selectedEntityId === null ? (
          <InspectorCard title="Engineering inspector">
            <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, lineHeight: 1.5 }}>
              Select an element in the world (3D pick, plan or section) — the inspector shows its
              canonical identity and the engineering projection of the same frozen fixture.
            </span>
          </InspectorCard>
        ) : (
          <InspectorCard
            title="Engineering inspector"
            testId="cs-inspect-card"
            data-entity={props.selectedEntityId}
            accent
          >
            <Field label="Entity id" value={<span data-inspect="entityId">{props.selectedEntityId}</span>} mono />
            <Field label="Label" value={<span data-inspect="label">{selectedProjection?.label ?? runtimeInspect.label ?? '—'}</span>} />
            <Field label="Type" value={<span data-inspect="entityType">{selectedProjection?.entityType ?? runtimeInspect.entityType ?? '—'}</span>} mono />
            {selectedProjection === null ? (
              <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, lineHeight: 1.45 }}>
                No engineering projection of this element in the frozen fixture (canonical identity
                only — never a fabricated projection).
              </span>
            ) : (
              <>
                <Field label="Material" value={`${selectedProjection.material.name} · ${selectedProjection.material.grade}`} />
                <Field
                  label="Dimensions"
                  value={selectedProjection.dimensions.map((v) => v.toFixed(2)).join(' × ') + ' m'}
                  mono
                />
                <Field
                  label="Quantity"
                  value={`${selectedProjection.quantity.value} ${selectedProjection.quantity.unit}`}
                  mono
                />
                <Field label="Phase" value={selectedProjection.phase.replace('phase-', '')} mono />
                <Field
                  label="Status"
                  value={
                    <span style={{ color: STATUS_COLORS[selectedProjection.status] ?? CS.text, fontWeight: 600 }}>
                      {selectedProjection.status}
                    </span>
                  }
                />
                <Field
                  label="Cost"
                  value={`${formatEur(selectedProjection.cost.amount)} · ${selectedProjection.cost.lineId}`}
                  mono
                />
                {selectedProjection.constraints.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
                    <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Constraints
                    </span>
                    {selectedProjection.constraints.map((note) => (
                      <span key={note} style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textSecondary, lineHeight: 1.45 }}>
                        · {note}
                      </span>
                    ))}
                  </div>
                ) : null}
                {selected !== undefined && selected !== null && selected.state !== 'baseline' && selected.delta !== null ? (
                  <Field
                    label="Variant Δ"
                    value={
                      <span style={{ color: selected.state === 'removed' ? CS.danger : selected.state === 'added' ? CS.success : CS.boq }}>
                        {selected.state} — {selected.delta.note}
                      </span>
                    }
                  />
                ) : null}
              </>
            )}
          </InspectorCard>
        )
      ) : null}

      {/* ---- The §9 evidence trail (inspector tab, under the card) --------- */}
      {tab === 'inspect' && props.activeAgent === null && evidence !== null ? (
        <InspectorCard title="Evidence trail (§9)" testId="cs-evidence-card">
          <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, lineHeight: 1.5 }}>
            Everything the frozen fixture cites for this element — its BOQ line(s), the findings
            that reference it, the agents working on it, its layer and phase.
          </span>
          {evidence.boqLines.length > 0 ? (
            evidence.boqLines.map((line) => (
              <button
                key={line.lineId}
                type="button"
                data-testid="cs-inspect-boq-line"
                onClick={() => props.onBoqHighlight(line)}
                style={{
                  textAlign: 'left',
                  padding: '3px 6px',
                  borderRadius: 4,
                  border: `1px solid ${CS.boqDim}`,
                  background: CS.boqDim,
                  color: CS.boq,
                  fontSize: CS_TYPE.sizeXxs,
                  fontFamily: FONTS.mono,
                  cursor: 'pointer',
                }}
              >
                BOQ {line.lineId} · {formatEur(line.amount.amount)}
              </button>
            ))
          ) : (
            <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted }}>(variant-added — no BOQ line)</span>
          )}
          {evidence.findings.length > 0 ? (
            evidence.findings.map((finding) => (
              <span
                key={finding.record.constraintId}
                data-testid="cs-inspect-finding"
                data-severity={finding.record.severity}
                data-resolved={finding.resolvedByVariant ? 'true' : 'false'}
                style={{
                  padding: '3px 6px',
                  borderRadius: 4,
                  border: `1px solid ${finding.record.severity === 'warn' ? CS.warnDim : CS.successDim}`,
                  background: finding.record.severity === 'warn' ? (finding.resolvedByVariant ? CS.successDim : CS.warnDim) : CS.successDim,
                  color: CS.textSecondary,
                  fontSize: CS_TYPE.sizeXxs,
                  lineHeight: 1.45,
                }}
              >
                {finding.record.severity === 'warn' ? (finding.resolvedByVariant ? '✓ (resolved)' : '⚠') : '✓'} {finding.record.title}
              </span>
            ))
          ) : null}
          {evidence.agents.length > 0 ? (
            evidence.agents.map((agent) => (
              <span key={agent.agentId} style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textSecondary, lineHeight: 1.45 }}>
                ⌖ {agent.label} — {agent.task}
              </span>
            ))
          ) : null}
          <Field label="Layer" value={evidence.layer === null ? '—' : `${evidence.layer.label} (${evidence.layer.layerId})`} mono />
          <Field label="Phase" value={evidence.phase === null ? '—' : evidence.phase.label} mono />
        </InspectorCard>
      ) : null}

      {/* ---- The annotation composer (inspector tab bottom) ---------------- */}
      {tab === 'inspect' ? (
        <InspectorCard title="Annotate the focused element">
          <form
            data-annotation-composer=""
            onSubmit={(event) => {
              event.preventDefault();
              props.handlers.onAnnotationSubmit(props.annotationDraft);
              props.onAnnotationDraftChange('');
            }}
            style={{ display: 'flex', gap: 4 }}
          >
            <input
              data-testid="annotation-input"
              type="text"
              value={props.annotationDraft}
              placeholder="Annotate the focused entity…"
              onChange={(event) => props.onAnnotationDraftChange(event.target.value)}
              style={{ flex: 1, minWidth: 0, fontSize: CS_TYPE.sizeXs, padding: '3px 6px', borderRadius: 4, border: `1px solid ${CS.borderStrong}`, background: CS.surfaceRaised, color: CS.text, fontFamily: FONTS.sans }}
            />
            <button type="submit" data-testid="annotation-submit" style={{ padding: '3px 8px', borderRadius: 4, border: `1px solid ${CS.border}`, background: CS.surfaceRaised, color: CS.textSecondary, fontSize: CS_TYPE.sizeXxs, fontFamily: FONTS.sans, cursor: 'pointer' }}>
              Pin
            </button>
          </form>
          <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, lineHeight: 1.45 }}>
            The typed annotate intent attaches the note to the focused semantic entity (a canonical
            revision — the world digest changes).
          </span>
        </InspectorCard>
      ) : null}

      {/* ---- The BOQ / cost tab -------------------------------------------- */}
      {tab === 'boq' ? (
        <InspectorCard title="BOQ · cost estimate" testId="cs-boq-card">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: CS_TYPE.sizeLg, fontWeight: 700, color: CS.text }}>
              {formatEur(estimate.total)}
            </span>
            <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, fontFamily: FONTS.mono }}>
              subtotal + contingency
            </span>
          </div>
          {BOQ_ROLLUPS.map((rollup) => (
            <button
              key={rollup.layerId}
              type="button"
              data-testid={`cs-boq-rollup-${rollup.layerId}`}
              title={`Highlight the ${rollup.label} layer entities in the world (the first BOQ line's entity)`}
              onClick={() => {
                const first = rollup.lineItems[0];
                if (first !== undefined) {
                  props.onBoqHighlight(first);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 4px',
                borderRadius: 4,
                border: '1px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: layerColorOf(rollup.layerId).fill,
                  border: `1px solid ${layerColorOf(rollup.layerId).stroke}`,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: CS_TYPE.sizeXs, color: CS.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {rollup.label}
              </span>
              <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, fontFamily: FONTS.mono }}>
                {rollup.lineItems.length}
              </span>
              <span style={{ fontSize: CS_TYPE.sizeXs, color: CS.textSecondary, fontFamily: FONTS.mono }}>
                {formatEur(rollup.subtotal.amount)}
              </span>
            </button>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, borderTop: `1px solid ${CS.border}`, paddingTop: 5 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: CS_TYPE.sizeXs, color: CS.textSecondary, fontFamily: FONTS.mono }}>
              <span>Subtotal</span>
              <span>{formatEur(estimate.subtotal)}</span>
            </span>
            <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, fontFamily: FONTS.mono }}>
              <span>Contingency (5% presentation)</span>
              <span>{formatEur(estimate.contingency)}</span>
            </span>
            <span style={{ display: 'flex', justifyContent: 'space-between', fontSize: CS_TYPE.sizeSm, fontWeight: 700, color: CS.text, fontFamily: FONTS.mono }}>
              <span>Total</span>
              <span data-testid="cs-boq-total">{formatEur(estimate.total)}</span>
            </span>
            <span data-testid="cs-boq-fixture-total" style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, fontFamily: FONTS.mono }}>
              fixture BOQ grand total {formatEur(BOQ_TOTAL.amount)} (authoritative fold)
            </span>
          </div>
          {/* The persistent cross-highlight status + its explicit clear. */}
          <div data-testid="cs-cross-highlight" data-source={props.crossHighlight.source ?? 'none'} style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, fontFamily: FONTS.mono, lineHeight: 1.4 }}>
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
              <button
                type="button"
                onClick={props.onClearHighlight}
                data-testid="cs-clear-highlight"
                style={{ padding: '1px 7px', borderRadius: 999, border: `1px solid ${CS.border}`, background: CS.surfaceRaised, color: CS.textSecondary, fontSize: CS_TYPE.sizeXxs, fontFamily: FONTS.sans, cursor: 'pointer' }}
              >
                Clear
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setBoqOpen((open) => !open)}
            data-testid="cs-boq-toggle"
            style={{ padding: '3px 0', borderRadius: 4, border: `1px solid ${CS.border}`, background: CS.surfaceRaised, color: CS.textSecondary, fontSize: CS_TYPE.sizeXxs, fontWeight: 600, fontFamily: FONTS.sans, cursor: 'pointer' }}
          >
            {boqOpen ? 'Hide BOQ line items' : 'View BOQ'}
          </button>
          {boqOpen ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 300, overflowY: 'auto' }}>
              {BOQ_ROLLUPS.flatMap((rollup) =>
                rollup.lineItems.map((line) => {
                  // Bidirectional: the line is highlighted when the
                  // cross-selection points at it (a picked BOQ line, or the
                  // lines of the SELECTED world entity).
                  const crossHighlighted = highlightedLineIds.has(line.lineId) || selectedLineIds.has(line.lineId);
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
                        padding: '3px 5px',
                        borderRadius: 4,
                        border: `1px solid ${crossHighlighted ? CS.boq : 'transparent'}`,
                        background: crossHighlighted ? CS.boqDim : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.text }}>
                        {line.title}
                      </span>
                      <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, fontFamily: FONTS.mono, lineHeight: 1.4 }}>
                        {line.sectionCode} · {line.quantity} {line.unit} · {formatEur(line.amount.amount)} · {line.entityId}
                      </span>
                    </button>
                  );
                }),
              )}
            </div>
          ) : null}
          <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, lineHeight: 1.45 }}>
            Selecting a BOQ line highlights + focuses its world entity (BOQ → world); selecting a
            world element reveals its line here (world → BOQ) — one identity, both directions.
          </span>
        </InspectorCard>
      ) : null}

      {/* ---- The constraints / findings tab -------------------------------- */}
      {tab === 'findings' ? (
        <InspectorCard title="Constraints · findings" testId="cs-findings-card">
          {constraints.map((entry) => (
            <button
              key={entry.record.constraintId}
              type="button"
              data-testid="cs-constraint"
              data-constraint-id={entry.record.constraintId}
              data-severity={entry.record.severity}
              data-resolved={entry.resolvedByVariant ? 'true' : 'false'}
              onClick={() => props.onConstraintFocus(entry.record.entityIds)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: '4px 6px',
                borderRadius: 4,
                border: `1px solid ${CS.border}`,
                background:
                  entry.record.severity === 'warn'
                    ? entry.resolvedByVariant
                      ? CS.successDim
                      : CS.warnDim
                    : CS.successDim,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: CS_TYPE.sizeXs, color: CS.text, lineHeight: 1.4 }}>
                {entry.record.severity === 'warn' ? (entry.resolvedByVariant ? '✓ (resolved by variant)' : '⚠') : '✓'}{' '}
                {entry.record.title}
                {entry.variantNote ? ' (variant)' : ''}
              </span>
              <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textSecondary, lineHeight: 1.45 }}>
                {entry.record.description}
              </span>
              {entry.record.entityIds.length > 0 ? (
                <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, fontFamily: FONTS.mono }}>
                  ⌖ {entry.record.entityIds.join(', ')}
                </span>
              ) : null}
            </button>
          ))}
          <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, lineHeight: 1.45 }}>
            Selecting a finding focuses its element(s) in the world (revealing a hidden owning
            layer through the typed show intent when needed — the MEP clash is spatially
            discoverable).
          </span>
        </InspectorCard>
      ) : null}

      {/* ---- The variants tab ---------------------------------------------- */}
      {tab === 'variants' ? (
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
                  padding: 6,
                  borderRadius: 4,
                  border: `1px solid ${active ? CS.accentBorder : CS.border}`,
                  background: active ? CS.accentDim : CS.surfaceRaised,
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
                    ? `${summary.changed}Δ · ${summary.removed}✕ · ${summary.added}＋`
                    : 'baseline'}
                </span>
              </button>
            );
          })}
          <span style={{ fontSize: CS_TYPE.sizeXxs, color: CS.textMuted, lineHeight: 1.45 }}>
            Selecting a variant issues the typed branch intent at the programme branch point (@{' '}
            {(SOLUTION_BRANCH_PHASE.atMs / 1000).toFixed(1)}s) and re-presents the world with its
            fixture deltas — the 3D badges, plan and section all change.
          </span>
        </InspectorCard>
      ) : null}

      {/* ---- The programme controls (the fixture's DECLARED scene controls:
              branch / simulate / pause — the typed entry points the variant
              comparison rides on; a projection of the frozen control
              records, never a second control authority; ALWAYS rendered so
              the typed entries stay reachable from every tab). ------------- */}
      <div
        data-testid="cs-programme-controls"
        data-panel="controls"
        style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 6, borderRadius: 4, border: `1px solid ${CS.border}`, background: CS.surfaceRaised }}
      >
        <span style={{ fontSize: CS_TYPE.sizeXxs, fontWeight: 700, color: CS.text, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Programme controls
        </span>
        {view.controls.map((control) => (
          <button
            key={control.controlId}
            type="button"
            data-scene-control={control.controlId}
            title={control.intentId}
            onClick={() =>
              control.controlId === SOLUTION_SIMULATE_CONTROL.controlId
                ? props.handlers.onControlInvoke(control.controlId, { scenarioRef: SOLUTION_IDENTITY.projectId })
                : control.controlId === CONTROL_IDS.branch
                  ? props.handlers.onControlInvoke(control.controlId, { branchAtMs: SOLUTION_BRANCH_PHASE.atMs })
                  : props.handlers.onControlInvoke(control.controlId)
            }
            style={{ padding: '3px 0', borderRadius: 4, border: `1px solid ${CS.border}`, background: CS.surface, color: CS.textSecondary, fontSize: CS_TYPE.sizeXxs, fontWeight: 600, fontFamily: FONTS.sans, cursor: 'pointer' }}
          >
            {control.label}
          </button>
        ))}
      </div>

      {/* ---- The foundation-asset surface (W067; every tab — the in-page
              import/bind path stays reachable on the world workspace). ---- */}
      <WorldFoundationPanel sessionAssets={view.sessionAssets} handlers={props.handlers} compact />
    </aside>
  );
}
